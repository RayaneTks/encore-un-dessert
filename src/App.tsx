import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Tab,
  RawIngredient,
  Base,
  Dessert,
  HistoryEntry,
  Commande,
  ToastData,
  ShowToastOptions,
  BundleOfferRule,
} from './types';
import {
  calculateDessertCost,
  createFullSnapshot,
} from './lib/calculations';
import * as db from './lib/db';
import { checkAndFireNotifications, syncAllNotifications } from './lib/notifications';
import { buildCommandeSaleAllocations } from './lib/deliveryBundle';
import {
  loadBundleRules,
  saveBundleRules,
  effectiveAverageUnitPrice,
  computeBundleLineTotal,
  formatRevenueLineCaption,
  formatBundleOfferLabel,
  unitRevenueListForBundle,
  resolveRuleForDessert,
} from './lib/bundleOffer';

import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';

import { InstallPrompt } from './components/InstallPrompt';

const CalculateScreen = lazy(() => import('./screens/CalculateScreen').then(m => ({ default: m.CalculateScreen })));
const AtelierScreen = lazy(() => import('./screens/AtelierScreen').then(m => ({ default: m.AtelierScreen })));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const CommandesScreen = lazy(() => import('./screens/CommandesScreen').then(m => ({ default: m.CommandesScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calculate');
  /** Dernière section ouverte dans l'Atelier : l'onglet y revient directement. */
  const [lastAtelier, setLastAtelier] = useState<Tab>('desserts');
  useEffect(() => {
    if (activeTab === 'desserts' || activeTab === 'bases' || activeTab === 'ingredients') setLastAtelier(activeTab);
  }, [activeTab]);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [loading, setLoading] = useState(true);

  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [desserts, setDesserts] = useState<Dessert[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [targetMargin, setTargetMargin] = useState<number>(() => {
    const s = localStorage.getItem('e1d_target_margin');
    return s ? parseFloat(s) : 0.65;
  });
  const [bundleRules, setBundleRules] = useState<BundleOfferRule[]>(() => loadBundleRules());

  // ─── Toast ─────────────────────────────────────────────────
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', opts?: ShowToastOptions) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, message, type, emphasis: opts?.emphasis }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Initial Fetch ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [ings, bs, ds, hs, cmds] = await Promise.all([
        db.fetchIngredients(),
        db.fetchBases(),
        db.fetchDesserts(),
        db.fetchHistory(),
        db.fetchCommandes(),
      ]);
      setIngredients(ings);
      setBases(bs);
      setDesserts(ds);
      setHistory(hs);
      setCommandes(cmds);
      syncAllNotifications(cmds);
      checkAndFireNotifications(cmds);
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Impossible de charger vos données. Vérifiez la connexion.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── CRUD Wrappers (sync local state + Supabase) ──────────

  // Ingredients
  const handleSaveIngredient = useCallback(async (ing: RawIngredient) => {
    try {
      const saved = await db.upsertIngredient(ing);
      setIngredients(prev => {
        const idx = prev.findIndex(i => i.id === ing.id);
        if (idx >= 0) return prev.map(i => i.id === ing.id ? saved : i);
        return [...prev, saved];
      });
      return saved;
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
      return null;
    }
  }, [showToast]);

  const handleDeleteIngredient = useCallback(async (id: string) => {
    try {
      await db.deleteIngredient(id);
      setIngredients(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }, [showToast]);

  // Bases
  const handleSaveBase = useCallback(async (base: Base) => {
    try {
      const saved = await db.upsertBase(base);
      setBases(prev => {
        const idx = prev.findIndex(b => b.id === base.id);
        if (idx >= 0) return prev.map(b => b.id === base.id ? saved : b);
        return [...prev, saved];
      });
      return saved;
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
      return null;
    }
  }, [showToast]);

  const handleDeleteBase = useCallback(async (id: string) => {
    try {
      await db.deleteBase(id);
      setBases(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }, [showToast]);

  // Desserts
  const handleSaveDessert = useCallback(async (dessert: Dessert) => {
    try {
      const saved = await db.upsertDessert(dessert);
      setDesserts(prev => {
        const idx = prev.findIndex(d => d.id === dessert.id);
        if (idx >= 0) return prev.map(d => d.id === dessert.id ? saved : d);
        return [...prev, saved];
      });
      return saved;
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
      return null;
    }
  }, [showToast]);

  const handleDeleteDessert = useCallback(async (id: string) => {
    try {
      await db.deleteDessert(id);
      setDesserts(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }, [showToast]);

  // History
  const addHistoryEntry = useCallback(async (
    dessert: Dessert,
    quantity: number,
    customerType: 'particulier' | 'pro',
    options?: {
      overridePrice?: number;
      orderGroupId?: string;
      sourceCommandeId?: string | null;
      /** C.A. et PU déjà calculés (ex. offre sur quantité groupée) — jamais recalculé, même si l’offre change ensuite. */
      frozenRevenue?: { totalRevenue: number; unitPrice: number };
      /** Légende ex. « 1 × 3,00 + 1 × 3,60 » (commande) ; sinon calculé à l’encaissement. */
      revenueCaption?: string;
      /** Libellé d’offre (commande / caisse) ; prioritaire s’il est fourni. */
      bundleOfferLabelAtSale?: string;
      /** Libellé compta (caisse) — pour tout le ticket. */
      saleLabel?: string;
    },
  ) => {
    const unitCost = calculateDessertCost(dessert, ingredients, bases);
    const basePrice = customerType === 'pro' ? dessert.sellPricePro : dessert.sellPriceParticulier;
    const o = options?.overridePrice;
    const catalogueUnit =
      o !== undefined && o !== null && Number.isFinite(o) ? o : basePrice;
    const fr = options?.frozenRevenue;
    const rule = resolveRuleForDessert(dessert, customerType, bundleRules);
    const totalRevenue = fr
      ? fr.totalRevenue
      : computeBundleLineTotal(quantity, catalogueUnit, rule, customerType, dessert.productKind);
    const unitPrice = fr
      ? fr.unitPrice
      : effectiveAverageUnitPrice(
          quantity,
          catalogueUnit,
          rule,
          customerType,
          dessert.productKind,
        );
    const totalCost = unitCost * quantity;
    const totalProfit = totalRevenue - totalCost;
    const marginRate = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    const linesSnapshot = createFullSnapshot(dessert, ingredients, bases);
    const orderGroupId = options?.orderGroupId ?? crypto.randomUUID();
    const sourceCommandeId = options?.sourceCommandeId ?? null;
    const revenueCaption =
      options?.revenueCaption?.trim() ||
      formatRevenueLineCaption(
        unitRevenueListForBundle(quantity, catalogueUnit, rule, customerType, dessert.productKind),
      );
    const catTotal = catalogueUnit * quantity;
    const offerLabelFromOpts = options?.bundleOfferLabelAtSale;
    const autoOfferLabel =
      !fr && rule && Math.abs(totalRevenue - catTotal) > 0.01
        ? formatBundleOfferLabel(rule)
        : '';
    const bundleOfferLabelAtSale =
      offerLabelFromOpts !== undefined && offerLabelFromOpts !== null
        ? offerLabelFromOpts
        : autoOfferLabel;

    try {
      const saved = await db.insertHistoryEntry({
        dessertId: dessert.id,
        dessertName: dessert.name,
        dessertEmoji: dessert.emoji,
        productKind: dessert.productKind,
        quantitySold: quantity,
        unitCost,
        unitPrice,
        totalRevenue,
        totalCost,
        totalProfit,
        marginRate,
        customerType,
        linesSnapshot,
        orderGroupId,
        sourceCommandeId,
        catalogueUnitAtSale: catalogueUnit,
        revenueCaption,
        bundleOfferLabelAtSale,
        saleLabel: (options?.saleLabel ?? '').trim(),
      });
      setHistory(prev => [saved, ...prev]);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de l\'enregistrement', 'error');
    }
  }, [ingredients, bases, bundleRules, showToast]);

  const checkoutCart = useCallback(
    async (
      lines: { dessertId: string; quantity: number; catalogueUnitOverride?: number }[],
      customerType: 'particulier' | 'pro',
      opts?: { saleLabel?: string },
    ) => {
      if (lines.length === 0) return;
      const orderGroupId = crypto.randomUUID();
      const label = (opts?.saleLabel ?? '').trim();
      const { lines: allocRows, skippedLines } = buildCommandeSaleAllocations(
        lines,
        id => desserts.find(d => d.id === id),
        customerType,
        bundleRules,
      );
      for (const row of allocRows) {
        await addHistoryEntry(row.dessert, row.quantity, customerType, {
          orderGroupId,
          sourceCommandeId: null,
          frozenRevenue: row.frozenRevenue,
          revenueCaption: row.revenueCaption,
          bundleOfferLabelAtSale: row.bundleOfferLabelAtSale,
          overridePrice: row.catalogueUnitAtSale,
          saleLabel: label,
        });
      }
      if (skippedLines > 0) showToast(`${skippedLines} article(s) ignoré(s) — recette manquante`, 'info');
    },
    [addHistoryEntry, bundleRules, desserts, showToast],
  );

  const handleDeleteHistory = useCallback(async (id: string) => {
    try {
      await db.deleteHistoryEntry(id);
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }, [showToast]);

  const handleDeleteHistoryByOrderGroup = useCallback(
    async (orderGroupId: string) => {
      try {
        await db.deleteHistoryByOrderGroupId(orderGroupId);
        setHistory(prev => prev.filter(h => h.orderGroupId !== orderGroupId));
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Erreur lors de la suppression', 'error');
      }
    },
    [showToast],
  );

  // Commandes
  const handleSaveCommande = useCallback(async (cmd: Commande) => {
    try {
      const saved = await db.upsertCommande(cmd);
      setCommandes(prev => {
        const updated = (() => {
          const idx = prev.findIndex(c => c.id === cmd.id);
          if (idx >= 0) return prev.map(c => c.id === cmd.id ? saved : c);
          return [...prev, saved];
        })();
        syncAllNotifications(updated);
        return updated;
      });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
    }
  }, [showToast]);

  const handleChangeTargetMargin = useCallback((val: number) => {
    localStorage.setItem('e1d_target_margin', val.toString());
    setTargetMargin(val);
  }, []);

  const handleChangeBundleRules = useCallback((rules: BundleOfferRule[]) => {
    saveBundleRules(rules);
    setBundleRules(rules);
  }, []);

  const handleDeleteCommande = useCallback(async (id: string) => {
    try {
      await db.deleteCommande(id);
      setCommandes(prev => {
        const updated = prev.filter(c => c.id !== id);
        syncAllNotifications(updated);
        return updated;
      });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }, [showToast]);

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <img src="/logo.webp" alt="Encore 1 Dessert" className="h-auto w-[62%] max-w-[300px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="app-container font-sans text-gourmand-chocolate selection:bg-gourmand-chocolate/10">
      <InstallPrompt />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-hidden relative">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-gourmand-chocolate border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              </div>
            </div>
          }
        >
          <AnimatePresence mode="wait">
            {activeTab === 'calculate' && (
              <CalculateScreen
                key="calculate"
                desserts={desserts}
                ingredients={ingredients}
                bases={bases}
                commandes={commandes}
                setActiveTab={setActiveTab}
                bundleRules={bundleRules}
                onCheckoutCart={checkoutCart}
                showToast={showToast}
              />
            )}
            {(activeTab === 'desserts' || activeTab === 'bases' || activeTab === 'ingredients') && (
              <AtelierScreen
                key="atelier"
                section={activeTab}
                onSectionChange={setActiveTab}
                desserts={desserts}
                bases={bases}
                ingredients={ingredients}
                onSaveDessert={handleSaveDessert}
                onDeleteDessert={handleDeleteDessert}
                onSaveBase={handleSaveBase}
                onDeleteBase={handleDeleteBase}
                onSaveIngredient={handleSaveIngredient}
                onDeleteIngredient={handleDeleteIngredient}
                targetMargin={targetMargin}
                showToast={showToast}
              />
            )}
            {activeTab === 'history' && (
              <HistoryScreen
                key="history"
                history={history}
                commandes={commandes}
                setActiveTab={setActiveTab}
                onDelete={handleDeleteHistory}
                onDeleteOrderGroup={handleDeleteHistoryByOrderGroup}
                showToast={showToast}
              />
            )}
            {activeTab === 'commandes' && (
              <CommandesScreen
                key="commandes"
                commandes={commandes}
                desserts={desserts}
                ingredients={ingredients}
                bases={bases}
                bundleRules={bundleRules}
                onSave={handleSaveCommande}
                onDelete={handleDeleteCommande}
                onAddSale={addHistoryEntry}
                showToast={showToast}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsScreen
                key="settings"
                targetMargin={targetMargin}
                onChangeTargetMargin={handleChangeTargetMargin}
                desserts={desserts}
                bundleRules={bundleRules}
                onChangeBundleRules={handleChangeBundleRules}
              />
            )}
          </AnimatePresence>
        </Suspense>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={t => setActiveTab(t === 'desserts' ? lastAtelier : t)} />
    </div>
  );
}
