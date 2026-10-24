import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Base, Dessert, RawIngredient, Tab } from '../types';
import { DessertsScreen } from './DessertsScreen';
import { BasesScreen } from './BasesScreen';
import { IngredientsScreen } from './IngredientsScreen';

export type AtelierSection = Extract<Tab, 'desserts' | 'bases' | 'ingredients'>;

interface Props {
  section: AtelierSection;
  onSectionChange: (s: AtelierSection) => void;
  desserts: Dessert[];
  bases: Base[];
  ingredients: RawIngredient[];
  onSaveDessert: (d: Dessert) => Promise<Dessert | null>;
  onDeleteDessert: (id: string) => Promise<void>;
  onSaveBase: (b: Base) => Promise<Base | null>;
  onDeleteBase: (id: string) => Promise<void>;
  onSaveIngredient: (i: RawIngredient) => Promise<RawIngredient | null>;
  onDeleteIngredient: (id: string) => Promise<void>;
  targetMargin: number;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Conception des desserts, en un seul endroit : Desserts (ce qu'on vend) ← Préparations (appareils,
 * fonds, crèmes) ← Ingrédients (ce qu'on achète). On passe de l'un à l'autre sans quitter l'onglet.
 */
export const AtelierScreen: React.FC<Props> = ({
  section, onSectionChange, desserts, bases, ingredients,
  onSaveDessert, onDeleteDessert, onSaveBase, onDeleteBase, onSaveIngredient, onDeleteIngredient, targetMargin, showToast,
}) => {
  const sections: { id: AtelierSection; label: string; count: number }[] = [
    { id: 'desserts', label: 'Desserts', count: desserts.length },
    { id: 'bases', label: 'Préparations', count: bases.length },
    { id: 'ingredients', label: 'Ingrédients', count: ingredients.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-3" role="tablist" aria-label="Atelier">
        <div className="flex gap-1 rounded-2xl bg-gourmand-border/40 p-1">
          {sections.map(s => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              onClick={() => onSectionChange(s.id)}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl px-1 text-[13px] font-bold leading-tight transition-colors ${
                section === s.id ? 'bg-white text-gourmand-chocolate shadow-sm' : 'text-gourmand-biscuit'
              }`}
            >
              {s.label}
              <span className="text-[10px] font-semibold opacity-60">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {section === 'desserts' && (
            <DessertsScreen
              key="desserts"
              desserts={desserts}
              ingredients={ingredients}
              bases={bases}
              onSave={onSaveDessert}
              onDelete={onDeleteDessert}
              onSaveIngredient={onSaveIngredient}
              targetMargin={targetMargin}
              showToast={showToast}
            />
          )}
          {section === 'bases' && (
            <BasesScreen
              key="bases"
              bases={bases}
              ingredients={ingredients}
              onSave={onSaveBase}
              onDelete={onDeleteBase}
              onSaveIngredient={onSaveIngredient}
              showToast={showToast}
            />
          )}
          {section === 'ingredients' && (
            <IngredientsScreen
              key="ingredients"
              ingredients={ingredients}
              bases={bases}
              desserts={desserts}
              onSave={onSaveIngredient}
              onDelete={onDeleteIngredient}
              showToast={showToast}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
