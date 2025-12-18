const mongoose = require('mongoose');

// Schéma pour les monstres d'un joueur
const monsterSchema = new mongoose.Schema({
    unit_master_id: {
        type: Number,
        required: true
    }
}, { _id: false });

// Schéma pour les joueurs de guilde
const playerSchema = new mongoose.Schema({
    playerName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    monsters: [monsterSchema],
    isGuest: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Player', playerSchema);
