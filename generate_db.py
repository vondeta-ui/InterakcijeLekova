import json
import requests
import re
from mtranslate import translate

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hcl", " hydrochloride", " calcium", " sulfate", " anhydrous"]
    
    # HARDKODIRANO MAPIRANJE: Paracetamol -> Acetaminophen
    synonyms = {
        "paracetamol": "acetaminophen",
        "paracetamolo": "acetaminophen"
    }

    for p in parts:
        p = p.strip()
        for rem in removals:
            p = p.replace(rem, "")
        
        # Provera sinonima
        if p in synonyms:
            p = synonyms[p]
            
        if p and len(p) > 2:
            cleaned.append(p.strip())
    return list(set(cleaned))

def generate_database():
    print("🚀 Ažuriram lekovi.json (Paracetamol -> Acetaminophen)...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    try:
        resp = requests.get(url, timeout=30)
        atc_to_inn = resp.json().get('data', {})
        
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            lekovi_data = json.load(f)

        for grupa, lista in lekovi_data.items():
            for lek in lista:
                atc = lek.get('atc')
                found_inns = []
                
                # 1. Prozorro
                if atc and atc in atc_to_inn:
                    for raw in atc_to_inn[atc]:
                        found_inns.extend(clean_and_split_inn(raw))
                
                # 2. Fallback prevod ako je i dalje prazno
                if not found_inns and lek.get('inn'):
                    try:
                        translated = translate(lek['inn'], 'en', 'sr')
                        found_inns = clean_and_split_inn(translated)
                    except: pass
                
                # Još jedna provera za svaki slučaj (ako je paracetamol došao iz prevoda)
                final_inns = []
                for name in found_inns:
                    if name == "paracetamol":
                        final_inns.append("acetaminophen")
                    else:
                        final_inns.append(name)

                lek['inn_eng'] = list(set(final_inns))

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_data, f, ensure_ascii=False, indent=2)
        print("✅ Baza ažurirana. Paracetamol je sada Acetaminophen.")
    except Exception as e:
        print(f"❌ Greška: {e}")

if __name__ == "__main__":
    generate_database()