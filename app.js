let lekoviPodaci = {};
let interakcijeBaza = {};
let izabraniLekovi = [];
let currentModalDrug = null;
let selectedIndex = -1;

function normalize(name) {
    if (!name) return "";
    return name.toString().toLowerCase()
               .replace(" sodium", "").replace(" potassium", "").replace(" hydrochloride", "")
               .replace(" hcl", "").replace(" calcium", "").replace(" sulfate", "")
               .trim();
}

async function inicijalizujAplikaciju() {
    try {
        const [lResp, iResp] = await Promise.all([fetch('lekovi.json'), fetch('interakcije.json')]);
        lekoviPodaci = await lResp.json();
        interakcijeBaza = await iResp.json();
        
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => filtrirajPretragu(e.target.value));
        
        input.addEventListener('keydown', (e) => {
            const results = document.querySelectorAll('.lek-item');
            if (!results.length) return;
            if (e.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % results.length;
                updateSelection(results);
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + results.length) % results.length;
                updateSelection(results);
                e.preventDefault();
            } else if (e.key === 'Enter' && selectedIndex > -1) {
                results[selectedIndex].click();
            }
        });
    } catch (e) { console.error(e); }
}

function updateSelection(results) {
    results.forEach((el, i) => {
        el.classList.toggle('bg-blue-50', i === selectedIndex);
        if (i === selectedIndex) el.scrollIntoView({ block: 'nearest' });
    });
}

function filtrirajPretragu(upit) {
    const resultsDiv = document.getElementById('searchResults');
    selectedIndex = -1;
    if (upit.length < 2) { resultsDiv.classList.add('hidden'); return; }

    const termin = upit.toLowerCase();
    let foundHtml = '';
    let count = 0;

    for (const grupa in lekoviPodaci) {
        lekoviPodaci[grupa].forEach(lek => {
            if (count < 15 && (lek.puno_ime.toLowerCase().includes(termin) || (lek.ean && lek.ean.includes(termin)))) {
                foundHtml += `<div onclick='dodajLek(${JSON.stringify(lek).replace(/'/g, "&apos;")})' class="lek-item p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50">
                    <div class="font-bold text-gray-800">${lek.puno_ime}</div>
                    <div class="text-xs text-gray-400">${lek.inn}</div>
                </div>`;
                count++;
            }
        });
    }
    resultsDiv.innerHTML = foundHtml;
    resultsDiv.classList.toggle('hidden', !foundHtml);
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
    document.getElementById('selectedContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('interactionsContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('drugCounter').innerText = izabraniLekovi.length;

    list.innerHTML = izabraniLekovi.map((lek, idx) => `
        <div onclick="openModal(${idx})" class="p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer border hover:border-blue-300">
            <div><div class="font-bold text-sm">${lek.puno_ime}</div><div class="text-[10px] text-gray-400">${lek.atc}</div></div>
            <div class="text-blue-500">→</div>
        </div>`).join('');
    checkInteractions();
}

function checkInteractions() {
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInterDiv = document.getElementById('noInteractions');
    severeDiv.innerHTML = ''; moderateDiv.innerHTML = '';
    
    let pronadjeno = [];

    for (let i = 0; i < izabraniLekovi.length; i++) {
        const L1 = izabraniLekovi[i];
        L1.inn_eng.forEach(c1raw => {
            // Provera sa ostalim lekovima
            for (let j = i + 1; j < izabraniLekovi.length; j++) {
                izabraniLekovi[j].inn_eng.forEach(c2raw => {
                    const kljuc = `${normalize(c1raw)}-${normalize(c2raw)}`;
                    if (interakcijeBaza[kljuc]) {
                        pronadjeno.push({ lekA: L1.puno_ime, lekB: izabraniLekovi[j].puno_ime, kompA: c1raw, kompB: c2raw, ...interakcijeBaza[kljuc] });
                    }
                });
            }
            // Provera sa hranom
            const fKey = `${normalize(c1raw)}-food`;
            if (interakcijeBaza[fKey]) {
                pronadjeno.push({ lekA: L1.puno_ime, kompA: c1raw, tip: 'food', ...interakcijeBaza[fKey] });
            }
        });
    }

    noInterDiv.classList.toggle('hidden', pronadjeno.length > 0);
    pronadjeno.forEach(it => {
        const link = it.link_id ? `https://ddinter2-scbdd-com.translate.goog/checker/result/${it.link_id}/?_x_tr_sl=en&_x_tr_tl=sr&_x_tr_hl=en&_x_tr_pto=wapp` : null;
        const html = `<div class="p-4 rounded-xl border ${it.nivo === 'Visok' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'}">
            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold uppercase">${it.nivo} RIZIK</span>
                ${link ? `<a href="${link}" target="_blank" class="text-[10px] underline font-bold">OPŠIRNIJE →</a>` : ''}
            </div>
            <div class="text-sm">
                ${it.tip === 'food' ? `<strong>${it.lekA}</strong> (${it.kompA}): ${it.opis_srb}` : `<strong>${it.lekA}</strong> (${it.kompA}) + <strong>${it.lekB}</strong> (${it.kompB}): ${it.opis_srb}`}
            </div>
        </div>`;
        if (it.nivo === 'Visok') severeDiv.innerHTML += html; else moderateDiv.innerHTML += html;
    });
}

function openModal(idx) {
    currentModalDrug = idx;
    const lek = izabraniLekovi[idx];
    document.getElementById('modalContent').innerHTML = `<h2 class="text-xl font-bold">${lek.puno_ime}</h2><p class="text-blue-600 mb-4">${lek.inn}</p><p class="text-sm text-gray-600">ATC: ${lek.atc}<br>Oblik: ${lek.oblik}</p>`;
    document.getElementById('drugModal').classList.remove('hidden');
    document.getElementById('parallelsSection').classList.add('hidden');
}

function closeModal() { document.getElementById('drugModal').classList.add('hidden'); }
function removeCurrentDrug() { izabraniLekovi.splice(currentModalDrug, 1); closeModal(); osveziPrikaz(); }

function toggleParallels() {
    const lek = izabraniLekovi[currentModalDrug];
    const section = document.getElementById('parallelsSection');
    const list = document.getElementById('parallelsList');
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
        let html = '';
        for (const g in lekoviPodaci) lekoviPodaci[g].forEach(p => { if (p.atc === lek.atc && p.ean !== lek.ean) html += `<div class="p-2 bg-white rounded border text-xs font-bold">${p.puno_ime}</div>`; });
        list.innerHTML = html || '<div class="text-xs text-gray-400">Nema zamena.</div>';
    }
}

window.onload = inicijalizujAplikaciju;