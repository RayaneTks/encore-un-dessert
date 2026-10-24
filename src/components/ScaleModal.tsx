import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, ChefHat, Scale } from 'lucide-react';
import { Dessert, Base, RawIngredient } from '../types';
import {
  findIngredient,
  findBase,
  resolveComponentName,
  resolveComponentEmoji,
  resolveComponentUnit,
  calculateBaseCost,
  calculateDessertCost,
  fmt,
} from '../lib/calculations';

export type ScaleTarget =
  | { type: 'dessert'; item: Dessert }
  | { type: 'base'; item: Base };

interface Props {
  target: ScaleTarget;
  ingredients: RawIngredient[];
  bases: Base[];
  onClose: () => void;
  /** Quantité initiale pré-remplie (ex : depuis le board cuisine) */
  initialQuantity?: number;
  /** Bases uniquement : crée une nouvelle variante pré-remplie avec les quantités adaptées (facteur en argument). */
  onSaveVariant?: (factor: number) => void;
}

const PRESETS = [1, 2, 3, 4, 5, 10] as const;

function roundQty(n: number): string {
  if (n <= 0) return '0';
  if (n < 1) return n.toFixed(2).replace(/\.?0+$/, '');
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, '');
}

function formatScaledQty(qty: number, unit: string): string {
  const scaled = roundQty(qty);
  return `${scaled} ${unit}`;
}

export const ScaleModal: React.FC<Props> = ({
  target,
  ingredients,
  bases,
  onClose,
  initialQuantity,
  onSaveVariant,
}) => {
  const baseServings = target.type === 'dessert' ? target.item.servings : 1;
  // Une quantité commandée = autant de fois la recette du dessert (comme pour le coût à la vente et la liste de courses).
  const initialMultiplier = initialQuantity && initialQuantity > 0 ? initialQuantity : 1;

  const [multiplier, setMultiplier] = useState<number>(() =>
    Math.max(0.5, Math.min(50, initialMultiplier)),
  );
  const [customInput, setCustomInput] = useState('');
  const [copied, setCopied] = useState(false);

  /* Mode « par ingrédient » (bases uniquement) : on fixe la quantité d'un ingrédient, le reste suit. */
  const baseComponents = target.type === 'base' ? target.item.components : [];
  const [mode, setMode] = useState<'multiplier' | 'ingredient'>('multiplier');
  const [pivotId, setPivotId] = useState<string>(baseComponents[0]?.ingredientId ?? '');
  const [pivotInput, setPivotInput] = useState('');
  const pivotComp = baseComponents.find(c => c.ingredientId === pivotId);
  const pivotIng = pivotComp ? findIngredient(ingredients, pivotComp.ingredientId) : undefined;
  const pivotUnit = pivotIng?.unit === 'u' ? 'u' : pivotIng?.unit === 'L' ? 'ml' : 'g';

  /* Valeur active du multiplicateur (custom, preset ou ingrédient pivot) */
  const activeMultiplier = useMemo(() => {
    if (mode === 'ingredient') {
      const v = parseFloat(pivotInput.replace(',', '.'));
      if (pivotComp && pivotComp.quantity > 0 && Number.isFinite(v) && v > 0) return v / pivotComp.quantity;
      return 1;
    }
    if (customInput.trim()) {
      const v = parseFloat(customInput.replace(',', '.'));
      if (Number.isFinite(v) && v > 0) return v;
    }
    return multiplier;
  }, [mode, pivotInput, pivotComp, multiplier, customInput]);

  const handlePreset = useCallback(
    (v: number) => {
      setMultiplier(v);
      setCustomInput('');
    },
    [],
  );

  const handleCustomChange = (val: string) => {
    setCustomInput(val);
    const v = parseFloat(val.replace(',', '.'));
    if (Number.isFinite(v) && v > 0) setMultiplier(v);
  };

  /* ─── Lignes scaled ─────────────────────────────────── */
  const lines = useMemo(() => {
    if (target.type === 'dessert') {
      return target.item.components.map(comp => {
        const name = resolveComponentName(comp.type, comp.id, ingredients, bases);
        const emoji = resolveComponentEmoji(comp.type, comp.id, ingredients, bases);
        const unit = resolveComponentUnit(comp.type, comp.id, ingredients);
        const scaledQty = comp.quantity * activeMultiplier;
        let lineCost = 0;
        if (comp.type === 'ingredient') {
          const ing = findIngredient(ingredients, comp.id);
          if (ing)
            lineCost =
              ing.unit === 'u'
                ? ing.pricePerKg * scaledQty
                : (ing.pricePerKg * scaledQty) / 1000;
        } else {
          const base = findBase(bases, comp.id);
          if (base) {
            const { totalCost, totalWeight } = calculateBaseCost(base, ingredients);
            const costPerG = totalWeight > 0 ? totalCost / totalWeight : 0;
            lineCost = costPerG * scaledQty;
          }
        }
        return { name, emoji, unit, scaledQty, lineCost, isBase: comp.type === 'base' };
      });
    } else {
      return target.item.components.map(comp => {
        const ing = findIngredient(ingredients, comp.ingredientId);
        const name = ing?.name ?? 'Inconnu';
        const emoji = ing?.emoji ?? '🥄';
        const unit = ing?.unit === 'u' ? 'u' : ing?.unit === 'L' ? 'ml' : 'g';
        const scaledQty = comp.quantity * activeMultiplier;
        let lineCost = 0;
        if (ing) {
          lineCost =
            ing.unit === 'u'
              ? ing.pricePerKg * scaledQty
              : (ing.pricePerKg * scaledQty) / 1000;
        }
        return { name, emoji, unit, scaledQty, lineCost, isBase: false };
      });
    }
  }, [target, activeMultiplier, ingredients, bases]);

  const totalCost = useMemo(() => lines.reduce((s, l) => s + l.lineCost, 0), [lines]);

  /* ─── Infos d'en-tête ───────────────────────────────── */
  const headerInfo = useMemo(() => {
    if (target.type === 'dessert') {
      const baseParts = target.item.servings;
      const targetParts = Math.round(baseParts * activeMultiplier);
      return {
        base: `${baseParts} part${baseParts > 1 ? 's' : ''} (recette de base)`,
        target: `${targetParts} part${targetParts > 1 ? 's' : ''}`,
        yieldText: null as string | null,
      };
    } else {
      const { totalWeight: baseWeight } = calculateBaseCost(target.item, ingredients);
      const targetWeight = Math.round(baseWeight * activeMultiplier);
      const { yieldQty, yieldLabel } = target.item;
      const yieldText =
        yieldQty && yieldQty > 0
          ? `${roundQty(yieldQty * activeMultiplier)} ${yieldLabel}`.trim()
          : null;
      return {
        base: `${baseWeight} g (recette de base)`,
        target: `${targetWeight} g`,
        yieldText,
      };
    }
  }, [target, activeMultiplier, ingredients]);

  /* ─── Copier ────────────────────────────────────────── */
  const handleCopy = useCallback(async () => {
    const name =
      target.type === 'dessert' ? target.item.name : target.item.name;
    const mult = activeMultiplier === 1 ? '' : ` ×${activeMultiplier}`;
    const parts =
      target.type === 'dessert'
        ? ` — ${Math.round(target.item.servings * activeMultiplier)} parts`
        : '';
    const header = `${target.item.emoji} ${name}${mult}${parts}`;
    const body = lines
      .map(l => `${l.emoji} ${l.name}: ${formatScaledQty(l.scaledQty, l.unit)}`)
      .join('\n');
    const total = `\nCoût total : ${fmt(totalCost)}`;
    await navigator.clipboard.writeText(`${header}\n${body}${total}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [target, activeMultiplier, lines, totalCost]);

  const activePreset =
    mode === 'multiplier' && !customInput.trim() ? PRESETS.find(p => p === multiplier) ?? null : null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[200] flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div
        className="absolute inset-0 bg-gourmand-chocolate/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative flex max-h-[88dvh] w-full max-w-[min(100%,400px)] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Adapter la recette"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gourmand-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Scale size={14} className="text-gourmand-biscuit shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gourmand-biscuit">
                  Cuisine · Adapter
                </p>
              </div>
              <h3 className="text-lg font-bold leading-snug text-gourmand-chocolate">
                {target.item.emoji} {target.item.name}
              </h3>
              <p className="mt-0.5 text-xs text-gourmand-biscuit">{headerInfo.base}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gourmand-bg text-gourmand-chocolate transition-colors active:bg-gourmand-border"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sélecteur de multiplicateur */}
        <div className="shrink-0 px-5 py-4 border-b border-gourmand-border/60 space-y-3">
          {target.type === 'base' && baseComponents.length > 0 && (
            <div className="flex gap-1 rounded-xl bg-gourmand-bg p-1">
              {([['multiplier', 'Multiplier'], ['ingredient', 'Par ingrédient']] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                    mode === m ? 'bg-white text-gourmand-chocolate shadow-sm' : 'text-gourmand-biscuit'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === 'multiplier' ? (
            <>
              <div className="flex gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePreset(p)}
                    className={`scale-preset-btn ${
                      activePreset === p
                        ? 'scale-preset-btn-active'
                        : 'scale-preset-btn-inactive'
                    }`}
                  >
                    ×{p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gourmand-biscuit">
                    ×
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    step={0.5}
                    value={customInput}
                    onChange={e => handleCustomChange(e.target.value)}
                    placeholder={String(multiplier)}
                    className="gourmand-input w-full pl-8 text-base font-bold"
                  />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase text-gourmand-biscuit">Résultat</p>
                  <p className="text-base font-bold text-gourmand-chocolate">{headerInfo.target}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <select
                value={pivotId}
                onChange={e => { setPivotId(e.target.value); setPivotInput(''); }}
                className="gourmand-input w-full text-sm font-semibold"
                aria-label="Ingrédient de référence"
              >
                {baseComponents.map(c => {
                  const ing = findIngredient(ingredients, c.ingredientId);
                  const u = ing?.unit === 'u' ? 'u' : ing?.unit === 'L' ? 'ml' : 'g';
                  return (
                    <option key={c.ingredientId} value={c.ingredientId}>
                      {ing?.emoji ?? '🥄'} {ing?.name ?? 'Inconnu'} (recette : {roundQty(c.quantity)} {u})
                    </option>
                  );
                })}
              </select>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={pivotInput}
                    onChange={e => setPivotInput(e.target.value)}
                    placeholder={pivotComp ? roundQty(pivotComp.quantity) : '0'}
                    className="gourmand-input w-full pr-10 text-base font-bold"
                    aria-label="Quantité disponible"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gourmand-biscuit">
                    {pivotUnit}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase text-gourmand-biscuit">Facteur</p>
                  <p className="text-base font-bold text-gourmand-chocolate tabular-nums">×{roundQty(activeMultiplier)}</p>
                </div>
              </div>
              <p className="text-xs text-gourmand-biscuit">
                Indiquez ce que vous avez : le reste s’ajuste tout seul.
              </p>
            </>
          )}

          {headerInfo.yieldText && (
            <p className="text-xs font-semibold text-gourmand-cocoa">
              🍰 Rendement : <span className="text-gourmand-chocolate">{headerInfo.yieldText}</span>
            </p>
          )}
        </div>

        {/* Liste des ingrédients scalés */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-5 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gourmand-biscuit flex items-center gap-1.5">
            <ChefHat size={12} />
            Liste cuisine
          </p>

          {lines.length === 0 ? (
            <p className="text-sm text-gourmand-biscuit text-center py-8">Aucun composant.</p>
          ) : (
            <div className="space-y-1.5">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gourmand-bg"
                >
                  <span className="text-xl shrink-0 w-8 text-center" aria-hidden>
                    {line.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gourmand-chocolate truncate">
                      {line.name}
                    </p>
                    {line.isBase && (
                      <p className="text-[10px] text-gourmand-biscuit">Préparation maison</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-gourmand-chocolate">
                      {formatScaledQty(line.scaledQty, line.unit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer : coût + copier */}
        <div className="shrink-0 border-t border-gourmand-border bg-gourmand-bg/50 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gourmand-biscuit">
                Coût des ingrédients
              </p>
              <p className="text-lg font-bold text-gourmand-chocolate">{fmt(totalCost)}</p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gourmand-chocolate text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  Copié
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copier la liste
                </>
              )}
            </button>
          </div>
          {onSaveVariant && target.type === 'base' && (
            <button
              type="button"
              onClick={() => onSaveVariant(activeMultiplier)}
              className="w-full rounded-xl border border-gourmand-border bg-white px-4 py-3 text-sm font-bold text-gourmand-chocolate transition-all active:scale-95"
            >
              Enregistrer comme nouvelle variante
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};
