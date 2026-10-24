import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Check,
  Package,
  Clock,
  ChevronRight,
  Bell,
  BellOff,
  X,
  ChefHat,
  ClipboardList,
  ChevronDown,
  Scale,
  CheckCheck,
  ShoppingBasket,
} from 'lucide-react';
import { Commande, CommandeItem, CommandeStatus, NotifyBefore, Dessert, RawIngredient, Base, ShowToastOptions, BundleOfferRule } from '../types';
import { buildCommandeSaleAllocations } from '../lib/deliveryBundle';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconActionButton } from '../components/IconActionButton';
import { FormLabel } from '../components/FormLabel';
import { ScaleModal } from '../components/ScaleModal';
import { ShoppingListView } from '../components/ShoppingListView';
import { CUSTOMER_TYPE_VALIDATE_OPTIONS, FilterChipRow, FilterField, FilterPillRow, FilterSortByCustomer } from '../components/FilterControls';
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationSupported,
} from '../lib/notifications';
import {
  clampProducedQty,
  commandeProductionComplete,
  dessertLabelForKey,
  kitchenLinesByDessert,
  mergeCommandeItems,
  normalizeCommandeItem,
  normalizeCommandeItems,
  productionKey,
  totalDessertsOrdered,
  totalDessertsRemaining,
} from '../lib/commandeProduction';
import { commandeHiddenFromOrdresList, localDateISO } from '../lib/dateLocal';

interface Props {
  commandes: Commande[];
  desserts: Dessert[];
  ingredients: RawIngredient[];
  bases: Base[];
  bundleRules: BundleOfferRule[];
  onSave: (cmd: Commande) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSale: (
    dessert: Dessert,
    quantity: number,
    customerType: 'particulier' | 'pro',
    options?: {
      orderGroupId?: string;
      sourceCommandeId?: string | null;
      frozenRevenue?: { totalRevenue: number; unitPrice: number };
      revenueCaption?: string;
      bundleOfferLabelAtSale?: string;
    },
  ) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info', opts?: ShowToastOptions) => void;
}

type ScreenTab = 'commandes' | 'cuisine' | 'courses';

const STATUS_LABEL: Record<CommandeStatus, string> = {
  pending: 'En attente',
  ready: 'Prête',
  delivered: 'Livrée',
};

const STATUS_NEXT: Record<CommandeStatus, CommandeStatus | null> = {
  pending: 'ready',
  ready: 'delivered',
  delivered: null,
};

const STATUS_NEXT_LABEL: Record<CommandeStatus, string> = {
  pending: 'Marquer prête',
  ready: 'Marquer livrée',
  delivered: '',
};

const NOTIFY_OPTIONS: { value: NotifyBefore; label: string }[] = [
  { value: 2, label: '2 jours avant' },
  { value: 1, label: '1 jour avant' },
  { value: 0, label: 'Jour même (8h)' },
];

function urgencyClass(deliveryDate: string, status: CommandeStatus): string {
  if (status === 'delivered') return 'border-stone-200 bg-stone-50/80 opacity-70';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((new Date(deliveryDate + 'T12:00:00').getTime() - today.getTime()) / 86400000);
  if (diff < 0 && (status === 'pending' || status === 'ready')) {
    return 'border-red-200 bg-red-50/50 ring-1 ring-red-100/80';
  }
  if (diff < 0) return 'border-amber-200/80 bg-amber-50/20';
  if (diff === 0) return 'border-orange-200 bg-orange-50/40';
  if (diff === 1) return 'border-amber-200 bg-amber-50/30';
  return 'border-gourmand-border bg-white';
}

function urgencyBadge(deliveryDate: string, status: CommandeStatus): { label: string; cls: string } | null {
  if (status === 'delivered') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((new Date(deliveryDate + 'T12:00:00').getTime() - today.getTime()) / 86400000);
  /* En retard : uniquement attente / prête, pas autre (ex. filtre livrée). */
  if (diff < 0 && (status === 'pending' || status === 'ready')) {
    return { label: 'En retard', cls: 'bg-red-100 text-red-800 border border-red-200' };
  }
  if (diff < 0) return null;
  if (diff === 0) return { label: "Aujourd'hui", cls: 'bg-orange-100 text-orange-600' };
  if (diff === 1) return { label: 'Demain', cls: 'bg-amber-100 text-amber-600' };
  return null;
}

/** Regroupe la liste par échéance : on voit d'un coup d'œil ce qui est urgent. */
function dayBucket(deliveryDate: string, status: CommandeStatus): string {
  if (status === 'delivered') return 'Livrées';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((new Date(deliveryDate + 'T12:00:00').getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'En retard';
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff <= 7) return 'Cette semaine';
  return 'Plus tard';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDeliveryShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function totalPieces(items: CommandeItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function producedPieces(items: CommandeItem[]): number {
  return items.reduce((s, i) => s + clampProducedQty(i), 0);
}

/** Tap sur le cercle d’index i : réduit si déjà au-delà, sinon remplit jusqu’à i+1. */
function nextProducedTap(i: number, produced: number, quantity: number): number {
  const q = Math.max(0, quantity);
  let p = Math.min(q, Math.max(0, produced));
  if (p > i) return i;
  return Math.min(q, i + 1);
}

const BLANK_ITEM: CommandeItem = { dessertId: null, dessertName: '', dessertEmoji: '🍰', quantity: 1, producedQty: 0 };

const BLANK: Commande = {
  id: 'cmd-new',
  clientName: '',
  items: [{ ...BLANK_ITEM }],
  orderDate: localDateISO(),
  deliveryDate: localDateISO(),
  notes: '',
  customerType: 'particulier',
  status: 'pending',
  notifyBefore: [1],
  createdAt: '',
};

const NOTES_CHECKLIST_MAX_ROWS = 20;

/** Checklist type Rappels : rond à gauche, nom client + détail à droite (le dessert est dans l’en-tête du groupe). */
function NotesChecklistUnits({
  quantity,
  produced,
  onChange,
  disabled,
  clientName,
  deliveryShort,
}: {
  quantity: number;
  produced: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  clientName: string;
  deliveryShort: string;
}) {
  const q = Math.max(0, Math.floor(quantity));
  const p = Math.min(q, Math.max(0, Math.floor(produced)));
  if (q === 0) return null;

  if (q > NOTES_CHECKLIST_MAX_ROWS) {
    return (
      <div className="rounded-lg border border-gourmand-border/80 bg-white px-3 py-2 space-y-2" role="group">
        <button
          type="button"
          disabled={disabled || p >= q}
          onClick={() => onChange(Math.min(q, p + 1))}
          className="w-full min-h-11 text-left rounded-lg px-1 py-1 -mx-1 cursor-pointer transition-colors hover:bg-gourmand-bg/60 active:bg-gourmand-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <p className="text-[15px] font-semibold text-gourmand-chocolate truncate pointer-events-none">{clientName}</p>
          <p className="text-xs text-gourmand-biscuit truncate pointer-events-none">
            {deliveryShort} · ×{q}
          </p>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || p <= 0}
            onClick={() => onChange(Math.max(0, p - 1))}
            className="min-h-11 min-w-11 rounded-lg text-lg font-medium text-gourmand-chocolate hover:bg-gourmand-bg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Moins une unité prête"
          >
            −
          </button>
          <span className="flex-1 text-center text-sm font-semibold tabular-nums text-gourmand-chocolate">{p}/{q}</span>
          <button
            type="button"
            disabled={disabled || p >= q}
            onClick={() => onChange(Math.min(q, p + 1))}
            className="min-h-11 min-w-11 rounded-lg text-lg font-medium text-gourmand-chocolate hover:bg-gourmand-bg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Plus une unité prête"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <ul
      className="overflow-hidden rounded-xl border border-gourmand-border/80 bg-white divide-y divide-gourmand-border/50"
      role="list"
      aria-label={`${clientName}, ${p} sur ${q} prêts`}
    >
      {Array.from({ length: q }, (_, i) => {
        const filled = i < p;
        return (
          <li key={i} className="border-b border-gourmand-border/50 last:border-b-0">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={filled}
              aria-label={`${clientName} — unité ${i + 1} sur ${q}`}
              onClick={() => onChange(nextProducedTap(i, p, q))}
              className="flex w-full min-h-[52px] items-center gap-3 pl-3 pr-3 py-2 text-left cursor-pointer transition-colors hover:bg-gourmand-bg/50 active:bg-gourmand-bg/80 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gourmand-chocolate"
            >
              <span
                className={`pointer-events-none shrink-0 flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 ${
                  filled ? 'border-emerald-600 bg-emerald-500 text-white' : 'border-stone-300 bg-white'
                }`}
                aria-hidden
              >
                {filled ? <Check size={13} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-gourmand-chocolate truncate pointer-events-none">
                  {clientName}
                </span>
                {i === 0 ? (
                  <span className="mt-0.5 block text-xs text-gourmand-biscuit truncate pointer-events-none">
                    {deliveryShort}
                    <span className="tabular-nums"> · ×{q}</span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs text-gourmand-biscuit tabular-nums pointer-events-none">
                    {i + 1}/{q}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const CommandesScreen: React.FC<Props> = ({ commandes, desserts, ingredients, bases, bundleRules, onSave, onDelete, onAddSale, showToast }) => {
  const [screenTab, setScreenTab] = useState<ScreenTab>('commandes');
  const [formOpen, setFormOpen] = useState(false);
  const [detailCommand, setDetailCommand] = useState<Commande | null>(null);
  /** Panneau « Options & détail » dans le modal commande (replié par défaut). */
  const [formMoreOpen, setFormMoreOpen] = useState(false);
  const [detailMoreOpen, setDetailMoreOpen] = useState(false);
  /** Ligne desserts nouvellement ajoutée (flash visuel). */
  const [detailHighlightLineIdx, setDetailHighlightLineIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<Commande>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<Commande | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<CommandeStatus | 'all'>('all');
  const [customerFilterOrdres, setCustomerFilterOrdres] = useState<'all' | 'particulier' | 'pro'>('all');
  const [notifPerm, setNotifPerm] = useState<ReturnType<typeof getNotificationPermission>>(getNotificationPermission);
  /** Recette ouverte dans ScaleModal depuis le board cuisine */
  const [kitchenScaleTarget, setKitchenScaleTarget] = useState<{ dessert: Dessert; qty: number } | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<Commande | null>(null);
  const [converting, setConverting] = useState(false);
  /** Clés de groupe dessert dépliés dans l’onglet Cuisine (par défaut : aucun = tout fermé). */
  const [kitchenExpandedKeys, setKitchenExpandedKeys] = useState<Set<string>>(() => new Set());
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuteTick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Jour calendaire local — mis à jour souvent + au retour d’onglet (évite liste Ordres figée au mauvais jour). */
  const [calendarDay, setCalendarDay] = useState(() => localDateISO());
  useEffect(() => {
    const sync = () => {
      const d = localDateISO();
      setCalendarDay(prev => (prev !== d ? d : prev));
    };
    const id = window.setInterval(sync, 5_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', sync);
    };
  }, []);

  /** Sauf commandes livrées dont le jour de livraison (réel) est passé : listées en compta, plus sur Ordres. */
  const commandesPourOrdres = useMemo(() => {
    return commandes.filter(c => !commandeHiddenFromOrdresList(c, calendarDay));
  }, [commandes, calendarDay]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? commandesPourOrdres : commandesPourOrdres.filter(c => c.status === filter);
    if (customerFilterOrdres !== 'all') {
      list = list.filter(c => c.customerType === customerFilterOrdres);
    }
    return [...list].sort((a, b) => {
      if (a.status === 'delivered' && b.status !== 'delivered') return 1;
      if (b.status === 'delivered' && a.status !== 'delivered') return -1;
      return a.deliveryDate.localeCompare(b.deliveryDate);
    });
  }, [commandesPourOrdres, filter, customerFilterOrdres]);

  const hasBothTypes = useMemo(
    () => new Set(commandesPourOrdres.map(c => c.customerType)).size > 1,
    [commandesPourOrdres],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: Commande[] }[] = [];
    for (const c of filtered) {
      const label = dayBucket(c.deliveryDate, c.status);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [filtered]);

  const pendingCount = useMemo(
    () => commandesPourOrdres.filter(c => c.status === 'pending').length,
    [commandesPourOrdres],
  );
  const remainingKitchen = useMemo(() => totalDessertsRemaining(commandes), [commandes]);
  const orderedKitchen = useMemo(() => totalDessertsOrdered(commandes), [commandes]);
  const kitchenPct = orderedKitchen > 0 ? Math.round(((orderedKitchen - remainingKitchen) / orderedKitchen) * 100) : 0;

  /** Ordre stable (nom) : ne pas retrier par « restant » pour éviter que les cartes sautent au clic. */
  const kitchenGroups = useMemo(() => {
    const map = kitchenLinesByDessert(commandes);
    return [...map.entries()]
      .map(([key, lines]) => ({ key, lines, ...dessertLabelForKey(key, lines) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [commandes]);

  const kitchenGroupKeyList = useMemo(() => kitchenGroups.map(g => g.key), [kitchenGroups]);

  useEffect(() => {
    const valid = new Set(kitchenGroupKeyList);
    setKitchenExpandedKeys(prev => {
      const next = new Set<string>();
      for (const k of prev) {
        if (valid.has(k)) next.add(k);
      }
      const same = prev.size === next.size && [...prev].every(k => next.has(k));
      return same ? prev : next;
    });
  }, [kitchenGroupKeyList]);


  const openDetail = (cmd: Commande) => {
    const normalized = normalizeCommandeItems(cmd.items.map(i => ({ ...i })));
    setDetailCommand({ ...cmd, items: normalized });
    setEditing({ ...cmd, items: normalized.length ? normalized.map(i => ({ ...i })) : [{ ...BLANK_ITEM }] });
    setDetailMoreOpen(false);
  };

  const openNewCommandForm = () => {
    const d = localDateISO();
    setEditing({ ...BLANK, id: 'cmd-new', items: [{ ...BLANK_ITEM }], orderDate: d, deliveryDate: d });
    setFormOpen(true);
  };

  useEffect(() => {
    const id = detailCommand?.id;
    if (!id) return;
    const fresh = commandes.find(c => c.id === id);
    if (!fresh) return;
    const normalized = normalizeCommandeItems(fresh.items.map(i => ({ ...i })));
    setDetailCommand(prev => (prev && prev.id === id ? { ...fresh, items: normalized } : prev));
  }, [commandes, detailCommand?.id]);

  const setItem = (idx: number, patch: Partial<CommandeItem>) => {
    setEditing(prev => {
      const items = prev.items.map((it, i) => (i === idx ? normalizeCommandeItem({ ...it, ...patch }) : it));
      return { ...prev, items };
    });
  };

  const handleDessertChange = (idx: number, dessertId: string) => {
    if (!dessertId) {
      setItem(idx, { dessertId: null, dessertName: '', dessertEmoji: '🍰', producedQty: 0 });
      return;
    }
    const d = desserts.find(x => x.id === dessertId);
    if (!d) return;

    setEditing(prev => {
      const keyNew = productionKey({
        dessertId: d.id,
        dessertName: d.name,
        dessertEmoji: d.emoji,
        quantity: 1,
      });
      if (!keyNew) {
        const line = normalizeCommandeItem({
          ...prev.items[idx],
          dessertId: d.id,
          dessertName: d.name,
          dessertEmoji: d.emoji,
          producedQty: 0,
        });
        return { ...prev, items: prev.items.map((it, i) => (i === idx ? line : it)) };
      }

      const dupIdx = prev.items.findIndex((it, i) => {
        if (i === idx) return false;
        const k = productionKey(it);
        return k === keyNew;
      });

      if (dupIdx < 0) {
        const line = normalizeCommandeItem({
          ...prev.items[idx],
          dessertId: d.id,
          dessertName: d.name,
          dessertEmoji: d.emoji,
          producedQty: 0,
        });
        return { ...prev, items: prev.items.map((it, i) => (i === idx ? line : it)) };
      }

      const cur = prev.items[idx];
      const other = prev.items[dupIdx];
      const totalQ = Math.max(0, Math.floor(other.quantity)) + Math.max(0, Math.floor(cur.quantity));
      const sumP = clampProducedQty(other) + clampProducedQty(cur);
      const merged = normalizeCommandeItem({
        ...other,
        dessertId: d.id,
        dessertName: d.name,
        dessertEmoji: d.emoji,
        quantity: Math.max(1, totalQ),
        producedQty: Math.min(Math.max(1, totalQ), sumP),
      });

      const next = prev.items.filter((_, i) => i !== idx && i !== dupIdx);
      const insertAt = Math.min(idx, dupIdx);
      next.splice(insertAt, 0, merged);
      return { ...prev, items: next };
    });
  };

  const MAX_DESSERT_LINES = 24;

  const addItem = (opts?: { prepend?: boolean }) => {
    setEditing(prev => {
      if (prev.items.length >= MAX_DESSERT_LINES) {
        void Promise.resolve().then(() => showToast(`Maximum ${MAX_DESSERT_LINES} lignes de desserts.`, 'error'));
        return prev;
      }
      const line = { ...BLANK_ITEM };
      if (opts?.prepend) {
        return { ...prev, items: [line, ...prev.items] };
      }
      return { ...prev, items: [...prev.items, line] };
    });
    if (opts?.prepend) {
      setDetailHighlightLineIdx(0);
      window.setTimeout(() => setDetailHighlightLineIdx(null), 1000);
    }
  };

  const removeItem = (idx: number) => {
    setEditing(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    showToast('Ligne supprimée', 'info');
  };

  const toggleNotify = (val: NotifyBefore) => {
    setEditing(prev => {
      const has = prev.notifyBefore.includes(val);
      return {
        ...prev,
        notifyBefore: has ? prev.notifyBefore.filter(v => v !== val) : [...prev.notifyBefore, val],
      };
    });
  };

  const handleRequestPerm = async () => {
    const granted = await requestNotificationPermission();
    setNotifPerm(getNotificationPermission());
    if (!granted) showToast('Notifications refusées. Autorise dans Réglages > Safari.', 'error');
  };

  const persistCommande = useCallback(
    async (cmd: Commande, toastMsg?: string, toastOpts?: ShowToastOptions) => {
      const normalized = { ...cmd, items: normalizeCommandeItems(cmd.items) };
      await onSave(normalized);
      if (toastMsg) showToast(toastMsg, 'success', toastOpts);
    },
    [onSave, showToast],
  );

  const persistWithMergedItems = useCallback(
    async (cmd: Commande, toastMsg?: string) => {
      const merged = mergeCommandeItems(cmd.items);
      await persistCommande({ ...cmd, items: merged }, toastMsg);
    },
    [persistCommande],
  );

  const patchCommandeItem = useCallback(
    async (cmd: Commande, itemIndex: number, patch: Partial<CommandeItem>) => {
      const items = cmd.items.map((it, i) => (i === itemIndex ? normalizeCommandeItem({ ...it, ...patch }) : it));
      const candid = { ...cmd, items };
      const merged = mergeCommandeItems(items);
      if (cmd.status === 'pending' && commandeProductionComplete(candid)) {
        await persistCommande(
          { ...cmd, items: merged, status: 'ready' },
          'Commande prête ✓',
          { emphasis: cmd.clientName.trim() || 'Commande' },
        );
      } else if (cmd.status === 'ready' && !commandeProductionComplete(candid)) {
        await persistCommande({ ...cmd, items: merged, status: 'pending' }, 'Repasse en attente (cuisine)');
      } else {
        await persistCommande({ ...cmd, items: merged });
      }
    },
    [persistCommande],
  );

  const handleSave = async () => {
    if (!editing.clientName.trim()) {
      showToast('Nom du client requis', 'error');
      return;
    }
    const validItems = editing.items.filter(i => i.dessertName.trim());
    if (validItems.length === 0) {
      showToast('Au moins un dessert requis', 'error');
      return;
    }
    if (!editing.deliveryDate) {
      showToast('Date de livraison requise', 'error');
      return;
    }
    setSaving(true);
    try {
      await persistWithMergedItems(
        { ...editing, items: validItems, status: 'pending' },
        'Commande créée ✓',
      );
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetailCommand = async () => {
    if (!detailCommand) return;
    if (!editing.clientName.trim()) {
      showToast('Nom du client requis', 'error');
      return;
    }
    const validItems = editing.items.filter(i => i.dessertName.trim());
    if (validItems.length === 0) {
      showToast('Au moins un dessert requis', 'error');
      return;
    }
    if (!editing.deliveryDate) {
      showToast('Date de livraison requise', 'error');
      return;
    }
    let nextStatus = editing.status;
    const mergedItems = mergeCommandeItems(validItems);
    if (nextStatus === 'ready' && !commandeProductionComplete({ ...detailCommand, items: mergedItems })) {
      showToast('Cuisine : tout cocher avant « Prête ».', 'error');
      nextStatus = 'pending';
    }
    setSaving(true);
    try {
      const effectiveDeliveryDate =
        nextStatus === 'delivered' ? localDateISO() : editing.deliveryDate;
      const saved = {
        ...detailCommand,
        clientName: editing.clientName.trim(),
        orderDate: editing.orderDate,
        deliveryDate: effectiveDeliveryDate,
        notes: editing.notes,
        customerType: editing.customerType,
        notifyBefore: editing.notifyBefore,
        status: nextStatus,
        items: mergedItems,
      };
      await persistCommande(saved, 'Enregistré ✓');
      setDetailCommand(null);
      setDetailMoreOpen(false);
      setDetailHighlightLineIdx(null);
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceStatus = async (cmd: Commande) => {
    const live = commandes.find(c => c.id === cmd.id) ?? cmd;
    const next = STATUS_NEXT[live.status];
    if (!next) return;
    if (next === 'ready') {
      if (!commandeProductionComplete(live)) {
        showToast('Cuisine : tout cocher d’abord.', 'error');
        setScreenTab('cuisine');
        return;
      }
      await persistCommande({ ...live, status: next }, `${STATUS_LABEL[next]} ✓`);
      setDetailCommand(null);
      setDetailMoreOpen(false);
      setDetailHighlightLineIdx(null);
      return;
    }
    if (next === 'delivered') {
      setDetailCommand(null);
      setDetailMoreOpen(false);
      setDetailHighlightLineIdx(null);
      setDeliverTarget(live);
    }
  };

  const handleConfirmDeliver = async (recordSale: boolean) => {
    if (!deliverTarget) return;
    setConverting(true);
    try {
      if (recordSale) {
        const orderGroupId = crypto.randomUUID();
        const { lines, skippedLines } = buildCommandeSaleAllocations(
          deliverTarget.items,
          id => desserts.find(d => d.id === id),
          deliverTarget.customerType,
          bundleRules,
        );
        for (const row of lines) {
          await onAddSale(row.dessert, row.quantity, deliverTarget.customerType, {
            orderGroupId,
            sourceCommandeId: deliverTarget.id,
            frozenRevenue: row.frozenRevenue,
            revenueCaption: row.revenueCaption,
            bundleOfferLabelAtSale: row.bundleOfferLabelAtSale,
          });
        }
        if (skippedLines > 0) showToast(`${skippedLines} article(s) ignoré(s) — recette manquante`, 'info');
      }
      const livreeLe = localDateISO();
      await persistCommande({ ...deliverTarget, status: 'delivered', deliveryDate: livreeLe }, 'Commande livrée ✓');
      setDeliverTarget(null);
      setDetailCommand(null);
    } finally {
      setConverting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    showToast('Commande supprimée', 'info');
    setDeleteTarget(null);
    setDetailCommand(null);
  };

  const detailNext = detailCommand ? STATUS_NEXT[detailCommand.status] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-hidden"
    >
      <div className="shrink-0">
        <PageHeader
          title="Commandes"
          description={
            orderedKitchen > 0
              ? `${pendingCount} à préparer · ${remainingKitchen} dessert${remainingKitchen > 1 ? 's' : ''} à faire`
              : `${pendingCount} à préparer`
          }
          action={
            <IconActionButton
              size="compact"
              onClick={openNewCommandForm}
              icon={<Plus size={18} strokeWidth={2.25} />}
              label="Ajouter une commande"
            />
          }
        />

        <div className="px-4 pb-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => setScreenTab('commandes')}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl py-3 px-1 text-[13px] font-semibold transition-all duration-200 ease-out cursor-pointer border active:scale-[0.98] ${
              screenTab === 'commandes'
                ? 'bg-gourmand-chocolate text-white border-gourmand-chocolate'
                : 'bg-white text-gourmand-cocoa border-gourmand-border'
            }`}
          >
            <span className="truncate">Commandes</span>
          </button>
          <button
            type="button"
            onClick={() => setScreenTab('cuisine')}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl py-3 px-1 text-[13px] font-semibold transition-all duration-200 ease-out cursor-pointer border active:scale-[0.98] ${
              screenTab === 'cuisine'
                ? 'bg-gourmand-chocolate text-white border-gourmand-chocolate'
                : 'bg-white text-gourmand-cocoa border-gourmand-border'
            }`}
          >
            <span className="truncate">Cuisine</span>
            {remainingKitchen > 0 && (
              <span
                className={`ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                  screenTab === 'cuisine' ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                {remainingKitchen > 99 ? '99+' : remainingKitchen}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setScreenTab('courses')}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl py-3 px-1 text-[13px] font-semibold transition-all duration-200 ease-out cursor-pointer border active:scale-[0.98] ${
              screenTab === 'courses'
                ? 'bg-gourmand-chocolate text-white border-gourmand-chocolate'
                : 'bg-white text-gourmand-cocoa border-gourmand-border'
            }`}
          >
            <span className="truncate">Courses</span>
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide px-2 pb-32">
        {screenTab === 'courses' && (
          <ShoppingListView commandes={commandes} desserts={desserts} bases={bases} ingredients={ingredients} showToast={showToast} />
        )}

        {screenTab === 'commandes' && (
          <motion.div
            key="commandes-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="min-w-0 overflow-x-hidden"
          >
            <div className="px-2 pb-2 space-y-3">
              <FilterField
                label="Statut"
                footer={hasBothTypes ? <FilterSortByCustomer value={customerFilterOrdres} onChange={setCustomerFilterOrdres} /> : undefined}
              >
                <FilterPillRow
                  options={[
                    { value: 'all', label: 'Toutes' },
                    { value: 'pending', label: STATUS_LABEL.pending },
                    { value: 'ready', label: STATUS_LABEL.ready },
                    { value: 'delivered', label: STATUS_LABEL.delivered },
                  ]}
                  value={filter}
                  onChange={setFilter}
                  aria-label="Filtrer par statut de commande"
                />
              </FilterField>
            </div>

            {notifPerm === 'default' && isNotificationSupported() && (
              <div className="mx-2 mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Bell size={16} className="text-amber-600 shrink-0" aria-hidden />
                <p className="text-xs text-amber-800 font-medium flex-1 min-w-0">Rappels commandes</p>
                <button
                  type="button"
                  onClick={handleRequestPerm}
                  className="text-xs font-bold text-amber-800 underline whitespace-nowrap cursor-pointer shrink-0"
                >
                  Activer
                </button>
              </div>
            )}
            {notifPerm === 'denied' && (
              <div className="mx-2 mb-3 rounded-xl bg-gourmand-bg px-3 py-2">
                <div className="flex gap-2 items-center">
                  <BellOff size={14} className="text-gourmand-biscuit shrink-0" aria-hidden />
                  <p className="text-xs text-gourmand-biscuit font-medium">Rappels désactivés. Réactivez-les dans Réglages › Notifications de l’iPhone.</p>
                </div>
              </div>
            )}

            <div className="px-2 space-y-3">
              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center text-gourmand-biscuit">
                  <Package size={40} className="mx-auto mb-3 opacity-30" aria-hidden />
                  <p className="text-sm font-medium">Aucune commande pour le moment</p>
                  <button type="button" onClick={openNewCommandForm} className="gourmand-btn-primary-compact mt-4 px-5">
                    Nouvelle commande
                  </button>
                </div>
              )}

              {groups.map(group => (
              <section key={group.label} aria-label={group.label} className="space-y-3">
                <h2 className={`pl-1 pt-1 text-xs font-bold uppercase tracking-widest ${group.label === 'En retard' ? 'text-red-600' : 'text-gourmand-cocoa/60'}`}>{group.label} · {group.items.length}</h2>
              <AnimatePresence initial={false}>
                {group.items.map(cmd => {
                  const badge = urgencyBadge(cmd.deliveryDate, cmd.status);
                  const pieces = totalPieces(cmd.items);
                  const prod = producedPieces(cmd.items);
                  const complete = commandeProductionComplete(cmd);
                  return (
                    <motion.button
                      type="button"
                      key={cmd.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`w-full text-left gourmand-card border p-3 cursor-pointer transition-all duration-200 ease-out active:scale-[0.99] ${urgencyClass(cmd.deliveryDate, cmd.status)}`}
                      onClick={() => openDetail(cmd)}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex flex-col items-center gap-0.5 shrink-0 w-9 pt-0.5" aria-hidden>
                          {cmd.items.slice(0, 2).map((it, i) => (
                            <span key={i} className="text-xl leading-none">
                              {it.dessertEmoji || '🍰'}
                            </span>
                          ))}
                          {cmd.items.length > 2 && (
                            <span className="text-[9px] font-bold text-gourmand-biscuit">+{cmd.items.length - 2}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-bold text-sm truncate max-w-full">{cmd.clientName}</span>
                            {cmd.customerType === 'pro' && (
                              <span className="gourmand-chip shrink-0 bg-gourmand-chocolate text-white">Pro</span>
                            )}
                            {cmd.status !== 'pending' && (
                            <span
                              className={`gourmand-chip shrink-0 ${
                                cmd.status === 'ready'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {STATUS_LABEL[cmd.status]}
                            </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gourmand-biscuit">
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <Clock size={10} aria-hidden />
                              {new Date(cmd.deliveryDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            <span className="tabular-nums shrink-0">
                              {pieces} pièce{pieces > 1 ? 's' : ''}
                              {cmd.status === 'pending' && (
                                <span className="text-gourmand-cocoa/80">
                                  {' '}
                                  · cuisine {prod}/{pieces}
                                  {complete ? ' ✓' : ''}
                                </span>
                              )}
                            </span>
                            {cmd.notifyBefore.length > 0 && <Bell size={10} className="text-gourmand-biscuit/60 shrink-0" aria-hidden />}
                          </div>
                          {cmd.notes ? (
                            <p className="text-xs text-gourmand-biscuit/70 mt-1 italic line-clamp-2">{cmd.notes}</p>
                          ) : null}
                        </div>
                        <ChevronRight size={16} className="text-gourmand-biscuit/40 shrink-0 mt-1" aria-hidden />
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              </section>
              ))}
            </div>
          </motion.div>
        )}

        {screenTab === 'cuisine' && (
          <motion.div
            key="cuisine-tab"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="min-w-0 space-y-3 overflow-x-hidden px-3 pb-4"
          >
            <div className="gourmand-card border px-4 py-3 rounded-2xl flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gourmand-chocolate text-white">
                <ChefHat size={20} strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold tabular-nums text-gourmand-chocolate leading-tight">
                  {Math.max(0, orderedKitchen - remainingKitchen)}
                  <span className="text-gourmand-biscuit text-sm font-semibold"> / {orderedKitchen} desserts faits</span>
                </p>
                {orderedKitchen > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gourmand-bg" role="progressbar" aria-valuenow={kitchenPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${kitchenPct}%` }} />
                  </div>
                )}
              </div>
            </div>

            {kitchenGroups.length === 0 && (
              <div className="text-center py-12 text-gourmand-biscuit">
                <ChefHat size={36} className="mx-auto mb-2 opacity-25" aria-hidden />
                <p className="text-sm font-medium text-gourmand-cocoa">Rien en attente</p>
              </div>
            )}

            <div className="space-y-3">
              {kitchenGroups.map(({ key, lines, name, emoji }) => {
                const remaining = lines.reduce((s, l) => s + (l.item.quantity - clampProducedQty(l.item)), 0);
                const total = lines.reduce((s, l) => s + l.item.quantity, 0);
                const done = total - remaining;
                const expanded = kitchenExpandedKeys.has(key);
                const dessertObj = desserts.find(d => lines[0]?.item.dessertId === d.id);
                const allDone = remaining === 0;

                return (
                  <div key={key} className="gourmand-card border rounded-2xl overflow-hidden">
                    {/* En-tête groupe : expand + nom + compteur + actions */}
                    <div className="flex items-center min-w-0 gap-1 p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setKitchenExpandedKeys(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                        className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
                        aria-expanded={expanded}
                      >
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-gourmand-biscuit transition-transform duration-200 ease-out ${expanded ? 'rotate-0' : '-rotate-90'}`}
                          aria-hidden
                        />
                        <span className="text-xl shrink-0" aria-hidden>{emoji}</span>
                        <h3 className="text-[15px] font-bold text-gourmand-chocolate truncate flex-1 min-w-0">{name}</h3>
                        <span className={`text-xs font-bold tabular-nums shrink-0 ${allDone ? 'text-emerald-600' : 'text-gourmand-biscuit'}`}>
                          {done}/{total}
                        </span>
                      </button>

                      {/* Bouton : voir recette ×total */}
                      {dessertObj && (
                        <button
                          type="button"
                          onClick={() => setKitchenScaleTarget({ dessert: dessertObj, qty: total })}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gourmand-border bg-gourmand-bg text-gourmand-biscuit active:bg-gourmand-border ml-1"
                          aria-label={`Voir la recette ×${total} pour ${name}`}
                        >
                          <Scale size={15} />
                        </button>
                      )}

                      {/* Bouton : tout marquer fait */}
                      {!allDone && (
                        <button
                          type="button"
                          onClick={async () => {
                            for (const line of lines) {
                              const cmd = commandes.find(c => c.id === line.commandeId);
                              if (cmd) await patchCommandeItem(cmd, line.itemIndex, { producedQty: line.item.quantity });
                            }
                          }}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 active:bg-emerald-100 ml-1"
                          aria-label={`Tout marquer fait pour ${name}`}
                        >
                          <CheckCheck size={15} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          key={`${key}-panel`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                          className="overflow-hidden border-t border-gourmand-border/50"
                        >
                          <ul className="space-y-3 px-3 pb-3 pt-2">
                            {lines.map((line, lineIdx) => {
                              const cmd = commandes.find(c => c.id === line.commandeId);
                              if (!cmd) return null;
                              const p = clampProducedQty(line.item);
                              const q = line.item.quantity;
                              return (
                                <motion.li
                                  key={`${line.commandeId}-${line.itemIndex}`}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.18, delay: Math.min(lineIdx, 5) * 0.03, ease: [0.25, 0.1, 0.25, 1] }}
                                >
                                  <NotesChecklistUnits
                                    quantity={q}
                                    produced={p}
                                    clientName={line.clientName}
                                    deliveryShort={formatDeliveryShort(line.deliveryDate)}
                                    onChange={async n => {
                                      await patchCommandeItem(cmd, line.itemIndex, { producedQty: n });
                                    }}
                                  />
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Scale modal depuis Cuisine */}
      <AnimatePresence>
        {kitchenScaleTarget && (
          <ScaleModal
            target={{ type: 'dessert', item: kitchenScaleTarget.dessert }}
            ingredients={ingredients}
            bases={bases}
            onClose={() => setKitchenScaleTarget(null)}
            initialQuantity={kitchenScaleTarget.qty}
          />
        )}
      </AnimatePresence>

      {/* Formulaire création / édition */}
      <AnimatePresence>
        {formOpen && (
          <Modal title="Nouvelle commande" onClose={() => setFormOpen(false)}>
            <div className="min-w-0 space-y-4 pb-1">
              <div>
                <FormLabel>Nom du client</FormLabel>
                <input
                  className="gourmand-input w-full min-w-0 text-base"
                  placeholder="Ex : Marie Dupont"
                  value={editing.clientName}
                  onChange={e => setEditing(prev => ({ ...prev, clientName: e.target.value }))}
                />
              </div>

              <div>
                <FormLabel>Client</FormLabel>
                <div className="mt-1">
                  <FilterChipRow
                    options={CUSTOMER_TYPE_VALIDATE_OPTIONS}
                    value={editing.customerType}
                    onChange={v => setEditing(prev => ({ ...prev, customerType: v }))}
                    aria-label="Type de client"
                  />
                </div>
              </div>


              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <FormLabel>Desserts commandés</FormLabel>
                </div>
                <div className="space-y-2">
                  {editing.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex min-w-0 flex-col gap-2 rounded-xl border border-gourmand-border bg-gourmand-bg/30 p-2 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-2xl leading-none" aria-hidden>
                          {item.dessertEmoji || '🍰'}
                        </span>
                        <select
                          className="gourmand-input min-h-11 min-w-0 flex-1 text-base"
                          value={item.dessertId || ''}
                          onChange={e => handleDessertChange(idx, e.target.value)}
                        >
                          <option value="">—</option>
                          {desserts.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.emoji} {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        <label className="sr-only" htmlFor={`new-qty-${idx}`}>
                          Quantité
                        </label>
                        <input
                          id={`new-qty-${idx}`}
                          type="number"
                          min={1}
                          max={999}
                          className="gourmand-input h-11 w-16 shrink-0 text-center text-base"
                          value={item.quantity}
                          onChange={e => setItem(idx, { quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                        />
                        {editing.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                            aria-label="Retirer cette ligne"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addItem()}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gourmand-border bg-white text-sm font-semibold text-gourmand-chocolate active:bg-gourmand-bg"
                >
                  <Plus size={16} strokeWidth={2.25} /> Ajouter un dessert
                </button>
              </div>

              <div>
                <FormLabel>Livraison le</FormLabel>
                <div className="mb-2 mt-1 flex gap-2">
                  {[['Aujourd’hui', 0], ['Demain', 1], ['Dans 2 jours', 2]].map(([label, n]) => {
                    const iso = (() => { const d = new Date(); d.setDate(d.getDate() + (n as number)); return d.toLocaleDateString('sv-SE'); })();
                    const on = editing.deliveryDate === iso;
                    return (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() => setEditing(prev => ({ ...prev, deliveryDate: iso }))}
                        className={`min-h-11 flex-1 rounded-xl border px-2 text-sm font-semibold transition-colors ${on ? 'border-gourmand-chocolate bg-gourmand-chocolate text-white' : 'border-gourmand-border bg-white text-gourmand-cocoa'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  className="gourmand-input w-full max-w-full min-w-0 px-3 text-base"
                  value={editing.deliveryDate}
                  onChange={e => setEditing(prev => ({ ...prev, deliveryDate: e.target.value }))}
                />
              </div>

              <div>
                <FormLabel>Notes</FormLabel>
                <textarea
                  className="gourmand-input w-full resize-none min-h-[80px] text-base"
                  rows={2}
                  placeholder="Allergies, adresse, personnalisation…"
                  value={editing.notes}
                  onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <button
                type="button"
                onClick={() => setFormMoreOpen(o => !o)}
                aria-expanded={formMoreOpen}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-gourmand-biscuit"
              >
                Plus d’options (rappels, date de commande)
                <ChevronDown size={18} className={`transition-transform ${formMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              {formMoreOpen && (
                <div className="space-y-5">
                  <div className="min-w-0">
                    <FormLabel>Commandé le</FormLabel>
                    <input
                      type="date"
                      className="gourmand-input w-full max-w-full min-w-0 px-3 text-base"
                      value={editing.orderDate}
                      onChange={e => setEditing(prev => ({ ...prev, orderDate: e.target.value }))}
                    />
                  </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bell size={16} className="text-gourmand-biscuit shrink-0" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gourmand-biscuit">Rappels</span>
                  {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleRequestPerm}
                      className="ml-auto text-xs font-semibold text-gourmand-chocolate underline cursor-pointer"
                    >
                      {notifPerm === 'denied' ? 'Bloqué' : 'Activer'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {NOTIFY_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => toggleNotify(opt.value)}
                      disabled={notifPerm === 'denied' || notifPerm === 'unsupported'}
                      className={`min-h-11 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        editing.notifyBefore.includes(opt.value)
                          ? 'bg-gourmand-chocolate text-white border-gourmand-chocolate'
                          : 'bg-white text-gourmand-biscuit border-gourmand-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="gourmand-btn-primary w-full cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement…' : 'Créer la commande'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Détail commande : résumé centré, options repliables, actions en pied fixe */}
      <AnimatePresence>
        {detailCommand && (
          <Modal
            title="Commande"
            onClose={() => {
              setDetailCommand(null);
              setDetailMoreOpen(false);
            }}
            footer={
              <div className="flex min-w-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveDetailCommand()}
                  disabled={saving}
                  className="gourmand-btn-primary w-full disabled:cursor-not-allowed"
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
                {detailNext && (
                  <button
                    type="button"
                    onClick={() => void handleAdvanceStatus(detailCommand)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gourmand-border bg-white text-sm font-semibold text-gourmand-chocolate active:bg-gourmand-bg"
                  >
                    <Check size={18} strokeWidth={2.5} aria-hidden />
                    {STATUS_NEXT_LABEL[detailCommand.status]}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(detailCommand)}
                  className="min-h-10 w-full rounded-xl text-sm font-semibold text-red-500 active:bg-red-50"
                >
                  Supprimer la commande
                </button>
              </div>
            }
          >
            <div className="min-w-0 space-y-4 pb-2">
              <div className="text-center">
                <p className="text-xl font-bold leading-tight text-gourmand-chocolate">{editing.clientName}</p>
                <p className="mt-1.5 text-center text-sm leading-snug text-gourmand-biscuit">
                  <span className="inline">
                    Commandé le {formatDate(editing.orderDate)}
                    <span className="mx-1.5 text-gourmand-biscuit/50" aria-hidden>
                      ·
                    </span>
                    Livraison le {formatDate(editing.deliveryDate)}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span
                    className={`gourmand-chip ${
                      editing.customerType === 'pro'
                        ? 'bg-gourmand-chocolate text-white'
                        : 'bg-gourmand-bg text-gourmand-biscuit border border-gourmand-border'
                    }`}
                  >
                    {editing.customerType === 'pro' ? 'Pro' : 'Particulier'}
                  </span>
                  <span
                    className={`gourmand-chip ${
                      editing.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : editing.status === 'ready'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {STATUS_LABEL[editing.status]}
                  </span>
                </div>
                {editing.status === 'pending' && (
                  <p className="mt-3 text-xs font-medium tabular-nums text-gourmand-biscuit">
                    Cuisine {producedPieces(detailCommand.items)}/{totalPieces(detailCommand.items)}
                  </p>
                )}
              </div>

              <ul className="mx-auto max-w-sm divide-y divide-gourmand-border/50 rounded-2xl border border-gourmand-border/80 bg-gourmand-bg/30 p-1">
                {mergeCommandeItems(editing.items).map((row, idx) => (
                  <li
                    key={`${row.dessertId ?? row.dessertName}-${idx}`}
                    className="flex items-center gap-3 px-2 py-2.5 text-left first:pt-2 last:pb-2"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-xl leading-none"
                      aria-hidden
                    >
                      {row.dessertEmoji || '🍰'}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-gourmand-chocolate">{row.dessertName}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-gourmand-cocoa">×{row.quantity}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setDetailMoreOpen(v => !v)}
                aria-expanded={detailMoreOpen}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gourmand-border bg-white py-3 text-sm font-semibold text-gourmand-cocoa transition-colors active:bg-gourmand-bg"
              >
                {detailMoreOpen ? 'Masquer les options' : 'Modifier dates, statut, desserts…'}
                <ChevronDown
                  size={18}
                  className={`text-gourmand-biscuit transition-transform duration-200 ${detailMoreOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              {detailMoreOpen && (
                <div className="space-y-4 border-t border-gourmand-border/60 pt-4">
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                    <div className="min-w-0 overflow-hidden">
                      <FormLabel>Commandé le</FormLabel>
                      <input
                        type="date"
                        className="gourmand-input w-full max-w-full min-w-0 px-3 text-base"
                        value={editing.orderDate}
                        onChange={e => setEditing(prev => ({ ...prev, orderDate: e.target.value }))}
                      />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <FormLabel>Livraison le</FormLabel>
                      <input
                        type="date"
                        className="gourmand-input w-full max-w-full min-w-0 px-3 text-base"
                        value={editing.deliveryDate}
                        onChange={e => setEditing(prev => ({ ...prev, deliveryDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <FormLabel>Client</FormLabel>
                    <input
                      className="gourmand-input w-full min-w-0 text-base"
                      value={editing.clientName}
                      onChange={e => setEditing(prev => ({ ...prev, clientName: e.target.value }))}
                    />
                  </div>

                  <div>
                    <FilterChipRow
                      options={CUSTOMER_TYPE_VALIDATE_OPTIONS}
                      value={editing.customerType}
                      onChange={v => setEditing(prev => ({ ...prev, customerType: v }))}
                      aria-label="Type de client"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gourmand-biscuit">Rappels</span>
                      {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                        <button type="button" onClick={handleRequestPerm} className="text-xs font-semibold text-gourmand-chocolate underline">
                          {notifPerm === 'denied' ? 'Bloqué' : 'Activer'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {NOTIFY_OPTIONS.map(opt => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => toggleNotify(opt.value)}
                          disabled={notifPerm === 'denied' || notifPerm === 'unsupported'}
                          className={`min-h-11 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40 ${
                            editing.notifyBefore.includes(opt.value)
                              ? 'border-gourmand-chocolate bg-gourmand-chocolate text-white'
                              : 'border-gourmand-border bg-white text-gourmand-biscuit'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <FormLabel>Statut</FormLabel>
                    <select
                      className="gourmand-input w-full min-w-0 text-base"
                      value={editing.status}
                      onChange={e => setEditing(prev => ({ ...prev, status: e.target.value as CommandeStatus }))}
                    >
                      <option value="pending">En attente</option>
                      <option value="ready">Prête</option>
                      <option value="delivered">Livrée</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <FormLabel>Notes</FormLabel>
                    <textarea
                      className="gourmand-input min-h-[88px] w-full min-w-0 resize-none text-base"
                      rows={3}
                      value={editing.notes}
                      onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <div className="min-w-0">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gourmand-biscuit">
                      Lignes desserts
                    </span>
                    {editing.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => addItem({ prepend: true })}
                        className="mb-3 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gourmand-chocolate/35 bg-gourmand-chocolate/[0.04] text-sm font-semibold text-gourmand-chocolate transition-colors active:bg-gourmand-chocolate/10"
                      >
                        <Plus size={18} strokeWidth={2.25} aria-hidden />
                        Ajouter un dessert
                      </button>
                    )}
                    <div className="space-y-2">
                      {editing.items.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={detailHighlightLineIdx === idx ? { opacity: 0.4, y: -4 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                          className={`flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-shadow duration-300 ${
                            detailHighlightLineIdx === idx
                              ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]'
                              : 'border-gourmand-border'
                          }`}
                        >
                          <select
                            className="gourmand-input min-h-11 min-w-0 flex-1 py-2 text-base"
                            value={item.dessertId || ''}
                            onChange={e => handleDessertChange(idx, e.target.value)}
                            disabled={editing.status !== 'pending'}
                          >
                            <option value="">— Choisir —</option>
                            {desserts.map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            disabled={editing.status !== 'pending'}
                            className="gourmand-input h-11 w-[3.75rem] shrink-0 px-1 text-center text-base tabular-nums disabled:opacity-50"
                            value={item.quantity}
                            onChange={e =>
                              setItem(idx, { quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })
                            }
                          />
                          {editing.items.length > 1 && editing.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50"
                              aria-label="Supprimer la ligne"
                            >
                              <Trash2 size={18} strokeWidth={2} />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Supprimer cette commande ?"
            message={`La fiche commande de ${deleteTarget.clientName} sera supprimée. Les ventes déjà enregistrées restent dans « Ventes ».`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deliverTarget && (
          <Modal title="Marquer comme livrée ?" onClose={() => !converting && setDeliverTarget(null)}>
            <div className="p-5 space-y-5">
              <p className="text-sm text-gourmand-cocoa/75 font-medium leading-relaxed">
                Ajouter cette commande aux ventes ?
              </p>
              <div className="bg-gourmand-bg rounded-xl p-3 space-y-1.5">
                {mergeCommandeItems(deliverTarget.items).map((item, i) => (
                  <p key={i} className="text-sm font-medium break-words">
                    <span className="mr-1">{item.dessertEmoji || '🍰'}</span>
                    {item.quantity}× {item.dessertName || '–'}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleConfirmDeliver(true)}
                disabled={converting}
                className="gourmand-btn-primary-compact w-full cursor-pointer disabled:cursor-not-allowed"
              >
                {converting ? 'Enregistrement…' : 'Livrer et ajouter aux ventes'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeliver(false)}
                disabled={converting}
                className="w-full rounded-lg border border-gourmand-border bg-white py-2.5 text-xs font-semibold text-gourmand-cocoa active:bg-gourmand-bg disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Livrer sans l’ajouter aux ventes
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
