# Résumé des modifications - Intégration MongoDB

## Vue d'ensemble

Ce projet a été amélioré pour prendre en charge MongoDB comme système de stockage persistant, remplaçant le stockage en mémoire. L'application est maintenant prête pour un déploiement sur Vercel avec MongoDB Atlas.

## Modifications principales

### 1. Architecture de base de données (MongoDB + Mongoose)

#### Modèles créés:
- **`models/Player.js`**: Gère les joueurs de guilde et les invités (guests)
  - Stocke le nom du joueur, sa liste de monstres et son statut (guest ou non)
  
- **`models/SiegePlan.js`**: Gère le plan de siège complet
  - 12 bases avec 5 slots chacune
  - Méthode statique `getCurrentPlan()` pour obtenir/créer le plan actuel

#### Configuration:
- **`config/database.js`**: Gestion de la connexion MongoDB
  - Réutilisation de connexion pour les environnements serverless
  - Support des variables d'environnement
  - Gestion propre de la déconnexion (non-serverless uniquement)

### 2. Migration du code serveur

#### Refactorisation de `server.js`:
Toutes les routes API ont été converties pour utiliser MongoDB et correctement configurées pour Vercel:

1. **GET `/api/state`**: Récupère l'état complet depuis MongoDB
2. **POST `/api/import`**: Importe/met à jour un joueur dans MongoDB
3. **POST `/api/update-defense`**: Met à jour une défense et la sauvegarde
4. **GET `/api/player-monsters/:playerName`**: Récupère les monstres d'un joueur
5. **POST `/api/add-guest`**: Ajoute un guest dans MongoDB
6. **DELETE `/api/remove-guest/:guestName`**: Supprime un guest et nettoie les assignations

#### Compatibilité Vercel serverless:
- **Export du module**: `module.exports = app` pour les fonctions serverless
- **Conditionnement de app.listen()**: N'écoute que localement (`!process.env.VERCEL`)
- **Correction du bug "Cannot GET /"**: L'app est maintenant correctement exportée pour Vercel

#### Améliorations de sécurité:
- **Rate limiting**: Protection contre les abus (100 requêtes/15min par IP)
- **Mise à jour de body-parser**: Version 1.20.3 (correction de vulnérabilité DoS)
- **Variables d'environnement**: Informations sensibles externalisées

### 3. Configuration de déploiement

#### Vercel:
- **`vercel.json`**: Configuration pour déploiement serverless
  - Routes API dirigées vers le serveur Node.js
  - Fichiers statiques servis directement

#### Variables d'environnement:
- **`.env.example`**: Template pour la configuration
- **`MONGODB_URI`**: Chaîne de connexion MongoDB (Atlas ou local)
- **`PORT`**: Port du serveur (optionnel, défaut: 3000)

### 4. Documentation

#### Fichiers créés:
1. **`DEPLOYMENT.md`**: Guide complet de déploiement
   - Configuration MongoDB Atlas étape par étape
   - Configuration Vercel
   - Résolution de problèmes

2. **`Siege/README.md`**: Documentation technique
   - Installation et configuration
   - Structure de la base de données
   - Liste des endpoints API

3. **`SUMMARY.md`**: Ce fichier - vue d'ensemble du projet

### 5. Optimisations de code

- Utilisation de `Array.from()` au lieu de `Array.fill().map()`
- Optimisation des opérations Map (mise à jour conditionnelle)
- Gestion appropriée du cycle de vie dans les environnements serverless

## Structure finale du projet

```
SW/
├── .gitignore                   # Mis à jour avec .env
├── DEPLOYMENT.md                # Guide de déploiement
├── SUMMARY.md                   # Ce fichier
├── vercel.json                  # Configuration Vercel
└── Siege/
    ├── .env.example             # Template de configuration
    ├── README.md                # Documentation technique
    ├── package.json             # Dépendances mises à jour
    ├── server.js                # Serveur avec MongoDB
    ├── index.html               # Interface utilisateur
    ├── app.js                   # Logique frontend
    ├── mapping.js               # Mapping des monstres
    ├── config/
    │   └── database.js          # Configuration MongoDB
    └── models/
        ├── Player.js            # Modèle joueur
        └── SiegePlan.js         # Modèle plan de siège
```

## Dépendances ajoutées

- **`mongoose`** (9.0.2): ODM MongoDB
- **`dotenv`** (17.2.3): Gestion variables d'environnement
- **`express-rate-limit`** (8.2.1): Rate limiting pour sécurité
- **`body-parser`** (mis à jour vers 1.20.3): Parsing requêtes HTTP

## Prochaines étapes pour le déploiement

1. **Créer un cluster MongoDB Atlas** (gratuit)
2. **Obtenir la chaîne de connexion MongoDB**
3. **Créer un projet Vercel** lié au repository GitHub
4. **Configurer `MONGODB_URI`** dans les variables d'environnement Vercel
5. **Déployer** - Vercel détectera automatiquement la configuration

Voir `DEPLOYMENT.md` pour les instructions détaillées.

## Sécurité

✅ Toutes les vulnérabilités connues corrigées
✅ Rate limiting activé sur toutes les routes API
✅ Pas d'informations sensibles dans le code
✅ Variables d'environnement pour les secrets
✅ Validation des entrées utilisateur

## Tests recommandés

Avant la mise en production, tester:
1. Import de joueurs avec JSON
2. Ajout/suppression de guests
3. Création et modification de défenses
4. Persistance des données après redémarrage
5. Gestion des erreurs de connexion MongoDB

## Support

Pour toute question ou problème:
- Consulter `DEPLOYMENT.md` pour le guide de déploiement
- Consulter `Siege/README.md` pour la documentation technique
- Vérifier les logs Vercel en cas d'erreur de déploiement
- Vérifier les logs MongoDB Atlas pour les problèmes de connexion
