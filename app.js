let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];

// Pomoćna funkcija za normalizaciju (kao u Pythonu, ali za JS)
function normalizeName(name) {
    if (!name) return "";
    return name.toLowerCase()
               .replace(" sodium", "")
               .replace(" potassium", "")
               .replace(" hydrochloride", "")
               .replace(" hcl", "")
               .replace(" calcium", "")
               .replace(" sulfate", "")
               .trim();
}

async function inicijalizujAplikaciju() {
    try {
        const [lResp, iResp] = await Promise.all([
            fetch('lekovi.json'), 
            fetch('interakcije.json')
        ]);
        
        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();
        
        console.log("✅ Podaci uspešno učitani.");
        prikaziSveLekove();
    } catch (e) { 
        console.error("Greška pri učitavanju!", e); 
    }
}

function prikaziSveLekove() {
    const kontejner = document.getElementById('lista-lekova');
    if (!kontejner) return;
    kontejner.innerHTML = '';

    for (const grupa in lekoviPodaci) {
        const h3 = document.createElement('h3');
        h3.innerText = grupa;
        kontejner.appendChild(h3);

        lekoviPodaci[grupa].forEach(lek => {
            const btn = document.createElement('button');
            btn.className = 'lek-dugme';
            btn.innerText = lek.naziv;
            btn.onclick = () => {
                // Provera da li je lek već dodat preko ATC koda (unikatni ID)
                if (!izabraniLekovi.find(l => l.atc === lek.atc)) {
                    izabraniLekovi.push(lek);
                    osvežiPrikaz();
                }
            };
            kontejner.appendChild(btn);
        });
    }
}

function proveriSveInterakcije() {
    const panel = document.getElementById('rezultati-provere');
    if (!panel) return;
    panel.innerHTML = '';
    
    let pronadjeno = [];

    // Prolazimo kroz sve izabrane lekove
    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];

        // 1. Provera LEK sa DRUGIM LEKOM
        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L2 = izabraniLekovi[j];

            // Pošto su inn_eng sada LISTE (zbog tenofovira, emtricitabina itd.)
            // moramo proći kroz svaku komponentu oba leka
            L1.inn_eng.forEach(comp1 => {
                L2.inn_eng.forEach(comp2 => {
                    const c1 = normalizeName(comp1);
                    const c2 = normalizeName(comp2);
                    
                    const kljuc = `${c1}-${c2}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({ 
                            tip: 'Lek-Lek', 
                            nivo: interakcijeBaza[kljuc].nivo, 
                            text: `<strong>${L1.naziv}</strong> (${c1}) + <strong>${L2.naziv}</strong> (${c2}): ${interakcijeBaza[kljuc].opis_srb}` 
                        });
                    }
                });
            });
        }
        
        // 2. Provera LEK sa HRANOM
        L1.inn_eng.forEach(comp => {
            const c = normalizeName(comp);
            const fKey = `${c}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({ 
                    tip: 'Hrana/Piće', 
                    nivo: interakcijeBaza[fKey].nivo, 
                    text: `<strong>${L1.naziv}</strong> (${c}): ${interakcijeBaza[fKey].opis_srb}` 
                });
            }
        });
    }
    renderujRezultate(pronadjeno);
}

function renderujRezultate(niz) {
    const p = document.getElementById('rezultati-provere');
    if (niz.length === 0) { 
        if (izabraniLekovi.length > 1) {
            p.innerHTML = '<div class="safe">Nema poznatih interakcija između izabranih lekova.</div>'; 
        }
        return; 
    }

    niz.forEach(item => {
        const d = document.createElement('div');
        // Klasa zavisi od nivoa (Visok -> crveno, Srednji -> narandžasto)
        const klasaRizika = item.nivo === 'Visok' ? 'high-risk' : 'med-risk';
        d.className = `interaction-card ${klasaRizika}`;
        d.innerHTML = `<strong>[${item.tip}]</strong> ${item.text}`;
        p.appendChild(d);
    });
}

function osvežiPrikaz() {
    const l = document.getElementById('izabrani-lekovi-lista');
    if (!l) return;
    l.innerHTML = '';
    
    izabraniLekovi.forEach((lek, idx) => {
        const s = document.createElement('div');
        s.className = 'izabrani-lek-tag';
        s.innerHTML = `${lek.naziv} <span class="remove-btn" onclick="ukloni(${idx})">✖</span>`;
        l.appendChild(s);
    });
    proveriSveInterakcije();
}

function ukloni(idx) { 
    izabraniLekovi.splice(idx, 1); 
    osvežiPrikaz(); 
}

window.onload = inicijalizujAplikaciju;