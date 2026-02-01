import json
import requests
import re
from mtranslate import translate

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    # Razdvajamo po separatorima
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hcl", " hydrochloride", " calcium", " sulfate", " anhydrous"]
    for p in parts:
        p = p.strip()
        for rem in removals:
            p = p.replace(rem, "")
        if p and len(p) > 2:
            cleaned.append(p.strip())
    return list(set(cleaned))

def generate_database():
    print("🚀 Ažuriram lekovi.json (Pametni fallback prevod)...")
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
                
                # 1. PRVO: Pokušaj preko Prozorro (najpouzdanije)
                if atc and atc in atc_to_inn:
                    for raw in atc_to_inn[atc]:
                        found_inns.extend(clean_and_split_inn(raw))
                
                # 2. DRUGO: Prevodimo SAMO AKO Prozorro nije našao ništa
                if not found_inns and lek.get('inn'):
                    srpski_inn = lek.get('inn')
                    print(f"🔍 Prozorro prazan za {lek['puno_ime']}. Prevodim: {srpski_inn}...")
                    try:
                        # Prevodimo srpski INN na engleski
                        translated = translate(srpski_inn, 'en', 'sr')
                        found_inns = clean_and_split_inn(translated)
                    except Exception as e:
                        print(f"⚠️ Neuspešan prevod za {srpski_inn}: {e}")
                
                # Skladištimo unikatne rezultate
                lek['inn_eng'] = list(set(found_inns))

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_data, f, ensure_ascii=False, indent=2)
        print("✅ Baza je osvežena. Prevedeni su samo nedostajući podaci.")
        
    except Exception as e:
        print(f"❌ Fatalna greška: {e}")

if __name__ == "__main__":
    generate_database()