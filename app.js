// GLOBALNE PROMENLJIVE
let lekoviBaza = [];        
let selectedDrugs = [];     
let currentModalDrugIndex = null; 
let currentModalDrugAtc = null;

// 1. UČITAVANJE BAZE
fetch('lekovi.json')
    .then(response => response.json())
    .then(data => {
        lekoviBaza = [];
        for (const [key, variants] of Object.entries(data)) {
            variants.forEach(variant => {
                variant.searchKey = key; 
                lekoviBaza.push(variant);
            });
        }
    })
    .catch(err => console.error("Greška pri učitavanju lekovi.json:", err));

// 2. PRETRAGA I ODABIR (Ostaje isto kao i ranije)
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = '';
    if (query.length < 2) { searchResults.classList.add('hidden'); return; }

    let matches = lekoviBaza.filter(drug => {
        return drug.puno_ime.toLowerCase().includes(query) || 
               (drug.atc && drug.atc.toLowerCase().includes(query)) ||
               (drug.ean && drug.ean.startsWith(query));
    });

    matches.sort((a, b) => a.puno_ime.localeCompare(b.puno_ime)).slice(0, 50).forEach(drug => {
        const div = document.createElement('div');
        div.className = "p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition";
        div.innerHTML = `<div><div class="font-bold text-gray-800 text-sm">${drug.puno_ime} ${drug.jacina ? `(${drug.jacina})` : ''}</div><div class="text-xs text-gray-400 font-mono">${drug.atc}</div></div>`;
        div.onclick = () => selectDrug(drug);
        searchResults.appendChild(div);
    });
    searchResults.classList.remove('hidden');
});

function selectDrug(drug) {
    if (selectedDrugs.some(d => d.atc === drug.atc && d.puno_ime === drug.puno_ime)) return;
    selectedDrugs.push(drug);
    searchInput.value = '';
    searchResults.classList.add('hidden');
    renderSelectedDrugs();
    checkInteractions();
}

function renderSelectedDrugs() {
    const container = document.getElementById('selectedDrugsList');
    document.getElementById('selectedContainer').classList.toggle('hidden', selectedDrugs.length === 0);
    document.getElementById('drugCounter').innerText = selectedDrugs.length;
    container.innerHTML = '';
    selectedDrugs.forEach((drug, index) => {
        const item = document.createElement('div');
        item.className = "bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex justify-between items-center cursor-pointer";
        item.onclick = () => openModal(index);
        item.innerHTML = `<div class="font-bold text-gray-800 text-sm">${drug.puno_ime}</div>`;
        container.appendChild(item);
    });
}

// 3. NOVA LOGIKA ZA INTERAKCIJE (Pomoću otvorenog API-ja za ATC)
async function checkInteractions() {
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInteractions = document.getElementById('noInteractions');
    const loading = document.getElementById('loadingInteractions');
    const errorDiv = document.getElementById('errorInteractions');

    severeDiv.innerHTML = ''; moderateDiv.innerHTML = '';
    noInteractions.classList.add('hidden'); errorDiv.classList.add('hidden');

    if (selectedDrugs.length < 2) {
        document.getElementById('interactionsContainer').classList.add('hidden');
        return;
    }

    document.getElementById('interactionsContainer').classList.remove('hidden');
    loading.classList.remove('hidden');

    try {
        // Pošto je NIH ugašen, koristimo open-source bazu podataka interakcija
        // koja se oslanja na ATC kodove (ovde simuliramo poziv ka open-source setu)
        
        const atcCodes = selectedDrugs.map(d => d.atc);
        
        // NAPOMENA: Za pravi "live" API bez NIH-a, programeri sada prelaze na 
        // hostovane verzije MED-RT baze.
        // Simuliramo proveru kroz filtriranu bazu interakcija
        
        const response = await fetch(`https://open-drug-database.azurewebsites.net/api/interactions?codes=${atcCodes.join(',')}`);
        const data = await response.json();

        loading.classList.add('hidden');

        if (!data || data.length === 0) {
            noInteractions.classList.remove('hidden');
        } else {
            data.forEach(inter => {
                const card = document.createElement('div');
                card.className = inter.severity === 'high' ? "bg-red-50 border-l-4 border-red-500 p-4 mb-2" : "bg-amber-50 border-l-4 border-amber-400 p-4 mb-2";
                card.innerHTML = `<h4 class="font-bold text-sm">${inter.title}</h4><p class="text-xs">${inter.description}</p>`;
                if (inter.severity === 'high') severeDiv.appendChild(card); else moderateDiv.appendChild(card);
            });
        }
    } catch (e) {
        loading.classList.add('hidden');
        // Zamenska opcija: Ako API ne radi, dajemo link ka Drugs.com proverivaču
        errorDiv.classList.remove('hidden');
        errorDiv.innerHTML = `
            <p class="text-sm text-red-600 mb-2">Automatska provera je trenutno nedostupna zbog gašenja globalnog registra.</p>
            <a href="https://www.drugs.com/interactions-check.php?drug_list=${selectedDrugs.map(d => d.inn).join(',')}" 
               target="_blank" class="text-blue-600 font-bold underline text-sm">
               Proveri interakcije ručno na Drugs.com ↗
            </a>`;
    }
}

// Ostatak funkcija (openModal, toggleParallels, itd.) ostaje isti...