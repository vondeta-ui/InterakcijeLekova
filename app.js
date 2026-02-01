let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];
let currentModalDrug = null;

// Pomoćna funkcija za normalizaciju imena za uparivanje sa interakcije.json
function normalize(name) {
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
    try {
        const [lResp, iResp] = await Promise.all([
            fetch('lekovi.json'),
            fetch('interakcije.json')
        ]);

        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();

        console.log("✅ Podaci učitani.");
        
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => filtrirajPretragu(e.target.value));
    } catch (e) {
        console.error("Greška pri učitavanju:", e);
    }
}

function filtrirajPretragu(upit) {
    const resultsDiv = document.getElementById('searchResults');
    if (upit.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
    }

    const termin = upit.toLowerCase();
    let html = '';
    let foundCount = 0;

    for (const grupa in lekoviPodaci) {
        lekoviPodaci[grupa].forEach(lek => {
            // Pretraga po imenu ili EAN kodu
            if (lek.puno_ime.toLowerCase().includes(termin) || (lek.ean && lek.ean.includes(termin))) {
                if (foundCount < 15) { // Limit radi performansi
                    html += `
                        <div onclick='dodajLek(${JSON.stringify(lek).replace(/'/g, "&apos;")})' 
                             class="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition">
                            <div class="font-bold text-gray-800">${lek.puno_ime}</div>
                            <div class="text-xs text-gray-400">${lek.inn} | ${lek.jacina}</div>
                        </div>`;
                    foundCount++;
                }
            }
        });
    }

    if (html) {
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
    } else {
        resultsDiv.classList.add('hidden');
    }
}

function dodajLek(lek) {
    if (!izabraniLekovi.find(l => l.ean === lek.ean)) {
        izabraniLekovi.push(lek);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').classList.add('hidden');
        osveziPrikaz();
    }
}

function osveziPrikaz() {
    const list = document.getElementById('selectedDrugsList');
    const container = document.getElementById('selectedContainer');
    const counter = document.getElementById('drugCounter');

    if (izabraniLekovi.length > 0) {
        container.classList.remove('hidden');
        document.getElementById('interactionsContainer').classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.getElementById('interactionsContainer').classList.add('hidden');
    }

    counter.innerText = izabraniLekovi.length;
    list.innerHTML = izabraniLekovi.map((lek, idx) => `
        <div onclick="openModal(${idx})" class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 cursor-pointer transition">
            <div>
                <div class="font-bold text-gray-800 text-sm">${lek.puno_ime}</div>
                <div class="text-[10px] text-gray-400 uppercase font-bold">${lek.atc}</div>
            </div>
            <div class="text-blue-500">→</div>
        </div>
    `).join('');

    checkInteractions();
}

function checkInteractions() {
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInterDiv = document.getElementById('noInteractions');
    
    severeDiv.innerHTML = '';
    moderateDiv.innerHTML = '';
    
    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];
        const comps1 = L1.inn_eng || [];

        for (let j = i + 1; j < izabraniLekovi.length; j++) {
            const L2 = izabraniLekovi[j];
            const comps2 = L2.inn_eng || [];

            comps1.forEach(c1raw => {
                comps2.forEach(c2raw => {
                    const c1 = normalize(c1raw);
                    const c2 = normalize(c2raw);
                    const kljuc = `${c1}-${c2}`;

                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({
                            lekA: L1.puno_ime,
                            lekB: L2.puno_ime,
                            kompA: c1raw,
                            kompB: c2raw,
                            nivo: interakcijeBaza[kljuc].nivo,
                            opis: interakcijeBaza[kljuc].opis_srb
                        });
                    }
                });
            });
        }
        
        // Hrana
        comps1.forEach(c1raw => {
            const c1 = normalize(c1raw);
            const fKey = `${c1}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({
                    lekA: L1.puno_ime,
                    kompA: c1raw,
                    tip: 'food',
                    nivo: interakcijeBaza[fKey].nivo,
                    opis: interakcijeBaza[fKey].opis_srb
                });
            }
        });
    }

    if (pronadjeno.length === 0) {
        noInterDiv.classList.remove('hidden');
    } else {
        noInterDiv.classList.add('hidden');
        pronadjeno.forEach(item => {
            const html = `
                <div class="p-4 rounded-xl border ${item.nivo === 'Visok' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'}">
                    <div class="font-bold text-xs uppercase mb-1">${item.nivo} RIZIK</div>
                    <div class="text-sm">
                        ${item.tip === 'food' ? 
                            `<strong>${item.lekA}</strong> (${item.kompA}) u kontaktu sa hranom/pićem: ${item.opis}` :
                            `<strong>${item.lekA}</strong> (${item.kompA}) + <strong>${item.lekB}</strong> (${item.kompB}): ${item.opis}`
                        }
                    </div>
                </div>`;
            
            if (item.nivo === 'Visok') severeDiv.innerHTML += html;
            else moderateDiv.innerHTML += html;
        });
    }
}

// Modalne funkcije
function openModal(idx) {
    currentModalDrug = idx;
    const lek = izabraniLekovi[idx];
    const modal = document.getElementById('drugModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <h2 class="text-2xl font-black text-gray-800 mb-2">${lek.puno_ime}</h2>
        <p class="text-blue-600 font-bold mb-6">${lek.inn} (${lek.jacina})</p>
        
        <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-4 rounded-2xl">
                <div class="text-[10px] text-gray-400 font-bold uppercase">ATC Kod</div>
                <div class="text-gray-700 font-bold">${lek.atc}</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-2xl">
                <div class="text-[10px] text-gray-400 font-bold uppercase">Režim izdavanja</div>
                <div class="text-gray-700 font-bold">${lek.rezim || 'N/A'}</div>
            </div>
        </div>
        <div class="mt-4 bg-gray-50 p-4 rounded-2xl">
            <div class="text-[10px] text-gray-400 font-bold uppercase">Oblik</div>
            <div class="text-gray-700 font-bold">${lek.oblik}</div>
        </div>
        ${lek.smpc ? `<a href="${lek.smpc}" target="_blank" class="block mt-6 text-center text-sm text-blue-500 underline">Zvanično uputstvo (SmPC)</a>` : ''}
    `;
    
    modal.classList.remove('hidden');
    document.getElementById('parallelsSection').classList.add('hidden');
}

function closeModal() {
    document.getElementById('drugModal').classList.add('hidden');
}

function removeCurrentDrug() {
    if (currentModalDrug !== null) {
        izabraniLekovi.splice(currentModalDrug, 1);
        closeModal();
        osveziPrikaz();
    }
}

function toggleParallels() {
    const lek = izabraniLekovi[currentModalDrug];
    const section = document.getElementById('parallelsSection');
    const list = document.getElementById('parallelsList');
    
    if (!section.classList.contains('hidden')) {
        section.classList.add('hidden');
        return;
    }

    let html = '';
    for (const grupa in lekoviPodaci) {
        lekoviPodaci[grupa].forEach(p => {
            if (p.atc === lek.atc && p.ean !== lek.ean) {
                html += `
                    <div class="p-3 bg-white border border-gray-100 rounded-xl text-sm">
                        <div class="font-bold text-gray-800">${p.puno_ime}</div>
                        <div class="text-[10px] text-gray-400">${p.oblik} | ${p.jacina}</div>
                    </div>`;
            }
        });
    }

    list.innerHTML = html || '<p class="text-xs text-gray-400 p-4">Nema pronađenih paralela.</p>';
    section.classList.remove('hidden');
}

window.onload = inicijalizujAplikaciju;