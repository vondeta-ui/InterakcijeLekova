import requests
import json
import csv
import io
import sys
import urllib3

# Isključujemo dosadna upozorenja o nestabilnoj vezi (pošto namerno gasimo SSL)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

DDINTER_URLS = [
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_A.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_B.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_D.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_H.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_L.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_P.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_R.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_V.csv"
]

def normalize_name(name):
    """Čisti ime leka."""
    if not name: return ""
    name = name.lower().strip()
    removals = [" sodium", " potassium", " hydrochloride", " hcl", " calcium", " sulfate", " tablet", " injection", " solution", " oral"]
    for rem in removals:
        name = name.replace(rem, "")
    return name

def get_atc_dictionary():
    """1. KORAK: Prozorro API (ATC -> INN)"""
    print("🌐 2. Preuzimam ATC Rečnik (Prozorro API)...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    english_to_atc = {}
    try:
        # Prozorro ima validan sertifikat, tu ne moramo da gasimo proveru
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            registry = data.get('data', {})
            count = 0
            for atc, names in registry.items():
                if names and isinstance(names, list):
                    clean_name = normalize_name(names[0])
                    english_to_atc[clean_name] = atc
                    count += 1
            print(f"   ✅ Uspešno mapirano {count} ATC kodova (Prozorro).")
            return english_to_atc
    except Exception as e:
        print(f"   ⚠️ Greška sa Prozorro API: {e}")
    return {}

def download_ddinter_files():
    """2. KORAK: Skida CSV fajlove (Ignoriše SSL greške)."""
    print("🌐 3. Preuzimam DDInter CSV fajlove (Bypass SSL)...")
    
    all_interactions = []
    
    for url in DDINTER_URLS:
        filename = url.split('_code_')[-1] 
        print(f"   ⏳ Preuzimam fajl {filename} ...")
        
        try:
            # KLJUČNA PROMENA: verify=False (Ignoriši istekao sertifikat)
            resp = requests.get(url, headers=HEADERS, timeout=60, verify=False)
            
            if resp.status_code == 200:
                # Moramo da dekodujemo sadržaj jer requests nekad vrati bajtove
                content = resp.content.decode('utf-8', errors='ignore')
                
                csv_file = io.StringIO(content)
                reader = csv.reader(csv_file)
                
                header = next(reader, None)
                
                file_count = 0
                for row in reader:
                    if len(row) >= 5:
                        all_interactions.append({
                            'drug1': row[1],
                            'drug2': row[3],
                            'level': row[4]
                        })
                        file_count += 1
                print(f"      ✅ Dodato {file_count} interakcija iz {filename}.")
            else:
                print(f"      ⚠️ Greška {resp.status_code} za {url}")
        except Exception as e:
            print(f"      ❌ Neuspelo preuzimanje {url}: {e}")

    print(f"   📊 UKUPNO prikupljeno {len(all_interactions)} sirovih interakcija.")
    return all_interactions

def generate_interactions():
    print("🚀 POKREĆEM PROCES (Prozorro + DDInter NO-SSL)...")
    print("------------------------------------------------")

    # A. UČITAVANJE TVOJIH LEKOVA
    print("📂 1. Učitavam 'lekovi.json'...")
    my_atc_codes = set()
    try:
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            local_data = json.load(f)
            for group in local_data.values():
                for drug in group:
                    if drug.get('atc'):
                        code = drug['atc'].strip()
                        my_atc_codes.add(code)       
                        my_atc_codes.add(code[:5])   
        print(f"   ✅ Pronađeno {len(my_atc_codes)} tvojih ATC unosa.")
    except Exception as e:
        print(f"   ❌ Greška: {e}")
        return

    # B. ATC REČNIK
    english_to_atc = get_atc_dictionary()
    if not english_to_atc: return

    # C. INTERAKCIJE
    raw_interactions = download_ddinter_files()
    
    if not raw_interactions:
        print("❌ Nije preuzeta nijedna interakcija.")
        return

    # D. SPAJANJE
    print("------------------------------------------------")
    print("⚙️ 4. Povezujem podatke (Matching)...")
    
    final_db = {}
    count = 0
    food_keywords = ["alcohol", "food", "grapefruit", "milk", "dairy", "juice"]

    for item in raw_interactions:
        d1 = normalize_name(item['drug1'])
        d2 = normalize_name(item['drug2'])
        level = item.get('level', 'Moderate')

        atc1 = english_to_atc.get(d1)
        atc2 = english_to_atc.get(d2)

        relevant = False
        key = ""
        nivo = "Srednji"
        
        if "Major" in level or "High" in level: nivo = "Visok"
        desc = f"DDInter Baza (Rizik: {level})."

        # LEK - LEK
        if atc1 and atc2:
            valid1 = (atc1 in my_atc_codes) or (atc1[:5] in my_atc_codes)
            valid2 = (atc2 in my_atc_codes) or (atc2[:5] in my_atc_codes)

            if valid1 and valid2:
                relevant = True
                key = f"{atc1}-{atc2}"

        # LEK - HRANA
        if not relevant:
            if atc1 and ((atc1 in my_atc_codes) or (atc1[:5] in my_atc_codes)):
                if any(f in d2 for f in food_keywords):
                    relevant = True
                    key = f"{atc1}-food"
                    desc = f"INTERAKCIJA SA: {d2.upper()}."
            
            elif atc2 and ((atc2 in my_atc_codes) or (atc2[:5] in my_atc_codes)):
                if any(f in d1 for f in food_keywords):
                    relevant = True
                    key = f"{atc2}-food"
                    desc = f"INTERAKCIJA SA: {d1.upper()}."

        if relevant:
            final_db[key] = {"nivo": nivo, "opis_srb": desc}
            count += 1
            if atc1 and atc2 and not key.endswith("-food"):
                rev_key = f"{atc2}-{atc1}"
                final_db[rev_key] = {"nivo": nivo, "opis_srb": desc}

    # E. SNIMANJE
    print("------------------------------------------------")
    try:
        with open('interakcije.json', 'w', encoding='utf-8') as f:
            json.dump(final_db, f, ensure_ascii=False, indent=2)
        print(f"🎉 GOTOVO! Generisano {count} interakcija.")
        print(f"💾 Fajl 'interakcije.json' je spreman.")
        
    except Exception as e:
        print(f"❌ Greška pri snimanju: {e}")

if __name__ == "__main__":
    generate_interactions()