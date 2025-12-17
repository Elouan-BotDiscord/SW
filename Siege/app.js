let currentPlan = {};
let guildPlayersList = [];
let currentBaseId = null;
let playerMonstersCache = {}; // Cache des monstres par joueur
let slotModes = {}; // Store mode for each slot: "player-first" or "monsters-first"

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

// Obtenir tous les monstres disponibles dans la guilde
async function getAllAvailableMonstersInGuild() {
    const guildMonsters = {};
    const monsterToPlayers = {};
    
    for (const playerName of guildPlayersList) {
        const playerMonsters = await loadPlayerMonsters(playerName);
        
        playerMonsters.forEach(m => {
            const id = m.unit_master_id;
            
            // Ajouter le monstre à la liste globale
            if (!guildMonsters[id]) {
                guildMonsters[id] = {
                    id: id,
                    name: getMonsterName(id),
                    players: []
                };
            }
            
            // Ajouter le joueur à la liste pour ce monstre
            if (!guildMonsters[id].players.includes(playerName)) {
                guildMonsters[id].players.push(playerName);
            }
            
            // Mapping monstre -> joueurs
            if (!monsterToPlayers[id]) {
                monsterToPlayers[id] = [];
            }
            if (!monsterToPlayers[id].includes(playerName)) {
                monsterToPlayers[id].push(playerName);
            }
        });
    }
    
    return { guildMonsters, monsterToPlayers };
}

// Trouver les joueurs ayant tous les monstres sélectionnés et disponibles
async function findPlayersWithMonsters(monsterIds, baseId, slotIndex) {
    if (!monsterIds || monsterIds.length === 0) {
        return [];
    }
    
    // Filtrer les IDs non nuls
    const validMonsterIds = monsterIds.filter(id => id);
    if (validMonsterIds.length === 0) {
        return [];
    }
    
    const eligiblePlayers = [];
    
    for (const playerName of guildPlayersList) {
        const playerMonsters = await loadPlayerMonsters(playerName);
        const monsterAvailability = getAvailableMonsters(playerName, playerMonsters);
        
        // Vérifier que le joueur possède tous les monstres demandés
        let hasAllMonsters = true;
        let allAvailable = true;
        
        for (const mId of validMonsterIds) {
            const availability = monsterAvailability[mId];
            
            if (!availability || availability.owned === 0) {
                hasAllMonsters = false;
                break;
            }
            
            // Vérifier la disponibilité
            const available = availability.owned - availability.used;
            if (available <= 0) {
                allAvailable = false;
                break;
            }
        }
        
        if (hasAllMonsters && allAvailable) {
            // Calculer le nombre total de monstres disponibles pour ce joueur
            let totalAvailable = 0;
            for (const [mId, avail] of Object.entries(monsterAvailability)) {
                totalAvailable += (avail.owned - avail.used);
            }
            
            eligiblePlayers.push({
                name: playerName,
                totalAvailable: totalAvailable
            });
        }
    }
    
    // Trier par nombre de monstres disponibles (décroissant)
    eligiblePlayers.sort((a, b) => b.totalAvailable - a.totalAvailable);
    
    return eligiblePlayers;
}

// Get or initialize slot mode
function getSlotMode(baseId, slotIndex) {
    const key = `${baseId}-${slotIndex}`;
    return slotModes[key] || 'player-first';
}

// Set slot mode
function setSlotMode(baseId, slotIndex, mode) {
    const key = `${baseId}-${slotIndex}`;
    slotModes[key] = mode;
}

// Toggle slot mode
async function toggleSlotMode(baseId, slotIndex) {
    const currentMode = getSlotMode(baseId, slotIndex);
    const newMode = currentMode === 'player-first' ? 'monsters-first' : 'player-first';
    setSlotMode(baseId, slotIndex, newMode);
    await renderBaseDetails(baseId);
}

// Update monster selection in monsters-first mode
async function updateMonsterFirstSelection(baseId, slotIndex, monsterIdx, value) {
    // Store temporary monster selection
    const key = `temp-${baseId}-${slotIndex}`;
    if (!window.tempMonsterSelections) {
        window.tempMonsterSelections = {};
    }
    if (!window.tempMonsterSelections[key]) {
        window.tempMonsterSelections[key] = [null, null, null];
    }
    window.tempMonsterSelections[key][monsterIdx] = value ? parseInt(value) : null;
    
    // Re-render to update suggested players
    await renderBaseDetails(baseId);
}

// Assign player with selected monsters in monsters-first mode
async function assignPlayerWithMonsters(baseId, slotIndex, playerName) {
    const key = `temp-${baseId}-${slotIndex}`;
    const monsters = window.tempMonsterSelections?.[key] || [null, null, null];
    
    await sendUpdate(baseId, slotIndex, playerName, monsters);
    
    // Clear temporary selection
    if (window.tempMonsterSelections) {
        delete window.tempMonsterSelections[key];
    }
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
        
        const mode = getSlotMode(baseId, index);
        const isMonsterFirst = mode === 'monsters-first';
        
        // Mode toggle button
        const modeToggle = `
            <div class="mode-toggle mb-3">
                <label class="form-label">Mode de sélection:</label>
                <div class="btn-group w-100" role="group">
                    <button type="button" class="btn ${!isMonsterFirst ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="setSlotMode(${baseId}, ${index}, 'player-first'); renderBaseDetails(${baseId})">
                        Joueur d'abord
                    </button>
                    <button type="button" class="btn ${isMonsterFirst ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="setSlotMode(${baseId}, ${index}, 'monsters-first'); renderBaseDetails(${baseId})">
                        Monstres d'abord
                    </button>
                </div>
            </div>
        `;
        
        let contentHtml = '';
        let conflictHtml = '';
        
        if (isMonsterFirst) {
            // Mode "Monstres d'abord"
            contentHtml = await renderMonstersFirstMode(baseId, index, slot);
        } else {
            // Mode "Joueur d'abord" (comportement actuel)
            contentHtml = await renderPlayerFirstMode(baseId, index, slot);
            
            // Vérification des conflits pour le mode joueur d'abord
            if (slot.player) {
                const playerMonsters = await loadPlayerMonsters(slot.player);
                const monsterAvailability = getAvailableMonsters(slot.player, playerMonsters);
                
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
        }

        div.innerHTML = `
            <h5>Emplacement ${index + 1}</h5>
            ${modeToggle}
            ${contentHtml}
            ${conflictHtml}
        `;
        container.appendChild(div);
    }
}

// Render player-first mode (existing behavior)
async function renderPlayerFirstMode(baseId, slotIndex, slot) {
    let playerSelect = `<select class="form-select mb-2" onchange="updateSlotPlayer(${baseId}, ${slotIndex}, this.value)">
        <option value="">-- Choisir un joueur --</option>
        ${guildPlayersList.map(p => `<option value="${p}" ${slot.player === p ? 'selected' : ''}>${p}</option>`).join('')}
    </select>`;

    let monstersHtml = '';
    
    if (slot.player) {
        const playerMonsters = await loadPlayerMonsters(slot.player);
        const monsterAvailability = getAvailableMonsters(slot.player, playerMonsters);
        
        // Créer une datalist unique pour ce slot
        const datalistId = `monsters-${baseId}-${slotIndex}`;
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
                                onchange="updateSlotMonster(${baseId}, ${slotIndex}, ${mIdx}, this.value)">
                            <small class="text-muted">${currentName || 'Aucun'}</small>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return playerSelect + monstersHtml;
}

// Render monsters-first mode (new behavior)
async function renderMonstersFirstMode(baseId, slotIndex, slot) {
    const { guildMonsters } = await getAllAvailableMonstersInGuild();
    
    // Créer une datalist pour tous les monstres de la guilde
    const datalistId = `guild-monsters-${baseId}-${slotIndex}`;
    let datalistOptions = '';
    
    Object.values(guildMonsters).forEach(monster => {
        datalistOptions += `<option value="${monster.id}">${monster.name} (${monster.players.length} joueur(s))</option>`;
    });
    
    const datalist = `<datalist id="${datalistId}">${datalistOptions}</datalist>`;
    
    // Get temporary monster selection or use slot monsters
    const key = `temp-${baseId}-${slotIndex}`;
    const tempMonsters = window.tempMonsterSelections?.[key] || slot.monsters || [null, null, null];
    
    // Monster selection inputs
    let monstersHtml = `
        ${datalist}
        <label class="form-label">Sélectionner les monstres:</label>
        <div class="d-flex gap-2 flex-wrap mb-3">
            ${[0, 1, 2].map(mIdx => {
                const currentValue = tempMonsters[mIdx] || '';
                const currentName = currentValue ? getMonsterName(currentValue) : '';
                return `
                    <div class="flex-fill">
                        <input type="text" 
                            class="form-control monster-input" 
                            placeholder="Rechercher un monstre" 
                            list="${datalistId}"
                            value="${currentValue}"
                            data-name="${currentName}"
                            onchange="updateMonsterFirstSelection(${baseId}, ${slotIndex}, ${mIdx}, this.value)">
                        <small class="text-muted">${currentName || 'Aucun'}</small>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Find eligible players
    const eligiblePlayers = await findPlayersWithMonsters(tempMonsters, baseId, slotIndex);
    
    let suggestedPlayersHtml = '';
    if (tempMonsters.filter(m => m).length > 0) {
        if (eligiblePlayers.length > 0) {
            suggestedPlayersHtml = `
                <div class="suggested-players">
                    <label class="form-label">Joueurs suggérés (${eligiblePlayers.length}):</label>
                    <select class="form-select mb-2" id="suggested-player-${baseId}-${slotIndex}">
                        <option value="">-- Choisir un joueur --</option>
                        ${eligiblePlayers.map(p => 
                            `<option value="${p.name}">${p.name} (${p.totalAvailable} monstres dispo)</option>`
                        ).join('')}
                    </select>
                    <button class="btn btn-success w-100" onclick="assignPlayerWithMonsters(${baseId}, ${slotIndex}, document.getElementById('suggested-player-${baseId}-${slotIndex}').value)">
                        Assigner
                    </button>
                </div>
            `;
        } else {
            suggestedPlayersHtml = `
                <div class="alert alert-warning">
                    Aucun joueur disponible avec tous ces monstres
                </div>
            `;
        }
    }
    
    return monstersHtml + suggestedPlayersHtml;
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