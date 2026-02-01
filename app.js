let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];

async function inicijalizujAplikaciju() {
    try {
        const [lResp, iResp] = await Promise.all([fetch('lekovi.json'), fetch('interakcije.json')]);
        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();
        prikaziSveLekove();
    } catch (e) { console.error("Greška!", e); }
}

function prikaziSveLekove() {
    const kontejner = document.getElementById('lista-lekova');
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
    panel.innerHTML = '';
    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L1 = izabraniLekovi[i];
            const L2 = izabraniLekovi[j];

            // KLJUČNA PROMENA: Provera svake komponente protiv svake komponente
            L1.inn_eng.forEach(c1 => {
                L2.inn_eng.forEach(c2 => {
                    const kljuc = `${c1.toLowerCase().strip()}-${c2.toLowerCase().strip()}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({ tip: 'Lek-Lek', nivo: interakcijeBaza[kljuc].nivo, text: `${L1.naziv} (${c1}) + ${L2.naziv} (${c2}): ${interakcijeBaza[kljuc].opis_srb}` });
                    }
                });
            });
        }
        
        // Hrana provera
        izabraniLekovi[i].inn_eng.forEach(c => {
            const fKey = `${c.toLowerCase().strip()}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({ tip: 'Hrana', nivo: interakcijeBaza[fKey].nivo, text: `${izabraniLekovi[i].naziv} (${c}): ${interakcijeBaza[fKey].opis_srb}` });
            }
        });
    }
    renderujRezultate(pronadjeno);
}

function renderujRezultate(niz) {
    const p = document.getElementById('rezultati-provere');
    if (niz.length === 0) { p.innerHTML = '<div class="safe">Nema interakcija.</div>'; return; }
    niz.forEach(item => {
        const d = document.createElement('div');
        d.className = `card ${item.nivo === 'Visok' ? 'high' : 'med'}`;
        d.innerHTML = `<strong>${item.tip}</strong>: ${item.text}`;
        p.appendChild(d);
    });
}

function osvežiPrikaz() {
    const l = document.getElementById('izabrani-lekovi-lista');
    l.innerHTML = '';
    izabraniLekovi.forEach((lek, idx) => {
        const s = document.createElement('div');
        s.innerHTML = `${lek.naziv} <span onclick="ukloni(${idx})">✖</span>`;
        l.appendChild(s);
    });
    proveriSveInterakcije();
}

function ukloni(idx) { izabraniLekovi.splice(idx, 1); osvežiPrikaz(); }
window.onload = inicijalizujAplikaciju;