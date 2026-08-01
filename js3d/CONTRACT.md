# CONTRAT D'API — version 3D du « Jeu de Robin »

Ce fichier fait autorité. Chaque module de `js3d/` est écrit par un agent différent,
**en parallèle**. Respecter ce contrat à la lettre est ce qui permet à l'ensemble de
s'assembler sans retouche.

---

## Règles générales, valables pour TOUS les modules

1. **Pas de modules ES, pas d'`import`/`export`.** Fichiers `<script>` classiques,
   variables globales. Le jeu doit rester jouable en double-cliquant `index3d.html`
   (protocole `file://`), donc : **aucun `fetch`, aucun chargement de fichier externe,
   aucune texture sur disque.** Tout est procédural ou en `CanvasTexture`.
2. **Ne jamais modifier `js/`** (le jeu 2D d'origine doit continuer à fonctionner).
   Ces fichiers sont chargés et leurs données/logique sont réutilisées telles quelles :
   `MAP`, `MAP_W`, `MAP_H`, `TILE_TYPES`, `getTile`, `isWalkable`, `isEncounterTile`,
   `getBiomeAt`, `getBiomeQuadrant`, `hashPos`, `NPCS`, `getNPCAt`, `CREATURES`,
   `pickRandomCreature`, `RARE_ENCOUNTER_CHANCE`, `Audio_`, `PALETTE`, `SPRITES`.
3. **Axes** : tuile `(tx, ty)` → monde `(x = tx, z = ty)`, `y` = hauteur.
   1 tuile = 1 unité. `dir 'up'` = `−z`, `'down'` = `+z`, `'left'` = `−x`, `'right'` = `+x`.
4. **Utiliser `R3`** (`core3d.js`) pour tous les matériaux, géométries et primitives.
   Ne jamais faire `new THREE.MeshStandardMaterial` directement : passer par `R3.mat()`,
   sinon les perfs s'écroulent (un matériau par objet = un draw call par objet).
5. **Temps** : `R3.clock.t` (secondes, réel). Ne jamais animer sur un compteur de frames.
6. **Dégradation gracieuse** : si un module dont vous dépendez est absent
   (`R3.get('water')` renvoie `undefined`), produire un rendu de repli et continuer.
   Aucun module ne doit lever d'exception au chargement.
7. **S'enregistrer** en fin de fichier : `R3.register('nom', api)`.
8. **Qualité** : lire `R3.quality` (`shadows`, `viewDistance`, `particles`,
   `waterDetail`) et s'y adapter. S'abonner via `R3.onQualityChange(fn)` si utile.
9. Commentaires **en français**, comme le reste du projet. Public visé : un enfant de
   10 ans joue au résultat ; le code, lui, doit rester lisible par un adulte.

---

## `world3d.js` — terrain et décors

```js
R3.register('world', {
  build(scene),                 // construit tout le monde et l'ajoute à la scène
  heightAt(x, z),               // -> number : hauteur LISSÉE du terrain (interpolée)
  update(t, px, pz),            // appelé chaque frame (animations de décor, culling)
  root,                         // THREE.Group racine
});
```

- **Terrain** : découpé en **chunks de 24×24 tuiles** (soit 5×3 = 15 chunks pour la
  carte 120×70). Un `BufferGeometry` par chunk, **vertex colors** issues de
  `R3.tileStyle(type).ground`, `flatShading: false`.
- **Hauteurs** : partir de `R3.tileStyle(type).h`, puis **lisser** — la hauteur d'un
  sommet est la moyenne des 4 tuiles qui le touchent. C'est ce qui donne des collines
  douces au lieu d'un escalier. `heightAt()` doit renvoyer la hauteur **interpolée
  bilinéairement**, cohérente au pixel près avec la géométrie affichée (le joueur ne
  doit ni flotter ni s'enfoncer).
- **Décors** : un `THREE.InstancedMesh` par catégorie **et par chunk** (culling naturel).
  Catégories, d'après `R3.tileStyle(type).deco` :
  `tree`, `flowers`, `tallgrass`, `rock`, `bench`, `fountain`, `house` (toit =
  `style.roof`), `house2`, `vlghouse`, `mountain`, `reeds`, `snowtuft`, `shell`,
  `mowline`. Position/rotation/échelle variées par `R3.hash(x, y)` pour que rien ne
  paraisse répété.
- **Qualité des décors** : les maisons et les arbres sont ce que Robin verra le plus —
  y consacrer le plus de soin (arbres : tronc + 2-3 volumes de feuillage décalés ;
  maisons : murs, toit débordant à deux pans, porte, fenêtres, cheminée).
- **Montagnes** : masses rocheuses irrégulières (plusieurs blocs pivotés), sommets
  enneigés au-dessus de `h > 3`.
- **Eau** : appeler `R3.get('water')`. Si présent, lui confier la construction des
  surfaces (voir plus bas) ; sinon, un plan bleu translucide simple.
- Budget : viser **moins de 200 draw calls** avec tout le monde visible.

---

## `water3d.js` — surfaces d'eau

```js
R3.register('water', {
  makeSurface(tiles, kind),  // tiles: [{x, y, h}], kind: 'lake'|'sea'|'waves'|'shallow'|'pond'
                             // -> THREE.Mesh prêt à être ajouté à la scène
  release(mesh),             // OBLIGATOIRE au déchargement — voir ci-dessous
  update(t),                 // anime toutes les surfaces créées
  material(kind),            // -> THREE.Material (pour un usage ponctuel, ex. fontaine)
});
```

- `ShaderMaterial` (ou `MeshStandardMaterial` + `onBeforeCompile`) : vagues
  sinusoïdales croisées déplaçant sommets **et** normales, couleur profonde/peu
  profonde selon la hauteur, spéculaire du soleil, écume près des berges,
  transparence. Reproduit les 8 animations d'eau du jeu 2D (lac, mer, vagues,
  bas-fonds, mare, fontaine).
- Si `R3.quality.waterDetail === 0` : matériau plat animé en couleur uniquement.

**Amendement du 2026-08-01 (chantier 1.10) — `release(mesh)` n'est pas facultatif.**
`makeSurface` inscrit chaque nappe dans un tableau interne `surfaces`, parce qu'un
changement de qualité doit pouvoir leur rééchanger leur matériau. Rien ne l'en retirait :
`R3.disposeTree` ne libère que les buffers GPU, les `Float32Array` (position, normale,
`aEdge`, index) restent en mémoire JS tant que le mesh est référencé — **mesuré : 16 641
sommets et ~0,5 Mo pour un chunk d'eau plein de 32×32 tuiles.** Traverser une région puis
en changer laissait des centaines d'entrées mortes, et `onQualityChange` leur donnait
consciencieusement un matériau tout neuf.
- Celui qui décharge un mesh d'eau **appelle `release(mesh)` avant `R3.disposeTree`**.
  Côté monde, c'est `disposeChunkGroup()` de `world3d.js` : le SEUL point de libération
  d'un chunk, utilisé par `disposeChunk()` **et** par `setRegion()` (le pire cas : tous
  les chunks d'un coup). Ne pas rétablir un `R3.disposeTree` direct à ces deux endroits.
- Marqueur d'une nappe : `mesh.userData.waterKind`. **Pas `mesh.name`** — water3d le met
  à `'water:' + kind` mais world3d l'écrase aussitôt par `'eau-' + kind`.
- Filet dans `onQualityChange` : les nappes dont la chaîne de parents ne remonte plus à
  la scène sont jetées au passage. Le test remonte jusqu'à la racine, car `disposeTree`
  détache le GROUPE du chunk et non ses enfants : `mesh.parent` reste renseigné.
- `surfaces` est exporté **par référence** : on le mute en place (`splice`, `length = n`),
  jamais `surfaces = [...]`.

---

## `sky3d.js` — ciel, lumière, atmosphère

```js
R3.register('sky', {
  build(scene),                 // ciel, soleil, lumières, nuages
  setBiome(biome, instant),     // transition douce d'ambiance (voir R3.biomeMood)
  update(t, px, pz),            // suit le joueur (dôme, frustum d'ombre, particules)
  sun,                          // THREE.DirectionalLight (world3d ne la crée PAS)
});
```

- Dôme de ciel en dégradé (shader), soleil directionnel + `HemisphereLight`,
  `FogExp2` dont la couleur suit `R3.biomeMood(biome).fog`.
- **Ombres** : `PCFSoftShadowMap`, frustum orthographique **recentré sur le joueur**
  (~30 unités de côté) à chaque frame — ombres nettes sans coût.
- Nuages volumétriques légers (plans/sphères translucides lentes) très au-dessus.
- Particules d'ambiance selon `R3.biomeMood(biome).particles` :
  `pollen`, `sparkle`, `snow`, `spray`. Désactivées si `!R3.quality.particles`.

---

## `creatures3d.lib.js` — primitives partagées des créatures

Écrit par l'agent du **lot 1**, utilisé par les 4 lots. Expose `R3.register('clib', {...})`
avec des assemblages récurrents :
`bodyBlob`, `catHead`, `birdBeak`, `dragonWing`, `finTail`, `petalRing`, `antenna`,
`paw`, `ear`, `horn`, `bubbleTrail`, `flameTuft`.
Les autres lots l'utilisent **si présent** (`const CL = R3.get('clib')`), avec un repli
sur les primitives `R3.*` sinon.

## `creatures3d.p1.js` … `p4.js` — les 26 modèles

Chaque fichier appelle, pour chacune de ses créatures :

```js
R3.registerCreature('feuillou', function () {
  const g = R3.group( /* ... */ );
  g.userData.anim = { head: ..., wingL: ..., wingR: ..., tail: ..., float: true };
  g.userData.attack = function (g, p) { /* p ∈ [0,1] : animation d'attaque */ };
  return g;
});
```

Règles :
- Modèle **centré en (0,0,0)**, **posé sur `y = 0`**, tourné vers **+z**,
  environ **1 unité de haut** (le joueur en fait 1,0 aussi).
- Silhouette et couleurs reprises du dessin 2D correspondant dans `js/creatures.js`
  (la fonction `drawXxx` de la créature) — c'est **la même créature**, en volume.
  `creature.color` n'est PAS fiable comme couleur dominante : lire le `draw()`.
- `userData.anim` : références aux sous-groupes animables. `R3.idleCreature()` s'en
  sert automatiquement. Poser `float: true` pour les créatures qui lévitent.
- `userData.attack(g, p)` est optionnel : animation jouée en combat, `p` va de 0 à 1.
- Style : low-poly **arrondi et charmant**, pas anguleux. `flat: true` réservé aux
  minéraux et cristaux. Yeux via `R3.eyes()`, joues via `R3.blush()` pour les kawaii.
- Budget : **≤ 40 meshes** par créature.

Répartition (26 créatures) :
- **p1** : feuillou, petalia, goutella, bullini, etincelo, meduzia, coralou
- **p2** : fluffly, glanou, papillon, cygnik, lotira, lapinou, hibouche
- **p3** : etoilamer, crabilino, nuagette, miaouche, pandouki, koronette
- **p4** : stellini, doudoune, flamdrak, glydrak, aquadrak, tonnedrak

---

## `actors3d.js` — joueur et PNJ

```js
R3.register('actors', {
  buildPlayer(),                     // -> THREE.Group (personnage articulé)
  buildNPC(npc),                     // -> THREE.Group (npc = entrée de NPCS)
  updatePlayer(g, opts),             // opts: { moving, moveProgress, dir, t }
  updateNPC(g, npc, t),              // respiration / balancement léger
  buildNPCs(scene),                  // instancie les 18 PNJ à leur place et renvoie la liste
});
```

- Personnage low-poly articulé (hiérarchie d'`Object3D` : bassin, torse, tête,
  2 bras, 2 jambes), **1 unité de haut**, tourné selon `dir`.
- **Cycle de marche piloté par `moveProgress`** (0→1 sur un pas de 160 ms) :
  jambes et bras en opposition, léger rebond vertical. Rotation **lissée** vers la
  nouvelle direction (pas de saut instantané).
- PNJ : recolorés depuis `npc.colorMap` (clés de `PALETTE` dans `js/palette.js` :
  `j` = cheveux, `l` = vêtements) et coiffés selon `npc.accessory`
  (`hat-ranger`, `hat-fisher`, `hat-sailor`), modélisés en volume.
- Les 8 dresseurs (`npc.isTrainer`) doivent se **distinguer au premier coup d'œil**
  (posture, tenue plus marquée).

---

## `battle3d.js` — scène de combat

```js
R3.register('battle', {
  enter(battleState, biome),   // construit l'arène ; battleState = state.battle de game3d
  update(dt, battleState),     // anime (pokéball, secousses, attaques, particules)
  render(renderer),            // rend la scène de combat
  exit(),                      // libère
  onResize(w, h),
});
```

- **Scène Three.js séparée** (ne pas réutiliser celle du monde) : plateforme circulaire
  pour chacun des deux camps, décor de fond accordé au biome (`R3.biomeMood`),
  caméra légèrement cinématique (lent travelling).
- Combat sauvage : créature adverse au centre, **pokéball 3D** lancée en parabole avec
  rotation, atterrissage, 3 secousses, puis **gerbe de particules** à la capture ou
  éclat de fuite. Reprendre les timings du jeu 2D : lancer 0→600 ms, secousses
  600→1800 ms (3 cycles de 400 ms), résultat à 1800 ms.
- Combat de dresseur : starter du joueur de dos au premier plan, adversaire en face,
  animation d'attaque (`userData.attack`) et flash d'impact à chaque coup.
- **Les barres de PV et le menu de capacités ne sont PAS dessinés ici** : ils sont en
  HTML (voir `hud3d.js`).

---

## `hud3d.js` + `css3d/hud3d.css` — interface

```js
R3.register('hud', {
  init(),
  showMessage(text), hideMessage(),        // boîte de dialogue
  setBiomeBanner(label),                   // bandeau de biome, disparaît tout seul
  setCollectionCount(n, total),
  showMoveMenu(battle), hideMoveMenu(), setMoveCursor(i),
  setHP(side, hp, maxHp, name),            // side: 'player' | 'foe'
  openMap(), closeMap(),                   // carte du monde
  openCollection(), closeCollection(),
  setFps(v),                               // compteur de debug (masqué par défaut)
  toast(text),
});
```

- **Plein écran** : le canvas 3D occupe toute la fenêtre, l'UI flotte par-dessus.
  Responsive, lisible sur un écran d'ordinateur portable.
- Conserver les **ids existants** utilisés par la logique reprise de `js/game.js` :
  `#title-overlay`, `#name-input`, `#start-btn`, `#message-box`, `#message-text`,
  `#starter-overlay`, `#starter-grid`, `#collection-overlay`, `#collection-grid`,
  `#close-collection`, `#mute-btn`.
- **Menu de capacités et barres de PV en HTML/CSS** (grille 2×2, barre animée,
  couleur passant du vert au rouge) — bien plus net qu'en canvas.
- **Carte du monde (touche N)** : overlay HTML avec un `<canvas>` 2D à l'échelle
  correcte pour 120×70 (le jeu 2D avait un bug : il était calibré pour 60×45 et
  débordait). Afficher joueur, PNJ, biomes, et les dresseurs déjà battus.
- **Vignettes de créatures** (collection, choix du starter) : conserver l'appel
  `creature.draw(ctx, x, y, 2)` sur un petit canvas 2D hors-écran — ça marche tel quel
  et c'est joli. *Bonus si le temps le permet* : un rendu 3D miniature à la place.
- Style : cartes arrondies, ombres douces, typographie ronde, palette du jeu
  (`#38b764`, `#41a6f6`, `#f1c40f`, `#ff6b9d`, `#1a1c2c`). Chaleureux, lisible,
  pas d'interface « pro ».

---

## `game3d.js` — contrôleur

Remplace `js/game.js`. Reprend **à l'identique** sa logique (elle est correcte et
testée) et n'échange que la couche de rendu :

- `state` (mêmes champs), machine à états `title / starter / world / battle /
  collection / map`, file `state.messages`.
- `updateWorld(dt)` : déplacement à la tuile avec interpolation (`MOVE_DURATION_MS =
  160`), priorité d'axe haut > bas > gauche > droite, collisions
  `isWalkable(nx,ny) && !getNPCAt(nx,ny)`, rencontres à 18 % en fin de pas sur tuile
  `encounter`, bannière de biome, musique.
- Entrées clavier identiques (flèches + ZQSD/WASD, Espace, C, N, M, Échap).
- Combat de dresseur : `useTrainerMove`, `rollDamage`, `pickAIMove` — repris tels quels.
- Sauvegarde : **même clé `robinGame_v2`** que le jeu 2D, mêmes champs → la
  progression de Robin passe d'une version à l'autre.
- **Caméra** : 3ᵉ personne, **orientation fixe** (un enfant ne doit jamais se perdre),
  suivi lissé par `R3.damp`, hauteur ~9 unités, recul ~11, regard légèrement en avant
  du joueur. Molette = zoom entre deux bornes confortables.
- **Auto-qualité** : mesurer le FPS ; sous 40 fps pendant 2 s, descendre d'un cran
  (`R3.setQuality`). Ne jamais remonter automatiquement (évite l'oscillation).
- **Corriger le bug audio préexistant** : `Audio_.playMusic` n'a pas de piste pour
  `mountain`, `village`, `city2` → prévoir un repli sur une piste existante proche
  (`plain` / `forest` / `city`) plutôt que le silence.
- Exposer `window.GAME3D = { state, ... }` pour faciliter le débogage en console.
