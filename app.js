let lekoviPodaci = {}, interakcijeBaza = {}, izabraniLekovi = [], selectedIndex = -1;

function normalize(n) {
    return n ? n.toLowerCase().replace(/ sodium| potassium| hydrochloride| hcl| calcium| sulfate/g, "").trim() : "";
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
                    <div class="font-bold text-gray-800">${lek.puno_ime} <span class="text-blue-600 ml-1 text-xs">${lek.jacina || ''}</span></div>
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
    
    // 1. DUPLIRANA TERAPIJA
    let innMap = {};
    izabraniLekovi.forEach(l => l.inn_eng.forEach(i => {
        if (!innMap[i]) innMap[i] = []; innMap[i].push(l.puno_ime);
    }));
    for (let i in innMap) {
        if (innMap[i].length > 1) {
            sD.innerHTML += `<div class="p-4 rounded-xl border bg-red-100 border-red-200 text-red-900 text-sm mb-3"><strong>⚠️ DUPLIRANA TERAPIJA:</strong> Sadrže ${i.toUpperCase()}: ${[...new Set(innMap[i])].join(', ')}</div>`;
        }
    }

    // 2. INTERAKCIJE
    let found = [];
    for (let i = 0; i < izabraniLekovi.length; i++) {
        izabraniLekovi[i].inn_eng.forEach(c1 => {
            for (let j = i + 1; j < izabraniLekovi.length; j++) {
                izabraniLekovi[j].inn_eng.forEach(c2 => {
                    const key = `${normalize(c1)}-${normalize(c2)}`;
                    if (interakcijeBaza[key]) found.push({ lA: izabraniLekovi[i].puno_ime, lB: izabraniLekovi[j].puno_ime, cA: c1, cB: c2, ...interakcijeBaza[key] });
                });
            }
            const fKey = `${normalize(c1)}-food`;
            if (interakcijeBaza[fKey]) found.push({ lA: izabraniLekovi[i].puno_ime, cA: c1, tip: 'food', ...interakcijeBaza[fKey] });
        });
    }

    nD.classList.toggle('hidden', found.length > 0 || sD.innerHTML !== '');
    found.forEach(it => {
        const link = it.link ? `https://ddinter2-scbdd-com.translate.goog/checker/result/${it.link}/?_x_tr_sl=en&_x_tr_tl=sr&_x_tr_hl=en&_x_tr_pto=wapp` : null;
        const html = `<div class="p-4 rounded-xl border ${it.nivo === 'Visok' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'} mb-2">
            <div class="flex justify-between items-center text-[10px] font-bold uppercase mb-1"><span>${it.nivo} RIZIK</span>${link ? `<a href="${link}" target="_blank" class="underline">OPŠIRNIJE →</a>` : ''}</div>
            <div class="text-sm">${it.tip === 'food' ? `<strong>${it.lA}</strong> (${it.cA}) + ${it.opis}` : `<strong>${it.lA}</strong> (${it.cA}) + <strong>${it.lB}</strong> (${it.cB}): ${it.opis}`}</div>
        </div>`;
        if (it.nivo === 'Visok') sD.innerHTML += html; else mD.innerHTML += html;
    });
}

function openModal(idx) {
    currentModalDrug = idx;
    const lek = izabraniLekovi[idx];
    let foodHtml = '';
    lek.inn_eng.forEach(c => {
        const key = `${normalize(c)}-food`;
        if (interakcijeBaza[key]) foodHtml += `<div class="text-xs p-2 bg-orange-50 rounded mb-1">⚠️ <b>${c}:</b> ${interakcijeBaza[key].opis}</div>`;
    });

    document.getElementById('modalContent').innerHTML = `<h2 class="text-xl font-bold">${lek.puno_ime}</h2><p class="text-blue-600 text-sm font-bold mb-4">${lek.jacina}</p><div class="border-t pt-4"><h4 class="text-xs font-bold mb-2 uppercase">🍎 Hrana i piće:</h4>${foodHtml || '<p class="text-xs text-gray-400">Nema specifičnih ograničenja.</p>'}</div>`;
    document.getElementById('drugModal').classList.remove('hidden');
}

function osveziPrikaz() {
    const list = document.getElementById('selectedDrugsList');
    document.getElementById('selectedContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('interactionsContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('drugCounter').innerText = izabraniLekovi.length;
    list.innerHTML = izabraniLekovi.map((l, idx) => `<div onclick="openModal(${idx})" class="p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer border hover:border-blue-200"><div class="text-sm font-bold">${l.puno_ime}</div><div class="text-blue-500">→</div></div>`).join('');
    checkInteractions();
}
function closeModal() { document.getElementById('drugModal').classList.add('hidden'); }
function removeCurrentDrug() { izabraniLekovi.splice(currentModalDrug, 1); closeModal(); osveziPrikaz(); }
function toggleParallels() { /* logika za zamene ostaje ista */ }
window.onload = inicijalizujAplikaciju;