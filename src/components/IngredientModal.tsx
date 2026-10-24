import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { RawIngredient } from '../types';
import { Modal } from './Modal';
import { FormLabel } from './FormLabel';

export const INGREDIENT_CATEGORIES = ['Crèmerie', 'Élevage', 'Épicerie', 'Chocolat', 'Fruits', 'Fruits secs', 'Autre'];

interface Props {
  /** null = nouvel ingrédient */
  ingredient: RawIngredient | null;
  /** Nom pré-rempli (création rapide depuis une recherche) */
  defaultName?: string;
  /** Recettes qui utilisent cet ingrédient (affichées à la modification) */
  usedIn?: string[];
  onSave: (ing: RawIngredient) => Promise<RawIngredient | null>;
  onDelete?: (ing: RawIngredient) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const IngredientModal: React.FC<Props> = ({ ingredient, defaultName, usedIn, onSave, onDelete, onClose, showToast }) => {
  const [name, setName] = useState(ingredient?.name ?? defaultName ?? '');
  const [price, setPrice] = useState(ingredient ? ingredient.pricePerKg.toString() : '');
  const [unit, setUnit] = useState<'kg' | 'L' | 'u'>(ingredient?.unit ?? 'kg');
  const [category, setCategory] = useState(ingredient?.category ?? 'Épicerie');
  const [emoji, setEmoji] = useState(ingredient?.emoji ?? '🥐');
  const [purchaseLabel, setPurchaseLabel] = useState(ingredient?.purchaseLabel ?? '');
  const [notes, setNotes] = useState(ingredient?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { showToast('Veuillez saisir un nom', 'error'); return; }
    const priceVal = parseFloat(price.replace(',', '.'));
    if (isNaN(priceVal) || priceVal <= 0) { showToast('Indiquez le prix', 'error'); return; }
    if (!emoji.trim()) { showToast('Icône requise', 'error'); return; }

    setSaving(true);
    const ing: RawIngredient = {
      id: ingredient?.id || 'ing-' + Date.now(),
      name: name.trim(), pricePerKg: priceVal, unit, category, emoji,
      purchaseLabel: purchaseLabel || `${priceVal.toFixed(2)} €/${unit}`,
      notes,
      createdAt: ingredient?.createdAt || new Date().toISOString(),
    };
    const result = await onSave(ing);
    setSaving(false);
    if (result) {
      showToast(ingredient ? `${ing.name} mis à jour` : `${ing.name} ajouté`);
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} title={ingredient ? 'Modifier l’ingrédient' : 'Nouvel ingrédient'}>
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div>
            <FormLabel>Icône</FormLabel>
            <input type="text" maxLength={2} className="gourmand-input w-16 text-center text-xl" value={emoji} onChange={e => setEmoji(e.target.value)} />
          </div>
          <div className="flex-1">
            <FormLabel>Nom</FormLabel>
            <input placeholder="Ex : Farine T55" className="gourmand-input w-full" value={name} onChange={e => setName(e.target.value)} autoFocus={!ingredient} />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormLabel>Prix (€)</FormLabel>
            <input placeholder="0,00" type="number" inputMode="decimal" step="0.01" className="gourmand-input w-full" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <div className="w-28">
            <FormLabel>Au…</FormLabel>
            <select className="gourmand-input w-full" value={unit} onChange={e => setUnit(e.target.value as 'kg' | 'L' | 'u')}>
              <option value="kg">kilo</option>
              <option value="L">litre</option>
              <option value="u">unité</option>
            </select>
          </div>
        </div>
        <div>
          <FormLabel>Catégorie</FormLabel>
          <select className="gourmand-input w-full" value={category} onChange={e => setCategory(e.target.value)}>
            {INGREDIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {ingredient && (
          <>
            <div>
              <FormLabel>Mémo d’achat</FormLabel>
              <input placeholder="Ex : 4,29 € les 20" className="gourmand-input w-full" value={purchaseLabel} onChange={e => setPurchaseLabel(e.target.value)} />
            </div>
            {usedIn && usedIn.length > 0 && (
              <div className="rounded-xl bg-gourmand-bg p-3">
                <p className="mb-1 text-xs font-semibold text-gourmand-biscuit">Utilisé dans</p>
                <p className="text-sm font-medium text-gourmand-chocolate">{usedIn.join(' · ')}</p>
                <p className="mt-1 text-xs text-gourmand-biscuit">Changer le prix met à jour le coût de toutes ces recettes.</p>
              </div>
            )}
            <textarea placeholder="Notes…" className="gourmand-input w-full resize-none h-20 text-sm" value={notes} onChange={e => setNotes(e.target.value)} />
          </>
        )}
        <button onClick={save} disabled={saving} className="gourmand-btn-primary w-full py-4 text-sm disabled:opacity-50">
          {saving ? 'Enregistrement…' : ingredient ? 'Enregistrer' : 'Ajouter l’ingrédient'}
        </button>
        {ingredient && onDelete && (
          <button
            onClick={() => onDelete(ingredient)}
            className="w-full py-3 text-xs font-bold text-red-500 bg-red-50 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={16} /> Supprimer
          </button>
        )}
      </div>
    </Modal>
  );
};
