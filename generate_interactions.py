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
    removals = [" sodium", " potassium", " hydrochloride", " hcl", " calcium", " sulfate", " anhydrous"]
    for rem in removals:
        name = name.replace(rem, "")
    return name.strip()

def generate_interactions():
    print("🚀 POKREĆEM GENERISANJE (Sa ID-evima za linkove)")
    
    my_components = set()
    try:
        with open('lekovi.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            for category in data.values():
                for drug in category:
                    for comp in drug.get('inn_eng', []):
                        my_components.add(normalize(comp))
    except: return

    final_db = {}
    food_keywords = ["alcohol", "food", "grapefruit", "milk", "dairy", "juice", "caffeine"]

    for url in DDINTER_URLS:
        try:
            resp = requests.get(url, headers=HEADERS, verify=False, timeout=60)
            if resp.status_code == 200:
                content = resp.content.decode('utf-8', errors='ignore')
                reader = csv.reader(io.StringIO(content))
                next(reader, None)
                for row in reader:
                    if len(row) < 5: continue
                    # row[0]=ID1, row[1]=Name1, row[2]=ID2, row[3]=Name2, row[4]=Level
                    id1, d1, id2, d2, level = row[0], normalize(row[1]), row[2], normalize(row[3]), row[4]
                    nivo = "Visok" if level in ["Major", "High"] else "Srednji"

                    if d1 in my_components and d2 in my_components:
                        # Čuvamo i link_id za pretragu na DDInter sajtu
                        link_id = f"{id1}-{id2}"
                        final_db[f"{d1}-{d2}"] = {"nivo": nivo, "opis_srb": f"Rizik: {level}", "link_id": link_id}
                        
                        link_id_rev = f"{id2}-{id1}"
                        final_db[f"{d2}-{d1}"] = {"nivo": nivo, "opis_srb": f"Rizik: {level}", "link_id": link_id_rev}
                    
                    elif d1 in my_components and any(f in d2 for f in food_keywords):
                        final_db[f"{d1}-food"] = {"nivo": nivo, "opis_srb": f"Interakcija sa: {d2.upper()}"}
                    elif d2 in my_components and any(f in d1 for f in food_keywords):
                        final_db[f"{d2}-food"] = {"nivo": nivo, "opis_srb": f"Interakcija sa: {d1.upper()}"}
        except: continue

    with open('interakcije.json', 'w', encoding='utf-8') as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)
    print("🎉 Završeno! interakcije.json sada sadrži linkove.")

if __name__ == "__main__":
    generate_interactions()