# Anouck Mutsaerts — nettoyage des URL

Plan établi le 14 octobre 2026. Les URL de `/works` restent les destinations
canoniques. Le slug correspondant de Work Index reprend le même identifiant,
ce qui rend chaque relation immédiatement vérifiable.

Les URL déjà descriptives sont conservées. Les changements ci-dessous ciblent
les slugs opaques (`modele-…`), imbriqués, malformés ou fondés uniquement sur
un nom de personne.

## Ordre des modifications

Pour chaque ligne concernée :

1. modifier l’URL Slug de la page `/works` lorsqu’elle change ;
2. reporter la nouvelle URL dans le champ Source URL de Work Index ;
3. modifier l’URL Slug de l’item Work Index ;
4. ajouter une redirection 301 de l’ancienne page `/works` vers la nouvelle.

## URL à harmoniser

| Titre final | `/works` actuel | `/works` final | Work Index actuel | Work Index final |
| --- | --- | --- | --- | --- |
| `T Le Temps Music` | `/works/aliciadubuis2` | `/works/t-le-temps-music` | `/work-index/t-le-temps-music` | inchangé |
| `T Le Temps HEAD` | `/works/marinegiraudo` | `/works/t-le-temps-head` | `/work-index/t-le-temps-head` | inchangé |
| `T Le Temps Accessories` | `/works/leonprost` | `/works/t-le-temps-accessories-leon-prost` | `/work-index/leonprost` | `/work-index/t-le-temps-accessories-leon-prost` |
| `Valextra Campaign` | `/works/valextra-campaign` | inchangé | `/work-index/modele-dtms7-ga65h-hsnj4-fb7c9` | `/work-index/valextra-campaign` |
| `T Le Temps High Jewelry` | `/works/jonasmarguet` | `/works/t-le-temps-high-jewelry-jonas-marguet` | `/work-index/jonasmarguet` | `/work-index/t-le-temps-high-jewelry-jonas-marguet` |
| `Valextra Campaign` | `/works/valextra` | inchangé | `/work-index/modele-dtms7-ga65h-hsnj4` | `/work-index/valextra` |
| `Byredo` | `/works/byredo` | inchangé | `/work-index/modele-dtms7-ga65h-etgax` | `/work-index/byredo` |
| `T Le Temps - Sneakers` | `/works/sneakers` | `/works/t-le-temps-sneakers` | `/work-index/modele-dtms7-ga65h` | `/work-index/t-le-temps-sneakers` |
| `Comptoir des Cotonniers Lookbook SS24` | `/works/cdcss24` | `/works/comptoir-des-cotonniers-lookbook-ss24` | `/work-index/modele-l9f3a` | `/work-index/comptoir-des-cotonniers-lookbook-ss24` |
| `T Le Temps Fashion Issue` | `/works/charlesnegre` | `/works/t-le-temps-fashion-issue-charles-negre` | `/work-index/modele-gr95g` | `/work-index/t-le-temps-fashion-issue-charles-negre` |
| `Sarah Madeleine Bru Jewelry` | `/works/smb` | `/works/sarah-madeleine-bru-jewelry` | `/work-index/modele-6rtr2` | `/work-index/sarah-madeleine-bru-jewelry` |
| `T Le Temps Design` | `/works/t-le-temps-design/leo` | `/works/t-le-temps-design-leo` | `/work-index/modele-n4efz` | `/work-index/t-le-temps-design-leo` |
| `Princesse Tam Tam SS23` | `/works/princesse-tam-tam-ss23` | inchangé | `/work-index/modele-9gp3c` | `/work-index/princesse-tam-tam-ss23` |
| `T Le Temps Fashion` | `/works/claranebeling` | `/works/t-le-temps-fashion-clara-nebeling` | `/work-index/modele-5nlmy` | `/work-index/t-le-temps-fashion-clara-nebeling` |
| `Emmanuelle Khanh Campaign AW23/24` | `/works//works/ek-aw23/24` | `/works/emmanuelle-khanh-campaign-aw23-24` | `/work-index/ek-aw23/24` | `/work-index/emmanuelle-khanh-campaign-aw23-24` |
| `T Le Temps High Jewelry` | `/works/betinadutoit` | `/works/t-le-temps-high-jewelry-betina-du-toit` | `/work-index/modele-8flx7` | `/work-index/t-le-temps-high-jewelry-betina-du-toit` |
| `T Le Temps Design` | `/works/t-le-temps-design/paul` | `/works/t-le-temps-design-paul-lepreux` | `/work-index/t-le-temps-a-design-story-with-paul-lepreux` | `/work-index/t-le-temps-design-paul-lepreux` |
| `T Le Temps Accessories` | `/works/josephmolines` | `/works/t-le-temps-accessories-joseph-molines` | `/work-index/t-le-temps-an-accessory-story` | `/work-index/t-le-temps-accessories-joseph-molines` |
| `On Running Cloudeasy Campaign` | `/works/on-running-cloudeasy-campaign` | inchangé | `/work-index/on-running-cloudeasy` | `/work-index/on-running-cloudeasy-campaign` |
| `T Le Temps A Couture Story with Pierre Emmanuel Testard` | `/works/t-le-temps-a-couture-story-with-pierre-emmanuel-testard` | inchangé | `/work-index/t-le-temps-iii` | `/work-index/t-le-temps-a-couture-story-with-pierre-emmanuel-testard` |

Les autres URL sont déjà lisibles et peuvent rester telles quelles. Le suffixe
`-2` de `/works/t-le-temps-watches-2` est conservé pour l’instant : le projet
ne contient pas assez d’information publique pour lui attribuer un identifiant
distinctif fiable sans risquer de le confondre avec l’autre projet Watches.

## Redirections `/works`

À ajouter dans les URL Mappings Squarespace après les changements de slugs :

```text
/works/aliciadubuis2 -> /works/t-le-temps-music 301
/works/marinegiraudo -> /works/t-le-temps-head 301
/works/leonprost -> /works/t-le-temps-accessories-leon-prost 301
/works/jonasmarguet -> /works/t-le-temps-high-jewelry-jonas-marguet 301
/works/sneakers -> /works/t-le-temps-sneakers 301
/works/cdcss24 -> /works/comptoir-des-cotonniers-lookbook-ss24 301
/works/charlesnegre -> /works/t-le-temps-fashion-issue-charles-negre 301
/works/smb -> /works/sarah-madeleine-bru-jewelry 301
/works/t-le-temps-design/leo -> /works/t-le-temps-design-leo 301
/works/claranebeling -> /works/t-le-temps-fashion-clara-nebeling 301
/works/ek-aw23/24 -> /works/emmanuelle-khanh-campaign-aw23-24 301
/works/betinadutoit -> /works/t-le-temps-high-jewelry-betina-du-toit 301
/works/t-le-temps-design/paul -> /works/t-le-temps-design-paul-lepreux 301
/works/josephmolines -> /works/t-le-temps-accessories-joseph-molines 301
```

Pour Emmanuelle Khanh, vérifier après modification quelle forme de l’ancienne
URL Squarespace accepte comme origine de redirection : le JSON expose un
double `/works`, tandis que Work Index contient actuellement
`/works/ek-aw23/24`.
