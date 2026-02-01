import requests
import json
import csv
import io
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {'User-Agent': 'Mozilla/5.0'}
DDINTER_URLS = [
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_A.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_B.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_C.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_D.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_G.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_H.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_J.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_L.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_M.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_N.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_P.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_R.csv",
    "https://ddinter.scbdd.com/static/media/download/ddinter_downloads_code_V.csv"
]

def normalize(name):
    if not name: return ""
    name = name.lower().strip()
    removals = [" sodium", " potassium", " hydrochloride", " hcl", " calcium", " sulfate", " tablet"]
    for rem in removals:
        name = name.replace(rem, "")
    return name.strip()

def generate_interactions():
    print("🚀 POKREĆEM GENERISANJE (Support za multi-komponente)")
    
    my_components = set()
    try:
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            for category in data.values():
                for drug in category:
                    for comp in drug.get('inn_eng', []):
                        my_components.add(normalize(comp))
        print(f"✅ Učitano {len(my_components)} jedinstvenih komponenti.")
    except: return

    final_db = {}
    food_keywords = ["alcohol", "food", "grapefruit", "milk", "dairy", "juice", "caffeine"]

    for url in DDINTER_URLS:
        try:
            resp = requests.get(url, headers=HEADERS, verify=False, timeout=60)
            if resp.status_code == 200:
                reader = csv.reader(io.StringIO(resp.content.decode('utf-8', errors='ignore')))
                next(reader, None)
                for row in reader:
                    if len(row) < 5: continue
                    d1, d2, level = normalize(row[1]), normalize(row[3]), row[4]
                    nivo = "Visok" if level in ["Major", "High"] else "Srednji"

                    if d1 in my_components and d2 in my_components:
                        final_db[f"{d1}-{d2}"] = {"nivo": nivo, "opis_srb": f"Rizik: {level}"}
                        final_db[f"{d2}-{d1}"] = {"nivo": nivo, "opis_srb": f"Rizik: {level}"}
                    
                    elif d1 in my_components and any(f in d2 for f in food_keywords):
                        final_db[f"{d1}-food"] = {"nivo": nivo, "opis_srb": f"Interakcija sa: {d2.upper()}"}
                    elif d2 in my_components and any(f in d1 for f in food_keywords):
                        final_db[f"{d2}-food"] = {"nivo": nivo, "opis_srb": f"Interakcija sa: {d1.upper()}"}
        except: continue

    with open('interakcije.json', 'w', encoding='utf-8') as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)
    print(f"🎉 GOTOVO! Pravila sačuvana u interakcije.json.")

if __name__ == "__main__":
    generate_interactions()