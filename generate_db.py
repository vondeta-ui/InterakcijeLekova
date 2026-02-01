import json
import requests
import re

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    # Razdvajamo po zarezima, rečima "and", simbolima "+" i "&"
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    # Čistimo soli i sufikse
    removals = [" sodium", " potassium", " hydrochloride", " hcl", " calcium", " sulfate", " anhydrous"]
    for p in parts:
        p = p.strip()
        for rem in removals:
            p = p.replace(rem, "")
        if p:
            cleaned.append(p.strip())
    return cleaned

def update_lekovi_json():
    print("🌐 Preuzimam Prozorro rečnik za mapiranje INN-ova...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    try:
        resp = requests.get(url, timeout=30)
        atc_to_inn = resp.json().get('data', {})
        
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            data = json.load(f)

        for category in data.values():
            for drug in category:
                atc = drug.get('atc')
                if atc and atc in atc_to_inn:
                    raw_inn = atc_to_inn[atc][0]
                    # Pretvaramo u listu ["tenofovir disoproxil", "emtricitabine"]
                    drug['inn_eng'] = clean_and_split_inn(raw_inn)
                else:
                    drug['inn_eng'] = []

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("✅ lekovi.json ažuriran sa engleskim INN listama.")
        
    except Exception as e:
        print(f"❌ Greška: {e}")

if __name__ == "__main__":
    update_lekovi_json()