import requests, json, csv, io, urllib3
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

def normalize(n):
    return n.lower().replace(" sodium","").replace(" potassium","").replace(" hcl","").strip() if n else ""

def generate_interactions():
    my_components = set()
    with open('lekovi.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        for g in data.values():
            for l in g:
                for c in l.get('inn_eng', []): my_components.add(normalize(c))

    final_db = {}
    food_kw = ["alcohol", "food", "grapefruit", "milk", "dairy", "juice", "caffeine"]

    for url in DDINTER_URLS:
        try:
            r = requests.get(url, headers=HEADERS, verify=False, timeout=60)
            reader = csv.reader(io.StringIO(r.content.decode('utf-8', errors='ignore')))
            next(reader)
            for row in reader:
                id1, d1, id2, d2, lvl = row[0], normalize(row[1]), row[2], normalize(row[3]), row[4]
                nivo = "Visok" if lvl in ["Major", "High"] else "Srednji"
                
                if d1 in my_components and d2 in my_components:
                    final_db[f"{d1}-{d2}"] = {"nivo": nivo, "opis": f"Rizik: {lvl}", "link": f"{id1}-{id2}"}
                    final_db[f"{d2}-{d1}"] = {"nivo": nivo, "opis": f"Rizik: {lvl}", "link": f"{id2}-{id1}"}
                elif d1 in my_components and any(f in d2 for f in food_kw):
                    final_db[f"{d1}-food"] = {"nivo": nivo, "opis": f"INTERAKCIJA SA: {d2.upper()}"}
        except: continue

    with open('interakcije.json', 'w', encoding='utf-8') as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)

if __name__ == "__main__": generate_interactions()