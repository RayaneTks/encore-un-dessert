import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, ChevronDown, X, ChevronRight, RotateCcw, TrendingUp } from 'lucide-react';
import { HistoryEntry, Commande, Tab, StatPeriod, DESSERT_PRODUCT_KIND_OPTIONS } from '../types';
import { PageHeader } from '../components/PageHeader';
import { FilterPillRow, FilterSortByCustomer, FilterField } from '../components/FilterControls';
import { SectionCard } from '../components/SectionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fmt, fmtPct, computeGlobalStats, filterHistoryByPeriod, filterHistoryByCustomerType } from '../lib/calculations';

function kindLabel(k: string) {
  return DESSERT_PRODUCT_KIND_OPTIONS.find(o => o.value === k)?.label ?? k;
}

function groupHistoryRows(history: HistoryEntry[]) {
  const m = new Map<string, HistoryEntry[]>();
  for (const h of history) {
    const g = h.orderGroupId;
    m.set(g, [...(m.get(g) || []), h]);
  }
  return [...m.entries()]
    .map(([groupId, entries]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const totalRevenue = sorted.reduce((s, e) => s + e.totalRevenue, 0);
      const totalProfit = sorted.reduce((s, e) => s + e.totalProfit, 0);
      return {
        groupId,
        entries: sorted,
        firstDate: first.date,
        sourceCommandeId: first.sourceCommandeId,
        customerType: first.customerType,
        totalRevenue,
        totalProfit,
        saleLabel: first.saleLabel?.trim() ?? '',
      };
    })
    .sort((a, b) => b.firstDate.localeCompare(a.firstDate));
}

interface Props {
  history: HistoryEntry[];
  commandes: Commande[];
  setActiveTab: (tab: Tab) => void;
  onDelete: (id: string) => Promise<void>;
  onDeleteOrderGroup: (orderGroupId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PERIODS: { value: StatPeriod; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'all', label: 'Tout' },
];

const PAGE_SIZE = 20;

export const HistoryScreen: React.FC<Props> = ({
  history,
  commandes,
  setActiveTab,
  onDelete,
  onDeleteOrderGroup,
  showToast,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [groupOpen, setGroupOpen] = useState<ReturnType<typeof groupHistoryRows>[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [orderGroupToDelete, setOrderGroupToDelete] = useState<string | null>(null);
  const [period, setPeriod] = useState<StatPeriod>('month');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'particulier' | 'pro'>('all');
  const [showAll, setShowAll] = useState(false);

  const filteredHistory = useMemo(() => {
    const byPeriod = filterHistoryByPeriod(history, period);
    return filterHistoryByCustomerType(byPeriod, customerFilter);
  }, [history, period, customerFilter]);
  const stats = useMemo(() => computeGlobalStats(filteredHistory), [filteredHistory]);
  const orderGroups = useMemo(() => groupHistoryRows(filteredHistory), [filteredHistory]);
  const visibleGroups = useMemo(
    () => showAll ? orderGroups : orderGroups.slice(0, PAGE_SIZE),
    [orderGroups, showAll],
  );

  const todayISO = new Date().toISOString().split('T')[0];
  const todayCommandes = useMemo(
    () => commandes.filter(c => c.deliveryDate === todayISO && c.status !== 'delivered'),
    [commandes, todayISO],
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    showToast('Enregistrement supprimé', 'info');
    setDeleteTarget(null);
    setSelectedEntry(null);
  };

  const confirmDeleteOrderGroup = async () => {
    if (!orderGroupToDelete) return;
    await onDeleteOrderGroup(orderGroupToDelete);
    showToast('Vente supprimée', 'info');
    setOrderGroupToDelete(null);
    setGroupOpen(null);
    setSelectedEntry(null);
  };

  const sameGroupCount = (orderGroupId: string) =>
    history.filter(h => h.orderGroupId === orderGroupId).length;

  const marginColor = (rate: number) => {
    if (rate >= 0.6) return 'text-emerald-500';
    if (rate >= 0.4) return 'text-amber-500';
    return 'text-red-500';
  };

  const periodLabel = period === 'week' ? '7 derniers jours' : period === 'month' ? '30 derniers jours' : 'Depuis le début';
  const hasCustomFilters = period !== 'month' || customerFilter !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto scrollbar-hide px-2 pb-32"
    >
      <PageHeader
        title="Ventes"
        description={`${periodLabel} · ${stats.totalSales} vente${stats.totalSales > 1 ? 's' : ''}`}
      />

      <div className="px-4 space-y-4">
        {/* Filtres */}
        <div className="min-w-0 space-y-3 pt-1">
          {hasCustomFilters && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setPeriod('month'); setCustomerFilter('all'); setShowAll(false); }}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gourmand-biscuit transition-colors hover:bg-gourmand-border/40 hover:text-gourmand-chocolate active:scale-[0.98]"
              >
                <RotateCcw size={12} aria-hidden />
                Réinitialiser
              </button>
            </div>
          )}
          <FilterField
            label="Période"
            footer={<FilterSortByCustomer value={customerFilter} onChange={v => { setCustomerFilter(v); setShowAll(false); }} />}
          >
            <FilterPillRow
              options={PERIODS.map(p => ({ value: p.value, label: p.label }))}
              value={period}
              onChange={v => { setPeriod(v); setShowAll(false); }}
              aria-label="Filtrer par période"
            />
          </FilterField>
        </div>

        {/* Alerte livraisons aujourd'hui */}
        <AnimatePresence>
          {todayCommandes.length > 0 && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => setActiveTab('commandes')}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-orange-50 border border-orange-200 text-left overflow-hidden"
            >
              <span className="text-xl flex-shrink-0">📦</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-orange-700">
                  {todayCommandes.length} commande{todayCommandes.length > 1 ? 's' : ''} à livrer aujourd'hui
                </p>
                <p className="text-[10px] text-orange-600/80 truncate">
                  {todayCommandes.map(c => c.clientName).join(', ')}
                </p>
              </div>
              <ChevronRight size={14} className="text-orange-400 flex-shrink-0" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Hero KPI — dark card */}
        <div className="gourmand-card-dark p-6 rounded-2xl">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Argent encaissé</p>
            <TrendingUp size={14} className="opacity-40 mt-0.5 shrink-0" />
          </div>
          <p className="text-4xl font-bold tracking-tight mb-4">{fmt(stats.totalRevenue)}</p>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Bénéfice</p>
              <p className="text-xl font-bold text-emerald-400">{fmt(stats.totalProfit)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Coût des ingrédients</p>
              <p className="text-xl font-semibold opacity-80">{fmt(stats.totalCost)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium opacity-80">
            <span className={`font-bold ${stats.marginRate >= 0.6 ? 'text-emerald-400' : stats.marginRate >= 0.4 ? 'text-amber-300' : 'text-red-300'}`}>{fmtPct(stats.marginRate)}</span> de bénéfice · {stats.totalDessertsSold} pièce{stats.totalDessertsSold > 1 ? 's' : ''} vendue{stats.totalDessertsSold > 1 ? 's' : ''}
          </p>
        </div>

        {/* Top 3 */}
        {stats.top3Profit && stats.top3Profit.length > 0 && (
          <SectionCard title="Desserts les plus rentables">
            <div className="space-y-1">
              {stats.top3Profit.map((d, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={d.name} className="flex items-center gap-3 py-2">
                    <span className="text-base w-6 text-center shrink-0">{medals[idx]}</span>
                    <span className="text-lg shrink-0">{d.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{d.name}</p>
                      <p className="text-[10px] text-gourmand-biscuit">{d.count} pièce{d.count > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">{fmt(d.profit)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Dernières ventes */}
        <SectionCard title="Dernières ventes" padding={false}>
          {orderGroups.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-sm text-gourmand-chocolate mb-1">
                {period === 'all' ? 'Aucune vente' : 'Aucune vente sur cette période'}
              </p>
              <p className="text-[11px] text-gourmand-biscuit">
                {period !== 'all' ? 'Touchez « Tout » pour voir toutes les ventes' : 'Faites votre première vente dans Caisse'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gourmand-border/60">
              {visibleGroups.map(g => {
                const cmd = g.sourceCommandeId
                  ? commandes.find(c => c.id === g.sourceCommandeId)
                  : null;
                const isMulti = g.entries.length > 1;
                const isFromCommande = Boolean(g.sourceCommandeId);
                const one = g.entries[0];
                const marginRate = g.totalRevenue > 0 ? g.totalProfit / g.totalRevenue : 0;
                return (
                  <button
                    key={g.groupId}
                    type="button"
                    onClick={() => {
                      if (g.entries.length === 1) { setSelectedEntry(g.entries[0]); return; }
                      setGroupOpen(g);
                    }}
                    className="w-full p-4 flex justify-between items-center hover:bg-gourmand-bg/50 active:bg-gourmand-bg transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0" aria-hidden>
                        {isFromCommande ? '🧾' : isMulti ? g.entries[0].dessertEmoji : one.dessertEmoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gourmand-chocolate truncate">
                          {isMulti
                            ? (cmd ? cmd.clientName : `${g.entries.length} lignes`)
                            : (cmd ? cmd.clientName : `${one.quantitySold}× ${one.dessertName}`)}
                        </p>
                        {!isFromCommande && g.saleLabel ? (
                          <p className="text-[11px] text-gourmand-cocoa/75 mt-0.5 line-clamp-1 italic">{g.saleLabel}</p>
                        ) : null}
                        {!isMulti && cmd && (
                          <p className="text-[11px] text-gourmand-biscuit/90 truncate mt-0.5">
                            {one.quantitySold}× {one.dessertName}
                          </p>
                        )}
                        <p className="text-[10px] font-medium text-gourmand-biscuit mt-0.5">
                          {new Date(g.firstDate).toLocaleDateString('fr-FR')} ·{' '}
                          {new Date(g.firstDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {isFromCommande && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                              Commande
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            g.customerType === 'pro'
                              ? 'bg-gourmand-chocolate text-white'
                              : 'bg-gourmand-bg text-gourmand-biscuit border border-gourmand-border'
                          }`}>
                            {g.customerType === 'pro' ? 'Pro' : 'Particulier'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold text-sm tabular-nums">{fmt(g.totalRevenue)}</p>
                        <p className={`text-[10px] font-bold tabular-nums ${marginColor(marginRate)}`}>
                          +{fmt(g.totalProfit)}
                        </p>
                      </div>
                      <ChevronDown size={14} className="text-gourmand-biscuit -rotate-90" />
                    </div>
                  </button>
                );
              })}

              {/* Voir plus / tout afficher */}
              {!showAll && orderGroups.length > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full py-4 text-sm font-semibold text-gourmand-biscuit hover:text-gourmand-chocolate hover:bg-gourmand-bg/50 transition-colors text-center"
                >
                  Voir les {orderGroups.length - PAGE_SIZE} transactions précédentes
                </button>
              )}
              {showAll && orderGroups.length > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="w-full py-4 text-[11px] font-semibold text-gourmand-biscuit hover:text-gourmand-chocolate transition-colors text-center"
                >
                  Réduire
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Modale ticket (groupe) */}
      <AnimatePresence>
        {groupOpen && !selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-12 sm:pb-32"
          >
            <div className="absolute inset-0 bg-gourmand-chocolate/40 backdrop-blur-sm" onClick={() => setGroupOpen(null)} />
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="relative flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            >
              <div className="border-b border-gourmand-border p-5 flex shrink-0 justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gourmand-biscuit mb-1">Vente</p>
                  <h3 className="text-lg font-bold tracking-tight break-words">
                    {groupOpen.sourceCommandeId
                      ? commandes.find(c => c.id === groupOpen.sourceCommandeId)?.clientName ?? 'Client'
                      : 'Vente directe'}
                  </h3>
                  {groupOpen.saleLabel && !groupOpen.sourceCommandeId && (
                    <p className="text-sm text-gourmand-cocoa/80 mt-1.5 break-words leading-snug">{groupOpen.saleLabel}</p>
                  )}
                  <p className="text-xs text-gourmand-biscuit mt-1">
                    {new Date(groupOpen.firstDate).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                    {groupOpen.entries.length} ligne{groupOpen.entries.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupOpen(null)}
                  className="h-9 w-9 flex-shrink-0 rounded-full bg-gourmand-bg flex items-center justify-center text-gourmand-chocolate"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-gourmand-border/50">
                {groupOpen.entries.map(line => (
                  <button
                    type="button"
                    key={line.id}
                    onClick={() => { setGroupOpen(null); setSelectedEntry(line); }}
                    className="w-full flex items-start justify-between gap-3 py-3 text-left hover:bg-gourmand-bg/40 transition-colors"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="text-xl flex-shrink-0">{line.dessertEmoji}</span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gourmand-biscuit">{kindLabel(line.productKind)}</p>
                        <p className="font-semibold text-sm text-gourmand-chocolate leading-tight">{line.dessertName}</p>
                        {line.revenueCaption && (
                          <p className="text-[10px] text-gourmand-chocolate/80 font-medium mt-0.5">{line.revenueCaption}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums">{fmt(line.totalRevenue)}</p>
                      <p className="text-[10px] font-bold text-emerald-600 tabular-nums">+{fmt(line.totalProfit)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-2 border-t border-gourmand-border bg-gourmand-bg/50 p-4">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="font-semibold text-gourmand-biscuit">Total</span>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmt(groupOpen.totalRevenue)}</p>
                    <p className="text-xs font-bold text-emerald-600 tabular-nums">+{fmt(groupOpen.totalProfit)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderGroupToDelete(groupOpen.groupId)}
                  className="w-full py-3.5 text-[11px] font-bold uppercase tracking-widest text-red-500 bg-red-50 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={16} /> Supprimer cette vente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modale détail ligne */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-12 sm:pb-32"
          >
            <div className="absolute inset-0 bg-gourmand-chocolate/40 backdrop-blur-sm" onClick={() => setSelectedEntry(null)} />
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="relative w-full max-w-[400px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-gourmand-border flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gourmand-biscuit mb-1">
                    {new Date(selectedEntry.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <h3 className="text-lg font-bold tracking-tight">
                    {selectedEntry.dessertEmoji} {selectedEntry.quantitySold}× {selectedEntry.dessertName}
                  </h3>
                  {selectedEntry.saleLabel && !selectedEntry.sourceCommandeId && (
                    <p className="text-sm text-gourmand-cocoa/80 mt-1 break-words">{selectedEntry.saleLabel}</p>
                  )}
                  <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    selectedEntry.customerType === 'pro'
                      ? 'bg-gourmand-chocolate text-white'
                      : 'bg-gourmand-bg text-gourmand-biscuit border border-gourmand-border'
                  }`}>
                    {selectedEntry.customerType === 'pro' ? 'Pro' : 'Particulier'}
                  </span>
                </div>
                <button onClick={() => setSelectedEntry(null)} className="w-9 h-9 rounded-full bg-gourmand-bg flex items-center justify-center text-gourmand-chocolate">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gourmand-bg rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-gourmand-biscuit mb-1">C.A. total</p>
                    <p className="font-bold text-base tabular-nums">{fmt(selectedEntry.totalRevenue)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Bénéfice</p>
                    <p className="font-bold text-base text-emerald-700 tabular-nums">{fmt(selectedEntry.totalProfit)}</p>
                  </div>
                  <div className="bg-gourmand-bg rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-gourmand-biscuit mb-1">Coût des ingrédients</p>
                    <p className="font-bold text-sm tabular-nums">{fmt(selectedEntry.totalCost)}</p>
                  </div>
                  <div className="bg-gourmand-bg rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-gourmand-biscuit mb-1">Marge</p>
                    <p className={`font-bold text-sm tabular-nums ${marginColor(selectedEntry.marginRate)}`}>
                      {fmtPct(selectedEntry.marginRate)}
                    </p>
                  </div>
                </div>

                {selectedEntry.bundleOfferLabelAtSale && (
                  <p className="text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-2 rounded-xl">
                    Offre : {selectedEntry.bundleOfferLabelAtSale}
                  </p>
                )}
                {selectedEntry.revenueCaption && (
                  <p className="text-sm font-medium text-gourmand-chocolate leading-relaxed">
                    {selectedEntry.revenueCaption}
                  </p>
                )}

                {sameGroupCount(selectedEntry.orderGroupId) > 1 && (
                  <button
                    type="button"
                    onClick={() => setOrderGroupToDelete(selectedEntry.orderGroupId)}
                    className="w-full py-3.5 text-[11px] font-bold uppercase tracking-widest text-amber-900/90 bg-amber-100/80 border border-amber-200/80 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Toute la vente ({sameGroupCount(selectedEntry.orderGroupId)} lignes)
                  </button>
                )}

                <button
                  onClick={() => { setSelectedEntry(null); setDeleteTarget(selectedEntry); }}
                  className="w-full py-4 text-[11px] font-bold uppercase tracking-widest text-red-500 bg-red-50 rounded-xl flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> {sameGroupCount(selectedEntry.orderGroupId) > 1 ? 'Cette ligne seule' : 'Supprimer la vente'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Annulation"
            message="Supprimer cette vente définitivement ?"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
        {orderGroupToDelete && (
          <ConfirmDialog
            title="Supprimer cette vente"
            message={`Supprimer toute cette vente (${sameGroupCount(orderGroupToDelete)} ligne(s)) ?`}
            onConfirm={confirmDeleteOrderGroup}
            onCancel={() => setOrderGroupToDelete(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
