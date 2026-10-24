import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';

export interface PickerItem {
  id: string;
  emoji: string;
  name: string;
  /** Unité affichée à droite du champ (g, ml, u) */
  unit: string;
  /** Pas des boutons − / + */
  step: number;
}

interface Props {
  title: React.ReactNode;
  items: PickerItem[];
  quantities: Record<string, number>;
  onChange: (id: string, qty: number) => void;
  /** Affiche « + Nouveau… » : reçoit le texte tapé dans la recherche */
  onCreate?: (typed: string) => void;
  createLabel?: string;
}

/**
 * Liste de quantités pour composer une recette : ce qui est déjà choisi remonte en haut,
 * recherche dès que la liste est longue, création d'un élément manquant sans quitter le formulaire.
 */
export const QuantityPicker: React.FC<Props> = ({ title, items, quantities, onChange, onCreate, createLabel = 'Nouveau' }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const chosen = items.filter(i => (quantities[i.id] || 0) > 0);
  const filtered = items.filter(i => !q || i.name.toLowerCase().includes(q));
  const rows = [
    ...filtered.filter(i => (quantities[i.id] || 0) > 0),
    ...filtered.filter(i => !((quantities[i.id] || 0) > 0)),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-gourmand-biscuit uppercase tracking-wide flex items-center gap-2">{title}</h4>
        <div className="flex items-center gap-2">
          {chosen.length > 0 && (
            <span className="rounded-full bg-gourmand-chocolate px-2 py-0.5 text-[10px] font-bold text-white">{chosen.length} choisi{chosen.length > 1 ? 's' : ''}</span>
          )}
          {onCreate && (
            <button
              type="button"
              onClick={() => onCreate(query.trim())}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gourmand-border bg-white px-2.5 text-xs font-semibold text-gourmand-chocolate active:bg-gourmand-bg"
            >
              <Plus size={13} /> {createLabel}
            </button>
          )}
        </div>
      </div>

      {items.length > 5 && (
        <div className="gourmand-input mb-2 flex items-center gap-2 bg-white py-2">
          <Search size={16} className="shrink-0 text-gourmand-biscuit" />
          <input
            type="search"
            placeholder="Rechercher…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        </div>
      )}

      <div className="space-y-2">
        {rows.map(it => {
          const val = quantities[it.id] || 0;
          return (
            <div key={it.id} className={`flex items-center justify-between gap-2 rounded-xl p-3 ${val > 0 ? 'bg-gourmand-border/40 ring-1 ring-gourmand-border' : 'bg-gourmand-bg'}`}>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                <span className="w-9 shrink-0 text-center text-xl" aria-hidden>{it.emoji}</span>
                <span className="truncate">{it.name}</span>
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Retirer ${it.name}`}
                  onClick={() => onChange(it.id, Math.max(0, val - it.step))}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-gourmand-border bg-white text-lg font-bold text-gourmand-chocolate active:bg-gourmand-bg"
                >−</button>
                <input
                  type="number" inputMode="decimal" placeholder="0"
                  aria-label={`Quantité de ${it.name}`}
                  value={val || ''}
                  className="h-11 w-20 rounded-xl border border-gourmand-border bg-white px-2 text-center text-sm font-bold text-gourmand-chocolate focus:border-gourmand-chocolate focus:outline-none"
                  onChange={e => onChange(it.id, parseFloat(e.target.value) || 0)}
                />
                <button
                  type="button"
                  aria-label={`Ajouter ${it.name}`}
                  onClick={() => onChange(it.id, val + it.step)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-gourmand-border bg-white text-lg font-bold text-gourmand-chocolate active:bg-gourmand-bg"
                >+</button>
                <span className="w-5 text-xs font-medium text-gourmand-biscuit">{it.unit}</span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-xl bg-gourmand-bg p-4 text-center text-sm text-gourmand-biscuit">
            Aucun résultat{onCreate ? ` — touchez « ${createLabel} » pour l’ajouter` : ''}.
          </p>
        )}
      </div>
    </div>
  );
};
