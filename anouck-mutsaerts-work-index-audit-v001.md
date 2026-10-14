# Anouck Mutsaerts — Work Index audit v001

Source auditée le 14 octobre 2026 :

```text
https://www.anouckmutsaerts.com/work-index?format=json
```

## Nom et alias recommandés

- Titre Squarespace : **Work Index**.
- URL Squarespace : `/work-index`.
- Alias interne Collection Data et Query Block : `/work-index`.

La collection et son alias interne utilisent maintenant le même nom.

## Contenu actuel

```text
34 projets
25 Creative direction
19 Styling
10 projets présents dans les deux catégories
1 projet contenant une vidéo Squarespace native
```

Un projet qui possède les deux catégories doit être rendu dans les deux
colonnes. L'ordre de la collection reste l'ordre éditorial de référence dans
chaque colonne.

## Source URL à corriger

Ces quatre valeurs ne sont ni des URL absolues ni des chemins commençant par
`/` :

```text
T le Temps Music         → alicidubuis2
T le Temps HEAD          → marinegiraudo
T le Temps Accessories   → leonprost
T le Temps High Jewelry  → jonasmarguet
```

Chaque valeur doit devenir le chemin exact de la page correspondante dans
`/works`, par exemple `/works/…`. Le nouveau bloc ne doit pas inventer ces
destinations.

## Phase 1 — Collection Data

Copier :

```text
collection-data-sources-anouck-mutsaerts-v001.json
```

dans le dépôt Collection Data sous :

```text
sources/collections/anouck-mutsaerts.json
```

Puis lancer le workflow de synchronisation et vérifier :

```text
https://collection-data.pages.dev/data/collections/anouck-mutsaerts/work-index.json
```

Cette première source conserve les champs déjà pris en charge : titre, image
principale, catégories, tags et Source URL. Elle n'expose pas le `body` HTML.

## Vidéo — architecture recommandée

Le projet «On running Cloudeasy Campaign SS22» contient un bloc vidéo natif
Squarespace configuré en autoplay, muted, loop et sans controls. Le moyen le
plus propre n'est pas de recopier son HTML complet dans chaque card.

Ajouter ultérieurement un adaptateur Collection Data opt-in, limité à cette
source, qui :

1. lit le bloc vidéo natif dans le `body` de l'item d'index ;
2. extrait uniquement les données nécessaires ;
3. produit un champ `media` normalisé ;
4. supprime le HTML brut du JSON public.

Structure cible :

```json
{
  "media": [
    {
      "type": "video",
      "src": "…",
      "poster": "…",
      "aspectRatio": 0.8,
      "autoplay": true,
      "loop": true,
      "muted": true,
      "playsInline": true
    }
  ]
}
```

Le Query Block rend ensuite un élément `<video>` sans attribut `controls`, avec
`muted`, `autoplay`, `loop` et `playsinline`. La source vidéo ne doit être
chargée que lorsque la card approche du viewport ; la lecture est suspendue
hors écran. Avec `prefers-reduced-motion: reduce`, le poster reste affiché sans
lecture automatique.

## Enrichissement futur depuis `/works`

La collection Portfolio `/works?format=json` ne contient pas le contenu complet
des sections de chaque page. Pour récupérer d'autres images ou informations,
il faudra un enrichissement opt-in séparé :

1. l'index reste la source canonique pour l'ordre, le titre, les catégories,
   l'image ou vidéo de couverture et la destination ;
2. le builder suit la `Source URL` seulement lorsqu'une source active
   explicitement `detailEnrichment` ;
3. un adaptateur de page de détail extrait des champs autorisés vers un schéma
   normalisé (`media`, crédits, légende, année, etc.) ;
4. les HTML complets et scripts Squarespace ne sont jamais publiés dans le JSON.

Cette approche reproduit la logique d'un adaptateur Produits sans modifier les
payloads des sites existants.

## Nouveau Query Block — principe retenu

Le bloc sera une seule expérience visuelle alimentée par une seule collection,
mais avec deux listes dérivées :

```text
gauche  → catégorie Creative direction
droite  → catégorie Styling
```

Chaque piste contient deux copies du même rendu pour permettre une boucle
continue. Les copies techniques sont `aria-hidden` et `inert`; seule la copie
principale reste navigable au clavier.

Le mouvement est piloté par un seul contrôleur local au bloc :

- scroll vers le bas : piste gauche vers le haut, piste droite vers le bas ;
- scroll vers le haut : mouvement inverse ;
- mise à jour dans `requestAnimationFrame` ;
- positions ramenées par modulo à la hauteur de chaque piste ;
- recalcul des hauteurs avec `ResizeObserver` ;
- aucun jQuery, Swiper ni écouteur global sur `window`.

Sur mobile, la division reste 50/50 comme demandé. En mode réduction des
mouvements, le bloc devient deux colonnes normalement défilables et abandonne
la boucle liée au geste.

Le code du Query Block et l'adaptateur vidéo doivent être développés après
validation de cette règle de duplication pour les dix projets communs aux deux
catégories.
