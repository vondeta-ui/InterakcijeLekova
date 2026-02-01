let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];

async function inicijalizujAplikaciju() {
    try {
        const [lResp, iResp] = await Promise.all([
            fetch('lekovi.json'),
            fetch('interakcije.json')
        ]);

        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();

        console.log("✅ Podaci učitani.");
        
        // Povezivanje input polja za kucanje
        const searchInput = document.querySelector('.search-bar input') || document.querySelector('input[type="text"]'); 
        if (searchInput) {
            searchInput.addEventListener('input', (e) => filtrirajLekove(e.target.value));
        }
    } catch (e) {
        console.error("Greška pri učitavanju:", e);
    }
}

function filtrirajLekove(upit) {
    const kontejner = document.getElementById('lista-lekova');
    if (!kontejner) return;
    
    kontejner.innerHTML = '';
    if (upit.length < 2) return; 

    const termin = upit.toLowerCase();

    // Prolazimo kroz ključeve (npr. "caffetin", "brufen")
    for (const kljuc in lekoviPodaci) {
        lekoviPodaci[kljuc].forEach(lek => {
            // PROVERA: Koristimo lek.puno_ime umesto lek.naziv
            if (lek.puno_ime && lek.puno_ime.toLowerCase().includes(termin)) {
                const btn = document.createElement('button');
                btn.className = 'lek-rezultat-dugme'; 
                btn.style.display = 'block';
                btn.style.width = '100%';
                btn.style.textAlign = 'left';
                btn.style.margin = '5px 0';
                btn.innerText = lek.puno_ime;
                btn.onclick = () => dodajLek(lek);
                kontejner.appendChild(btn);
            }
        });
    }
}

function dodajLek(lek) {
    // Provera po EAN kodu jer je on najunikatniji u tvojim podacima
    if (!izabraniLekovi.find(l => l.ean === lek.ean)) {
        izabraniLekovi.push(lek);
        osvežiPrikaz();
        
        // Čišćenje pretrage
        const inp = document.querySelector('.search-bar input') || document.querySelector('input[type="text"]');
        if (inp) inp.value = '';
        document.getElementById('lista-lekova').innerHTML = '';
    }
}

function proveriInterakcije() {
    const panel = document.getElementById('rezultati-provere');
    if (!panel) return;
    panel.innerHTML = '';

    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];
        const komponente1 = L1.inn_eng || [];

        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L2 = izabraniLekovi[j];
            const komponente2 = L2.inn_eng || [];

            komponente1.forEach(c1 => {
                komponente2.forEach(c2 => {
                    // Normalizacija za proveru u interakcije.json
                    const n1 = c1.toLowerCase().trim();
                    const n2 = c2.toLowerCase().trim();
                    
                    const kljuc = `${n1}-${n2}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({
                            nivo: interakcijeBaza[kljuc].nivo,
                            opis: `<strong>${L1.puno_ime}</strong> + <strong>${L2.puno_ime}</strong>: ${interakcijeBaza[kljuc].opis_srb}`
                        });
                    }
                });
            });
        }
        
        // Hrana
        komponente1.forEach(c => {
            const fKey = `${c.toLowerCase().trim()}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({
                    nivo: interakcijeBaza[fKey].nivo,
                    opis: `🍏 <strong>${L1.puno_ime}</strong>: ${interakcijeBaza[fKey].opis_srb}`
                });
            }
        });
    }
    renderujRezultate(pronadjeno);
}

function renderujRezultate(niz) {
    const panel = document.getElementById('rezultati-provere');
    niz.forEach(it => {
        const div = document.createElement('div');
        div.className = `alert ${it.nivo === 'Visok' ? 'alert-danger' : 'alert-warning'}`;
        div.style.padding = '10px';
        div.style.margin = '10px 0';
        div.style.borderLeft = '5px solid ' + (it.nivo === 'Visok' ? 'red' : 'orange');
        div.style.backgroundColor = it.nivo === 'Visok' ? '#ffeeee' : '#fff9ee';
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
            span.style.background = '#007bff';
            span.style.color = 'white';
            span.style.padding = '5px 10px';
            span.style.borderRadius = '20px';
            span.style.margin = '5px';
            span.style.display = 'inline-block';
            span.innerHTML = `${lek.puno_ime} <span style="cursor:pointer; font-weight:bold" onclick="ukloni(${idx})"> ×</span>`;
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