# Anouck Mutsaerts — Work Index audit v002

Audit en lecture seule effectué le 14 octobre 2026 sur :

```text
https://collection-data.pages.dev/data/collections/anouck-mutsaerts/work-index.json
https://www.anouckmutsaerts.com/works?format=json
```

La version publique de Collection Data contenait 34 entrées au moment de
l’audit. Les corrections effectuées ensuite dans Squarespace ne figurent dans
ce rapport que lorsqu’elles avaient déjà atteint le JSON public.

Les quatre corrections annoncées sont maintenant synchronisées :
`/works/aliciadubuis2`, `/works/marinegiraudo`, `/works/leonprost` et
`/works/jonasmarguet` répondent toutes correctement.

## Source URL encore cassées

| Titre dans Work Index | Source URL vue dans le JSON | Correction |
| --- | --- | --- |
| Valextra Campaign | `/works/valextra2` | `/works/valextra-campaign` |
| Comptoir des Cotonniers SS24 | `/works/CDCSS24` | `/works/cdcss24` |
| T Le Temps accessories | `/works/layering` | `/works/josephmolines` |
| T Le Temps Couture | `/works/bon-genie-multigenerationnel-ss23` | probablement `/works/t-le-temps-a-couture-story-with-pierre-emmanuel-testard` |

Le projet «Emmanuelle Khanh Campaign AW23/24» a un problème différent : la
page Portfolio elle-même expose actuellement l’URL malformée
`/works//works/ek-aw23/24`. Il faut d’abord corriger son URL Slug dans `/works`
(par exemple `emmanuelle-khanh-aw23-24`), puis reporter le chemin final dans
la Source URL de Work Index.

## Titres non strictement identiques

La règle recommandée est simple : le titre de Work Index doit être exactement
le même que le titre de la page Portfolio liée. Cela évite une seconde couche
éditoriale et rend le contrôle automatisable.

Différences strictes constatées sur les destinations valides :

| Work Index | Page `/works` |
| --- | --- |
| `T le Temps HEAD ` | `T le Temps HEAD` |
| `T le Temps High Jewelry ` | `T le Temps High Jewelry` |
| `Byredo ` | `Byredo` |
| `T le Temps - Sneakers ` | `T Le Temps - Sneakers` |
| `Loewe Perfumes` | `Loewe Perfume` |
| `T le Temps Design ` | `T le Temps Design` |
| `T le Temps Fashion Issue` | `T le Temps Fashion` |
| `T Le Temps High Jewelry` | `T le Temps High Jewelry` |
| `T Le Temps Design ` | `T Le Temps Design` |
| `T Le Temps Watches` | `T Le Temps A watch Story with Matthieu Lavanchy` |
| `T Le Temps Watches` | `T Le Temps A Watch Story with Felix Dol Maillot` |
| `Comptoir des Cotonniers Campaign Denim SS23` | `Comptoir Des Cotonniers Campaign Denim` |
| `Princesse Tam Tam Campaign Sleepwear ss23` | `Princesse Tam Tam Campaign Pyjmania` |
| `On running Cloudeasy Campaign SS22` | `On Running Cloudeasy Campaign` |

Les deux collections contiennent aussi plusieurs occurrences de `T le Temps`
et `T Le Temps`. Pour une nomenclature réellement uniforme, utiliser
`T Le Temps` partout, supprimer les espaces finaux et conserver les codes de
saison en capitales (`SS23`, `AW23/24`).

## Contrôle recommandé

Conserver la Source URL native de Squarespace : elle reste la méthode la plus
directe et la moins ambiguë, surtout lorsque plusieurs projets ont le même
titre. En revanche, ajouter au workflow Collection Data un audit opt-in qui :

1. charge une seule fois `/works?format=json` ;
2. vérifie que chaque Source URL correspond à un `fullUrl` existant ;
3. compare les titres après suppression des espaces de début et de fin ;
4. produit un rapport explicite et fait échouer la synchronisation lorsqu’une
   destination est absente.

Un rapprochement automatique par titre n’est pas recommandé : `Valextra
Campaign`, `T Le Temps Watches` et plusieurs autres intitulés ne sont pas
uniques.
