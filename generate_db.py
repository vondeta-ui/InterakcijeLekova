import json
import requests
import re

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    # Razbijamo po zarezima, 'and', '+', '&'
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hydrochloride", " hcl", " calcium", " sulfate", " anhydrous"]
    for p in parts:
        p = p.strip()
        for rem in removals:
            p = p.replace(rem, "")
        if p:
            cleaned.append(p.strip())
    return cleaned

def generate_database():
    print("🚀 Ažuriram lekovi.json (INN liste)...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    try:
        resp = requests.get(url, timeout=30)
        atc_to_inn = resp.json().get('data', {})
        
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            lekovi_data = json.load(f)

        for grupa, lista in lekovi_data.items():
            for lek in lista:
                atc = lek.get('atc')
                if atc and atc in atc_to_inn:
                    lek['inn_eng'] = clean_and_split_inn(atc_to_inn[atc][0])
                else:
                    lek['inn_eng'] = []

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_data, f, ensure_ascii=False, indent=2)
        print("✅ Uspeh!")
    except Exception as e:
        print(f"❌ Greška: {e}")

if __name__ == "__main__":
    generate_database()