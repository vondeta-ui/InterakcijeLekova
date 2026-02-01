let lekoviPodaci = {};
let interakcijeBaza = { interactions: {}, drug_ids: {} };
let izabraniLekovi = [];
let selectedIndex = -1;
let currentModalDrug = null;

// --- Brza normalizacija ---
function normalize(n) {
    if (!n) return "";
    return n.toString().toLowerCase()
            .replace(/ sodium| potassium| hydrochloride| hcl| calcium| sulfate| anhydrous/g, "")
            .trim();
}

// --- Levenshtein za fuzzy matching (koristimo samo kad zatreba) ---
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
    let bestMatch = null;
    let minDistance = 3; 
    for (let key in list) {
        let dist = levenshtein(target, key);
        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = key;
        }
    }
    return bestMatch;
}

// Funkcija koja nalazi ID supstance (direktno ili fuzzy)
function getDrugID(inn) {
    const norm = normalize(inn);
    if (!interakcijeBaza.drug_ids) return null;
    if (interakcijeBaza.drug_ids[norm]) return interakcijeBaza.drug_ids[norm];
    
    const fuzzyKey = findBestMatch(norm, interakcijeBaza.drug_ids);
    return fuzzyKey ? interakcijeBaza.drug_ids[fuzzyKey] : null;
}

async function inicijalizujAplikaciju() {
    try {
        const [lR, iR] = await Promise.all([
            fetch('lekovi.json'),
            fetch('interakcije.json')
        ]);
        lekoviPodaci = await lR.json();
        interakcijeBaza = await iR.json();

        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => filtrirajPretragu(e.target.value));
        input.addEventListener('keydown', handleKeyboard);
        console.log("✅ Sistem spreman.");
    } catch (e) { console.error("Greška pri učitavanju:", e); }
}

function handleKeyboard(e) {
    const res = document.querySelectorAll('.lek-item');
    if (!res.length) return;
    if (e.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % res.length;
        updateSelection(res);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + res.length) % res.length;
        updateSelection(res);
        e.preventDefault();
    } else if (e.key === 'Enter' && selectedIndex > -1) {
        res[selectedIndex].click();
    }
}

function updateSelection(res) {
    res.forEach((el, i) => el.classList.toggle('bg-blue-100', i === selectedIndex));
}

// POPRAVLJENA PRETRAGA
function filtrirajPretragu(upit) {
    const div = document.getElementById('searchResults');
    selectedIndex = -1;
    
    if (upit.length < 2) {
        div.classList.add('hidden');
        return;
    }

    const termin = upit.toLowerCase();
    let html = '';
    let count = 0;

    for (const grupa in lekoviPodaci) {
        lekoviPodaci[grupa].forEach(lek => {
            // Provera po imenu ili EAN-u
            if (count < 15 && (lek.puno_ime.toLowerCase().includes(termin) || (lek.ean && lek.ean.includes(termin)))) {
                html += `
                    <div onclick='dodajLek(${JSON.stringify(lek).replace(/'/g, "&apos;")})' 
                         class="lek-item p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition">
                        <div class="font-bold text-gray-800">${lek.puno_ime} <span class="text-blue-600 ml-1 text-xs font-normal">${lek.jacina || ''}</span></div>
                        <div class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">${lek.inn}</div>
                    </div>`;
                count++;
            }
        });
    }
    div.innerHTML = html;
    div.classList.toggle('hidden', !html);
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

    list.innerHTML = izabraniLekovi.map((lek, idx) => {
        // Provera da li supstanca postoji u bazi (za upozorenje)
        const imaPodatke = lek.inn_eng && lek.inn_eng.some(c => getDrugID(c) !== null);
        
        return `
        <div onclick="openModal(${idx})" class="p-4 bg-gray-50 rounded-2xl flex justify-between items-center cursor-pointer border ${imaPodatke ? 'border-transparent hover:border-blue-200' : 'border-red-300 bg-red-50'} transition">
            <div>
                <div class="font-bold text-sm text-gray-800">${lek.puno_ime}</div>
                ${!imaPodatke ? `<div class="text-[9px] text-red-600 font-bold uppercase tracking-tighter">⚠️ Nema podataka u bazi interakcija</div>` : `<div class="text-[10px] text-gray-400 font-bold">${lek.atc}</div>`}
            </div>
            <div class="${imaPodatke ? 'text-blue-500' : 'text-red-500'}">→</div>
        </div>`;
    }).join('');
    
    checkInteractions();
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
            sD.innerHTML += `<div class="p-4 rounded-xl border bg-red-100 border-red-200 text-red-900 text-sm mb-3"><strong>⚠️ DUPLIRANA TERAPIJA:</strong> ${i.toUpperCase()} u lekovima: ${[...new Set(innMap[i])].join(', ')}</div>`;
        }
    }

    let found = [];
    for (let i = 0; i < izabraniLekovi.length; i++) {
        (izabraniLekovi[i].inn_eng || []).forEach(c1raw => {
            const c1 = normalize(c1raw);
            for (let j = i + 1; j < izabraniLekovi.length; j++) {
                (izabraniLekovi[j].inn_eng || []).forEach(c2raw => {
                    const c2 = normalize(c2raw);
                    const key = `${c1}-${c2}`;
                    const data = interakcijeBaza.interactions ? interakcijeBaza.interactions[key] : null;
                    if (data) found.push({ lA: izabraniLekovi[i].puno_ime, lB: izabraniLekovi[j].puno_ime, cA: c1raw, cB: c2raw, ...data });
                });
            }
        });
    }

    nD.classList.toggle('hidden', found.length > 0 || sD.innerHTML !== '');
    found.forEach(it => {
        const link = it.link ? `https://ddinter2-scbdd-com.translate.goog/checker/result/${it.link}/?_x_tr_sl=en&_x_tr_tl=sr&_x_tr_hl=en&_x_tr_pto=wapp` : null;
        const html = `<div class="p-4 rounded-xl border ${it.nivo === 'Visok' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'} mb-2">
            <div class="flex justify-between items-center text-[10px] font-bold uppercase mb-1"><span>${it.nivo} RIZIK</span>${link ? `<a href="${link}" target="_blank" class="underline">OPŠIRNIJE →</a>` : ''}</div>
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
        if (id) {
            return `<a href="https://ddinter2.scbdd.com/server/drug-detail/${id}/" target="_blank" class="block bg-blue-50 text-blue-700 p-2 rounded text-xs font-bold mb-1 hover:bg-blue-100 transition">🔍 Detaljnije (ENG): ${c.toUpperCase()}</a>`;
        }
        return `<div class="text-xs text-gray-400 p-2 italic">${c.toUpperCase()} (Nema dodatnih podataka)</div>`;
    }).join('');

    document.getElementById('modalContent').innerHTML = `
        <h2 class="text-xl font-bold">${lek.puno_ime}</h2>
        <p class="text-blue-600 text-sm font-bold mb-4">${lek.jacina}</p>
        <div class="border-t pt-4">
            <h4 class="text-[10px] font-bold mb-2 uppercase text-gray-400 tracking-widest">Aktivne supstance:</h4>
            ${innLinksHtml}
        </div>`;
    document.getElementById('drugModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('drugModal').classList.add('hidden'); }
function removeCurrentDrug() { izabraniLekovi.splice(currentModalDrug, 1); closeModal(); osveziPrikaz(); }
window.onload = inicijalizujAplikaciju;