# Collection Blocks — canal de développement stable

## Décision

Les sites en développement chargent désormais les noms de fichiers stables de
la branche `main`. Les fichiers `dev_*` existants restent en réserve tant que le
dépôt local ne possède pas un véritable historique Git.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jonas-nicollin/collection-blocks@main/collection-blocks.css">
<script src="https://cdn.jsdelivr.net/gh/jonas-nicollin/collection-blocks@main/collection-blocks.js"></script>
```

Les runtimes spécialisés utilisent la même règle :

```text
query-block.js
metadata-block.js
related-block.js
locator-block.js
```

Les configurations et styles propres à un site peuvent continuer à être
versionnés. Le changement concerne les runtimes partagés, qui n'ont plus besoin
d'un nouveau nom à chaque itération.

## Ordre de chargement

1. `collection-blocks.css` ;
2. registre Collection Data propre au site ;
3. `collection-blocks.js` ;
4. configuration du bloc concerné ;
5. runtime concerné (`query-block.js`, `metadata-block.js`, etc.) ;
6. éventuel script complémentaire propre au site.

## Mise à jour

1. Modifier directement le fichier stable concerné.
2. Valider sa syntaxe et les sites affectés localement.
3. Committer et pousser sur `main`.
4. Purger l'URL mutable avec l'outil jsDelivr, ou lancer :

```text
node purge-jsdelivr-development-v001.mjs collection-blocks.js query-block.js
```

5. Faire un rechargement forcé dans le navigateur si une ancienne réponse est
   encore présente dans son cache local.

La purge vide les caches jsDelivr ; elle ne vide pas le cache du navigateur.
Elle ne doit être lancée qu'après la mise en ligne du commit.

## Production

Les sites publiés restent épinglés sur un tag immuable :

```html
<script src="https://cdn.jsdelivr.net/gh/jonas-nicollin/collection-blocks@vX.Y.Z/collection-blocks.js"></script>
```

`@main` est réservé au développement. Une release ne doit jamais pointer vers
un nom `dev_*` ni vers la branche mutable.

## État initial de la transition

Les alias stables ont été synchronisés avec :

```text
collection-blocks.css  ← dev_collection-blocks-v031.css
collection-blocks.js   ← dev_collection-blocks-v033.js
query-block.js         ← dev_query-block-v108.js
metadata-block.js      ← dev_metadata-block-v035.js
related-block.js       ← dev_related-block-v118.js
locator-block.js       ← dev_locator-block-v068.js
```

Le checkout local ne contient actuellement aucun commit et aucun remote Git.
Les fichiers `dev_*` ne doivent donc pas encore être supprimés.
