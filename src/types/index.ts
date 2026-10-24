// ─── Navigation ────────────────────────────────────────────
export type Tab = 'calculate' | 'desserts' | 'bases' | 'ingredients' | 'history' | 'commandes' | 'settings';

// ─── Matières Premières (Achats) ───────────────────────────
export interface RawIngredient {
  id: string;
  name: string;
  pricePerKg: number;       // Prix normalisé au kg/L/unité
  unit: 'kg' | 'L' | 'u';
  category: string;         // Crèmerie, Épicerie, Fruits secs…
  emoji: string;
  purchaseLabel: string;    // Ex: "9,96 €/kg — Plaquettes"
  notes: string;
  createdAt: string;
}

// ─── Bases / Préparations Maison ───────────────────────────
export interface BaseComponent {
  ingredientId: string;
  quantity: number;          // en grammes / ml / unités
}

export interface Base {
  id: string;
  name: string;
  components: BaseComponent[];
  category: string;          // Fond, Ganache, Insert, Coulis, Crème…
  /** Famille de recettes (ex. « Appareil à flan »). Vide = recette autonome. Les variantes d'une famille partagent ce libellé. */
  family: string;
  /** Rendement de la recette telle qu'écrite : quantité (ex. 5)… */
  yieldQty: number | null;
  /** …et ce qu'elle permet de faire (ex. « entremets Ø18 cm »). */
  yieldLabel: string;
  emoji: string;
  notes: string;
  createdAt: string;
}

// ─── Desserts / Produits Finis ─────────────────────────────
export interface DessertComponent {
  type: 'ingredient' | 'base';
  id: string;
  quantity: number;          // en grammes
}

/** Famille de produit (offres lot, stats, compta). Chaque recette a une seule famille. */
export type DessertProductKind = 'tarte' | 'flan' | 'tiramisu' | 'autre';

export const DESSERT_PRODUCT_KIND_OPTIONS: { value: DessertProductKind; label: string; hint: string }[] = [
  { value: 'tarte', label: 'Tarte', hint: 'Offre lot 5+… paramétrable' },
  { value: 'flan', label: 'Flan', hint: 'Tarif classique' },
  { value: 'tiramisu', label: 'Tiramisu', hint: 'Tarif classique' },
  { value: 'autre', label: 'Autre', hint: 'Pâtisseries diverses' },
];

export interface Dessert {
  id: string;
  name: string;
  components: DessertComponent[];
  emoji: string;
  sellPriceParticulier: number; // Prix de vente Particulier
  sellPricePro: number;         // Prix de vente Pro
  servings: number;          // Nombre de parts
  productKind: DessertProductKind;
  notes: string;
  createdAt: string;
}

// ─── Historique / Comptabilité ─────────────────────────────
export interface SnapshotLine {
  name: string;
  type: 'ingredient' | 'base';
  quantity: number;
  unitLabel: string;         // "g", "ml", "u"
  unitCostPerKg: number;     // Prix/kg figé au moment de la vente
  lineCost: number;          // Coût calculé figé
}

export interface HistoryEntry {
  id: string;
  date: string;
  dessertId: string;
  dessertName: string;
  dessertEmoji: string;
  productKind: DessertProductKind;
  quantitySold: number;
  unitCost: number;          // Coût de revient unitaire figé
  unitPrice: number;         // Prix de vente unitaire figé
  customerType: 'particulier' | 'pro';
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginRate: number;        // % marge
  /** Prix unitaire catalogue (avant offre) figé — sert à afficher le détail 5×3 € + reliquat, etc. */
  catalogueUnitAtSale: number;
  /** Légende figée, ex. « 5 × 3,00 € + 1 × 3,60 € » (ordre de la commande pour les lots). */
  revenueCaption: string;
  /** Libellé d’offre figé, ex. « Offre lot 5 p. = 15,00 € ». Vide = tarif catalogue (pas d’offre). */
  bundleOfferLabelAtSale: string;
  linesSnapshot: SnapshotLine[];  // Détail figé complet
  /** Même id pour toutes les lignes d'un même encaissement (caisse ou livraison). */
  orderGroupId: string;
  /** Libellé libre saisi en caisse (identique sur chaque ligne du ticket), ex. fête, réf. */
  saleLabel: string;
  /** Si la vente vient d’une commande client (livrée). */
  sourceCommandeId: string | null;
}

// ─── Commandes Client ──────────────────────────────────────
export type CommandeStatus = 'pending' | 'ready' | 'delivered';
export type NotifyBefore = 0 | 1 | 2; // jours avant livraison

export interface CommandeItem {
  dessertId: string | null;
  dessertName: string;
  dessertEmoji: string;
  quantity: number;
  /** Unités déjà fabriquées (0…quantity). Absent en base = 0. */
  producedQty?: number;
}

export interface Commande {
  id: string;
  clientName: string;
  items: CommandeItem[];        // plusieurs desserts
  orderDate: string;            // Date de prise de commande (ISO)
  deliveryDate: string;         // Date de livraison souhaitée (ISO)
  notes: string;
  customerType: 'particulier' | 'pro';
  status: CommandeStatus;
  notifyBefore: NotifyBefore[]; // [0]=jour même, [1]=1j avant, [2]=2j avant
  createdAt: string;
}

// ─── Offre lot (caisse) — stockée en localStorage ──────────
/**
 * Une règle d’offre lot. Ordre du tableau = priorité (première règle qui matche s’applique).
 * Périmètre : **union** de `dessertIds` (sélection explicite) et `productKinds` (familles). Au moins l’un
 * des deux doit être non vide pour qu’il y ait des produits concernés.
 */
export interface BundleOfferRule {
  id: string;
  /** Nom optionnel (compta, réglages). */
  name: string;
  enabled: boolean;
  bundleSize: number;
  /** Prix de la dernière unité de chaque lot si `useFixedBundleTotal` est false. */
  discountedUnitPrice: number;
  useFixedBundleTotal: boolean;
  fixedBundleTotal: number;
  appliesTo: 'particulier' | 'pro' | 'both';
  /** Desserts explicitement concernés. */
  dessertIds: string[];
  /** Familles concernées. Union avec `dessertIds`. */
  productKinds: DessertProductKind[];
}

// ─── Stats ─────────────────────────────────────────────────
export type StatPeriod = 'week' | 'month' | 'all';

// ─── Toast ─────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info';

/** Options du toast (3e argument de `showToast`). */
export interface ShowToastOptions {
  emphasis?: string;
}

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  /** Affiché en gras au-dessus du message (ex. nom client). */
  emphasis?: string;
}
