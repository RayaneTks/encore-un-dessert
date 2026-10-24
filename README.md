# Encore 1 Dessert — Gestion d’une pâtisserie

Application métier conçue pour une pâtisserie artisanale : calcul des coûts de fabrication, préparation des commandes et suivi des ventes. L’interface privilégie l’usage sur téléphone et peut être installée comme application web progressive (PWA).

L’application est destinée à un usage interne ; le caractère public du dépôt ne donne pas accès aux données métier.

## Fonctionnalités

- Gestion des ingrédients, des préparations et des desserts.
- Calcul des coûts et recalcul lors de la modification du prix d’un ingrédient.
- Mise à l’échelle des recettes et organisation de la production.
- Suivi des commandes et de leur livraison.
- Enregistrement des ventes avec conservation des prix au moment de la vente.

## Technologies

React 19 · TypeScript · Vite · Tailwind CSS 4 · Motion · Supabase (PostgreSQL).

## Installation

```bash
git clone https://github.com/RayaneTks/encore-un-dessert.git
cd encore-un-dessert
npm ci
cp .env.example .env
npm run dev
```

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les valeurs d’un projet Supabase dédié au développement. Utiliser l’URL indiquée par Vite dans le terminal.

Les évolutions SQL versionnées sont dans [`supabase/migrations/`](supabase/migrations/). Pour une nouvelle base, vérifier également le schéma attendu par [`src/lib/db.ts`](src/lib/db.ts) ; les migrations présentes ne remplacent pas nécessairement une initialisation complète.

## Commandes

```bash
npm run lint     # Vérifier les types TypeScript
npm run build    # Vérifier les types et compiler
npm run preview  # Prévisualiser la version compilée
```

## Organisation

| Chemin | Rôle |
|---|---|
| `src/screens/` | Écrans métier : caisse, atelier, commandes et ventes. |
| `src/components/` | Navigation, formulaires et composants partagés. |
| `src/lib/` | Calculs, règles métier et accès aux données. |
| `src/types/` | Modèles TypeScript. |
| `public/` | Manifestes, icônes et service worker de la PWA. |

## Documentation

Consulter [`CLAUDE.md`](CLAUDE.md) pour l’architecture, les règles de calcul et la conservation de l’historique des ventes.
