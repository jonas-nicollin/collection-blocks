# Anouck Mutsaerts — harmonisation des titres

Audit effectué le 14 octobre 2026 à partir des données publiques actuelles de
`/work-index` et `/works`.

Règles retenues :

- le titre de `/works` fait foi pour le contenu du titre ;
- la marque est toujours écrite `T Le Temps` ;
- les espaces finaux sont supprimés ;
- la seule correction typographique supplémentaire dans `/works` est
  `A watch Story` → `A Watch Story`, afin d’être cohérent avec l’autre titre de
  la même série.

## Titres à modifier dans `/works`

| Page | Titre actuel | Titre final |
| --- | --- | --- |
| `/works/leonprost` | `T le Temps Accessories` | `T Le Temps Accessories` |
| `/works/aliciadubuis2` | `T le Temps Music` | `T Le Temps Music` |
| `/works/jonasmarguet` | `T le Temps High Jewelry` | `T Le Temps High Jewelry` |
| `/works/marinegiraudo` | `T le Temps HEAD` | `T Le Temps HEAD` |
| `/works/t-le-temps-watches-2` | `T le Temps Watches` | `T Le Temps Watches` |
| `/works/charlesnegre` | `T le Temps Fashion Issue` | `T Le Temps Fashion Issue` |
| `/works/t-le-temps-design/leo` | `T le Temps Design` | `T Le Temps Design` |
| `/works/betinadutoit` | `T le Temps High Jewelry` | `T Le Temps High Jewelry` |
| `/works/t-le-temps-watches` | `T le Temps Watches` | `T Le Temps Watches` |
| `/works/claranebeling` | `T le Temps Fashion` | `T Le Temps Fashion` |
| `/works/t-le-temps-a-watch-story-with-mathieu-lavanchy` | `T Le Temps A watch Story with Matthieu Lavanchy` | `T Le Temps A Watch Story with Matthieu Lavanchy` |
| `/works/t-le-temps-a-couture-story-with-pierre-emmanuel-testard` | `T le Temps A Couture Story with Pierre Emmanuel Testard` | `T Le Temps A Couture Story with Pierre Emmanuel Testard` |

## Titres à modifier dans Work Index

La Source URL permet de distinguer les entrées qui ont actuellement le même
titre.

| Source URL | Titre actuel | Titre final |
| --- | --- | --- |
| `/works/aliciadubuis2` | `T le Temps Music` | `T Le Temps Music` |
| `/works/marinegiraudo` | `T le Temps HEAD ` | `T Le Temps HEAD` |
| `/works/leonprost` | `T le Temps Accessories` | `T Le Temps Accessories` |
| `/works/jonasmarguet` | `T le Temps High Jewelry ` | `T Le Temps High Jewelry` |
| `/works/byredo` | `Byredo ` | `Byredo` |
| `/works/sneakers` | `T le Temps - Sneakers ` | `T Le Temps - Sneakers` |
| `/works/t-le-temps-watches-2` | `T le Temps Watches` | `T Le Temps Watches` |
| `/works/loewe-perfume` | `Loewe Perfumes` | `Loewe Perfume` |
| `/works/cdcss24` | `Comptoir Des Cotonniers SS24` | `Comptoir des Cotonniers Lookbook SS24` |
| `/works/charlesnegre` | `T le Temps Fashion Issue` | `T Le Temps Fashion Issue` |
| `/works/t-le-temps-design/leo` | `T le Temps Design ` | `T Le Temps Design` |
| `/works/claranebeling` | `T le Temps Fashion Issue` | `T Le Temps Fashion` |
| `/works/t-le-temps-design/paul` | `T Le Temps Design ` | `T Le Temps Design` |
| `/works/t-le-temps-a-watch-story-with-mathieu-lavanchy` | `T Le Temps Watches` | `T Le Temps A Watch Story with Matthieu Lavanchy` |
| `/works/t-le-temps-a-watch-story-with-felix-dol-maillot` | `T Le Temps Watches` | `T Le Temps A Watch Story with Felix Dol Maillot` |
| `/works/josephmolines` | `T Le Temps accessories` | `T Le Temps Accessories` |
| `/works/comptoir-des-cotonniers-denim` | `Comptoir des Cotonniers Campaign Denim SS23` | `Comptoir Des Cotonniers Campaign Denim` |
| `/works/princesse-tam-tam-pyjmania` | `Princesse Tam Tam Campaign Sleepwear ss23` | `Princesse Tam Tam Campaign Pyjmania` |
| `/works/on-running-cloudeasy-campaign` | `On running Cloudeasy Campaign SS22` | `On Running Cloudeasy Campaign` |
| `/works/t-le-temps-a-couture-story-with-pierre-emmanuel-testard` | `T Le Temps Couture` | `T Le Temps A Couture Story with Pierre Emmanuel Testard` |

## Point restant hors titres

`Emmanuelle Khanh Campaign AW23/24` a déjà le même titre dans les deux
collections. Son problème est uniquement son URL : la page `/works` expose
encore le `fullUrl` malformé `/works//works/ek-aw23/24`, tandis que Work Index
pointe vers `/works/ek-aw23/24`. Il faut corriger l’URL Slug de la page
Portfolio, puis reporter le chemin final dans la Source URL de Work Index.
