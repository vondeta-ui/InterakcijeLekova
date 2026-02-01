import requests
import json
import csv
import io
import sys
import urllib3
import re

# Isključujemo upozorenja za nestabilan SSL
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

# --- REČNIK SINONIMA (Neophodan minimum) ---
# Ovo su nazivi koji su potpuno različiti (nisu samo soli u pitanju)
# Ovo rešava problem Aspirin/Paracetamol/Vitamin K
SYNONYM_MAP = {
    "aspirin": "acetylsalicylic acid",
    "acetaminophen": "paracetamol",
    "tylenol": "paracetamol",
    "adrenaline": "epinephrine",
    "noradrenaline": "norepinephrine",
    "vitamin k": "phytomenadione",
    "vitamin c": "ascorbic acid",
    "viagra": "sildenafil",
    "cialis": "tadalafil",
    "accutane": "isotretinoin",
    "motrin": "ibuprofen",
    "advil": "ibuprofen",
    "aleve": "naproxen",
    "lasix": "furosemide",
    "lipitor": "atorvastatin",
    "zoloft": "sertraline",
    "prozac": "fluoxetine",
    "coumadin": "warfarin",
    "plavix": "clopidogrel",
    "augmentin": "amoxicillin" # Aproksimacija za kombinacije
}

def normalize_name(name):
    """
    Agresivno čišćenje imena leka.
    Cilj: Svesti 'Diclofenac Sodium' i 'Diclofenac Potassium' na 'diclofenac'.
    """
    if not name: return ""
    name = name.lower().strip()
    
    # 1. Provera sinonima ODMAH (najbrže)
    if name in SYNONYM_MAP:
        return SYNONYM_MAP[name]

    # 2. Uklanjanje zagrada i sadržaja u njima (npr. "Warfarin (Oral)")
    name = re.sub(r'\([^)]*\)', '', name)

    # 3. Lista hemijskih "šumova" koje brišemo
    # Ovo nije hardkodovanje lekova, već hemijskih sufiksa
    noise_words = [
        " sodium", " potassium", " calcium", " magnesium", " lithium", " zinc",
        " hydrochloride", " hcl", " chloride", " bromide", " iodide",
        " sulfate", " phosphate", " acetate", " citrate", " maleate",
        " tartrate", " succinate", " mesylate", " besylate", " fumarate",
        " nitrate", " carbonate", " bicarbonate", " hydroxide",
        " anhydrous", " monohydrate", " dihydrate", " trihydrate",
        " solution", " injection", " tablet", " oral", " suspension",
        " acid", " base", " ester", " sodium", " free base"
    ]
    
    for noise in noise_words:
        name = name.replace(noise, "")

    # 4. Uklanjanje specijalnih karaktera i višška razmaka
    name = name.replace(",", "").replace("-", " ").strip()
    
    return name

def get_atc_dictionary():
    """1. KORAK: Prozorro API (ATC -> Svi mogući sinonimi)"""
    print("🌐 2. Preuzimam ATC Rečnik (Prozorro API)...")
    url = "https://medicines-registry.prozorro.gov.ua/api/1.0/registry/atc2inn.json"
    
    english_to_atc = {}
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            registry = data.get('data', {})
            count = 0
            
            for atc, names in registry.items():
                if names and isinstance(names, list):
                    # Prozorro vraća listu imena za jedan ATC. 
                    # MI IH SVE MAPIRAMO! Ne samo prvi.
                    for raw_name in names:
                        # 1. Čuvamo original
                        english_to_atc[raw_name.lower()] = atc
                        
                        # 2. Čuvamo normalizovanu verziju
                        clean = normalize_name(raw_name)
                        english_to_atc[clean] = atc
                        
                        # 3. Čuvamo samo prvu reč (za složene nazive)
                        # Npr. "Amoxicillin and beta-lactamase inhibitor" -> "amoxicillin"
                        first_word = clean.split()[0]
                        if len(first_word) > 4: # Da ne uhvatimo kratke reči greškom
                            if first_word not in english_to_atc:
                                english_to_atc[first_word] = atc
                        
                    count += 1
            print(f"   ✅ Uspešno mapirano {count} ATC kodova (Prozorro).")
            print(f"   ℹ️ Ukupno {len(english_to_atc)} varijacija imena u rečniku.")
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
            resp = requests.get(url, headers=HEADERS, timeout=60, verify=False)
            
            if resp.status_code == 200:
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
    print("🚀 POKREĆEM PROCES (Prozorro + DDInter + Smart Normalization)...")
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
                        my_atc_codes.add(code[:5]) # Grupa nivo 4 (npr C09AA)
                        my_atc_codes.add(code[:4]) # Grupa nivo 3 (npr C09A)
                        my_atc_codes.add(code[:3]) # Grupa nivo 2 (npr C09)
        print(f"   ✅ Pronađeno {len(my_atc_codes)} tvojih ATC unosa.")
    except Exception as e:
        print(f"   ❌ Greška: {e}")
        return

    # B. ATC REČNIK
    english_to_atc = get_atc_dictionary()
    if not english_to_atc: return
    
    # C. INTERAKCIJE
    raw_interactions = download_ddinter_files()
    if not raw_interactions: return

    # D. SPAJANJE
    print("------------------------------------------------")
    print("⚙️ 4. Povezujem podatke (Matching)...")
    
    final_db = {}
    count = 0
    food_keywords = ["alcohol", "food", "grapefruit", "milk", "dairy", "juice", "calcium"]

    for item in raw_interactions:
        # Normalizujemo imena iz DDInter-a pre pretrage
        d1_raw = item['drug1']
        d2_raw = item['drug2']
        
        d1_clean = normalize_name(d1_raw)
        d2_clean = normalize_name(d2_raw)
        
        level = item.get('level', 'Moderate')

        # Pokušavamo da nađemo ATC na više načina
        atc1 = english_to_atc.get(d1_clean) or english_to_atc.get(d1_raw.lower())
        atc2 = english_to_atc.get(d2_clean) or english_to_atc.get(d2_raw.lower())

        # Fallback: Ako nismo našli, probamo samo prvu reč (za složena imena)
        if not atc1:
            atc1 = english_to_atc.get(d1_clean.split()[0])
        if not atc2:
            atc2 = english_to_atc.get(d2_clean.split()[0])

        relevant = False
        key = ""
        nivo = "Srednji"
        
        if "Major" in level or "High" in level: nivo = "Visok"
        desc = f"DDInter Baza (Rizik: {level})."

        # LEK - LEK
        if atc1 and atc2:
            # Proveravamo da li su lekovi u našoj bazi (po bilo kom nivou grupe)
            # Dodali smo i [:3] nivo za širu pretragu
            valid1 = (atc1 in my_atc_codes) or (atc1[:5] in my_atc_codes) or (atc1[:4] in my_atc_codes) or (atc1[:3] in my_atc_codes)
            valid2 = (atc2 in my_atc_codes) or (atc2[:5] in my_atc_codes) or (atc2[:4] in my_atc_codes) or (atc2[:3] in my_atc_codes)

            if valid1 and valid2:
                relevant = True
                key = f"{atc1}-{atc2}"

        # LEK - HRANA
        if not relevant:
            if atc1 and (atc1 in my_atc_codes or atc1[:5] in my_atc_codes or atc1[:4] in my_atc_codes):
                if any(f in d2_clean for f in food_keywords):
                    relevant = True
                    key = f"{atc1}-food"
                    desc = f"INTERAKCIJA SA: {d2_raw.upper()}."
            
            elif atc2 and (atc2 in my_atc_codes or atc2[:5] in my_atc_codes or atc2[:4] in my_atc_codes):
                if any(f in d1_clean for f in food_keywords):
                    relevant = True
                    key = f"{atc2}-food"
                    desc = f"INTERAKCIJA SA: {d1_raw.upper()}."

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