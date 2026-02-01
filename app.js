let lekoviPodaci = {}, interakcijeBaza = { interactions: {}, drug_ids: {} }, izabraniLekovi = [], selectedIndex = -1;

// --- FUZZY MATCH LOGIKA ---
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
    let minDistance = 3; // Maksimalno 2-3 karaktera razlike dozvoljeno
    for (let key in list) {
        let dist = levenshtein(target, key);
        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = key;
        }
    }
    return bestMatch;
}
// --------------------------

function normalize(n) {
    return n ? n.toLowerCase().replace(/ sodium| potassium| hydrochloride| hcl| calcium| sulfate/g, "").trim() : "";
}

// Glavna funkcija za dobijanje ID-a (sa fuzzy fallback-om)
function getDrugID(inn) {
    const norm = normalize(inn);
    if (interakcijeBaza.drug_ids[norm]) return interakcijeBaza.drug_ids[norm];
    
    // Ako nema direktnog matcha, probaj fuzzy
    const fuzzyKey = findBestMatch(norm, interakcijeBaza.drug_ids);
    return fuzzyKey ? interakcijeBaza.drug_ids[fuzzyKey] : null;
}

// Funkcija za prikaz u listi (sa upozorenjem)
function osveziPrikaz() {
    const list = document.getElementById('selectedDrugsList');
    document.getElementById('selectedContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('interactionsContainer').classList.toggle('hidden', !izabraniLekovi.length);
    document.getElementById('drugCounter').innerText = izabraniLekovi.length;

    list.innerHTML = izabraniLekovi.map((lek, idx) => {
        // Lek je "siguran za proveru" samo ako bar jedna njegova komponenta ima ID u bazi
        const imaPodatke = lek.inn_eng.some(c => getDrugID(c) !== null);
        
        return `
        <div onclick="openModal(${idx})" class="p-4 bg-gray-50 rounded-2xl flex justify-between items-center cursor-pointer border ${imaPodatke ? 'hover:border-blue-200 border-transparent' : 'border-red-300 bg-red-50'} transition">
            <div>
                <div class="font-bold text-sm text-gray-800">${lek.puno_ime}</div>
                ${!imaPodatke ? `<div class="text-[9px] text-red-600 font-bold uppercase tracking-tighter">⚠️ Nisu pronađeni podaci za interakcije</div>` : `<div class="text-[10px] text-gray-400 font-bold">${lek.atc}</div>`}
            </div>
            <div class="${imaPodatke ? 'text-blue-500' : 'text-red-500'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        </div>`;
    }).join('');
    
    checkInteractions();
}

// Ažurirani modal sa fuzzy linkovima
function openModal(idx) {
    currentModalDrug = idx;
    const lek = izabraniLekovi[idx];
    
    let innLinksHtml = lek.inn_eng.map(c => {
        const id = getDrugID(c);
        if (id) {
            return `<a href="https://ddinter2.scbdd.com/server/drug-detail/${id}/" target="_blank" class="block bg-blue-50 text-blue-700 p-2 rounded text-xs font-bold mb-1 hover:bg-blue-100 transition">🔍 Detaljnije o: ${c.toUpperCase()} (ENG)</a>`;
        }
        return `<div class="text-xs text-gray-400 p-2 italic">${c.toUpperCase()} (Supstanca nije u bazi)</div>`;
    }).join('');

    document.getElementById('modalContent').innerHTML = `
        <h2 class="text-xl font-bold">${lek.puno_ime}</h2>
        <p class="text-blue-600 text-sm font-bold mb-4">${lek.jacina}</p>
        <div class="border-t pt-4">
            <h4 class="text-[10px] font-bold mb-2 uppercase text-gray-400">Resursi:</h4>
            ${innLinksHtml}
        </div>`;
    document.getElementById('drugModal').classList.remove('hidden');
}

// ... ostatak app.js (checkInteractions takođe treba da koristi fuzzy match za ključeve) ...