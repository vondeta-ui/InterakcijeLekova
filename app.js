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
        console.log("Baza učitana: " + lekoviBaza.length + " lekova");
    })
    .catch(err => console.error("Greška pri učitavanju lekovi.json:", err));

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
        const nameMatch = drug.puno_ime.toLowerCase().includes(query);
        const eanMatch = drug.ean && drug.ean.startsWith(query);
        const doseMatch = drug.jacina && drug.jacina.toLowerCase().includes(query);
        // Dodata pretraga i po ATC kodu direktno
        const atcMatch = drug.atc && drug.atc.toLowerCase().includes(query);
        return nameMatch || eanMatch || doseMatch || atcMatch;
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
                        <span class="bg-gray-100 px-1.5 rounded text-gray-500 font-mono">${drug.atc}</span>
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

document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

// 3. ODABIR LEKA
function selectDrug(drug) {
    const exists = selectedDrugs.some(d => 
        d.atc === drug.atc && 
        d.puno_ime === drug.puno_ime && 
        d.jacina === drug.jacina
    );
    
    if (exists) {
        alert("Ovaj lek je već dodat u listu.");
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
        item.className = "bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex justify-between items-center cursor-pointer hover:shadow-md hover:border-blue-300 transition group active:scale-[0.99]";
        item.onclick = () => openModal(index);

        const displayName = drug.jacina 
            ? `${drug.puno_ime} <span class="text-gray-500 font-normal text-sm">(${drug.jacina})</span>`
            : drug.puno_ime;

        item.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="bg-blue-50 text-blue-600 p-2.5 rounded-lg shrink-0 font-bold text-xs border border-blue-100">
                    ${index + 1}
                </div>
                <div class="min-w-0">
                    <div class="font-bold text-gray-800 text-sm truncate">${displayName}</div>
                    <div class="text-xs text-gray-400 truncate flex gap-1">
                        <span class="font-mono bg-gray-50 px-1 rounded text-gray-500">${drug.atc}</span>
                    </div>
                </div>
            </div>
            <div class="text-gray-300 group-hover:text-blue-500 transition pl-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        `;
        container.appendChild(item);
    });
}

// 5. MODAL & PARALELE
function openModal(index) {
    currentModalDrugIndex = index;
    const drug = selectedDrugs[index];
    currentModalDrugAtc = drug.atc;

    const modal = document.getElementById('drugModal');
    const content = document.getElementById('modalContent');
    const parallelsSec = document.getElementById('parallelsSection');
    
    parallelsSec.classList.add('hidden');
    document.getElementById('parallelsList').innerHTML = '';

    let warningHtml = drug.upozorenje_voznja 
        ? `<div class="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-red-700 text-sm font-bold flex items-start gap-3">
             <span class="text-2xl">⚠️</span> <span class="mt-1">${drug.upozorenje_voznja}</span>
           </div>` 
        : '';

    let linksHtml = '<div class="grid grid-cols-2 gap-3 mt-6">';
    if(drug.smpc) linksHtml += `<a href="${drug.smpc}" target="_blank" class="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition">📄 SmPC</a>`;
    if(drug.pil) linksHtml += `<a href="${drug.pil}" target="_blank" class="flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-600 transition">💊 Uputstvo</a>`;
    linksHtml += '</div>';

    content.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-900 leading-tight">${drug.puno_ime}</h2>
            ${drug.jacina ? `<p class="text-lg text-gray-500 font-medium">${drug.jacina}</p>` : ''}
            <div class="flex flex-wrap gap-2 mt-2">
                <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">ATC: ${drug.atc}</span>
                <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-bold">${drug.rezim}</span>
            </div>
        </div>
        
        ${warningHtml}

        <div class="space-y-0 text-sm text-gray-700 border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div class="flex justify-between p-4 bg-gray-50 border-b border-gray-100">
                <span class="text-gray-500">Generički naziv</span> 
                <span class="font-medium text-right">${drug.inn || '/'}</span>
            </div>
            <div class="flex justify-between p-4 bg-white border-b border-gray-100">
                <span class="text-gray-500">Oblik</span> 
                <span class="font-medium text-right">${drug.oblik || '/'}</span>
            </div>
            <div class="flex justify-between p-4 bg-gray-50 border-b border-gray-100">
                <span class="text-gray-500">EAN/Barkod</span> 
                <span class="font-mono text-gray-600">${drug.ean || '/'}</span>
            </div>
        </div>
        
        ${linksHtml}
    `;

    modal.classList.remove('hidden');
}

function toggleParallels() {
    const section = document.getElementById('parallelsSection');
    const list = document.getElementById('parallelsList');
    
    if (!section.classList.contains('hidden')) {
        section.classList.add('hidden');
        return;
    }

    if (!currentModalDrugAtc) return;

    let parallels = lekoviBaza.filter(d => d.atc === currentModalDrugAtc);
    parallels.sort((a, b) => a.puno_ime.localeCompare(b.puno_ime));

    const uniqueParallels = [];
    const seen = new Set();
    
    parallels.forEach(p => {
        const key = p.puno_ime + p.jacina;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueParallels.push(p);
        }
    });

    list.innerHTML = '';
    if (uniqueParallels.length <= 1) {
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Nema pronađenih paralela.</p>';
    } else {
        uniqueParallels.forEach(p => {
            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded-lg border border-gray-200 text-sm flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <span class="font-bold text-gray-700">${p.puno_ime}</span>
                    <span class="text-gray-400 ml-1 text-xs">${p.jacina || ''}</span>
                </div>
                <span class="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500">${p.oblik || ''}</span>
            `;
            list.appendChild(div);
        });
    }

    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });
}

function closeModal() {
    document.getElementById('drugModal').classList.add('hidden');
    currentModalDrugIndex = null;
    currentModalDrugAtc = null;
}

function removeCurrentDrug() {
    if (currentModalDrugIndex !== null) {
        selectedDrugs.splice(currentModalDrugIndex, 1);
        renderSelectedDrugs();
        checkInteractions();
        closeModal();
    }
}

// --- STANDARD WHO: ATC -> RxCUI MAPIRANJE ---
async function getRxCui(drug) {
    // 1. KORAK: PITAJ API ZA ATC KOD (NAJPRECIZNIJE)
    // Ovo rešava sve jezičke barijere jer je B01AA03 svuda isto.
    if (drug.atc) {
        try {
            // API poziv: Daj mi ID za ovaj ATC
            let res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?idtype=ATC&id=${drug.atc}`);
            let data = await res.json();
            
            // API vrati listu ID-jeva, uzimamo prvi (obično je to aktivna supstanca)
            if (data.idGroup && data.idGroup.rxnormId) {
                console.log(`✅ ATC PREPOZNAT: ${drug.atc} -> RxCUI: ${data.idGroup.rxnormId[0]}`);
                return data.idGroup.rxnormId[0];
            }
        } catch (e) {
            console.warn(`Greska pri ATC pretrazi za ${drug.puno_ime}`);
        }
    }

    // 2. KORAK: FALLBACK (SAMO AKO ATC NE PROĐE)
    // Ako RxNav nema taj ATC (npr. lokalni kombinovani lek), probamo "očišćeni" INN.
    if (drug.inn) {
        try {
            let safeInn = drug.inn.split(',')[0].split(';')[0].trim();
            // Probamo direktno engleski naziv ako slucajno pogodimo, ili slican srpski
            let res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(safeInn)}`);
            let data = await res.json();
            if (data.idGroup && data.idGroup.rxnormId) {
                return data.idGroup.rxnormId[0];
            }
        } catch (e) {}
    }

    console.warn(`❌ Nije pronađen ID za lek: ${drug.puno_ime} (ATC: ${drug.atc})`);
    return null;
}


// 6. PROVERA INTERAKCIJA
async function checkInteractions() {
    const container = document.getElementById('interactionsContainer');
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInteractions = document.getElementById('noInteractions');
    const errorDiv = document.getElementById('errorInteractions');
    const loading = document.getElementById('loadingInteractions');

    severeDiv.innerHTML = '';
    moderateDiv.innerHTML = '';
    noInteractions.classList.add('hidden');
    errorDiv.classList.add('hidden');
    
    if (selectedDrugs.length < 2) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    loading.classList.remove('hidden');

    try {
        const idPromises = selectedDrugs.map(drug => getRxCui(drug));
        const ids = (await Promise.all(idPromises)).filter(id => id !== null);

        if (ids.length < 2) {
            loading.classList.add('hidden');
            noInteractions.classList.remove('hidden');
            // Ovde mozda dodati poruku: "Nismo uspeli da identifikujemo lekove u bazi."
            return;
        }

        const idsString = ids.join('+');
        let res = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${idsString}`);
        
        if (!res.ok) throw new Error("API Error");
        
        let data = await res.json();
        let interactions = [];

        if (data.fullInteractionTypeGroup) {
            data.fullInteractionTypeGroup.forEach(group => {
                group.fullInteractionType.forEach(type => {
                    type.interactionPair.forEach(pair => {
                        interactions.push({
                            drug1: pair.interactionConcept[0].minConceptItem.name,
                            drug2: pair.interactionConcept[1].minConceptItem.name,
                            desc: pair.description,
                            severity: type.severity
                        });
                    });
                });
            });
        }

        loading.classList.add('hidden');

        if (interactions.length === 0) {
            noInteractions.classList.remove('hidden');
        } else {
            const uniqueInteractions = [];
            const seen = new Set();
            interactions.forEach(i => {
                const key = i.desc;
                if(!seen.has(key)) {
                    seen.add(key);
                    uniqueInteractions.push(i);
                }
            });

            uniqueInteractions.sort((a, b) => (a.severity === 'High' ? -1 : 1));

            uniqueInteractions.forEach(inter => {
                const isSevere = inter.severity === 'High';
                
                const card = document.createElement('div');
                card.className = isSevere 
                    ? "bg-red-50 border-l-[6px] border-red-500 p-4 rounded-r-xl shadow-sm mb-2" 
                    : "bg-amber-50 border-l-[6px] border-amber-400 p-4 rounded-r-xl shadow-sm mb-2";

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold ${isSevere ? 'text-red-800' : 'text-amber-800'} text-sm flex items-center gap-2">
                            ${isSevere ? '⛔ OZBILJNA INTERAKCIJA' : '⚠️ UMERENA INTERAKCIJA'}
                        </h3>
                    </div>
                    <div class="text-xs font-bold text-gray-600 mb-1 uppercase">
                        ${inter.drug1} + ${inter.drug2}
                    </div>
                    <p class="text-gray-700 text-xs leading-relaxed opacity-90">${inter.desc}</p>
                `;

                if (isSevere) severeDiv.appendChild(card);
                else moderateDiv.appendChild(card);
            });
        }

    } catch (e) {
        console.error(e);
        loading.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
}