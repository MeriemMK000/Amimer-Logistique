# FleetPro — Amimer Logistique

Application complète de gestion de flotte : **Next.js (React)** + **NestJS** + **PostgreSQL**.
Portage intégral de la maquette FleetPro v8 (16 modules).

## Prérequis
- Node.js 20+
- Docker (pour PostgreSQL)

## Démarrage

```bash
# 1. Base de données (PostgreSQL sur le port hôte 5435)
docker compose up -d postgres

# 2. Backend  →  http://localhost:3001/api   (Swagger : /api/docs)
cd backend
npm install
npm run seed          # charge les données de démonstration
npm run start:dev

# 3. Frontend →  http://localhost:3000
cd ../frontend
npm install
npm run dev
```

Variable d'environnement frontend (optionnelle) : `NEXT_PUBLIC_API_URL` (défaut `http://localhost:3001/api`).

## Modules

Tableau de bord · Flotte · Chauffeurs · Missions · Demandes PEC · Planification ·
Maintenance · Carburant · Contrôle Individuel · Location & Coûts · Facturation BU ·
Carte GPS · Alertes · Paramètres · Barème Frais · Rapports.

## Architecture

| | |
|---|---|
| `backend/` | NestJS + TypeORM. 15 ressources CRUD REST + `/config` (clé/valeur). `src/seed-data.json` = données v8 figées. Pas d'authentification. |
| `frontend/` | Next.js App Router. `src/lib/fleet/` = logique métier (barème, consommation, scoring, coûts BU…). `src/components/charts/` = graphiques `<canvas>`. Carte via `react-leaflet`. React Query pour les données. |
| PostgreSQL | conteneur `fleet-postgres`, `fleet_manager`, port hôte **5435**. |

## Réinitialiser la base

```bash
docker exec fleet-postgres psql -U postgres -d fleet_manager -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd backend && npm run start:dev   # recrée le schéma (synchronize)
# puis, dans un autre terminal : npm run seed
```
