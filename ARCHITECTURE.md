# Architecture du SW Siege Planner

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ index.html   │  │   app.js     │  │  mapping.js  │     │
│  │ (Interface)  │  │  (Logique)   │  │  (Données)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                VERCEL (Serverless Platform)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    server.js                         │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Express.js + Rate Limiting                    │ │  │
│  │  │  ┌──────────────────────────────────────────┐  │ │  │
│  │  │  │  API Routes:                             │  │ │  │
│  │  │  │  - GET  /api/state                       │  │ │  │
│  │  │  │  - POST /api/import                      │  │ │  │
│  │  │  │  - POST /api/update-defense              │  │ │  │
│  │  │  │  - GET  /api/player-monsters/:name       │  │ │  │
│  │  │  │  - POST /api/add-guest                   │  │ │  │
│  │  │  │  - DELETE /api/remove-guest/:name        │  │ │  │
│  │  │  └──────────────────────────────────────────┘  │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │                         │                            │  │
│  │       ┌─────────────────┴─────────────────┐         │  │
│  │       │                                   │         │  │
│  │       ▼                                   ▼         │  │
│  │  ┌──────────┐                      ┌──────────┐    │  │
│  │  │ models/  │                      │ config/  │    │  │
│  │  │ Player   │                      │ database │    │  │
│  │  │ SiegePlan│                      └──────────┘    │  │
│  │  └──────────┘                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Mongoose ODM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MongoDB Atlas (Cloud Database)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Collection: players                                 │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ { playerName, monsters[], isGuest }            │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  Collection: siegeplans                              │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ { planId: "current",                           │  │  │
│  │  │   bases: Map {                                 │  │  │
│  │  │     "1": [slot1, slot2, ... slot5],            │  │  │
│  │  │     ...                                        │  │  │
│  │  │     "12": [slot1, slot2, ... slot5]            │  │  │
│  │  │   }                                            │  │  │
│  │  │ }                                              │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Flux de données

### 1. Chargement initial
```
Browser → GET /api/state → Server → MongoDB → Retour données → Browser
```

### 2. Import d'un joueur
```
Browser → POST /api/import (JSON) → Server → MongoDB (upsert Player) → Success
```

### 3. Mise à jour d'une défense
```
Browser → POST /api/update-defense → Server → MongoDB (update SiegePlan) → Success
```

### 4. Ajout d'un guest
```
Browser → POST /api/add-guest → Server → MongoDB (create Player avec isGuest=true) → Success
```

## Modèles de données

### Player Schema
```javascript
{
  playerName: String (unique),
  monsters: [
    {
      unit_master_id: Number
    }
  ],
  isGuest: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### SiegePlan Schema
```javascript
{
  planId: "current" (unique),
  bases: Map<String, Array<Slot>>,
  // bases["1"] à bases["12"]
  createdAt: Date,
  updatedAt: Date
}

// Slot structure:
{
  player: String | null,
  monsters: [Number, Number, Number]  // 3 monster IDs
}
```

## Sécurité

### Couches de protection

1. **Rate Limiting**: 100 requêtes/15min par IP
2. **Input Validation**: Validation Mongoose des données
3. **Environment Variables**: Secrets externalisés (MONGODB_URI)
4. **Dependencies**: Toutes les dépendances sans vulnérabilités connues

### Variables d'environnement

- `MONGODB_URI`: Chaîne de connexion MongoDB Atlas
- `PORT`: Port du serveur (défaut: 3000)
- `NODE_ENV`: Environnement (production/development)
- `VERCEL`: Détection automatique de l'environnement Vercel

## Performance

### Optimisations

1. **Connection Pooling**: Réutilisation des connexions MongoDB
2. **Serverless Ready**: Gestion appropriée du cycle de vie
3. **Minimal Queries**: Une requête par opération
4. **Indexes**: playerName unique pour recherche rapide

### Scalabilité

- Serverless functions (auto-scaling)
- MongoDB Atlas (auto-scaling cluster)
- CDN pour fichiers statiques (Vercel)
- Rate limiting pour protection contre les abus

## Déploiement

### Variables requises dans Vercel

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/sw-siege-planner
```

### Configuration automatique

Le fichier `vercel.json` configure:
- Routes API vers le serveur Node.js
- Fichiers statiques servis directement
- Build du projet Node.js

## Monitoring

### Logs disponibles

1. **Vercel Function Logs**: Erreurs serveur, requêtes API
2. **MongoDB Atlas Logs**: Requêtes DB, performances
3. **Browser Console**: Erreurs frontend

### Points de surveillance

- Temps de réponse API
- Erreurs de connexion MongoDB
- Utilisation de rate limiting
- Taille de la base de données

## Maintenance

### Backup

MongoDB Atlas offre:
- Backups automatiques quotidiens
- Point-in-time restore
- Snapshots manuels disponibles

### Mises à jour

1. Pusher les changements sur GitHub
2. Vercel redéploie automatiquement
3. Pas de downtime (déploiement progressif)

## Support

Pour toute question:
- Documentation: README.md, DEPLOYMENT.md
- Logs: Vercel Dashboard
- Database: MongoDB Atlas Dashboard
