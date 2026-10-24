import { supabase } from './supabase';
import type {
  RawIngredient,
  Base,
  BaseComponent,
  Dessert,
  DessertComponent,
  DessertProductKind,
  HistoryEntry,
  SnapshotLine,
  Commande,
  CommandeStatus,
  CommandeItem,
  NotifyBefore,
} from '../types';
import { normalizeCommandeItems } from './commandeProduction';
import { toCalendarISODate } from './dateLocal';

function normalizeProductKind(raw: unknown): DessertProductKind {
  const v = typeof raw === 'string' ? raw : 'tarte';
  if (v === 'tarte' || v === 'flan' || v === 'tiramisu' || v === 'autre') return v;
  return 'tarte';
}

function isMissingHistoryOptionalColumnError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? '').toLowerCase();
  return (
    m.includes('history_entries') &&
    (m.includes('schema cache') || m.includes('could not find the') || m.includes("column of 'history_entries'"))
  );
}

// ─── RAW INGREDIENTS ────────────────────────────────────────

export async function fetchIngredients(): Promise<RawIngredient[]> {
  const { data, error } = await supabase
    .from('raw_ingredients')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    pricePerKg: Number(row.price_per_kg),
    unit: row.unit,
    category: row.category,
    emoji: row.emoji,
    purchaseLabel: row.purchase_label || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  }));
}

export async function upsertIngredient(ing: RawIngredient): Promise<RawIngredient> {
  const isNew = ing.id.startsWith('ing-');
  const payload: any = {
    name: ing.name,
    price_per_kg: ing.pricePerKg,
    unit: ing.unit,
    category: ing.category,
    emoji: ing.emoji,
    purchase_label: ing.purchaseLabel,
    notes: ing.notes,
  };
  if (!isNew) payload.id = ing.id;

  const { data, error } = await supabase
    .from('raw_ingredients')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    pricePerKg: Number(data.price_per_kg),
    unit: data.unit,
    category: data.category,
    emoji: data.emoji,
    purchaseLabel: data.purchase_label || '',
    notes: data.notes || '',
    createdAt: data.created_at,
  };
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('raw_ingredients').delete().eq('id', id);
  if (error) throw error;
}

// ─── BASES ──────────────────────────────────────────────────

export async function fetchBases(): Promise<Base[]> {
  const [basesRes, compsRes] = await Promise.all([
    supabase.from('bases').select('*').order('name'),
    supabase.from('base_components').select('*'),
  ]);
  if (basesRes.error) throw basesRes.error;
  if (compsRes.error) throw compsRes.error;

  return (basesRes.data || []).map(b => ({
    id: b.id,
    name: b.name,
    category: b.category,
    family: b.family || '',
    yieldQty: b.yield_qty != null ? Number(b.yield_qty) : null,
    yieldLabel: b.yield_label || '',
    emoji: b.emoji,
    notes: b.notes || '',
    createdAt: b.created_at,
    components: (compsRes.data || [])
      .filter(c => c.base_id === b.id)
      .map(c => ({ ingredientId: c.ingredient_id, quantity: Number(c.quantity) })),
  }));
}

export async function upsertBase(base: Base): Promise<Base> {
  const isNew = base.id.startsWith('base-');
  const payload: any = {
    name: base.name,
    category: base.category,
    family: base.family,
    yield_qty: base.yieldQty,
    yield_label: base.yieldLabel,
    emoji: base.emoji,
    notes: base.notes,
  };
  if (!isNew) payload.id = base.id;

  const { data, error } = await supabase
    .from('bases')
    .upsert(payload)
    .select()
    .single();
  if (error) {
    const m = (error.message ?? '').toLowerCase();
    if (m.includes('family') || m.includes('yield_')) {
      throw new Error(
        'Colonnes manquantes dans Supabase : exécutez supabase/migrations/20261004_bases_family_yield.sql',
      );
    }
    throw error;
  }

  const baseId = data.id;

  // Replace components: delete old, insert new
  await supabase.from('base_components').delete().eq('base_id', baseId);
  if (base.components.length > 0) {
    const rows = base.components.map(c => ({
      base_id: baseId,
      ingredient_id: c.ingredientId,
      quantity: c.quantity,
    }));
    const { error: compErr } = await supabase.from('base_components').insert(rows);
    if (compErr) throw compErr;
  }

  return { ...base, id: baseId, createdAt: data.created_at };
}

export async function deleteBase(id: string): Promise<void> {
  // base_components cascade on delete
  const { error } = await supabase.from('bases').delete().eq('id', id);
  if (error) throw error;
}

// ─── DESSERTS ───────────────────────────────────────────────

export async function fetchDesserts(): Promise<Dessert[]> {
  const [dessertsRes, compsRes] = await Promise.all([
    supabase.from('desserts').select('*').order('name'),
    supabase.from('dessert_components').select('*'),
  ]);
  if (dessertsRes.error) throw dessertsRes.error;
  if (compsRes.error) throw compsRes.error;

  return (dessertsRes.data || []).map(d => {
    const legacySellPrice = Number(d.sell_price ?? 0);
    const rawParticulier = Number(d.sell_price_particulier ?? 0);
    const rawPro = Number(d.sell_price_pro ?? 0);
    const sellPriceParticulier = rawParticulier > 0 ? rawParticulier : legacySellPrice;
    const sellPricePro = rawPro > 0 ? rawPro : legacySellPrice;

    return {
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    sellPriceParticulier,
    sellPricePro,
    servings: d.servings,
    productKind: normalizeProductKind(d.product_kind),
    notes: d.notes || '',
    createdAt: d.created_at,
    components: (compsRes.data || [])
      .filter(c => c.dessert_id === d.id)
      .map(c => ({
        type: c.type as 'ingredient' | 'base',
        id: c.type === 'base' ? c.base_id : c.ingredient_id,
        quantity: Number(c.quantity),
      })),
  };
  });
}

export async function upsertDessert(dessert: Dessert): Promise<Dessert> {
  const isNew = dessert.id.startsWith('dessert-');
  const payload: any = {
    name: dessert.name,
    emoji: dessert.emoji,
    sell_price_particulier: dessert.sellPriceParticulier,
    sell_price_pro: dessert.sellPricePro,
    servings: dessert.servings,
    notes: dessert.notes,
    product_kind: dessert.productKind,
  };
  if (!isNew) payload.id = dessert.id;

  const { data, error } = await supabase
    .from('desserts')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;

  const dessertId = data.id;

  // Replace components: delete old, insert new
  await supabase.from('dessert_components').delete().eq('dessert_id', dessertId);
  if (dessert.components.length > 0) {
    const rows = dessert.components.map(c => ({
      dessert_id: dessertId,
      type: c.type,
      ingredient_id: c.type === 'ingredient' ? c.id : null,
      base_id: c.type === 'base' ? c.id : null,
      quantity: c.quantity,
    }));
    const { error: compErr } = await supabase.from('dessert_components').insert(rows);
    if (compErr) throw compErr;
  }

  return { ...dessert, id: dessertId, createdAt: data.created_at };
}

export async function deleteDessert(id: string): Promise<void> {
  const { error } = await supabase.from('desserts').delete().eq('id', id);
  if (error) throw error;
}

// ─── HISTORY ────────────────────────────────────────────────

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('history_entries')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(h => ({
    id: h.id,
    date: h.date,
    dessertId: h.dessert_id || '',
    dessertName: h.dessert_name,
    dessertEmoji: h.dessert_emoji,
    productKind: normalizeProductKind(h.product_kind),
    quantitySold: h.quantity_sold,
    unitCost: Number(h.unit_cost),
    unitPrice: Number(h.unit_price),
    customerType: (h.customer_type as 'particulier' | 'pro') || 'particulier',
    totalRevenue: Number(h.total_revenue),
    totalCost: Number(h.total_cost),
    totalProfit: Number(h.total_profit),
    marginRate: Number(h.margin_rate),
    linesSnapshot: h.lines_snapshot as SnapshotLine[],
    orderGroupId: typeof h.order_group_id === 'string' && h.order_group_id ? h.order_group_id : h.id,
    sourceCommandeId: typeof h.source_commande_id === 'string' && h.source_commande_id ? h.source_commande_id : null,
    catalogueUnitAtSale: h.catalogue_unit_at_sale != null ? Number(h.catalogue_unit_at_sale) : 0,
    revenueCaption: typeof h.revenue_caption === 'string' && h.revenue_caption ? h.revenue_caption : '',
    bundleOfferLabelAtSale:
      typeof (h as { bundle_offer_label_at_sale?: string }).bundle_offer_label_at_sale === 'string'
        ? (h as { bundle_offer_label_at_sale: string }).bundle_offer_label_at_sale
        : '',
    saleLabel: typeof (h as { sale_label?: string | null }).sale_label === 'string' ? (h as { sale_label: string }).sale_label : '',
  }));
}

export async function insertHistoryEntry(entry: {
  dessertId: string;
  dessertName: string;
  dessertEmoji: string;
  productKind: DessertProductKind;
  quantitySold: number;
  unitCost: number;
  unitPrice: number;
  customerType: 'particulier' | 'pro';
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  marginRate: number;
  linesSnapshot: SnapshotLine[];
  orderGroupId: string;
  sourceCommandeId: string | null;
  catalogueUnitAtSale: number;
  revenueCaption: string;
  bundleOfferLabelAtSale: string;
  saleLabel: string;
}): Promise<HistoryEntry> {
  const fullRow = {
    dessert_id: entry.dessertId.startsWith('dessert-') ? null : entry.dessertId,
    dessert_name: entry.dessertName,
    dessert_emoji: entry.dessertEmoji,
    product_kind: entry.productKind,
    quantity_sold: entry.quantitySold,
    unit_cost: entry.unitCost,
    unit_price: entry.unitPrice,
    customer_type: entry.customerType,
    total_revenue: entry.totalRevenue,
    total_cost: entry.totalCost,
    total_profit: entry.totalProfit,
    margin_rate: entry.marginRate,
    lines_snapshot: entry.linesSnapshot,
    order_group_id: entry.orderGroupId,
    source_commande_id: entry.sourceCommandeId,
    catalogue_unit_at_sale: entry.catalogueUnitAtSale,
    revenue_caption: entry.revenueCaption || '',
    bundle_offer_label_at_sale: entry.bundleOfferLabelAtSale || '',
    sale_label: entry.saleLabel || '',
  };

  let res = await supabase.from('history_entries').insert(fullRow).select().single();

  if (res.error && isMissingHistoryOptionalColumnError(res.error)) {
    const {
      catalogue_unit_at_sale: _a,
      revenue_caption: _r,
      bundle_offer_label_at_sale: _b,
      sale_label: _sl,
      ...rest
    } = fullRow;
    res = await supabase.from('history_entries').insert(rest).select().single();
  }

  const { data, error } = res;
  if (error) throw error;
  return {
    id: data.id,
    date: data.date,
    dessertId: data.dessert_id || '',
    dessertName: data.dessert_name,
    dessertEmoji: data.dessert_emoji,
    productKind: normalizeProductKind(data.product_kind),
    quantitySold: data.quantity_sold,
    unitCost: Number(data.unit_cost),
    unitPrice: Number(data.unit_price),
    customerType: (data.customer_type as 'particulier' | 'pro') || 'particulier',
    totalRevenue: Number(data.total_revenue),
    totalCost: Number(data.total_cost),
    totalProfit: Number(data.total_profit),
    marginRate: Number(data.margin_rate),
    linesSnapshot: data.lines_snapshot as SnapshotLine[],
    orderGroupId: typeof data.order_group_id === 'string' && data.order_group_id ? data.order_group_id : data.id,
    sourceCommandeId: typeof data.source_commande_id === 'string' && data.source_commande_id ? data.source_commande_id : null,
    catalogueUnitAtSale:
      data.catalogue_unit_at_sale != null && data.catalogue_unit_at_sale !== ''
        ? Number(data.catalogue_unit_at_sale)
        : entry.catalogueUnitAtSale,
    revenueCaption: typeof (data as { revenue_caption?: string }).revenue_caption === 'string'
      ? (data as { revenue_caption: string }).revenue_caption
      : entry.revenueCaption || '',
    bundleOfferLabelAtSale:
      typeof (data as { bundle_offer_label_at_sale?: string }).bundle_offer_label_at_sale === 'string'
        ? (data as { bundle_offer_label_at_sale: string }).bundle_offer_label_at_sale
        : entry.bundleOfferLabelAtSale || '',
    saleLabel:
      typeof (data as { sale_label?: string | null }).sale_label === 'string' ? data.sale_label : entry.saleLabel || '',
  };
}

export async function deleteHistoryByOrderGroupId(orderGroupId: string): Promise<void> {
  const { error } = await supabase.from('history_entries').delete().eq('order_group_id', orderGroupId);
  if (error) throw error;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const { error } = await supabase.from('history_entries').delete().eq('id', id);
  if (error) throw error;
}

// ─── COMMANDES ──────────────────────────────────────────────

function rowToCommande(row: any): Commande {
  const rawItems = (row.items as CommandeItem[]) || [];
  const orderRaw = row.order_date != null ? String(row.order_date) : '';
  const delRaw = row.delivery_date != null ? String(row.delivery_date) : '';
  return {
    id: row.id,
    clientName: row.client_name,
    items: normalizeCommandeItems(rawItems),
    orderDate: toCalendarISODate(orderRaw) || orderRaw,
    deliveryDate: toCalendarISODate(delRaw) || delRaw,
    notes: row.notes || '',
    customerType: (row.customer_type as 'particulier' | 'pro') || 'particulier',
    status: row.status as CommandeStatus,
    notifyBefore: (row.notify_before as NotifyBefore[]) || [],
    createdAt: row.created_at,
  };
}

export async function fetchCommandes(): Promise<Commande[]> {
  const { data, error } = await supabase
    .from('commandes')
    .select('*')
    .order('delivery_date', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToCommande);
}

export async function upsertCommande(commande: Commande): Promise<Commande> {
  const isNew = commande.id.startsWith('cmd-');
  const payload: any = {
    client_name: commande.clientName,
    items: commande.items,
    order_date: commande.orderDate,
    delivery_date: commande.deliveryDate,
    notes: commande.notes,
    customer_type: commande.customerType,
    status: commande.status,
    notify_before: commande.notifyBefore,
  };
  if (!isNew) payload.id = commande.id;

  const { data, error } = await supabase
    .from('commandes')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return rowToCommande(data);
}

/** Retire seulement la ligne `commandes` — l’historique compta (`history_entries`) n’est pas touché. */
export async function deleteCommande(id: string): Promise<void> {
  const { error } = await supabase.from('commandes').delete().eq('id', id);
  if (error) throw error;
}
