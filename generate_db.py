import requests
import xml.etree.ElementTree as ET
import json

def parse_trigonik(simbol):
    if not simbol: return None
    simbol = simbol.strip()
    if simbol == "▲":
        return "Zabranjeno upravljanje vozilima (Crni trougao)"
    elif simbol == "Δ":
        return "Moguć uticaj na vožnju (Prazan trougao)"
    elif simbol == "§":
        return "Psihoaktivna supstanca"
    return None

def clean_drug_name(raw_name):
    # Cisti ime od simbola i viska razmaka
    return raw_name.lower().replace("®", "").replace(",", "").split(" ")[0].strip()

def generate_lekovi_json():
    print("Preuzimam XML sa data.gov.rs...")
    # URL ka zvanicnom XML fajlu (proveri povremeno da li je URL promenjen)
    url = "https://www.alims.gov.rs/ciril/files/lekovi/humani/Humani_Lekovi_Resenja.xml"
    
    try:
        response = requests.get(url, timeout=90)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"Greska: {response.status_code}")
            return

        print("Parsiram podatke...")
        root = ET.fromstring(response.content)
        lekovi_baza = {}

        for lek in root.findall('.//Lek'):
            try:
                ime_puno = lek.findtext('ZasticenoIme', default="").strip()
                atc = lek.findtext('ATCKod', default="").strip()
                
                if not ime_puno or not atc: continue

                search_key = clean_drug_name(ime_puno)
                
                drug_data = {
                    "puno_ime": ime_puno,
                    "atc": atc,
                    "inn": lek.findtext('INN', default="").strip(),
                    "jacina": lek.findtext('Jacina', default="").strip(),
                    "oblik": lek.findtext('FarmaceutskiOblik', default="").strip(),
                    "rezim": "Na recept" if "R" in lek.findtext('RezimIzdavanja', default="") else "Bez recepta",
                    "upozorenje_voznja": parse_trigonik(lek.findtext('Trigonik', default="")),
                    "ean": lek.findtext('EAN', default="").strip(),
                    "smpc": lek.findtext('LinkSmPC', default="") or lek.findtext('SmPC', default=""),
                    "pil": lek.findtext('LinkPIL', default="") or lek.findtext('PIL', default="")
                }

                if search_key not in lekovi_baza:
                    lekovi_baza[search_key] = []
                
                lekovi_baza[search_key].append(drug_data)

            except: continue

        print(f"Uspesno obradjeno {len(lekovi_baza)} lekova.")
        
        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_baza, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        print(f"Fatalna greska: {e}")

if __name__ == "__main__":
    generate_lekovi_json()
