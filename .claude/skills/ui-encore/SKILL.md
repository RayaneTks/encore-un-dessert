---
name: ui-encore
description: Règles UI/UX d'Encore1Dessert (PWA mobile iOS, client non technique). À charger avant toute création ou modification d'écran, de composant, de libellé ou d'animation.
---

# UI Encore1Dessert

Utilisateur : pâtissier non technique, sur iPhone, mains parfois occupées. Chaque écran doit se comprendre sans explication.

## Principes
1. **Une action principale par écran**, bien visible. Le reste est secondaire ou replié.
2. **Peu de texte** : un libellé + au plus une ligne d'aide. Un exemple vaut mieux qu'une règle.
3. **Vocabulaire du métier** : Ventes, Commandes, Caisse, Recettes, Préparations, Ingrédients. Jamais ticket, dashboard, snapshot, Supabase, TTC (tout est net).
4. **Révélation progressive** : options avancées repliées par défaut (accordéons).
5. **Mobile d'abord** : coque 430 px, zones de sécurité iOS, cibles tactiles ≥ 44 px, pas d'info cachée au survol.

## Design system (`src/index.css`)
- Police Inter. Palette `gourmand-*` : bg #FDF8F2, chocolate #241309 (texte, CTA), biscuit #9B7558 (secondaire), cocoa #5C3D2E, border #EAD8C3, caramel #C05621 (accent), strawberry #B83232 (danger).
- Pas de noir/blanc purs en grandes surfaces, pas de dégradés décoratifs, pas de gros pictos arrondis au-dessus des titres.
- Cartes : `.gourmand-card` (clair), `.gourmand-card-dark` (chocolat). Ne pas imbriquer de cartes.
- `SectionCard` : pas de `mb-6` (espacement via `space-y-3/4` du parent). `padding={false}` pour les listes.
- `ConfirmDialog` : pas de prop `isOpen`, l'envelopper dans `<AnimatePresence>`.
- `BottomNav` : 5 emplacements, Caisse au centre en relief. Pas de 6ᵉ onglet : ranger dans l'Atelier ou les Réglages.

## Interaction
- Boutons : verbe + objet (« Livrer la commande »), jamais « OK » / « Valider ». Un seul bouton primaire par vue.
- Suppression : nommer ce qui est supprimé et ce qui est conservé. Confirmer seulement si irréversible.
- Erreurs : dire quoi faire (« Ajoutez au moins un ingrédient »), ne pas blâmer, pas d'humour.
- États vides : une phrase + l'action pour commencer.
- Champs : label visible (le placeholder n'est pas un label), erreurs sous le champ, `inputMode` adapté (`decimal` pour les quantités).
- Toast pour confirmer, court (« Vente enregistrée »).

## Mouvement
- Motion (Framer) : durées 150–300 ms, ease-out, transform/opacité uniquement ; pas de rebond.
- Respecter `usePrefersReducedMotion`.

## Accessibilité
- Contraste texte ≥ 4,5:1, `aria-label` sur tout bouton-icône, focus visible clavier.
- Pas de couleur seule pour porter un sens (statut = couleur + mot).

## Avant de livrer
`npx tsc --noEmit`, `npm run build`, puis contrôle visuel à 390 px de large. Relire chaque texte : peut-on le raccourcir ou le supprimer ?
