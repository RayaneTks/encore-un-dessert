import React, { useState, useMemo, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronDown, Check, Store, Clock, Minus, Plus, Search, ShoppingBag, Banknote, Trash2, Pencil } from 'lucide-react';
import {
  Dessert,
  RawIngredient,
  Base,
  Commande,
  Tab,
  BundleOfferRule,
  DessertProductKind,
  DESSERT_PRODUCT_KIND_OPTIONS,
} from '../types';
import { PageHeader } from '../components/PageHeader';
import { CUSTOMER_TYPE_VALIDATE_OPTIONS, FilterChipRow } from '../components/FilterControls';
import { fmt, calculateDessertCost } from '../lib/calculations';
import { buildCommandeSaleAllocations } from '../lib/deliveryBundle';
import { formatBundleOfferLabel, resolveRuleForDessert } from '../lib/bundleOffer';

type CartLine = { id: string; dessertId: string; quantity: number; priceOverride: string };

interface Props {
  desserts: Dessert[];
  ingredients: RawIngredient[];
  bases: Base[];
  commandes: Commande[];
  setActiveTab: (tab: Tab) => void;
  bundleRules: BundleOfferRule[];
  onCheckoutCart: (
    lines: { dessertId: string; quantity: number; catalogueUnitOverride?: number }[],
    customerType: 'particulier' | 'pro',
    options?: { saleLabel?: string },
  ) => void | Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function parsePositiveInt(raw: string, min: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return min;
  return Math.min(5000, n);
}

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const KIND_SHELF_ORDER: DessertProductKind[] = ['tarte', 'flan', 'tiramisu', 'autre'];

function labelForProductKind(kind: DessertProductKind): string {
  return DESSERT_PRODUCT_KIND_OPTIONS.find(o => o.value === kind)?.label ?? 'Autre';
}

export const CalculateScreen: React.FC<Props> = ({
  desserts,
  ingredients,
  bases,
  commandes,
  setActiveTab,
  bundleRules,
  onCheckoutCart,
  showToast,
}) => {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [customerType, setCustomerType] = useState<'particulier' | 'pro'>('particulier');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [editingPriceFor, setEditingPriceFor] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [saleLabel, setSaleLabel] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  const todayISO = new Date().toISOString().split('T')[0];
  const todayCommandes = commandes.filter(c => c.deliveryDate === todayISO && c.status !== 'delivered');

  const q = search.trim().toLowerCase();
  const filteredDesserts = useMemo(
    () => (!q ? desserts : desserts.filter(d => d.name.toLowerCase().includes(q))),
    [desserts, q],
  );

  /** Fiches triées par famille (Tarte, Flan, …) pour scanner vite une longue liste. */
  const dessertBlocks = useMemo(() => {
    const map = new Map<DessertProductKind, Dessert[]>();
    for (const d of filteredDesserts) {
      const k = d.productKind ?? 'autre';
      const arr = map.get(k);
      if (arr) arr.push(d);
      else map.set(k, [d]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    }
    return KIND_SHELF_ORDER.filter(k => (map.get(k)?.length ?? 0) > 0).map(k => ({
      kind: k,
      title: labelForProductKind(k),
      items: map.get(k)!,
    }));
  }, [filteredDesserts]);

  const catalogFor = useCallback(
    (d: Dessert) => (customerType === 'pro' ? d.sellPricePro : d.sellPriceParticulier),
    [customerType],
  );

  const { totalRevenue, totalMargin, lineAmounts, offerHints } = useMemo(() => {
    if (cart.length === 0) {
      return { totalRevenue: 0, totalMargin: 0, lineAmounts: [] as number[], offerHints: [] as (string | null)[] };
    }
    const { lines: alloc } = buildCommandeSaleAllocations(
      cart.map(c => {
        const o = c.priceOverride ? parseFloat(c.priceOverride) : undefined;
        return {
          dessertId: c.dessertId,
          quantity: c.quantity,
          catalogueUnitOverride:
            o !== undefined && Number.isFinite(o) && o >= 0 ? o : undefined,
        };
      }),
      id => desserts.find(d => d.id === id),
      customerType,
      bundleRules,
    );
    const amounts: number[] = [];
    const hints: (string | null)[] = [];
    let rev = 0;
    let m = 0;
    for (let i = 0; i < cart.length; i++) {
      const row = alloc[i];
      if (!row) {
        amounts.push(0);
        hints.push(null);
        continue;
      }
      const tr = row.frozenRevenue.totalRevenue;
      amounts.push(tr);
      const d = row.dessert;
      const uc = calculateDessertCost(d, ingredients, bases);
      m += tr - uc * row.quantity;
      rev += tr;
      const o = cart[i].priceOverride ? parseFloat(cart[i].priceOverride) : undefined;
      const pCat = o !== undefined && Number.isFinite(o) && o >= 0 ? o : catalogFor(d);
      const r = resolveRuleForDessert(d, customerType, bundleRules);
      hints.push(r && Math.abs(tr - pCat * row.quantity) > 0.01 ? formatBundleOfferLabel(r) : null);
    }
    return { totalRevenue: rev, totalMargin: m, lineAmounts: amounts, offerHints: hints };
  }, [cart, customerType, bundleRules, desserts, ingredients, bases, catalogFor]);

  const addOne = useCallback(
    (dessertId: string) => {
      setCart(prev => {
        const ix = prev.findIndex(l => l.dessertId === dessertId && l.priceOverride.trim() === '');
        if (ix >= 0) {
          const n = [...prev];
          n[ix] = { ...n[ix], quantity: n[ix].quantity + 1 };
          return n;
        }
        return [...prev, { id: newLineId(), dessertId, quantity: 1, priceOverride: '' }];
      });
    },
    [setCart],
  );

  const setQty = useCallback((lineId: string, qty: number) => {
    if (qty < 1) {
      setCart(c => c.filter(x => x.id !== lineId));
      return;
    }
    setCart(c => c.map(x => (x.id === lineId ? { ...x, quantity: qty } : x)));
  }, []);

  const applyPriceEdit = (lineId: string) => {
    const v = priceDraft.replace(',', '.').trim();
    if (v === '') {
      setCart(c => c.map(x => (x.id === lineId ? { ...x, priceOverride: '' } : x)));
    } else {
      const p = parseFloat(v);
      if (Number.isFinite(p) && p >= 0) {
        setCart(c => c.map(x => (x.id === lineId ? { ...x, priceOverride: p.toFixed(2) } : x)));
      } else {
        showToast('Prix invalide', 'error');
        return;
      }
    }
    setEditingPriceFor(null);
    setPriceDraft('');
  };

  const startPriceEdit = (line: CartLine) => {
    setEditingPriceFor(line.id);
    setPriceDraft(line.priceOverride || '');
  };

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    const label = saleLabel.trim();
    await onCheckoutCart(
      cart.map(c => {
        const o = c.priceOverride ? parseFloat(c.priceOverride) : undefined;
        return {
          dessertId: c.dessertId,
          quantity: c.quantity,
          catalogueUnitOverride:
            c.priceOverride.trim() && o !== undefined && Number.isFinite(o) && o >= 0 ? o : undefined,
        };
      }),
      customerType,
      label ? { saleLabel: label } : undefined,
    );
    setCart([]);
    setCartOpen(false);
    setCheckoutDone(true);
    setSearch('');
    setSaleLabel('');
    showToast('Vente enregistrée', 'success');
    setTimeout(() => setCheckoutDone(false), 1600);
  }, [cart, customerType, onCheckoutCart, showToast, saleLabel]);

  if (desserts.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PageHeader
          title="Caisse"
          description="Ajoutez d’abord un dessert."
        />
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-32 opacity-50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gourmand-border/50">
            <Store size={32} className="text-gourmand-cocoa" />
          </div>
          <p className="mb-1 text-lg font-semibold text-gourmand-chocolate">Aucun dessert</p>
          <p className="text-center text-sm font-medium text-gourmand-biscuit">Créez un dessert pour commencer à vendre.</p>
        </div>
      </div>
    );
  }

  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const qtyByDessert = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach(l => m.set(l.dessertId, (m.get(l.dessertId) ?? 0) + l.quantity));
    return m;
  }, [cart]);

  const removeOne = (dessertId: string) => {
    const line = [...cart].reverse().find(l => l.dessertId === dessertId);
    if (line) setQty(line.id, line.quantity - 1);
  };

  const panelOpen = cartOpen && cart.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Caisse" />

      {/* Le type de client change les prix : on le choisit en premier */}
      <div className="shrink-0 px-4 pb-3">
        <FilterChipRow
          options={CUSTOMER_TYPE_VALIDATE_OPTIONS}
          value={customerType}
          onChange={v => setCustomerType(v)}
          aria-label="Type de client"
        />
      </div>

      <div
        className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain scrollbar-hide px-4 ${cart.length > 0 ? 'pb-72' : 'pb-60'}`}
        aria-label="Desserts à vendre"
      >
        <AnimatePresence>
          {todayCommandes.length > 0 && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => setActiveTab('commandes')}
              className="mb-4 w-full flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
              type="button"
            >
              <Clock size={14} className="text-amber-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-amber-800">
                  {todayCommandes.length} livraison{todayCommandes.length > 1 ? 's' : ''} aujourd’hui
                </p>
                <p className="truncate text-xs text-amber-700/80">{todayCommandes.map(c => c.clientName).join(', ')}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-amber-500" />
            </motion.button>
          )}
        </AnimatePresence>

        {desserts.length > 8 && (
          <div className="mb-4 flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-gourmand-border bg-white px-3 py-2 shadow-sm focus-within:border-gourmand-chocolate/40 focus-within:ring-2 focus-within:ring-gourmand-chocolate/15">
            <Search className="h-5 w-5 shrink-0 text-gourmand-biscuit" strokeWidth={2} aria-hidden />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un dessert…"
              className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-base font-medium text-gourmand-chocolate placeholder:text-gourmand-biscuit/60 outline-none"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        )}

        <div className="space-y-5">
          {dessertBlocks.map(block => (
            <section key={block.kind} aria-labelledby={`caisse-block-${block.kind}`}>
              <h2 id={`caisse-block-${block.kind}`} className="mb-2 pl-0.5 text-xs font-bold uppercase tracking-widest text-gourmand-cocoa/60">
                {block.title}
              </h2>
              <ul className="grid grid-cols-2 gap-2.5">
                {block.items.map(d => {
                  const p = catalogFor(d);
                  const qty = qtyByDessert.get(d.id) ?? 0;
                  return (
                    <li key={d.id} className="relative">
                      <button
                        type="button"
                        onClick={() => addOne(d.id)}
                        aria-label={`Ajouter ${d.name}, ${fmt(p)}${qty > 0 ? `, ${qty} dans le panier` : ''}`}
                        className={`flex min-h-[112px] w-full flex-col items-start justify-between rounded-2xl border bg-white p-3 text-left shadow-sm transition-all active:scale-[0.97] ${
                          qty > 0 ? 'border-gourmand-chocolate ring-1 ring-gourmand-chocolate/30' : 'border-gourmand-border'
                        }`}
                      >
                        <span className="text-3xl leading-none" aria-hidden>{d.emoji}</span>
                        <span className="w-full">
                          <span className="line-clamp-2 block text-[15px] font-semibold leading-tight text-gourmand-chocolate">{d.name}</span>
                          <span className="mt-0.5 block text-sm font-bold tabular-nums text-gourmand-caramel">{fmt(p)}</span>
                        </span>
                      </button>
                      {qty > 0 && (
                        <>
                          <span
                            key={qty}
                            className="pointer-events-none absolute right-2 top-2 flex h-7 min-w-7 animate-[pop_0.25s_ease-out] items-center justify-center rounded-full bg-gourmand-chocolate px-2 text-sm font-bold tabular-nums text-white"
                            aria-hidden
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeOne(d.id)}
                            aria-label={`Retirer un ${d.name}`}
                            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-gourmand-border bg-white text-gourmand-chocolate shadow-sm active:scale-90"
                          >
                            <Minus size={16} strokeWidth={2.5} />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        {filteredDesserts.length === 0 && (
          <p className="py-4 text-center text-sm text-gourmand-biscuit">Aucun dessert trouvé.</p>
        )}
      </div>

      {/* Panier + encaissement : au-dessus de la barre de navigation */}
      <div
        className="pointer-events-none fixed bottom-[104px] left-0 right-0 z-[95] mx-auto w-full max-w-[min(430px,100%)]"
        role="region"
        aria-label="Panier et encaissement"
      >
        <div className="pointer-events-auto rounded-t-3xl border border-b-0 border-gourmand-border bg-white/98 px-4 pb-3 pt-2 shadow-[0_-8px_28px_rgba(36,19,9,0.12)] backdrop-blur-md">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCartOpen(o => !o)}
              aria-expanded={panelOpen}
              className="mb-1 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-gourmand-chocolate">
                <ShoppingBag size={18} />
                {itemCount} article{itemCount > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-gourmand-biscuit">
                {panelOpen ? 'Masquer' : 'Voir le détail'}
                <ChevronDown size={16} className={`transition-transform ${panelOpen ? '' : 'rotate-180'}`} />
              </span>
            </button>
          )}

          <AnimatePresence initial={false}>
            {panelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ul className="mb-2 max-h-[34vh] space-y-2 overflow-y-auto">
                  {cart.map((line, idx) => {
                    const d = desserts.find(x => x.id === line.dessertId);
                    if (!d) return null;
                    const sub = lineAmounts[idx] ?? 0;
                    const hint = offerHints[idx];
                    return (
                      <li key={line.id} className="rounded-xl border border-gourmand-border/70 bg-gourmand-bg/50 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gourmand-chocolate">{d.emoji} {d.name}</p>
                            {hint && <p className="text-[11px] font-medium text-teal-800">{hint}</p>}
                            {editingPriceFor === line.id ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={priceDraft}
                                  onChange={e => setPriceDraft(e.target.value)}
                                  className="gourmand-input w-28 max-w-full py-2 text-base"
                                  placeholder="Prix unité"
                                  min={0}
                                  step={0.01}
                                  autoFocus
                                />
                                <button type="button" onClick={() => applyPriceEdit(line.id)} className="min-h-9 px-2 text-sm font-bold text-gourmand-chocolate">Valider</button>
                                <button type="button" onClick={() => { setEditingPriceFor(null); setPriceDraft(''); }} className="min-h-9 px-2 text-sm text-gourmand-biscuit">Annuler</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startPriceEdit(line)} className="mt-0.5 flex min-h-7 items-center gap-1 text-xs font-medium text-gourmand-biscuit">
                                <Pencil size={11} />
                                {line.priceOverride ? `${line.priceOverride} € l’unité` : `${fmt(catalogFor(d))} l’unité · modifier`}
                              </button>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-bold tabular-nums text-gourmand-chocolate">{fmt(sub)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty(line.id, line.quantity - 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-gourmand-border bg-white text-gourmand-chocolate active:scale-95" aria-label="Moins un">
                              <Minus size={18} />
                            </button>
                            <span className="min-w-10 text-center text-base font-bold tabular-nums text-gourmand-chocolate">{line.quantity}</span>
                            <button type="button" onClick={() => setQty(line.id, line.quantity + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-gourmand-border bg-white text-gourmand-chocolate active:scale-95" aria-label="Plus un">
                              <Plus size={18} />
                            </button>
                          </div>
                          <button type="button" onClick={() => setCart(c => c.filter(x => x.id !== line.id))} className="flex h-11 w-11 items-center justify-center text-gourmand-biscuit hover:text-red-500" aria-label={`Retirer ${d.name}`}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    id="sale-label-caisse"
                    type="text"
                    value={saleLabel}
                    onChange={e => setSaleLabel(e.target.value.slice(0, 120))}
                    maxLength={120}
                    placeholder="Note sur la vente (facultatif)"
                    aria-label="Note sur la vente"
                    className="gourmand-input min-w-0 flex-1 py-2 text-base"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => { setCart([]); setCartOpen(false); }} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-red-600 active:bg-red-50">
                    Tout vider
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gourmand-biscuit">Total</p>
              <p className="text-3xl font-bold tabular-nums leading-none text-gourmand-chocolate">{fmt(totalRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gourmand-biscuit">Bénéfice</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-600">{fmt(totalMargin)}</p>
            </div>
          </div>
          <motion.button
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutDone}
            animate={checkoutDone ? { scale: [1, 1.02, 1] } : {}}
            className={
              cart.length === 0 || checkoutDone
                ? 'w-full flex min-h-[52px] items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold bg-gourmand-border/40 text-gourmand-biscuit disabled:cursor-not-allowed'
                : 'w-full flex min-h-[52px] items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold bg-gourmand-chocolate text-white shadow-lg shadow-gourmand-chocolate/25 active:scale-[0.99] transition-transform'
            }
            type="button"
          >
            {checkoutDone ? (
              <>
                <Check size={20} strokeWidth={2.5} />
                C’est noté
              </>
            ) : (
              <>
                <Banknote size={22} />
                {cart.length === 0 ? 'Touchez un dessert pour commencer' : `Encaisser ${fmt(totalRevenue)}`}
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};
