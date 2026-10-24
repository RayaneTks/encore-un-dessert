import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, Beaker, Apple, Scale, FolderOpen } from 'lucide-react';
import { Base, RawIngredient } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconActionButton } from '../components/IconActionButton';
import { FormLabel } from '../components/FormLabel';
import { ScaleModal } from '../components/ScaleModal';
import { SearchField } from '../components/SearchField';
import { QuantityPicker } from '../components/QuantityPicker';
import { IngredientModal } from '../components/IngredientModal';
import { fmt, findIngredient, calculateBaseCost, calculateBaseCostPerKg } from '../lib/calculations';

/** Réutilise le libellé d'une famille existante (casse / espaces ignorés) pour éviter les doublons « Flan » / « flan ». */
function canonicalFamily(input: string, bases: Base[]): string {
  const clean = input.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const key = clean.toLocaleLowerCase('fr');
  return bases.find(b => b.family && b.family.toLocaleLowerCase('fr') === key)?.family ?? clean;
}

const CATEGORIES = ['Fond', 'Ganache', 'Insert', 'Coulis', 'Crème', 'Biscuit', 'Autre'];

interface Props {
  bases: Base[];
  ingredients: RawIngredient[];
  onSave: (base: Base) => Promise<Base | null>;
  onDelete: (id: string) => Promise<void>;
  onSaveIngredient: (ing: RawIngredient) => Promise<RawIngredient | null>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BasesScreen: React.FC<Props> = ({ bases, ingredients, onSave, onDelete, onSaveIngredient, showToast }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Base | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Base | null>(null);
  const [scaleTarget, setScaleTarget] = useState<Base | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [newIngOpen, setNewIngOpen] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  /** Famille ouverte (liste de ses variantes). null = liste générale. */
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍯');
  const [category, setCategory] = useState('Fond');
  const [notes, setNotes] = useState('');
  const [family, setFamily] = useState('');
  const [yieldQty, setYieldQty] = useState('');
  const [yieldLabel, setYieldLabel] = useState('');
  const [compMap, setCompMap] = useState<Record<string, number>>({});

  const openAdd = () => {
    setEditItem(null);
    setName(''); setEmoji('🍯'); setCategory('Fond'); setNotes(''); setCompMap({});
    setFamily(openFamily ?? ''); setYieldQty(''); setYieldLabel('');
    setShowForm(true);
  };

  /** Ouvre le formulaire de création pré-rempli avec la recette adaptée (rien n'est enregistré avant validation). */
  const openVariantFrom = (base: Base, factor: number) => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const map: Record<string, number> = {};
    base.components.forEach(c => { map[c.ingredientId] = round(c.quantity * factor); });
    const label = `×${round(factor)}`;
    setEditItem(null);
    setName(`${base.name} ${label}`); setEmoji(base.emoji); setCategory(base.category); setNotes(base.notes);
    setFamily(base.family);
    setYieldQty(base.yieldQty != null ? String(round(base.yieldQty * factor)) : '');
    setYieldLabel(base.yieldLabel);
    setCompMap(map);
    setScaleTarget(null);
    setShowForm(true);
  };

  const openEdit = (base: Base) => {
    setEditItem(base);
    setName(base.name); setEmoji(base.emoji); setCategory(base.category); setNotes(base.notes);
    setFamily(base.family); setYieldQty(base.yieldQty != null ? String(base.yieldQty) : ''); setYieldLabel(base.yieldLabel);
    const map: Record<string, number> = {};
    base.components.forEach(c => { map[c.ingredientId] = c.quantity; });
    setCompMap(map);
    setShowForm(true);
  };

  const save = async () => {
    if (!name.trim()) { showToast('Veuillez saisir un nom', 'error'); return; }
    const components = Object.entries(compMap)
      .filter(([, qty]) => qty > 0)
      .map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
    if (components.length === 0) { showToast('Veuillez ajouter au moins un ingrédient', 'error'); return; }
    if (!emoji.trim()) { showToast('Icône requise', 'error'); return; }

    const yq = parseFloat(yieldQty.replace(',', '.'));
    if (yieldQty.trim() && !(Number.isFinite(yq) && yq > 0)) { showToast('Rendement invalide', 'error'); return; }

    setSaving(true);
    const base: Base = {
      id: editItem?.id || 'base-' + Date.now(),
      name, category, emoji, notes, components,
      family: canonicalFamily(family, bases),
      yieldQty: yieldQty.trim() ? yq : null,
      yieldLabel: yieldLabel.trim(),
      createdAt: editItem?.createdAt || new Date().toISOString(),
    };
    const result = await onSave(base);
    setSaving(false);
    if (result) {
      showToast(editItem ? `${name} mis à jour` : `${name} créée`);
      setShowForm(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    showToast(`${deleteTarget.name} supprimé`, 'info');
    setDeleteTarget(null);
    setExpandedId(null);
  };

  /* ─── Regroupement par famille ─── */
  const families = useMemo(() => {
    const map = new Map<string, Base[]>();
    bases.forEach(b => {
      if (!b.family) return;
      map.set(b.family, [...(map.get(b.family) ?? []), b]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [bases]);
  const standalone = useMemo(() => bases.filter(b => !b.family), [bases]);
  // Si la dernière variante est supprimée / déplacée, on revient à la liste générale.
  const familyBases = openFamily !== null ? bases.filter(b => b.family === openFamily) : [];
  const effectiveFamily = openFamily !== null && familyBases.length > 0 ? openFamily : null;
  const q = query.trim().toLowerCase();
  const categoryRank = (c: string) => { const i = CATEGORIES.indexOf(c); return i === -1 ? CATEGORIES.length : i; };
  const visibleBases = useMemo(() => {
    const pool = q ? bases.filter(b => b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q) || b.family.toLowerCase().includes(q))
      : effectiveFamily !== null ? familyBases : standalone;
    return [...pool].sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases, q, effectiveFamily, familyBases, standalone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto scrollbar-hide px-2 pb-32"
    >
      <PageHeader
        title={effectiveFamily ?? 'Préparations'}
        description={
          effectiveFamily !== null
            ? `${familyBases.length} variante${familyBases.length > 1 ? 's' : ''}`
            : `${bases.length} base${bases.length > 1 ? 's' : ''} maison`
        }
        action={
          <IconActionButton
            onClick={openAdd}
            icon={<Plus size={22} />}
            label="Ajouter une préparation"
            disabled={ingredients.length === 0}
          />
        }
      >
        {effectiveFamily === null && <SearchField value={query} onChange={setQuery} placeholder="Rechercher une préparation…" />}
      </PageHeader>

      {ingredients.length === 0 && (
        <div className="px-4 mb-4">
          <div className="bg-amber-50 text-amber-700 border border-amber-200/60 p-4 rounded-2xl text-sm font-medium">
            💡 Ajoutez d'abord des ingrédients pour créer une préparation.
          </div>
        </div>
      )}

      <div className="px-4 space-y-3">
        {effectiveFamily !== null && (
          <button
            type="button"
            onClick={() => setOpenFamily(null)}
            className="flex items-center gap-1 text-sm font-semibold text-gourmand-biscuit active:opacity-60"
          >
            <ChevronLeft size={16} /> Toutes les préparations
          </button>
        )}

        {effectiveFamily === null && !q && families.map(([fam, members]) => (
          <button
            key={fam}
            type="button"
            onClick={() => setOpenFamily(fam)}
            className="gourmand-card flex w-full items-center gap-3 px-4 py-4 text-left transition-colors active:bg-gourmand-bg"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gourmand-border/50 bg-gourmand-bg text-gourmand-biscuit">
              <FolderOpen size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-gourmand-chocolate">{fam}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-gourmand-biscuit">
                {members.length} variante{members.length > 1 ? 's' : ''} · {members.slice(0, 3).map(m => m.name).join(', ')}{members.length > 3 ? '…' : ''}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gourmand-biscuit" />
          </button>
        ))}

        {visibleBases.map((base, i) => {
          const { totalCost, totalWeight } = calculateBaseCost(base, ingredients);
          const costPerKg = calculateBaseCostPerKg(base, ingredients);
          const isExpanded = expandedId === base.id;

          const showHeading = !q && effectiveFamily === null && (i === 0 || visibleBases[i - 1].category !== base.category);
          return (
            <React.Fragment key={base.id}>
            {showHeading && (
              <h2 className="pl-1 pt-2 text-xs font-bold uppercase tracking-widest text-gourmand-cocoa/60">{base.category}</h2>
            )}
            <div className="gourmand-card overflow-hidden">
              {/* En-tête : toute la ligne ouvre le détail */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : base.id)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-gourmand-bg/60"
              >
                <span className="w-10 shrink-0 text-center text-3xl leading-none">{base.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-gourmand-chocolate">{base.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-gourmand-biscuit">
                    {base.category} · {base.components.length} ingrédient{base.components.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-gourmand-chocolate">{fmt(costPerKg)}</p>
                  <p className="text-xs font-medium text-gourmand-biscuit">le kilo</p>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-gourmand-biscuit transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Accordéon */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gourmand-border/60">
                      <div className="bg-gourmand-bg rounded-xl p-4 space-y-2.5">
                        <p className="text-xs font-semibold text-gourmand-biscuit mb-2">Composition</p>
                        {base.components.map((comp, idx) => {
                          const ing = findIngredient(ingredients, comp.ingredientId);
                          const ingName = ing?.name || 'Inconnu';
                          const ingUnit = ing?.unit === 'u' ? 'u' : ing?.unit === 'L' ? 'ml' : 'g';
                          let lineCost = 0;
                          if (ing) lineCost = ing.unit === 'u' ? ing.pricePerKg * comp.quantity : (ing.pricePerKg * comp.quantity) / 1000;
                          return (
                            <div key={idx} className="flex justify-between items-center gap-2 text-sm">
                              <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none" aria-hidden>{ing?.emoji ?? '🥄'}</span>
                                <span className="truncate">{ingName}</span>
                              </span>
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="text-gourmand-biscuit text-xs tabular-nums">{comp.quantity}{ingUnit}</span>
                                <span className="font-semibold w-14 text-right tabular-nums">{fmt(lineCost)}</span>
                              </div>
                            </div>
                          );
                        })}
                        <div className="border-t border-gourmand-border/60 pt-2.5 mt-1 flex justify-between">
                          <span className="text-sm font-semibold text-gourmand-cocoa">Total : {totalWeight} g</span>
                          <span className="font-bold tabular-nums">{fmt(totalCost)}</span>
                        </div>
                      </div>

                      {base.yieldQty != null && base.yieldQty > 0 && (
                        <div className="rounded-xl bg-gourmand-bg p-4">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gourmand-biscuit">Ce que je peux faire avec cette recette</p>
                          <p className="text-sm font-semibold text-gourmand-chocolate">🍰 {base.yieldQty} {base.yieldLabel}</p>
                        </div>
                      )}

                      {base.notes && (
                        <p className="text-xs text-gourmand-cocoa bg-gourmand-bg/50 p-3 rounded-xl">{base.notes}</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setScaleTarget(base)}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gourmand-border bg-gourmand-bg text-gourmand-cocoa font-semibold text-sm transition-colors active:bg-gourmand-border"
                        >
                          <Scale size={16} />
                          Adapter
                        </button>
                        <button onClick={() => openEdit(base)} className="flex-1 gourmand-btn-primary py-3 text-sm">
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteTarget(base)}
                          className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center transition-colors active:bg-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </React.Fragment>
          );
        })}

        {bases.length > 0 && visibleBases.length === 0 && q && (
          <p className="py-10 text-center text-sm font-medium text-gourmand-biscuit">Aucune préparation ne correspond à « {query} ».</p>
        )}

        {bases.length === 0 && (
          <div className="text-center py-16 opacity-50">
            <div className="w-16 h-16 bg-gourmand-border/50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Beaker size={32} className="text-gourmand-cocoa" />
            </div>
            <p className="font-medium">Aucune préparation</p>
            <p className="text-sm text-gourmand-biscuit mt-1">Ajoutez vos bases maison</p>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <AnimatePresence>
        {showForm && (
          <Modal onClose={() => setShowForm(false)} title={editItem ? 'Modifier la préparation' : 'Nouvelle préparation'}>
            <div className="space-y-5 pb-2">
              <div className="flex items-center gap-3">
                <div>
                  <FormLabel>Icône</FormLabel>
                  <input
                    type="text" maxLength={2}
                    className="gourmand-input w-16 text-center text-xl text-gourmand-chocolate"
                    value={emoji} onChange={e => setEmoji(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <FormLabel>Nom</FormLabel>
                  <input
                    placeholder="Ex : Pâte sucrée amande"
                    className="gourmand-input w-full"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <FormLabel>Type</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        category === c
                          ? 'bg-gourmand-chocolate text-white border-gourmand-chocolate'
                          : 'bg-white text-gourmand-cocoa border-gourmand-border'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FormLabel>Famille (optionnel)</FormLabel>
                <input
                  list="base-families"
                  placeholder="Ex : Appareil à flan — pour regrouper les variantes"
                  className="gourmand-input w-full"
                  value={family} onChange={e => setFamily(e.target.value)}
                />
                <datalist id="base-families">
                  {families.map(([fam]) => <option key={fam} value={fam} />)}
                </datalist>
              </div>

              <div>
                <FormLabel>Rendement (optionnel)</FormLabel>
                <div className="flex gap-2">
                  <input
                    type="number" inputMode="decimal" placeholder="5"
                    className="gourmand-input w-20 text-center"
                    value={yieldQty} onChange={e => setYieldQty(e.target.value)}
                  />
                  <input
                    placeholder="entremets Ø18 cm"
                    className="gourmand-input flex-1"
                    value={yieldLabel} onChange={e => setYieldLabel(e.target.value)}
                  />
                </div>
              </div>

              <QuantityPicker
                title={<><Apple size={14} /> Ingrédients</>}
                items={ingredients.map(ing => ({
                  id: ing.id, emoji: ing.emoji, name: ing.name,
                  unit: ing.unit === 'u' ? 'u' : ing.unit === 'L' ? 'ml' : 'g',
                  step: ing.unit === 'u' ? 1 : 10,
                }))}
                quantities={compMap}
                onChange={(id, qty) => setCompMap(prev => ({ ...prev, [id]: qty }))}
                onCreate={typed => { setNewIngName(typed); setNewIngOpen(true); }}
                createLabel="Nouvel ingrédient"
              />

              <textarea
                placeholder="Notes techniques..."
                className="gourmand-input w-full resize-none h-20 text-sm"
                value={notes} onChange={e => setNotes(e.target.value)}
              />
              <button onClick={save} disabled={saving} className="gourmand-btn-primary w-full py-4 text-sm disabled:opacity-50">
                {saving ? 'Enregistrement…' : editItem ? 'Enregistrer' : 'Créer la préparation'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newIngOpen && (
          <IngredientModal
            ingredient={null}
            defaultName={newIngName}
            onSave={onSaveIngredient}
            onClose={() => setNewIngOpen(false)}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Suppression"
            message={`Supprimer "${deleteTarget.name}" ?`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scaleTarget && (
          <ScaleModal
            target={{ type: 'base', item: scaleTarget }}
            ingredients={ingredients}
            bases={bases}
            onClose={() => setScaleTarget(null)}
            onSaveVariant={factor => openVariantFrom(scaleTarget, factor)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
