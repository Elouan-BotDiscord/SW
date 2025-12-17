# SW Siege Planner - MongoDB Version

Outil de planification de siège pour Summoners War avec support MongoDB.

## Prérequis

- Node.js (v14 ou supérieur)
- MongoDB (v4.4 ou supérieur)

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Installer MongoDB :
   - **Ubuntu/Debian** : `sudo apt-get install mongodb`
   - **macOS** : `brew install mongodb-community`
   - **Windows** : Télécharger depuis [mongodb.com](https://www.mongodb.com/try/download/community)
   - **Docker** : `docker run -d -p 27017:27017 --name mongodb mongo:latest`

## Configuration

La connexion MongoDB peut être configurée via la variable d'environnement `MONGODB_URI`.

Par défaut, l'application se connecte à `mongodb://localhost:27017`.

### Configuration avec fichier .env

1. Copier le fichier d'exemple :
```bash
cp .env.example .env
```

2. Éditer `.env` avec vos paramètres :
```
MONGODB_URI=mongodb://localhost:27017
PORT=3000
```

### Exemples de configuration

**Local par défaut (avec .env) :**
```bash
npm start
```

**Avec une URI personnalisée (ligne de commande) :**
```bash
MONGODB_URI="mongodb://localhost:27017" npm start
```

**Avec MongoDB Atlas (cloud) :**
```bash
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net" npm start
```

## Démarrage

```bash
npm start
```

L'application sera accessible sur http://localhost:3000

## Structure de la base de données

L'application utilise la base de données `sw_siege_planner` avec les collections suivantes :

### Collection `guildPlayers`
Stocke les joueurs de la guilde et leurs monstres.
```json
{
  "playerName": "Pseudo",
  "monsters": [
    { "unit_master_id": 12345 },
    { "unit_master_id": 67890 }
  ]
}
```

### Collection `guestPlayers`
Stocke les joueurs invités (guests).
```json
{
  "guestName": "GuestPseudo"
}
```

### Collection `siegePlan`
Stocke le plan de siège (12 bases avec 5 emplacements chacune).
```json
{
  "_id": "current",
  "plan": {
    "1": [
      { "player": "Pseudo", "monsters": [12345, 67890, 11111] },
      { "player": null, "monsters": [] },
      ...
    ],
    ...
  }
}
```

## Fonctionnalités

- ✅ Import de JSON de joueurs (format SW Exporter)
- ✅ Gestion des joueurs invités (guests)
- ✅ Planification de défenses pour 12 bases
- ✅ Détection des conflits (monstres déjà utilisés)
- ✅ Deux modes de workflow : Joueur → Monstres ou Monstres → Joueur
- ✅ **Persistance des données avec MongoDB**

## Migration depuis la version en mémoire

Si vous utilisez la version précédente avec stockage en mémoire, les données seront perdues lors du passage à MongoDB. Vous devrez réimporter vos joueurs via l'interface d'import JSON.

## Développement

Pour développer avec MongoDB local :

1. Démarrer MongoDB :
```bash
# Linux/macOS
sudo systemctl start mongodb
# ou
mongod

# Docker
docker start mongodb
```

2. Lancer le serveur en mode développement :
```bash
npm start
```

## Dépannage

**Erreur de connexion MongoDB :**
- Vérifier que MongoDB est démarré
- Vérifier l'URI de connexion
- Vérifier les permissions réseau/firewall

**Port déjà utilisé :**
- Le port 3000 est utilisé par défaut. Modifier la variable `PORT` dans `server.js` si nécessaire.

## Sécurité

### Recommandations pour la production

Si vous déployez cette application en production, considérez les améliorations de sécurité suivantes :

1. **Rate Limiting** : Ajoutez une limitation du taux de requêtes pour prévenir les abus
   ```bash
   npm install express-rate-limit
   ```

2. **Authentification** : Ajoutez une couche d'authentification pour protéger l'accès à l'application

3. **HTTPS** : Utilisez HTTPS en production avec un certificat SSL/TLS

4. **Validation des entrées** : Renforcez la validation des données d'entrée

5. **MongoDB** : 
   - Utilisez des credentials MongoDB sécurisés
   - Activez l'authentification MongoDB
   - Configurez les règles de pare-feu

## Licence

Ce projet est un outil communautaire pour Summoners War.
