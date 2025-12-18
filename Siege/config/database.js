const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('Utilisation de la connexion MongoDB existante');
        return;
    }

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sw-siege-planner';
        
        await mongoose.connect(mongoUri, {
            // Options recommandées pour Mongoose 6+
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isConnected = mongoose.connection.readyState === 1;
        console.log('MongoDB connecté avec succès');
    } catch (error) {
        console.error('Erreur de connexion MongoDB:', error);
        throw error;
    }
};

// Gestion de la déconnexion propre
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Connexion MongoDB fermée');
    process.exit(0);
});

module.exports = connectDB;
