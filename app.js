// GLOBALNE PROMENLJIVE
let lekoviBaza = {};        // Svi lekovi iz JSON-a
let selectedDrugs = [];     // Lekovi koje je korisnik izabrao (Korpa)
let currentModalDrugIndex = null; // Da znamo koji lek da obrišemo

// 1. UČITAVANJE BAZE
fetch('lekovi.json')
    .then(response => response.json())
    .then(data => {
        // Pretvaramo objekat { "ime": [varijante] } u ravnu listu za lakšu pretragu
        // Ovo olakšava pretragu po EAN kodu
        lekoviBaza = [];
        for (const [key, variants] of Object.entries(data)) {
            variants.forEach(variant => {
                // Dodajemo ključ pretrage u objekat radi lakšeg pristupa
                variant.searchKey = key; 
                lekoviBaza.push(variant);
            });
        }
        console.log("Baza učitana. Ukupno varijanti:", lekoviBaza.length);
    })
    .catch(err => console.error("Greška baze:", err));

// 2. LOGIKA PRETRAGE (Input Listener)
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = '';
    
    if (query.length < 3) {
        searchResults.classList.add('hidden');
        return;
    }

    // Filtriranje: Ime sadrži query ILI EAN počinje sa query
    // Limitiramo na 10 rezultata da ne gušimo UI
    const matches = lekoviBaza.filter(drug => {
        const nameMatch = drug.puno_ime.toLowerCase().includes(query);
        const eanMatch = drug.ean && drug.ean.startsWith(query);
        return nameMatch || eanMatch;
    }).slice(0, 10);

    if (matches.length > 0) {
        searchResults.classList.remove('hidden');
        matches.forEach(drug => {
            const div = document.createElement('div');
            div.className = "p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition";
            div.innerHTML = `
                <div>
                    <div class="font-bold text-gray-800 text-sm">${drug.puno_ime}</div>
                    <div class="text-xs text-gray-500">ATC: ${drug.atc} ${drug.ean ? '| EAN: ' + drug.ean : ''}</div>
                </div>
                <div class="text-blue-500 font-bold text-xl">+</div>
            `;
            // Klik na rezultat dodaje lek
            div.onclick = () => selectDrug(drug);
            searchResults.appendChild(div);
        });
    } else {
        searchResults.classList.add('hidden');
    }
});

// 3. DODAVANJE LEKA U LISTU
function selectDrug(drug) {
    // Provera duplikata
    const exists = selectedDrugs.some(d => d.ean === drug.ean && d.puno_ime === drug.puno_ime);
    if (exists) {
        alert("Ovaj lek je već na spisku.");
        searchInput.value = '';
        searchResults.classList.add('hidden');
        return;
    }

    selectedDrugs.push(drug);
    
    // UI Reset
    searchInput.value = '';
    searchResults.classList.add('hidden');
    
    renderSelectedDrugs();
    checkInteractions(); // Automatska provera
}

// 4. PRIKAZ IZABRANIH LEKOVA
function renderSelectedDrugs() {
    const container = document.getElementById('selectedDrugsList');
    const wrapper = document.getElementById('selectedContainer');
    
    container.innerHTML = '';
    
    if (selectedDrugs.length === 0) {
        wrapper.classList.add('hidden');
        return;
    }
    
    wrapper.classList.remove('hidden');

    selectedDrugs.forEach((drug, index) => {
        const item = document.createElement('div');
        // Stil dugmeta kao u skici (Box sa imenom)
        item.className = "bg-white border border-blue-200 rounded-xl p-4 shadow-sm flex justify-between items-center cursor-pointer hover:shadow-md transition group";
        item.onclick = () => openModal(index); // Klik otvara modal

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-blue-100 text-blue-600 p-2 rounded-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                </div>
                <div>
                    <div class="font-bold text-gray-800">${drug.puno_ime}</div>
                    <div class="text-xs text-gray-400">${drug.inn}</div>
                </div>
            </div>
            <div class="text-gray-300 group-hover:text-blue-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        `;
        container.appendChild(item);
    });
}

// 5. MODAL LOGIKA
function openModal(index) {
    currentModalDrugIndex = index;
    const drug = selectedDrugs[index];
    const modal = document.getElementById('drugModal');
    const content = document.getElementById('modalContent');
    
    // Generisanje sadržaja modala
    let warningHtml = drug.upozorenje_voznja 
        ? `<div class="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-red-700 text-sm font-bold flex items-start gap-2">
             <span>⚠️</span> <span>${drug.upozorenje_voznja}</span>
           </div>` 
        : '';

    let linksHtml = '<div class="flex gap-2 mt-4">';
    if(drug.smpc) linksHtml += `<a href="${drug.smpc}" target="_blank" class="flex-1 bg-blue-600 text-white text-center py-3 rounded-lg font-bold text-sm hover:bg-blue-700">📄 SmPC (Lekar)</a>`;
    if(drug.pil) linksHtml += `<a href="${drug.pil}" target="_blank" class="flex-1 bg-green-500 text-white text-center py-3 rounded-lg font-bold text-sm hover:bg-green-600">💊 Uputstvo</a>`;
    linksHtml += '</div>';

    content.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-1">${drug.puno_ime}</h2>
        <p class="text-gray-500 text-sm mb-4">INN: ${drug.inn}</p>
        
        ${warningHtml}

        <div class="space-y-3 text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
            <div class="flex justify-between border-b pb-2">
                <span>ATC Kod:</span> <span class="font-mono font-bold">${drug.atc}</span>
            </div>
            <div class="flex justify-between border-b pb-2">
                <span>Jačina:</span> <span>${drug.jacina}</span>
            </div>
             <div class="flex justify-between border-b pb-2">
                <span>Oblik:</span> <span>${drug.oblik}</span>
            </div>
            <div class="flex justify-between">
                <span>Režim:</span> <span class="font-bold">${drug.rezim}</span>
            </div>
        </div>
        
        ${linksHtml}
    `;

    modal.classList.remove('hidden');
    // Animacija ulaska
    setTimeout(() => {
        modal.firstElementChild.classList.remove('opacity-0'); // Backdrop
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('drugModal');
    modal.classList.add('hidden');
    currentModalDrugIndex = null;
}

function removeCurrentDrug() {
    if (currentModalDrugIndex !== null) {
        selectedDrugs.splice(currentModalDrugIndex, 1);
        renderSelectedDrugs();
        checkInteractions(); // Ponovna provera nakon brisanja
        closeModal();
    }
}

// 6. PROVERA INTERAKCIJA (Srce sistema)
async function checkInteractions() {
    const container = document.getElementById('interactionsContainer');
    const severeDiv = document.getElementById('severeInteractions');
    const moderateDiv = document.getElementById('moderateInteractions');
    const noInteractions = document.getElementById('noInteractions');
    const loading = document.getElementById('loadingInteractions');
    const countBadge = document.getElementById('interactionCount');

    // Reset
    severeDiv.innerHTML = '';
    moderateDiv.innerHTML = '';
    noInteractions.classList.add('hidden');
    
    if (selectedDrugs.length < 2) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    loading.classList.remove('hidden');

    // 6a. Prikupljanje RxCUI ID-jeva
    const rxcuiList = [];
    
    // Koristimo Promise.all da paralelno dohvatimo ID-jeve za sve lekove
    const idPromises = selectedDrugs.map(async (drug) => {
        if (!drug.atc) return null;
        try {
            // Cache mehanizam bi bio super ovde, ali za sada basic fetch
            let res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?idtype=ATC&id=${drug.atc}`);
            let data = await res.json();
            if (data.idGroup && data.idGroup.rxnormId) {
                return data.idGroup.rxnormId[0];
            }
        } catch (e) { console.error(e); }
        return null;
    });

    const ids = (await Promise.all(idPromises)).filter(id => id !== null);

    if (ids.length < 2) {
        loading.classList.add('hidden');
        noInteractions.classList.remove('hidden');
        return;
    }

    // 6b. Provera interakcija
    try {
        const idsString = ids.join('+');
        let res = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${idsString}`);
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
                            severity: type.severity // "High" ili "N/A" (često moderate)
                        });
                    });
                });
            });
        }

        loading.classList.add('hidden');
        countBadge.innerText = interactions.length;

        if (interactions.length === 0) {
            noInteractions.classList.remove('hidden');
        } else {
            // Sortiranje: High ide prvo
            interactions.sort((a, b) => (a.severity === 'High' ? -1 : 1));

            interactions.forEach(inter => {
                const isSevere = inter.severity === 'High';
                
                const card = document.createElement('div');
                card.className = isSevere 
                    ? "bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl shadow-sm" 
                    : "bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl shadow-sm";

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold ${isSevere ? 'text-red-800' : 'text-orange-800'} text-sm">
                            ${inter.drug1} <span class="text-gray-400 mx-1">↔</span> ${inter.drug2}
                        </h3>
                        <span class="text-[10px] uppercase font-bold px-2 py-1 rounded ${isSevere ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}">
                            ${isSevere ? 'Teška' : 'Umerena'}
                        </span>
                    </div>
                    <p class="text-gray-700 text-xs leading-relaxed">${inter.desc}</p>
                `;

                if (isSevere) severeDiv.appendChild(card);
                else moderateDiv.appendChild(card);
            });
            
            // Dodajemo naslove ako ima sadržaja
            if(severeDiv.children.length > 0) {
                const title = document.createElement('h3');
                title.className = "text-red-600 font-bold text-sm mt-2 mb-1 pl-1";
                title.innerText = "⚠️ Teške interakcije";
                severeDiv.prepend(title);
            }
            if(moderateDiv.children.length > 0) {
                 const title = document.createElement('h3');
                title.className = "text-orange-500 font-bold text-sm mt-4 mb-1 pl-1";
                title.innerText = "⚡ Umerene interakcije";
                moderateDiv.prepend(title);
            }
        }

    } catch (e) {
        console.error(e);
        loading.classList.add('hidden');
        container.innerHTML += '<p class="text-red-500 text-center text-sm">Greška servera.</p>';
    }
}
