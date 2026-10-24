import { Base, Commande, Dessert, RawIngredient } from '../types';
import { calculateBaseCost, findBase, findIngredient } from './calculations';
import { activeProductionCommandes, itemRemaining } from './commandeProduction';

export interface ShoppingLine {
  ingredient: RawIngredient;
  /** Quantité à acheter : g, ml ou unités selon l'ingrédient */
  amount: number;
  cost: number;
}

export interface ShoppingList {
  lines: ShoppingLine[];
  totalCost: number;
  /** Nombre de desserts restant à fabriquer sur lesquels le calcul repose */
  dessertCount: number;
}

/**
 * Ingrédients nécessaires pour les desserts qui restent à fabriquer (commandes non livrées, moins ce qui est déjà fait).
 * Un dessert commandé = une fois la recette du dessert, comme pour le calcul du coût à la vente.
 */
export function buildShoppingList(
  commandes: Commande[],
  desserts: Dessert[],
  bases: Base[],
  ingredients: RawIngredient[],
): ShoppingList {
  const need = new Map<string, number>();
  let dessertCount = 0;
  const add = (id: string, qty: number) => need.set(id, (need.get(id) ?? 0) + qty);

  for (const cmd of activeProductionCommandes(commandes)) {
    for (const item of cmd.items) {
      const remaining = itemRemaining(item);
      if (remaining <= 0) continue;
      const dessert = desserts.find(d => d.id === item.dessertId);
      if (!dessert) continue;
      dessertCount += remaining;
      for (const comp of dessert.components) {
        if (comp.type === 'ingredient') {
          add(comp.id, comp.quantity * remaining);
        } else {
          const base = findBase(bases, comp.id);
          if (!base) continue;
          const { totalWeight } = calculateBaseCost(base, ingredients);
          if (totalWeight <= 0) continue;
          const share = (comp.quantity / totalWeight) * remaining;
          for (const bc of base.components) add(bc.ingredientId, bc.quantity * share);
        }
      }
    }
  }

  const lines: ShoppingLine[] = [];
  for (const [id, amount] of need) {
    const ingredient = findIngredient(ingredients, id);
    if (!ingredient || amount <= 0) continue;
    const cost = ingredient.unit === 'u' ? ingredient.pricePerKg * amount : (ingredient.pricePerKg * amount) / 1000;
    lines.push({ ingredient, amount, cost });
  }
  const rank = (c: string) => (c === 'Autre' ? 1 : 0);
  lines.sort((a, b) => rank(a.ingredient.category) - rank(b.ingredient.category) || a.ingredient.category.localeCompare(b.ingredient.category, 'fr') || a.ingredient.name.localeCompare(b.ingredient.name, 'fr'));
  return { lines, totalCost: lines.reduce((s, l) => s + l.cost, 0), dessertCount };
}

/** « 1,25 kg », « 300 g », « 0,5 L », « 12 » (unités, arrondi au-dessus). */
export function formatAmount(amount: number, unit: RawIngredient['unit']): string {
  const fr = (n: number, digits: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
  if (unit === 'u') return `${fr(Math.ceil(amount - 1e-9), 0)} pièce${Math.ceil(amount - 1e-9) > 1 ? 's' : ''}`;
  if (unit === 'L') return amount >= 1000 ? `${fr(amount / 1000, 2)} L` : `${fr(Math.round(amount), 0)} ml`;
  return amount >= 1000 ? `${fr(amount / 1000, 2)} kg` : `${fr(Math.round(amount), 0)} g`;
}
