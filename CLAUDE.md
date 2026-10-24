# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📱 Project Philosophy & Design Directives (iOS App Focus)

This application is a **mobile-first iOS utility** for artisanal pastry cost management. It replaces Excel for tracking raw material costs, recipe compositions, dessert pricing, and sales accounting.

**Key Design Principles:**
1.  **Mobile-First/iOS Shell:** Fixed 430px container with safe area insets. Bottom navigation bar always sticky.
2.  **Apple Gourmand Design System:** Palette `gourmand-*` in `src/index.css` — Chocolate (#241309), Strawberry (#B83232), Biscuit (#9B7558), Caramel (#C05621), Cream (#FDF8F2). UI rules: `.claude/skills/ui-encore`.
3.  **UX:** Smooth Framer Motion transitions. Every entity clickable/editable. Toast notifications for feedback. ConfirmDialog for destructive actions.
4.  **Data Architecture:** All types in `src/types/index.ts`. History entries use immutable snapshots with resolved names and frozen prices.

## 🏗️ Architecture Overview

* **Stack:** React 19 + TypeScript + Tailwind CSS v4 + Framer Motion + Lucide React
* **Config:** `vite.config.ts`, `tsconfig.json` (strict mode, src-scoped)
* **Data Persistence:** Supabase (PostgreSQL). No localStorage for data — only for notification schedule (`e1d_notif_schedule_v1`).

### Directory Structure

```
src/
├── components/    # PageHeader, Modal, BottomNav, SectionCard, SettingsRow, Toast, ConfirmDialog, InstallPrompt
├── data/          # initialData.ts (seed data)
├── lib/
│   ├── bundleOffer.ts    # règles d’offres (lots), libellés, résolution par dessert
│   ├── dateLocal.ts      # `localDateISO`, `toCalendarISODate`, filtre Ordres (livrées J+1)
│   ├── deliveryBundle.ts # allocation CA commande → ventes (prix figés)
│   ├── commandeProduction.ts
│   ├── calculations.ts   # cost engine, snapshots, stats
│   ├── db.ts             # Supabase CRUD (fetchX, upsertX, deleteX)
│   ├── notifications.ts  # local notification schedule (localStorage)
│   └── supabase.ts       # Supabase client init
├── screens/       # Calculate, Ingredients, Bases, Desserts, History, Commandes, Settings
├── types/         # TypeScript interfaces
├── App.tsx        # State orchestration + Supabase fetch on mount
├── index.css      # Tailwind v4 @theme + utility classes
└── main.tsx       # React 19 entry point + SW registration
public/
└── sw.js          # Service worker (PWA)
```

### Key Concepts

* **Matières Premières** (Ingredients): Raw purchased materials with price/kg
* **Bases** (Preparations): House-made components from ingredients (e.g., caramel, dough). Extra fields: `family` (string, `''` = standalone; same label = variants of one family, shown as a single card in `BasesScreen` that opens the variant list via `openFamily`), `yieldQty` (number | null) + `yieldLabel` (e.g. 5 / « entremets Ø18 cm »), scaled by the multiplier in `ScaleModal`. Each variant is a full duplicated recipe (no shared parent). Family match is exact/case-sensitive — a typo creates a new family. `ScaleModal` on a base has two modes: « Multiplier » (presets/free input) or « Par ingrédient » (factor = available qty / recipe qty of the chosen ingredient).
* **Desserts**: Finished products composed of bases + direct ingredients, with sell price
* **History (Compta)**: Immutable sale records in `history_entries` with `SnapshotLine[]` and frozen unit/total revenue at sale time (`catalogueUnitAtSale`, `revenue_caption`, `bundle_offer_label_at_sale`, `sale_label`, etc.). **Do not** recalculate past rows when catalog or bundle rules change; new sales use current rules. Deleting a **commande** does **not** delete history rows (see `deleteCommande` in `db.ts` — compta stays intact; only explicit Compta UI deletion removes entries).
* **Commandes (Ordres)**: Advance orders with `CommandeItem[]`, `orderDate`, `deliveryDate`, status `pending` | `ready` | `delivered`, `notifyBefore`. On **Livrée**, set `deliveryDate` to the **actual** calendar day (`localDateISO()`). **List Ordres** hides `delivered` when `toCalendarISODate(deliveryDate) < today` (J+1 after delivery day: free space; data still in Supabase and in Compta if sold). **En retard** badge for `pending`/`ready` when scheduled delivery is past. Dates from API are normalized in `rowToCommande` via `toCalendarISODate` so string comparisons are safe (e.g. `2026-4-24` vs `2026-04-25`). `CommandesScreen` syncs the calendar day every ~5s and on focus/visibility so the list updates after midnight.
* **Offres (bundles)**: `BundleOfferRule[]` in localStorage (`loadBundleRules` / `saveBundleRules`); used at sale time; commande → vente uses `buildCommandeSaleAllocations` + `frozenRevenue` for `addHistoryEntry`.
* **Propagation**: Changing an ingredient price auto-recalculates all bases and desserts that use it

## 🗣️ Vocabulaire UI (client non technique)
Libellés visibles : **Ventes** (ex-Compta), **Commandes** (ex-Ordres), **Caisse**, **Atelier** (Desserts, Préparations = bases, Ingrédients = matières premières), **Réglages**. Pas de jargon (ticket, dashboard, snapshot, Supabase) ni de TTC dans l'UI. Textes courts : un libellé + au plus une ligne d'aide. Les noms de code (`history`, `commandes`, `Base`) ne changent pas.

## 🖼️ Images (`public/`)
`apple-touch-icon.png` (180), `icon-192/512.png`, `icon-maskable-512.png`, `favicon-16/32.png`, `badge-96.png` (silhouette blanche pour les notifications). Icônes plein cadre carré, sans coins arrondis ni transparence (iOS/Android appliquent leur masque). Logo affiché dans l'app : `src/assets/logo.webp` (copie dans `public/logo.webp` pour l'écran de démarrage HTML). Écrans de lancement iOS : `public/splash/*` (12 tailles d'iPhone, fond #FDF8F2 + logo centré) référencés par `apple-touch-startup-image` dans `index.html`. `public/sw.js` met l'interface en cache (hors-ligne) mais jamais les données Supabase.

## 🔒 Pas de référencement
App interne : `public/robots.txt` (Disallow all), meta `robots` noindex dans `index.html`, en-tête `X-Robots-Tag` via `vercel.json`. Ne pas retirer.

## 🗄️ Supabase Schema

Tables: `raw_ingredients`, `bases`, `base_components`, `desserts`, `dessert_components`, `history_entries`, `commandes`

**bases** extra columns (migration `supabase/migrations/20261004_bases_family_yield.sql`, must be applied manually): `family text not null default ''`, `yield_qty numeric`, `yield_label text not null default ''`. Without them `upsertBase` fails with an explicit error.

**commandes** columns: `id, client_name, items (JSONB), order_date, delivery_date, notes, status, notify_before (JSONB), created_at`

**Notifications**: Local only (fires when app is open). `notify_before` = `[0, 1, 2]` = same day / 1 day before / 2 days before at 8:00. Schedule stored in `localStorage['e1d_notif_schedule_v1']`.

## 🛠️ Development & Build Commands

* **Install:** `npm install`
* **Start Dev Server:** `npm run dev`
* **Type Check:** `npx tsc --noEmit`
* **Build for Production:** `npm run build`

## 🧩 CSS System

Tailwind CSS v4 with `@theme` directive. Two card variants:
* `.gourmand-card` — White background, rounded-[32px], border
* `.gourmand-card-dark` — Chocolate background, white text (uses CSS var to avoid Tailwind specificity issues)

## ⚠️ Key Constraints

* **ConfirmDialog** has no `isOpen` prop — wrap in `<AnimatePresence>` and conditionally render
* **BottomNav** : 5 emplacements — Commandes, Atelier, **Caisse (centre, en relief)**, Ventes, Réglages. « Atelier » (`AtelierScreen`) regroupe Desserts / Préparations / Ingrédients (sous-onglets, dernière section mémorisée). Les tabs `desserts|bases|ingredients` existent toujours dans `Tab`. Ne pas ajouter d'onglet : mettre la fonctionnalité dans une section existante.
* **Création rapide** : `QuantityPicker` (recherche, éléments choisis en tête) + `IngredientModal` permettent de créer un ingrédient depuis le formulaire d'une préparation ou d'un dessert sans le quitter.
* **Courses** (Commandes › Courses) : `lib/shoppingList.ts` additionne les ingrédients des desserts restant à fabriquer (commandes non livrées moins `producedQty`), bases dépliées proportionnellement ; un dessert commandé = 1 fois sa recette (même convention que le coût à la vente). Cases à cocher mémorisées en local (`e1d_courses_checked`).
* **Caisse** : grille de tuiles 2 colonnes (toucher = ajouter, badge = quantité, − sur la tuile), panier repliable dans la barre d'encaissement.
* **Notifications** are local only (fire on app open). Background push requires VAPID + server — not implemented
* **SectionCard** uses `mb-0` — spacing handled by parent `space-y-*`. Do NOT add `mb-6` back; all screens use `space-y-3` or `space-y-4` containers
* **SectionCard padding=true** → `p-4`. Use `padding={false}` for list-based content (divide-y rows handle their own padding)
* **Reset button** (SettingsScreen) clears localStorage only (`e1d_target_margin` + `e1d_notif_schedule_v1`) — does NOT touch Supabase data. Confirmation text must make this explicit
* **Tout est net** — no TVA, no gross/net distinction. All amounts are net. Never add tax rows
* **targetMargin** persisted in `localStorage['e1d_target_margin']` (default 0.65). Lifted to App.tsx state, passed as prop to CalculateScreen + SettingsScreen
* **StatPeriod** (`'week' | 'month' | 'all'`) — `filterHistoryByPeriod()` in `calculations.ts`. Dashboard defaults to `'month'`
* **Commande → Vente**: when advancing status to `delivered`, modal "Enregistrer + Livrer" / "Livrer uniquement". Builds allocations via `buildCommandeSaleAllocations`, then `onAddSale` with `frozenRevenue` and labels so compta never depends on later rule changes
