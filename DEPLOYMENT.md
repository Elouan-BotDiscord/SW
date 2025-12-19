# Guide de déploiement sur Vercel avec MongoDB Atlas

Ce guide vous explique comment déployer votre application SW Siege Planner sur Vercel avec MongoDB Atlas.

## Étape 1: Configuration de MongoDB Atlas

### 1.1 Créer un compte MongoDB Atlas

1. Allez sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Cliquez sur "Start Free" et créez un compte
3. Connectez-vous à votre compte

### 1.2 Créer un cluster

1. Cliquez sur "Create" pour créer un nouveau cluster
2. Sélectionnez l'option gratuite (M0 Sandbox)
3. Choisissez votre région (de préférence proche de vos utilisateurs)
4. Nommez votre cluster et cliquez sur "Create Cluster"
5. Attendez que le cluster soit créé (peut prendre quelques minutes)

### 1.3 Créer un utilisateur de base de données

1. Dans le menu de gauche, cliquez sur "Database Access"
2. Cliquez sur "Add New Database User"
3. Choisissez "Password" comme méthode d'authentification
4. Entrez un nom d'utilisateur et un mot de passe **sécurisé** (sauvegardez-les!)
5. Dans "Database User Privileges", sélectionnez "Read and write to any database"
6. Cliquez sur "Add User"

### 1.4 Configurer l'accès réseau

1. Dans le menu de gauche, cliquez sur "Network Access"
2. Cliquez sur "Add IP Address"
3. Sélectionnez "Allow Access from Anywhere" (0.0.0.0/0)
   - Ceci est nécessaire pour Vercel car les adresses IP changent
4. Cliquez sur "Confirm"

### 1.5 Obtenir la chaîne de connexion

1. Retournez à "Database" dans le menu de gauche
2. Cliquez sur "Connect" sur votre cluster
3. Sélectionnez "Connect your application"
4. Copiez la chaîne de connexion
5. Remplacez `<password>` par le mot de passe de votre utilisateur
6. Remplacez `<dbname>` par `sw-siege-planner` (ou le nom que vous voulez)

Exemple de chaîne de connexion:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sw-siege-planner?retryWrites=true&w=majority
```

## Étape 2: Déploiement sur Vercel

### 2.1 Créer un compte Vercel

1. Allez sur [Vercel](https://vercel.com)
2. Cliquez sur "Sign Up"
3. Connectez-vous avec votre compte GitHub (recommandé)

### 2.2 Importer le projet

1. Sur le dashboard Vercel, cliquez sur "Add New Project"
2. Sélectionnez votre repository GitHub "Elouan-BotDiscord/SW"
3. Vercel détectera automatiquement la configuration grâce au fichier `vercel.json`

### 2.3 Configurer les variables d'environnement

**IMPORTANT**: Avant de déployer, vous devez configurer la variable d'environnement!

1. Dans la page de configuration du projet, trouvez la section "Environment Variables"
2. Ajoutez une nouvelle variable:
   - Name: `MONGODB_URI`
   - Value: Collez votre chaîne de connexion MongoDB Atlas complète
3. Assurez-vous que la variable est disponible pour tous les environnements (Production, Preview, Development)

### 2.4 Déployer

1. Cliquez sur "Deploy"
2. Attendez que le déploiement soit terminé (quelques minutes)
3. Vercel vous donnera une URL de production (ex: `https://sw-xxxxx.vercel.app`)

## Étape 3: Vérification

1. Ouvrez l'URL de votre application
2. Testez les fonctionnalités:
   - Import de joueurs
   - Ajout de guests
   - Création de défenses
   - Vérifiez que les données persistent après un rafraîchissement de la page

## Dépannage

### Erreur "Cannot GET /"

Cette erreur a été corrigée dans la dernière version. Si vous rencontrez toujours cette erreur:
- Assurez-vous d'utiliser la dernière version du code
- Vérifiez que le déploiement Vercel a réussi sans erreurs
- Regardez les logs Vercel pour voir s'il y a des erreurs de démarrage

### Erreur de connexion MongoDB

Si vous voyez "Erreur de connexion MongoDB":
- Vérifiez que la chaîne de connexion est correcte
- Assurez-vous que le mot de passe ne contient pas de caractères spéciaux non encodés
- Vérifiez que l'accès réseau (0.0.0.0/0) est bien configuré dans MongoDB Atlas

### L'application ne démarre pas

- Vérifiez les logs Vercel dans la section "Deployments" > "Function Logs"
- Assurez-vous que toutes les dépendances sont dans `package.json`

### Les données ne persistent pas

- Vérifiez que `MONGODB_URI` est bien configurée dans Vercel
- Regardez les logs pour voir s'il y a des erreurs de connexion

### Erreur 404 pour app.js et mapping.js (boutons ne fonctionnent pas)

Si vous voyez des erreurs 404 dans les logs Vercel pour `/app.js` et `/mapping.js` et que les boutons ne fonctionnent pas:
- Cette erreur a été corrigée dans la configuration `vercel.json`
- Assurez-vous d'utiliser la dernière version du code
- Le fichier `vercel.json` doit contenir des routes explicites pour `app.js` et `mapping.js` avant la route catch-all
- Redéployez l'application après avoir mis à jour `vercel.json`

## Mise à jour de l'application

Pour mettre à jour votre application:
1. Poussez vos changements sur GitHub
2. Vercel redéploiera automatiquement votre application

## Support

Pour plus d'informations:
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [Documentation Mongoose](https://mongoosejs.com/docs/)
