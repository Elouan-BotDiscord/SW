# SW Siege Planner

Outil de planification de siège pour Summoners War avec support MongoDB.

## Installation

1. Installer les dépendances:
```bash
npm install
```

2. Configurer les variables d'environnement:
   - Copier `.env.example` vers `.env`
   - Modifier `MONGODB_URI` avec votre chaîne de connexion MongoDB

## Configuration MongoDB

### MongoDB Atlas (Cloud)

1. Créer un compte sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créer un nouveau cluster (version gratuite disponible)
3. Créer un utilisateur de base de données
4. Autoriser les connexions depuis n'importe quelle adresse IP (0.0.0.0/0) pour Vercel
5. Récupérer la chaîne de connexion et la mettre dans `.env`

Format de connexion:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/sw-siege-planner?retryWrites=true&w=majority
```

### MongoDB Local

Pour le développement local:
```
MONGODB_URI=mongodb://localhost:27017/sw-siege-planner
```

## Lancement en développement

```bash
npm start
```

L'application sera accessible sur `http://localhost:3000`

## Déploiement sur Vercel

1. Créer un compte sur [Vercel](https://vercel.com)
2. Installer Vercel CLI:
```bash
npm i -g vercel
```

3. Se connecter à Vercel:
```bash
vercel login
```

4. Déployer l'application:
```bash
vercel
```

5. Configurer les variables d'environnement dans le dashboard Vercel:
   - Aller dans les paramètres du projet
   - Ajouter `MONGODB_URI` avec votre chaîne de connexion MongoDB Atlas

## Structure de la base de données

### Collection `players`
Stocke les joueurs de guilde et les guests avec leurs monstres.

```javascript
{
  playerName: String,
  monsters: [{ unit_master_id: Number }],
  isGuest: Boolean
}
```

### Collection `siegeplans`
Stocke le plan de siège actuel avec les 12 bases.

```javascript
{
  planId: "current",
  bases: Map {
    "1": [{ player: String, monsters: [Number] }],
    ...
    "12": [{ player: String, monsters: [Number] }]
  }
}
```

## API Endpoints

- `GET /api/state` - Récupérer l'état actuel (plan + joueurs)
- `POST /api/import` - Importer un JSON de joueur
- `POST /api/update-defense` - Mettre à jour une défense
- `GET /api/player-monsters/:playerName` - Récupérer les monstres d'un joueur
- `POST /api/add-guest` - Ajouter un invité
- `DELETE /api/remove-guest/:guestName` - Supprimer un invité
