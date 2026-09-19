# Dépannage — dépendances manquantes

Si vous voyez des erreurs TypeScript du type "Cannot find module '@nestjs/common'" ou
"Cannot find name 'process'" juste après avoir cloné le dépôt, c'est simplement que
les dépendances npm n'ont pas encore été installées. Pour l'installation complète et
la configuration des variables d'environnement, suivez le README à la racine du
projet, section [Installation](README.md#installation) — ce fichier ne couvre que le
dépannage rapide ci-dessous.

## Backend

```bash
cd backend
npm install          # installe les dépendances et exécute `prisma generate` (postinstall)
```

Erreurs résolues par ce `npm install` :
- `Cannot find module '@nestjs/common'` — dépendances non installées.
- `Cannot find name 'process'` — `@types/node` manquant (installé via `npm install`).
- `Cannot find module 'prisma/config'` / erreurs sur `PrismaService` — le client Prisma doit être généré (`prisma generate`, exécuté automatiquement par `postinstall`).

## Frontend

```bash
cd frontend
npm install
```

## Lancer l'application

```bash
# Backend (NestJS)
cd backend
npm run start:dev   # mode développement avec rechargement à chaud
npm run start:prod  # mode production (après `npm run build`)

# Frontend (Next.js)
cd frontend
npm run dev    # serveur de développement
npm run build  # build de production
npm start      # serveur de production
```

## Variables d'environnement

Ce fichier ne duplique plus la liste des variables : consultez le README, section
[Variables d'environnement](README.md#variables-denvironnement), et copiez
`backend/.env.example` vers `backend/.env` (et `frontend/.env.local.example` vers
`frontend/.env.local`) comme point de départ.
