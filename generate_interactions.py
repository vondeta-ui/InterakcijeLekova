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

    final_db = {"interactions": {}, "drug_ids": {}}

    for url in DDINTER_URLS:
        try:
            r = requests.get(url, headers=HEADERS, verify=False, timeout=60)
            reader = csv.reader(io.StringIO(r.content.decode('utf-8', errors='ignore')))
            next(reader)
            for row in reader:
                # row[0]=ID1, row[1]=Name1, row[2]=ID2, row[3]=Name2, row[4]=Level
                id1, d1, id2, d2, lvl = row[0], normalize(row[1]), row[2], normalize(row[3]), row[4]
                nivo = "Visok" if lvl in ["Major", "High"] else "Srednji"
                
                # Čuvamo ID-eve za svaku našu supstancu radi "Detaljnije" linka
                if d1 in my_components: final_db["drug_ids"][d1] = id1
                if d2 in my_components: final_db["drug_ids"][d2] = id2

                if d1 in my_components and d2 in my_components:
                    final_db["interactions"][f"{d1}-{d2}"] = {"nivo": nivo, "opis": f"Rizik: {lvl}", "link": f"{id1}-{id2}"}
                    final_db["interactions"][f"{d2}-{d1}"] = {"nivo": nivo, "opis": f"Rizik: {lvl}", "link": f"{id2}-{id1}"}
        except: continue

    with open('interakcije.json', 'w', encoding='utf-8') as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)
    print("✅ Baza generisana sa ID-evima supstanci.")

if __name__ == "__main__": generate_interactions()