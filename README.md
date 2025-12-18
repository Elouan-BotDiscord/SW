# SW Siege Planner

Outil de planification de siège pour Summoners War avec support MongoDB et déploiement Vercel.

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Compte MongoDB Atlas (gratuit)
- Compte Vercel (gratuit)

### Installation locale

1. Cloner le repository:
```bash
git clone https://github.com/Elouan-BotDiscord/SW.git
cd SW/Siege
```

2. Installer les dépendances:
```bash
npm install
```

3. Configurer l'environnement:
```bash
cp .env.example .env
# Éditer .env avec votre chaîne de connexion MongoDB
```

4. Lancer le serveur:
```bash
npm start
```

5. Ouvrir dans le navigateur: `http://localhost:3000`

## 📦 Déploiement sur Vercel

Consultez le guide complet: [DEPLOYMENT.md](DEPLOYMENT.md)

**Résumé rapide:**
1. Créer un cluster MongoDB Atlas
2. Obtenir la chaîne de connexion
3. Connecter votre repo GitHub à Vercel
4. Ajouter `MONGODB_URI` dans les variables d'environnement Vercel
5. Déployer!

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Guide complet de déploiement
- **[SUMMARY.md](SUMMARY.md)** - Vue d'ensemble des modifications
- **[Siege/README.md](Siege/README.md)** - Documentation technique

## 🔧 Fonctionnalités

- ✅ Import de joueurs depuis JSON (SW Exporter)
- ✅ Ajout d'invités (guests) pour les mercenaires
- ✅ Planification de 12 bases avec 5 défenses chacune
- ✅ Détection automatique des conflits (monstres utilisés plusieurs fois)
- ✅ Deux modes de workflow: Joueur→Monstres ou Monstres→Joueur
- ✅ Persistance des données avec MongoDB
- ✅ Déployable sur Vercel

## 🛡️ Sécurité

- Rate limiting (100 requêtes/15min)
- Toutes les dépendances vérifiées
- Variables d'environnement pour les secrets
- Aucune vulnérabilité connue

## 🏗️ Structure technique

```
SW/
├── Siege/
│   ├── config/          # Configuration MongoDB
│   ├── models/          # Modèles Mongoose
│   ├── server.js        # API Express.js
│   ├── app.js           # Frontend JavaScript
│   └── index.html       # Interface utilisateur
├── vercel.json          # Configuration Vercel
└── DEPLOYMENT.md        # Guide de déploiement
```

## 🤝 Contribuer

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou une pull request.

## 📝 Licence

Ce projet est open source.