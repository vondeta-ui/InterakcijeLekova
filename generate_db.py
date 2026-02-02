import json
import requests
import re
from mtranslate import translate

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hcl", " hydrochloride", " calcium", " sulfate", " anhydrous", " diuretics"]
    synonyms = {"paracetamol": "acetaminophen", "paracetamolo": "acetaminophen"}

    for p in parts:
        p = p.strip()
        for rem in removals: p = p.replace(rem, "")
        if p in synonyms: p = synonyms[p]
        if p and len(p) > 2: cleaned.append(p.strip())
    return list(set(cleaned))

def generate_database():
    print("🚀 Ažuriram bazu (Mapiranje ALIMS ID-eva)...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    try:
        resp = requests.get(url, timeout=30)
        atc_to_inn = resp.json().get('data', {})
        
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            lekovi_data = json.load(f)

        for grupa, lista in lekovi_data.items():
            for lek in lista:
                # Izvlačenje šifre proizvoda za direktan ALIMS link
                alims_id = lek.get('sifraProizvoda')
                if alims_id:
                    lek['smpc'] = f"https://www.alims.gov.rs/humani-lekovi/pretrazivanje-humanih-lekova/?id={alims_id}"
                
                atc = lek.get('atc')
                found_inns = []
                if atc and atc in atc_to_inn:
                    for raw in atc_to_inn[atc]:
                        found_inns.extend(clean_and_split_inn(raw))
                
                if not found_inns and lek.get('inn'):
                    try:
                        translated = translate(lek['inn'], 'en', 'sr')
                        found_inns = clean_and_split_inn(translated)
                    except: pass
                
                lek['inn_eng'] = list(set(["acetaminophen" if i == "paracetamol" else i for i in found_inns]))

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_data, f, ensure_ascii=False, indent=2)
        print("✅ Baza ažurirana sa direktnim ALIMS linkovima.")
    except Exception as e:
        print(f"❌ Greška: {e}")

if __name__ == "__main__":
    generate_database()