import requests
import json
import io

# Tvoj link (Master JSON)
TARGET_URL = "https://data.gov.rs/sr/datasets/r/cfbcda7b-511b-48f2-9f33-c2a7314bfbed"

def parse_trigonik(simbol):
    if not simbol: return None
    simbol = str(simbol).strip()
    if "▲" in simbol or "crni" in simbol.lower():
        return "Zabranjeno upravljanje vozilima (Crni trougao)"
    elif "Δ" in simbol or "prazan" in simbol.lower() or "delta" in simbol.lower():
        return "Moguć uticaj na vožnju (Prazan trougao)"
    elif "§" in simbol:
        return "Psihoaktivna supstanca"
    return None

def clean_drug_name(raw_name):
    if not raw_name: return ""
    # Cistimo ime: Mala slova, bez ® i zareza
    clean = str(raw_name).lower().replace("®", "").replace(",", "")
    return clean.split(" ")[0].strip()

def generate_lekovi_json():
    print(f"⬇️ Preuzimam podatke sa data.gov.rs...")
    
    try:
        response = requests.get(TARGET_URL, timeout=60)
        
        # Ucitavamo JSON
        try:
            full_data = json.loads(response.content)
        except:
            print("❌ Greska: Fajl nije validan JSON.")
            return

        # Ako je JSON upakovan u neki kljuc, trazimo listu
        raw_list = []
        if isinstance(full_data, list):
            raw_list = full_data
        elif isinstance(full_data, dict):
            # Trazimo prvu listu u dictionary-ju
            for key, val in full_data.items():
                if isinstance(val, list):
                    raw_list = val
                    break
        
        if not raw_list:
            print("❌ Nisam nasao listu lekova u fajlu.")
            return

        print(f"✅ Ucitano {len(raw_list)} unosa. Obradjujem...")

        lekovi_baza = {}
        count = 0

        for item in raw_list:
            try:
                # 1. DIREKTNO MAPIRANJE (Prema tvom primeru)
                puno_ime = item.get('nazivLeka', '').strip()
                atc = item.get('atc', '').strip()
                inn = item.get('inn', '').strip()
                ean = item.get('ean', '').strip()
                rezim = item.get('rezimIzdavanjaLeka', '').strip()
                
                # Trigonik cesto nije u JSON-u, ali ako ga dodaju:
                trigonik = item.get('trigonik', None) 

                # 2. RAZDVAJANJE OBLIKA I JACINE
                # Primer: "film tableta; 10mg; blister, 1x10kom"
                raw_mix = item.get('oblikIDozaLeka', '')
                oblik = ""
                jacina = ""
                
                if raw_mix:
                    parts = raw_mix.split(';')
                    if len(parts) >= 1: oblik = parts[0].strip()
                    if len(parts) >= 2: jacina = parts[1].strip()

                # 3. VALIDACIJA
                if not puno_ime or not atc: continue
                if len(atc) < 3: continue
                if atc[0].isdigit(): continue # Preskacemo medicinska sredstva

                search_key = clean_drug_name(puno_ime)
                if len(search_key) < 2: continue

                drug_data = {
                    "puno_ime": puno_ime,
                    "atc": atc,
                    "inn": inn,
                    "jacina": jacina,
                    "oblik": oblik,
                    "rezim": rezim if rezim else "Nepoznato",
                    "upozorenje_voznja": parse_trigonik(trigonik),
                    "ean": ean,
                    "smpc": f"https://www.alims.gov.rs/humani-lekovi/pretraga-humanih-lekova/?s={puno_ime}",
                    "pil": ""
                }

                if search_key not in lekovi_baza:
                    lekovi_baza[search_key] = []
                
                # Provera duplikata
                exists = False
                for existing in lekovi_baza[search_key]:
                    if existing['atc'] == drug_data['atc'] and existing['puno_ime'] == drug_data['puno_ime'] and existing['jacina'] == drug_data['jacina']:
                        exists = True
                        break
                
                if not exists:
                    lekovi_baza[search_key].append(drug_data)
                    count += 1

            except: continue

        print(f"🎉 USPELO! Obradjeno {len(lekovi_baza)} jedinstvenih lekova.")
        print(f"Ukupan broj varijacija u bazi: {count}")
        
        with open('lekovi.json', 'w', encoding='utf-8') as f:
            json.dump(lekovi_baza, f, ensure_ascii=False, indent=2)
            
        print("💾 Fajl lekovi.json je sacuvan!")

    except Exception as e:
        print(f"❌ Greska: {e}")

if __name__ == "__main__":
    generate_lekovi_json()