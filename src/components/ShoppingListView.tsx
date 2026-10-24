import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, ShoppingBasket } from 'lucide-react';
import { Base, Commande, Dessert, RawIngredient } from '../types';
import { buildShoppingList, formatAmount } from '../lib/shoppingList';
import { fmt } from '../lib/calculations';

const STORAGE_KEY = 'e1d_courses_checked';

interface Props {
  commandes: Commande[];
  desserts: Dessert[];
  bases: Base[];
  ingredients: RawIngredient[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function loadChecked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Liste de courses calculée depuis les commandes en cours : ce qu'il faut acheter, à cocher au fil des rayons. */
export const ShoppingListView: React.FC<Props> = ({ commandes, desserts, bases, ingredients, showToast }) => {
  const list = useMemo(() => buildShoppingList(commandes, desserts, bases, ingredients), [commandes, desserts, bases, ingredients]);
  const [checked, setChecked] = useState<Set<string>>(loadChecked);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked])); } catch { /* stockage indisponible */ }
  }, [checked]);

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const byCategory = useMemo(() => {
    const m = new Map<string, typeof list.lines>();
    list.lines.forEach(l => m.set(l.ingredient.category, [...(m.get(l.ingredient.category) ?? []), l]));
    return [...m.entries()];
  }, [list]);

  const remainingToBuy = list.lines.filter(l => !checked.has(l.ingredient.id));

  const copy = async () => {
    const text = ['Liste de courses', ...remainingToBuy.map(l => `- ${l.ingredient.name} : ${formatAmount(l.amount, l.ingredient.unit)}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Liste copiée');
    } catch {
      showToast('Copie impossible', 'error');
    }
  };

  if (list.lines.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center text-gourmand-biscuit">
        <ShoppingBasket size={40} className="mb-3 opacity-30" aria-hidden />
        <p className="text-sm font-medium text-gourmand-cocoa">Rien à acheter</p>
        <p className="mt-1 text-xs">La liste se remplit avec les commandes à préparer.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4 px-3 pb-4">
      <div className="gourmand-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-gourmand-chocolate">
            {remainingToBuy.length} <span className="text-sm font-semibold text-gourmand-biscuit">/ {list.lines.length} à acheter</span>
          </p>
          <p className="text-xs text-gourmand-biscuit">
            Pour {list.dessertCount} dessert{list.dessertCount > 1 ? 's' : ''} · environ {fmt(list.totalCost)}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gourmand-chocolate px-4 text-sm font-bold text-white active:scale-95"
        >
          <Copy size={16} /> Copier
        </button>
      </div>

      {byCategory.map(([category, lines]) => (
        <section key={category} aria-label={category}>
          <h3 className="mb-2 pl-1 text-xs font-bold uppercase tracking-widest text-gourmand-cocoa/60">{category}</h3>
          <ul className="gourmand-card divide-y divide-gourmand-border/60 overflow-hidden rounded-2xl border">
            {lines.map(l => {
              const done = checked.has(l.ingredient.id);
              return (
                <li key={l.ingredient.id}>
                  <button
                    type="button"
                    onClick={() => toggle(l.ingredient.id)}
                    aria-pressed={done}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-gourmand-bg/60"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gourmand-border bg-white'
                      }`}
                      aria-hidden
                    >
                      {done && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span className="text-2xl leading-none" aria-hidden>{l.ingredient.emoji}</span>
                    <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${done ? 'text-gourmand-biscuit line-through' : 'text-gourmand-chocolate'}`}>
                      {l.ingredient.name}
                    </span>
                    <span className={`shrink-0 text-right ${done ? 'opacity-50' : ''}`}>
                      <span className="block text-base font-bold tabular-nums text-gourmand-chocolate">{formatAmount(l.amount, l.ingredient.unit)}</span>
                      <span className="block text-[11px] tabular-nums text-gourmand-biscuit">≈ {fmt(l.cost)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {checked.size > 0 && (
        <button type="button" onClick={() => setChecked(new Set())} className="min-h-11 w-full text-sm font-semibold text-gourmand-biscuit">
          Tout décocher
        </button>
      )}
    </motion.div>
  );
};
