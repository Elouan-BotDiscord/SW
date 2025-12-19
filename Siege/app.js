let currentPlan = {};
let guildPlayersList = [];
let guestPlayersList = [];
let currentBaseId = null;
let playerMonstersCache = {}; // Cache des monstres par joueur
let currentWorkflowMode = 'player-first'; // 'player-first' or 'monsters-first'
let currentEditingSlot = null; // Track which slot is being edited in monsters-first mode

// Helper function to check if a player is a guest
function isGuest(playerName) {
    return guestPlayersList.includes(playerName);
}

// Chargement initial
async function loadState() {
    const res = await fetch('/api/state');
    const data = await res.json();
    currentPlan = data.plan || {};
    
    // Initialiser les bases manquantes avec des slots vides
    for (let i = 1; i <= 12; i++) {
        if (!currentPlan[i]) {
            currentPlan[i] = Array.from({ length: 5 }, () => ({ player: null, monsters: [] }));
        }
    }
    
    // Gérer le format de la liste des joueurs (peut être un tableau d'objets ou de strings)
    if (data.players && data.players.length > 0 && typeof data.players[0] === 'object') {
        guildPlayersList = data.players.map(p => p.name);
    } else {
        guildPlayersList = data.players || [];
    }
    
    guestPlayersList = data.guests || [];
    
    renderBasesMenu();
    renderGuestList();
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
        const data = await res.json();
        
        // Si c'est un guest, retourner tous les monstres possibles
        if (data.isGuest) {
            // Créer un tableau avec tous les IDs de monstres du MONSTER_MAPPING
            const allMonsters = Object.keys(MONSTER_MAPPING).map(id => ({
                unit_master_id: parseInt(id, 10)
            }));
            playerMonstersCache[playerName] = allMonsters;
            return allMonsters;
        }
        
        const monsters = data;
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
    
    // Si c'est un guest, donner une quantité illimitée pour tous les monstres
    if (isGuest(playerName)) {
        playerMonsters.forEach(m => {
            const id = m.unit_master_id;
            monsterCounts[id] = { owned: 999, used: 0 };
        });
        
        // Compter les monstres déjà utilisés par ce guest
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
    
    // Pour les joueurs normaux
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
        // Vérifier que la base existe avant d'accéder à ses slots
        const baseSlots = currentPlan[i] || [];
        const filledSlots = baseSlots.filter(s => s.player).length;
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
    
    // Setup workflow mode listeners
    document.getElementById('mode-player-first').addEventListener('change', handleWorkflowChange);
    document.getElementById('mode-monsters-first').addEventListener('change', handleWorkflowChange);
    
    renderBasesMenu(); // Pour mettre à jour l'état actif
    await renderBaseDetails(id);
}

function handleWorkflowChange(e) {
    currentWorkflowMode = e.target.value;
    renderBaseDetails(currentBaseId);
}

// 2. Rendu des 5 slots d'une base
async function renderBaseDetails(baseId) {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';
    
    // Vérifier que la base existe
    if (!currentPlan[baseId]) {
        currentPlan[baseId] = Array.from({ length: 5 }, () => ({ player: null, monsters: [] }));
    }
    
    const slots = currentPlan[baseId];

    if (currentWorkflowMode === 'player-first') {
        await renderPlayerFirstWorkflow(baseId, slots, container);
    } else {
        await renderMonstersFirstWorkflow(baseId, slots, container);
    }
}

// Workflow existant: Joueur → Monstres
async function renderPlayerFirstWorkflow(baseId, slots, container) {
    for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        const div = document.createElement('div');
        div.className = 'slot-card';
        
        let playerSelect = `<select class="form-select mb-2" onchange="updateSlotPlayer(${baseId}, ${index}, this.value)">
            <option value="">-- Choisir un joueur --</option>
            ${guildPlayersList.map(p => {
                const guestBadge = isGuest(p) ? ' 👤 Guest' : '';
                return `<option value="${p}" ${slot.player === p ? 'selected' : ''}>${p}${guestBadge}</option>`;
            }).join('')}
        </select>`;

        let monstersHtml = '';
        let conflictHtml = '';
        
        if (slot.player) {
            const playerMonsters = await loadPlayerMonsters(slot.player);
            const monsterAvailability = getAvailableMonsters(slot.player, playerMonsters);
            
            const datalistId = `monsters-${baseId}-${index}`;
            let datalistOptions = '';
            
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
            
            const quantityConflicts = [];
            slot.monsters.forEach((mId, idx) => {
                if (!mId) return;
                const availability = monsterAvailability[mId];
                if (availability && availability.used > availability.owned) {
                    quantityConflicts.push(`${getMonsterName(mId)}: ${availability.used} utilisé(s) > ${availability.owned} possédé(s)`);
                }
            });
            
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
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="mb-0">Emplacement ${index + 1}</h5>
                <button class="btn btn-sm btn-outline-danger" onclick="resetSlot(${baseId}, ${index})" title="Réinitialiser l'emplacement">
                    <i class="bi bi-trash"></i> Réinitialiser
                </button>
            </div>
            ${playerSelect}
            ${monstersHtml}
            ${conflictHtml}
        `;
        container.appendChild(div);
    }
}

// Nouveau workflow: Monstres → Joueur
async function renderMonstersFirstWorkflow(baseId, slots, container) {
    for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        const div = document.createElement('div');
        div.className = 'slot-card';
        
        // Créer une datalist avec tous les monstres de tous les joueurs
        const datalistId = `all-monsters-${baseId}-${index}`;
        let allMonstersMap = new Map(); // Map<monsterId, Set<playerName>>
        
        for (const playerName of guildPlayersList) {
            const playerMonsters = await loadPlayerMonsters(playerName);
            playerMonsters.forEach(m => {
                const mId = m.unit_master_id;
                if (!allMonstersMap.has(mId)) {
                    allMonstersMap.set(mId, new Set());
                }
                allMonstersMap.get(mId).add(playerName);
            });
        }
        
        let datalistOptions = '';
        allMonstersMap.forEach((players, mId) => {
            const name = getMonsterName(mId);
            datalistOptions += `<option value="${mId}">${name}</option>`;
        });
        
        const datalist = `<datalist id="${datalistId}">${datalistOptions}</datalist>`;
        
        const monstersHtml = `
            ${datalist}
            <div class="d-flex gap-2 flex-wrap mb-2">
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
                                onchange="updateMonstersFirstSlotMonster(${baseId}, ${index}, ${mIdx}, this.value)">
                            <small class="text-muted">${currentName || 'Aucun'}</small>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Afficher les joueurs suggérés si des monstres sont sélectionnés
        let playerSuggestionsHtml = '';
        let currentPlayerHtml = '';
        const selectedMonsters = slot.monsters.filter(m => m);
        
        if (slot.player) {
            // Si un joueur est déjà assigné, afficher seulement le joueur
            currentPlayerHtml = `<div class="alert alert-info">Joueur: <strong>${slot.player}</strong></div>`;
        } else if (selectedMonsters.length > 0) {
            // Si pas de joueur mais des monstres sélectionnés, afficher les suggestions
            const { availablePlayers, unavailablePlayers } = await findPlayersWithMonsters(selectedMonsters);
            
            if (availablePlayers.length > 0 || unavailablePlayers.length > 0) {
                let playersOptionsHtml = '<option value="">-- Sélectionner un joueur --</option>';
                
                // Joueurs disponibles (en vert)
                if (availablePlayers.length > 0) {
                    playersOptionsHtml += '<optgroup label="✓ Joueurs disponibles">';
                    availablePlayers.forEach(p => {
                        playersOptionsHtml += `<option value="${p}">${p}</option>`;
                    });
                    playersOptionsHtml += '</optgroup>';
                }
                
                // Joueurs partiellement disponibles (disabled)
                if (unavailablePlayers.length > 0) {
                    playersOptionsHtml += '<optgroup label="⚠ Monstres déjà utilisés">';
                    unavailablePlayers.forEach(playerInfo => {
                        playersOptionsHtml += `<option value="" disabled>${playerInfo.playerName} - Indisponible</option>`;
                    });
                    playersOptionsHtml += '</optgroup>';
                }
                
                playerSuggestionsHtml = `
                    <div class="mb-2">
                        <label class="form-label"><strong>Joueurs suggérés:</strong></label>
                        <select class="form-select" onchange="selectSuggestedPlayer(${baseId}, ${index}, this.value)">
                            ${playersOptionsHtml}
                        </select>
                    </div>
                `;
                
                // Afficher les détails des joueurs indisponibles
                if (unavailablePlayers.length > 0) {
                    let unavailableDetailsHtml = '<div class="alert alert-warning mt-2"><small>';
                    unavailablePlayers.forEach(playerInfo => {
                        unavailableDetailsHtml += `<strong>${playerInfo.playerName}:</strong> `;
                        const monsterDetails = playerInfo.unavailableMonsters.map(m => {
                            const locationStrs = m.locations.map(loc => 
                                `Base ${loc.baseId} (Slot ${loc.slotIndex + 1})`
                            ).join(', ');
                            return `${m.monsterName} utilisé dans ${locationStrs}`;
                        }).join(' et ');
                        unavailableDetailsHtml += monsterDetails + '<br>';
                    });
                    unavailableDetailsHtml += '</small></div>';
                    playerSuggestionsHtml += unavailableDetailsHtml;
                }
            } else {
                playerSuggestionsHtml = `
                    <div class="alert alert-warning">
                        Aucun membre ne possède ces monstres
                    </div>
                `;
            }
        }
        
        // Vérifier les conflits
        let conflictHtml = '';
        if (slot.player && selectedMonsters.length > 0) {
            const playerMonsters = await loadPlayerMonsters(slot.player);
            const monsterAvailability = getAvailableMonsters(slot.player, playerMonsters);
            
            const quantityConflicts = [];
            slot.monsters.forEach((mId, idx) => {
                if (!mId) return;
                const availability = monsterAvailability[mId];
                if (availability && availability.used > availability.owned) {
                    quantityConflicts.push(`${getMonsterName(mId)}: ${availability.used} utilisé(s) > ${availability.owned} possédé(s)`);
                }
            });
            
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
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="mb-0">Emplacement ${index + 1}</h5>
                <button class="btn btn-sm btn-outline-danger" onclick="resetSlot(${baseId}, ${index})" title="Réinitialiser l'emplacement">
                    <i class="bi bi-trash"></i> Réinitialiser
                </button>
            </div>
            ${monstersHtml}
            ${playerSuggestionsHtml}
            ${currentPlayerHtml}
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
    const parsedValue = value ? parseInt(value, 10) : null;
    newMonsters[monsterIdx] = (parsedValue && !isNaN(parsedValue)) ? parsedValue : null;
    await sendUpdate(baseId, slotIndex, slot.player, newMonsters);
}

// Mise à jour pour le workflow "monstres d'abord"
async function updateMonstersFirstSlotMonster(baseId, slotIndex, monsterIdx, value) {
    const slot = currentPlan[baseId][slotIndex];
    const newMonsters = [...slot.monsters];
    const parsedValue = value ? parseInt(value, 10) : null;
    newMonsters[monsterIdx] = (parsedValue && !isNaN(parsedValue)) ? parsedValue : null;
    // On garde le joueur actuel (peut être null), on met juste à jour les monstres
    await sendUpdate(baseId, slotIndex, slot.player, newMonsters);
}

// Sélectionner un joueur suggéré
async function selectSuggestedPlayer(baseId, slotIndex, player) {
    const slot = currentPlan[baseId][slotIndex];
    // Garder les monstres déjà sélectionnés
    await sendUpdate(baseId, slotIndex, player, slot.monsters);
}

// Réinitialiser un slot
async function resetSlot(baseId, slotIndex) {
    if (confirm('Voulez-vous vraiment réinitialiser cet emplacement ?')) {
        await sendUpdate(baseId, slotIndex, null, []);
        await loadState();
    }
}

// Trouver les joueurs qui possèdent tous les monstres sélectionnés
async function findPlayersWithMonsters(monsterIds) {
    const availablePlayers = [];
    const unavailablePlayers = [];
    
    // Convert monsterIds to numbers for consistent comparison
    const numericMonsterIds = monsterIds.map(mId => parseInt(mId, 10)).filter(id => !isNaN(id));
    
    // Count how many of each monster we need
    const neededMonsters = {};
    numericMonsterIds.forEach(mId => {
        neededMonsters[mId] = (neededMonsters[mId] || 0) + 1;
    });
    
    // Convert needed monster keys to integers once
    const neededMonstersInt = {};
    for (const [mId, count] of Object.entries(neededMonsters)) {
        neededMonstersInt[parseInt(mId, 10)] = count;
    }
    
    for (const playerName of guildPlayersList) {
        // Exclure les guests des suggestions en mode "monstres d'abord"
        if (isGuest(playerName)) {
            continue;
        }
        const playerMonsters = await loadPlayerMonsters(playerName);
        const playerMonsterIds = new Set(playerMonsters.map(m => m.unit_master_id));
        
        // Vérifier si le joueur possède tous les monstres
        const hasAllMonsters = Object.keys(neededMonstersInt).every(mId => 
            playerMonsterIds.has(parseInt(mId, 10))
        );
        
        if (hasAllMonsters) {
            // Vérifier également la disponibilité (pas déjà utilisés)
            const monsterAvailability = getAvailableMonsters(playerName, playerMonsters);
            const unavailableDetails = [];
            
            let allAvailable = true;
            for (const [mId, needed] of Object.entries(neededMonstersInt)) {
                const mIdInt = parseInt(mId, 10);
                const availability = monsterAvailability[mIdInt];
                const available = availability ? (availability.owned - availability.used) : 0;
                
                if (available < needed) {
                    allAvailable = false;
                    // Find where this monster is used
                    const usedLocations = findMonsterUsageLocations(playerName, mIdInt);
                    unavailableDetails.push({
                        monsterId: mIdInt,
                        monsterName: getMonsterName(mIdInt),
                        locations: usedLocations
                    });
                }
            }
            
            if (allAvailable) {
                availablePlayers.push(playerName);
            } else {
                unavailablePlayers.push({
                    playerName,
                    unavailableMonsters: unavailableDetails
                });
            }
        }
    }
    
    return { availablePlayers, unavailablePlayers };
}

// Trouver où un monstre est utilisé
function findMonsterUsageLocations(playerName, monsterId) {
    const locations = [];
    
    for (const [baseId, slots] of Object.entries(currentPlan)) {
        slots.forEach((slot, slotIndex) => {
            if (slot.player === playerName && slot.monsters.includes(monsterId)) {
                locations.push({
                    baseId: parseInt(baseId),
                    slotIndex: slotIndex
                });
            }
        });
    }
    
    return locations;
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
// This function is now deprecated - quantity-based conflicts are handled by getAvailableMonsters
// Keeping it for backwards compatibility but it returns empty array
function checkConflicts(player, monsters, currentBaseId, currentSlotIndex) {
    // Conflict detection is now handled by quantityConflicts in the rendering functions
    // which use getAvailableMonsters() to properly check owned vs used quantities
    return [];
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

// 6. Gestion des guests
async function addGuest() {
    const guestInput = document.getElementById('guest-pseudo');
    const guestName = guestInput.value.trim();
    
    if (!guestName) {
        alert("Veuillez entrer un pseudo pour le guest");
        return;
    }
    
    try {
        const res = await fetch('/api/add-guest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestName })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Erreur lors de l'ajout du guest");
            return;
        }
        
        alert("Guest ajouté avec succès !");
        guestInput.value = '';
        await loadState();
    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'ajout du guest");
    }
}

async function removeGuest(guestName) {
    if (!confirm(`Voulez-vous vraiment supprimer le guest "${guestName}" ?\nToutes ses assignations seront supprimées.`)) {
        return;
    }
    
    try {
        const res = await fetch(`/api/remove-guest/${encodeURIComponent(guestName)}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            alert(data.error || "Erreur lors de la suppression du guest");
            return;
        }
        
        alert("Guest supprimé avec succès !");
        await loadState();
    } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression du guest");
    }
}

function renderGuestList() {
    const container = document.getElementById('guest-list');
    if (!container) return;
    
    if (guestPlayersList.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucun guest ajouté</p>';
        return;
    }
    
    container.innerHTML = guestPlayersList.map(guest => `
        <div class="guest-list-item">
            <span>👤 ${guest}</span>
            <button class="btn btn-sm btn-danger" onclick="removeGuest('${guest}')">
                <i class="bi bi-trash"></i> Supprimer
            </button>
        </div>
    `).join('');
}

// Démarrage
loadState();