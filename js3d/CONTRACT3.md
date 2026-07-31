# CONTRAT D'API v3 — « Dresseur complet » (version 3D du Jeu de Robin)

Ce fichier **fait autorité** pour la vague de développement du 2026-07-31.
Il **complète** `CONTRACT.md` (v1) et `CONTRACT2.md` (v2), qui restent valables pour tout
ce qu'ils décrivent déjà. En cas de contradiction, **v3 gagne**, et seulement sur les
points qu'il traite explicitement.

Chaque module est écrit par un agent différent, **en parallèle**, dans un dépôt isolé.
Respecter ce contrat à la lettre est ce qui permet à l'ensemble de s'assembler sans retouche.

---

## 0. D'où ça vient

Robin (10 ans) a testé le jeu. Onze demandes en sont sorties. Les voici, telles quelles :

1. Impossible de mettre un Pokémon de la boîte dans son équipe.
2. Pouvoir sortir un Pokémon de sa Ball et qu'il reste à côté de soi.
3. Une histoire pour trouver les légendaires.
4. Les Pokémon doivent pouvoir évoluer.
5. Les légendaires doivent ressembler presque aux vrais (série + Pokémon Horizons).
6. Des arènes, et pouvoir s'en servir pour les combats spéciaux.
7. D'autres types : spectre, psy, plante, eau, fée, acier, dragon, électrique, feu, poison,
   combat, glace, normal.
8. Un Centre Pokémon par région pour acheter des Balls, des potions et plein d'autres choses.
9. Pouvoir choisir le type de Ball avant de lancer — impossible aujourd'hui.
10. Une académie qui apprend la Téracristallisation (activer le mode cristal sur son Pokémon).
    10 bis. L'académie ressemble à un immense château, avec des tours, des ponts et des arbres.
11. Quand les gens voient un légendaire, ils réagissent avec étonnement.

Décisions prises avec le parent de Robin, elles ne se rediscutent pas :

- **Types** : on **fusionne** — les 12 types actuels sont conservés, 7 nouveaux sont ajoutés
  (→ 19). Aucune créature n'est retypée de force.
- **Légendaires** : silhouettes **reconnaissables** (posture, couleurs, attributs), mais les
  **noms restent ceux du jeu de Robin**. On s'inspire, on ne copie pas.
- **Évolutions** : chaînes par niveau, plus quelques pierres achetables au Centre.
  Les légendaires n'évoluent pas.
- **Histoire** : **une quête par région, six au total**. Le badge de l'arène ouvre le
  sanctuaire, où les légendaires de la région se révèlent.

---

## 1. Règles générales — elles n'ont pas changé, relisez-les

Le §1 de `CONTRACT2.md` s'applique intégralement. Les cinq qui font le plus de dégâts
quand on les oublie :

1. **Pas d'`import`/`export`, pas de modules ES.** Un `<script>` classique, une IIFE, et
   `R3.register('nom', api)` en fin de fichier. Le jeu doit rester jouable en
   **double-cliquant `index3d.html`** (`file://`) : aucun `fetch`, aucun fichier externe,
   aucune texture sur disque. Tout est procédural ou en `CanvasTexture`.
2. **Ne jamais modifier `js/`** — le jeu 2D d'origine doit continuer à tourner à l'identique.
3. **N'écrire que dans les fichiers qui vous sont assignés** (§13). Un autre agent travaille
   dans le fichier d'à côté au même moment. Besoin d'autre chose ? Codez contre ce contrat
   et prévoyez un repli.
4. **Dégradation gracieuse** : si `R3.get('xxx')` renvoie `undefined`, produire un repli et
   continuer. **Aucun module ne lève d'exception au chargement.**
5. **Passer par `R3`** pour tout matériau/géométrie (`R3.mat()`, jamais
   `new THREE.MeshStandardMaterial`), et animer sur `R3.clock.t`, jamais sur un compteur de
   frames.

Rappels de forme : commentaires **en français**, expliquant le *pourquoi* ; `node --check`
doit passer ; budget **< 250 draw calls** et **< 14 ms CPU/frame** ; public **10 ans** —
lisible, généreux, jamais punitif.

---

## 2. LES 19 TYPES ÉLÉMENTAIRES — `types3d.js` *(remplace le §2 de v2)*

La table v2 est **étendue, pas refaite**. Deux types sont **renommés**, sept sont **ajoutés**,
aucune relation existante n'est retirée.

### 2.1 Renommages, avec alias obligatoires

| ancien id | nouvel id    | label affiché |
|-----------|--------------|---------------|
| `foudre`  | `electrique` | Électrique    |
| `ombre`   | `spectre`    | Spectre       |

`dex3d.js`, `moves3d.js`, `legend3d.p*.js` et les sauvegardes existantes contiennent encore
`foudre` et `ombre`. Ces fichiers **ne seront pas modifiés**. `types3d.js` doit donc exposer
une table d'alias et **normaliser toute entrée** dans `get()`, `effectiveness()`, `color()`,
`label()`, `icon()` et `badge()` :

```js
const ALIAS = { foudre: 'electrique', ombre: 'spectre' };
```

`normalize(id)` est exportée. Un ancien id doit se comporter **exactement** comme le nouveau.

### 2.2 La table cible (19 entrées)

| id           | label       | couleur   | icône | fort contre                     | faible contre               |
|--------------|-------------|-----------|-------|---------------------------------|-----------------------------|
| `feu`        | Feu         | `#ff6b3d` | 🔥    | plante, glace, acier            | eau, roche                  |
| `eau`        | Eau         | `#41a6f6` | 💧    | feu, roche                      | plante, electrique          |
| `plante`     | Plante      | `#38b764` | 🌿    | eau, terre                      | feu, glace, poison          |
| `electrique` | Électrique  | `#f1c40f` | ⚡    | eau, air                        | terre, roche                |
| `glace`      | Glace       | `#a8e6ff` | ❄️    | plante, air, dragon             | feu, roche, acier           |
| `air`        | Air         | `#bfe3f2` | 💨    | plante, terre, combat           | electrique, glace           |
| `terre`      | Terre       | `#c08c4a` | 🍂    | electrique, roche, poison, acier| plante, air                 |
| `roche`      | Roche       | `#9aa0a6` | 🪨    | feu, glace                      | eau, terre, combat, acier   |
| `lumiere`    | Lumière     | `#ffe066` | ✨    | spectre, roche                  | espace, terre               |
| `spectre`    | Spectre     | `#7a5cbf` | 👻    | temps, air, psy                 | lumiere, feu, normal        |
| `temps`      | Temps       | `#d896ff` | ⏳    | espace, electrique              | spectre, roche              |
| `espace`     | Espace      | `#4b62d9` | 🌌    | lumiere, terre                  | temps, eau                  |
| `psy`        | Psy         | `#ff6b9d` | 🔮    | combat, poison                  | spectre, acier              |
| `fee`        | Fée         | `#ffb3d9` | 🧚    | dragon, combat, spectre         | acier, poison, feu          |
| `acier`      | Acier       | `#b8c4d0` | ⚙️    | glace, roche, fee               | feu, eau, electrique        |
| `dragon`     | Dragon      | `#6a4fd8` | 🐉    | temps, espace                   | fee, glace, acier           |
| `poison`     | Poison      | `#b45cd8` | ☠️    | plante, fee                     | terre, psy, acier           |
| `combat`     | Combat      | `#e8622c` | 🥊    | normal, roche, acier, glace     | air, psy, fee               |
| `normal`     | Normal      | `#d8d0c4` | ◻️    | *(aucun)*                       | roche, acier, spectre       |

`ORDER` contient les 19 ids dans **cet ordre exact** (c'est l'ordre d'affichage partout :
filtre du Pokédex, légende de la carte, sélecteur de type Téra).

Multiplicateurs inchangés : `fort ×1.6`, `faible ×0.6`, sinon `×1.0`. Deux types en défense :
les multiplicateurs se multiplient.

### 2.3 Le type NEUTRE

Un vrai type `normal` existe désormais. Le repli `NEUTRE` de v2 s'appelait « Normal » : il
devient **`{ id: null, label: 'Neutre', color: '#94b0c2', icon: '◇' }`** pour lever
l'ambiguïté. Il ne donne toujours ni bonus ni malus et n'entre pas dans `ORDER`.

### 2.4 Auto-vérification

Le `selfCheck()` existant est conservé et **étendu** : 19 entrées dans `ORDER`, chaque alias
pointe vers un type réel, aucun type ne se cite lui-même, aucun type n'est à la fois fort et
faible contre le même. Il `console.warn` — il ne lève jamais.

---

## 3. `evolve3d.js` — les évolutions *(nouveau module)*

```js
R3.register('evolve', {
  CHAINS,                          // [chain] — toutes les chaînes du jeu
  chainOf(speciesId),              // -> chain | null
  nextOf(speciesId),               // -> step | null  (l'étape suivante, s'il y en a une)
  canEvolve(mon),                  // -> step | null  (conditions remplies ici et maintenant)
  evolve(mon),                     // -> { from, to, learned:[moveId] } | null  — MUTE le mon
  stoneFor(speciesId),             // -> itemId | null
  isStone(itemId),                 // -> bool
  applyStone(mon, itemId),         // -> résultat de evolve() | null
  previewName(speciesId),          // -> nom de la forme suivante, ou null
});
```

```js
chain = { base: 'flamdrak', steps: [step, step] }
step  = {
  from: 'flamdrak', to: 'flamdrakon',
  level: 18,                       // évolution au passage de niveau
  stone: null,                     // ou 'pierre_feu' — alors `level` sert de niveau minimum
  message: 'Flamdrak grandit et déploie ses ailes !',
}
```

Règles :

- **Les 26 créatures d'origine** reçoivent une chaîne. Trois stades pour les starters
  (niveaux ~16 et ~34), deux stades pour la majorité (~20), aucune pour quelques créatures
  volontairement « uniques ». Viser **au moins 20 nouvelles formes évoluées**.
- **Aucun légendaire n'évolue.** `chainOf()` renvoie `null` pour eux, sans exception.
- `evolve(mon)` conserve `uid`, `nick` (sauf s'il valait le nom de l'espèce — il suit alors
  la nouvelle espèce), `xp` et les PP ; recalcule `maxHp/atk/def/speed` depuis la nouvelle
  espèce au niveau courant ; ajoute les capacités du `learnset` franchies ; **remplit les PV
  au maximum** (c'est un jeu pour enfant, une évolution est une récompense).
- Les nouvelles espèces sont déclarées **dans ce module** via `R3.get('dex').addSpecies(sp)`
  si l'API existe, sinon via `EVOLVED` exporté que `dex3d` lira. **Ne pas modifier `dex3d.js`**.
  Chaque forme évoluée respecte le schéma `species` du §8 de v2 (types, stats, moveIds,
  learnset, description, color, catchRate), avec des stats **1,35 à 1,6×** celles de la base.
- Les nouvelles espèces peuvent utiliser les **7 nouveaux types** — c'est même souhaitable.
- Les modèles 3D des formes évoluées sont écrits par un **autre agent** (`creatures3d.p5.js`).
  Ici, on se contente de nommer les ids : `R3.registerCreature('flamdrakon', …)` viendra
  d'ailleurs. Si un modèle manque, le jeu doit afficher le modèle de la forme de base plutôt
  que rien : prévoir `fallbackModel(speciesId)` dans l'API.

---

## 4. `buddy3d.js` — le compagnon hors de sa Ball *(nouveau module)*

```js
R3.register('buddy', {
  out(),                     // -> Mon | null — qui est dehors en ce moment
  release(mon, opts),        // sort la créature : animation de Ball qui s'ouvre
  recall(),                  // la rappelle dans sa Ball
  toggle(mon),               // sort / rappelle
  update(dt, player),        // suivi + animation — appelé par game3d à chaque frame
  group(),                   // -> THREE.Group | null (à ajouter à la scène)
  isOut(),                   // -> bool
  reactTo(kind),             // 'legendaire' | 'combat' | 'capture' — petite animation
});
```

Comportement attendu :

- La créature **suit le joueur** à 1,6 tuile derrière, en lissant sa trajectoire ; elle
  s'arrête quand le joueur s'arrête, tourne la tête vers lui, respire (idle de
  `creatures3d.*` si disponible).
- Elle **ne bloque jamais** le joueur ni les PNJ, ne déclenche aucune collision, et se
  téléporte près du joueur si elle est distancée de plus de 8 tuiles (téléportation
  discrète, derrière lui de préférence).
- Elle suit le relief : hauteur du sol via `R3.get('regions').heightAt(x, y)` si la fonction
  existe, sinon `y = 0`.
- **Rappel automatique** avant un combat, un vol en dirigeable ou un changement de région ;
  ressortie automatique après, si elle était dehors.
- Sortie et rappel : une vraie petite animation de Ball (la Ball part, s'ouvre, éclair
  blanc, la créature grandit depuis 0). Moins de 0,8 s.
- Coût : **une seule créature dehors à la fois**. Le modèle est mis en cache et réutilisé.

---

## 5. `quest3d.js` — l'histoire des légendaires *(nouveau module)*

```js
R3.register('quest', {
  QUESTS,                          // [quest] — 6, une par région
  get(regionId),
  state(regionId),                 // -> 'inconnue' | 'entendue' | 'ouverte' | 'accomplie'
  hint(regionId),                  // -> texte d'indice, à afficher dans le journal
  onBadge(regionId),               // appelé par game3d quand un badge est gagné
  onLegendCaught(speciesId),       // -> { questDone, text } | null
  sanctuary(regionId),             // -> { x, y, name, open } — le lieu du sanctuaire
  isLegendAwake(speciesId),        // -> bool — le légendaire peut-il apparaître ?
  dialogFor(npcRole, regionId),    // -> [string] — ce que raconte un PNJ de la région
  journal(),                       // -> [{ region, titre, ligne, fait }] pour le HUD
  serialize(), deserialize(o),
});
```

```js
quest = {
  regionId, titre: 'La Légende des Feuilles',
  legende: [ '…', '…' ],           // ce que racontent les anciens du village
  indices: [ '…', '…', '…' ],      // révélés au fur et à mesure
  sanctuaire: { x, y, name: 'Sanctuaire du Bois Dormant' },
  condition: 'badge',              // le badge de la région ouvre le sanctuaire
  legendaires: ['id1', …],         // les 6 légendaires de la région
  final: '…',                      // texte quand la quête est accomplie
}
```

Règles :

- **Six quêtes, une par région**, dans l'ordre de progression du §3 de v2.
- Le fil est toujours le même, pour rester lisible à 10 ans :
  **on entend la légende** (un PNJ de la ville) → **on gagne le badge de l'arène** →
  **le sanctuaire s'ouvre** (repère visible de loin) → **les légendaires de la région se
  réveillent** et deviennent capturables → **on les capture** → texte de fin.
- `isLegendAwake()` renvoie `false` tant que le sanctuaire n'est pas ouvert : c'est ce qui
  empêche un légendaire de traîner sur la carte au premier quart d'heure de jeu.
  **Repli obligatoire** : si `quest3d` est absent, `roamers3d`/`game3d` doivent considérer
  que tout est éveillé, comme aujourd'hui. Ne jamais bloquer le jeu.
- Textes en **français, chaleureux, courts** — deux ou trois phrases maximum par écran.
  C'est ce que Robin va lire ; c'est le cœur de la demande n° 3.
- Tout l'état tient dans `serialize()` : `{ regionId: { heard, open, caught: [ids], done } }`.

---

## 6. `shop3d.js` — Centre Pokémon, boutique et monnaie *(nouveau module)*

```js
R3.register('shop', {
  CATALOG,                         // [item] — tout ce qui se vend
  item(id),                        // -> item
  priceOf(id),
  canBuy(itemId, money, qty),      // -> bool
  buy(itemId, qty, wallet),        // -> { ok, spent, message }
  sell(itemId, qty, wallet),       // (moitié du prix)
  stockFor(regionId),              // -> [itemId] — l'offre s'enrichit région par région
  useItem(itemId, mon),            // -> { ok, message } — potions, rappels, pierres
  rewardFor(battleKind, level),    // -> argent gagné après un combat
  healText(),                      // le petit mot de l'infirmière
});
```

```js
item = { id, name, icon, price, kind: 'ball'|'soin'|'pierre'|'objet', power, description }
```

Le catalogue minimum :

| id                | nom              | prix | effet |
|-------------------|------------------|------|-------|
| `pokeball`        | Pokéball         | 200  | capture ×1.0 |
| `superball`       | Super Ball       | 600  | capture ×1.5 |
| `hyperball`       | Hyper Ball       | 1200 | capture ×2.2 |
| `potion`          | Potion           | 300  | +30 PV |
| `superpotion`     | Super Potion     | 700  | +80 PV |
| `hyperpotion`     | Hyper Potion     | 1500 | PV au maximum |
| `rappel`          | Rappel           | 1000 | réveille une créature K.O. à la moitié de ses PV |
| `pierre_feu` …    | Pierres (une par grande famille) | 2500 | fait évoluer (via `evolve3d`) |

La **Ball Maîtresse ne se vend pas** : elle se gagne en accomplissant une quête (§5).

Monnaie : `state.money`, **500 pièces au départ**, gagnées en combat
(`rewardFor` : ~`12 × niveau` pour un dresseur, ~`4 × niveau` pour une créature sauvage,
`500 + 40 × niveau` pour un champion). Jamais de perte d'argent à la défaite — le jeu
n'est pas punitif.

Le **Centre soigne gratuitement** toute l'équipe (`R3.get('team').healAll()`), recharge la
Téracristallisation (§7) et affiche un petit texte d'accueil.

---

## 7. `tera3d.js` — la Téracristallisation *(nouveau module)*

```js
R3.register('tera', {
  isUnlocked(),                    // -> bool — l'Académie a-t-elle formé le joueur ?
  unlock(),                        // appelé par l'Académie
  teraTypeOf(mon),                 // -> typeId — le type Téra de CET individu
  setTeraType(mon, typeId),        // choix à l'Académie
  canUse(battle),                  // -> bool — débloqué, pas encore utilisé ce combat
  activate(mon, battle),           // -> { ok, typeId, message } — MUTE le mon (mon.tera = true)
  deactivate(mon),                 // fin de combat
  bonus(mon, move),                // -> multiplicateur à appliquer aux dégâts
  crown(mon),                      // -> THREE.Group — la couronne de cristal
  burst(scene, position, color),   // l'explosion de cristaux à l'activation
  reset(),                         // rechargement au Centre Pokémon
});
```

Règles du jeu :

- **Une seule activation par combat**, sur une seule créature. Se recharge au Centre Pokémon
  ou après un repos, jamais au milieu d'un combat.
- Le **type Téra par défaut** est le premier type de la créature. À l'Académie, le joueur
  peut le **changer** pour n'importe lequel des 19 types, une fois par créature et par visite.
- Effet : la créature **prend le type Téra** (défense et STAB), les attaques de ce type
  passent à **×1.5**, et elle reçoit **+20 % de défense** jusqu'à la fin du combat.
- Visuel obligatoire : une **couronne de cristal flottante** au-dessus de la tête, aux
  facettes de la couleur du type (`R3.get('types').color(id)`), et un **éclat de cristaux**
  à l'activation. Réutiliser `R3.get('llib').crystalCluster()` si présent, repli sur des
  `R3.mat()` simples sinon. **Moins de 20 draw calls** pour l'ensemble.
- `mon.tera` et `mon.teraType` sont sauvegardés ; `mon.tera` est remis à `false` en fin de
  combat, `mon.teraType` reste.

---

## 8. Bâtiments et lieux — `citybuild3d.js` + `cities3d.js` *(un seul agent, deux fichiers)*

Trois constructions à livrer, **toutes visibles de loin** — c'est le point clé : Robin n'a
pas trouvé les arènes qui existent pourtant déjà.

### 8.1 Le Centre Pokémon — un par région (demande n° 8)

Toit rouge arrondi, grande croix blanche lumineuse au fronton, baies vitrées chaudes, porte
automatique. Posé sur la place centrale de chaque ville. Tuile `HEAL_DOOR` devant la porte
(la tuile existe déjà, §5 de v2). Repère `gates3d` obligatoire, icône `➕`, couleur `#ff6b9d`.

### 8.2 L'Académie-château (demandes n° 10 et 10 bis)

**Un immense château** : un donjon central, **quatre tours** d'angle à toits coniques, des
**ponts** suspendus entre les tours, une cour intérieure, une allée bordée d'**arbres**, un
pont d'entrée au-dessus d'un fossé. Il doit se voir de plusieurs régions de distance et
servir de repère. Une seule dans le monde, dans la région choisie par l'agent (la plus
centrale). Tuile `ACADEMY_DOOR` à ajouter côté `tiles3d` **par le lot Intégration** —
ici, exposer `academyDoorTile()` dans l'API pour dire *où* elle se trouve.

Budget : le château entier tient en **moins de 40 draw calls** — géométries fusionnées,
matériaux partagés via `R3.mat()`, pas un mesh par créneau. Le respecter est plus important
que d'ajouter un détail.

### 8.3 Les arènes, enfin repérables (demande n° 6)

Les six arènes existent (`arenas3d.js`) mais rien ne les signale. Leur donner un bâtiment
**monumental et typé** : la couleur et l'icône du type du champion, un toit-dôme, deux
statues de créatures à l'entrée, un mât avec la bannière du badge, et **un halo lumineux
visible de loin**. Chacune doit être reconnaissable au premier coup d'œil, de l'autre bout
de la région.

```js
// Ajouts à l'API de citybuild (le reste du §14 de v2 est inchangé)
R3.register('citybuild', {
  …,                               // tout l'existant, sans rien casser
  buildCenter(opts),               // -> THREE.Group — Centre Pokémon
  buildAcademy(opts),              // -> THREE.Group — le château
  buildArena(type, opts),          // -> THREE.Group — arène typée
  academyDoorTile(),               // -> { regionId, x, y }
  centerDoorTile(regionId),        // -> { x, y }
});
```

`cities3d.js` place ces bâtiments dans le plan des villes et **déclare leurs portes**.

---

## 9. Les 36 légendaires, en plus ressemblants — `legend3d.p1/p2/p3.js` *(3 agents)*

Demande n° 5. Direction artistique, à respecter strictement :

- **On s'inspire, on ne copie pas.** Les noms du jeu de Robin sont conservés tels quels, les
  ids ne changent pas, la répartition par type et par région ne change pas.
- Ce qui doit progresser, c'est la **silhouette** : un légendaire doit se lire en une seconde
  et évoquer un grand légendaire de la série — dragon céleste au long corps serpentin,
  oiseau de flammes aux ailes déployées, colosse d'acier, félin cristallin, entité du temps
  couronnée d'anneaux… Pensez « Horizons » : formes nettes, couleurs franches, contours
  marqués, **cristaux** et **anneaux flottants**.
- **Chaque légendaire garde** son aura (`llib.aura`, obligatoire), gagne au moins **deux**
  attributs distinctifs parmi : ailes majestueuses, traîne, couronne, anneaux en orbite,
  cristaux, runes, cœur lumineux.
- **Budget par légendaire : 25 draw calls maximum**, aucun matériau créé hors `R3.mat()`.
  Un légendaire de plus ne doit jamais faire tomber la fluidité — c'est non négociable, un
  jeu qui rame n'est plus généreux.
- `legendlib3d.js` appartient au **lot P1** : les lots P2 et P3 peuvent lui demander une
  primitive supplémentaire dans leur rapport, mais **ne l'écrivent pas**.
- Les animations d'idle restent en `R3.clock.t` et sont **calmes** : lévitation lente,
  respiration, rotation des anneaux.

---

## 10. Les réactions des PNJ — `actors3d.js` *(un agent)*

Demande n° 11.

```js
// Ajouts à l'API de actors (le reste du §… de v1 est inchangé)
R3.register('actors', {
  …,
  reactToLegend(worldPos, speciesName),   // déclenche l'étonnement autour de ce point
  clearReactions(),
});
```

Comportement :

- Quand un **légendaire** est visible à moins de **20 tuiles** d'un PNJ — qu'il soit sauvage
  sur la carte (`roamers3d`) ou sorti par le joueur (`buddy3d`, §4) — le PNJ **se tourne vers
  lui**, **recule d'un demi-pas**, et affiche une **bulle** au-dessus de sa tête : `❗`, `😮`,
  `✨`, choisie au hasard mais stable pour ce PNJ.
- Les PNJ les plus proches (moins de 8 tuiles) affichent en plus **une réplique courte** qui
  passe par `R3.get('hud').toast()` : « Regarde ! C'est… c'est un légendaire ! », « Je n'y
  crois pas… », « Toute ma vie j'ai attendu ça ! ». Une seule réplique à la fois, pas de
  spam : **au plus une toutes les 6 secondes**, toutes réactions confondues.
- La réaction retombe **3 secondes** après que le légendaire s'est éloigné. Un PNJ ne réagit
  pas deux fois au même légendaire en moins de 30 secondes.
- Coût : la boucle ne teste que les PNJ **déjà retenus par le culling** existant. Aucune
  allocation dans la boucle de rendu.

---

## 11. Interface — `hud3d.js`, `css3d/hud3d.css` *(lot Intégration, un seul agent)*

Ce lot passe **après** les autres. Il couvre les demandes n° 1, 9, et l'accès à tout ce que
les autres modules ont produit.

### 11.1 Le bug de la boîte (demande n° 1) — priorité absolue

Aujourd'hui, `onBoxSlotActivate()` (`js3d/hud3d.js`) refuse tout tant qu'aucune place
d'équipe n'a été sélectionnée, et affiche « Choisis d'abord une place dans ton équipe ».
Or `team3d.toTeam(boxIndex)` **accepte parfaitement un ajout direct** quand l'équipe compte
moins de 6 créatures. Corriger : dans la boîte, valider une créature l'envoie **directement**
dans l'équipe s'il reste de la place ; l'échange n'est demandé que si l'équipe est pleine.
Ajouter un bouton explicite **« ⬆️ Mettre dans l'équipe »** dans le panneau de détail, actif
dès qu'une créature de la boîte est sélectionnée. Un enfant de 10 ans doit y arriver sans
qu'on lui explique.

### 11.2 Le sélecteur de Ball (demande n° 9)

Les bonus des quatre Balls sont codés depuis le début (`BALL_BONUS`, `js3d/game3d.js`), mais
rien ne permet de choisir. Ajouter :

- Un **sélecteur permanent** près du compteur de Balls : l'icône de la Ball active, son nom,
  la quantité restante.
- Changement par la touche **`X`** (rotation) et par **clic** sur le sélecteur ; les Balls à
  zéro sont sautées.
- Ce choix vaut **partout** : lancer sur la carte (`throwBallInWorld`) comme lancer en combat
  (menu Sac). Une seule source de vérité : `state.activeBall`, exposée par
  `hud.setActiveBall(id)` / `hud.activeBall()`.

### 11.3 Le reste de l'interface

- **Sac / boutique** : écran d'achat au Centre (grille d'objets, prix, argent, quantité),
  et utilisation d'un objet depuis l'écran Équipe.
- **Argent** : affiché en permanence, discrètement, à côté des badges.
- **Journal de quête** (touche `J`) : les 6 quêtes, leur état, l'indice courant
  (`quest.journal()`).
- **Évolution** : plein écran, la créature blanchit, grandit, révèle sa nouvelle forme,
  « Flamdrak a évolué en Flamdrakon ! ». Interruptible avec Échap ? **Non** — c'est le moment
  de gloire, on le laisse jouer (2,5 s maximum).
- **Téracristallisation** : bouton **Téra** dans le menu de combat, désactivé et grisé tant
  que l'Académie n'a pas formé le joueur, avec le type Téra affiché.
- **Compagnon** : touche **`B`** pour sortir/rappeler la créature active
  (attention : `B` lance déjà une Ball — utiliser **`F`** si le conflit est réel, et le dire
  dans le rapport).

Style inchangé : cartes arrondies, ombres douces, palette du jeu, chaleureux et lisible.

---

## 12. Sauvegarde `robinGame3d_v2` *(remplace le §20 de v2)*

```js
{
  version: 2,
  playerName, regionId, tileX, tileY, dir,
  team: [Mon], box: [Mon],
  collection, seen, badges, defeatedTrainers, visitedRegions,
  items: { pokeball, superball, hyperball, ballmaitresse, potion, superpotion, … },
  money: 500,                    // §6
  quest: { … },                  // quest.serialize() — §5
  tera: { unlocked: false },     // §7
  buddy: 'uid' | null,           // §4 — quelle créature est dehors
  activeBall: 'pokeball',        // §11.2
  quality, cameraMode,
}
```

**Migration obligatoire** : une sauvegarde `version: 1` doit se charger sans perte. Les
champs absents prennent leur valeur par défaut. Une partie de Robin ne se perd jamais —
si le chargement échoue, on repart de zéro **en le disant**, jamais en silence.

---

## 13. Assignation des fichiers — qui écrit quoi

Un agent n'écrit **que** dans ses fichiers. Tout le reste est en lecture seule.

| Lot | Agent | Fichiers en écriture | Demandes |
|-----|-------|----------------------|----------|
| **T** | Types | `js3d/types3d.js` | 7 |
| **E1** | Évolutions | `js3d/evolve3d.js` | 4 |
| **E2** | Modèles évolués | `js3d/creatures3d.p5.js` | 4 |
| **Q** | Quêtes | `js3d/quest3d.js` | 3 |
| **S** | Boutique | `js3d/shop3d.js` | 8 |
| **X** | Téracristal | `js3d/tera3d.js` | 10 |
| **C** | Compagnon | `js3d/buddy3d.js` | 2 |
| **B** | Bâtiments | `js3d/citybuild3d.js`, `js3d/cities3d.js` | 6, 8, 10 bis |
| **L1** | Légendaires p1 | `js3d/legend3d.p1.js`, `js3d/legendlib3d.js` | 5 |
| **L2** | Légendaires p2 | `js3d/legend3d.p2.js` | 5 |
| **L3** | Légendaires p3 | `js3d/legend3d.p3.js` | 5 |
| **A** | Réactions PNJ | `js3d/actors3d.js` | 11 |
| **I** | Intégration | `js3d/game3d.js`, `js3d/hud3d.js`, `js3d/battle3d.js`, `css3d/hud3d.css`, `index3d.html`, `js3d/tiles3d.js`, `js3d/CONTRACT3.md` | 1, 9 + branchements |

Le lot **T** passe **avant tous les autres** : les 19 types sont la fondation.
Le lot **I** passe **après tous les autres** : il branche ce qui a été produit.

---

## 14. Ordre de chargement dans `index3d.html` *(mis à jour par le lot I)*

Les nouveaux modules s'insèrent ainsi :

```
…  js3d/types3d.js   js3d/moves3d.js
   js3d/dex3d.js     js3d/evolve3d.js    js3d/team3d.js
   js3d/cities3d.js  js3d/arenas3d.js    js3d/shop3d.js    js3d/quest3d.js
   js3d/regions3d.js
…  js3d/creatures3d.p1..p5.js
…  js3d/legendlib3d.js  js3d/legend3d.p1..p3.js
…  js3d/actors3d.js  js3d/roamers3d.js  js3d/buddy3d.js
…  js3d/tera3d.js    js3d/hud3d.js      js3d/battle3d.js   js3d/game3d.js
```

Règle : un module se charge **après** ceux dont il lit les données au chargement, et
**avant** ceux qui l'interrogent. En cas de doute, plus tôt — grâce au repli du §1.4,
un module absent n'a jamais le droit de casser quoi que ce soit.

---

## 15. Checklist avant de rendre son travail

- [ ] `node --check monfichier.js` passe.
- [ ] Bandeau de commentaires en tête : ce que fait le fichier, et pourquoi.
- [ ] Aucune exception au chargement, **même si tous les autres modules manquent**.
- [ ] `R3.register('nom', api)` en fin de fichier, avec **exactement** la signature du contrat.
- [ ] Aucun `new THREE.MeshStandardMaterial` direct ; tout passe par `R3.mat()`.
- [ ] Aucun `fetch`, aucun `import`, aucun fichier externe, aucune texture sur disque.
- [ ] Aucune modification dans `js/`, ni dans un fichier assigné à un autre lot.
- [ ] Commentaires en français.
- [ ] Budget de draw calls annoncé dans le rapport final, et tenu.
- [ ] Le rapport final dit : ce qui est fait, ce qui manque, ce que le lot **I** doit brancher.

---

## 16. CE QUI A ÉTÉ LIVRÉ — 2026-07-31

Quinze lots (12 modules + 3 d'intégration), tous fusionnés. Ce qui suit **fait foi** :
en cas d'écart avec les sections précédentes, c'est ici que la vérité est écrite.

### Écarts assumés par rapport au contrat initial

| § | ce que disait le contrat | ce qui a été livré | pourquoi |
|---|---|---|---|
| 2 | « 18 types » | **19 types** | 12 conservés + 7 ajoutés = 19. Erreur d'addition dans la prose ; le tableau §2.2 en donnait bien 19. |
| 2.1 | renommer `foudre`/`ombre` | ids **conservés**, alias dans `types3d.js` | `dex3d`, `moves3d` et les 3 fichiers de légendaires les utilisent encore. Renommer aurait touché 5 gros fichiers et cassé les sauvegardes. |
| 6 | 6 pierres d'évolution | **8 pierres**, toutes utiles | `pierre_lune` et `pierre_nuit` ajoutées ; chaque pierre vendue fait évoluer au moins une créature — vérifié par test. |
| 11.3 | compagnon sur `B` | **touche `F`** | `B` lance déjà une Ball. |
| 11.2 | sélecteur de Ball | touche **`X`**, pilotée par le **HUD** | `hud3d.js` consomme la touche et `game3d.js` lit `hud.activeBall()`. Une seule source, pas de double rotation. |
| 12 | clé `robinGame3d_v2` | idem, **migration v1 testée** | une sauvegarde v1 se relit sans aucune perte ; la v1 n'est jamais effacée. |

### Corrections de bugs préexistants trouvées en chemin

1. **`core3d.js` — `idleCreature()` n'appelait jamais `anim.update`.** `LL.animateAura()`
   était du code mort : les auras des 36 légendaires étaient **figées depuis leur création**.
2. **`quest3d.js` — `window.R3` vaut `undefined`.** `core3d.js` déclare `const R3` au niveau
   d'un script classique : un `const` de haut niveau ne crée pas de propriété sur `window`.
   Le module ne s'enregistrait jamais. Les modules lisent l'identifiant global directement.
3. **`hud3d.js` — la boîte refusait le transfert** alors que `team3d.toTeam()` l'acceptait
   (demande n° 1 de Robin). Le même piège existait à l'envers sur « Renvoyer à la Boîte ».
4. **`hud3d.js` — le filtre du Pokédex** comparait `'electrique'` à `'foudre'` : les filtres
   Électrique et Spectre ne renvoyaient jamais rien.
5. **`game3d.js` — `_resumePosition` était calculé mais jamais lu** : Robin était renvoyé au
   point d'apparition **à chaque ouverture du jeu**.
6. **`game3d.js` — double décompte des potions** entre le menu Sac et `shop.useFrom()`.
7. **`battle3d.js` — aura payée deux fois** sur les légendaires : −8 à −16 draw calls.
8. **`hud3d.js` — le journal laissait `state.screen` à `'world'`** : Robin marchait derrière
   l'overlay.

### Budgets mesurés

- **Légendaires : 20 à 24 draw calls** chacun (36/36 construits, aucun dépassement).
  Avant la vague : 40 à 80. La primitive `llib.bake()` fusionne les pièces immobiles en un
  mesh par matériau.
- **Formes évoluées : 20 au maximum**, moyenne 19,0.
- **Académie-château : 20** (305 meshes bruts) · **arène : 10 à 17** · **Centre : 10**.
- **Combat contre un légendaire : 180** (250 autorisés).

### Vérifié dans le navigateur

43 scripts chargés sans erreur · 21 modules enregistrés · boîte → équipe **en un clic** ·
`X` fait tourner la Ball d'un cran · journal ouvert avec `state.screen = 'journal'` ·
compagnon sorti sur `F` et suivant à **1,66 tuile**.

### Finitions du 2026-07-31 (2)

Les trois points laissés ouverts sont traités, plus deux retours de Robin arrivés après coup.

| | ce qui a changé |
|---|---|
| **Vue FPS** | En deux temps. D'abord la rotation, qui se faisait par crans de 90° : elle est devenue **libre et continue** (3 rad/s). Mais le corps sautait toujours de tuile en tuile — « la gestion du déplacement en FPS est chaotique » — alors la **marche est devenue libre** elle aussi (§17). `camera3d` suit `player.fpsYaw` s'il est fourni, sinon les quatre directions comme avant. |
| **Musique** | « la musique ordinateur c'est usant » : nouveau module `js3d/music3d.js` — guitare en Karplus-Strong, basse, batterie, réverbe à convolution, grille pop, 5 ambiances selon le biome. Entièrement procédural. `js/audio.js` n'est pas modifié (§1.2) : music3d coupe son ancienne piste et prend le relais, avec repli sur elle s'il manque. |
| **Navigation clavier** | Boutique, Journal et Académie se pilotent aux flèches — fonction `navEcran()`, éléments marqués `data-nav`, curseur `.nav-cursor`. Une seule fonction pour les trois écrans. |
| **Sac hors combat** | Bouton « 🎒 Utiliser un objet » (touche `U`) dans l'écran Équipe. `GAME3D.useItem()` pilote, `shop.useFrom()` applique ; une pierre enchaîne sur l'écran d'évolution. |
| **Répulsif** | Il ne faisait rien : il visait les rencontres en hautes herbes, supprimées le 2026-07-30 (`ENCOUNTER_CHANCE` vaut 0). Il écarte maintenant les créatures de la carte sous le niveau 12, pendant 200 pas — `roamers.setRepel(niveau)`, filtre au spawn. |

Trois pièges rencontrés, à connaître avant de rejouer sur ces sujets :

1. **Un `AudioContext` naît suspendu**, et un `resume()` appelé hors geste utilisateur échoue
   **en silence** : le module croit jouer, l'horloge reste à zéro et pas un son ne sort.
   `music3d.reveille()` arme donc un filet sur la première interaction réelle.
   `music.level()` mesure le niveau de sortie — sans cette sonde, le bug est invisible.
2. **Le volume se règle à la mesure, jamais à l'oreille** (on ne peut pas écouter depuis un
   script) : 0,22 donnait un RMS de crête de 0,027, c'est-à-dire presque rien. 0,55 place les
   crêtes vers 0,07 — présent mais discret.
3. **Le Répulsif filtre au spawn** : les créatures déjà posées ne s'évaporent pas. Pour le
   vérifier, il faut repartir d'une population neuve (`roamers.setRegion()`), sinon on mesure
   les survivantes de l'ancienne et le filtre paraît inopérant.

⚠️ Pour tester dans un onglet d'arrière-plan, Chrome gèle `requestAnimationFrame` :
utiliser **`GAME3D.tick(16)`** (§23.7) pour avancer le jeu à la main.

---

## 17. LA MARCHE LIBRE DE LA VUE SUBJECTIVE — `game3d.js`

Ce jeu déplace le joueur **de tuile en tuile** : c'est ce qui rend simples les portes, les
biomes, les PNJ et la sauvegarde, et il n'y a aucune raison d'y toucher pour les vues de
dos. Mais **une caméra libre posée sur une marche en grille ne peut pas donner autre chose
que du chaos** : on regarde à 40°, on avance plein nord, et tourner en marchant fait
basculer la direction du pas d'un coup — le trajet part en escalier. C'est le retour de
Robin (« c'est chaotique »), et c'était structurel, pas un réglage à ajuster.

En vue `fps`, et **seulement** dans cette vue, la marche devient continue :

```js
state.player.freeMove          // true en vue fps : la position continue fait autorité
state.player.freeX, freeZ      // position en unités monde (1 tuile = 1 unité)
const FPS_SPEED  = 4.6;        // unités par seconde
const FPS_RADIUS = 0.34;       // demi-gabarit, pour les collisions
```

Quatre règles, dans l'ordre où elles comptent :

1. **On avance dans l'axe du regard** : `dx = sin(yaw)`, `dz = cos(yaw)` — conforme au §1.4
   de v2 (`'down'` = yaw 0 = +z, `'right'` = yaw +π/2 = +x).
2. **Les deux axes sont tentés séparément.** C'est ce qui fait qu'on glisse le long d'un mur
   au lieu de s'y arrêter net. Sans ça, marcher en biais contre une façade bloque
   complètement — c'était l'autre moitié de la sensation de chaos.
3. **Le gabarit se teste aux quatre coins** (`placeLibre`), sinon on entre dans les murs par
   l'angle, ce qui se voit immédiatement en vue subjective.
4. **`tileX/tileY` suit la position continue**, et `onStepFinished()` est appelé au
   changement de tuile. Tout le reste du jeu continue donc de raisonner en tuiles sans
   savoir que la marche a changé.

`syncFpsPosition(fps)` fait la bascule dans les deux sens : en entrant on part de la tuile,
en sortant on se recale sur la tuile la plus proche. La position continue **n'est pas
sauvegardée** (elle ne vaut que le temps d'une session) : `teleport()` et le chargement
remettent simplement `freeMove = false`, et la resynchronisation se fait à l'image suivante.

Vérifié en jeu : sur quatre caps, le cap réel égale le cap visé **au degré près** (le
quatrième était contre un mur, d'où le glissement) ; en tournant tout en avançant, la
trajectoire est un arc régulier — segments de 0,72 à 0,73 unité, plus aucun escalier.

---

## 18. TROIS CORRECTIONS APRÈS LES TESTS DE ROBIN — 2026-07-31 (3)

Trois retours successifs, tous fondés, tous corrigés. Ils ont un point commun qui vaut
d'être retenu : **ce que le joueur décrit est toujours vrai**, même quand les données
sous-jacentes sont justes.

### 18.1 Le sens de rotation était inversé

`TURN_ORDER` (`game3d.js`) est déclaré « sens des aiguilles » et vaut
`up → right → down → left`, soit les angles π → π/2 → 0 → −π/2 : **tourner à droite fait
DÉCROÎTRE le yaw**. La première version faisait l'inverse, donc la flèche droite tournait
à gauche.

### 18.2 Une rotation continue rend les appuis brefs inopérants

À 3 rad/s, un appui de 50 ms ne fait pivoter que de 8° : invisible. D'où « ça fonctionne
une fois sur deux ». Les deux gestes cohabitent désormais :

| geste | effet |
|---|---|
| appui **bref** (< 220 ms) | un quart de tour net, **mené à son terme même après le relâchement** |
| appui **maintenu** | rotation libre et continue (§17) |

Le quart de tour vise `cranSuivant()` — le multiple de 90° le plus proche, plus un cran —
et n'est donc jamais « à moitié » : depuis 80°, un cran à droite mène à 0°, pas à −10°.

### 18.3 La carte affichait ses repères à côté de la réalité

**Le canvas de la carte était créé sans son id `map-canvas`.** Toute sa mise en page tient
pourtant dans la règle CSS `#map-canvas` (position absolue, `inset: 6px`, taille du
conteneur) : sans id, la règle ne s'appliquait jamais, le canvas prenait sa taille brute de
768×448 dans le flux, et `.map-markers` — lui bien en position absolue sur tout le
conteneur — plaçait les repères **à une autre échelle**. Bug présent depuis l'écriture de
l'écran, invisible tant que personne ne cherchait un lieu précis.

La carte affiche par ailleurs, depuis cette session, les repères de `cities.beacons()` :
**Centre Pokémon ➕, arène ⚔️ et Académie 🔮**, chacun avec son nom écrit à côté du
marqueur. Ils n'y figuraient pas, alors que la fonction qui les fournit existait depuis le
lot Bâtiments — personne ne l'appelait. La carte du monde signale en plus d'un 🔮 la seule
région qui abrite l'Académie (Sylve d'Ambre, porte en **129,80**).

### Ce qui reste à vérifier à l'œil

L'extension Chrome s'est déconnectée avant que le rendu de la carte corrigée ait pu être
constaté. Les **données** sont vérifiées pour les 6 régions (chaque repère tombe sur sa
tuile `HEAL_DOOR` / `ARENA_DOOR` / `ACADEMY_DOOR`, toutes marchables, et les bâtiments sont
posés sur le terrain : 19 tuiles de décor `healCenter` à Ambrelune, 48 pour son arène, 119
pour l'Académie). Le placement visuel des marqueurs, lui, reste à confirmer en jeu.
