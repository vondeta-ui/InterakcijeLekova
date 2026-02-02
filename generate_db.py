import requests
import json
import re
import urllib.parse
from mtranslate import translate

TARGET_URL = "https://data.gov.rs/sr/datasets/r/cfbcda7b-511b-48f2-9f33-c2a7314bfbed"
ATC_INN_URL = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"

def clean_drug_name(raw_name):
    if not raw_name: return ""
    clean = str(raw_name).lower().replace("®", "").replace(",", "")
    return clean.split(" ")[0].strip()

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hcl", " hydrochloride", " calcium", " sulfate", " anhydrous"]
    synonyms = {"paracetamol": "acetaminophen"}
    for p in parts:
        p = p.strip()
        for rem in removals: p = p.replace(rem, "")
        if p in synonyms: p = synonyms[p]
        if p and len(p) > 2: cleaned.append(p.strip())
    return list(set(cleaned))

def generate_database():
    print("🌐 Preuzimam podatke sa data.gov.rs...")
    try:
        resp = requests.get(TARGET_URL, timeout=60)
        # Provjera da li je odgovor validan JSON
        try:
            full_data = resp.json()
        except ValueError:
            print("❌ Greška: Odgovor servera nije validan JSON format.")
            return

        # Rešava 'str' object has no attribute 'get' grešku pri preuzimanju
        raw_list = []
        if isinstance(full_data, list):
            raw_list = full_data
        elif isinstance(full_data, dict):
            for v in full_data.values():
                if isinstance(v, list):
                    raw_list = v
                    break

        if not raw_list:
            print("❌ Lista lekova nije pronađena u preuzetim podacima.")
            return

        print(f"✅ Učitano {len(raw_list)} unosa. Preuzimam ATC mapu...")
        try:
            atc_to_inn = requests.get(ATC_INN_URL, timeout=30).json().get('data', {})
        except:
            atc_to_inn = {}
            print("⚠️ Prozorro API nedostupan, koristim mtranslate fallback.")

        lekovi_baza = {}
        count = 0

        for item in raw_list:
            try:
                # Dodatna provera: preskačemo ako item nije rečnik (rešava 'str' grešku u petlji)
                if not isinstance(item, dict): continue
                
                puno_ime = item.get('nazivLeka', '').strip()
                atc = item.get('atc', '').strip()
                sid = item.get('sifraProizvoda', '').strip()
                ean = str(item.get('ean', '')).strip()
                
                if not puno_ime or not atc: continue
                search_key = clean_drug_name(puno_ime)
                
                # INN i ALIMS ID link
                found_inns = []
                if atc in atc_to_inn:
                    for raw in atc_to_inn[atc]: found_inns.extend(clean_and_split_inn(raw))
                
                # Fallback prevođenje ako Prozorro nije našao ništa
                if not found_inns and item.get('inn'):
                    try:
                        translated = translate(item['inn'], 'en', 'sr')
                        found_inns = clean_and_split_inn(translated)
                    except: pass

                drug_data = {
                    "puno_ime": puno_ime,
                    "atc": atc,
                    "inn": item.get('inn', ''),
                    "inn_eng": list(set(["acetaminophen" if i == "paracetamol" else i for i in found_inns])),
                    "sifraProizvoda": sid,
                    "smpc": f"https://www.alims.gov.rs/humani-lekovi/pretrazivanje-humanih-lekova/?id={sid}" if sid else f"https://www.alims.gov.rs/humani-lekovi/pretraga-humanih-lekova/?s={urllib.parse.quote(puno_ime.replace('®',''))}",
                    "ean": ean,
                    "oblik": item.get('oblikIDozaLeka', '').split(';')[0].strip() if ';' in item.get('oblikIDozaLeka', '') else item.get('oblikIDozaLeka', ''),
                    "jacina": item.get('oblikIDozaLeka', '').split(';')[1].strip() if ';' in item.get('oblikIDozaLeka', '') else "",
                    "rezim": item.get('rezimIzdavanjaLeka', 'N/A')
                }

                if search_key not in lekovi_baza: lekovi_baza[search_key] = []
                if not any(x['ean'] == ean for x in lekovi_baza[search_key]):
                    lekovi_baza[search_key].append(drug_data)
                    count += 1
            except: continue

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_baza, f, ensure_ascii=False, indent=2)
        print(f"✅ Uspešno obrađeno {count} varijacija lekova!")
    except Exception as e: 
        print(f"❌ Fatalna greška: {e}")

if __name__ == "__main__":
    generate_database()