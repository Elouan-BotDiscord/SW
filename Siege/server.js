const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(express.static('.'));
app.use(bodyParser.json({ limit: '50mb' }));

// --- DONNÉES EN MÉMOIRE ---
// Stockage des joueurs : { "Pseudo": [ { unit_master_id: 123, ... }, ... ] }
let guildPlayers = {}; 

// Stockage du plan de siège
// Structure : 12 bases, chacune a 5 slots.
// slot = { player: "Pseudo", monsters: [id1, id2, id3] }
let siegePlan = {};

// Initialisation des 12 bases vides
for (let i = 1; i <= 12; i++) {
    siegePlan[i] = Array(5).fill(null).map(() => ({ player: null, monsters: [] }));
}

// --- API ---

// 1. Récupérer l'état actuel (Plan + Liste des joueurs dispos)
app.get('/api/state', (req, res) => {
    res.json({
        plan: siegePlan,
        players: Object.keys(guildPlayers)
    });
});

// 2. Importer un JSON de joueur
app.post('/api/import', (req, res) => {
    const { playerName, monsterList } = req.body;
    
    // On ne garde que les champs utiles
    const cleanList = monsterList.map(m => ({
        unit_master_id: m.unit_master_id,
        // Ajoutez ici d'autres stats si besoin (hp, atk, spd...)
    }));

    guildPlayers[playerName] = cleanList;
    console.log(`[IMPORT] Joueur ${playerName} importé (${cleanList.length} monstres).`);
    res.json({ success: true, message: "Import réussi" });
});

// 3. Mettre à jour une défense
app.post('/api/update-defense', (req, res) => {
    const { baseId, slotIndex, player, monsters } = req.body; // monsters = [id1, id2, id3]
    
    if (!siegePlan[baseId]) return res.status(400).json({ error: "Base invalide" });

    // Mise à jour du plan
    siegePlan[baseId][slotIndex] = { player, monsters };
    
    console.log(`[UPDATE] Base ${baseId} Slot ${slotIndex+1} mis à jour.`);
    res.json({ success: true, plan: siegePlan });
});

// 4. Recherche de monstres d'un joueur (pour le frontend)
app.get('/api/player-monsters/:playerName', (req, res) => {
    const { playerName } = req.params;
    const monsters = guildPlayers[playerName] || [];
    res.json(monsters);
});

app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
