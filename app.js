let lekoviPodaci = {}, interakcijeBaza = { interactions: {}, drug_ids: {} }, izabraniLekovi = [], selectedIndex = -1, currentModalDrug = null;

function normalize(n) {
    if (!n) return "";
    let norm = n.toString().toLowerCase().replace(/ sodium| potassium| hydrochloride| hcl| calcium| sulfate| anhydrous/g, "").trim();
    return norm === "paracetamol" ? "acetaminophen" : norm;
}

function levenshtein(a, b) {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) tmp[i] = [i];
    for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(tmp[i - 1][j] + 1, tmp[i][j - 1] + 1, tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return tmp[a.length][b.length];
}

function findBestMatch(target, list) {
    let bestMatch = null, minDistance = 3;
    for (let key in list) {
        let dist = levenshtein(target, key);
        if (dist < minDistance) { minDistance = dist; bestMatch = key; }
    }
    return bestMatch;
}

function getDrugID(inn) {
    const norm = normalize(inn);
    if (interakcijeBaza.drug_ids[norm]) return interakcijeBaza.drug_ids[norm];
    const fuzzy = findBestMatch(norm, interakcijeBaza.drug_ids);
    return fuzzy ? interakcijeBaza.drug_ids[fuzzy] : null;
}

async function inicijalizujAplikaciju() {
    try {
        const [lR, iR] = await Promise.all([fetch('lekovi.json'), fetch('interakcije.json')]);
        lekoviPodaci = await lR.json(); interakcijeBaza = await iR.json();
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => filtrirajPretragu(e.target.value));
        input.addEventListener('keydown', handleKeyboard);
    } catch (e) { console.error(e); }
}

function handleKeyboard(e) {
    const res = document.querySelectorAll('.lek-item');
    if (!res.length) return;
    if (e.key === 'ArrowDown') { selectedIndex = (selectedIndex + 1) % res.length; updateSel(res); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { selectedIndex = (selectedIndex - 1 + res.length) % res.length; updateSel(res); e.preventDefault(); }
    else if (e.key === 'Enter' && selectedIndex > -1) res[selectedIndex].click();
}

function updateSel(res) {
    res.forEach((el, i) => el.classList.toggle('bg-blue-100', i === selectedIndex));
}

function filtrirajPretragu(upit) {
    const div = document.getElementById('searchResults');
    selectedIndex = -1;
    if (upit.length < 2) { div.classList.add('hidden'); return; }
    let html = '', count = 0;
    for (const g in lekoviPodaci) {
        lekoviPodaci[g].forEach(lek => {
            if (count < 15 && (lek.puno_ime.toLowerCase().includes(upit.toLowerCase()) || (lek.ean && lek.ean.includes(upit)))) {
                html += `<div onclick='dodajLek(${JSON.stringify(lek).replace(/'/g, "&apos;")})' class="lek-item p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition">
                    <div class="flex justify-between items-start">
                        <div class="font-bold text-gray-800">${lek.puno_ime} <span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] ml-1">${lek.jacina || ''}</span></div>
                        <span class="text-[9px] font-bold px-1 rounded bg-gray-100 text-gray-500 uppercase ml-2">${lek.rezim || ''}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 uppercase font-bold">${lek.inn}</div>
                </div>`;
                count++;
            }
        });
    }
    div.innerHTML = html; div.classList.toggle('hidden', !html);
}

function dodajLek(lek) {
    if (!izabraniLekovi.find(l => l.ean === lek.ean)) {
        izabraniLekovi.push(lek);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').classList.add('hidden');
        osveziPrikaz();
    }
}

function checkInteractions() {
    const sD = document.getElementById('severeInteractions'), mD = document.getElementById('moderateInteractions'), nD = document.getElementById('noInteractions');
    sD.innerHTML = ''; mD.innerHTML = '';
    
    let innMap = {};
    izabraniLekovi.forEach(l => (l.inn_eng || []).forEach(i => {
        if (!innMap[i]) innMap[i] = []; innMap[i].push(l.puno_ime);
    }));
    for (let i in innMap) {
        if (innMap[i].length > 1) {
            sD.innerHTML += `<div class="p-4 rounded-xl border bg-red-100 border-red-200 text-red-900 text-sm mb-3 font-bold">⚠️ DUPLIRANA TERAPIJA: ${i.toUpperCase()} u: ${[...new Set(innMap[i])].join(', ')}</div>`;
        }
    }

    let found = [];
    for (let i = 0; i < izabraniLekovi.length; i++) {
        (izabraniLekovi[i].inn_eng || []).forEach(c1 => {
            for (let j = i + 1; j < izabraniLekovi.length; j++) {
                (izabraniLekovi[j].inn_eng || []).forEach(c2 => {
                    const key = `${normalize(c1)}-${normalize(c2)}`;
                    const data = interakcijeBaza.interactions[key];
                    if (data) found.push({ lA: izabraniLekovi[i].puno_ime, lB: izabraniLekovi[j].puno_ime, cA: c1, cB: c2, ...data });
                });
            }
        });
    }

    nD.classList.toggle('hidden', found.length > 0 || sD.innerHTML !== '');
    found.forEach(it => {
        const link = `https://ddinter2-scbdd-com.translate.goog/checker/result/${it.link}/?_x_tr_sl=en&_x_tr_tl=sr&_x_tr_hl=en&_x_tr_pto=wapp`;
        const html = `<div class="p-4 rounded-xl border ${it.nivo === 'Visok' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'} mb-2">
            <div class="flex justify-between items-center text-[10px] font-bold uppercase mb-1"><span>${it.nivo} RIZIK</span><a href="${link}" target="_blank" class="underline">OPŠIRNIJE →</a></div>
            <div class="text-sm"><strong>${it.lA}</strong> (${it.cA}) + <strong>${it.lB}</strong> (${it.cB}): ${it.opis}</div>
        </div>`;
        if (it.nivo === 'Visok') sD.innerHTML += html; else mD.innerHTML += html;
    });
}

function openModal(idx) {
    currentModalDrug = idx;
    const lek = izabraniLekovi[idx];
    let innLinksHtml = (lek.inn_eng || []).map(c => {
        const id = getDrugID(c);
        return id ? `<a href="https://ddinter2.scbdd.com/server/drug-detail/${id}/" target="_blank" class="block bg-blue-50 text-blue-700 p-2 rounded text-[10px] font-bold mb-1 hover:bg-blue-100 transition">🔍 Detaljnije: ${c.toUpperCase()} (ENG)</a>` : `<div class="text-[10px] text-gray-400 p-2 italic">${c.toUpperCase()} (Nema podataka)</div>`;
    }).join('');

    document.getElementById('modalContent').innerHTML = `
        <h2 class="text-2xl font-black text-gray-800 leading-tight">${lek.puno_ime}</h2>
        <div class="flex flex-wrap gap-2 mt-2 mb-4">
            <span class="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">${lek.rezim || 'N/A'}</span>
            <span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${lek.oblik || 'N/A'}</span>
            <span class="bg-gray-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase italic">${lek.atc}</span>
        </div>
        <p class="text-blue-600 font-bold text-sm mb-1">${lek.jacina}</p>
        <p class="text-gray-400 text-xs mb-6 uppercase tracking-wider">${lek.inn}</p>
        
        <div class="grid grid-cols-1 gap-4 mt-6 border-t pt-6">
            <div>
                <h4 class="text-[10px] font-bold mb-2 uppercase text-gray-400">Eksterni resursi:</h4>
                ${innLinksHtml}
                ${lek.smpc ? `<a href="${lek.smpc}" target="_blank" class="block bg-gray-800 text-white text-center p-2 rounded-xl text-xs font-bold mt-2 hover:bg-black transition">📄 Zvanično uputstvo (ALIMS)</a>` : ''}
            </div>
        </div>`;

    document.getElementById('drugModal').classList.remove('hidden');
    document.getElementById('parallelsSection').classList.add('hidden');
}

function toggleParallels() {
    const lek = izabraniLekovi[currentModalDrug], section = document.getElementById('parallelsSection'), list = document.getElementById('parallelsList');
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
        let html = '';
        for (const g in lekoviPodaci) lekoviPodaci[g].forEach(p => {
            if (p.atc === lek.atc && p.ean !== lek.ean) {
                html += `<div class="p-3 bg-white border border-gray-100 rounded-xl text-xs font-bold shadow-sm flex justify-between items-center">
                    <span>${p.puno_ime} (${p.jacina})</span>
                    <span class="text-[9px] text-gray-400 uppercase">${p.rezim || ''}</span>
                </div>`;
            }
        });
        list.innerHTML = html || '<div class="text-xs text-gray-400 p-2 italic text-center">Nema zamena sa istim ATC kodom.</div>';
    }
}

function osveziPrikaz() {
    const list = document.getElementById('selectedDrugsList');
    document.getElementById('selectedContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('interactionsContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('drugCounter').innerText = izabraniLekovi.length;
    list.innerHTML = izabraniLekovi.map((l, idx) => {
        const imaPodatke = l.inn_eng && l.inn_eng.some(c => getDrugID(c) !== null);
        return `<div onclick="openModal(${idx})" class="p-4 bg-gray-50 rounded-2xl flex justify-between items-center cursor-pointer border ${imaPodatke ? 'border-transparent hover:border-blue-200' : 'border-red-300 bg-red-50'} transition">
            <div>
                <div class="font-bold text-sm text-gray-800">${l.puno_ime}</div>
                ${!imaPodatke ? '<div class="text-[9px] text-red-600 font-bold uppercase">⚠️ Nema podataka</div>' : `<div class="text-[10px] text-gray-400 font-bold">${l.atc}</div>`}
            </div>
            <div class="text-blue-500">→</div>
        </div>`;
    }).join('');
    checkInteractions();
}

function closeModal() { document.getElementById('drugModal').classList.add('hidden'); }
function removeCurrentDrug() { izabraniLekovi.splice(currentModalDrug, 1); closeModal(); osveziPrikaz(); }
window.onload = inicijalizujAplikaciju;