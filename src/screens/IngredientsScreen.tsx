import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronRight } from 'lucide-react';
import { Base, Dessert, RawIngredient } from '../types';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconActionButton } from '../components/IconActionButton';
import { IngredientModal, INGREDIENT_CATEGORIES } from '../components/IngredientModal';
import { SearchField } from '../components/SearchField';
import { fmt } from '../lib/calculations';

interface Props {
  ingredients: RawIngredient[];
  bases: Base[];
  desserts: Dessert[];
  onSave: (ing: RawIngredient) => Promise<RawIngredient | null>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const unitLabel = (u: string) => (u === 'L' ? 'le litre' : u === 'u' ? 'l’unité' : 'le kilo');

export const IngredientsScreen: React.FC<Props> = ({ ingredients, bases, desserts, onSave, onDelete, showToast }) => {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawIngredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RawIngredient | null>(null);

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  /** Pour chaque ingrédient : préparations et desserts concernés (directement ou via une préparation). */
  const usage = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (id: string, label: string) => map.set(id, [...(map.get(id) ?? []).filter(l => l !== label), label]);
    bases.forEach(b => b.components.forEach(c => add(c.ingredientId, b.name)));
    desserts.forEach(d => d.components.forEach(c => {
      if (c.type === 'ingredient') add(c.id, d.name);
      else bases.find(b => b.id === c.id)?.components.forEach(bc => add(bc.ingredientId, d.name));
    }));
    return map;
  }, [bases, desserts]);

  const groups = useMemo(() => {
    const rank = (c: string) => { const i = INGREDIENT_CATEGORIES.indexOf(c); return i === -1 ? INGREDIENT_CATEGORIES.length : i; };
    const m = new Map<string, RawIngredient[]>();
    [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })).forEach(i => m.set(i.category, [...(m.get(i.category) ?? []), i]));
    return [...m.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'fr'));
  }, [filtered]);

  const openAdd = () => { setEditItem(null); setFormOpen(true); };
  const openEdit = (ing: RawIngredient) => { setEditItem(ing); setFormOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    showToast(`${deleteTarget.name} supprimé`, 'info');
    setDeleteTarget(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto scrollbar-hide px-2 pb-32"
    >
      <PageHeader
        title="Ingrédients"
        description={`${ingredients.length} ingrédient${ingredients.length > 1 ? 's' : ''}`}
        action={<IconActionButton onClick={openAdd} icon={<Plus size={22} />} label="Ajouter un ingrédient" />}
      >
        {<SearchField value={search} onChange={setSearch} placeholder="Rechercher un ingrédient…" />}
      </PageHeader>

      <div className="space-y-5 px-4 pt-1">
        {groups.map(([category, items]) => (
          <section key={category} aria-label={category}>
            {!search.trim() && (
              <h2 className="mb-2 pl-1 text-xs font-bold uppercase tracking-widest text-gourmand-cocoa/60">{category} · {items.length}</h2>
            )}
            <SectionCard padding={false}>
              <div className="divide-y divide-gourmand-border/50">
                {items.map(ing => {
                  const used = usage.get(ing.id)?.length ?? 0;
                  return (
                    <button
                      key={ing.id}
                      onClick={() => openEdit(ing)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gourmand-bg/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 shrink-0 text-center text-2xl">{ing.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-base text-gourmand-chocolate leading-tight truncate mb-0.5">{ing.name}</p>
                          <p className="text-xs font-medium text-gourmand-biscuit">
                            {used > 0 ? `utilisé dans ${used} recette${used > 1 ? 's' : ''}` : 'pas encore utilisé'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-gourmand-chocolate">{fmt(ing.pricePerKg)}</p>
                          <p className="text-[10px] text-gourmand-biscuit">{unitLabel(ing.unit)}</p>
                        </div>
                        <ChevronRight size={16} className="text-gourmand-biscuit" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </section>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm font-medium text-gourmand-biscuit">Aucun ingrédient ne correspond à « {search} ».</div>
        )}
      </div>

      <AnimatePresence>
        {formOpen && (
          <IngredientModal
            ingredient={editItem}
            usedIn={editItem ? usage.get(editItem.id) : undefined}
            onSave={onSave}
            onDelete={ing => { setFormOpen(false); setDeleteTarget(ing); }}
            onClose={() => setFormOpen(false)}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Supprimer l’ingrédient"
            message={`Retirer « ${deleteTarget.name} » ?${(usage.get(deleteTarget.id)?.length ?? 0) > 0 ? ` Il est utilisé dans : ${usage.get(deleteTarget.id)!.join(', ')}.` : ''}`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
