# Management_App
# OctoStock

OctoStock est une application SaaS de gestion de stock et de caisse destinée aux petits commerces, boutiques, pharmacies, supérettes et PME.

L'objectif est de fournir une solution simple, rapide et accessible permettant aux commerçants de suivre leurs stocks, enregistrer leurs ventes et consulter leurs statistiques en temps réel.

---

## Problème

De nombreux commerçants gèrent encore leurs activités à l'aide de :

- Cahiers
- Tableurs Excel
- Calculatrices
- Méthodes manuelles

Cela entraîne :

- Des erreurs de stock
- Des ruptures de produits
- Une mauvaise visibilité des ventes
- Des pertes financières
- Des difficultés à suivre les performances du commerce

---

## Objectifs du projet

Permettre à un commerçant de :

- Gérer ses produits
- Gérer ses catégories
- Enregistrer ses ventes
- Mettre à jour automatiquement son stock
- Consulter son chiffre d'affaires
- Identifier rapidement les produits en rupture

---

## Technologies utilisées

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI

### Backend

- NestJS
- JWT Authentication

### Base de données

- PostgreSQL
- Prisma ORM

### Outils

- Git
- GitHub
- Docker (à venir)

---

## Fonctionnalités V1

### Authentification

- Connexion administrateur
- Gestion sécurisée des sessions

### Gestion des catégories

- Ajouter une catégorie
- Modifier une catégorie
- Supprimer une catégorie

### Gestion des produits

- Ajouter un produit
- Modifier un produit
- Supprimer un produit
- Consulter le stock disponible

### Gestion des ventes

- Créer une vente
- Ajouter plusieurs produits
- Décrémentation automatique du stock

### Tableau de bord

- Nombre de ventes
- Chiffre d'affaires journalier
- Produits en stock faible
- Nombre total de produits

---

## Fonctionnalités futures

### V2

- Gestion des fournisseurs
- Gestion des dépenses
- Gestion des rôles
- Rapports PDF
- Export Excel
- Alertes de stock

### V3

- Multi-boutiques
- Notifications WhatsApp
- Mobile Money
- Application mobile
- Gestion des crédits clients

---

## Modèle de données

### User

- id
- fullname
- email
- password
- role

### Category

- id
- name
- description

### Product

- id
- name
- description
- purchasePrice
- sellingPrice
- quantity
- minimumQuantity

### Sale

- id
- totalAmount
- createdAt

### SaleItem

- id
- quantity
- unitPrice
- subtotal

---

## Architecture

```text

```

---

## État du projet

Version actuelle :

```text
Version 1 en cours
```

Progression :

- [x] Analyse du besoin
- [x] Conception fonctionnelle
- [ ] Initialisation Frontend
- [ ] Initialisation Backend
- [ ] Configuration PostgreSQL
- [ ] Configuration Prisma
- [ ] Authentification
- [ ] Gestion des catégories
- [ ] Gestion des produits
- [ ] Gestion des ventes
- [ ] Dashboard
- [ ] Déploiement

---

## Auteur

Kimberly Degnon

Étudiante en informatique passionnée par le développement logiciel, les systèmes backend et l'entrepreneuriat numérique.

---

## Licence

Projet développé à des fins éducatives et entrepreneuriales.
