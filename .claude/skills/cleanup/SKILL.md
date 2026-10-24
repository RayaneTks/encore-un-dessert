---
name: cleanup
description: Nettoyage de code « bavard » (doublons, code mort, abstractions inutiles) sans changer le comportement. À utiliser sur demande de nettoyage, désencombrement ou simplification, pas pour une nouvelle fonctionnalité.
---

# Cleanup

Règle d'or : **le comportement ne change pas**. Supprimer plutôt qu'ajouter, pas de nouvelle dépendance, petits diffs réversibles.

## Méthode
1. Borner le périmètre (fichiers demandés ou modifiés ; ne pas élargir sans accord).
2. Fixer le comportement : `npx tsc --noEmit` + `npm run build` verts avant de commencer ; sinon noter le plan de vérification.
3. Lister les défauts, du plus sûr au plus risqué :
   - code mort (exports inutilisés, branches inatteignables, restes de debug) ;
   - doublons à fusionner ;
   - wrappers ou abstractions à usage unique ;
   - nommage et gestion d'erreurs.
4. Un type de défaut à la fois, vérifier (`tsc`, build) après chaque passe.
5. Rapport : fichiers modifiés, simplifications, vérifications faites, risques restants.

## Mode relecture (`--review`)
Ne rien modifier : contrôler le diff (code mort restant, doublons, abstractions inutiles, comportement changé sans l'avoir voulu) et rendre un verdict avec les corrections à faire.
