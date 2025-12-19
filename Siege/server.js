require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const Player = require('./models/Player');
const SiegePlan = require('./models/SiegePlan');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('.'));
app.use(bodyParser.json({ limit: '50mb' }));

// Configuration du rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limite chaque IP à 100 requêtes par fenêtre
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Appliquer le rate limiting à toutes les routes API
app.use('/api/', limiter);

// Connexion à MongoDB
connectDB();

// --- API ---

// 1. Récupérer l'état actuel (Plan + Liste des joueurs dispos)
app.get('/api/state', async (req, res) => {
    try {
        // Récupérer tous les joueurs
        const players = await Player.find({});
        
        // Séparer joueurs normaux et guests
        const guildPlayers = players.filter(p => !p.isGuest);
        const guestPlayers = players.filter(p => p.isGuest);
        
        // Créer la liste des joueurs avec marqueur
        const playersWithGuests = [
            ...guildPlayers.map(p => ({ name: p.playerName, isGuest: false })),
            ...guestPlayers.map(p => ({ name: p.playerName, isGuest: true }))
        ];
        
        // Récupérer le plan de siège
        const siegePlan = await SiegePlan.getCurrentPlan();
        
        // Convertir Map en objet pour JSON
        const planObj = {};
        siegePlan.bases.forEach((value, key) => {
            planObj[key] = value;
        });
        
        res.json({
            plan: planObj,
            players: playersWithGuests,
            guests: guestPlayers.map(p => p.playerName)
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

        // Créer ou mettre à jour le joueur
        await Player.findOneAndUpdate(
            { playerName },
            { playerName, monsters: cleanList, isGuest: false },
            { upsert: true, new: true }
        );

        console.log(`[IMPORT] Joueur ${playerName} importé (${cleanList.length} monstres).`);
        res.json({ success: true, message: "Import réussi" });
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        res.status(500).json({ error: 'Erreur lors de l\'import' });
    }
});

// 3. Mettre à jour une défense
app.post('/api/update-defense', async (req, res) => {
    try {
        const { baseId, slotIndex, player, monsters } = req.body; // monsters = [id1, id2, id3]
        
        const siegePlan = await SiegePlan.getCurrentPlan();
        
        const baseKey = String(baseId);
        if (!siegePlan.bases.has(baseKey)) {
            return res.status(400).json({ error: "Base invalide" });
        }

        // Mise à jour du slot
        const baseSlots = siegePlan.bases.get(baseKey);
        if (slotIndex >= 0 && slotIndex < baseSlots.length) {
            baseSlots[slotIndex] = { player, monsters };
            siegePlan.bases.set(baseKey, baseSlots);
            
            // Sauvegarder dans la base de données
            await siegePlan.save();
            
            console.log(`[UPDATE] Base ${baseId} Slot ${slotIndex+1} mis à jour.`);
            
            // Convertir Map en objet pour JSON
            const planObj = {};
            siegePlan.bases.forEach((value, key) => {
                planObj[key] = value;
            });
            
            res.json({ success: true, plan: planObj });
        } else {
            res.status(400).json({ error: "Index de slot invalide" });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// 4. Recherche de monstres d'un joueur (pour le frontend)
app.get('/api/player-monsters/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        
        const player = await Player.findOne({ playerName });
        
        if (!player) {
            return res.json([]);
        }
        
        // Si c'est un guest, retourner un marqueur spécial
        if (player.isGuest) {
            res.json({ isGuest: true, monsters: [] });
            return;
        }
        
        res.json(player.monsters || []);
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
        
        // Vérifier si un joueur (guest ou normal) existe déjà avec ce nom
        const existingPlayer = await Player.findOne({ playerName: guestName });
        
        if (existingPlayer) {
            if (existingPlayer.isGuest) {
                return res.status(400).json({ error: "Ce guest existe déjà" });
            } else {
                return res.status(400).json({ error: "Un joueur avec ce nom existe déjà" });
            }
        }
        
        // Créer le guest
        await Player.create({
            playerName: guestName,
            monsters: [],
            isGuest: true
        });
        
        console.log(`[ADD GUEST] Guest ${guestName} ajouté.`);
        
        // Récupérer la liste mise à jour des guests
        const guests = await Player.find({ isGuest: true });
        
        res.json({ 
            success: true, 
            message: "Guest ajouté avec succès",
            guests: guests.map(g => g.playerName)
        });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du guest:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du guest' });
    }
});

// 6. Supprimer un guest
app.delete('/api/remove-guest/:guestName', async (req, res) => {
    try {
        const { guestName } = req.params;
        
        const guest = await Player.findOne({ playerName: guestName, isGuest: true });
        
        if (!guest) {
            return res.status(404).json({ error: "Guest non trouvé" });
        }
        
        // Nettoyer les assignations de ce guest dans le plan de siège
        const siegePlan = await SiegePlan.getCurrentPlan();
        let modified = false;
        
        siegePlan.bases.forEach((slots, baseId) => {
            let baseModified = false;
            slots.forEach((slot, index) => {
                if (slot.player === guestName) {
                    slots[index] = { player: null, monsters: [] };
                    baseModified = true;
                    modified = true;
                }
            });
            // Ne mettre à jour que les bases modifiées
            if (baseModified) {
                siegePlan.bases.set(baseId, slots);
            }
        });
        
        // Sauvegarder seulement si des modifications ont été faites
        if (modified) {
            await siegePlan.save();
        }
        
        // Supprimer le guest
        await Player.deleteOne({ playerName: guestName, isGuest: true });
        
        console.log(`[REMOVE GUEST] Guest ${guestName} supprimé.`);
        
        // Récupérer la liste mise à jour des guests
        const guests = await Player.find({ isGuest: true });
        
        res.json({ 
            success: true, 
            message: "Guest supprimé avec succès",
            guests: guests.map(g => g.playerName)
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du guest:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du guest' });
    }
});

// Démarrer le serveur seulement en local (pas sur Vercel)
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
}

// Export pour Vercel serverless functions
module.exports = app;
