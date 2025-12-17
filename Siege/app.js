let currentPlan = {};
let guildPlayersList = [];
let currentBaseId = null;
let playerMonstersCache = {}; // Cache des monstres par joueur

// Chargement initial
async function loadState() {
    const res = await fetch('/api/state');
    const data = await res.json();
    currentPlan = data.plan;
    guildPlayersList = data.players;
    renderBasesMenu();
    if (currentBaseId) await renderBaseDetails(currentBaseId);
}

// Charger les monstres d'un joueur depuis l'API
async function loadPlayerMonsters(playerName) {
    if (!playerName) return [];
    if (playerMonstersCache[playerName]) return playerMonstersCache[playerName];
    
    try {
        const res = await fetch(`/api/player-monsters/${encodeURIComponent(playerName)}`);
        if (!res.ok) {
            console.error(`Failed to load monsters for ${playerName}`);
            return [];
        }
        const monsters = await res.json();
        playerMonstersCache[playerName] = monsters;
        return monsters;
    } catch (error) {
        console.error(`Error loading monsters for ${playerName}:`, error);
        return [];
    }
}

// Obtenir la liste des monstres disponibles avec leur quantité
function getAvailableMonsters(playerName, playerMonsters) {
    const monsterCounts = {};
    
    // Compter les monstres possédés
    playerMonsters.forEach(m => {
        const id = m.unit_master_id;
        monsterCounts[id] = monsterCounts[id] || { owned: 0, used: 0 };
        monsterCounts[id].owned++;
    });
    
    // Compter les monstres déjà utilisés
    for (const [baseId, slots] of Object.entries(currentPlan)) {
        slots.forEach(slot => {
            if (slot.player === playerName) {
                slot.monsters.forEach(mId => {
                    if (mId && monsterCounts[mId]) {
                        monsterCounts[mId].used++;
                    }
                });
            }
        });
    }
    
    return monsterCounts;
}

// 1. Rendu du menu des 12 bases
function renderBasesMenu() {
    const container = document.getElementById('bases-container');
    container.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const filledSlots = currentPlan[i].filter(s => s.player).length;
        const btn = document.createElement('div');
        btn.className = 'col-4'; // 3 par ligne
        btn.innerHTML = `
            <button class="btn btn-outline-primary base-btn ${currentBaseId == i ? 'active' : ''}" 
                    onclick="selectBase(${i})">
                Base ${i} <br> <small>${filledSlots}/5</small>
            </button>
        `;
        container.appendChild(btn);
    }
}

async function selectBase(id) {
    currentBaseId = id;
    document.getElementById('welcome-view').style.display = 'none';
    document.getElementById('base-view').style.display = 'block';
    document.getElementById('base-title').innerText = `Base ${id}`;
    renderBasesMenu(); // Pour mettre à jour l'état actif
    await renderBaseDetails(id);
}

// 2. Rendu des 5 slots d'une base
async function renderBaseDetails(baseId) {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';
    const slots = currentPlan[baseId];

    for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        const div = document.createElement('div');
        div.className = 'slot-card';
        
        // Mode affichage ou édition ? Simple mode édition tout le temps pour ce MVP
        let playerSelect = `<select class="form-select mb-2" onchange="updateSlotPlayer(${baseId}, ${index}, this.value)">
            <option value="">-- Choisir un joueur --</option>
            ${guildPlayersList.map(p => `<option value="${p}" ${slot.player === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>`;

        // Sélection des monstres avec autocomplétion
        let monstersHtml = '';
        let conflictHtml = '';
        
        if (slot.player) {
            const playerMonsters = await loadPlayerMonsters(slot.player);
            const monsterAvailability = getAvailableMonsters(slot.player, playerMonsters);
            
            // Créer une datalist unique pour ce slot
            const datalistId = `monsters-${baseId}-${index}`;
            let datalistOptions = '';
            
            // Créer les options basées sur les monstres possédés
            const uniqueMonsters = new Set(playerMonsters.map(m => m.unit_master_id));
            uniqueMonsters.forEach(mId => {
                const availability = monsterAvailability[mId];
                const available = availability.owned - availability.used;
                const name = getMonsterName(mId);
                datalistOptions += `<option value="${mId}">${name} (${available} dispo)</option>`;
            });
            
            const datalist = `<datalist id="${datalistId}">${datalistOptions}</datalist>`;
            
            monstersHtml = `
                ${datalist}
                <div class="d-flex gap-2 flex-wrap">
                    ${[0, 1, 2].map(mIdx => {
                        const currentValue = slot.monsters[mIdx] || '';
                        const currentName = currentValue ? getMonsterName(currentValue) : '';
                        return `
                            <div class="flex-fill">
                                <input type="text" 
                                    class="form-control monster-input" 
                                    placeholder="Rechercher un monstre" 
                                    list="${datalistId}"
                                    value="${currentValue}"
                                    data-name="${currentName}"
                                    onchange="updateSlotMonster(${baseId}, ${index}, ${mIdx}, this.value)">
                                <small class="text-muted">${currentName || 'Aucun'}</small>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            // Vérification des conflits de quantité
            const quantityConflicts = [];
            slot.monsters.forEach((mId, idx) => {
                if (!mId) return;
                const availability = monsterAvailability[mId];
                if (availability && availability.used > availability.owned) {
                    quantityConflicts.push(`${getMonsterName(mId)}: ${availability.used} utilisé(s) > ${availability.owned} possédé(s)`);
                }
            });
            
            // Vérification des conflits de duplication
            const duplicateConflicts = checkConflicts(slot.player, slot.monsters, baseId, index);
            
            if (quantityConflicts.length > 0 || duplicateConflicts.length > 0) {
                div.className += ' conflict';
                conflictHtml = '<div class="conflict-msg">⚠️ Conflit:<br>';
                if (quantityConflicts.length > 0) {
                    conflictHtml += quantityConflicts.join('<br>') + '<br>';
                }
                if (duplicateConflicts.length > 0) {
                    conflictHtml += duplicateConflicts.join('<br>');
                }
                conflictHtml += '</div>';
            }
        }

        div.innerHTML = `
            <h5>Emplacement ${index + 1}</h5>
            ${playerSelect}
            ${monstersHtml}
            ${conflictHtml}
        `;
        container.appendChild(div);
    }
}



// 3. Gestion des mises à jour
async function updateSlotPlayer(baseId, slotIndex, player) {
    // Récupérer les données actuelles du slot pour ne pas écraser les monstres si on change juste de joueur (optionnel)
    // Pour l'instant, reset monstres si changement de joueur
    await sendUpdate(baseId, slotIndex, player, []);
    // Charger les monstres du nouveau joueur si sélectionné
    if (player) {
        await loadPlayerMonsters(player);
    }
}

async function updateSlotMonster(baseId, slotIndex, monsterIdx, value) {
    const slot = currentPlan[baseId][slotIndex];
    const newMonsters = [...slot.monsters];
    newMonsters[monsterIdx] = value ? parseInt(value) : null;
    await sendUpdate(baseId, slotIndex, slot.player, newMonsters);
}

async function sendUpdate(baseId, slotIndex, player, monsters) {
    await fetch('/api/update-defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, slotIndex, player, monsters })
    });
    loadState(); // Recharger pour voir les conflits globaux
}

// 4. Détection des conflits (Unicité globale)
function checkConflicts(player, monsters, currentBaseId, currentSlotIndex) {
    let conflicts = [];
    monsters.forEach(mId => {
        if (!mId) return;
        
        // Parcourir tout le plan
        for (const [bId, slots] of Object.entries(currentPlan)) {
            slots.forEach((s, sIdx) => {
                // On ignore le slot actuel qu'on est en train d'éditer
                if (bId == currentBaseId && sIdx == currentSlotIndex) return;

                // Si c'est le même monstre utilisé n'importe où ailleurs (peu importe le joueur ? Non, "Un monstre ne peut être utilisé qu'une seule fois")
                // -> Dans SW, c'est une fois par joueur. Donc on vérifie si CE joueur utilise ce monstre ailleurs.
                if (s.player === player && s.monsters.includes(mId)) {
                    conflicts.push(`${getMonsterName(mId)} déjà utilisé en Base ${bId} (Slot ${sIdx + 1})`);
                }
            });
        }
    });
    return conflicts;
}

// 5. Import JSON
async function importJson() {
    const pseudo = document.getElementById('import-pseudo').value;
    const fileInput = document.getElementById('import-file');
    
    if (!pseudo || !fileInput.files[0]) {
        alert("Pseudo et fichier requis");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            // On suppose que le JSON est au format SW Exporter, unit_list est souvent la clé
            const monsterList = json.unit_list || json; 

            await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: pseudo, monsterList })
            });
            alert("Import réussi !");
            loadState();
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du JSON");
        }
    };
    reader.readAsText(file);
}

// Démarrage
loadState();