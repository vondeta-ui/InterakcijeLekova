let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];

// Pomoćna funkcija za čišćenje naziva
function normalizeName(name) {
    if (!name) return "";
    return name.toString().toLowerCase()
               .replace(" sodium", "")
               .replace(" potassium", "")
               .replace(" hydrochloride", "")
               .replace(" hcl", "")
               .replace(" calcium", "")
               .replace(" sulfate", "")
               .trim();
}

async function inicijalizujAplikaciju() {
    console.log("🚀 Inicijalizacija pokrenuta...");
    try {
        const [lResp, iResp] = await Promise.all([
            fetch('lekovi.json'), 
            fetch('interakcije.json')
        ]);
        
        if (!lResp.ok || !iResp.ok) {
            throw new Error("Fajlovi nisu pronađeni na serveru (404).");
        }

        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();
        
        console.log("✅ Podaci uspešno učitani:", Object.keys(lekoviPodaci));
        prikaziSveLekove();
    } catch (e) { 
        console.error("❌ KRIZA: Greška pri učitavanju!", e);
        document.getElementById('lista-lekova').innerHTML = `<p style="color:red">Greška: ${e.message}</p>`;
    }
}

function prikaziSveLekove() {
    const kontejner = document.getElementById('lista-lekova');
    if (!kontejner) {
        console.error("❌ Element #lista-lekova nije pronađen u HTML-u!");
        return;
    }
    kontejner.innerHTML = '';

    // Prolazimo kroz grupe u lekovi.json
    for (const grupa in lekoviPodaci) {
        const sekcija = document.createElement('div');
        sekcija.className = 'grupa-sekcija';
        
        const h3 = document.createElement('h3');
        h3.innerText = grupa;
        sekcija.appendChild(h3);

        const listaLekovaUGrupi = lekoviPodaci[grupa];
        
        if (Array.isArray(listaLekovaUGrupi)) {
            listaLekovaUGrupi.forEach(lek => {
                const btn = document.createElement('button');
                btn.className = 'lek-dugme';
                btn.innerText = lek.naziv;
                btn.onclick = () => dodajLek(lek);
                sekcija.appendChild(btn);
            });
        }
        kontejner.appendChild(sekcija);
    }
}

function dodajLek(lek) {
    if (!izabraniLekovi.find(l => l.atc === lek.atc)) {
        izabraniLekovi.push(lek);
        osvežiPrikaz();
    }
}

function proveriSveInterakcije() {
    const panel = document.getElementById('rezultati-provere');
    if (!panel) return;
    panel.innerHTML = '';
    
    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];
        
        // Osiguravamo da je inn_eng niz (čak i ako je greškom string)
        const inn1 = Array.isArray(L1.inn_eng) ? L1.inn_eng : [L1.inn_eng];

        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L2 = izabraniLekovi[j];
            const inn2 = Array.isArray(L2.inn_eng) ? L2.inn_eng : [L2.inn_eng];

            inn1.forEach(comp1 => {
                inn2.forEach(comp2 => {
                    const c1 = normalizeName(comp1);
                    const c2 = normalizeName(comp2);
                    if (!c1 || !c2) return;

                    const kljuc = `${c1}-${c2}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({ 
                            nivo: interakcijeBaza[kljuc].nivo, 
                            text: `<strong>${L1.naziv}</strong> + <strong>${L2.naziv}</strong>: ${interakcijeBaza[kljuc].opis_srb}` 
                        });
                    }
                });
            });
        }
        
        // Hrana
        inn1.forEach(comp => {
            const c = normalizeName(comp);
            const fKey = `${c}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({ 
                    nivo: interakcijeBaza[fKey].nivo, 
                    text: `🍏 <strong>${L1.naziv}</strong>: ${interakcijeBaza[fKey].opis_srb}` 
                });
            }
        });
    }
    renderujRezultate(pronadjeno);
}

function renderujRezultate(niz) {
    const p = document.getElementById('rezultati-provere');
    if (niz.length === 0) {
        if (izabraniLekovi.length > 1) p.innerHTML = '<div class="sigurno">Nema poznatih interakcija.</div>';
        return;
    }

    niz.forEach(item => {
        const d = document.createElement('div');
        d.className = `kartica ${item.nivo === 'Visok' ? 'crvena' : 'narandzasta'}`;
        d.innerHTML = item.text;
        p.appendChild(d);
    });
}

function osvežiPrikaz() {
    const l = document.getElementById('izabrani-lekovi-lista');
    if (l) {
        l.innerHTML = '';
        izabraniLekovi.forEach((lek, idx) => {
            const tag = document.createElement('span');
            tag.className = 'lek-tag';
            tag.innerHTML = `${lek.naziv} <b onclick="ukloni(${idx})" style="cursor:pointer">×</b>`;
            l.appendChild(tag);
        });
    }
    proveriSveInterakcije();
}

function ukloni(idx) {
    izabraniLekovi.splice(idx, 1);
    osvežiPrikaz();
}

window.onload = inicijalizujAplikaciju;