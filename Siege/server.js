// Charger les variables d'environnement depuis .env (si le fichier existe)
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('.'));
app.use(bodyParser.json({ limit: '50mb' }));

// --- CONFIGURATION MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'sw_siege_planner';

let db;
let guildPlayersCollection;
let guestPlayersCollection;
let siegePlanCollection;

// Connexion à MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✓ Connecté à MongoDB');
        
        db = client.db(DB_NAME);
        guildPlayersCollection = db.collection('guildPlayers');
        guestPlayersCollection = db.collection('guestPlayers');
        siegePlanCollection = db.collection('siegePlan');
        
        // Initialiser le plan de siège s'il n'existe pas
        await initializeSiegePlan();
    } catch (error) {
        console.error('✗ Erreur de connexion à MongoDB:', error);
        process.exit(1);
    }
}

// Initialiser les 12 bases vides si elles n'existent pas
async function initializeSiegePlan() {
    const existingPlan = await siegePlanCollection.findOne({ _id: 'current' });
    
    if (!existingPlan) {
        const initialPlan = {};
        for (let i = 1; i <= 12; i++) {
            initialPlan[i] = Array(5).fill(null).map(() => ({ player: null, monsters: [] }));
        }
        
        await siegePlanCollection.insertOne({
            _id: 'current',
            plan: initialPlan
        });
        console.log('✓ Plan de siège initialisé');
    }
}

// --- API ---

// 1. Récupérer l'état actuel (Plan + Liste des joueurs dispos)
app.get('/api/state', async (req, res) => {
    try {
        // Récupérer tous les joueurs normaux
        const guildPlayersData = await guildPlayersCollection.find({}).toArray();
        const allPlayers = guildPlayersData.map(p => p.playerName);
        
        // Récupérer tous les guests
        const guestPlayersData = await guestPlayersCollection.find({}).toArray();
        const guests = guestPlayersData.map(g => g.guestName);
        
        // Combiner les joueurs normaux et les guests
        const playersWithGuests = [
            ...allPlayers.map(p => ({ name: p, isGuest: false })),
            ...guests.map(p => ({ name: p, isGuest: true }))
        ];
        
        // Récupérer le plan de siège
        const siegePlanDoc = await siegePlanCollection.findOne({ _id: 'current' });
        const plan = siegePlanDoc ? siegePlanDoc.plan : {};
        
        res.json({
            plan: plan,
            players: playersWithGuests,
            guests: guests
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'état:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 2. Importer un JSON de joueur
app.post('/api/import', async (req, res) => {
    try {
        const { playerName, monsterList } = req.body;
        
        // On ne garde que les champs utiles
        const cleanList = monsterList.map(m => ({
            unit_master_id: m.unit_master_id,
            // Ajoutez ici d'autres stats si besoin (hp, atk, spd...)
        }));

        // Mettre à jour ou insérer le joueur dans MongoDB
        await guildPlayersCollection.updateOne(
            { playerName: playerName },
            { $set: { playerName: playerName, monsters: cleanList } },
            { upsert: true }
        );
        
        console.log(`[IMPORT] Joueur ${playerName} importé (${cleanList.length} monstres).`);
        res.json({ success: true, message: "Import réussi" });
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 3. Mettre à jour une défense
app.post('/api/update-defense', async (req, res) => {
    try {
        const { baseId, slotIndex, player, monsters } = req.body; // monsters = [id1, id2, id3]
        
        // Récupérer le plan actuel
        const siegePlanDoc = await siegePlanCollection.findOne({ _id: 'current' });
        if (!siegePlanDoc || !siegePlanDoc.plan[baseId]) {
            return res.status(400).json({ error: "Base invalide" });
        }

        // Mise à jour du plan
        const updatePath = `plan.${baseId}.${slotIndex}`;
        await siegePlanCollection.updateOne(
            { _id: 'current' },
            { $set: { [updatePath]: { player, monsters } } }
        );
        
        // Récupérer le plan mis à jour
        const updatedDoc = await siegePlanCollection.findOne({ _id: 'current' });
        
        console.log(`[UPDATE] Base ${baseId} Slot ${slotIndex+1} mis à jour.`);
        res.json({ success: true, plan: updatedDoc.plan });
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 4. Recherche de monstres d'un joueur (pour le frontend)
app.get('/api/player-monsters/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        
        // Vérifier si c'est un guest
        const guestPlayer = await guestPlayersCollection.findOne({ guestName: playerName });
        if (guestPlayer) {
            res.json({ isGuest: true, monsters: [] });
            return;
        }
        
        // Récupérer les monstres du joueur
        const player = await guildPlayersCollection.findOne({ playerName: playerName });
        const monsters = player ? player.monsters : [];
        res.json(monsters);
    } catch (error) {
        console.error('Erreur lors de la récupération des monstres:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 5. Ajouter un guest
app.post('/api/add-guest', async (req, res) => {
    try {
        const { guestName } = req.body;
        
        if (!guestName || guestName.trim() === '') {
            return res.status(400).json({ error: "Le nom du guest ne peut pas être vide" });
        }
        
        // Vérifier si le guest existe déjà
        const existingGuest = await guestPlayersCollection.findOne({ guestName: guestName });
        if (existingGuest) {
            return res.status(400).json({ error: "Ce guest existe déjà" });
        }
        
        // Vérifier si un joueur normal existe avec ce nom
        const existingPlayer = await guildPlayersCollection.findOne({ playerName: guestName });
        if (existingPlayer) {
            return res.status(400).json({ error: "Un joueur avec ce nom existe déjà" });
        }
        
        // Ajouter le guest
        await guestPlayersCollection.insertOne({ guestName: guestName });
        console.log(`[ADD GUEST] Guest ${guestName} ajouté.`);
        
        // Récupérer tous les guests
        const allGuests = await guestPlayersCollection.find({}).toArray();
        const guestNames = allGuests.map(g => g.guestName);
        
        res.json({ 
            success: true, 
            message: "Guest ajouté avec succès",
            guests: guestNames
        });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du guest:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 6. Supprimer un guest
app.delete('/api/remove-guest/:guestName', async (req, res) => {
    try {
        const { guestName } = req.params;
        
        // Vérifier si le guest existe
        const existingGuest = await guestPlayersCollection.findOne({ guestName: guestName });
        if (!existingGuest) {
            return res.status(404).json({ error: "Guest non trouvé" });
        }
        
        // Récupérer le plan actuel
        const siegePlanDoc = await siegePlanCollection.findOne({ _id: 'current' });
        if (siegePlanDoc) {
            const plan = siegePlanDoc.plan;
            
            // Nettoyer les assignations de ce guest dans le plan de siège
            for (const [baseId, slots] of Object.entries(plan)) {
                slots.forEach((slot, index) => {
                    if (slot.player === guestName) {
                        plan[baseId][index] = { player: null, monsters: [] };
                    }
                });
            }
            
            // Sauvegarder le plan mis à jour
            await siegePlanCollection.updateOne(
                { _id: 'current' },
                { $set: { plan: plan } }
            );
        }
        
        // Supprimer le guest
        await guestPlayersCollection.deleteOne({ guestName: guestName });
        console.log(`[REMOVE GUEST] Guest ${guestName} supprimé.`);
        
        // Récupérer tous les guests restants
        const allGuests = await guestPlayersCollection.find({}).toArray();
        const guestNames = allGuests.map(g => g.guestName);
        
        res.json({ 
            success: true, 
            message: "Guest supprimé avec succès",
            guests: guestNames
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du guest:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Démarrer le serveur après connexion à MongoDB
connectToMongoDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('Impossible de démarrer le serveur:', error);
    process.exit(1);
});
