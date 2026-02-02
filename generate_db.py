import requests
import json
import re
import urllib.parse
from mtranslate import translate

# Konfiguracija
TARGET_URL = "https://data.gov.rs/sr/datasets/r/cfbcda7b-511b-48f2-9f33-c2a7314bfbed"
ATC_INN_URL = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"

def clean_drug_name(raw_name):
    if not raw_name: return ""
    clean = str(raw_name).lower().replace("®", "").replace(",", "")
    return clean.split(" ")[0].strip()

def clean_and_split_inn(inn_string):
    if not inn_string: return []
    # Razdvajamo po separatorima za kombinovane lekove
    parts = re.split(r',| and | \+ | & ', inn_string.lower())
    cleaned = []
    removals = [" sodium", " potassium", " hcl", " hydrochloride", " calcium", " sulfate", " anhydrous", " diuretics"]
    synonyms = {"paracetamol": "acetaminophen", "paracetamolo": "acetaminophen"}

    for p in parts:
        p = p.strip()
        for rem in removals: p = p.replace(rem, "")
        if p in synonyms: p = synonyms[p]
        if p and len(p) > 2: cleaned.append(p.strip())import requests
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
    print("🌐 Preuzimam podatke...")
    try:
        resp = requests.get(TARGET_URL, timeout=60)
        full_data = resp.json()

        # Rešava 'str' object has no attribute 'get' grešku
        raw_list = []
        if isinstance(full_data, list):
            raw_list = full_data
        elif isinstance(full_data, dict):
            for v in full_data.values():
                if isinstance(v, list):
                    raw_list = v
                    break

        atc_to_inn = requests.get(ATC_INN_URL).json().get('data', {})
        lekovi_baza = {}

        for item in raw_list:
            try:
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
                
                drug_data = {
                    "puno_ime": puno_ime,
                    "atc": atc,
                    "inn": item.get('inn', ''),
                    "inn_eng": list(set(["acetaminophen" if i == "paracetamol" else i for i in found_inns])),
                    "sifraProizvoda": sid,
                    "smpc": f"https://www.alims.gov.rs/humani-lekovi/pretrazivanje-humanih-lekova/?id={sid}" if sid else f"https://www.alims.gov.rs/humani-lekovi/pretraga-humanih-lekova/?s={puno_ime}",
                    "ean": ean,
                    "oblik": item.get('oblikIDozaLeka', '').split(';')[0] if ';' in item.get('oblikIDozaLeka', '') else '',
                    "jacina": item.get('oblikIDozaLeka', '').split(';')[1] if ';' in item.get('oblikIDozaLeka', '') else '',
                    "rezim": item.get('rezimIzdavanjaLeka', 'N/A')
                }

                if search_key not in lekovi_baza: lekovi_baza[search_key] = []
                if not any(x['ean'] == ean for x in lekovi_baza[search_key]):
                    lekovi_baza[search_key].append(drug_data)
            except: continue

        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_baza, f, ensure_ascii=False, indent=2)
        print("✅ Uspešno!")
    except Exception as e: print(f"❌ Greška: {e}")

if __name__ == "__main__":
    generate_database()
    return list(set(cleaned))

def generate_database():
    print(f"⬇️ Preuzimam najnovije podatke sa data.gov.rs...")
    
    try:
        # 1. PREUZIMANJE REGISTRA
        response = requests.get(TARGET_URL, timeout=60)
        full_data = response.json()

        # Logika iz prve verzije: Pronalaženje liste lekova bez obzira na strukturu
        raw_list = []
        if isinstance(full_data, list):
            raw_list = full_data
        elif isinstance(full_data, dict):
            for key, val in full_data.items():
                if isinstance(val, list):
                    raw_list = val
                    break
        
        if not raw_list:
            print("❌ Nisam našao listu lekova u fajlu.")
            return

        print(f"✅ Učitano {len(raw_list)} unosa. Preuzimam ATC mapu...")
        
        # 2. PREUZIMANJE ATC-TO-INN MAPE (Prozorro)
        try:
            atc_resp = requests.get(ATC_INN_URL, timeout=30)
            atc_to_inn = atc_resp.json().get('data', {})
        except:
            atc_to_inn = {}
            print("⚠️ Upozorenje: Prozorro API nije dostupan, koristiće se fallback prevod.")

        lekovi_baza = {}
        count = 0

        for item in raw_list:
            try:
                # Osnovni podaci
                puno_ime = item.get('nazivLeka', '').strip()
                atc = item.get('atc', '').strip()
                inn_sr = item.get('inn', '').strip()
                ean = str(item.get('ean', '')).strip()
                rezim = item.get('rezimIzdavanjaLeka', '').strip()
                sid = item.get('sifraProizvoda', '').strip()

                # Razdvajanje oblika i jačine
                raw_mix = item.get('oblikIDozaLeka', '')
                oblik, jacina = "", ""
                if raw_mix:
                    parts = raw_mix.split(';')
                    if len(parts) >= 1: oblik = parts[0].strip()
                    if len(parts) >= 2: jacina = parts[1].strip()

                # Validacija
                if not puno_ime or not atc or atc[0].isdigit(): continue

                # Ključ za grupisanje (npr. "rivarox")
                search_key = clean_drug_name(puno_ime)
                if len(search_key) < 2: continue

                # --- ENGLESKI INN LOGIKA ---
                found_inns = []
                # A: Pokušaj preko ATC koda (najtačnije)
                if atc in atc_to_inn:
                    for raw in atc_to_inn[atc]:
                        found_inns.extend(clean_and_split_inn(raw))
                
                # B: Fallback na prevod ako Prozorro nije našao ništa
                if not found_inns and inn_sr:
                    try:
                        translated = translate(inn_sr, 'en', 'sr')
                        found_inns = clean_and_split_inn(translated)
                    except: pass

                # Finalna provera i mapiranje (Paracetamol -> Acetaminophen)
                final_inns = list(set(["acetaminophen" if i == "paracetamol" else i for i in found_inns]))

                # --- GENERISANJE LINKA (Tvoj novi metod) ---
                alims_link = f"https://www.alims.gov.rs/humani-lekovi/pretraga-humanih-lekova/?s={urllib.parse.quote(puno_ime.replace('®',''))}"
                if sid:
                    alims_link = f"https://www.alims.gov.rs/humani-lekovi/pretrazivanje-humanih-lekova/?id={sid}"

                drug_data = {
                    "puno_ime": puno_ime,
                    "atc": atc,
                    "inn": inn_sr,
                    "inn_eng": final_inns,
                    "jacina": jacina,
                    "oblik": oblik,
                    "rezim": rezim if rezim else "N/A",
                    "ean": ean,
                    "sifraProizvoda": sid,
                    "smpc": alims_link,
                    "pil": ""
                }

                if search_key not in lekovi_baza:
                    lekovi_baza[search_key] = []
                
                # Provera duplikata u istoj grupi
                if not any(x['ean'] == ean for x in lekovi_baza[search_key]):
                    lekovi_baza[search_key].append(drug_data)
                    count += 1

            except Exception as e: continue

        # Slanje u JSON
        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_baza, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 USPELO! Obrađeno {len(lekovi_baza)} grupa.")
        print(f"Ukupan broj varijacija: {count}")

    except Exception as e:
        print(f"❌ Fatalna greška: {e}")

if __name__ == "__main__":
    generate_database()