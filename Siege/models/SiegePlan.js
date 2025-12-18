const mongoose = require('mongoose');

// Schéma pour un slot de défense
const slotSchema = new mongoose.Schema({
    player: {
        type: String,
        default: null
    },
    monsters: {
        type: [Number],
        default: []
    }
}, { _id: false });

// Schéma pour une base
const baseSchema = new mongoose.Schema({
    baseId: {
        type: Number,
        required: true
    },
    slots: {
        type: [slotSchema],
        default: []
    }
}, { _id: false });

// Schéma principal pour le plan de siège
const siegePlanSchema = new mongoose.Schema({
    // Utiliser un seul document avec un ID fixe pour le plan actuel
    planId: {
        type: String,
        default: 'current',
        unique: true
    },
    bases: {
        type: Map,
        of: [slotSchema],
        default: new Map()
    }
}, {
    timestamps: true
});

// Méthode statique pour obtenir ou créer le plan actuel
siegePlanSchema.statics.getCurrentPlan = async function() {
    let plan = await this.findOne({ planId: 'current' });
    
    if (!plan) {
        // Créer un nouveau plan avec 12 bases, chacune ayant 5 slots vides
        const bases = new Map();
        for (let i = 1; i <= 12; i++) {
            bases.set(String(i), Array(5).fill(null).map(() => ({ player: null, monsters: [] })));
        }
        
        plan = await this.create({
            planId: 'current',
            bases: bases
        });
    }
    
    return plan;
};

module.exports = mongoose.model('SiegePlan', siegePlanSchema);
