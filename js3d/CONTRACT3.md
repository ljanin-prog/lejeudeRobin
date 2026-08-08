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
  roleOf(npcId),                   // -> 'ancien' | 'savant' | 'guide' | … | 'villageois'
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

> ⚠️ **L'id d'un PNJ n'est PAS l'id de son modèle.** `regions3d.js` construit ses PNJ
> avec `id: spec.id + '_' + t.id` : le Vieux Sage Mathis s'appelle `val_sage`, jamais
> `sage`. Les champions viennent d'`arenas3d.js` et s'appellent `champion_val`.
> `game3d.js` passe `npc.id` **tel quel** à `dialogFor()`. Toute table indexée par id de
> PNJ (rôles, dialogues, repères) doit donc décaper le préfixe de région d'abord —
> sinon elle ne trouve rien et retombe silencieusement sur son repli. Coût réel de
> l'oubli : les **66 PNJ du jeu** ont joué le rôle « villageois » pendant une vague
> entière, plus aucun conteur ne racontait sa légende, et le Vieux Sage Mathis
> conseillait d'aller voir le Vieux Sage Mathis. Aucune erreur, aucun symptôme visible
> côté code. Le harnais `.claude/verif_pnj.js` monte la garde.

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
`20 × niveau + 200` pour un **légendaire**, `500 + 40 × niveau` pour un champion). Jamais de
perte d'argent à la défaite — le jeu n'est pas punitif.

Le barème `legendary` se demande par le drapeau `state.battle.legendary`, **pas** par un
`kind: 'legendary'` (voir CONTRACT2 §17 : `kind` pilote la mécanique du combat, pas la
récompense). Il est resté du code mort pendant longtemps parce que `game3d.js` passait
`b.kind`, qui vaut `'wild'` pour un légendaire.

**Capturer rapporte aussi** (correction 2.2), et volontairement **moins que combattre** :
~`2 × niveau` pièces et la moitié de l'XP de combat pour la créature active, plus une prime
unique de **100 pièces** la première fois qu'une espèce entre au Pokédex. Les rencontres
surprises étant coupées (`ENCOUNTER_CHANCE = 0`), un enfant qui joue « attrapeur » ne gagnait
sinon strictement rien et arrivait à l'arène avec une équipe trop faible.

**Exception : le LÉGENDAIRE capturé touche la moitié du barème `legendary`** (amendement du
2026-08-01). Les deux barèmes ci-dessus ont été écrits séparément, et mis bout à bout ils
disaient l'inverse de ce que le jeu veut : Sylvaros Nv 50 assommé rapportait ~1200 pièces,
le même Sylvaros capturé 100 — **six fois moins pour l'issue que Robin préfère**, dans une
économie où la Pokéball coûte 200. `catchRewardTexts()` demande donc `shop.rewardFor
('legendary', niveau)` et en verse la moitié (~600) quand `species.legendary` est vrai.
Le K.O. reste un peu mieux payé, parce qu'il est plus long et plus dur ; ce qui compte est
qu'attraper ne soit plus le choix pauvre. Rien n'a été retiré au barème du K.O.

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
- `mon.teraType` est sauvegardé — mais **par `tera3d`**, dans `tera.types[uid]`, pas par
  `team3d.packMon()`, qui n'écrit que `uid, id, nick, level, xp, hp, types, moves, caughtAt`.
  `mon.tera` n'est **PAS** sauvegardé du tout : il est remis à `false` en fin de combat, et il
  vaut `undefined` après tout rechargement. *(Ligne corrigée le 2026-08-01 : elle affirmait
  que les deux champs étaient sauvegardés, ce qui était faux, et le filet de réparation de
  `tera3d.repair()` se fiait justement à `mon.tera` — il ne s'exécutait donc jamais.)*
- Le filet contre la sauvegarde faite EN PLEIN COMBAT passe donc par **`tera.base[uid]`**,
  écrit par `tera.serialize()` depuis le registre `ACTIVE` : c'est la présence d'une entrée
  dans `base`, et non le drapeau, qui déclenche la restitution des vrais types au chargement.
  Ne jamais revenir à un test sur `mon.tera` — la créature resterait mono-type à vie.
  L'ordre de chargement `team.deserialize()` **puis** `tera.deserialize()` est obligatoire :
  `repair()` parcourt `team.team` et `team.box`.
- Rien d'autre à réparer que `types` : le +20 % de défense se dissout tout seul, parce que
  `team3d.unpackMon()` recalcule `def` depuis l'espèce et le niveau.

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

*Amendement du 2026-08-01 (correction 2.8)* : cette clé n'est plus seule. Trois copies de
secours tournantes, un repli automatique au chargement, et un export/import en fichier
l'entourent désormais — **voir le §22**, qui liste toutes les clés du jeu et les règles à
ne pas enfreindre en y touchant. Le format ci-dessus, lui, n'a pas bougé d'un champ.

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
…  js3d/music3d.js   js3d/sfx3d.js
…  js3d/tera3d.js    js3d/hud3d.js      js3d/battle3d.js   js3d/game3d.js
```

(`sfx3d.js` étend le catalogue de bruitages de `js/audio.js` — voir §20. Comme tous les
modules, il est trouvé à la volée par `R3.get('sfx')` : sa seule contrainte d'ordre est
d'être chargé après `core3d.js`.)

Règle : un module se charge **après** ceux dont il lit les données au chargement, et
**avant** ceux qui l'interrogent. En cas de doute, plus tôt — grâce au repli du §1.4,
un module absent n'a jamais le droit de casser quoi que ce soit.

*Amendement du 2026-08-01 (correction 2.8)* : un petit script **en ligne** ouvre désormais
la page, **avant** `three.min.js` et tout le reste — c'est le panneau d'erreur du §22.4, et
il doit rester la toute première balise `<script>` : il ne voit pas les erreurs de ce qui
est chargé avant lui. Par ailleurs, la liste ci-dessus a maintenant un double exécutable :
`MODULES_ATTENDUS` dans `game3d.js` (§22.5). Un module ajouté ici s'ajoute là aussi.

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
const FPS_SPEED  = 3.4;        // unités par seconde en vitesse de croisière
const FPS_ACCEL  = 12.0;       // unités/s² — la croisière est atteinte en ~0,3 s
const FPS_FREIN  = 18.0;       // décélération : arrêt en ~0,2 s
const FPS_RECUL  = 0.62;       // on recule à 62 % de la vitesse de marche
const FPS_RADIUS = 0.34;       // rayon de collision
const FPS_PAS    = 0.85;       // distance entre deux bruits de pas
```

Cinq règles, dans l'ordre où elles comptent :

1. **On avance dans l'axe du regard** : `dx = sin(yaw)`, `dz = cos(yaw)` — conforme au §1.4
   de v2 (`'down'` = yaw 0 = +z, `'right'` = yaw +π/2 = +x).
2. **La vitesse est une rampe, jamais un interrupteur** : `libreVitesse` monte à `FPS_ACCEL`
   et redescend à `FPS_FREIN`. Voir l'amendement 2026-08-08 ci-dessous.
3. **Les deux axes sont tentés séparément** (`libreAvancer`). C'est ce qui fait qu'on glisse
   le long d'un mur au lieu de s'y arrêter net. Sans ça, marcher en biais contre une façade
   bloque complètement — c'était l'autre moitié de la sensation de chaos.
4. **Chaque axe est testé deux fois** : au point visé, puis une longueur de `FPS_RADIUS` plus
   loin. Le gabarit CARRÉ des quatre coins, lui, a été abandonné (amendement ci-dessous).
5. **`tileX/tileY` suit la position continue**, et `onStepFinished()` est appelé au
   changement de tuile. Tout le reste du jeu continue donc de raisonner en tuiles sans
   savoir que la marche a changé.

`syncFpsPosition(fps)` fait la bascule dans les deux sens : en entrant on part de la tuile,
en sortant on se recale sur la tuile la plus proche. La position continue **n'est pas
sauvegardée** (elle ne vaut que le temps d'une session) : `teleport()` et le chargement
remettent simplement `freeMove = false`, et la resynchronisation se fait à l'image suivante.

Vérifié en jeu : sur quatre caps, le cap réel égale le cap visé **au degré près** (le
quatrième était contre un mur, d'où le glissement) ; en tournant tout en avançant, la
trajectoire est un arc régulier — segments de 0,72 à 0,73 unité, plus aucun escalier.

**Amendement 2026-08-01 (correction 2.10) — on VISE aussi dans l'axe du regard.** La marche
suivait l'angle libre depuis le début, mais la visée, elle, restait cardinale :
`aimedRoamer()` passait `p.dir` à `roamers.aimed()`. En regardant à 45°, on ne visait donc
pas ce qu'on regardait — et le réticule non plus. La règle 1 vaut maintenant pour les deux :
`aimedRoamer()` passe `fpsYaw()` dès que `isFpsView()`, et `roamers.aimed()` accepte un
angle autant qu'une cardinale (détail et pièges dans le §16 de v2). Hors vue subjective,
rien ne change : le regard y EST cardinal.

### 17 bis. Amendement 2026-08-08 — le système du jeu de Clélia

Le jeu de Clélia (`~/Desktop/Projects/lejeudeclelia`, `game3d.js` § « déplacement libre »)
a résolu le même problème un mois plus tôt, et **son déplacement est nettement plus
agréable**. Trois différences, reprises ici à l'identique.

**a. La vitesse est une rampe.** C'est le point principal. On partait à 4,6 unités/s dès la
première image et on s'arrêtait net au relâchement : chaque appui donnait une secousse, et
corriger sa trajectoire au millimètre était impossible. Désormais `libreVitesse` est une
grandeur signée qui monte à `FPS_ACCEL` et redescend à `FPS_FREIN` — croisière en 0,29 s,
arrêt en 0,19 s, avec un tiers de tuile de glisse. La vitesse de croisière est **plus
basse** (3,4 au lieu de 4,6) et le déplacement paraît pourtant plus vif : ce n'était pas
une question de rapidité mais de continuité. Le recul plafonne à `FPS_RECUL` de la marche.

**b. La rotation redevient purement continue** — le double geste du §18.2 est supprimé.
L'appui bref qui déclenchait un quart de tour « mené à son terme même après relâchement »
faisait pivoter la vue toute seule, ce qui est pire que le mal qu'il soignait. La cause
réelle de « ça marche une fois sur deux » n'était d'ailleurs pas le geste mais la **caméra**
(point c). `FPS_TURN_SPEED` descend de 3,0 à 2,6 rad/s, le réglage de Clélia.

**c. `camera3d.js` n'amortit plus le lacet en vue subjective** : `F_YAW_SMOOTH` passe de
0,60 (40 % de rattrapage par image, ≈ 80 ms de retard) à **0,10**. Chez Clélia la caméra
prend directement l'angle du joueur ; on garde ici une trace d'amortissement pour absorber
les recalages brutaux du yaw sur une cardinale (chargement, `teleport()`) sans les
transformer en à-coup. C'est ce lissage qui mangeait les appuis brefs de 8°.

**d. La collision passe du carré au cercle.** `placeLibre(x, z)` ne teste plus qu'un point ;
`libreAvancer(dx, dz)` teste chaque axe au point visé **et** un rayon plus loin. Le gabarit
carré interdisait d'entrer dans un mur par le coin, mais accrochait aux angles de tuiles dès
qu'on franchissait une porte de biais.

**e. Deux détails qui manquaient** : le bruit de pas, absent en vue subjective, est
maintenant cadencé par la DISTANCE (`FPS_PAS`) — on entend donc ses pas s'accélérer ; et
`moveProgress` est tenu à jour, ce qui anime le modèle du joueur pendant la bascule de vue.

### 17 ter. Second passage, 2026-08-08 — la CAMÉRA, seule vraie cause

Après essai en jeu, Robin a maintenu son verdict : « la gestion du déplacement en vue FPS
n'est pas fluide du tout ». Le §17 bis avait porté le déplacement de Clélia ; il n'avait
pas porté sa **caméra**. Or c'est la caméra qu'on voit.

**a. `lookAt` faisait tanguer la vue en permanence.** `S.cam.lookAt(_aim)` calcule
l'orientation à partir de la ligne qui va de la position RÉELLE de la caméra au point visé.
Mais `_aim` est calculé sur la position IDÉALE du joueur, tandis que la caméra, elle, est
lissée (`F_SMOOTH`) : les deux ne coïncident jamais. Chaque accélération, chaque freinage,
chaque virage change l'écart — **et fait pivoter le regard tout seul**. Invisible sur une
capture fixe, insupportable en mouvement.

En vue subjective pleine (`mix >= 1 && modeIndex === 2`), l'orientation est désormais
**absolue**, comme chez Clélia :

```js
S.cam.rotation.set(0, S.fpsYaw + Math.PI, 0);   // au lieu de S.cam.lookAt(_aim)
```

Le demi-tour : une caméra Three regarde vers −z, le joueur vers +z. Conséquences directes :
pitch et roulis **rigoureusement nuls par construction**, horizon parfaitement horizontal,
le regard ne bouge QUE quand on tourne la tête. `lookAt` reste utilisé pendant la bascule
de vue, où il interpole proprement entre le repère de dos et celui des yeux — et `outAim`
est pour cela devenu horizontal, pour que la bascule finisse là où l'orientation absolue
commence.

**b. Le balancement de marche donnait le mal de mer.** 4,5 cm en hauteur ET 3,5 cm en
LATÉRAL, à 7,2 rad/s. Clélia : 1,2 cm, verticalement, rien d'autre. On reprend son réglage
et le balancement latéral disparaît.

**c. La borne anti-relief sursautait.** La « seconde passe » (§ suivant) est une
affectation SÈCHE, pas un lissage ; sur un terrain vallonné la hauteur du sol change à
chaque pas, donc les yeux du joueur sautaient image après image. Elle est désactivée en vue
subjective — où elle ne sert à rien : la caméra est à 1,52 au-dessus d'un joueur toujours
posé sur le sol, et la première passe borne déjà le cas de la falaise.

**d. Le lacet n'est plus amorti du tout** en vue subjective (`F_YAW_SMOOTH` ne sert plus que
pendant la bascule). La rotation est déjà progressive côté `game3d` à 2,6 rad/s ; l'amortir
une seconde fois n'ajoutait que du retard — et c'est du retard qu'on ressent comme « pas
fluide ».

### 17 quater. Troisième passage — ON N'ARRIVAIT PAS DANS LA VUE

Robin, après essai : « le mode FPS fait des rotations de 90°, aucune fluidité ». Mesuré en
jeu juste après : en vue `fps`, un appui bref de 90 ms tourne de **15°**, sans le moindre
cran. Le rendu n'était pas en cause — **la vue non plus n'était pas la bonne**.

`toggleView()` faisait le TOUR DES TROIS VUES : `aventure → rpg → fps → aventure`. Un seul
appui sur `V` menait donc en vue **RPG**, celle où l'on marche de case en case et où le
personnage pivote par quarts de tour. Robin décrivait très exactement ce qu'il voyait ;
ce n'était simplement pas la vue qu'il croyait. Deux appuis étaient nécessaires, et rien ne
le disait — le toast annonçait « Vue RPG — vue de dessus », ce qui ne suffit pas quand on
cherche « le mode FPS ».

Le jeu de Clélia n'a que **deux vues** et une bascule franche. Désormais, ici aussi :

| geste | effet |
|---|---|
| `V` | vue de dos ⇄ **vue à la première personne**, toujours, quelle que soit la vue courante |
| `MAJ + V` | la vue RPG, pour qui la cherche |

Le bouton 🧭 du HUD envoie `V` : il suit donc la même règle. Les libellés annoncent
maintenant **où mène** le geste (« V pour passer dans tes yeux ») et non plus seulement où
l'on se trouve.

**La leçon, plus large que ce bug** : trois modes sur une touche, dont deux visuellement
proches, et l'utilisateur croit être dans l'un en étant dans l'autre. Une plainte sur une
fonctionnalité doit d'abord faire vérifier **qu'on l'atteint**.

⚠️ **Ce qu'on ne sait pas mesurer ici** : le framerate réel. Les essais tournent dans un
Chrome sans carte graphique (SwiftShader), donc les images par seconde n'y veulent rien
dire. Si la vue subjective reste heurtée après tout ceci, **c'est la piste suivante** :
touche `P` affiche le compteur (§21).

**Banc d'essai : `.claude/verif_fps.js`.** Il découpe le vrai bloc de `game3d.js` (de
`const YAW_DIRS` à `function updateWorld(`) et l'exécute sur un plateau 40 × 40 : rampe de
vitesse, freinage, recul, cap réel contre cap visé sur 5 angles, glissement le long d'un
mur, blocage par un PNJ, synchronisation de la grille, cadence des pas, et rotation
(sens, absence de rotation fantôme, appui bref, quart de tour, annulation mutuelle, pas
régulier en virage). 22 épreuves, toutes vertes. **À relancer après toute retouche.**
⚠️ Il lit le fichier par repères textuels : renommer `updateWorld` ou `YAW_DIRS` le casse
bruyamment (il le dit et sort en erreur), jamais silencieusement.

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

> ⚠️ **Ce mécanisme a été RETIRÉ le 2026-08-08** (§17 bis b et c). Le diagnostic était
> incomplet : les 8° existaient bien, mais c'est le lissage de la caméra qui les rendait
> invisibles. Une fois la caméra collée au regard, un appui de 64 ms tourne de 9,5° et se
> voit très bien. La section est conservée pour l'histoire — ne pas la réimplémenter.

À 3 rad/s, un appui de 50 ms ne fait pivoter que de 8° : invisible. D'où « ça fonctionne
une fois sur deux ». Les deux gestes cohabitaient alors :

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

**Amendement 2026-08-01 (correction 2.1) — le sanctuaire et les autels.** La liste des
repères de `drawRegionMap()` s'allonge de deux entrées, et c'était la même erreur que
l'Académie : les données existaient (`quest.sanctuary(regionId)` et `region.altars`),
personne ne les affichait, et la quête demande pourtant « cherche leurs autels » sur
384 × 224 tuiles.

- **⛩️ Sanctuaire** — marqueur nommé, **toujours visible**, y compris avant l'ouverture ;
  il porte alors le suffixe « (fermé) » et une opacité réduite. C'est la destination que
  l'indice de quête annonce, la cacher n'apporterait rien.
- **✦ Autels** — un par légendaire, **seulement une fois le sanctuaire ouvert**
  (`sanc.open`, c'est-à-dire le badge gagné). Avant, la légende doit rester un mystère
  qu'on entend raconter ; après, elle devient une liste de six lieux à visiter. Un autel
  dont l'espèce figure déjà dans `state.collection` passe en **✅ vert**.
- **Piège à ne pas « corriger »** : l'autel du légendaire chef est posé sur les
  coordonnées EXACTES du sanctuaire (c'est voulu, cf. l'en-tête de `quest3d.js`). Le code
  saute donc l'autel dont `(x, y)` coïncide avec le sanctuaire, sinon deux marqueurs se
  superposent parfaitement et le nom du sanctuaire devient illisible.
- Le bloc est dans son propre `try/catch`, comme ses voisins : la carte doit continuer de
  s'afficher si `quest3d` manque. L'accès se fait par le nouvel accesseur `QUEST()` de
  `hud3d.js`, au même endroit que `CITIES()`, `AIRSHIP()` et les autres.
- Les deux entrées sont ajoutées à la légende sous la carte : un symbole non expliqué ne
  vaut pas mieux qu'un symbole absent.

### Ce qui reste à vérifier à l'œil

L'extension Chrome s'est déconnectée avant que le rendu de la carte corrigée ait pu être
constaté. Les **données** sont vérifiées pour les 6 régions (chaque repère tombe sur sa
tuile `HEAL_DOOR` / `ARENA_DOOR` / `ACADEMY_DOOR`, toutes marchables, et les bâtiments sont
posés sur le terrain : 19 tuiles de décor `healCenter` à Ambrelune, 48 pour son arène, 119
pour l'Académie). Le placement visuel des marqueurs, lui, reste à confirmer en jeu.

---

## 19. CONFORT D'USAGE — 2026-08-01 (correction 2.7)

### 19.1 La touche `H` et l'écran d'aide

Les commandes n'étaient dites qu'**une seule fois**, dans le message de bienvenue, puis
rappelées en 11 px tout en bas de l'écran. Un enfant qui reprend sa partie trois jours plus
tard n'avait aucun moyen de les revoir. `H` ouvre désormais un overlay qui les liste toutes.

- **`H` était libre** : vérifié dans le `switch` de `game3d.js`, dans `onBattleKey`, dans
  `hud3d.onGlobalKeydown` et dans le gestionnaire de vol d'`airship3d.js`.
- **`HELP_SECTIONS` (hud3d.js) est la LISTE DE RÉFÉRENCE des commandes.** Toute touche
  ajoutée au jeu doit y être ajoutée, ainsi que dans `#controls-hint` (index3d.html) et dans
  le commentaire d'en-tête du §3 de `game3d.js`. Trois endroits, pas quatre.
- Circuit identique à celui de `J` : le HUD capte la touche mais passe la main à
  `window.GAME3D.help()` quand game3d est là — **lui seul** peut poser
  `state.screen = 'help'` et appeler `releaseAllKeys()`. Sans ça, l'écran s'ouvre et Robin
  continue de marcher derrière. `'help'` est ajouté aux deux listes de `closeOverlays()` et
  au garde d'Échap de `onKeyDown`. `state.screen` n'est pas sauvegardé : rien à migrer.
- L'overlay est ajouté à `anyOverlayOpen()`, sinon `B`, `X` et `J` resteraient actifs
  par-dessus.
- Repli sans HUD : `openHelpScreen()` affiche les commandes en boîte de dialogue.

### 19.2 Le Pokédex se pilote au clavier

C'était le seul grand écran à n'accepter que la souris. Les cartes portent maintenant
`data-nav`, et `navReset(ui.dexOverlay)` est appelé à chaque reconstruction de la grille
(ouverture, changement de filtre) — **`navCourant` est une variable globale partagée par
tous les écrans**, sans ce reset le Pokédex héritait du curseur de la Boutique.

Attention à l'ordre dans `openDex()` : `navElements()` écarte tout ce qui est invisible
(`offsetParent === null`), donc le reset doit venir **après** `show()`.

`dexNavKey(ev)` traduit les touches avant de les passer à `navEcran` : le Pokédex est une
grille, pas une liste. `←/→` passent à la carte voisine, `↑/↓` sautent une **ligne**
entière (nombre de colonnes mesuré sur le vif d'après `offsetTop`, la grille étant
responsive). Sans cette traduction, `navEcran` aurait cherché `navCourant._moins/._plus`
— la mécanique de quantité de la Boutique — et les flèches horizontales auraient été
consommées sans rien faire.

### 19.3 Les toasts durent le temps qu'on met à les lire

2700 ms fixes, c'était réglé pour un adulte qui survole. `toastDuree(text)` rend
`1800 + 70 ms par caractère`, borné à [2600, 8000] ms.

**PIÈGE, à ne pas défaire** : la durée est écrite **deux fois**, dans le `setTimeout` de
`toast()` et dans l'animation CSS `toast-vie`. Les keyframes étant en pourcentages, on
pilote `t.style.animationDuration` en JS et le CSS ne porte plus qu'une durée de repli.
Allonger seulement le `setTimeout` laisserait un toast **invisible** (opacité 0) pendant
tout le temps ajouté.

Au passage : le bloc `prefers-reduced-motion` écrasait la durée à `.01 ms`, ce qui, avec un
`animation-fill-mode: both` finissant à `opacity: 0`, rendait les toasts **totalement
invisibles** pour qui a désactivé les animations. `.toast` y est désormais exclu
(`animation: none`), et c'est le `setTimeout` qui le retire.

### 19.4 Planchers de police

Relevés pour un lecteur de 10 ans : `#controls-hint` 11 → 13 px, `.wn-sub` (sous-titre des
régions, où s'écrit l'avertissement de niveau du dirigeable) 10 → 12 px, `.map-legend`
11 → 12 px, `.mk-label` 10,5 → 11,5 px. Tout l'écran d'aide est à 13 px minimum.

---

## 20. LES SONS — `js3d/sfx3d.js` *(nouveau module, 2026-08-01, corrections 1.7 et 2.6)*

### 20.1 Pourquoi un module de plus

Le catalogue de bruitages est l'objet `SFX` de `js/audio.js` et contient **neuf** sons, ni
un de plus : `footstep`, `encounter`, `throwBall`, `hit`, `shake`, `catch`, `escape`,
`menu`, `rare`. La 3D en appelait deux qui n'ont jamais existé — et **en silence total** :
le helper `sfx(nom)` teste `Audio_.sfx[nom]` avant d'appeler, un nom inconnu ne produit
donc ni son, ni erreur, ni avertissement. Un son fantôme ne se voit jamais.

`js/audio.js` étant gelé par le §1 règle 2, le catalogue s'ÉTEND depuis
`js3d/sfx3d.js` : `R3.register('sfx', { init, play, has, names, setMuted, isMuted })`.

```js
R3.get('sfx').play(nom)   // -> true si CE module a pris le son en charge,
                          //    false si le nom ne lui appartient pas
```

Sons ajoutés : **`heal`** (objet utilisé hors combat, `useItemOnMon` de game3d.js) et
**`legendary`** (apparition à l'autel, `roamers3d.js`). Pour en ajouter un : une entrée
dans l'objet `SONS` de sfx3d.js, et rien d'autre — il est aussitôt jouable partout.

### 20.2 Le motif d'appel, identique dans les trois modules

`game3d.js`, `roamers3d.js` et `battle3d.js` ont chacun un helper privé `sfx(nom)` qui
consulte **l'extension d'abord, `js/audio.js` ensuite** :

```js
var s = R3.get('sfx');
if (s && s.play && s.play(nom)) return;                       // son 3D
if (Audio_.sfx && Audio_.sfx[nom]) Audio_.sfx[nom]();         // son 2D
```

`play()` renvoyant `false` pour les neuf sons d'origine, ils passent au travers sans
détour. Avant cette correction, `battle3d.js` et `roamers3d.js` n'avaient **aucun** accès
à l'audio : toute la mise en scène sonore venait de game3d.js, qui ne connaît pas le
détail des animations. C'est ce trou qui rendait les secousses de la Ball muettes.

### 20.3 PIÈGE — le bouton ♪ coupe TROIS sources

`js/audio.js` garde son `AudioContext` et ses gains pour lui (variables privées) : ni
`music3d.js` ni `sfx3d.js` ne peuvent s'y brancher, chacun a donc **son propre contexte**.
`toggleMute()` de game3d.js doit couper les trois, et `startGame()` en réveiller trois :

```js
Audio_.toggleMute();  call('music','setMuted',[muted]);  call('sfx','setMuted',[muted]);
```

En oublier une, c'est un jeu qu'on croit muet et qui continue de faire du bruit.
`Audio_.isMuted()` reste **la vérité unique** de l'état muet (le HUD et le bouton la
lisent) ; les deux autres modules ne font que suivre.

### 20.4 Les secousses de la Pokéball ne sont plus muettes

Le moment le plus tendu du jeu — les trois balancements de la Ball, entre 600 et 1800 ms —
ne faisait aucun bruit, alors que le jeu 2D le sonorise (`js/game.js` l.558). Corrigé des
**deux** côtés, `battle3d.js` (combat) et `roamers3d.js` (monde ouvert), avec exactement la
règle du 2D : un `sfx('shake')` quand l'indice de secousse change **et qu'il est > 0**.

`idx === 0`, c'est l'atterrissage : il est déjà occupé par le son du lancer et par
l'aspiration. On entend donc **deux** « clac » avant le verdict, aux mêmes instants que les
deux gerbes d'étincelles. Ne pas « corriger » cela en passant à `idx >= 0` : le son
tomberait sur l'atterrissage, et les trois blips se colleraient au son du lancer.

### 20.5 Ce qui reste muet, volontairement

- Le repli de `hud3d.js` (~l.1826) qui appelle `shop.useFrom()` directement quand
  `window.GAME3D` manque ne joue aucun son. Ce chemin n'existe que si le contrôleur est
  absent, c'est-à-dire si le jeu est déjà cassé.
- `levelUp` et `catch_`, cités par l'ancienne chaîne de repli de roamers3d, n'ont pas été
  créés : plus personne ne les demande. Une montée de niveau reste sans bruitage propre.

---

## 21. LE COMPTEUR DE PERFORMANCE — touche `P` *(2026-08-01, correction 2.9)*

Le compteur n'affichait que `60 fps · 4.2 ms`, et n'était atteignable qu'en tapant
`index3d.html#fps` dans la barre d'adresse. Autant dire qu'il n'existait pas : « ça rame »
n'avait aucune cause visible, et aucune optimisation future n'était mesurable.

### 21.1 Trois lignes, et une porte d'entrée

`perfText()` (game3d.js, à côté de `measurePerf`) compose :

```
60 fps · 4.2 ms
128 dessins
94 300 triangles
```

- Les deux dernières lignes viennent de **`renderer.info.render.calls` et `.triangles`**,
  l'API standard de `THREE.WebGLRenderer`. Three.js les remet à zéro au début de chaque
  `render()`. **L'ordre joue en notre faveur** : `frame()` appelle `tickGame()`, qui rend,
  PUIS `measurePerf()` — les chiffres décrivent donc l'image qu'on vient de voir. En
  combat c'est `battle.render(renderer)` qui dessine, sur le MÊME renderer : toujours bon.
- **Touche `P`** en monde ouvert : `hud.toggleFps()`. La fonction existait déjà et
  n'était branchée à rien. Un clic sur le badge le referme (comportement d'origine).
- Le texte contient des `\n` : `.fps-counter` est passé en `white-space: pre`. Ne pas
  revenir à `normal`, « 94 300 triangles » se couperait au milieu du nombre.
- Repère utile à Robin : le budget du contrat v1 est de **moins de 200 dessins** avec
  tout le monde visible.

### 21.2 Le cache des couleurs de sol de `world3d.js`

`sampleGroundColor()` faisait `_sampleColor.set(st.ground)` — décoder une chaîne
`'#63b846'` — à chaque sommet. Un chunk fait 65×65 sommets et en échantillonne 1, 2 ou 4
chacun : **~9 500 analyses de chaîne par chunk**, et le monde en construit jusqu'à deux
par image, pour un budget total de 14 ms. Mesuré sous Node sur le vrai `three.min.js` :
**6,3 ms par chunk avant, 0,07 ms après** — soit jusqu'à 12 ms par image rendus au
streaming, la moitié du budget.

- Le cache est un objet `type → THREE.Color` (`_groundColors`), rempli à la demande. Même
  motif que `water3d.js`, qui pré-calcule `_deep` / `_shallow` au chargement.
- **La `THREE.Color` renvoyée est PARTAGÉE : on la LIT, on ne la mute JAMAIS.**
  `out[0] = c.r * v` est sûr ; un `c.multiplyScalar(v)` teindrait toutes les tuiles du
  même type. C'est pour cela que le scratch `_sampleColor` a été supprimé plutôt que
  gardé : il invitait à la faute.
- Clé = le TYPE de tuile, pas la chaîne : sans danger, car personne ne remplace le style
  d'un type déjà connu (`cities3d` et `regions3d` n'ajoutent que des clés absentes,
  `tiles3d` réécrit la table au chargement, avant toute construction de chunk).
- Restent non mis en cache, volontairement, parce qu'ils sont froids : le
  `new THREE.Color('#1b2c62')` de la jupe d'océan (une fois par région) et les
  `new THREE.Color(roofColor)` des prototypes de maison (une fois par prototype).

---

## 22. LES FILETS DE SÉCURITÉ — sauvegarde, erreurs, démarrage *(2026-08-01, correction 2.8)*

La partie de Robin n'existe que dans le `localStorage` d'un navigateur, sans aucune copie
nulle part : un nettoyage d'historique, un profil recréé, un disque changé, et des mois de
jeu disparaissent. Ce chantier ajoute trois filets — des copies, un fichier, et de quoi
comprendre ce qui casse. **C'est le code le plus dangereux du jeu : il est le seul à
écrire par-dessus la sauvegarde.** Rien de ce qui suit n'a le droit d'abîmer une partie.

### 22.1 Toutes les clés de `localStorage`

| Clé | Rôle | Écrite par |
|-----|------|------------|
| `robinGame3d_v2` | **LA partie** (format du §12) | `saveGame()` |
| `robinGame3d_v1` | ancienne 3D, migration | personne (lecture seule) |
| `robinGame_v2` | partie du jeu **2D**, reprise au premier lancement | personne (lecture seule) |
| `robinGame3d_bak1/2/3` | les trois copies de secours tournantes | `rotateBackup()` |
| `robinGame3d_baks` | `{ slot, at }` : où en est la rotation | `rotateBackup()` |

**RÈGLE** : toute clé ajoutée ici doit l'être aussi dans `GAME3D.reset()`. Sans cela,
« repartir de zéro » ressuscite l'ancienne partie au rechargement suivant — le piège
s'est déjà produit une fois avec la clé v1, il se reproduirait avec les copies.

### 22.2 Les copies de secours tournantes

`saveGame()` appelle `rotateBackup(false)` **avant** d'écrire, et ce qui est recopié est la
sauvegarde **déjà en place** — jamais celle qu'on s'apprête à écrire. C'est tout l'intérêt :
revenir à un état qu'on savait bon. Trois emplacements en rotation = trois âges différents,
donc une partie abîmée sauvegardée deux fois de suite laisse encore une copie saine.

Sept règles, chacune payée par un défaut réel :

1. **Au plus une copie toutes les trois minutes** (`BACKUP_MIN_MS`). `saveGame()` est appelé
   dix-sept fois (capture, badge, achat, évolution, changement de région, fermeture d'un
   écran…) : sans le délai, on triplerait les écritures pour trois copies identiques.
2. **On ne recopie jamais un texte qui n'est pas une partie** (`ressembleAUnePartie()`).
   Sinon, le jour où la clé principale s'abîme, `loadGame()` reprend une copie saine,
   appelle `saveGame()` — et la rotation écraserait une bonne copie avec la ruine qu'on
   vient justement de contourner.
3. **On ne recopie jamais une partie APPAUVRIE** — amendement du 2026-08-01, et c'est la
   règle la plus importante des sept. « Lisible » ne suffisait pas : `saveGame()` écrit
   `team: []` dès que `team3d.js` ne se charge pas (une virgule en trop, le scénario même
   de `checkBoot()`, et Robin peut cliquer « Continuer quand même »), et cette sauvegarde-là
   passait `ressembleAUnePartie()` sans broncher. Trois rotations plus tard les trois copies
   étaient vides à leur tour : **le filet se dissolvait dans le cas précis pour lequel il
   avait été écrit**, en une douzaine de minutes de jeu. Trois gardes désormais :
   - `rotateBackup()` ne recopie pas une partie à **zéro créature** (`nbCreatures()` compte
     l'équipe **et** la boîte) ;
   - il ne remplace pas une copie **plus riche** par une plus pauvre : il saute alors à
     l'emplacement suivant, il ne bloque pas la rotation ;
   - `saveGame()` lui-même **refuse d'écraser** une clé principale qui a des créatures par
     un état qui n'en a aucune, et le DIT une fois (`prevenirSauvegardeSuspendue()` :
     console + toast « ta partie est intacte, recharge la page »). Mieux vaut une session
     non enregistrée qu'une partie effacée.
4. **On ne recopie jamais deux fois le même texte.** `closeOverlays()` sauvegarde à chaque
   écran refermé, même quand rien n'a changé : sans ce garde-fou, trois copies identiques
   remplaceraient trois âges différents.
5. **Une copie ne prend jamais la place de la vraie partie.** Si le `localStorage` est plein,
   `ecrireSauvegarde()` sacrifie les copies **une par une, la plus vieille d'abord**, et
   réessaie à chaque fois. Le filet ne doit jamais se retourner contre ce qu'il protège.
6. **Le curseur de rotation n'avance qu'une fois l'index ÉCRIT.** `localStorage.setItem`
   de l'index passe **avant** `_bak.slot = …` / `_bak.at = …`. Sinon un échec d'écriture de
   l'index (plausible : on vient de remplir le stockage avec la copie) laissait un curseur
   avancé en mémoire désignant un emplacement que le `catch` venait d'effacer — pour toute
   la session, et le délai de trois minutes bloquait une copie qui n'avait jamais eu lieu.
7. **`rotateBackup()` renvoie l'emplacement écrit** (`0..2`, ou `-1`). `installerPartie()`
   s'en sert pour ne jamais sacrifier le point de retour qu'il vient de créer (§22.3).

**Ordre de lecture de `loadGame()`** : `robinGame3d_v2`, puis les copies **de la plus récente
à la plus ancienne**, puis la v1. Les copies ne sont **jamais** lues tant que la clé
principale répond. Quand une copie a servi, on le DIT à Robin (« il te manque peut-être les
toutes dernières minutes ») et on la réinstalle aussitôt comme sauvegarde principale.

`GAME3D.restoreBackup(n)` (console) remonte plus loin : 0 = la plus récente. **Il ne
s'arrête pas sur un emplacement vide** : il essaie les suivants, dans l'ordre, et ne renvoie
`false` qu'après les avoir tous essayés. C'est la fonction de dernier recours du jeu, celle
qu'un parent lancera un soir de panique — elle ne doit pas répondre « copie de secours vide »
quand deux copies saines dorment juste à côté.

### 22.3 Enregistrer et reprendre une partie en FICHIER

`GAME3D.exportSave()` / `GAME3D.importSave()`, et surtout **deux boutons dans l'écran d'aide
(touche `H`)** : depuis la console, ces fonctions n'existent pas pour un enfant de 10 ans.
Un `Blob` et un `<a download>`, un `<input type="file">` et un `FileReader` — rien d'autre,
ça marche en `file://`. Nom du fichier : `robin-partie-AAAA-MM-JJ.json`.

- L'import **refuse** tout ce qui n'est pas une partie (`ressembleAUnePartie()`), et met la
  partie en cours à l'abri (`rotateBackup(true)`) **avant** d'écrire : une fausse manœuvre
  reste rattrapable par `restoreBackup(0)`.
- L'import **sait faire de la place** (`ecrireImport()`, amendement du 2026-08-01). C'était
  le seul chemin d'écriture qui ne le savait pas — un `setItem` nu — alors que ressortir son
  fichier est justement ce qu'on fait quand le stockage a mal tourné : Robin s'entendait
  répondre « pas de place » quand effacer les copies aurait suffi. `ecrireImport()` libère
  les copies **de la plus vieille à la plus récente**, en **sautant** l'emplacement que
  `rotateBackup(true)` vient d'écrire : le point de retour survit à l'import. Et le message
  d'échec ne prétend plus que « rien n'a été changé » — il dit que la partie précédente est
  intacte, ce qui est vrai, la clé principale n'ayant pas bougé.
- **PIÈGE, et il est vicieux** : `installerPartie()` commence par `closeOverlays()`. Deux
  raisons, les deux indispensables. (a) `#message-box` est déclarée dans `index3d.html`
  AVANT que le HUD n'ajoute ses overlays : une boîte de dialogue s'affiche donc **sous**
  l'écran d'aide, et sur l'écran `'help'` ni Espace ni Entrée ne la font avancer — le
  « Le jeu redémarre… » serait resté invisible ET muet, avec un rechargement qui n'arrive
  jamais. (b) `closeOverlays()` appelle `saveGame()` : il doit donc avoir lieu **avant**
  qu'on écrase la clé principale, sinon il réécrirait la partie en cours par-dessus celle
  qu'on vient d'importer. **Ne déplacez pas cet appel.**

### 22.4 Le panneau d'erreur — `index3d.html`, tout en haut

Une virgule oubliée tuait un fichier ENTIER en silence : plus de boutique, plus de combats,
et rien à l'écran pour le dire. Un petit script sans dépendance, écrit en `var`/ES5 pour
survivre à tout, écoute `window.addEventListener('error', …, true)` et affiche un panneau
lisible qui nomme le fichier et la ligne — et qui dit toujours la seule chose qui compte :
**« Ta partie est en sécurité : rien n'a été effacé. »**

- **Il doit rester la TOUTE PREMIÈRE balise `<script>` de la page** : il ne voit pas les
  erreurs des scripts chargés avant lui.
- `true` en 3ᵉ argument = phase de **capture** : c'est la seule façon d'attraper aussi un
  `<script src>` introuvable, qui ne remonte pas d'erreur autrement.
- Un seul panneau par session (une erreur en entraîne dix), et un bouton « Continuer quand
  même » : on informe, on ne bloque jamais.
- Il publie `window.ROBIN_OOPS(titre, lignes, detail)`, dont `checkBoot()` se sert.

### 22.5 `checkBoot()` et la liste des modules attendus

Les 45 balises `<script src>` d'`index3d.html` n'étaient gardées que par des commentaires.
`checkBoot()`, appelé en tête d'`init()`, vérifie que tout le monde a répondu : `THREE`,
`R3`, les 30 modules de `MODULES_ATTENDUS`, un modèle témoin par lot de créatures
(`MODELES_ATTENDUS`), et les six fichiers du jeu 2D (`FICHIERS_2D`).

- **`MODULES_ATTENDUS` EST UN CONTRAT : tout nouveau module s'y ajoute**, une ligne
  `[nom enregistré, fichier]`. C'est le seul endroit du jeu qui sache ce qui est censé
  être chargé. Idem pour un nouveau lot de modèles dans `MODELES_ATTENDUS`.
- Les fichiers 2D déclarent des `const` de haut niveau : elles ne sont **pas** sur `window`,
  d'où les petites fonctions `typeof PALETTE !== 'undefined'` écrites en clair.
- `checkBoot()` **ne bloque jamais** : il nomme ce qui manque et laisse le jeu démarrer.
  La plupart des modules sont facultatifs (§1.4), et un enfant privé de son jeu parce
  qu'un fichier manque serait exactement la punition que ce jeu s'interdit.

---

## 23. LES 36 LÉGENDAIRES PORTENT DE VRAIS NOMS — 2026-08-08

Demande du parent : *« est-ce que tu peux reprendre le nom des Pokémon légendaires du jeu
de Clélia dans celui de Robin ? »* Le jeu de Clélia utilise les vraies espèces (52, dont
six légendaires) ; celui de Robin avait 36 gardiens inventés. Six noms pour trente-six
places : la liste a donc été **complétée avec trente autres légendaires réels**, et les six
de Clélia — Mewtwo, Rayquaza, Lugia, Ho-Oh, Arceus, Terapagos — y figurent tous.

### 23.1 La règle d'appariement : L'APPARENCE AVANT LE TYPE

Les 36 modèles 3D de `legend3d.pN.js` étaient déjà dessinés, et c'est **le modèle que Robin
voit**. Chaque nom a donc été choisi sur ce que la créature EST à l'écran, pas sur son type
maison : le cerf devient **Xerneas**, la panthère noire **Mewtwo**, le long ruban de vent
**Rayquaza**, la tortue à carapace-plateau **Terapagos**, l'être au cercle d'or **Arceus**.
Les types `lumiere`, `ombre`, `temps` et `espace` n'existent pas chez Nintendo : chercher
la concordance de type aurait été impossible, et l'écart ne se voit pas — l'écart
d'apparence, lui, se verrait immédiatement.

Les quatre **Regi** sont volontairement dispersés (Regirock en `terre`, Regice en `glace`,
Registeel en `roche`, Regigigas en `plante`) : ils restent une famille reconnaissable dans
le Pokédex sans qu'aucune région n'en concentre trois.

### 23.2 Ce qui n'a PAS bougé : les ids

`pyrathos` s'appelle Groudon, mais son id reste `pyrathos`. C'est ce qui protège tout le
reste — la sauvegarde de Robin, `state.collection`, les 36 `registerCreature()` de
`legend3d.pN.js`, les autels de `regions3d.js`, les quêtes de `quest3d.js`, les capacités
signature de `moves3d.js`. **Ne jamais renommer un id pour le faire coïncider avec le nom
affiché** : le jour où on le fera, toutes les créatures capturées disparaîtront.

Les textes qui citaient un nom en dur ont été mis à jour : 7 dialogues de PNJ
(`regions3d.js`), 4 répliques de champions (`arenas3d.js`), 11 descriptions de capacités
signature (`moves3d.js`), 2 indices de quête (`quest3d.js`). Partout ailleurs, les noms ne
vivaient que dans des commentaires.

### 23.3 Les parties commencées avant — `LEGACY_NAMES`

`team3d.create()` **fige le nom dans `nick`** au moment de la capture. Un légendaire
attrapé avant ce changement s'appellerait donc encore « Pyrathos » dans l'équipe et dans la
boîte, alors que le Pokédex dirait « Groudon » : deux noms pour la même bête, dans la même
partie. `dex3d.LEGACY_NAMES` liste les 36 anciens noms, `dex3d.isLegacyName(id, nick)` les
reconnaît, et `team3d.deserialize()` rebaptise à la relecture.

⚠️ **Un surnom donné à la main par Robin (`rename()`) n'est JAMAIS écrasé.** On ne remplace
que les surnoms qui sont exactement l'ancien nom d'espèce. Ajouter un nom à `LEGACY_NAMES`
à chaque futur renommage — la table est cumulative, chaque id porte un tableau.

---

## 24. UN SEUL EXEMPLAIRE DE CHAQUE LÉGENDAIRE — 2026-08-08

Retour de Robin : *« qu'il n'y ait à chaque fois qu'un Pokémon s'il est légendaire, 1 seul
de chaque et pas le même légendaire partout »*. Trois causes, trois correctifs.

### 24.1 L'autel se rallumait après la capture

`roamers3d` reposait l'autel `LEGEND_COOLDOWN_S` (10 min) après une capture, **puis
rallumait le même gardien**. Robin pouvait attraper trois Xerneas — et, comme les cooldowns
ne sont qu'en mémoire, un simple rechargement de la partie suffisait à tout remettre à
zéro.

`quest3d.isLegendAwake(speciesId)` renvoie désormais `false` si l'espèce figure dans
`caught` : **l'autel s'éteint pour de bon**, et `caught` est sauvegardé, donc l'extinction
survit au rechargement. `awakeLegends(regionId)` filtre pareillement.

### 24.2 Un second verrou, indépendant

`roamers3d.dejaAttrape(id)` lit `gameState.collection` et refuse d'animer un autel dont
l'espèce est déjà possédée. Deux chemins pour une même règle, **et il en faut deux** :
`quest3d` ne connaît que les 36 légendaires de ses quêtes, un légendaire ajouté plus tard
n'y figurerait pas, et le repli du §17 de v2 veut que l'absence de `quest3d` ne bloque
jamais le jeu — sans ce second verrou, ce repli rouvrirait le robinet.

### 24.3 « Pas le même partout » : on réveille le PLUS PROCHE

`updateLegendary()` parcourait `region.altars` et s'arrêtait au **premier** autel éligible
dans les 42 tuiles de `LEGEND_ACTIVATE_DIST`. Deux autels dans le même rayon, et c'était
toujours celui écrit en premier dans `regions3d.js` qui se réveillait, quelle que soit la
direction prise par Robin. La boucle retient maintenant le plus proche.

### 24.4 Banc d'essai — `.claude/verif_legendaires.js`

19 épreuves sur les VRAIS modules (`dex3d`, `quest3d`, `team3d`, `arenas3d`, `regions3d`
chargés dans un `vm`) : les 36 noms attendus, la présence des six de Clélia, l'absence de
doublon et d'ancien nom, les 36 modèles 3D et les 36 autels distincts, l'extinction après
capture et sa survie à une sauvegarde, le fait qu'aucun champion n'aligne deux légendaires,
et la réparation des surnoms — y compris le refus d'écraser « Croquette ». **À relancer
après toute retouche des légendaires.**
