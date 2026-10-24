import { RawIngredient, Base, Dessert } from '../types';

export const initialIngredients: RawIngredient[] = [
  { id: 'ing-butter', name: 'Beurre', pricePerKg: 9.96, unit: 'kg', category: 'Crèmerie', emoji: '🧈', purchaseLabel: '9,96 €/kg', notes: 'Plaquettes et cuisson', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-eggs', name: 'Œufs', pricePerKg: 0.21, unit: 'u', category: 'Élevage', emoji: '🥚', purchaseLabel: '4,29 € les 20', notes: 'Coût unitaire normalisé', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-milk', name: 'Lait', pricePerKg: 0.92, unit: 'L', category: 'Crèmerie', emoji: '🥛', purchaseLabel: '0,92 €/L', notes: 'Base liquide', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-heavy-cream', name: 'Crème liquide', pricePerKg: 3.99, unit: 'L', category: 'Crèmerie', emoji: '🫙', purchaseLabel: '3,99 €/L', notes: '35% MG', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-hazelnut', name: 'Noisette', pricePerKg: 6.98, unit: 'kg', category: 'Fruits secs', emoji: '🌰', purchaseLabel: '6,98 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-almond', name: 'Amande', pricePerKg: 11.38, unit: 'kg', category: 'Fruits secs', emoji: '🥜', purchaseLabel: '11,38 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-almond-powder', name: "Poudre d'amande", pricePerKg: 12.50, unit: 'kg', category: 'Fruits secs', emoji: '🥜', purchaseLabel: '12,50 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-cornstarch', name: 'Maïzena', pricePerKg: 3.75, unit: 'kg', category: 'Épicerie', emoji: '📦', purchaseLabel: '3,75 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-sugar', name: 'Sucre', pricePerKg: 0.87, unit: 'kg', category: 'Épicerie', emoji: '🍬', purchaseLabel: '0,87 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-icing-sugar', name: 'Sucre glace', pricePerKg: 3.79, unit: 'kg', category: 'Épicerie', emoji: '🍬', purchaseLabel: '3,79 €/kg', notes: '', createdAt: '2026-04-01T00:00:00Z' },
  { id: 'ing-flour', name: 'Farine', pricePerKg: 0.65, unit: 'kg', category: 'Épicerie', emoji: '🌾', purchaseLabel: '0,65 €/kg', notes: 'T55 ou équivalent', createdAt: '2026-04-01T00:00:00Z' },
];

export const initialBases: Base[] = [
  {
    id: 'prep-shortcrust', name: 'Pâte sucrée', category: 'Fond', family: '', yieldQty: null, yieldLabel: '', emoji: '🥧', notes: 'Base standard pour toutes les tartes', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { ingredientId: 'ing-flour', quantity: 250 },
      { ingredientId: 'ing-butter', quantity: 150 },
      { ingredientId: 'ing-icing-sugar', quantity: 100 },
      { ingredientId: 'ing-almond-powder', quantity: 30 },
      { ingredientId: 'ing-eggs', quantity: 1 },
    ],
  },
  {
    id: 'prep-caramel', name: 'Caramel beurre salé', category: 'Insert', family: '', yieldQty: null, yieldLabel: '', emoji: '🍯', notes: 'Base maison', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { ingredientId: 'ing-sugar', quantity: 200 },
      { ingredientId: 'ing-butter', quantity: 80 },
      { ingredientId: 'ing-heavy-cream', quantity: 120 },
    ],
  },
  {
    id: 'prep-almond-cream', name: "Crème d'amande", category: 'Crème', family: '', yieldQty: null, yieldLabel: '', emoji: '🍮', notes: '', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { ingredientId: 'ing-butter', quantity: 100 },
      { ingredientId: 'ing-almond-powder', quantity: 100 },
      { ingredientId: 'ing-sugar', quantity: 100 },
      { ingredientId: 'ing-eggs', quantity: 2 },
    ],
  },
];

export const initialDesserts: Dessert[] = [
  {
    id: 'dessert-peanut-caramel', name: 'Tarte cacahuète caramel', emoji: '🥜', sellPriceParticulier: 44, sellPricePro: 38, servings: 8, productKind: 'tarte', notes: '', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { type: 'base', id: 'prep-shortcrust', quantity: 180 },
      { type: 'base', id: 'prep-caramel', quantity: 95 },
      { type: 'ingredient', id: 'ing-almond', quantity: 18 },
    ],
  },
  {
    id: 'dessert-milk-choc', name: 'Tarte chocolat lait', emoji: '🍫', sellPriceParticulier: 42, sellPricePro: 36, servings: 8, productKind: 'tarte', notes: '', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { type: 'base', id: 'prep-shortcrust', quantity: 180 },
      { type: 'base', id: 'prep-caramel', quantity: 70 },
      { type: 'ingredient', id: 'ing-hazelnut', quantity: 24 },
    ],
  },
  {
    id: 'dessert-almond', name: 'Tarte amandine', emoji: '🍰', sellPriceParticulier: 38, sellPricePro: 33, servings: 8, productKind: 'tarte', notes: '', createdAt: '2026-04-01T00:00:00Z',
    components: [
      { type: 'base', id: 'prep-shortcrust', quantity: 180 },
      { type: 'base', id: 'prep-almond-cream', quantity: 200 },
    ],
  },
];
