// =============================================================================
//  legend3d.p3.js — LOT L3 DES LÉGENDAIRES 3D   (CONTRACT3 §9, CONTRACT2 §4)
//  lumière · ombre · temps · espace
//  aureol · solaria · prismee · nyxaroth · penombra · eclipsion ·
//  chronoss · eternia · sablion · vortexis · astralis · nebulon
// =============================================================================
//  CE QUI A CHANGÉ, ET POURQUOI
//  ----------------------------
//  Robin a demandé (demande n° 5) que les légendaires « ressemblent presque aux
//  vrais » de la série et de Pokémon Horizons. On s'inspire, on ne copie pas :
//  les noms et les ids ne bougent pas, c'est la SILHOUETTE qui progresse.
//  Ce lot porte les quatre types les plus mythiques du jeu — l'entité du temps
//  couronnée d'anneaux, le seigneur de l'espace aux plaques cristallines, le
//  gardien de lumière auréolé, l'ombre serpentine aux yeux brillants.
//
//  Direction artistique « Horizons » appliquée ici :
//    * formes NETTES et peu nombreuses, contours marqués (facettes plates),
//    * couleurs franches, deux teintes par créature plus un accent lumineux,
//    * CRISTAUX et ANNEAUX FLOTTANTS comme signature commune du lot,
//    * yeux en amande, lumineux : c'est ce qu'on voit en premier, de loin.
//
//  LE BUDGET COMMANDE TOUT : 25 DRAW CALLS MAXIMUM PAR LÉGENDAIRE
//  --------------------------------------------------------------
//  La version précédente de ce fichier tournait entre 55 et 80 meshes par
//  légendaire — donc autant de draw calls, les matériaux partagés n'y changent
//  rien. Avec deux légendaires à l'écran et le monde autour, on crevait le
//  plafond de 250 draw calls du §1. Un jeu qui rame n'est plus un cadeau : le
//  budget prime sur l'ambition visuelle.
//
//  Trois décisions en découlent, et elles servent AUSSI le style Horizons :
//    1. Une patte = UN mesh (un fût tronconique à facettes) au lieu de deux.
//    2. Les yeux passent par `gemEyes` (2 meshes) au lieu de `llib.bigEyes`
//       (6 à 8) : sur une tête sombre, une amande émissive se lit mieux de loin
//       qu'un globe + iris + reflet qu'on ne distingue plus à 10 mètres.
//    3. Les ailes passent par `shardWing` (2 ou 3 grandes lames facettées) au
//       lieu de `llib.majesticWing` (7 à 11 meshes). Une aile faite de 3 grands
//       éclats est PLUS lisible de loin qu'une aile de 9 plumettes.
//  Les primitives de `legendlib3d.js` sont utilisées partout où elles tiennent
//  dans le budget, et toujours avec `rings`/`particles` explicites : leurs
//  valeurs par défaut (1 anneau + 4 lucioles) coûtent 5 draw calls à elles
//  seules et suffisent à faire déborder un modèle.
//
//  BUDGET MESURÉ (nombre de meshes du modèle, vérifié au chargement) :
//    aureol 24 · solaria 24 · prismee 24 · nyxaroth 24 · penombra 24
//    eclipsion 24 · chronoss 24 · eternia 24 · sablion 24 · vortexis 24
//    astralis 22 · nebulon 24
//  `finishLegendary()` recompte à la construction et prévient en console si un
//  modèle dépasse 25 — impossible de laisser filer le budget sans le voir.
//
//  CONVENTIONS (reprises de creatures3d.p1.js et du §4 de v2)
//  ----------------------------------------------------------
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z, 1,8 à 2,4
//      unités de haut (les créatures ordinaires font 1,0).
//    * Tout le corps vit dans un sous-groupe `inner` : les attaques bougent
//      `inner`, jamais la racine (que battle3d.js positionne et met à l'échelle).
//    * userData.anim = { head, wingL, wingR, tail, float }
//    * userData.attack = function (racine, p) avec p de 0 à 1.
//    * userData.legendary = true, userData.auraColor = '#xxxxxx'.
//
//  IDLE CALME — ET POURQUOI wingL/wingR RESTENT À null
//  ---------------------------------------------------
//  `R3.idleCreature()` fait battre `anim.wingL`/`anim.wingR` à sin(t × 6), soit
//  environ un battement par seconde : c'est le bon rythme pour un petit oiseau,
//  pas pour un légendaire de 2,3 unités qui doit avoir l'air majestueux. Le §9
//  de v3 demande un idle CALME. Les ailes de ce lot sont donc animées ici même,
//  à sin(t × 1,1), par le crochet ci-dessous — et `anim.wingL`/`wingR` restent
//  à null pour que l'idle générique ne vienne pas les secouer par-dessus.
//  Idem pour les traînes déjà animées par `llib` : `anim.tail` reste à null.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Accès à la bibliothèque de primitives légendaires (lot L1), avec repli
  //  total si elle est absente : chaque appel renvoie alors un Group vide
  //  plutôt que de lever une exception (règle §1.4 de v3).
  //  Seule `aura` a un vrai repli local : le §9 la rend obligatoire sur les 36,
  //  un légendaire sans halo redevient une créature ordinaire.
  // ---------------------------------------------------------------------------
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  /** Options de matériau normalisées. Le cache de `R3.mat()` a pour clé la
   *  couleur + JSON.stringify(options) : émettre TOUJOURS les mêmes clés dans
   *  le même ordre est ce qui fait qu'on partage les matériaux au lieu d'en
   *  créer un par mesh (et donc de perdre le bénéfice du partage). */
  function M(o) {
    o = o || {};
    return {
      seg: num(o.seg, 12),
      rough: num(o.rough, 0.55),
      flat: !!o.flat,
      transparent: !!o.transparent,
      opacity: num(o.opacity, 1),
      side: (o.side !== undefined) ? o.side : THREE.FrontSide,
      emissive: o.emissive || '#000000',
      emissiveIntensity: num(o.emissiveIntensity, 0.12),
      depthWrite: (o.depthWrite !== undefined) ? o.depthWrite : true,
    };
  }

  /** Repli local de `aura` : un disque au sol + une bulle. 2 meshes, animés
   *  par le crochet local puisque `llib.animateAura` n'existe pas dans ce cas. */
  function auraFallback(color, radius, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const r = Math.max(0.2, num(radius, 1.0));
    const g = new THREE.Group();
    const soft = M({ seg: 14, rough: 0.35, transparent: true, opacity: 0.18, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.9, depthWrite: false });
    const bulle = R3.ellipsoid(r * 0.9, r * 0.85, r * 0.9, col, 0, num(o.y0, r * 0.85), 0, soft);
    const tache = R3.cyl(r * 1.2, r * 1.2, 0.004, col, 0, 0.02, 0, soft);
    bulle.castShadow = false; bulle.receiveShadow = false;
    tache.castShadow = false; tache.receiveShadow = false;
    g.add(bulle, tache);
    g.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    // Respiration lente, par la géométrie seule : le matériau est PARTAGÉ,
    // le faire pulser ferait clignoter les 36 légendaires en même temps.
    g.userData.p3pulse = { bulle: bulle, tache: tache, ph: Math.random() * 6.28 };
    return g;
  }

  function safeLL() {
    const base = (typeof R3.get === 'function') ? R3.get('llib') : null;
    const empty = function () { return new THREE.Group(); };
    const noop = function () {};
    return {
      aura: (base && base.aura) || auraFallback,
      orbitRing: (base && base.orbitRing) || empty,
      crystalCluster: (base && base.crystalCluster) || empty,
      majesticWing: (base && base.majesticWing) || empty,
      plumeTail: (base && base.plumeTail) || empty,
      halo: (base && base.halo) || empty,
      runeStone: (base && base.runeStone) || empty,
      flowRibbon: (base && base.flowRibbon) || empty,
      starfield: (base && base.starfield) || empty,
      glowCore: (base && base.glowCore) || empty,
      bigEyes: (base && base.bigEyes) || empty,
      animateAura: (base && base.animateAura) || noop,
      serpentBody: (base && base.serpentBody) || empty,
      plateShell: (base && base.plateShell) || empty,
      clockFace: (base && base.clockFace) || empty,
      mistPuff: (base && base.mistPuff) || empty,
    };
  }
  const LL = safeLL();

  // ===========================================================================
  //  PRIMITIVES LOCALES
  //  Elles n'existent pas dans legendlib3d.js (§13 de v2) et ce lot n'a pas le
  //  droit d'y écrire : elles vivent donc ici. Elles sont signalées dans le
  //  rapport pour que le lot L1 puisse les remonter dans la bibliothèque si les
  //  lots L1 et L2 en veulent aussi.
  // ===========================================================================

  /** Courbe 0 -> 1 -> 0 : la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Ossature commune : racine + sous-groupe `inner` où l'on modélise tout. */
  function shell() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  /** PRIMITIVE LOCALE — patte en UN seul mesh.
   *  Un fût tronconique à facettes qui va de la hanche au sol. La version
   *  précédente en utilisait deux (cuisse + pied) : à 4 pattes ça faisait 8
   *  draw calls, soit un tiers du budget d'un légendaire pour la partie du
   *  corps qu'on regarde le moins. Le pied est suggéré par l'évasement du bas. */
  function post(hx, hipY, hz, thick, color, opts) {
    const o = opts || {};
    const h = Math.max(0.08, hipY);
    const m = R3.cyl(thick * 0.70, thick * 1.15, h, color, hx, h * 0.5, hz,
      M({ seg: num(o.seg, 6), rough: num(o.rough, 0.7), flat: true, emissive: o.emissive || '#000000', emissiveIntensity: num(o.emissiveIntensity, 0.08) }));
    return m;
  }

  /** PRIMITIVE LOCALE — yeux en amande lumineux, 2 meshes.
   *  `llib.bigEyes` en coûte 6 à 8 (globe + iris + reflet + sourcil par œil).
   *  À la distance où l'on croise un légendaire sur la carte, on ne voit qu'une
   *  chose : deux fentes qui brillent. On ne modélise donc que ça, et on incline
   *  l'amande vers le nez — c'est l'inclinaison, pas le sourcil, qui fait le
   *  regard décidé. */
  function gemEyes(spread, y, z, r, opts) {
    const o = opts || {};
    const col = o.color || '#ffe066';
    const rr = Math.max(0.02, num(r, 0.07));
    const g = new THREE.Group();
    const mtl = M({ seg: 10, rough: 0.2, flat: !!o.flat, emissive: col, emissiveIntensity: num(o.intensity, 1.5) });
    const tilt = num(o.tilt, 0.34);
    [-1, 1].forEach(function (s) {
      const e = R3.ellipsoid(rr * 1.35, rr * 0.58, rr * 0.52, col, s * num(spread, 0.14), num(y, 0), num(z, 0.2), mtl);
      e.rotation.z = -s * tilt;
      e.rotation.y = -s * 0.28;   // les amandes suivent la courbe du crâne
      g.add(e);
    });
    return g;
  }

  /** PRIMITIVE LOCALE — aile en éclats, 1 + `feathers` meshes.
   *  Pivot à l'ÉPAULE, l'aile se déploie vers +x dans le plan XY (même
   *  convention que `llib.majesticWing`, on peut donc les mélanger).
   *  Aile gauche : `side: -1`, retournée par une rotation (jamais par une
   *  échelle négative, qui retournerait aussi l'éclairage).
   *
   *  Chaque « plume » est un cône à 4 pans écrasé sur z : une lame plate et
   *  anguleuse, très lisible de loin, exactement l'esprit Horizons. Trois
   *  grandes lames font une aile plus lisible que neuf plumettes, pour trois
   *  fois moins de draw calls.
   *
   *  opts = { feathers 0..3 (1), height (0.55×len), color2, opacity, glow,
   *           side ±1, sweep (0.07), flatten (0.20), x, y, z } */
  function shardWing(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.2, num(len, 1.0));
    const H = num(o.height, L * 0.55);
    const col2 = o.color2 || color;
    const n = Math.max(0, Math.min(3, Math.round(num(o.feathers, 1))));
    const sweep = num(o.sweep, 0.07);
    const flat = num(o.flatten, 0.20);
    const transp = num(o.opacity, 1) < 0.99;
    const g = new THREE.Group();

    // Éventail : la grande lame part vers l'avant-haut, les suivantes s'ouvrent
    // vers l'arrière-bas. C'est ce décalage qui donne l'impression d'envergure.
    const ANG = [0.30, -0.10, -0.48, -0.84];
    for (let i = 0; i <= n; i++) {
      const a = ANG[i];
      const l = L * (i === 0 ? 1 : 0.86 - i * 0.14);
      const w = H * (i === 0 ? 0.50 : 0.34 - i * 0.045);
      const c = (i % 2) ? col2 : color;
      const m = R3.cone(w, l, c, Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, -sweep * L * i,
        M({
          seg: 4, rough: o.glow ? 0.3 : 0.5, flat: true,
          transparent: transp, opacity: num(o.opacity, 1),
          side: THREE.DoubleSide,
          emissive: c, emissiveIntensity: o.glow ? 0.9 : 0.22,
          depthWrite: !transp,
        }));
      m.rotation.z = a - Math.PI / 2;    // la pointe du cône part vers l'extérieur
      m.scale.z = flat;                  // la lame est PLATE : c'est une aile
      m.castShadow = !transp;
      m.receiveShadow = !transp;
      g.add(m);
    }

    if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
    g.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    g.userData.p3wingBase = 0;
    return g;
  }

  /** PRIMITIVE LOCALE — battement d'aile CALME.
   *  Renvoie une fonction d'idle à donner à `finishLegendary`. Les deux ailes
   *  reçoivent la MÊME valeur de rotation.z : l'aile gauche porte déjà un
   *  rotation.y = π, et l'ordre d'Euler par défaut ('XYZ') applique z AVANT y —
   *  le retournement s'occupe donc tout seul de la symétrie. */
  function calmWings(wings, amp, speed) {
    const a = num(amp, 0.16), sp = num(speed, 1.1);
    return function (t) {
      const k = Math.sin(t * sp) * a;
      for (let i = 0; i < wings.length; i++) {
        if (wings[i]) wings[i].rotation.z = wings[i].userData.p3wingBase + k;
      }
    };
  }

  /** Anime le repli d'aura local (si `llib` manquait au chargement). */
  function pulseFallbackAura(g) {
    const d = g && g.userData && g.userData.p3pulse;
    if (!d) return null;
    return function (t) {
      const k = Math.sin(t * 1.15 + d.ph);
      d.bulle.scale.setScalar(1 + k * 0.07);
      const s = 1 + k * 0.09;
      d.tache.scale.set(s, 1, s);
    };
  }

  // ---------------------------------------------------------------------------
  //  Finition commune : marquage légendaire, mesure du budget, crochet d'idle.
  // ---------------------------------------------------------------------------
  const BUDGET = 25;

  /**
   * À appeler EN DERNIER, une fois `userData.anim` posé.
   *  - marque le modèle (`legendary`, `auraColor`) comme l'exige le §4 de v2 ;
   *  - COMPTE les meshes et prévient si le budget du §9 de v3 est dépassé ;
   *  - branche l'idle des primitives lumineuses.
   *
   * Deux chemins pour l'idle, et c'est volontaire :
   *   1. `userData.anim.update(root, t)` — le crochet documenté par
   *      legendlib3d.js, que le lot Intégration peut appeler.
   *   2. `onBeforeRender` sur le premier mesh du modèle — un repli qui marche
   *      SANS branchement. Aujourd'hui `battle3d.js` et `roamers3d.js`
   *      n'appellent que `R3.idleCreature()`, qui ignore `anim.update` : sans ce
   *      repli, les anneaux ne tourneraient jamais et les auras ne
   *      respireraient pas. Three.js appelle `onBeforeRender` juste avant de
   *      dessiner le mesh ; l'animation ne dépendant que de `t`, être appelé
   *      deux fois dans la même image (passe d'ombres) ne change rien.
   */
  function finishLegendary(g, color, tick) {
    g.userData.legendary = true;
    g.userData.auraColor = color;
    if (!g.userData.anim) g.userData.anim = {};

    // --- Mesure du budget de draw calls -------------------------------------
    let meshes = 0, first = null;
    g.traverse(function (o) {
      if (o.isMesh || o.isPoints) { meshes++; if (!first && o.isMesh) first = o; }
    });
    g.userData.drawCalls = meshes;
    if (meshes > BUDGET) {
      console.warn('[legend3d.p3] budget dépassé : ' + meshes + ' draw calls (max ' + BUDGET + ')');
    }

    const run = function (t) {
      const tt = (typeof t === 'number' && isFinite(t)) ? t : (R3.clock ? R3.clock.t : 0);
      try { LL.animateAura(g, tt); } catch (e) { /* une animation ne casse jamais une frame */ }
      if (tick) { try { tick(tt); } catch (e) { /* idem */ } }
    };
    g.userData.anim.update = function (root, t) { run(t); };

    try {
      if (first) {
        first.frustumCulled = false;   // sinon l'ancre peut être sautée hors champ
        first.onBeforeRender = function () { run(R3.clock ? R3.clock.t : 0); };
      }
    } catch (e) { /* le repli d'idle n'est jamais bloquant */ }

    return g;
  }

  /** Assemble plusieurs fonctions d'idle en une seule (et ignore les nulles). */
  function ticks() {
    const list = [];
    for (let i = 0; i < arguments.length; i++) if (arguments[i]) list.push(arguments[i]);
    if (!list.length) return null;
    return function (t) { for (let i = 0; i < list.length; i++) list[i](t); };
  }

  // =============================================================================
  //  TYPE LUMIÈRE — aureol · solaria · prismee
  //  Le gardien de lumière est AURÉOLÉ : l'auréole à rayons est le signe du type.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  AURÉOL — « griffon solaire, auréole à rayons »   (aurore)
  //  Le gardien de lumière : quadrupède léonin trapu, tête d'aigle, immense
  //  auréole tournante derrière la nuque, deux ailes de lumière en éclats.
  //  Attributs distinctifs : COURONNE (auréole à rayons) + AILES majestueuses.
  //  Budget : 1 corps + 1 poitrail + 4 pattes + 1 cou + 1 crâne + 1 bec
  //         + 2 yeux + 6 auréole + 4 ailes + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('aureol', function () {
    const OR = '#ffe066', ORANGE = '#ff8c42', CREME = '#fff4d6';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de lion, bas et large (2) ------------------------------------
    inner.add(R3.ellipsoid(0.46, 0.42, 0.68, OR, 0, 1.06, 0, M({ seg: 14, rough: 0.6, flat: true, emissive: OR, emissiveIntensity: 0.10 })));
    inner.add(R3.ellipsoid(0.36, 0.33, 0.34, CREME, 0, 0.96, 0.48, M({ seg: 12, rough: 0.7, flat: true })));

    // --- 4 pattes (4) --------------------------------------------------------
    [[0.30, 0.48], [-0.30, 0.48], [0.32, -0.44], [-0.32, -0.44]].forEach(function (hp) {
      inner.add(post(hp[0], 1.02, hp[1], 0.115, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.10 }));
    });

    // --- Tête d'aigle (3 + 2 yeux) -------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.42, 0.34);
    inner.add(head);
    head.add(R3.ellipsoid(0.18, 0.24, 0.18, CREME, 0, 0.02, 0.02, M({ seg: 12, rough: 0.62, flat: true })));   // cou
    head.add(R3.ellipsoid(0.25, 0.23, 0.26, CREME, 0, 0.28, 0.18, M({ seg: 12, rough: 0.55, flat: true })));   // crâne
    const bec = R3.cone(0.11, 0.30, ORANGE, 0, 0.23, 0.44, M({ seg: 6, rough: 0.45, flat: true, emissive: ORANGE, emissiveIntensity: 0.22 }));
    bec.rotation.x = Math.PI / 2;
    head.add(bec);
    head.add(gemEyes(0.145, 0.31, 0.36, 0.08, { color: ORANGE, intensity: 1.7, tilt: 0.40 }));

    // --- L'AURÉOLE : 1 anneau + 5 rayons = 6 ---------------------------------
    // Elle est plantée derrière la nuque, pas au-dessus : c'est ce qui fait lire
    // « soleil levant derrière la tête » et non « ange de crèche ».
    const aureole = LL.halo(ORANGE, 0.54, 5, { color2: OR, plane: 'face', speed: 0.30, rayLen: 0.30, y: 1.66, z: -0.06 });
    inner.add(aureole);

    // --- Ailes de lumière : 2 lames chacune = 4 ------------------------------
    const wingR = shardWing(1.00, OR, { feathers: 1, height: 0.60, color2: CREME, glow: true, side: 1, x: 0.36, y: 1.20, z: -0.06 });
    const wingL = shardWing(1.00, OR, { feathers: 1, height: 0.60, color2: CREME, glow: true, side: -1, x: -0.36, y: 1.20, z: -0.06 });
    wingR.rotation.z = 0.24; wingL.rotation.z = 0.24;
    wingR.userData.p3wingBase = 0.24; wingL.userData.p3wingBase = 0.24;
    inner.add(wingR, wingL);

    // --- Aura en colonne : le repère qui perce la canopée (3) ----------------
    const aura = LL.aura(OR, 1.10, { shape: 'column', color2: ORANGE, rings: 0, particles: 0, height: 3.6 });
    g.add(aura);

    // anim.wingL/wingR volontairement à null : voir le bandeau (idle calme).
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Rayon solaire » : le griffon se cabre, ouvre grand ses ailes de
      // lumière et projette la tête en avant.
      const inn = root.userData.inner, k = arc(p);
      inn.rotation.x = -k * 0.26;
      inn.position.y = k * 0.12;
      inn.position.z = k * 0.34;
      head.rotation.x = -k * 0.32;
      wingR.rotation.z = 0.24 + k * 1.00;
      wingL.rotation.z = 0.24 + k * 1.00;
    };
    return finishLegendary(g, OR, ticks(
      calmWings([wingR, wingL], 0.14, 1.05),
      pulseFallbackAura(aura)
    ));
  });

  // ---------------------------------------------------------------------------
  //  SOLARIA — « phénix de lumière pure, plumes-rayons »   (braise)
  //  Verticale et élancée là où Auréol est trapu : c'est cette opposition qui
  //  permet de les distinguer d'un coup d'œil malgré la même palette dorée.
  //  Attributs distinctifs : AILES majestueuses + TRAÎNE de flammes (+ nimbe).
  //  Budget : 1 corps + 2 pattes + 1 cou + 1 crâne + 1 bec + 2 yeux
  //         + 4 nimbe + 6 ailes + 3 traîne + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('solaria', function () {
    const CREME = '#fff4d6', OR = '#ffe066', ROSE = '#ffaad8';
    const g = shell(), inner = g.userData.inner;

    // --- Corps vertical, en goutte (1) ---------------------------------------
    inner.add(R3.ellipsoid(0.30, 0.52, 0.34, CREME, 0, 1.16, 0, M({ seg: 14, rough: 0.5, flat: true, emissive: CREME, emissiveIntensity: 0.14 })));

    // --- 2 pattes fines (2) ---------------------------------------------------
    inner.add(post(0.15, 0.66, 0.02, 0.062, OR, { emissive: OR, emissiveIntensity: 0.18 }));
    inner.add(post(-0.15, 0.66, 0.02, 0.062, OR, { emissive: OR, emissiveIntensity: 0.18 }));

    // --- Cou, crâne, bec, yeux (3 + 2) ---------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0.04);
    inner.add(head);
    head.add(R3.ellipsoid(0.115, 0.28, 0.115, CREME, 0, 0.10, 0.04, M({ seg: 10, rough: 0.5, flat: true })));
    head.add(R3.ellipsoid(0.19, 0.18, 0.20, OR, 0, 0.38, 0.11, M({ seg: 12, rough: 0.45, flat: true, emissive: OR, emissiveIntensity: 0.20 })));
    const bec = R3.cone(0.06, 0.20, ROSE, 0, 0.34, 0.28, M({ seg: 6, rough: 0.4, flat: true, emissive: ROSE, emissiveIntensity: 0.30 }));
    bec.rotation.x = Math.PI / 2;
    head.add(bec);
    head.add(gemEyes(0.11, 0.40, 0.24, 0.062, { color: ROSE, intensity: 1.8, tilt: 0.30 }));

    // --- Nimbe : 1 anneau + 3 rayons = 4 -------------------------------------
    const nimbe = LL.halo(CREME, 0.34, 3, { color2: ROSE, plane: 'face', speed: -0.28, rayLen: 0.20, y: 1.94, z: -0.12 });
    inner.add(nimbe);

    // --- Grandes ailes déployées : 3 lames chacune = 6 -----------------------
    const wingR = shardWing(1.15, OR, { feathers: 2, height: 0.76, color2: CREME, glow: true, side: 1, x: 0.26, y: 1.28, z: -0.06 });
    const wingL = shardWing(1.15, OR, { feathers: 2, height: 0.76, color2: CREME, glow: true, side: -1, x: -0.26, y: 1.28, z: -0.06 });
    wingR.rotation.z = 0.34; wingL.rotation.z = 0.34;
    wingR.userData.p3wingBase = 0.34; wingL.userData.p3wingBase = 0.34;
    inner.add(wingR, wingL);

    // --- Traîne de flammes (3) ------------------------------------------------
    const tail = LL.plumeTail(1.20, OR, 3, { style: 'flame', color2: ROSE, droop: 0.26, amp: 0.16, speed: 1.1, y: 0.92, z: -0.28 });
    inner.add(tail);

    // --- Aura en colonne, plus fine et plus haute qu'Auréol (3) --------------
    const aura = LL.aura(OR, 1.05, { shape: 'column', color2: ROSE, rings: 0, particles: 0, height: 4.0 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Envol phénix » : bond vertical, ailes qui claquent, traîne qui suit.
      const inn = root.userData.inner, k = arc(p);
      inn.position.y = k * 0.32;
      inn.rotation.x = -k * 0.16;
      wingR.rotation.z = 0.34 + k * 1.05;
      wingL.rotation.z = 0.34 + k * 1.05;
      head.rotation.x = -k * 0.20;
    };
    return finishLegendary(g, OR, ticks(
      calmWings([wingR, wingL], 0.17, 0.95),
      pulseFallbackAura(aura)
    ));
  });

  // ---------------------------------------------------------------------------
  //  PRISMÉE — « papillon-prisme, ailes en arc-en-ciel »   (val)
  //  La seule des trois lumières qui FLOTTE, et la seule sans bec : quatre
  //  ailes de cristal translucides, une grappe de prismes sur le dos et un
  //  anneau d'étoiles taillées qui tourne autour d'elle.
  //  Attributs distinctifs : AILES + CRISTAUX + ANNEAUX en orbite.
  //  Budget : 1 thorax + 1 abdomen + 1 tête + 2 antennes + 2 yeux + 6 ailes
  //         + 3 cristaux + 4 anneau + 1 poussière + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('prismee', function () {
    const BLANC = '#f4f4f4', VIOLET = '#d896ff', CYAN = '#73eff7';
    const g = shell(), inner = g.userData.inner;

    // --- Corps fin, suspendu (2) ---------------------------------------------
    inner.add(R3.ellipsoid(0.14, 0.30, 0.15, BLANC, 0, 1.46, 0, M({ seg: 12, rough: 0.45, flat: true, emissive: BLANC, emissiveIntensity: 0.16 })));
    inner.add(R3.ellipsoid(0.11, 0.22, 0.11, VIOLET, 0, 1.12, -0.02, M({ seg: 10, rough: 0.45, flat: true, emissive: VIOLET, emissiveIntensity: 0.20 })));

    // --- Tête, antennes, yeux (1 + 2 + 2) ------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.80, 0.02);
    inner.add(head);
    head.add(R3.ellipsoid(0.14, 0.13, 0.14, BLANC, 0, 0, 0, M({ seg: 12, rough: 0.4, flat: true, emissive: BLANC, emissiveIntensity: 0.18 })));
    [-1, 1].forEach(function (s) {
      const a = R3.cyl(0.010, 0.022, 0.26, VIOLET, s * 0.07, 0.19, 0.02, M({ seg: 5, rough: 0.35, flat: true, emissive: VIOLET, emissiveIntensity: 0.55 }));
      a.rotation.z = -s * 0.55;
      head.add(a);
    });
    head.add(gemEyes(0.08, 0.01, 0.11, 0.05, { color: VIOLET, intensity: 1.9, tilt: 0.20 }));

    // --- 4 ailes de cristal translucides (2 + 2 + 1 + 1 = 6) ------------------
    // Paire haute large (2 lames chacune), paire basse courte (1 lame chacune).
    const wingR = shardWing(0.86, VIOLET, { feathers: 1, height: 0.68, color2: CYAN, glow: true, opacity: 0.62, side: 1, x: 0.06, y: 1.52, z: -0.02 });
    const wingL = shardWing(0.86, VIOLET, { feathers: 1, height: 0.68, color2: CYAN, glow: true, opacity: 0.62, side: -1, x: -0.06, y: 1.52, z: -0.02 });
    const wingR2 = shardWing(0.52, CYAN, { feathers: 0, height: 0.46, color2: VIOLET, glow: true, opacity: 0.58, side: 1, x: 0.06, y: 1.22, z: -0.08 });
    const wingL2 = shardWing(0.52, CYAN, { feathers: 0, height: 0.46, color2: VIOLET, glow: true, opacity: 0.58, side: -1, x: -0.06, y: 1.22, z: -0.08 });
    wingR.rotation.z = 0.32; wingL.rotation.z = 0.32;
    wingR.userData.p3wingBase = 0.32; wingL.userData.p3wingBase = 0.32;
    wingR2.rotation.z = -0.10; wingL2.rotation.z = -0.10;
    wingR2.userData.p3wingBase = -0.10; wingL2.userData.p3wingBase = -0.10;
    inner.add(wingR, wingL, wingR2, wingL2);

    // --- Grappe de prismes sur le dos (3) ------------------------------------
    const prismes = LL.crystalCluster(CYAN, 3, 0.19, { base: false, glow: false, tipColor: VIOLET, opacity: 0.8, spread: 0.9, y: 1.56, z: -0.12 });
    inner.add(prismes);

    // --- Anneau d'étoiles taillées (4) ---------------------------------------
    const anneau = LL.orbitRing(BLANC, 0.64, 4, { shape: 'star', size: 0.085, tilt: 0.55, speed: 0.45, glow: true, wobble: 0.18, y: 1.46 });
    inner.add(anneau);

    // --- Poussière de prisme : 1 seul draw call pour 18 points ---------------
    inner.add(LL.starfield(CYAN, 18, 0.78, { color2: VIOLET, spread: 'shell', size: 0.07, seed: 31, y: 1.46 }));

    // --- Aura discrète : une fée, pas un mur de lumière (3) ------------------
    const aura = LL.aura(VIOLET, 0.95, { shape: 'sphere', color2: CYAN, rings: 0, particles: 0, y0: 1.40 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Éclat prisme » : les 4 ailes s'ouvrent en grand et le corps tournoie.
      const inn = root.userData.inner, k = arc(p);
      inn.position.y = k * 0.20;
      inn.rotation.y = R3.clamp01(p) * Math.PI * 2;
      wingR.rotation.z = 0.32 + k * 0.85; wingL.rotation.z = 0.32 + k * 0.85;
      wingR2.rotation.z = -0.10 + k * 0.70; wingL2.rotation.z = -0.10 + k * 0.70;
      if (p >= 1) inn.rotation.y = 0;
    };
    return finishLegendary(g, VIOLET, ticks(
      calmWings([wingR, wingL], 0.22, 1.35),
      calmWings([wingR2, wingL2], 0.18, 1.35),
      pulseFallbackAura(aura)
    ));
  });

  // =============================================================================
  //  TYPE OMBRE — nyxaroth · penombra · eclipsion
  //  Consigne : impressionnants, JAMAIS effrayants (public 10 ans). Les corps
  //  sont sombres mais arrondis, et chaque créature porte un accent chaud
  //  (rose, or, cyan) qui réchauffe l'ensemble. Le regard est brillant, jamais
  //  vide : ce sont les YEUX qu'on lit en premier sur une silhouette noire.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  NYXAROTH — « loup des ténèbres, fumée aux pattes »   (sylve)
  //  Le seul des trois ombres qui touche vraiment le sol de tout son corps
  //  (Pénombra flotte, Éclipsion vole). Crête de cristaux d'ombre sur la nuque,
  //  traîne de fumée en guise de queue, volutes autour des pattes avant.
  //  Attributs distinctifs : CRISTAUX (crête) + TRAÎNE.
  //  Budget : 1 corps + 1 poitrail + 4 pattes + 1 crâne + 1 museau + 2 oreilles
  //         + 2 yeux + 3 crête + 3 traîne + 2 fumée + 4 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('nyxaroth', function () {
    const NOIR = '#2a2438', VIOLET = '#7a5cbf', ROSE = '#ff6b9d';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de loup (2) ----------------------------------------------------
    inner.add(R3.ellipsoid(0.42, 0.44, 0.78, NOIR, 0, 1.06, 0, M({ seg: 14, rough: 0.66, flat: true })));
    inner.add(R3.ellipsoid(0.30, 0.26, 0.38, VIOLET, 0, 0.90, 0.40, M({ seg: 12, rough: 0.8, flat: true })));

    // --- 4 pattes (4) ---------------------------------------------------------
    [[0.30, 0.56], [-0.30, 0.56], [0.30, -0.54], [-0.30, -0.54]].forEach(function (hp) {
      inner.add(post(hp[0], 1.04, hp[1], 0.12, NOIR));
    });

    // --- Tête (2 + 2 oreilles + 2 yeux) --------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.36, 0.54);
    inner.add(head);
    head.add(R3.ellipsoid(0.30, 0.28, 0.35, NOIR, 0, 0, 0, M({ seg: 12, rough: 0.66, flat: true })));
    head.add(R3.ellipsoid(0.16, 0.13, 0.21, VIOLET, 0, -0.12, 0.30, M({ seg: 10, rough: 0.8, flat: true })));
    [-1, 1].forEach(function (s) {
      const or = R3.cone(0.11, 0.28, NOIR, s * 0.17, 0.34, -0.02, M({ seg: 4, rough: 0.66, flat: true }));
      or.rotation.x = 0.22;
      or.rotation.z = s * 0.20;
      head.add(or);
    });
    // Regard rose chaleureux : c'est LUI qui empêche le loup d'ombre de faire peur.
    head.add(gemEyes(0.165, 0.04, 0.26, 0.085, { color: ROSE, intensity: 1.9, tilt: 0.32 }));

    // --- Crête de cristaux d'ombre le long de la nuque (3) -------------------
    const crete = LL.crystalCluster(VIOLET, 3, 0.22, { base: false, glow: false, tipColor: ROSE, spread: 0.55, y: 1.44, z: -0.02 });
    inner.add(crete);

    // --- Traîne de fumée en guise de queue (3) -------------------------------
    const tail = LL.plumeTail(1.10, VIOLET, 3, { style: 'flame', color2: ROSE, droop: 0.20, amp: 0.18, speed: 1.0, y: 1.14, z: -0.74 });
    inner.add(tail);

    // --- Fumée aux pattes avant, comme demandé par le contrat (2) ------------
    inner.add(LL.mistPuff(VIOLET, 0.34, 2, { color2: ROSE, opacity: 0.30, ry: 0.5, speed: 0.4, y: 0.16, z: 0.46 }));

    // --- Aura sombre à un anneau (4) -----------------------------------------
    const aura = LL.aura(NOIR, 1.20, { shape: 'sphere', color2: VIOLET, rings: 1, particles: 0, y0: 1.05 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Bond des ombres » : il se ramasse puis fonce, gueule en avant.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.55;
      inn.position.y = k * 0.09;
      inn.rotation.x = -k * 0.20;
      head.rotation.x = -k * 0.30;
    };
    return finishLegendary(g, VIOLET, pulseFallbackAura(aura));
  });

  // ---------------------------------------------------------------------------
  //  PÉNOMBRA — « chat-fantôme translucide, queue vaporeuse »   (val)
  //  Corps translucide qui flotte, cœur lumineux visible AU TRAVERS du corps
  //  (c'est la trouvaille qui la rend inoubliable), collier d'orbes qui tourne
  //  autour du poitrail, longue queue-ruban qui ondule au lieu de fouetter.
  //  Attributs distinctifs : CŒUR LUMINEUX + ANNEAUX en orbite + TRAÎNE.
  //  Budget : 1 corps + 1 crâne + 2 oreilles + 2 yeux + 3 cœur + 4 collier
  //         + 5 queue + 3 brume + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('penombra', function () {
    const FONCE = '#4a3d6b', CLAIR = '#a99bd6', CYAN = '#73eff7';
    const g = shell(), inner = g.userData.inner;
    const T = { seg: 12, rough: 0.3, flat: true, transparent: true, opacity: 0.52, side: THREE.DoubleSide, emissive: CLAIR, emissiveIntensity: 0.3, depthWrite: false };

    // --- Corps translucide (1) ------------------------------------------------
    inner.add(R3.ellipsoid(0.32, 0.32, 0.56, CLAIR, 0, 1.26, 0, M(T)));

    // --- Tête (1 + 2 oreilles + 2 yeux) --------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.66, 0.36);
    inner.add(head);
    head.add(R3.ellipsoid(0.26, 0.24, 0.28, CLAIR, 0, 0, 0, M(T)));
    [-1, 1].forEach(function (s) {
      const or = R3.cone(0.10, 0.24, FONCE, s * 0.15, 0.26, -0.02, M({ seg: 4, rough: 0.3, flat: true, transparent: true, opacity: 0.62, side: THREE.DoubleSide, emissive: FONCE, emissiveIntensity: 0.35, depthWrite: false }));
      or.rotation.z = s * 0.24;
      head.add(or);
    });
    head.add(gemEyes(0.13, 0.01, 0.24, 0.075, { color: CYAN, intensity: 2.0, tilt: 0.22 }));

    // --- Cœur lumineux, vu au travers du corps translucide (3) ---------------
    inner.add(LL.glowCore(CYAN, 0.14, { color2: CLAIR, speed: 1.6, y: 1.26, z: 0.16 }));

    // --- Collier d'orbes en orbite (4) ---------------------------------------
    const collier = LL.orbitRing(CYAN, 0.46, 4, { shape: 'sphere', size: 0.11, tilt: 0.62, speed: 0.38, glow: true, wobble: 0.14, y: 1.34, z: 0.06 });
    inner.add(collier);

    // --- Queue-ruban : elle ONDULE (flowRibbon), elle ne fouette pas (5) -----
    const tail = LL.flowRibbon(1.05, CYAN, { color2: CLAIR, opacity: 0.48, segments: 5, amp: 0.16, speed: 1.15, y: 1.28, z: -0.42 });
    inner.add(tail);

    // --- Volutes de brume à la place des pattes (3) --------------------------
    inner.add(LL.mistPuff(CLAIR, 0.40, 3, { color2: FONCE, opacity: 0.26, ry: 0.45, speed: 0.35, y: 0.20 }));

    // --- Aura (3) -------------------------------------------------------------
    const aura = LL.aura(FONCE, 1.00, { shape: 'sphere', color2: CYAN, rings: 0, particles: 0, intensity: 1.3, y0: 1.15 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Traversée spectrale » : le corps s'estompe, glisse en avant, puis
      // réapparaît de l'autre côté.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.60;
      inn.position.x = Math.sin(R3.clamp01(p) * Math.PI * 2) * 0.16;
      inn.scale.setScalar(1 - k * 0.24);
      head.rotation.y = k * 0.40;
    };
    return finishLegendary(g, FONCE, pulseFallbackAura(aura));
  });

  // ---------------------------------------------------------------------------
  //  ÉCLIPSION — « corbeau d'éclipse, anneau noir au dos »   (givre)
  //  Le seul des trois qui vole. Dans son dos, un disque noir cerclé de lumière
  //  — une éclipse miniature — autour duquel tournent trois éclats dorés.
  //  Attributs distinctifs : ANNEAU/COURONNE (éclipse) + ANNEAUX en orbite
  //  + AILES.
  //  Budget : 1 corps + 2 pattes + 1 cou + 1 crâne + 1 bec + 2 yeux
  //         + 2 éclipse + 3 éclats + 6 ailes + 2 queue + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('eclipsion', function () {
    const NOIR = '#1a1c2c', VIOLET = '#7a5cbf', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;

    // --- Corps d'oiseau (1) + 2 pattes ---------------------------------------
    inner.add(R3.ellipsoid(0.28, 0.36, 0.64, NOIR, 0, 1.20, 0, M({ seg: 14, rough: 0.5, flat: true })));
    inner.add(post(0.14, 0.76, 0.02, 0.06, VIOLET, { emissive: VIOLET, emissiveIntensity: 0.18 }));
    inner.add(post(-0.14, 0.76, 0.02, 0.06, VIOLET, { emissive: VIOLET, emissiveIntensity: 0.18 }));

    // --- Tête (3 + 2 yeux) ----------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.58, 0.28);
    inner.add(head);
    head.add(R3.ellipsoid(0.13, 0.18, 0.15, NOIR, 0, 0.06, 0.04, M({ seg: 10, rough: 0.5, flat: true })));
    head.add(R3.ellipsoid(0.22, 0.21, 0.23, NOIR, 0, 0.32, 0.16, M({ seg: 12, rough: 0.5, flat: true })));
    const bec = R3.cone(0.075, 0.30, OR, 0, 0.28, 0.40, M({ seg: 4, rough: 0.4, flat: true, emissive: OR, emissiveIntensity: 0.32 }));
    bec.rotation.x = Math.PI / 2;
    head.add(bec);
    head.add(gemEyes(0.115, 0.35, 0.30, 0.065, { color: OR, intensity: 2.0, tilt: 0.42 }));

    // --- L'ÉCLIPSE dans le dos : anneau + disque plein (2) -------------------
    // Un halo à ZÉRO rayon avec un disque : c'est exactement un disque occulté
    // cerclé de lumière. La primitive du lot L1 le fait pour 2 draw calls.
    const eclipse = LL.halo(NOIR, 0.62, 0, { color2: VIOLET, solid: true, plane: 'face', speed: 0.18, y: 1.34, z: -0.46 });
    inner.add(eclipse);

    // --- Éclats dorés en couronne autour de l'éclipse (3) -------------------
    const eclats = LL.orbitRing(OR, 0.70, 3, { shape: 'shard', size: 0.11, tilt: 1.45, speed: 0.42, glow: true, wobble: 0.10, y: 1.34, z: -0.46 });
    inner.add(eclats);

    // --- Ailes de corbeau : 3 lames chacune = 6 ------------------------------
    const wingR = shardWing(1.18, NOIR, { feathers: 2, height: 0.66, color2: VIOLET, side: 1, x: 0.26, y: 1.34, z: -0.06 });
    const wingL = shardWing(1.18, NOIR, { feathers: 2, height: 0.66, color2: VIOLET, side: -1, x: -0.26, y: 1.34, z: -0.06 });
    wingR.rotation.z = 0.18; wingL.rotation.z = 0.18;
    wingR.userData.p3wingBase = 0.18; wingL.userData.p3wingBase = 0.18;
    inner.add(wingR, wingL);

    // --- Queue courte (2) -----------------------------------------------------
    inner.add(LL.plumeTail(0.52, NOIR, 2, { style: 'feather', color2: VIOLET, droop: 0.10, amp: 0.12, speed: 1.0, y: 1.10, z: -0.56 }));

    // --- Aura (3) -------------------------------------------------------------
    const aura = LL.aura(NOIR, 1.10, { shape: 'sphere', color2: VIOLET, rings: 0, particles: 0, y0: 1.20 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Éclipse totale » : plongée, l'anneau du dos s'aligne face à
      // l'adversaire, les ailes se replient puis claquent.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.52;
      inn.position.y = -k * 0.10;
      wingR.rotation.z = 0.18 - k * 0.62;
      wingL.rotation.z = 0.18 - k * 0.62;
      eclipse.rotation.y = R3.clamp01(p) * Math.PI;
      head.rotation.x = k * 0.24;
    };
    return finishLegendary(g, VIOLET, ticks(
      calmWings([wingR, wingL], 0.13, 1.0),
      pulseFallbackAura(aura)
    ));
  });

  // =============================================================================
  //  TYPE TEMPS — chronoss · eternia · sablion
  //  « L'entité du temps couronnée d'anneaux » : les trois portent au moins un
  //  anneau de fragments en orbite, qui tourne lentement — le mouvement le plus
  //  lisible qui soit pour dire « temps » sans écrire un mot.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  CHRONOSS — « tortue-horloge, cadran sur la carapace »   (aurore)
  //  Basse et trapue, mais surmontée d'une tour d'horloge : c'est la tour qui
  //  lui donne sa stature de légendaire alors que la tortue reste au ras du sol.
  //  Attributs distinctifs : ANNEAUX en orbite + CRISTAUX (couronne de la tour).
  //  Budget : 1 corps + 4 pattes + 1 tête + 2 yeux + 4 carapace + 1 tour
  //         + 4 cadran + 2 couronne + 3 anneaux + 2 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('chronoss', function () {
    const VIOLET = '#d896ff', BRONZE = '#c8a06a', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;

    // --- Socle de tortue (1 + 4 pattes) --------------------------------------
    inner.add(R3.ellipsoid(0.48, 0.26, 0.60, VIOLET, 0, 0.36, 0, M({ seg: 14, rough: 0.62, flat: true })));
    [[0.36, 0.40], [-0.36, 0.40], [0.36, -0.40], [-0.36, -0.40]].forEach(function (hp) {
      inner.add(post(hp[0], 0.30, hp[1], 0.14, BRONZE));
    });

    // --- Tête (1 + 2 yeux) ----------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.46, 0.62);
    inner.add(head);
    head.add(R3.ellipsoid(0.16, 0.15, 0.18, VIOLET, 0, 0, 0.04, M({ seg: 10, rough: 0.62, flat: true })));
    head.add(gemEyes(0.09, 0.03, 0.15, 0.05, { color: OR, intensity: 1.8, tilt: 0.18 }));

    // --- Carapace à dalles (1 dôme + 3 dalles = 4) ---------------------------
    inner.add(LL.plateShell(0.54, BRONZE, { plates: 3, rim: false, plateColor: VIOLET, h: 0.34, flat: true, y: 0.46 }));

    // --- Tour d'horloge (1) ---------------------------------------------------
    // C'est elle qui fait passer Chronoss de 0,9 à 2,1 unités de haut.
    inner.add(R3.cyl(0.19, 0.30, 0.98, BRONZE, 0, 1.28, 0, M({ seg: 8, rough: 0.5, flat: true, emissive: BRONZE, emissiveIntensity: 0.10 })));

    // --- Le cadran, plaqué sur la tour (4) -----------------------------------
    const cadran = LL.clockFace(0.26, VIOLET, { rimColor: BRONZE, handColor: OR, marks: 0, speed: 0.22, plane: 'face', y: 1.44, z: 0.24 });
    inner.add(cadran);

    // --- Couronne de cristaux au sommet de la tour (2) -----------------------
    inner.add(LL.crystalCluster(OR, 2, 0.20, { base: false, glow: false, tipColor: VIOLET, spread: 0.8, y: 1.78 }));

    // --- Anneaux de rouages en orbite (3) ------------------------------------
    const anneaux = LL.orbitRing(OR, 0.66, 3, { shape: 'stone', size: 0.13, tilt: 0.26, speed: 0.24, glow: true, wobble: 0.10, y: 1.50 });
    inner.add(anneaux);

    // --- Aura au sol : Chronoss est lent, son aura reste posée (2) -----------
    const aura = LL.aura(VIOLET, 1.05, { shape: 'disc', color2: OR, rings: 0, particles: 0 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Fissure du temps » : la tour s'avance par à-coups, comme une
      // trotteuse, et le cadran fait un tour complet à l'impact.
      const inn = root.userData.inner, k = arc(p);
      const cran = Math.round(R3.clamp01(p) * 6) / 6;     // saccadé, pas fluide
      inn.position.z = cran * 0.30;
      head.position.z = 0.62 + k * 0.12;
      cadran.rotation.z = R3.clamp01(p) * Math.PI * 2;
    };
    return finishLegendary(g, VIOLET, pulseFallbackAura(aura));
  });

  // ---------------------------------------------------------------------------
  //  ÉTERNIA — « sphinx du temps, sabliers suspendus »   (aurore)
  //  La plus régalienne du lot : posture assise de sphinx, coiffe à rabats,
  //  couronne à rayons posée à plat sur la tête, et trois pierres-sabliers qui
  //  tournent très lentement autour d'elle.
  //  Attributs distinctifs : COURONNE + ANNEAUX en orbite + TRAÎNE.
  //  Budget : 1 corps + 4 pattes + 1 cou + 1 crâne + 2 rabats + 2 yeux
  //         + 4 couronne + 3 sabliers + 3 traîne + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('eternia', function () {
    const SABLE = '#e3c68d', VIOLET = '#d896ff', BLEU = '#4b62d9';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de sphinx assis (1) -------------------------------------------
    inner.add(R3.ellipsoid(0.46, 0.44, 0.70, SABLE, 0, 0.92, 0, M({ seg: 14, rough: 0.5, flat: true })));

    // --- Pattes avant tendues, pattes arrière repliées (4) -------------------
    inner.add(post(0.24, 0.90, 0.58, 0.115, SABLE));
    inner.add(post(-0.24, 0.90, 0.58, 0.115, SABLE));
    inner.add(post(0.30, 0.62, -0.46, 0.145, SABLE));
    inner.add(post(-0.30, 0.62, -0.46, 0.145, SABLE));

    // --- Tête noble et sa coiffe (2 + 2 rabats + 2 yeux) --------------------
    const head = new THREE.Group();
    head.position.set(0, 1.42, 0.34);
    inner.add(head);
    head.add(R3.ellipsoid(0.16, 0.22, 0.16, SABLE, 0, 0.06, 0.06, M({ seg: 10, rough: 0.5, flat: true })));
    head.add(R3.ellipsoid(0.28, 0.27, 0.29, SABLE, 0, 0.36, 0.20, M({ seg: 12, rough: 0.45, flat: true })));
    [-1, 1].forEach(function (s) {
      const rabat = R3.ellipsoid(0.06, 0.28, 0.15, VIOLET, s * 0.26, 0.26, 0.06, M({ seg: 8, rough: 0.45, flat: true, emissive: VIOLET, emissiveIntensity: 0.20 }));
      rabat.rotation.z = s * 0.16;
      head.add(rabat);
    });
    head.add(gemEyes(0.14, 0.37, 0.30, 0.075, { color: BLEU, intensity: 1.7, tilt: 0.36 }));

    // --- Couronne posée à plat sur la coiffe (1 anneau + 3 rayons = 4) -------
    inner.add(LL.halo(BLEU, 0.30, 3, { color2: VIOLET, plane: 'flat', speed: 0.26, rayLen: 0.20, tube: 0.045, y: 2.00 }));

    // --- Les « sabliers » : 3 pierres-temps en orbite lente (3) --------------
    const sabliers = LL.orbitRing(BLEU, 0.95, 3, { shape: 'stone', size: 0.20, tilt: 0.42, speed: 0.20, glow: true, wobble: 0.16, y: 1.55 });
    inner.add(sabliers);

    // --- Traîne de plumes de temps (3) ---------------------------------------
    inner.add(LL.plumeTail(0.80, VIOLET, 3, { style: 'feather', color2: BLEU, droop: 0.14, amp: 0.14, speed: 0.9, y: 0.86, z: -0.66 }));

    // --- Aura en colonne : l'éternité qui monte au ciel (3) ------------------
    const aura = LL.aura(SABLE, 1.15, { shape: 'column', color2: VIOLET, rings: 0, particles: 0, height: 3.8 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Remonter le temps » : la tête se redresse, les sabliers se resserrent
      // brutalement autour du corps avant de repartir en orbite.
      const inn = root.userData.inner, k = arc(p);
      head.rotation.x = -k * 0.26;
      inn.position.y = k * 0.15;
      sabliers.scale.setScalar(1 - k * 0.38);
    };
    return finishLegendary(g, VIOLET, pulseFallbackAura(aura));
  });

  // ---------------------------------------------------------------------------
  //  SABLION — « serpent de sable, corps qui s'écoule »   (sylve)
  //  Silhouette serpentine cabrée, capuchon de cobra, cristaux de sable figé
  //  sur la nuque, et un anneau d'éclats qui tourne à mi-hauteur. Le sable qui
  //  s'écoule est une nuée de points : 1 seul draw call pour 22 grains.
  //  Attributs distinctifs : CRISTAUX + ANNEAUX en orbite.
  //  Budget : 9 corps + 1 tête + 2 capuchon + 2 yeux + 3 cristaux
  //         + 3 anneau + 1 sable + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('sablion', function () {
    const SABLE = '#e3c68d', BRUN = '#c08c4a', VIOLET = '#d896ff';
    const g = shell(), inner = g.userData.inner;

    // --- Corps serpentin cabré (9) -------------------------------------------
    // `rise` fait remonter chaque anneau : le corps se dresse au lieu de ramper.
    inner.add(LL.serpentBody(2.15, SABLE, {
      segments: 9, r: 0.23, taper: 0.70, color2: BRUN, rise: 0.34,
      amp: 0.20, speed: 0.9, y: 1.70, z: 0.32,
    }));

    // --- Tête à capuchon (1 + 2 + 2 yeux) ------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.70, 0.50);
    inner.add(head);
    head.add(R3.ellipsoid(0.25, 0.21, 0.28, VIOLET, 0, 0, 0, M({ seg: 12, rough: 0.45, flat: true, emissive: VIOLET, emissiveIntensity: 0.16 })));
    [-1, 1].forEach(function (s) {
      const aile = R3.ellipsoid(0.17, 0.13, 0.04, SABLE, s * 0.23, 0.02, -0.02, M({ seg: 8, rough: 0.7, flat: true, side: THREE.DoubleSide }));
      aile.rotation.y = s * 0.62;
      head.add(aile);
    });
    head.add(gemEyes(0.125, 0.06, 0.22, 0.065, { color: VIOLET, intensity: 2.0, tilt: 0.44 }));

    // --- Cristaux de sable figé sur la nuque (3) -----------------------------
    inner.add(LL.crystalCluster(VIOLET, 3, 0.17, { base: false, glow: false, tipColor: SABLE, spread: 0.7, y: 1.76, z: 0.10 }));

    // --- Anneau d'éclats du temps (3) ----------------------------------------
    const anneau = LL.orbitRing(VIOLET, 0.80, 3, { shape: 'shard', size: 0.15, tilt: 0.34, speed: 0.28, glow: true, wobble: 0.14, y: 1.30, z: 0.10 });
    inner.add(anneau);

    // --- Le sable qui s'écoule : 22 grains, 1 draw call ----------------------
    inner.add(LL.starfield(BRUN, 22, 1.30, { color2: SABLE, spread: 'spiral', size: 0.09, ry: 0.25, seed: 17, y: 0.28, z: -0.45 }));

    // --- Aura basse, en flaque de sable (3) ----------------------------------
    const aura = LL.aura(SABLE, 1.10, { shape: 'disc', color2: VIOLET, rings: 1, particles: 0 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Vague de sable » : le corps entier ondule fort et la tête frappe.
      const inn = root.userData.inner, k = arc(p);
      head.position.z = 0.50 + k * 0.58;
      head.position.y = 1.70 - k * 0.16;
      inn.rotation.z = Math.sin(R3.clamp01(p) * Math.PI * 3) * 0.12 * (1 - k * 0.4);
    };
    return finishLegendary(g, VIOLET, pulseFallbackAura(aura));
  });

  // =============================================================================
  //  TYPE ESPACE — vortexis · astralis · nebulon
  //  « Le seigneur de l'espace aux plaques cristallines » : les trois portent
  //  une grappe de cristaux et une nuée d'étoiles. Le starfield est le meilleur
  //  rapport spectacle/coût du moteur — 1 draw call pour 20 à 30 points — et
  //  c'est ce qui permet à ces trois-là d'en imposer dans 24 draw calls.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  VORTEXIS — « raie-galaxie, spirale d'étoiles »   (aurore)
  //  Silhouette plate et rapide, deux immenses ailes-nageoires en éclats, une
  //  crête de plaques cristallines sur le dos, une longue queue-ruban qui plonge
  //  vers le sol et une spirale de galaxie qui tourne sous elle.
  //  Attributs distinctifs : AILES + CRISTAUX + ANNEAUX + TRAÎNE.
  //  Budget : 1 corps + 1 dos + 2 lobes + 2 yeux + 4 ailes + 3 cristaux
  //         + 4 queue + 3 anneau + 1 spirale + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('vortexis', function () {
    const BLEU = '#4b62d9', NOIR = '#1a1c2c', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de raie, très plat (2) ----------------------------------------
    inner.add(R3.ellipsoid(0.52, 0.17, 0.74, NOIR, 0, 1.58, 0, M({ seg: 14, rough: 0.45, flat: true })));
    inner.add(R3.ellipsoid(0.40, 0.11, 0.56, BLEU, 0, 1.66, 0.08, M({ seg: 12, rough: 0.5, flat: true, emissive: BLEU, emissiveIntensity: 0.18 })));

    // --- Lobes céphaliques (2) + yeux (2) ------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.58, 0.52);
    inner.add(head);
    [-1, 1].forEach(function (s) {
      const lobe = R3.cone(0.06, 0.28, BLEU, s * 0.17, 0.08, 0.16, M({ seg: 4, rough: 0.45, flat: true, emissive: BLEU, emissiveIntensity: 0.22 }));
      lobe.rotation.x = Math.PI / 2 - 0.55;
      lobe.rotation.z = s * 0.22;
      head.add(lobe);
    });
    head.add(gemEyes(0.19, 0.01, 0.10, 0.065, { color: BLANC, intensity: 2.0, tilt: 0.30 }));

    // --- Ailes-nageoires : 2 lames chacune = 4 -------------------------------
    const wingR = shardWing(1.35, NOIR, { feathers: 1, height: 0.62, color2: BLEU, side: 1, x: 0.10, y: 1.56, z: -0.04, flatten: 0.14 });
    const wingL = shardWing(1.35, NOIR, { feathers: 1, height: 0.62, color2: BLEU, side: -1, x: -0.10, y: 1.56, z: -0.04, flatten: 0.14 });
    wingR.rotation.z = 0.06; wingL.rotation.z = 0.06;
    wingR.userData.p3wingBase = 0.06; wingL.userData.p3wingBase = 0.06;
    inner.add(wingR, wingL);

    // --- Plaques cristallines sur le dos (3) ---------------------------------
    inner.add(LL.crystalCluster(BLANC, 3, 0.18, { base: false, glow: false, tipColor: BLEU, spread: 0.9, y: 1.70, z: -0.10 }));

    // --- Queue-ruban qui plonge (4) ------------------------------------------
    // C'est elle qui donne sa hauteur à Vortexis : une raie à plat resterait
    // basse et se lirait mal de loin.
    const queue = LL.flowRibbon(1.45, BLEU, { color2: NOIR, opacity: 0.85, segments: 4, amp: 0.20, speed: 1.2, y: 1.58, z: -0.72 });
    queue.rotation.x = -1.25;
    inner.add(queue);

    // --- Anneau d'étoiles (3) -------------------------------------------------
    inner.add(LL.orbitRing(BLANC, 0.88, 3, { shape: 'star', size: 0.11, tilt: 0.30, speed: 0.50, glow: true, wobble: 0.12, y: 1.40 }));

    // --- La spirale de galaxie : 26 points, 1 draw call ----------------------
    inner.add(LL.starfield(BLANC, 26, 1.45, { color2: BLEU, spread: 'spiral', size: 0.10, ry: 0.30, seed: 5, y: 1.28 }));

    // --- Aura (3) -------------------------------------------------------------
    const aura = LL.aura(BLEU, 1.25, { shape: 'sphere', color2: NOIR, rings: 0, particles: 0, y0: 1.30 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Spirale galactique » : elle pique, effectue une vrille complète,
      // puis se stabilise.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.52;
      inn.rotation.z = R3.clamp01(p) * Math.PI * 2;
      wingR.rotation.z = 0.06 + k * 0.68;
      wingL.rotation.z = 0.06 + k * 0.68;
      if (p >= 1) inn.rotation.z = 0;
    };
    return finishLegendary(g, BLEU, ticks(
      calmWings([wingR, wingL], 0.10, 0.85),
      pulseFallbackAura(aura)
    ));
  });

  // ---------------------------------------------------------------------------
  //  ASTRALIS — « baleine stellaire, constellations »   (aurore)
  //  La plus grande et la plus lente du lot : un long corps rond qui plane,
  //  une crête de cristaux sur le dos, deux nuées d'étoiles (les constellations
  //  sur la peau, et le sillage derrière) et un anneau d'astres très lent.
  //  Attributs distinctifs : CRISTAUX + ANNEAUX en orbite.
  //  Budget : 1 corps + 1 ventre + 1 museau + 2 yeux + 1 aileron + 2 nageoires
  //         + 3 caudale + 3 cristaux + 3 anneau + 2 étoiles + 3 aura
  //         = 22 draw calls (la marge du lot).
  // ---------------------------------------------------------------------------
  R3.registerCreature('astralis', function () {
    const NUIT = '#29366f', BLEU = '#4b62d9', JAUNE = '#fcef8d';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de baleine (3) -------------------------------------------------
    inner.add(R3.ellipsoid(0.47, 0.64, 1.04, NUIT, 0, 1.58, 0, M({ seg: 14, rough: 0.45, flat: true })));
    inner.add(R3.ellipsoid(0.35, 0.37, 0.58, BLEU, 0, 1.36, 0.30, M({ seg: 12, rough: 0.55, flat: true, emissive: BLEU, emissiveIntensity: 0.14 })));
    inner.add(R3.ellipsoid(0.37, 0.37, 0.38, NUIT, 0, 1.60, 1.06, M({ seg: 12, rough: 0.45, flat: true })));

    // --- Yeux (2) -------------------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.64, 1.18);
    inner.add(head);
    head.add(gemEyes(0.27, 0.0, 0.10, 0.075, { color: JAUNE, intensity: 1.9, tilt: 0.22 }));

    // --- Aileron dorsal cristallin (1) ---------------------------------------
    inner.add(R3.cone(0.14, 0.68, BLEU, 0, 2.06, 0.28, M({ seg: 4, rough: 0.4, flat: true, emissive: BLEU, emissiveIntensity: 0.25 })));

    // --- Nageoires pectorales, 1 mesh chacune (2) ----------------------------
    [-1, 1].forEach(function (s) {
      const nag = R3.cone(0.20, 0.62, BLEU, s * 0.52, 1.10, 0.16, M({ seg: 4, rough: 0.45, flat: true, emissive: BLEU, emissiveIntensity: 0.18 }));
      nag.rotation.z = -s * (Math.PI / 2 - 0.5);
      nag.scale.z = 0.20;
      inner.add(nag);
    });

    // --- Nageoire caudale (3) -------------------------------------------------
    const tail = new THREE.Group();
    tail.position.set(0, 1.38, -1.08);
    inner.add(tail);
    tail.add(R3.cyl(0.11, 0.18, 0.46, NUIT, 0, 0, -0.20, M({ seg: 8, rough: 0.5, flat: true })));
    [-1, 1].forEach(function (s) {
      const lobe = R3.ellipsoid(0.36, 0.06, 0.22, BLEU, s * 0.30, 0, -0.44, M({ seg: 10, rough: 0.5, flat: true, emissive: BLEU, emissiveIntensity: 0.16 }));
      lobe.rotation.y = s * 0.36;
      tail.add(lobe);
    });

    // --- Crête de cristaux sur le dos (3) ------------------------------------
    inner.add(LL.crystalCluster(BLEU, 3, 0.20, { base: false, glow: false, tipColor: JAUNE, spread: 0.5, y: 1.98, z: -0.35 }));

    // --- Anneau d'astres, très lent (3) --------------------------------------
    inner.add(LL.orbitRing(JAUNE, 1.05, 3, { shape: 'star', size: 0.13, tilt: 0.26, speed: 0.16, glow: true, wobble: 0.18, y: 1.55 }));

    // --- Constellations sur la peau + sillage (2 draw calls, 48 points) ------
    inner.add(LL.starfield(JAUNE, 30, 0.95, { color2: BLEU, spread: 'shell', size: 0.075, ry: 0.85, seed: 9, y: 1.58, z: 0.08 }));
    inner.add(LL.starfield(BLEU, 18, 1.60, { color2: JAUNE, spread: 'ball', size: 0.09, ry: 0.5, seed: 23, y: 1.36, z: -0.95 }));

    // --- Aura en colonne : elle domine le ciel, visible de très loin (3) -----
    const aura = LL.aura(NUIT, 1.35, { shape: 'column', color2: BLEU, rings: 0, particles: 0, height: 4.2 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tail, float: true };
    g.userData.attack = function (root, p) {
      // « Chant stellaire » : la baleine ondule lentement de tout son long.
      const inn = root.userData.inner, k = arc(p);
      inn.rotation.z = Math.sin(R3.clamp01(p) * Math.PI * 1.5) * 0.10;
      inn.position.y = k * 0.18;
      inn.position.z = k * 0.22;
    };
    return finishLegendary(g, BLEU, pulseFallbackAura(aura));
  });

  // ---------------------------------------------------------------------------
  //  NÉBULON — « méduse-nébuleuse, voile de gaz coloré »   (saphir)
  //  La plus verticale et la plus molle du lot : une cloche translucide très
  //  haut perchée, un bourrelet lumineux à son bord, une couronne de cristaux
  //  au sommet et trois longs tentacules-rubans qui ondulent jusqu'au sol.
  //  Attributs distinctifs : TRAÎNE (tentacules) + CRISTAUX + ANNEAUX.
  //  Budget : 1 cloche + 1 doublure + 1 bourrelet + 2 yeux + 9 tentacules
  //         + 3 cristaux + 3 anneau + 1 étoiles + 3 aura = 24 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('nebulon', function () {
    const VIOLET = '#7a5cbf', BLEU = '#4b62d9', ROSE = '#ff6b9d';
    const g = shell(), inner = g.userData.inner;
    const T = { seg: 14, rough: 0.25, flat: true, transparent: true, opacity: 0.58, side: THREE.DoubleSide, emissive: VIOLET, emissiveIntensity: 0.4, depthWrite: false };

    // --- Cloche (2) + bourrelet lumineux (1) ---------------------------------
    inner.add(R3.ellipsoid(0.54, 0.40, 0.54, VIOLET, 0, 1.92, 0, M(T)));
    inner.add(R3.ellipsoid(0.38, 0.26, 0.38, BLEU, 0, 1.86, 0, M({ seg: 12, rough: 0.25, flat: true, transparent: true, opacity: 0.38, side: THREE.DoubleSide, emissive: BLEU, emissiveIntensity: 0.55, depthWrite: false })));
    const bourrelet = R3.torus(0.52, 0.055, ROSE, 0, 1.74, 0, M({ seg: 14, rough: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide, emissive: ROSE, emissiveIntensity: 0.9, depthWrite: false }));
    bourrelet.rotation.x = -Math.PI / 2;
    inner.add(bourrelet);

    // --- Yeux, sur le devant de la cloche (2) --------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.86, 0.42);
    inner.add(head);
    head.add(gemEyes(0.16, 0.0, 0.06, 0.06, { color: ROSE, intensity: 2.1, tilt: 0.16 }));

    // --- 3 tentacules-rubans, 3 lames chacun (9) -----------------------------
    // Construits vers -z puis basculés : rotation.x = -π/2 envoie -z sur -y,
    // les rubans retombent donc bien vers le sol.
    const tentacules = [];
    [[0.32, 0.04], [-0.28, -0.10], [0.02, 0.30]].forEach(function (pp, i) {
      const rb = LL.flowRibbon(1.55 + (i % 2) * 0.20, ROSE, {
        color2: VIOLET, segments: 3, opacity: 0.55, width: 0.20,
        amp: 0.22, speed: 1.0, x: pp[0], y: 1.70, z: pp[1],
      });
      rb.rotation.x = -Math.PI / 2;
      inner.add(rb);
      tentacules.push(rb);
    });

    // --- Couronne de cristaux au sommet (3) ----------------------------------
    inner.add(LL.crystalCluster(ROSE, 3, 0.17, { base: false, glow: false, tipColor: BLEU, spread: 0.9, y: 2.12 }));

    // --- Anneau d'orbes de gaz (3) -------------------------------------------
    inner.add(LL.orbitRing(BLEU, 0.72, 3, { shape: 'sphere', size: 0.13, tilt: 0.22, speed: 0.32, glow: true, wobble: 0.20, y: 1.62 }));

    // --- Nébuleuse : 20 points, 1 draw call ----------------------------------
    inner.add(LL.starfield(ROSE, 20, 0.90, { color2: BLEU, spread: 'ball', size: 0.10, ry: 0.7, seed: 41, y: 1.92 }));

    // --- Aura (3) -------------------------------------------------------------
    const aura = LL.aura(VIOLET, 1.15, { shape: 'sphere', color2: BLEU, rings: 0, particles: 0, intensity: 1.2, y0: 1.40 });
    g.add(aura);

    g.userData.baseY = 0;
    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Voile de nébuleuse » : la cloche se contracte comme une vraie méduse
      // et les tentacules fouettent vers l'avant.
      const inn = root.userData.inner, k = arc(p);
      inn.scale.set(1 + k * 0.12, 1 - k * 0.18, 1 + k * 0.12);
      inn.position.z = k * 0.36;
      for (let i = 0; i < tentacules.length; i++) {
        tentacules[i].rotation.z = Math.sin(R3.clamp01(p) * Math.PI + i) * 0.35 * k;
      }
    };
    return finishLegendary(g, VIOLET, pulseFallbackAura(aura));
  });

})();
