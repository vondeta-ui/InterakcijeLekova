let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];

// 1. Inicijalizacija i učitavanje
async function inicijalizujAplikaciju() {
    try {
        const [lResp, iResp] = await Promise.all([
            fetch('lekovi.json'),
            fetch('interakcije.json')
        ]);

        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();

        console.log("✅ Podaci učitani. Spreman za pretragu.");
        
        // Povezivanje search polja
        const searchInput = document.querySelector('input[type="text"]'); 
        if (searchInput) {
            searchInput.addEventListener('input', (e) => filtrirajLekove(e.target.value));
        }
    } catch (e) {
        console.error("Greška pri učitavanju:", e);
    }
}

// 2. Funkcija za pretragu (Search)
function filtrirajLekove(upit) {
    const kontejner = document.getElementById('lista-lekova');
    if (!kontejner) return;
    
    kontejner.innerHTML = '';
    if (upit.length < 2) return; // Ne traži ako je manje od 2 slova

    const termin = upit.toLowerCase();

    for (const grupa in lekoviPodaci) {
        lekoviPodaci[grupa].forEach(lek => {
            if (lek.naziv.toLowerCase().includes(termin)) {
                const btn = document.createElement('button');
                btn.className = 'lek-rezultat-dugme'; // Prilagodi CSS-u
                btn.innerText = lek.naziv;
                btn.onclick = () => dodajLek(lek);
                kontejner.appendChild(btn);
            }
        });
    }
}

// 3. Dodavanje leka i provera
function dodajLek(lek) {
    if (!izabraniLekovi.find(l => l.atc === lek.atc)) {
        izabraniLekovi.push(lek);
        osvežiPrikaz();
        // Očisti pretragu nakon izbora
        document.querySelector('input[type="text"]').value = '';
        document.getElementById('lista-lekova').innerHTML = '';
    }
}

// 4. Provera interakcija (INN-na-INN logika)
function proveriInterakcije() {
    const panel = document.getElementById('rezultati-provere');
    if (!panel) return;
    panel.innerHTML = '';

    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];
        const komponente1 = Array.isArray(L1.inn_eng) ? L1.inn_eng : [L1.inn_eng];

        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L2 = izabraniLekovi[j];
            const komponente2 = Array.isArray(L2.inn_eng) ? L2.inn_eng : [L2.inn_eng];

            komponente1.forEach(c1 => {
                komponente2.forEach(c2 => {
                    const kljuc = `${c1.toLowerCase().trim()}-${c2.toLowerCase().trim()}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({
                            nivo: interakcijeBaza[kljuc].nivo,
                            opis: `<strong>${L1.naziv}</strong> + <strong>${L2.naziv}</strong>: ${interakcijeBaza[kljuc].opis_srb}`
                        });
                    }
                });
            });
        }
        
        // Provera za hranu
        komponente1.forEach(c => {
            const fKey = `${c.toLowerCase().trim()}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({
                    nivo: interakcijeBaza[fKey].nivo,
                    opis: `🍏 <strong>${L1.naziv}</strong>: ${interakcijeBaza[fKey].opis_srb}`
                });
            }
        });
    }
    prikaziRezultate(pronadjeno);
}

// 5. Prikaz rezultata
function prikaziRezultate(niz) {
    const panel = document.getElementById('rezultati-provere');
    niz.forEach(it => {
        const div = document.createElement('div');
        div.className = `alert ${it.nivo === 'Visok' ? 'alert-danger' : 'alert-warning'}`;
        div.innerHTML = it.opis;
        panel.appendChild(div);
    });
}

function osvežiPrikaz() {
    const lista = document.getElementById('izabrani-lekovi-lista');
    if (lista) {
        lista.innerHTML = '';
        izabraniLekovi.forEach((lek, idx) => {
            const span = document.createElement('span');
            span.className = 'badge badge-primary m-1';
            span.innerHTML = `${lek.naziv} <i style="cursor:pointer" onclick="ukloni(${idx})">×</i>`;
            lista.appendChild(span);
        });
    }
    proveriInterakcije();
}

function ukloni(idx) {
    izabraniLekovi.splice(idx, 1);
    osvežiPrikaz();
}

window.onload = inicijalizujAplikaciju;