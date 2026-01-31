import requests

def debug_alims():
    url = "https://www.alims.gov.rs/ciril/files/lekovi/humani/Humani_Lekovi_Resenja.xml"
    print(f"Pristupam URL-u: {url}")
    
    try:
        # Glumimo pravi browser da nas ne blokiraju
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        response = requests.get(url, headers=headers, timeout=30, verify=False) # verify=False za svaki slucaj
        
        print(f"Status kod: {response.status_code}")
        print("-" * 50)
        print("PRVIH 1000 KARAKTERA SADRZAJA:")
        print("-" * 50)
        
        # Ispisujemo sirovi tekst da vidimo sta je unutra
        print(response.text[:1000])
        print("-" * 50)
        
        if "<Lek>" in response.text:
            print("ZAKLJUCAK: Tag <Lek> POSTOJI. Parser je problem.")
        elif "<lek>" in response.text:
            print("ZAKLJUCAK: Tag <lek> (mala slova) POSTOJI. Parser treba popraviti.")
        elif "<html" in response.text.lower():
            print("ZAKLJUCAK: Ovo je HTML stranica, a ne XML. Verovatno greska ili blokada.")
        else:
            print("ZAKLJUCAK: Nepoznat format.")

    except Exception as e:
        print(f"Greska: {e}")

if __name__ == "__main__":
    # Iskljucujemo upozorenja za SSL ako koristimo verify=False
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    debug_alims()