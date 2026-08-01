# CONTRAT D'API v2 — « Le monde légendaire » (version 3D du Jeu de Robin)

Ce fichier **fait autorité**. Chaque module est écrit par un agent différent, **en parallèle**.
Respecter ce contrat à la lettre est ce qui permet à l'ensemble de s'assembler sans retouche.

Il **complète** `CONTRACT.md` (v1), qui reste valable pour tout ce qu'il décrit déjà
(`core3d.js`, `water3d.js`, `sky3d.js`, `actors3d.js`, `creatures3d.*`).

---

## 0. Ce qu'on construit

Six régions, chacune **10× la carte actuelle**, avec des villes majestueuses, 36 Pokémon
légendaires répartis sur 12 types élémentaires, une équipe de 6 créatures utilisables au
combat, une arène par région, et des créatures visibles sur la carte que l'on capture en
leur lançant une Pokéball.

Public : **Robin, 10 ans**. Tout doit être lisible, généreux, jamais punitif.

---

## 1. Règles générales — valables pour TOUS les modules

1. **Pas de modules ES, pas d'`import`/`export`.** Fichiers `<script>` classiques, IIFE,
   variables globales. Le jeu doit rester jouable **en double-cliquant `index3d.html`**
   (protocole `file://`) : **aucun `fetch`, aucun chargement de fichier externe, aucune
   texture sur disque.** Tout est procédural ou en `CanvasTexture`.
2. **Ne jamais modifier `js/`** — le jeu 2D d'origine doit continuer à fonctionner à
   l'identique. On lit ses données (`CREATURES`, `PALETTE`, `Audio_`, `hashPos`), on n'y
   touche pas. `js/world.js` et `js/npcs.js` ne servent plus à la 3D pour la carte : c'est
   `regions3d.js` qui la fournit désormais.
3. **N'écrire que dans LE ou LES fichiers qui vous sont assignés.** Un autre agent travaille
   dans le fichier d'à côté au même moment. Si vous avez besoin d'autre chose, codez contre
   ce contrat et prévoyez un repli.
4. **Axes** : tuile `(tx, ty)` → monde `(x = tx, z = ty)`, `y` = hauteur. 1 tuile = 1 unité.
   Le **centre** de la tuile est en `(tx, ty)`, pas en `(tx+0.5, ty+0.5)`.
   `dir 'up'` = `−z`, `'down'` = `+z`, `'left'` = `−x`, `'right'` = `+x`.
5. **Utiliser `R3`** (`core3d.js`) pour tous les matériaux, géométries et primitives.
   Ne **jamais** faire `new THREE.MeshStandardMaterial` directement : passer par `R3.mat()`,
   sinon un matériau par objet = un draw call par objet et les perfs s'écroulent.
6. **Temps** : `R3.clock.t` (secondes, réel). Ne jamais animer sur un compteur de frames.
7. **Dégradation gracieuse** : si un module dont vous dépendez est absent
   (`R3.get('xxx')` renvoie `undefined`), produire un repli et continuer.
   **Aucun module ne doit lever d'exception au chargement.** Envelopper l'initialisation
   coûteuse dans un `try/catch` qui `console.warn` et continue.
8. **S'enregistrer** en fin de fichier : `R3.register('nom', api)`.
9. **Qualité** : lire `R3.quality` (`shadows`, `viewDistance`, `particles`, `waterDetail`)
   et s'y adapter. S'abonner via `R3.onQualityChange(fn)` si utile.
10. Commentaires **en français**, comme le reste du projet. Le code doit rester lisible par
    un adulte qui reprend le projet dans six mois : expliquer le **pourquoi**, pas le quoi.
11. **Aucun test unitaire, aucun outil de build.** La validation se fait dans le navigateur.
    Chaque fichier doit au minimum passer `node --check`.
12. **Budget** : viser **moins de 250 draw calls** avec tout le monde visible, et moins de
    14 ms de travail CPU par frame.

---

## 2. LES 12 TYPES ÉLÉMENTAIRES  *(table figée — ne pas改 modifier)*

| id        | nom affiché | couleur   | icône |
|-----------|-------------|-----------|-------|
| `feu`     | Feu         | `#ff6b3d` | 🔥    |
| `eau`     | Eau         | `#41a6f6` | 💧    |
| `plante`  | Plante      | `#38b764` | 🌿    |
| `foudre`  | Foudre      | `#f1c40f` | ⚡    |
| `glace`   | Glace       | `#a8e6ff` | ❄️    |
| `air`     | Air         | `#bfe3f2` | 💨    |
| `terre`   | Terre       | `#c08c4a` | 🍂    |
| `roche`   | Roche       | `#9aa0a6` | 🪨    |
| `lumiere` | Lumière     | `#ffe066` | ✨    |
| `ombre`   | Ombre       | `#7a5cbf` | 🌑    |
| `temps`   | Temps       | `#d896ff` | ⏳    |
| `espace`  | Espace      | `#4b62d9` | 🌌    |

**Table d'efficacité** (`fort` = ×1.6, `faible` = ×0.6, sinon ×1.0) :

```
feu     fort [plante, glace]      faible [eau, roche]
eau     fort [feu, roche]         faible [plante, foudre]
plante  fort [eau, terre]         faible [feu, glace]
foudre  fort [eau, air]           faible [terre, roche]
glace   fort [plante, air]        faible [feu, roche]
air     fort [plante, terre]      faible [foudre, glace]
terre   fort [foudre, roche]      faible [plante, air]
roche   fort [feu, glace]         faible [eau, terre]
lumiere fort [ombre, roche]       faible [espace, terre]
ombre   fort [temps, air]         faible [lumiere, feu]
temps   fort [espace, foudre]     faible [ombre, roche]
espace  fort [lumiere, terre]     faible [temps, eau]
```

Une créature a **1 ou 2 types**. Contre 2 types, les multiplicateurs se **multiplient**
(2.56 max, 0.36 min). Messages : `> 1.05` → « C'est super efficace ! », `< 0.95` →
« Ce n'est pas très efficace… », sinon rien.

---

## 3. LES 6 RÉGIONS  *(table figée)*

Chaque région fait **384 × 224 tuiles** (86 016 tuiles ≈ 10× la carte d'origine de 120×70).
**Une seule région est chargée à la fois.** On passe de l'une à l'autre par une **porte**
(tuile `PORTAL`) : le joueur marche dessus, un fondu, et il arrive dans la région voisine.

| # | id       | nom                 | thème                                          | ville            | arène   | champion | badge          |
|---|----------|---------------------|------------------------------------------------|------------------|---------|----------|----------------|
| 1 | `val`    | Val d'Émeraude      | forêt, plaine, lac, parc, village — **départ** | Bourg-Émeraude   | plante  | Sylvain  | Feuille 🍃     |
| 2 | `sylve`  | Sylve d'Ambre       | jungle dense, marécage, ruines envahies        | Ambrelune        | foudre  | Orana    | Éclair ⚡      |
| 3 | `saphir` | Côte de Saphir      | plage, mer, falaises, îles, port               | Port-Saphir      | eau     | Marine   | Vague 🌊       |
| 4 | `givre`  | Massif de Givre     | montagnes, neige, glaciers, grottes de glace   | Cimefroide       | glace   | Borée    | Flocon ❄️      |
| 5 | `braise` | Caldeira de Braise  | volcan, désert, lave, terres craquelées        | Fournaise        | feu     | Ignis    | Flamme 🔥      |
| 6 | `aurore` | Plateau d'Aurore    | hauts plateaux, ruines célestes, observatoire  | Aurore-Cité      | lumiere | Astréa   | Étoile ✨      |

**Carte du monde** (disposition logique, pour la carte de l'interface) :

```
      [givre]   [aurore]   [braise]
      [val]     [sylve]    [saphir]
```

**Liaisons** (bidirectionnelles) :

| depuis   | vers     | nom du passage           |
|----------|----------|--------------------------|
| `val`    | `givre`  | Col des Brumes           |
| `val`    | `sylve`  | Pont de la Rivière       |
| `sylve`  | `aurore` | Escalier des Anciens     |
| `sylve`  | `saphir` | Delta d'Ambre            |
| `saphir` | `braise` | Côte de Cendre           |
| `givre`  | `aurore` | Arête de Glace           |
| `aurore` | `braise` | Faille du Couchant       |

Ordre de progression conseillé : `val → sylve → saphir → givre → braise → aurore`
(niveaux recommandés : 5 · 12 · 20 · 28 · 36 · 45).

**Départ de la partie** : région `val`, tuile `(24, 30)`.

---

## 4. LES 36 LÉGENDAIRES  *(table figée — 3 par type)*

Silhouette et couleurs sont des **consignes**, pas des suggestions : c'est ce qui garantit
que 36 créatures modélisées par 3 agents différents forment un ensemble cohérent.

### Lot P1 — `legend3d.p1.js` (feu, eau, plante, foudre)

| id           | nom        | type   | région   | silhouette                            | couleurs                |
|--------------|------------|--------|----------|---------------------------------------|-------------------------|
| `pyrathos`   | Pyrathos   | feu    | braise   | dragon de magma, ailes de braise      | `#c0392b` `#ff6b3d` `#ffd166` |
| `emberyx`    | Emberyx    | feu    | braise   | phénix, longue traîne de flammes      | `#ff8c42` `#ffd166` `#e94b3c` |
| `fournalis`  | Fournalis  | feu    | braise   | lion à crinière de lave               | `#e25822` `#f4a259` `#3b1f1a` |
| `abyssalor`  | Abyssalor  | eau    | saphir   | léviathan-serpent des abysses         | `#123a6b` `#2f7fb8` `#73eff7` |
| `ondinae`    | Ondinaë    | eau    | saphir   | esprit d'écume, voiles d'eau          | `#73eff7` `#a8e6ff` `#f4f4f4` |
| `marea`      | Maréa      | eau    | saphir   | raie des marées, longue queue         | `#2f7fb8` `#41a6f6` `#bce884` |
| `sylvaros`   | Sylvaros   | plante | val      | cerf-forêt millénaire, bois-branches  | `#1e8449` `#8b5a2b` `#a7f070` |
| `florabelle` | Florabelle | plante | val      | fée-fleur, robe de pétales            | `#ff6b9d` `#ffaad8` `#38b764` |
| `racinor`    | Racinor    | plante | val      | colosse de racines tressées           | `#5c3a1e` `#3d6b2f` `#8b5a2b` |
| `fulguron`   | Fulguron   | foudre | sylve    | oiseau-tonnerre, ailes en éclairs     | `#f1c40f` `#fcef8d` `#3b5dc9` |
| `voltaris`   | Voltaris   | foudre | sylve    | félin d'arc électrique, crinière vive | `#f1c40f` `#41a6f6` `#1a1c2c` |
| `orageon`    | Orageon    | foudre | saphir   | nuée orageuse à visage, pluie dessous | `#566c86` `#94b0c2` `#f1c40f` |

### Lot P2 — `legend3d.p2.js` (glace, air, terre, roche)

| id           | nom        | type  | région | silhouette                              | couleurs                |
|--------------|------------|-------|--------|-----------------------------------------|-------------------------|
| `cryonix`    | Cryonix    | glace | givre  | dragon de glace, ailes cristallines     | `#a8e6ff` `#41a6f6` `#f4f4f4` |
| `givrea`     | Givréa     | glace | givre  | biche de givre, bois de cristal         | `#e8f4f8` `#a8e6ff` `#d896ff` |
| `banquisor`  | Banquisor  | glace | givre  | ours des glaciers, dos en banquise      | `#f4f4f4` `#bfe3f2` `#566c86` |
| `bourrasca`  | Bourrasca  | air   | val    | griffon des cimes, plumes en spirale    | `#bfe3f2` `#f4f4f4` `#94b0c2` |
| `zephyrion`  | Zéphyrion  | air   | saphir | serpent de vent, corps en ruban         | `#cfe8f3` `#a7f070` `#f4f4f4` |
| `aelune`     | Aélune     | air   | givre  | raie céleste, voile translucide         | `#e6f1f7` `#d896ff` `#a8e6ff` |
| `geomastre`  | Géomastre  | terre | sylve  | tortue-montagne, carapace-plateau       | `#7a5c3a` `#3d6b2f` `#8a9199` |
| `terracor`   | Terracor   | terre | braise | taupe-titan, griffes de roche           | `#c08c4a` `#5c3a1e` `#e3c68d` |
| `limonis`    | Limonis    | terre | sylve  | golem de glaise, coulures douces        | `#a97b50` `#c8a06a` `#6b4423` |
| `monolithe`  | Monolithe  | roche | aurore | colosse de menhirs flottants            | `#8a9199` `#566c86` `#ffe066` |
| `cristallia` | Cristallia | roche | givre  | cerf de cristal, bois en prismes        | `#d896ff` `#a8e6ff` `#f4f4f4` |
| `obsidion`   | Obsidion   | roche | braise | panthère d'obsidienne, veines de lave   | `#1a1c2c` `#3d4e62` `#ff6b3d` |

### Lot P3 — `legend3d.p3.js` (lumière, ombre, temps, espace)

| id           | nom        | type    | région | silhouette                               | couleurs                |
|--------------|------------|---------|--------|------------------------------------------|-------------------------|
| `aureol`     | Auréol     | lumiere | aurore | griffon solaire, auréole à rayons        | `#ffe066` `#ff8c42` `#fff4d6` |
| `solaria`    | Solaria    | lumiere | braise | phénix de lumière pure, plumes-rayons    | `#fff4d6` `#ffe066` `#ffaad8` |
| `prismee`    | Prismée    | lumiere | val    | papillon-prisme, ailes en arc-en-ciel    | `#f4f4f4` `#d896ff` `#73eff7` |
| `nyxaroth`   | Nyxaroth   | ombre   | sylve  | loup des ténèbres, fumée aux pattes      | `#2a2438` `#7a5cbf` `#ff6b9d` |
| `penombra`   | Pénombra   | ombre   | val    | chat-fantôme translucide, queue vaporeuse| `#4a3d6b` `#a99bd6` `#73eff7` |
| `eclipsion`  | Éclipsion  | ombre   | givre  | corbeau d'éclipse, anneau noir au dos    | `#1a1c2c` `#7a5cbf` `#ffe066` |
| `chronoss`   | Chronoss   | temps   | aurore | tortue-horloge, cadran sur la carapace   | `#d896ff` `#c8a06a` `#ffe066` |
| `eternia`    | Éternia    | temps   | aurore | sphinx du temps, sabliers suspendus      | `#e3c68d` `#d896ff` `#4b62d9` |
| `sablion`    | Sablion    | temps   | sylve  | serpent de sable, corps qui s'écoule     | `#e3c68d` `#c08c4a` `#d896ff` |
| `vortexis`   | Vortexis   | espace  | aurore | raie-galaxie, spirale d'étoiles          | `#4b62d9` `#1a1c2c` `#f4f4f4` |
| `astralis`   | Astralis   | espace  | aurore | baleine stellaire, constellations        | `#29366f` `#4b62d9` `#fcef8d` |
| `nebulon`    | Nébulon    | espace  | saphir | méduse-nébuleuse, voile de gaz coloré    | `#7a5cbf` `#4b62d9` `#ff6b9d` |

**Règles de modélisation des légendaires** (en plus des règles v1 sur les créatures) :

- **Taille : 1,8 à 2,4 unités de haut** (les créatures normales font 1,0). Ils doivent
  **impressionner** dès qu'on les voit sur la carte.
- **≤ 90 meshes** chacun. Il n'y en a jamais plus de 2 à l'écran.
- Chacun porte une **aura** : `CL3.aura(couleur, rayon)` de `legendlib3d.js`. Non optionnel :
  c'est ce qui les distingue instantanément d'une créature ordinaire.
- `userData.anim` comme en v1, plus `userData.legendary = true` et
  `userData.auraColor = '#xxxxxx'`.
- `userData.attack(g, p)` **obligatoire** : une animation d'attaque spectaculaire.
- S'enregistrer via `R3.registerCreature(id, build)` — même registre que les 26 d'origine.

---

## 5. LES TUILES  —  `tiles3d.js`  *(un seul agent)*

Ce module définit **toutes** les tuiles du nouveau monde : les 40 d'origine (reprises à
l'identique) plus la centaine de nouvelles. Il remplace `TILE_TYPES` **et** `R3.TILE_STYLE`.

```js
R3.register('tiles', {
  TILES,                  // { TYPE: def }
  get(type),              // -> def (jamais null : repli sur GRASS)
  style(type),            // -> { ground, h, deco, roof, water }  (compatible R3.tileStyle)
  isWalkable(type), isEncounter(type), biomeOf(type),
  DECOS,                  // [string] : tous les noms de décor utilisés
  BIOMES,                 // { biome: {label, mood} } — étend R3.BIOME_MOOD
});
```

`def = { walkable, encounter, biome, ground, h, deco, roof, water, label }`

- `ground` : couleur du sol (albédo, légèrement plus profond que la couleur 2D).
- `h` : hauteur du sol en unités **avant** lissage par `world3d.js`.
- `deco` : nom du décor posé dessus (`null` si aucun).
- `water` : `'lake'|'sea'|'waves'|'shallow'|'pond'|'lava'|'swamp'|'ice'` ou absent.

**En fin de fichier, ce module DOIT patcher le socle** pour que tout le code existant
continue de fonctionner :

```js
R3.tileStyle = function (type) { return style(type); };
Object.assign(R3.BIOME_MOOD, BIOMES_MOOD);   // ambiances des nouveaux biomes
```

### Tuiles à définir

**Reprises de `js/world.js`** (mêmes noms, mêmes propriétés `walkable`/`encounter`/`biome`,
mêmes styles que `R3.TILE_STYLE` de `core3d.js`) : les 40 existantes.

**Nouvelles — jungle / marécage** (`biome: 'jungle'` ou `'swamp'`) :
`JUNGLE_GRASS`, `JUNGLE_TALL`, `JUNGLE_TREE`, `JUNGLE_CANOPY`, `VINE_TREE`, `FERN`,
`SWAMP_GRASS`, `SWAMP_WATER`, `MUD`, `LILY_PAD`, `MANGROVE`, `RUIN_MOSS`.

**Nouvelles — volcan / désert** (`biome: 'volcano'` ou `'desert'`) :
`LAVA`, `LAVA_CRUST`, `BASALT`, `ASH`, `CRACKED_EARTH`, `EMBER_GRASS`, `OBSIDIAN`,
`GEYSER`, `DESERT_SAND`, `DUNE`, `CACTUS`, `DRY_BONE`.

**Nouvelles — glace** (`biome: 'glacier'`) :
`ICE`, `ICE_CRACK`, `GLACIER`, `DEEP_SNOW`, `FROZEN_LAKE`, `ICE_SPIKE`, `PINE_SNOW`,
`ICE_CAVE`.

**Nouvelles — plateau céleste** (`biome: 'celestial'`) :
`PLATEAU_GRASS`, `PLATEAU_TALL`, `RUIN_STONE`, `RUIN_PILLAR`, `STAR_PATH`, `CLOUD_STONE`,
`OBSERVATORY_FLOOR`, `CRYSTAL_SPIRE`.

**Nouvelles — côte** (`biome: 'coast'`) :
`CLIFF`, `CLIFF_EDGE`, `PALM`, `CORAL_SAND`, `DOCK`, `BOAT`, `LIGHTHOUSE_BASE`, `REEF`.

**Nouvelles — ville majestueuse** (`biome: 'citadel'`) :
`WALL`, `WALL_TOWER`, `GATE_ARCH` *(marchable — c'est la porte de la ville)*,
`CASTLE`, `CASTLE_TOWER`, `CASTLE_GATE` *(marchable)*, `CHURCH`, `CHURCH_TOWER`,
`MANOR`, `TOWNHOUSE_A`, `TOWNHOUSE_B`, `TOWNHOUSE_C`, `MARKET_STALL`,
`PLAZA`, `PLAZA_GRAND` *(marchables)*, `GRAND_FOUNTAIN`, `STATUE`, `LAMP_POST`,
`BANNER_POLE`, `HEDGE`, `ROSE_BED`, `PAVED_ROAD`, `BRIDGE` *(marchable)*,
`ARENA_WALL`, `ARENA_DOOR` *(marchable — déclenche le défi)*,
`HEAL_CENTER`, `HEAL_DOOR` *(marchable)*, `SHOP`, `SHOP_DOOR` *(marchable)*.

**Spéciales** :
`PORTAL` *(marchable — transition entre régions)*, `SIGN` *(non marchable, dialogue)*,
`LEGEND_ALTAR` *(non marchable — socle où apparaît un légendaire)*.

> ⚠️ Toute tuile `deco` que vous déclarez doit exister dans `DECOS`, et `world3d.js` /
> `citybuild3d.js` doivent savoir la construire. Les décors **monumentaux** (`castle`,
> `church`, `wall`, `wallTower`, `gateArch`, `arena`, `grandFountain`, `statue`, `manor`,
> `healCenter`, `shop`, `portal`, `lighthouse`, `observatory`) sont délégués à
> `citybuild3d.js` ; tout le reste est instancié par `world3d.js`.

---

## 6. `types3d.js` — types élémentaires

```js
R3.register('types', {
  TYPES,                          // { id: {id, label, color, icon, fort:[], faible:[]} }
  ORDER,                          // les 12 ids dans l'ordre du tableau §2
  get(id),
  effectiveness(atkType, defTypes),   // defTypes: string|string[] -> number
  message(mult),                  // -> string|null
  color(id), label(id), icon(id),
  badge(id),                      // -> HTMLElement <span class="type-badge type-feu">🔥 Feu</span>
});
```

Aucune dépendance. **Doit être court, exact, et strictement conforme au tableau du §2.**

---

## 7. `moves3d.js` — capacités et calcul de combat

```js
R3.register('moves', {
  MOVES,        // { id: move }
  get(id),      // -> move (jamais null : repli 'charge')
  byType(type), // -> [move]
  compute(attacker, defender, move),  // -> résultat (voir plus bas)
  pickAI(mon, foe, state),            // -> move choisi par l'IA
});
```

`move = { id, name, type, power, acc, heal, pp, fx, desc, priority }`

- `power` : `[min, max]` de dégâts de base, ou `0` pour une capacité de soin.
- `heal` : PV rendus (nombre) ou **fraction** `{ frac: 0.5 }` des PV max. Exclusif avec `power`.
- `acc` : précision, `0.75` à `1.0`.
- `pp` : nombre d'utilisations (20 pour une capacité faible, 5 pour une signature).
- `fx` : effet visuel réclamé à `battle3d.js`, parmi
  `'slash' | 'beam' | 'ball' | 'wave' | 'burst' | 'heal' | 'storm' | 'quake' | 'ice' |
   'star' | 'void' | 'time' | 'leaf' | 'flame' | 'bubble' | 'bolt' | 'wind' | 'rock'`.

`compute()` renvoie :

```js
{ missed: false, dmg: 24, heal: 0, mult: 1.6, crit: false,
  text: "C'est super efficace !" }
```

Formule (volontairement simple et généreuse — c'est un jeu d'enfant) :

```
base   = aléatoire dans move.power
niveau = 1 + (attaquant.level - defenseur.level) * 0.03      borné à [0.7, 1.4]
stats  = attaquant.atk / defenseur.def                        borné à [0.6, 1.7]
stab   = 1.25 si move.type est un des types de l'attaquant
mult   = types.effectiveness(move.type, defenseur.types)
crit   = 8 % de chance -> ×1.5
dmg    = round(base * niveau * stats * stab * mult * crit)    minimum 1
```

### Catalogue à écrire

**Au moins 8 capacités par type** (96 au total), plus un socle neutre. Chaque type doit
comporter :
- 2 attaques faibles (`power` ≈ `[8,14]`, `pp` 20),
- 3 attaques moyennes (`[14,22]`, `pp` 15),
- 2 attaques fortes (`[24,34]`, `pp` 8),
- 1 **signature légendaire** (`[38,50]`, `pp` 5, `acc` 0.85) — réservée aux légendaires,
- **1 capacité de soin par type** (nommée dans le thème du type : « Rosée guérisseuse »
  pour plante, « Cocon de braise » pour feu, « Remonter le temps » pour temps…).

Neutres, disponibles pour tout le monde : `charge`, `vitesse`, `repos` (soin `{frac:0.4}`),
`concentration`, `esquive`.

Reprendre les capacités existantes de `js/creatures.js` (`M.assaut`, `M.jetEau`, …) en leur
donnant un type et un `fx` — **les noms français existants doivent être conservés** pour ne
pas dérouter Robin. Les nouvelles capacités portent des noms **français, imagés, lisibles
par un enfant** (« Griffe de braise », « Vague déferlante », « Fissure du temps »).

### Les soins sont TOUJOURS des fractions — amendement du 2026-08-01 (chantier 2.5)

`heal` accepte toujours les deux formes (le nombre de PV existe encore dans `compute()` pour
les vieilles sauvegardes et les modules tiers), mais **plus aucune capacité du catalogue n'y
recourt, et aucune nouvelle ne le doit.** Un nombre fixe est juste une fois dans la partie et
faux partout ailleurs : les six soins hérités du jeu 2D rendaient 10 à 18 PV, c'est-à-dire
15 % des PV d'une créature de niveau 6 et **2,5 % de ceux d'un Auréol niveau 53**. La case
devenait inutile au moment précis où l'enfant en avait besoin.

Barème en vigueur, du plus faible au plus fort :

| capacité | frac | PP | budget (frac × PP) |
|---|---|---|---|
| `soin1` Repos léger | 0,15 | 20 | 3,00 |
| `calin` Câlin soin | 0,20 | 15 | 3,00 |
| `soin2` · `ronron` · `chant` | 0,22 | 15 | 3,30 |
| `concentration` | 0,25 | 10 | 2,50 |
| `soinMagie` | 0,25 | 15 | 3,75 |
| `repos` | 0,40 | 10 | 4,00 |
| soins **typés** (un par type) | 0,45 | 10 | 4,50 |
| `remonterLeTemps` | 0,50 | 10 | 5,00 |

Deux règles à respecter en ajoutant un soin :

1. **La fraction est calée pour rendre à peu près l'ancien nombre de PV au niveau où la
   capacité s'apprend.** Un Feuillou niveau 6 récupère toujours 9-10 PV avec Repos léger ;
   c'est plus haut que la conversion se voit. Vérifié espèce par espèce : aucun adversaire
   des trois premières régions ne varie de plus de 6 PV.
2. **Le budget `frac × PP` est le vrai bouton d'équilibrage**, parce que `pickAI` se soigne à
   80 % dès que l'adversaire passe sous 30 % de PV : c'est lui qui décide combien de PV
   l'IA peut régénérer dans un combat. Aucun des soins convertis ne dépasse 3,75, donc aucun
   ne dépasse les soins typés (4,50) déjà en jeu — la conversion n'a créé aucun nouveau
   record. La guerre d'usure contre les légendaires (Pyrathos : 7,00) est un problème
   antérieur et distinct, traité par le chantier 3.9 de l'audit ; **ne pas la « corriger »
   en rabaissant ces fractions**, la bonne cible est la probabilité de soin de `pickAI`.

Piège : `move.heal` étant un objet, tout test de la forme `Number(m.heal)` ou
`num(m.heal, 0)` répond **faux** sur une fraction. Voir §11, `isHealMove`.

---

## 8. `dex3d.js` — le Pokédex complet (26 + 36)

```js
R3.register('dex', {
  ALL,                       // [species] — 62 entrées
  BASE,                      // les 26 d'origine, enrichies
  LEGENDS,                   // les 36 légendaires
  get(id),
  isLegendary(id),
  byRegion(regionId),        // -> [species]
  byBiome(biome),            // -> [species] (hors légendaires)
  pickWild(regionId, biome), // -> species (JAMAIS un légendaire)
  legendOf(regionId),        // -> [species] les 6 légendaires de la région
  count,                     // 62
});
```

```js
species = {
  id, name, types: ['eau'] | ['eau','glace'],
  legendary: false,
  regions: ['val', 'sylve'],      // où on la rencontre
  biomes: ['forest', 'lake'],     // sur quels biomes
  description,
  catchRate,                      // 0.85 (commune) … 0.06 (légendaire)
  baseHp, atk, def, speed,        // 30..120 pour les communes, 90..170 pour les légendaires
  moveIds: ['griffe', 'flamme', 'soin1', 'inferno'],   // exactement 4 par défaut
  learnset: [{ level: 12, moveId: 'inferno' }],        // capacités apprises en montant
  color,                          // couleur dominante (pour l'UI)
  minLevel, maxLevel,             // fourchette de rencontre à l'état sauvage
}
```

**Les 26 d'origine** : les lire depuis `CREATURES` (js/creatures.js) et les **enrichir** —
ne pas les recopier, ne pas modifier `js/`. Leur affecter des types cohérents avec leur
dessin (Goutella = eau, Flamdrak = feu/air, Glydrak = glace/air, Tonnedrak = foudre/air,
Feuillou = plante, Nuagette = air/lumiere, Koronette = lumiere, Étincelo = foudre, etc.),
des stats équilibrées et une répartition sur les 6 régions (chaque région doit avoir au
moins 10 espèces communes disponibles).

**Les 36 légendaires** : exactement ceux du §4, avec `legendary: true`, `catchRate` de
0.04 à 0.12, des stats élevées, et pour chacun une **capacité signature** de son type.
Leur `description` doit raconter une petite légende en une ou deux phrases — c'est ce que
Robin lira quand il en croisera un.

---

## 9. `regions3d.js` — les 6 régions et l'API monde

**C'est le module qui remplace `js/world.js` pour la 3D.** Toute la carte passe par lui.

```js
R3.register('regions', {
  REGIONS,                 // [regionDef] — 6 entrées, dans l'ordre du §3
  list(), get(id),
  load(id),                // génère (si besoin) et active la région -> regionDef
  activeId(),              // -> 'val'
  active(),                // -> regionDef courante
  get W(), get H(),        // dimensions de la région ACTIVE (getters !)

  tileAt(x, y),            // -> string (hors carte : type de bordure infranchissable)
  isWalkable(x, y), isEncounter(x, y), biomeAt(x, y),
  labelOf(biome),          // -> 'Forêt magique'
  gateAt(x, y),            // -> { toRegion, toX, toY, label } | null
  poiAt(x, y),             // -> POI | null   (voir §10)
  npcsOf(id),              // -> [npc] PNJ de la région (format js/npcs.js + { region })
  spawnOf(id),             // -> { x, y } point d'arrivée par défaut
  onLoad(fn),              // fn(regionDef) après chaque load
  minimap(id, canvas),     // dessine la région en miniature (pour la carte de l'interface)
});
```

```js
regionDef = {
  id, name, w: 384, h: 224, theme, seed,
  biomes: ['forest','plain','lake','park','village'],
  music: 'forest',                  // piste de js/audio.js à utiliser par défaut
  cityId,                           // clé dans cities3d
  arenaType: 'plante',
  legends: ['sylvaros','florabelle','racinor','bourrasca','prismee','penombra'],
  gates: [{ x, y, toRegion, toX, toY, label }],
  spawn: { x, y },
  recommendedLevel: 5,
}
```

**Génération** : procédurale et **déterministe** (même graine → même monde), à partir de
`R3.hash` / `R3.rng`. Stocker la carte en `Uint16Array` d'indices vers une table de noms de
types — 86 016 chaînes de caractères par région coûteraient trop cher. La génération d'une
région doit rester **sous 150 ms** ; elle est faite à la volée au premier chargement de la
région et **mise en cache** ensuite (garder au plus 2 régions en mémoire).

Chaque région doit offrir :
- des **routes** qui relient la ville, les portes et les points d'intérêt — jamais de
  cul-de-sac ; on doit toujours pouvoir aller de la ville à chaque porte ;
- des zones de hautes herbes / rencontres généreuses le long des routes ;
- du relief cohérent (les montagnes montent, la mer descend) ;
- 6 **autels de légendaire** (`LEGEND_ALTAR`), un par légendaire de la région, dans des
  lieux remarquables et difficiles d'accès ;
- au moins 10 PNJ, dont 4 dresseurs (format de `js/npcs.js` : `{id,name,x,y,dir,colorMap,
  accessory,dialog,isTrainer,party}`), plus le champion d'arène (fourni par `arenas3d.js`).

**Après la génération de base**, appeler `R3.get('cities').stamp(regionId, put)` pour
estamper la ville — `put(x, y, type)` est fourni par vous. Si `cities3d.js` est absent,
poser une petite ville de secours pour que la région reste jouable.

**Vérification obligatoire** : après génération, la tuile de spawn, chaque porte et chaque
entrée d'arène doivent être marchables et **connectées entre elles** (faire un parcours en
largeur ; forcer un chemin si nécessaire). Un enfant coincé, c'est un jeu cassé.

---

## 10. `cities3d.js` — les villes majestueuses

Une ville par région. **Majestueuse** est le mot d'ordre : remparts avec tours et porte
monumentale, château dominant, église à clocher, place principale avec grande fontaine et
statue, ruelles pavées, halles de marché, jardins, et l'arène.

```js
R3.register('cities', {
  CITIES,                     // { regionId: cityDef }
  get(regionId),
  stamp(regionId, put),       // estampe la ville : put(x, y, tileType)
  poiAt(regionId, x, y),      // -> POI | null
  plan(regionId),             // -> cityDef (bounds, portes, arène, centre de soins…)
});
```

```js
cityDef = {
  id, regionId, name: 'Bourg-Émeraude',
  x, y, w, h,                        // emprise dans la carte de la région (min 44 × 34)
  style: 'emeraude',                 // influe sur les couleurs des toits et des bannières
  gates: [{ x, y, dir }],            // portes dans le rempart
  plaza: { x, y, w, h },             // grande place
  castle: { x, y }, church: { x, y }, arena: { x, y },
  heal: { x, y }, shop: { x, y }, fountain: { x, y },
  landmarks: [{ kind, x, y, label }],
}
```

```js
POI = { kind: 'arena'|'heal'|'shop'|'sign'|'portal'|'legend'|'landmark',
        label, x, y, regionId, data }
```

Les 6 villes doivent être **visiblement différentes** : Bourg-Émeraude en bois et pierre
claire au milieu des arbres ; Ambrelune sur pilotis dans la jungle, toits de feuilles ;
Port-Saphir avec port, quais, phare et remparts sur la mer ; Cimefroide en pierre sombre et
toits enneigés ; Fournaise en basalte noir, coulées de lave canalisées ; Aurore-Cité en
marbre blanc et or, la plus grande, avec cathédrale et observatoire.

Chaque ville contient obligatoirement : rempart fermé + 2 à 4 portes, château, église,
grande place avec fontaine, arène, centre de soins, boutique, au moins 25 maisons,
et le portail vers les régions voisines si la ville en est le point de départ.

---

## 11. `team3d.js` — l'équipe de 6

```js
R3.register('team', {
  MAX_TEAM: 6,
  team, box,                    // [Mon]
  create(speciesId, level),     // -> Mon (stats calculées depuis dex3d)
  add(mon),                     // -> 'team' | 'box'
  remove(uid),
  swap(i, j),                   // dans l'équipe
  toTeam(boxIndex), toBox(teamIndex),
  active(),                     // -> premier Mon avec hp > 0, ou null
  setActive(index),
  alive(),                      // -> [Mon] vivants dans l'équipe
  allFainted(),                 // -> bool
  healAll(),                    // centre de soins
  damage(mon, n), heal(mon, n),
  gainXp(mon, amount),          // -> { leveled, level, learned: [moveId] }
  xpFor(defeatedMon),           // -> nombre d'XP gagnés
  catchChance(mon, species, ballBonus),  // -> 0..1
  serialize(), deserialize(o),
});
```

```js
Mon = {
  uid,              // identifiant unique de CET individu
  id,               // id d'espèce (dex3d)
  nick,             // surnom (= nom d'espèce par défaut)
  level, xp, xpNext,
  hp, maxHp, atk, def, speed,
  types,            // copie depuis l'espèce
  moves,            // [{ id, pp, ppMax }] — jusqu'à 4
  caughtAt,         // { regionId, x, y }
}
```

Progression : `maxHp = round(baseHp * (1 + level * 0.06))`, idem pour atk/def/speed avec
`0.05`. `xpNext = 20 + level * level * 4`. Niveau max **60**.

**Réorganiser l'équipe préserve la CRÉATURE active, pas son numéro d'emplacement.**
`remove(uid)`, `toBox(teamIndex)` et `swap(i, j)` recalent `activeIndex` pour qu'`active()`
rende toujours la créature que le joueur a désignée par `setActive()`. Ne jamais se contenter
de borner l'indice : ranger une créature d'indice inférieur décale toutes les suivantes, et
un indice « resté dans les bornes » désigne alors quelqu'un d'autre — c'est silencieux, et le
badge ⚔️ de l'écran Équipe se déplace tout seul. Seule exception, assumée : `toTeam(boxIndex,
teamIndex)` sur une équipe pleine remplace l'occupante de `teamIndex` ; si c'était l'active,
la remplaçante hérite du rôle, puisque le joueur vient de la choisir pour cette place.

`movesForLevel()` (interne, utilisée par `create()`) n'éjecte **jamais l'unique capacité de
soin** d'une créature quand le learnset dépasse 4 emplacements : `dex3d.js` garantit un soin
par espèce, l'oubli premier-entré-premier-sorti le supprimait en premier. Vaut aussi pour les
équipes des dresseurs et des champions.

> **Amendement du 2026-08-01 (chantier 2.5).** Cette protection s'appuie sur `isHealMove(id)`,
> qui testait `num(moveDef(id).heal, 0)`. Or `heal` a **deux formes** (§9) et `num()` répond
> `0` sur un objet : la règle ne voyait donc que les soins en PV absolus et **ratait toutes
> les fractions**, c'est-à-dire tout le catalogue typé. Mesuré : 387 couples (espèce, niveau)
> étaient déjà créés sans le moindre soin, et la conversion des six soins hérités du 2D en
> fractions serait montée à 1132. `isHealMove` teste maintenant les deux formes. **Ne jamais
> revenir à un test numérique unique sur `heal`** — c'est silencieux et invisible en jeu.

**`gainXp` rend en plus `pendingLearn: [{moveId, level}]`** (extension hors contrat) : les
capacités qu'une créature à 4 emplacements n'a PAS pu apprendre. Rien ne les apprend jamais —
il n'existe aucun écran de remplacement, ni même de point d'écriture officiel sur `mon.moves`
(chantier ouvert). Tant que c'est le cas, **les messages ne doivent rien promettre** : ils
disent que la créature garde ses 4 capacités, jamais « ce sera pour plus tard ». Tout
consommateur doit citer TOUTE la liste, pas seulement `pendingLearn[0]` — deux paliers au même
niveau en perdaient une en silence. Attention à la forme : `evolve3d.evolve()` rend le même
renseignement sous le nom `pending`, et en **chaînes** au lieu d'objets.
Enfin, la valeur de retour de `gainXp` **s'utilise partout**, y compris pour l'XP partagée aux
équipiers et le bonus de badge : sans cela une créature monte de plusieurs niveaux en silence.

**Taux de capture** (généreux, c'est un jeu d'enfant) :
```
base = species.catchRate
soin = 1 + (1 - mon.hp / mon.maxHp) * 1.6        // une créature affaiblie se capture mieux
if (ballBonus >= 99) chance = 1                  // Ball Maîtresse : JAMAIS de clamp à 0.97
chance = clamp(base * soin * ballBonus, 0.03, 0.97)
```
`ballBonus` : Pokéball 1.0, Super Ball 1.5, Hyper Ball 2.2, Ball Maîtresse 99.

⚠️ **AMENDEMENT (correction 2.4) — la Ball Maîtresse rend exactement `1`, pas `0.97`.**
La borne haute de 0,97 s'appliquait à TOUTES les Balls, Ball Maîtresse comprise. Or
`shop3d.js` la décrit « Elle ne rate jamais », `quest3d.js` répète « celle qui ne rate
jamais », et on n'en gagne que **deux** dans tout le jeu : un enfant qui garde la sienne
pendant des heures pour son légendaire préféré et la voit rater (3 % du temps) vivrait la
pire trahison possible. Une promesse écrite dans le jeu se tient. Le test porte sur le
**bonus** (`>= 99`) et non sur l'identifiant de la Ball, pour que `team3d.js` reste
indépendant de `shop3d.js` — la signature ne passe qu'un nombre. Le clamp 0,03–0,97 reste
la règle pour toutes les autres Balls. **Ne « réparez » pas ceci en remettant le clamp
unique : ce n'est pas une régression, c'est la correction.**

---

## 12. `arenas3d.js` — les 6 arènes et leurs champions

```js
R3.register('arenas', {
  ARENAS,                    // [arenaDef] — 6, une par région
  get(regionId),
  championNpc(regionId),     // -> npc (format js/npcs.js) à ajouter à la région
  makeBattle(regionId, playerTeam),   // -> battleState prêt pour battle3d
  badgeOf(regionId),         // -> { id, name, icon, color }
  TRAINERS,                  // ⚠️ TABLE MORTE — voir l'encadré du §12 plus bas
  rewardText(regionId),
});
```

```js
arenaDef = {
  regionId, name: "Arène de Bourg-Émeraude", type: 'plante',
  champion: {
    name: 'Sylvain', title: 'Gardien des Feuilles',
    team: [{ id: 'feuillou', level: 8 }, { id: 'glanou', level: 9 }, { id: 'sylvaros', level: 11 }],
    dialogIntro: [], dialogWin: [], dialogLose: [],
    colorMap, accessory,
  },
  badge: { id: 'feuille', name: 'Badge Feuille', icon: '🍃', color: '#38b764' },
  levelCap: 12,      // niveau conseillé
}
```

L'arène **n'a pas d'intérieur séparé** : c'est un bâtiment sur la carte. Le joueur marche
sur la tuile `ARENA_DOOR`, `game3d.js` interroge `arenas3d`, un dialogue s'ouvre, puis le
combat de champion démarre. Gagner donne le badge et beaucoup d'XP.

Les équipes de champions montent en puissance selon l'ordre de progression du §3
(niveaux ~10, ~18, ~26, ~34, ~42, ~50) et comportent **3 à 5 créatures**, dont au moins
un légendaire pour les trois dernières arènes.

### ⚠️ `arenas3d.TRAINERS` N'EST BRANCHÉ SUR RIEN — constat du 2026-08-01

**Les dresseurs que Robin rencontre ne viennent PAS d'ici.** `TRAINERS`, `trainersOf()` et
`findTrainer()` sont exportés et n'ont **aucun consommateur** dans tout le dépôt (`grep` :
zéro occurrence hors de `arenas3d.js`). `regions3d.js` ne récupère d'`arenas3d` que
`championNpc()`. La vraie table des dresseurs est **`NPC_TEMPLATES` dans `regions3d.js`** :
`game3d.talkToNPC()` → `startTrainerBattle(npc)` → `arenas3d.makeTrainerBattle(npc)`, qui
reconstruit l'équipe adverse depuis le `party: ['id']` du PNJ (`npc.team` étant absent).

Conséquence à retenir : **une retouche d'équilibrage faite dans `arenas3d.TRAINERS` ne change
rien en jeu.** C'est arrivé au chantier 2.5, et ce paragraphe a affirmé pendant une journée
que les dresseurs tardifs alignaient des formes évoluées alors qu'ils envoyaient toujours des
formes de base. La table est conservée (elle est riche en dialogues, elle servira peut-être
un jour), mais **elle est décorative** : toute modification d'un dresseur se fait dans
`regions3d.js`, et là seulement.

### À armes égales — amendement du 2026-08-01 (chantier 2.5)

Les arènes **4 à 6** et les dresseurs des **trois dernières régions** (givre, braise, aurore)
alignent des **formes ÉVOLUÉES**, pas des formes de base. Les évolutions d'`evolve3d.js`
tombent entre les niveaux 16 et 36 : à partir de Cimefroide, le joueur n'a plus une seule
forme de base dans son équipe, et un champion qui en opposait encore offrait un examen que
l'enfant avait déjà passé. Astréa envoyait une Koronette 47 contre un Koronetton — ×1,55 en
statistiques, en sa défaveur.

- **Les niveaux et les plafonds ne bougent pas.** `levelCap` reste 12 · 20 · 28 · 36 · 45 · 55.
  C'est l'espèce qui change, jamais la courbe. Mesuré, puissance totale (PV + atq + déf + vit)
  des six équipes de CHAMPIONS : 945 → 1527 → 2058 → **3900** → **5426** → **5691** ; l'ordre
  reste strictement croissant, et chaque dresseur reste plus faible que le champion de sa
  région.
- **Les 12 dresseurs de givre/braise/aurore ont été portés dans `regions3d.js`** (et pas
  seulement dans la table morte ci-dessus) : `pandouki`→`pandoukion`, `glydrak`→`glydrakon`,
  `doudoune`→`doudouneon`, `stellini`→`stellinion`, `flamdrak`→`flamdrakix`,
  `etincelo`→`etinceloix`, `tonnedrak`→`tonnedrakon`, `koronette`→`koronetteon`. `nuagette`
  reste en l'état (`NO_EVOLUTION`). Les quatre dialogues qui NOMMAIENT la créature ont suivi
  (« Mon Glydrakon plane… », « Mon Flamdrakix est la terreur… », « Mon Doudounon… »,
  « Mon Étincelix… »). Ces PNJ n'ont pas de niveau propre : `startTrainerBattle()` leur pose
  `def.recommendedLevel` (28 · 36 · 45), les plafonds sont donc respectés d'office. Mesuré,
  puissance totale des dresseurs par région : 832 → 1083 → 1249 → **2816** → **3744** →
  **3719**, tous très en dessous du champion de leur région.
- **Les trois premières arènes gardent leurs formes de base**, et c'est volontaire : jusqu'au
  niveau 24, c'est aussi ce que le joueur a dans son équipe.
- **PIÈGE DES IDENTIFIANTS, à relire avant toute retouche.** `evolve3d.js` fabrique l'id par
  concaténation **stricte** `base + suffixe` : Koronette → `koronetteon` (le NOM affiché est
  « Koronetton », l'id ne l'est pas), Crabilino → `crabilinoon`, Miaouche → `miaouchear` puis
  `miaoucheix`, Flamdrak → `flamdrakon` puis `flamdrakix`. Un id inexistant **ne lève aucune
  erreur** : `makeMon()` retombe sur `fallbackMon()` et le champion devient une créature
  générique de 48 PV de type plante, sans un mot dans la console. Vérifier chaque id contre
  `CHAIN_DATA` d'evolve3d.js — et surtout pas contre `idsCanoniques()` de
  `creatures3d.p5.js`, qui liste des variantes de modèle 3D qui ne sont pas toutes des ids.
- `nuagette` (Astréa) et `papillon` (dresseurs) restent en forme de base : elles sont dans
  `NO_EVOLUTION`, elles n'ont pas de forme évoluée. Ce n'est pas un oubli.
- Effet de bord assumé : les formes évoluées portent les soins **typés** (`{frac: 0.45}`) là
  où les formes de base avaient `soin1`/`soin2`. L'IA de `pickAI` se soigne donc mieux chez
  les champions 4-6. C'est symétrique — le joueur a exactement les mêmes créatures.

---

## 13. `legendlib3d.js` — primitives partagées des légendaires

Écrit par l'agent du **lot P1**, utilisé par les 3 lots. Ce sont les briques qui donnent
aux 36 légendaires un air de famille.

```js
R3.register('llib', {
  aura(color, radius, opts),      // halo translucide qui pulse (obligatoire sur chaque légendaire)
  orbitRing(color, r, n, opts),   // anneau de fragments en orbite
  crystalCluster(color, n, scale),// grappe de cristaux
  majesticWing(len, color, opts), // grande aile à segments (≠ dragonWing de clib)
  plumeTail(len, color, n),       // longue traîne de plumes / de flammes
  halo(color, r, rays),           // auréole à rayons
  runeStone(color, size),         // pierre gravée flottante
  flowRibbon(len, color, opts),   // ruban ondulant (vent, eau, temps)
  starfield(color, n, r),         // nuée de points lumineux
  glowCore(color, r),             // cœur lumineux pulsant
  bigEyes(spread, y, z, r),       // yeux nobles (≠ R3.eyes, plus fins)
  animateAura(g, t),              // à appeler dans l'idle
});
```

Les 3 lots l'utilisent **si présent** (`const LL = R3.get('llib')`), avec un repli sur
`R3.*` sinon. Les lots peuvent aussi utiliser `R3.get('clib')` (bibliothèque v1).

---

## 14. `citybuild3d.js` — les monuments en 3D

```js
R3.register('citybuild', {
  build(kind, opts),   // -> THREE.Group | null
  isMonument(kind),    // -> bool : construit à l'unité (pas d'InstancedMesh)
  update(t),           // drapeaux, jets d'eau, portails, cloches
});
```

`kind` : `'wall'`, `'wallTower'`, `'gateArch'`, `'castle'`, `'castleTower'`, `'castleGate'`,
`'church'`, `'churchTower'`, `'manor'`, `'townhouse'`, `'marketStall'`, `'grandFountain'`,
`'statue'`, `'lamp'`, `'banner'`, `'hedge'`, `'roseBed'`, `'arena'`, `'healCenter'`,
`'shop'`, `'portal'`, `'lighthouse'`, `'observatory'`, `'dock'`, `'bridge'`, `'signpost'`,
`'legendAltar'`.

`opts = { style, roof, x, y, seed, height, dir }` — `style` vaut l'un des 6 styles de ville
(`'emeraude'`, `'ambrelune'`, `'saphir'`, `'cimefroide'`, `'fournaise'`, `'aurore'`) et doit
faire varier matériaux, couleurs de toit et bannières.

Contraintes :
- Chaque monument tient dans son emprise de tuiles (`opts.w × opts.h` fournis par l'appelant,
  1×1 par défaut) et est **posé sur y = 0**, centré en (0,0,0) dans le plan horizontal.
- Château : donjon + 2 à 4 tours + herse + bannières + créneaux. Il doit se voir **de loin**
  (jusqu'à 16 unités de haut).
- Église : nef, clocher pointu, rosace, contreforts, cloche visible.
- Rempart : mur crénelé de 3 unités de haut, chemin de ronde, tours d'angle plus hautes,
  porte monumentale avec arche et herse.
- Grande fontaine : bassin, vasques étagées, jets d'eau animés (utiliser
  `R3.get('water').material('pond')` si disponible).
- **≤ 120 meshes** pour le château, ≤ 60 pour l'église, ≤ 12 par section de rempart.
- Bien exploiter `R3.mat()` : les matériaux doivent être partagés entre monuments.

---

## 15. `world3d.js` — terrain, décors, **streaming**  *(refonte)*

L'ancien `world3d.js` construisait la carte entière (120×70) au démarrage. Une région fait
maintenant 384×224 : il faut **streamer**.

```js
R3.register('world', {
  build(scene),               // prépare la racine ; ne construit AUCUN chunk
  setRegion(regionId),        // libère tout et repart sur la nouvelle région
  heightAt(x, z),             // hauteur LISSÉE interpolée (cohérente au pixel près)
  update(t, px, pz),          // charge/libère les chunks autour du joueur
  root,
  stats(),                    // -> { chunks, meshes } (debug)
});
```

- **Chunks de 32×32 tuiles** (12 × 7 = 84 chunks par région).
- Charger les chunks dont le centre est à moins de `R3.quality.viewDistance + 24` du joueur,
  libérer (`dispose`) au-delà de +16 de marge (hystérésis, sinon ça clignote aux frontières).
- **Au plus 2 chunks construits par frame** : construire les 9 chunks voisins d'un coup
  ferait un à-coup d'une demi-seconde.
- Le champ de hauteur d'une région est calculé **une fois** au `setRegion` (deux
  `Float32Array` de 86 016 entrées : c'est peu) — jamais par chunk, sinon les bords ne
  raccordent pas.
- Conserver le principe qui marche : un `BufferGeometry` par chunk en vertex colors, la
  tuile subdivisée en 2×2, et **un `InstancedMesh` par catégorie de décor et par chunk**.
- Les décors monumentaux passent par `R3.get('citybuild').build(kind, opts)` et sont ajoutés
  au groupe du chunk tels quels (pas d'instanciation).
- L'eau reste confiée à `R3.get('water').makeSurface(tiles, kind)`, par chunk. Nouveaux
  types à gérer : `'lava'` (émissif, lent), `'swamp'` (trouble, opaque), `'ice'`
  (réfléchissant, immobile).
  *Amendement du 2026-08-01 (chantier 1.10)* : un chunk se libère par
  `disposeChunkGroup(grp)`, jamais par un `R3.disposeTree(grp)` direct. Cette fonction
  rend d'abord chaque mesh `userData.waterKind` à `water.release()` — sans quoi water3d
  retient la géométrie des nappes disparues (~0,5 Mo par chunk d'eau plein). Les deux
  appelants sont `disposeChunk()` et `setRegion()`. Détail : les nappes de repli
  (`fallbackWaterMesh`, types `lava`/`swamp`/`ice`) portent le même marqueur mais ne sont
  pas connues de water3d — `release()` répond `false` et c'est sans conséquence.
- Garder la « jupe » qui plonge hors carte et le grand quad d'océan lointain (voir les
  pièges documentés dans `CONTRACT.md` v1) — sans eux, l'horizon est vert et le ciel disparaît.
- Nouveaux décors à modéliser (instanciés) : `jungletree`, `vinetree`, `fern`, `mangrove`,
  `palm`, `cactus`, `pinesnow`, `icespike`, `crystalspire`, `ruinpillar`, `lavarock`,
  `geyser`, `drybone`, `lilypad`, `dune`, `cliff`, `reef`, `mossruin`.

---

## 16. `roamers3d.js` — les créatures visibles sur la carte  *(nouveauté majeure)*

C'est la demande n°6 de Robin : **voir les créatures se balader et leur lancer une Pokéball.**

```js
R3.register('roamers', {
  build(scene),
  setRegion(regionId),
  update(t, dt, px, pz),
  list(),                          // -> [roamer]
  aimed(px, pz, dir, range),       // -> le roamer visé par le joueur, ou null
                                   // `dir` : cardinale 'up'|'down'|'left'|'right'
                                   // OU un ANGLE en radians (vue subjective)
  nearest(px, pz, maxDist),
  throwBall(roamer, chance, cb),   // animation de lancer ; cb(result) avec
                                   // result ∈ 'caught' | 'escaped' | 'fled'
                                   // cb est appelé EXACTEMENT UNE FOIS, même
                                   // si le lancer est refusé ou interrompu
  remove(roamer, reason),          // reason: 'caught'|'defeated' (10 min) ou
                                   // autre chose (2 min) — cooldown de l'autel
                                   // d'un légendaire
  setLegendCooldown(altarId, reason),  // même vocabulaire, après coup
  starsAt(x, z, n),                // gerbe d'étoiles à une position du monde
  onEncounter(fn),                 // appelé si un roamer touche le joueur
});
```

```js
roamer = { uid, speciesId, legendary, level, x, z, dir, group, state, tileX, tileY }
```

Règles :
- **8 à 14 roamers vivants** autour du joueur (moins en qualité basse), respawnés en
  permanence dans un anneau de 12 à 28 tuiles, sur des tuiles marchables du **bon biome**
  pour l'espèce (`dex3d.byBiome`).
- Déplacement **de tuile en tuile**, comme le joueur (interpolation sur ~320 ms), avec des
  pauses. Ils ne traversent ni l'eau profonde ni les obstacles, et ne rentrent pas dans le
  joueur.
- Modèle 3D via `R3.buildCreature(speciesId)`, animé par `R3.idleCreature`. **Culling** :
  masquer au-delà de `R3.quality.viewDistance`.
- Les **légendaires** n'apparaissent qu'à leur autel (`LEGEND_ALTAR`), un seul à la fois,
  avec une aura visible de loin et un son. Ils ne se déplacent pas ; ils fuient au bout de
  90 secondes si on ne les affronte pas.
- **Les 90 secondes s'annoncent** (correction 2.3) : un toast à l'apparition (« Vite, il ne
  restera pas longtemps… »), un autre 20 s avant la fuite, un dernier au départ (« Reviens le
  voir à son autel dans un moment ! »). Une limite de temps invisible n'est pas une règle du
  jeu, c'est un piège. Le drapeau `_legendary._warned` empêche de répéter l'avertissement
  soixante fois par seconde, et `_legendary._nom` évite d'interroger le Pokédex à chaque image.
- **Le temps d'attente d'un autel dépend de ce qui s'est passé** (correction 2.3) :
  `LEGEND_COOLDOWN_S = 600` (10 min) si l'affaire est **classée** — `reason` vaut `'caught'`
  (capturé) ou `'defeated'` (mis K.O.) — et `LEGEND_RETRY_S = 120` (2 min) dans tous les
  autres cas : défaite du joueur, fuite, ou départ du légendaire. `'defeated'` compte comme
  `'caught'` pour une raison d'économie et non de punition : avec la correction 1.4 un
  légendaire vaincu rapporte ~1200 pièces, et un retour toutes les 2 minutes en ferait une
  machine à sous devant l'autel. Avant, tout retrait posait 10 minutes : comme `game3d.js` retire le
  roamer **au début** du combat, perdre contre le gardien vidait son autel dix minutes
  réelles. On est déjà K.O. : ajouter une attente subie est une double punition, contraire à
  la philosophie du jeu. Le cooldown court est donc le **défaut** de `remove()`, et c'est
  voulu — en monde ouvert, `remove()` est appelé deux fois sur la même référence (fin du
  lancer, puis `game3d.onCaught`) et le second appel réécrit le cooldown. Comme l'issue du
  combat n'est pas connue au moment du retrait, `game3d.js` mémorise `battle.legendAltarId`
  et appelle `setLegendCooldown(altarId, 'caught')` depuis `onCaughtInBattle()` — c'est le
  seul endroit où la capture est certaine. La durée n'est écrite que dans `roamers3d.js` :
  ne la recopiez pas ailleurs.
- **`aimed()` accepte un ANGLE autant qu'une cardinale** (correction 2.10). En vue
  subjective le regard n'est justement pas cardinal : à 45°, la créature qu'on avait pile en
  face pouvait sortir du cône parce que `game3d.js` passait `p.dir`, la cardinale la plus
  proche. `game3d.aimedRoamer()` passe désormais `fpsYaw()` quand `isFpsView()`, et `p.dir`
  partout ailleurs. ⚠️ **Un nombre tombait silencieusement sur `DIR_VEC.down`** — on ne peut
  donc pas se contenter de passer l'angle sans le test explicite
  `typeof dir === 'number' && isFinite(dir)`. Vecteur du regard : `fx = sin(a)`,
  `fz = cos(a)`, conformément à la convention d'axes du §1.4 (`'down'` = yaw 0 = +z,
  `'right'` = yaw +π/2 = +x) — c'est exactement la formule d'`updateFpsMove`, ne la
  réinventez pas. La signature reste rétro-compatible : une cardinale se comporte comme
  avant, une cardinale inconnue retombe toujours sur `down`. Cette visée sert AUSSI au
  réticule (`state.aimed` / `hud.showAimReticle`), qui suit donc le regard lui aussi.
- `throwBall` : Pokéball 3D lancée en parabole depuis le joueur, atterrissage, aspiration de
  la créature, **3 secousses**, puis gerbe d'étoiles (capture) ou éclat + fuite (échec).
  Reprendre les timings du jeu 2D : lancer 0→600 ms, secousses 600→1800 ms, résultat à 1800 ms.
  **Tout se passe dans le monde ouvert, sans écran de combat.**
- ⚠️ **`throwBall` appelle TOUJOURS son `cb`, exactement une fois** — y compris quand il
  refuse le lancer (une Ball déjà en vol) ou l'interrompt (`setRegion` en plein vol). C'est
  une règle de survie, pas un détail : `game3d.js` pose `state.throwing = true` avant l'appel
  et ne le remet à `false` que dans le callback. Un `return` sec, comme celui qui existait
  avant, laissait `state.throwing` à `true` pour TOUTE la session — touches B (lancer) et T
  (dirigeable) mortes jusqu'au rechargement. C'était le pire bug du jeu.
  Mise en œuvre : `abortThrow(reason)` centralise l'abandon, et `A.cb` est mis à `null` dès
  qu'il est parti. Ne « simplifiez » jamais ça en remettant un `return` nu.
- **`'fled'` = lancer ABANDONNÉ, aucune Ball n'a volé.** `game3d.js` rend alors la Ball au
  sac et reste silencieux (pas de son d'échec, pas de bandeau) : annoncer une fuite à un
  enfant qui n'a rien vu, ou lui prendre un objet à cause d'un bug, serait punitif.
  `'escaped'` reste la vraie fuite, celle qu'on a vue à l'écran.
- Ceinture-bretelles côté `game3d.js` : `loadRegionData()` remet `state.throwing = false`.
  C'est le seul point de passage commun aux portails, au dirigeable (`arriveAtPort` appelle
  `loadRegionData` **sans** passer par `applyRegion`) et à la reprise de sauvegarde.
- Espace face à un roamer → `onEncounter` : `game3d.js` démarre un vrai combat.

---

## 17. `battle3d.js` — les combats  *(refonte)*

```js
R3.register('battle', {
  enter(battleState, biome), exit(), onResize(w, h),
  update(dt, battleState), render(renderer),
  notifyMove(side, move),          // side: 'player' | 'foe'
  swapIn(side, mon),               // animation de changement de créature
  playFx(side, move),              // effet visuel selon move.fx
  throwBall(chance, cb),           // capture PENDANT un combat ; cb est appelé
                                   // EXACTEMENT UNE FOIS, même si le lancer
                                   // est refusé ou interrompu (voir plus bas)
});
```

⚠️ **`throwBall` appelle TOUJOURS son `cb`, exactement une fois.** `game3d.js` pose
`b.phase = 'ball'` avant l'appel et n'en sort QUE par le callback ; or aucune touche n'est
lue en phase `'ball'`. Un `return` sec — comme celui qui gardait « un seul lancer à la
fois » — gelait donc la partie jusqu'au rechargement, Ball perdue. Deux cas d'abandon :
le lancer précédent n'a pas encore rendu son verdict → on refuse le nouveau avec
`cb('fled')` ; il n'en est qu'au scintillement de fin (son `cb` est déjà parti) → on
l'écrase et on accepte le nouveau. `exit()` en plein vol prévient aussi avec `'fled'`.
`A.cb` est mis à `null` dès qu'il est parti : c'est ce qui garantit l'appel *unique*.

**`'fled'` en retour de `throwBall` = lancer ABANDONNÉ**, aucune Ball n'a volé :
`game3d.js` rend la Ball au sac et rouvre le menu `'choose'`, sans faire perdre le tour.
Jamais punitif : un enfant ne perd pas un objet à cause d'un bug. À ne pas confondre avec
`state.battle.result === 'fled'`, qui veut dire « le joueur a pris la fuite ».
Le garde de confort est en amont, dans `useBagItem()` : une Ball est refusée si une autre
est déjà en vol, **avant** le décompte du sac.

`battleState` (construit par `game3d.js`, lu par `battle3d.js` **et** `hud3d.js`) :

```js
state.battle = {
  kind: 'wild' | 'trainer' | 'champion',
  regionId, biome,
  player: { mon, team, index },
  foe:    { mon, team, index, trainer },   // trainer === null en combat sauvage
  phase: 'intro' | 'choose' | 'choose_move' | 'choose_mon' | 'bag'
       | 'animating' | 'ball' | 'result',
  menuCursor,        // 0 Attaque · 1 Équipe · 2 Sac · 3 Fuite
  moveCursor, monCursor, bagCursor,
  result: null | 'win' | 'lose' | 'caught' | 'escaped' | 'fled',
  anim: { seq, side, moveId, fx, progress },
  ball: { active, progress, shakeIndex, result },
  canFlee,           // false contre un dresseur ou un champion
  canCatch,          // true seulement en combat sauvage
  legendary,         // true si l'adversaire est un légendaire (extension, voir ci-dessous)
  legendAltarId,     // l'autel d'où il vient, ou null (extension, §16 : cooldown)
}
```

**`kind` NE PREND JAMAIS la valeur `'legendary'`** (correction 1.4). Un combat de légendaire
est un combat `'wild'` : c'est `kind === 'wild'` qui fait s'arrêter le combat après une seule
créature adverse, et `kind !== 'wild'` qui applique le ×1,5 « dresseur » à l'XP. Inventer un
quatrième `kind` ferait chercher un adversaire suivant qui n'existe pas, puis afficher « Ton
adversaire est battu ! » à la place de la fin de combat sauvage. Le drapeau **`legendary`**
(booléen, posé par `startWildBattle` d'après `species.legendary`) porte donc l'information à
côté : il sert à choisir le barème d'argent `shop.payReward('legendary', …)`, qui n'était
jamais atteint — un légendaire de niveau 50 rapportait 200 pièces au lieu de 1200.

Rendu :
- **Scène Three.js séparée**, plateforme circulaire pour chaque camp, décor de fond accordé
  au biome (`R3.biomeMood`), caméra en lent travelling.
- Le Mon du joueur est vu **de dos** au premier plan, l'adversaire en face, légèrement plus haut.
- Un légendaire adverse doit occuper l'écran : plateforme plus grande, caméra reculée, aura.
- **Un effet visuel par `move.fx`** : c'est ce que Robin regarde. Chacun des 18 effets doit
  être reconnaissable au premier coup d'œil (particules, traînées, flashs, ondes de choc).
- Le changement de créature (`swapIn`) : la créature sortante rentre dans sa ball, la
  nouvelle en jaillit avec une gerbe d'étoiles.
- **Les barres de PV, le menu et le sac ne sont PAS dessinés ici** : ils sont en HTML
  (`hud3d.js`).

---

## 18. `hud3d.js` + `css3d/hud3d.css` — l'interface  *(refonte)*

```js
R3.register('hud', {
  init(),
  showMessage(text, opts), hideMessage(),
  setBiomeBanner(label), setRegionBanner(name),   // grand cartouche à l'entrée d'une région
  toast(text, icon),
  setFps(v), showQualityPicker(v),

  // --- Combat ---
  showBattleUI(battle), hideBattleUI(),
  setHP(side, hp, maxHp, name, level, types),
  showMainMenu(battle), setMenuCursor(i),         // Attaque / Équipe / Sac / Fuite
  showMoveMenu(battle), hideMoveMenu(), setMoveCursor(i),
  showMonMenu(battle),  hideMonMenu(),  setMonCursor(i),
  showBagMenu(battle),  hideBagMenu(),  setBagCursor(i),
  setBattleLog(lines),

  // --- Hors combat ---
  openTeam(), closeTeam(), setTeamCursor(i),      // écran ÉQUIPE (touche E)
  openDex(), closeDex(), setDexFilter(type),      // Pokédex (touche C)
  openMap(), closeMap(), setMapMode('region'|'world'),   // carte (touche N)
  setBadges(badges), setItems(items),
  setCollectionCount(n, total),
  showAimReticle(roamer),                         // viseur sur la créature ciblée
  showBallCount(n),
});
```

Écrans à produire :
- **Équipe** (touche E) : les 6 emplacements en grille, portrait, nom, niveau, types, barre
  de PV, capacités avec leurs PP. Réorganiser par clic ou flèches, échanger avec la boîte.
- **Pokédex** (touche C) : les 62 espèces, filtrables par type et par région, avec vignette,
  types, description, lieu de capture. Les non-vues restent en `???`.
- **Carte** (touche N) : deux modes — la région active (via `regions.minimap`) avec le
  joueur, la ville, les portes, les arènes ; et la carte du monde avec les 6 régions et
  leurs liaisons, celles déjà visitées mises en avant.
- **Combat** : menu principal 2×2, sous-menu de capacités 2×2 avec type, PP et puissance,
  sélecteur de créature, sac, barres de PV animées (vert → orange → rouge), effet de
  tremblement à l'impact, badges de type colorés.
- **Bandeau de région** à chaque transition : grand cartouche, nom de la région, 2 secondes.
- **Viseur** : quand une créature de la carte est à portée de Pokéball, un réticule discret
  au-dessus d'elle et un rappel « B pour lancer une Ball ».

Style : cartes arrondies, ombres douces, typographie ronde, palette du jeu
(`#38b764`, `#41a6f6`, `#f1c40f`, `#ff6b9d`, `#1a1c2c`). Chaleureux, lisible, jamais « pro ».
Conserver les ids HTML existants : `#title-overlay`, `#name-input`, `#start-btn`,
`#message-box`, `#message-text`, `#starter-overlay`, `#starter-grid`,
`#collection-overlay`, `#collection-grid`, `#close-collection`, `#mute-btn`.

Les vignettes de créatures réutilisent `species.draw(ctx, x, y, 2)` quand elle existe (les
26 d'origine) ; pour les 36 légendaires, qui n'ont pas de dessin 2D, produire une vignette
**rendue en 3D hors écran** (un petit `WebGLRenderer` partagé de 96×96, une image par
espèce, mise en cache) — ou, à défaut, une pastille colorée avec l'icône de type.

---

## 17 bis. `airship3d.js` — le dirigeable  *(nouveau module)*

Traverser six régions à pied prend du temps. Robin veut pouvoir **voyager en dirigeable** :
chaque région possède **un port aérien**, et on saute de l'un à l'autre.

```js
R3.register('airship', {
  build(scene),                       // construit le dirigeable et le tient prêt
  PORTS,                              // { regionId: { x, y, name } } — rempli par regions3d
  registerPort(regionId, x, y, name), // appelé par regions3d au chargement d'une région
  portOf(regionId),
  dockAt(regionId, x, y),             // amarre le dirigeable au mât de ce port
  fly(fromRegion, toRegion, onArrive),// séquence cinématique complète, puis onArrive()
  isFlying(),
  update(t, dt),
  model(),                            // -> THREE.Group (pour l'écran titre / l'interface)
});
```

**Les ports** — un par région, nommés :

| région   | port aérien          | où il se trouve                                   |
|----------|----------------------|---------------------------------------------------|
| `val`    | Escale d'Émeraude    | terrasse accolée au rempart de Bourg-Émeraude     |
| `sylve`  | Ponton d'Ambrelune   | plateforme dans la canopée, au-dessus d'Ambrelune |
| `saphir` | Amarre du Phare      | môle du port de Port-Saphir, près du phare        |
| `givre`  | Mât de Cimefroide    | promontoire rocheux au-dessus de la ville         |
| `braise` | Pont de Fournaise    | passerelle de basalte sur la caldeira             |
| `aurore` | Quai des Nuées       | terrasse haute d'Aurore-Cité, près de l'observatoire |

**Tuiles** (à définir dans `tiles3d.js`, §5) :
- `AIRSHIP_PLATFORM` — plancher de bois et de cordages, **marchable**, `deco: null`.
- `AIRSHIP_DOCK` — **marchable**, c'est la case d'embarquement : marcher dessus ouvre le menu
  de voyage. `deco: 'airshipDock'`.
- `AIRSHIP_MAST` — mât d'amarrage, **non marchable**, `deco: 'airshipMast'`, haut et visible
  de loin (c'est le repère qui dit « le port est là »).

Chaque port fait au minimum **5 × 5 tuiles** de plateforme, avec le mât au centre, des
garde-corps, des lanternes et des bannières aux couleurs de la ville.

**Le dirigeable** (modèle 3D, ≤ 90 meshes) : grande enveloppe fuselée, nacelle en bois
suspendue par des câbles, deux hélices qui tournent, gouvernes à l'arrière, hublots
lumineux, bannière qui claque au vent. Il doit être **majestueux et rassurant**, pas
militaire. Ses couleurs reprennent la palette du jeu (`#38b764`, `#41a6f6`, `#f1c40f`,
`#ff6b9d`, bois `#8b5a2b`, toile crème `#f4e4c1`).

**La séquence de vol** (`fly`), ~6 secondes, entièrement sautable par Espace :
1. le joueur monte à bord (fondu court) ;
2. le dirigeable se détache du mât, la caméra recule et monte : on voit la région s'éloigner ;
3. traversée au-dessus des nuages, avec le **nom de la région de destination** affiché ;
4. descente vers le port d'arrivée, amarrage, le joueur débarque sur `AIRSHIP_DOCK`.

Pendant le vol, `game3d.js` fait le vrai changement de région (`world.setRegion`,
`roamers.setRegion`) au moment où l'on est au-dessus des nuages — c'est là que le
chargement est masqué.

**Règles de déblocage** : on ne peut voler que vers une région **déjà visitée au moins une
fois à pied** (champ `visitedRegions` de la sauvegarde, §20). La région de départ,
`val`, est visitée d'office. Le menu affiche les régions non visitées en grisé avec
« À découvrir à pied ». Voyager est **gratuit** : pas de monnaie dans ce jeu.

`hud3d.js` fournit l'écran de choix : `openAirshipMenu(ports, current, onChoose)` —
la carte du monde du §18 réutilisée, les 6 ports en pastilles, celle de la région courante
mise en avant, les non visitées grisées.

Repli si `airship3d.js` est absent : `game3d.js` propose un simple menu texte de
téléportation entre les ports. Le voyage doit rester possible.

---

## 18 bis. `camera3d.js` — les deux vues  *(nouveau module)*

Robin doit pouvoir **choisir sa vue**, et en changer à tout moment sans perdre ses repères.

```js
R3.register('camera', {
  init(camera),                  // reçoit la THREE.PerspectiveCamera de game3d
  MODES,                         // ['aventure', 'rpg']
  mode(),                        // -> 'aventure' | 'rpg'
  setMode(id, instant),          // bascule, avec transition douce de ~0.6 s
  toggle(),                      // passe à la vue suivante
  rotate(quarterTurns),          // vue RPG uniquement : pivote de ±90°
  zoom(delta),                   // molette
  update(dt, player, groundH),   // player = { worldX, worldY, worldZ, dir, moving }
  frame(),                       // -> { yaw, dist, height } (pour sky3d / le culling)
  serialize(), deserialize(o),   // le choix de vue est sauvegardé
});
```

**Vue `aventure`** — celle d'aujourd'hui, inchangée, et **elle reste la vue par défaut** :
3ᵉ personne, **orientation fixe** (un enfant ne doit jamais se perdre), hauteur ≈ 9, recul
≈ 11, regard 1,6 unité devant le joueur, suivi lissé par `R3.damp`, zoom molette entre
×0,60 et ×1,70, caméra qui ne traverse jamais le relief.

**Vue `rpg`** — plongée façon RPG classique, la carte se lit comme un plateau de jeu :
- caméra nettement **plus haute et plus inclinée** (≈ 60–65° sous l'horizontale, hauteur
  ≈ 16, recul ≈ 10), champ de vision resserré (`fov` ≈ 38) pour aplatir la perspective et
  donner ce rendu presque isométrique des RPG en 2D isométrique ;
- **orientation par pas de 90°** : la vue reste toujours alignée sur la grille — jamais de
  cadrage de travers. `rotate(+1)` / `rotate(-1)` pivote d'un quart de tour, **avec une
  transition douce**, sur `Shift + ←` / `Shift + →` ;
- le joueur reste **au centre de l'écran**, on voit loin devant et derrière lui ;
- zoom molette entre ×0,7 et ×2,0 ;
- attention : dans cette vue, les touches de déplacement restent **absolues** (← va toujours
  vers `−x` du monde) tant que la rotation vaut 0. Après une rotation, `camera3d` expose
  `frame().yaw` et **`game3d.js` fera pivoter les commandes en conséquence** — votre travail
  se limite à exposer `yaw` correctement (multiple de π/2).

Règles communes :
- La bascule se fait à la touche **V** (et par un petit bouton de l'interface, fourni par
  `hud3d.js`, qui appellera `R3.get('camera').toggle()`).
- La transition entre les deux vues est **interpolée** (position, cible, `fov`), jamais un saut.
- Anti-traversée du relief dans les deux modes : la caméra reste au-dessus du terrain
  (`groundH + 2.2` minimum).
- La vue choisie est **sauvegardée** (champ `cameraMode` de la sauvegarde, §20).
- Si `camera3d.js` est absent, `game3d.js` retombe sur son ancien calcul de caméra fixe.

---

## 19. `game3d.js` — le contrôleur  *(intégration — réservé au chef d'orchestre)*

**Aucun agent ne doit toucher à ce fichier.** Il est réécrit à la fin, une fois les modules
livrés. Il assure :

- machine à états `title / starter / world / battle / team / dex / map / transition` ;
- déplacement, collisions et rencontres via `R3.get('regions')` ;
- transitions entre régions sur les tuiles `PORTAL` (fondu au noir, `world.setRegion`,
  `roamers.setRegion`, bandeau de région) ;
- voyage en dirigeable depuis les tuiles `AIRSHIP_DOCK` (§17 bis) ;
- lancer de Pokéball dans le monde ouvert (touche **B**) via `roamers.throwBall` ;
- combats : construction du `battleState` du §17, tours, IA, XP, capture, badges ;
- sauvegarde dans **`robinGame3d_v1`**, avec import unique depuis `robinGame_v2` au premier
  lancement (nom, starter, collection, dresseurs battus) — le jeu 2D reste intact ;
- auto-qualité mesurée sur le **temps de travail d'une frame** (budget 14 ms), jamais sur le FPS.

**Touches** : flèches / ZQSD — Espace parler·valider — **B** lancer une Ball —
**E** équipe — **C** Pokédex — **N** carte — **V** changer de vue —
**Shift + ←/→** pivoter (vue RPG) — **M** son — Échap fermer — molette zoom.
*(Complété depuis : **X** changer de Ball, **F** compagnon, **J** journal,
**T** dirigeable, **H** écran d'aide, **P** compteur de performance. La liste de
référence tenue à jour est `HELP_SECTIONS` dans `hud3d.js` — voir contrat v3 §19.1.)*

---

## 20. Sauvegarde `robinGame3d_v1`

```js
{
  version: 1,
  playerName, regionId, tileX, tileY, dir,
  team: [Mon], box: [Mon],
  collection: { speciesId: count },
  seen: { speciesId: true },
  badges: { regionId: true },
  defeatedTrainers: { npcId: true },
  items: { pokeball: 20, superball: 0, hyperball: 0, potion: 5 },
  visitedRegions: { regionId: true },
  quality, cameraMode,          // 'aventure' | 'rpg'
}
```

Écrire souvent (changement de région, capture, victoire, arène) mais jamais dans la boucle
de rendu.

---

## 21. Ordre de chargement dans `index3d.html`

```
three.min.js
js/palette.js  js/sprites.js  js/audio.js  js/world.js  js/npcs.js  js/creatures.js
js3d/core3d.js
js3d/tiles3d.js        js3d/types3d.js      js3d/moves3d.js
js3d/dex3d.js          js3d/team3d.js
js3d/cities3d.js       js3d/arenas3d.js     js3d/regions3d.js
js3d/water3d.js        js3d/sky3d.js
js3d/citybuild3d.js    js3d/world3d.js
js3d/creatures3d.lib.js  js3d/creatures3d.p1..p4.js
js3d/legendlib3d.js    js3d/legend3d.p1.js  js3d/legend3d.p2.js  js3d/legend3d.p3.js
js3d/actors3d.js       js3d/roamers3d.js
js3d/airship3d.js      js3d/camera3d.js
js3d/hud3d.js          js3d/battle3d.js     js3d/game3d.js
```

`js/world.js` et `js/npcs.js` restent chargés (le jeu 2D en dépend et d'autres modules
lisent encore `PALETTE` / `hashPos`), mais **la 3D n'utilise plus `MAP`, `MAP_W`, `MAP_H`,
`getTile`, `isWalkable`, `getBiomeAt`, `NPCS`** : tout passe par `R3.get('regions')`.

---

## 22. Checklist avant de rendre son travail

- [ ] `node --check monfichier.js` passe.
- [ ] Le fichier commence par un bandeau de commentaires expliquant ce qu'il fait.
- [ ] Aucune exception au chargement, même si tous les autres modules manquent.
- [ ] `R3.register('nom', api)` en fin de fichier, avec **exactement** la signature du contrat.
- [ ] Aucun `new THREE.MeshStandardMaterial` direct ; tout passe par `R3.mat()`.
- [ ] Aucun `fetch`, aucun `import`, aucun fichier externe.
- [ ] Aucune modification dans `js/`, ni dans un fichier assigné à un autre agent.
- [ ] Commentaires en français.

---

## 23. Rendre le jeu jouable — révision du 2026-07-30

Six retours de Robin après une vraie partie. Ce qui suit **complète et corrige** les
sections ci-dessus ; en cas de contradiction, c'est cette section qui fait foi.

### 23.1 Anti-occlusion de la caméra (§18 bis)

`camera3d.js` sonde chaque image la ligne « buste du joueur → position idéale de la
caméra » (14 sondes, table `BLOCK_H` des hauteurs bloquantes par décor). Dès qu'un
mur, une tour ou un arbre coupe la ligne, la caméra se rapproche (jamais en-deçà de
`OCC_MIN = 0,34` de la distance normale) **en gardant sa hauteur** (`OCC_LIFT`) : on
passe par-dessus l'obstacle au lieu de le traverser. Resserrement rapide,
relâchement lent, aucun tremblement. `frame().occlusion` expose le facteur.

Les hauteurs de `BLOCK_H` doivent rester celles des **maquettes réelles** de
`world3d.js` / `citybuild3d.js` (un arbre de forêt culmine à ~2,7, pas à 5).

**Corrigé au passage :** `game3d.js` passait à `camera.update()` une *hauteur*
(nombre) là où le contrat demande une *fonction* `(x, z) => hauteur`. La caméra
croyait donc le terrain plat.

### 23.2 Troisième vue : `fps` (§18 bis)

`MODES = ['aventure', 'rpg', 'fps']`. La vue FPS place la caméra à hauteur d'yeux
(1,52), regard aligné sur `player.dir` (lissé), `fov` 74, léger balancement de
marche, aucune occlusion possible. `frame().yaw` reste 0 : ce n'est pas la caméra
qui tourne les commandes, c'est le joueur.

Commandes en vue FPS (`game3d.js`) : **↑** avance dans la direction du regard,
**↓** recule sans se retourner, **←/→** pivotent sur place d'un quart de tour
(un tour toutes les 200 ms si la touche reste enfoncée). `game3d.js` masque le
modèle du joueur quand `frame().mode === 'fps' && !frame().switching`.

### 23.3 Plus aucune rencontre invisible (§16)

`ENCOUNTER_CHANCE = 0` dans `game3d.js` : marcher dans les hautes herbes ne
déclenche plus rien. Et un roamer qui touche le joueur n'impose plus de combat — il
affiche un rappel (« Espace pour l'affronter, B pour une Ball »). **On n'affronte
que ce que l'on voit et que l'on choisit.**

### 23.4 Dirigeable réellement utilisable (§17 bis)

- `game3d.js` déclare **les six ports** au chargement (leurs coordonnées sont
  statiques) : `airship.canFly()` refusait toute destination dont le port lui était
  inconnu, et un port n'était déclaré qu'au chargement de sa région — au premier
  lancement, aucune destination n'était possible.
- **Toutes** les régions sont proposées (l'écart au §17 bis est délibéré : les
  portes sont sur les bords d'une carte de 384 × 224, exiger d'y être allé à pied
  rendait le dirigeable inutile). Le menu indique les régions non encore explorées.
- Touche **T** : le dirigeable vient chercher le joueur où qu'il soit (`startFlight`
  le pose d'abord sur l'embarcadère de la région de départ).
- Le menu se pilote au clavier : `hud3d.js` expose `setAirshipCursor`,
  `moveAirshipCursor`, `confirmAirship`, `airshipCount`. Sans ça, aucune touche ne
  répondait — pas même Échap — et on restait coincé dans l'écran.
- **Le niveau conseillé s'affiche, et un grand écart demande confirmation**
  (correction 2.10). Puisque **toutes** les régions sont atteignables (voir ci-dessus),
  rien n'empêchait Robin de filer au Plateau d'Aurore (Nv 45 conseillé) avec une équipe
  Nv 12 et de s'y faire écraser sans avoir été prévenu. La donnée était pourtant
  transmise depuis toujours et simplement ignorée : `airshipOptions()` pose
  `level: def.recommendedLevel` et `normalizePorts()` la laisse passer intacte. Chaque
  destination affiche donc « Conseillé : Nv 45 · ton équipe : Nv 12 ⚠️ » dans son
  sous-titre (`states[id].sub`, plus `subAlerte` pour la couleur).
  **On informe, on ne bloque JAMAIS** : au-delà de `ECART_ALERTE = 10` niveaux, le
  premier clic ne fait qu'avertir (toast + « Reclique pour y aller quand même » écrit sur
  le bouton), le second part. Le niveau de l'équipe est celui de la créature **la plus
  forte** — on avertit le moins souvent possible. Une équipe vide ou un niveau conseillé
  absent n'avertissent pas.
  Le second appui doit être espacé d'au moins `DOUTE_DELAI = 0,5 s` : `onKeyDown` ne
  filtre pas `e.repeat`, et garder Espace enfoncé aurait balayé l'avertissement en 30 ms.
  La confirmation vit dans le `onClick` de `buildWorldGrid` : `confirmAirship()` fait
  `btn.click()`, elle traverse donc le même chemin sans code en double.

### 23.5 `gates3d.js` — les repères visibles de loin *(nouveau module)*

`R3.register('gates', { build(scene), setRegion(id), update(t, px, pz), list(),
nearest(x, z, kind), setVisible(v) })`.

Un « phare » par lieu important de la région active : **porte** (obélisques, arche,
anneau de runes, panneau nommant la destination), **port aérien**, **ville**,
**arène**. Chacun porte une **colonne de lumière** (`fog: false`, `frustumCulled =
false`) visible de l'autre bout de la carte. Les panneaux ne s'affichent qu'entre 16
et 190 unités et gardent une taille constante à l'écran.

### 23.6 Boussole permanente (§18)

`hud3d.js` expose `setCompass(info)` / `showCompass(v)` / `setViewMode(mode)`.
Panneau en bas à droite : nom de la région, coordonnées, mini-carte de la région
(fond obtenu **une fois** par `regions.minimap()` puis mis en cache), position et
orientation du joueur, portes/port/ville/arène, et une ligne « prochaine porte »
avec flèche et distance. `game3d.js` appelle `refreshCompass()` à chaque fin de pas,
demi-tour, téléportation et changement de région — **jamais à chaque image**.

### 23.7 Outil de test : `window.GAME3D.tick(dtMs)`

`frame()` a été scindé : `tickGame(dtMs)` exécute une image complète (logique, monde,
rendu) et est exposée par l'API de débogage. Indispensable pour tester le jeu dans un
onglet piloté par l'automatisation, où `requestAnimationFrame` ne se déclenche jamais.

---

## 24. Combats lisibles et spectaculaires — révision du 2026-07-30 (2)

Trois retours de Robin en jouant. Comme le §23, cette section **fait foi** sur les
points qu'elle traite.

### 24.1 Changer de créature dans l'écran Équipe (§18)

Deux causes se cumulaient :

- **Le survol reconstruisait toute la grille** (`mouseenter` → `renderTeamScreen()`,
  qui fait `innerHTML = ''`). L'élément visé par la souris était donc détruit entre
  le `mousedown` et le `mouseup`, et l'événement `click` n'était jamais émis : les
  cases semblaient mortes. Le survol passe désormais par `moveTeamCursor(zone, i)`,
  qui ne touche QUE les classes et le panneau de détail. **Ne jamais reconstruire
  une liste sous le curseur depuis un gestionnaire de survol.**
- **Aucun bouton ne désignait la créature qui combat** : il fallait deviner qu'il
  fallait échanger deux emplacements. Ajout de `ui.teamActiveBtn`
  (« ⚔️ Envoyer au combat », touche **A**) qui appelle `team.setActive(i)`, et d'un
  repère « ⚔️ Au combat » sur la case concernée.

### 24.2 Rien ne doit cacher les PV pendant le choix d'une attaque (§18)

- `showMoveMenu()` masquait délibérément la carte de PV du joueur. Elle reste
  maintenant affichée, et `placeHpCards()` la **remonte au-dessus du menu** si les
  deux boîtes se chevauchent — la position est MESURÉE (`getBoundingClientRect`),
  pas devinée par media query, donc c'est juste à toutes les tailles de fenêtre.
- `game3d.js` affectait `b.phase = 'animating'` **directement** au lieu de passer par
  `setBattlePhase()` : `hud.showBattleUI()` n'était donc pas rappelé et le menu des
  capacités restait ouvert par-dessus la boîte de dialogue pendant toute l'attaque.
  Les 13 affectations de phase passent désormais toutes par `setBattlePhase()`.

### 24.3 Effets d'attaque « spectaculaires » (§17)

Les 18 effets de capacité passent tous par `fxImpact()` : c'est donc lui qui a été
refait, ce qui les relève tous d'un coup. Nouvelles briques réutilisables :

| brique | rôle |
|---|---|
| `glowTexture()` / `glowSprite()` | dégradé radial dessiné au canvas, sprite additif — **la** différence entre un effet géométrique et un effet lumineux |
| `fxGlow(pos, couleur, taille, vie)` | halo qui enfle et s'éteint |
| `fxRays(pos, couleur, n, len)` | rayons radiaux face caméra (signature « anime ») |
| `fxDebris(pos, couleur, n)` | éclats projetés qui retombent en tournant |
| `fxShockDome(pos, couleur, r)` | bulle d'énergie qui se propage |

`fxImpact()` empile cœur blanc + halo teinté + sphère + deux anneaux + dôme + rayons
+ éclats + étincelles (sprites étirés dans le sens de la vitesse) + voile d'écran,
puis ajoute le **ressenti** : secousse de caméra, **arrêt sur image** de ~65 ms
(`hitStop`, le temps du combat tombe à 15 %) et **coup de zoom** (`zoomPunch`, −3,4°
de `fov`).

L'intensité s'adapte au coup : `game3d.js` passe le résultat du calcul de dégâts à
`battle.notifyMove(side, move, res)`, d'où une **force** de 0,45 (raté — aucune gerbe
d'impact, juste un souffle) à ~1,8 (super efficace + critique).

Budget : ~30 objets d'effet au pic d'un impact, tous libérés avec l'effet. Les
étincelles ne coûtent **qu'un sprite** chacune (pas de maillage doublé), et `qCount()`
reste le seul point de réglage par qualité.

---

## 25. Le moteur d'effets « spectacle » — révision du 2026-07-30 (3)

Robin a trouvé les attaques « trop simples » : cette section **remplace le §24.3**.
Les 17 capacités offensives ont été réécrites autour d'un moteur commun.

### 25.1 Trois actes

Toute capacité se joue en **charge → frappe → explosion** :

1. `fxCharge(pos, couleur, durée, taille)` — des particules convergent vers un
   orbe qui grossit pendant qu'un anneau se resserre. C'est ce temps d'attente
   (~0,2 s) qui rend la frappe impressionnante.
2. **la frappe** — quelque chose de VOLUMIQUE traverse l'arène : torrent de feu
   (`fxFlame`), éclair en **TubeGeometry brisée** (`fxLightning` / `boltMesh`),
   mur d'eau, blocs de pierre en dodécaèdres (`rockMesh`), lames géantes,
   tornade de feuilles, trou noir avec disque d'accrétion…
3. `fxExplosion(pos, couleur, échelle, opts)` — flash, boule de feu
   volumétrique en deux couches, double onde de choc, dôme, éclats 3D, rayons,
   fumée décalée, trace au sol, anneau plein écran, secousse, arrêt sur image
   et coup de zoom.

### 25.2 Briques réutilisables

| brique | rôle |
|---|---|
| `flameTexture()` / `smokeTexture()` / `ringTexture()` | textures dessinées au canvas (aucun fichier : le double-clic doit continuer à marcher) |
| `fxCloud(pos, opts)` | nuage volumétrique de sprites — feu, fumée, poussière |
| `fxProjectile(o, t, c, opts)` | corps + halo + queue orientée + traînée semée en vol |
| `fxLightning(a, b, c, opts)` | éclair 3D en tube, avec ramifications et clignotement |
| `fxColumn`, `fxCracks`, `fxShockDome`, `fxRays`, `fxDebris`, `fxScreenRing` | colonne montante, fissures au sol, dôme, rayons, éclats, onde plein écran |

### 25.3 Règles à respecter absolument

- **Fondu additif ≠ couleur.** Sur le ciel très clair d'une arène, une dizaine
  de sprites additifs superposés saturent en blanc et la couleur du type
  disparaît (constaté à l'écran). Le CORPS des flammes/nuages est donc en fondu
  **normal** ; seul le cœur, plus petit, reste additif.
- **Ce qui coûte, c'est la SURFACE repeinte**, pas le nombre d'objets :
  `fxExplosion` réduit la TAILLE (et non seulement le compte) quand la qualité
  baisse, et coupe l'anneau plein écran, le cœur et la fumée.
- **Jamais de `setTimeout`** pour enchaîner : `setTimeoutFx(delai, fn)` compte
  en temps de JEU (donc respecte l'arrêt sur image et disparaît avec la scène).
- **`killFx(e, avorte)`** distingue le ménage (`onKill`, toujours exécuté —
  c'est lui qui retire les voiles accrochés à la caméra) de l'enchaînement
  (`onEnd`, sauté quand l'effet est interrompu).
- **`updateFx` parcourt un INSTANTANÉ de la liste** : la fin d'un effet en crée
  d'autres et le garde-fou en supprime, si bien qu'itérer sur des index vivants
  faisait perdre la trace d'un effet — et son groupe restait dans la scène.
- Garde-fou `FX_MAX = 60` effets vivants ; au-delà, les plus anciens sont
  interrompus.

### 25.4 Banc d'essai

`.claude/verif_fx.js` charge les VRAIS modules (three.min.js + core3d +
battle3d) dans un contexte `vm` avec un faux canvas, joue les 17 capacités +
le soin + un enchaînement brutal de 30 capacités, et vérifie qu'aucune ne
boucle et que la scène revient **exactement** à son décompte de départ. À
relancer après toute retouche des effets.
