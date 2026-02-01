// GLOBALNE PROMENLJIVE
let lekoviBaza = [];        
let interakcijeBaza = {}; 
let selectedDrugs = [];     
let currentModalDrugIndex = null; 
let currentModalDrugAtc = null;

// 1. UČITAVANJE PODATAKA
async function ucitajPodatke() {
    try {
        const [lekoviRes, interRes] = await Promise.all([
            fetch('lekovi.json'),
            fetch('interakcije.json')
        ]);

        if (!lekoviRes.ok || !interRes.ok) throw new Error("Problem sa fajlovima");

        const lekoviData = await lekoviRes.json();
        interakcijeBaza = await interRes.json();

        // Pretvaramo objekat u niz
        lekoviBaza = [];
        for (const [key, variants] of Object.entries(lekoviData)) {
            variants.forEach(variant => {
                variant.searchKey = key; 
                lekoviBaza.push(variant);
            });
        }
        console.log(`✅ Učitano ${lekoviBaza.length} lekova i baza interakcija.`);
    } catch (err) {
        console.error("Greška:", err);
    }
}

ucitajPodatke();

// 2. PRETRAGA
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = '';
    
    if (query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }

    let matches = lekoviBaza.filter(drug => {
        return drug.puno_ime.toLowerCase().includes(query) || 
               (drug.atc && drug.atc.toLowerCase().includes(query)) ||
               (drug.inn && drug.inn.toLowerCase().includes(query));
    });

    matches.sort((a, b) => a.puno_ime.localeCompare(b.puno_ime));
    matches = matches.slice(0, 50);

    if (matches.length > 0) {
        searchResults.classList.remove('hidden');
        matches.forEach(drug => {
            const div = document.createElement('div');
            div.className = "p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition group";
            
            const displayName = drug.jacina 
                ? `${drug.puno_ime} <span class="text-gray-500 font-normal text-sm ml-1">(${drug.jacina})</span>`
                : drug.puno_ime;

            div.innerHTML = `
                <div>
                    <div class="font-bold text-gray-800 text-sm group-hover:text-blue-700">${displayName}</div>
                    <div class="text-xs text-gray-400 mt-0.5 flex gap-2">
                        <span class="bg-gray-100 px-1.5 rounded text-gray-500 font-mono">${drug.atc || 'NEMA ATC'}</span>
                        ${drug.oblik ? `<span>${drug.oblik}</span>` : ''}
                    </div>
                </div>
                <div class="text-blue-300 group-hover:text-blue-600 font-bold text-xl px-2">+</div>
            `;
            div.onclick = () => selectDrug(drug);
            searchResults.appendChild(div);
        });
    } else {
        searchResults.classList.add('hidden');
    }
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

// 3. ODABIR LEKA
function selectDrug(drug) {
    const exists = selectedDrugs.some(d => d.atc === drug.atc && d.puno_ime === drug.puno_ime);
    
    if (exists) {
        alert("Ovaj lek je već dodat.");
        searchInput.value = '';
        searchResults.classList.add('hidden');
        return;
    }

    selectedDrugs.push(drug);
    searchInput.value = '';
    searchResults.classList.add('hidden');
    
    renderSelectedDrugs();
    checkInteractions(); 
}

// 4. RENDERING LISTE
function renderSelectedDrugs() {
    const container = document.getElementById('selectedDrugsList');
    const wrapper = document.getElementById('selectedContainer');
    const counter = document.getElementById('drugCounter');
    
    container.innerHTML = '';
    counter.innerText = selectedDrugs.length;
    
    if (selectedDrugs.length === 0) {
        wrapper.classList.add('hidden');
        document.getElementById('interactionsContainer').classList.add('hidden');
        return;
    }
    
    wrapper.classList.remove('hidden');

    selectedDrugs.forEach((drug, index) => {
        const item = document.createElement('div');
        item.className = "bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex justify-between items-center cursor-pointer hover:shadow-md transition group";
        item.onclick = () => openModal(index);

        item.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="bg-blue-50 text-blue-600 p-2 rounded-lg font-bold text-xs">${index + 1}</div>
                <div class="min-w-0">
                    <div class="truncate font-bold text-gray-800 text-sm">${drug.puno_ime}</div>
                    <div class="text-xs text-gray-400 font-mono">${drug.atc || ''}</div>
                </div>
            </div>
            <div class="text-gray-300 group-hover:text-red-500" onclick="event.stopPropagation(); removeDrug(${index})">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
        `;
        container.appendChild(item);
    });
}

function removeDrug(index) {
    selectedDrugs.splice(index, 1);
    renderSelectedDrugs();
    checkInteractions();
}

// 5. MODAL
function openModal(index) {
    currentModalDrugIndex = index;
    const drug = selectedDrugs[index];
    currentModalDrugAtc = drug.atc;

    const modal = document.getElementById('drugModal');
    modal.classList.remove('hidden');
    document.getElementById('parallelsSection').classList.add('hidden');

    document.getElementById('modalContent').innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900">${drug.puno_ime}</h2>
            <p class="text-lg text-gray-500">${drug.jacina || ''}</p>
            <div class="flex gap-2 mt-2">
                <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">ATC: ${drug.atc}</span>
                <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-bold">${drug.rezim || 'R'}</span>
            </div>
        </div>
        
        ${drug.upozorenje_voznja ? 
            `<div class="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-bold mb-4 flex items-center gap-2">
                <span>🚗</span> ${drug.upozorenje_voznja}
             </div>` : ''}

        <div class="space-y-2 text-sm">
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-500">INN</span><span class="font-medium text-right">${drug.inn || '/'}</span>
            </div>
            <div class="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-500">Oblik</span><span class="font-medium text-right">${drug.oblik || '/'}</span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mt-6">
            ${drug.smpc ? `<a href="${drug.smpc}" target="_blank" class="bg-blue-600 text-white text-center py-3 rounded-xl font-bold text-sm hover:bg-blue-700">SmPC</a>` : ''}
            ${drug.pil ? `<a href="${drug.pil}" target="_blank" class="bg-emerald-500 text-white text-center py-3 rounded-xl font-bold text-sm hover:bg-emerald-600">Uputstvo</a>` : ''}
        </div>
    `;
}

function toggleParallels() {
    const section = document.getElementById('parallelsSection');
    const list = document.getElementById('parallelsList');
    
    if (!section.classList.contains('hidden')) {
        section.classList.add('hidden');
        return;
    }

    let parallels = lekoviBaza.filter(d => d.atc === currentModalDrugAtc && d.atc !== null);
    let uniqueParallels = [];
    let seen = new Set();
    
    parallels.forEach(p => {
        let key = p.puno_ime + p.jacina;
        if(!seen.has(key)) {
            seen.add(key);
            uniqueParallels.push(p);
        }
    });

    uniqueParallels.sort((a, b) => a.puno_ime.localeCompare(b.puno_ime));

    list.innerHTML = '';
    if(uniqueParallels.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-sm">Nema pronađenih paralela.</p>';
    } else {
        uniqueParallels.forEach(p => {
            const div = document.createElement('div');
            div.className = "p-2 bg-white border rounded mb-1 text-xs flex justify-between items-center";
            div.innerHTML = `
                <span class="font-bold text-gray-700">${p.puno_ime}</span>
                <span class="text-gray-400">${p.jacina || ''}</span>
            `;
            list.appendChild(div);
        });
    }
    section.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('drugModal').classList.add('hidden');
}

function removeCurrentDrug() {
    if (currentModalDrugIndex !== null) {
        removeDrug(currentModalDrugIndex);
        closeModal();
    }
}

// 6. PROVERA INTERAKCIJA
function checkInteractions() {
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInteractions = document.getElementById('noInteractions');
    const container = document.getElementById('interactionsContainer');

    severeDiv.innerHTML = '';
    moderateDiv.innerHTML = '';
    noInteractions.classList.add('hidden');
    
    if (selectedDrugs.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    let found = false;

    // A) LEK - LEK (Samo ako ima 2 ili više)
    if (selectedDrugs.length >= 2) {
        for (let i = 0; i < selectedDrugs.length; i++) {
            for (let j = i + 1; j < selectedDrugs.length; j++) {
                const d1 = selectedDrugs[i];
                const d2 = selectedDrugs[j];

                if (!d1.atc || !d2.atc) continue;

                // 1. Tačan ATC (npr C09AA05-M01AE01)
                let key = `${d1.atc}-${d2.atc}`;
                let inter = interakcijeBaza[key];

                // 2. Grupa ATC (npr C09AA-M01AE) - Za svaki slučaj ako je baza generisala grupe
                if (!inter) {
                    key = `${d1.atc.substring(0,5)}-${d2.atc.substring(0,5)}`;
                    inter = interakcijeBaza[key];
                }
                
                // 3. Šira Grupa (npr C09A-M01A)
                if (!inter) {
                    key = `${d1.atc.substring(0,4)}-${d2.atc.substring(0,4)}`;
                    inter = interakcijeBaza[key];
                }

                if (inter) {
                    found = true;
                    renderCard(`${d1.puno_ime} + ${d2.puno_ime}`, inter, severeDiv, moderateDiv);
                }
            }
        }
    }

    // B) LEK - HRANA (Za svaki lek)
    selectedDrugs.forEach(drug => {
        if (!drug.atc) return;

        // Proveravamo pun kod i grupe za hranu
        const keysToCheck = [
            `${drug.atc}-food`,
            `${drug.atc.substring(0,5)}-food`,
            `${drug.atc.substring(0,4)}-food`
        ];

        for (let key of keysToCheck) {
            if (interakcijeBaza[key]) {
                found = true;
                renderCard(`🍔 HRANA + ${drug.puno_ime}`, interakcijeBaza[key], severeDiv, moderateDiv);
                break; // Jedna poruka za hranu po leku je dovoljna
            }
        }
    });

    if (!found && selectedDrugs.length >= 2) {
        noInteractions.classList.remove('hidden');
    }
}

// Pomoćna funkcija za UI kartice
function renderCard(title, inter, severeDiv, moderateDiv) {
    const isSevere = inter.nivo === 'Visok';
    const card = document.createElement('div');
    
    card.className = isSevere 
        ? "bg-red-50 border-l-[6px] border-red-500 p-4 mb-3 rounded-r-xl shadow-sm animate-fade-in" 
        : "bg-amber-50 border-l-[6px] border-amber-400 p-4 mb-3 rounded-r-xl shadow-sm animate-fade-in";

    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold ${isSevere ? 'text-red-800' : 'text-amber-800'} text-xs uppercase tracking-wider flex items-center gap-2">
                ${isSevere ? '⛔ VISOK RIZIK' : '⚠️ UMEREN RIZIK'}
            </h3>
        </div>
        <div class="font-bold text-sm text-gray-800 mb-2 border-b border-black/5 pb-2">
            ${title}
        </div>
        <p class="text-sm text-gray-700 leading-relaxed">
            ${inter.opis_srb}
        </p>
    `;
    
    if (isSevere) severeDiv.appendChild(card);
    else moderateDiv.appendChild(card);
}