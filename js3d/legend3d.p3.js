// =============================================================================
//  legend3d.p3.js — LOT P3 DES LÉGENDAIRES 3D (CONTRACT2 §4)
//  lumière · ombre · temps · espace
//  aureol · solaria · prismee · nyxaroth · penombra · eclipsion ·
//  chronoss · eternia · sablion · vortexis · astralis · nebulon
// =============================================================================
//  Ce lot est le plus abstrait des trois : temps et espace n'ont pas de
//  silhouette animale évidente, et ombre doit impressionner sans jamais faire
//  peur à un enfant de 10 ans. La consigne du contrat est suivie à la lettre :
//  c'est l'AURA et les PARTICULES (starfield, orbitRing, halo…) de
//  legendlib3d.js qui portent l'essentiel de la lisibilité, pas la silhouette
//  seule. Chaque créature reste néanmoins reconnaissable au premier coup
//  d'œil : posture, proportions et couleurs sont pensées pour se distinguer
//  nettement de ses deux cousines de même type.
//
//  Conventions reprises de creatures3d.p1.js :
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z.
//    * Tout le corps est rangé dans un sous-groupe `inner` : les animations
//      d'attaque bougent `inner`, jamais le Group racine (que battle3d.js
//      positionne et met à l'échelle).
//    * userData.anim = { head, wingL, wingR, tail, float }
//    * userData.attack = function (racine, p) avec p de 0 à 1.
//    * En plus (légendaires) : userData.legendary = true,
//      userData.auraColor = '#xxxxxx', et le crochet documenté par
//      legendlib3d.js : userData.anim.update = function (root, t) {
//      LL.animateAura(root, t); } — pour que les primitives lumineuses
//      embarquées dans le modèle (au-delà de l'aura ajoutée séparément par
//      battle3d.js) continuent de respirer une fois l'intégration branchée.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Accès à la bibliothèque de primitives légendaires, avec repli total si
  //  elle est absente : chaque appel renvoie un Group vide plutôt que de
  //  lever une exception (règle §1.7 du contrat).
  // ---------------------------------------------------------------------------
  function safeLL() {
    const base = (typeof R3.get === 'function') ? R3.get('llib') : null;
    const empty = function () { return new THREE.Group(); };
    const noop = function () {};
    const eyesFallback = function (spread, y, z, r) {
      try { return R3.eyes(spread || 0.14, y || 0.1, z || 0.28, r || 0.07); }
      catch (e) { return new THREE.Group(); }
    };
    return {
      aura: (base && base.aura) || empty,
      orbitRing: (base && base.orbitRing) || empty,
      crystalCluster: (base && base.crystalCluster) || empty,
      majesticWing: (base && base.majesticWing) || empty,
      plumeTail: (base && base.plumeTail) || empty,
      halo: (base && base.halo) || empty,
      runeStone: (base && base.runeStone) || empty,
      flowRibbon: (base && base.flowRibbon) || empty,
      starfield: (base && base.starfield) || empty,
      glowCore: (base && base.glowCore) || empty,
      bigEyes: (base && base.bigEyes) || eyesFallback,
      animateAura: (base && base.animateAura) || noop,
      serpentBody: (base && base.serpentBody) || empty,
      plateShell: (base && base.plateShell) || empty,
      clockFace: (base && base.clockFace) || empty,
      mistPuff: (base && base.mistPuff) || empty,
    };
  }
  const LL = safeLL();

  // ---------------------------------------------------------------------------
  //  Petits utilitaires partagés par les 12 modèles.
  // ---------------------------------------------------------------------------

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

  /** Patte simple : pivot à la hanche (origine), cuisse + patte vers -y.
   *  La patte rejoint TOUJOURS le sol (y=0 monde), quel que soit `len` passé :
   *  c'est `hipY` (la hauteur de la hanche) qui fixe la distance à parcourir,
   *  `len` n'étant qu'une indication de style conservée pour les appelants. */
  function leg(hx, hipY, hz, len, thick, color, footColor) {
    const p = new THREE.Group();
    p.position.set(hx, hipY, hz);
    const footR = thick * 0.62;
    const reach = Math.max(0.05, hipY - footR);
    const footY = -reach, thighY = -reach * 0.48;
    p.add(R3.ellipsoid(thick, reach * 0.50, thick, color, 0, thighY, 0, { rough: 0.75 }));
    p.add(R3.ellipsoid(thick * 1.2, footR, thick * 1.4, footColor || color, 0, footY, thick * 0.32, { rough: 0.82 }));
    return p;
  }

  /** Marque un modèle comme légendaire et branche le crochet d'animation
   *  documenté par legendlib3d.js (§13) : à appeler EN DERNIER, une fois
   *  userData.anim posé, car on complète l'objet plutôt que de l'écraser. */
  function finishLegendary(g, color) {
    g.userData.legendary = true;
    g.userData.auraColor = color;
    if (!g.userData.anim) g.userData.anim = {};
    g.userData.anim.update = function (root, t) { LL.animateAura(g, t); };
    return g;
  }

  // =============================================================================
  //  TYPE LUMIÈRE — aureol · solaria · prismee
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  AURÉOL — « griffon solaire, auréole à rayons »
  //  Un griffon quadrupède trapu et régalien : ailes en éclats de lumière
  //  raides (style 'ray'), grande auréole verticale derrière la tête, aura en
  //  colonne qui monte au ciel — le repère qu'on voit par-dessus les arbres.
  // ---------------------------------------------------------------------------
  R3.registerCreature('aureol', function () {
    const OR = '#ffe066', ORANGE = '#ff8c42', CREME = '#fff4d6';
    const g = shell(), inner = g.userData.inner;

    // --- Corps de lion, trapu et bas -------------------------------------------
    inner.add(R3.ellipsoid(0.42, 0.38, 0.60, OR, 0, 0.85, 0, { rough: 0.6 }));
    inner.add(R3.ellipsoid(0.30, 0.26, 0.30, CREME, 0, 0.68, 0.42, { rough: 0.75 }));
    inner.add(LL.glowCore(ORANGE, 0.13, { y: 0.95, z: 0.55 }));

    // --- 4 pattes ----------------------------------------------------------------
    [[0.30, 0.42], [-0.30, 0.42], [0.32, -0.38], [-0.32, -0.38]].forEach(function (hp) {
      inner.add(leg(hp[0], 0.85, hp[1], 0.62, 0.10, OR, CREME));
    });

    // --- Queue à plumes solaires ---------------------------------------------
    const tail = LL.plumeTail(0.75, ORANGE, 5, { style: 'feather', color2: OR, droop: 0.18, y: 0.85, z: -0.55 });
    inner.add(tail);

    // --- Tête d'aigle ------------------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.25, 0.35);
    inner.add(head);
    head.add(R3.ellipsoid(0.16, 0.20, 0.16, OR, 0, 0.10, 0.10, { rough: 0.6 }));   // cou
    head.add(R3.ellipsoid(0.22, 0.21, 0.23, CREME, 0, 0.36, 0.28, { rough: 0.6 })); // crâne
    const beak = R3.cone(0.09, 0.26, ORANGE, 0, 0.34, 0.55, { seg: 8 });
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    [-1, 1].forEach(function (s) {
      const c = R3.cone(0.035, 0.16, OR, s * 0.06, 0.55, 0.18, { seg: 6 });
      c.rotation.x = -0.5;
      head.add(c);
    });
    head.add(LL.bigEyes(0.13, 0.36, 0.42, 0.075, { color: ORANGE, dark: '#3a2410', angry: 0.5 }));

    // --- Auréole à rayons, verticale derrière la tête -------------------------
    const halo = LL.halo(ORANGE, 0.50, 10, { color2: OR, y: 1.66, z: -0.08, plane: 'face' });
    inner.add(halo);

    // --- Ailes en éclats de lumière -------------------------------------------
    const wingR = LL.majesticWing(0.95, OR, { style: 'ray', color2: CREME, segments: 6, x: 0.34, y: 1.05, z: -0.05, side: 1 });
    const wingL = LL.majesticWing(0.95, OR, { style: 'ray', color2: CREME, segments: 6, x: -0.34, y: 1.05, z: -0.05, side: -1 });
    inner.add(wingR, wingL);

    // --- Aura en colonne : le repère qui perce la canopée ----------------------
    const aura = LL.aura(OR, 1.15, { shape: 'column', color2: ORANGE, rings: 1, particles: 5 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false };
    g.userData.attack = function (root, p) {
      // « Rayon solaire » : le griffon se cabre, ouvre grand ses ailes de
      // lumière et projette la tête en avant.
      const inn = root.userData.inner, k = arc(p);
      inn.rotation.x = -k * 0.28;
      inn.position.y = k * 0.10;
      inn.position.z = k * 0.35;
      head.rotation.x = -k * 0.35;
      wingR.rotation.z = 0.15 + k * 1.05;
      wingL.rotation.z = -(0.15 + k * 1.05);
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, OR);
  });

  // ---------------------------------------------------------------------------
  //  SOLARIA — « phénix de lumière pure, plumes-rayons »
  //  Bipède, longue silhouette élancée et verticale (à l'inverse du griffon
  //  trapu d'Auréol) : grandes rémiges en éventail, longue traîne de plumes
  //  de flamme, nimbe autour de la tête.
  // ---------------------------------------------------------------------------
  R3.registerCreature('solaria', function () {
    const CREME = '#fff4d6', OR = '#ffe066', ROSE = '#ffaad8';
    const g = shell(), inner = g.userData.inner;

    // --- Corps élancé, vertical --------------------------------------------
    inner.add(R3.ellipsoid(0.28, 0.48, 0.32, CREME, 0, 1.00, 0, { rough: 0.55 }));
    inner.add(LL.glowCore(ROSE, 0.12, { y: 0.90, z: 0.30 }));

    // --- 2 pattes fines ------------------------------------------------------
    inner.add(leg(0.14, 0.55, 0, 0.55, 0.06, OR, CREME));
    inner.add(leg(-0.14, 0.55, 0, 0.55, 0.06, OR, CREME));

    // --- Cou et tête ----------------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.42, 0.06);
    inner.add(head);
    head.add(R3.ellipsoid(0.10, 0.26, 0.10, CREME, 0, 0.16, 0.06, { rough: 0.55 }));  // cou
    head.add(R3.ellipsoid(0.17, 0.16, 0.18, OR, 0, 0.36, 0.14, { rough: 0.55 }));      // crâne
    const beak = R3.cone(0.05, 0.16, ROSE, 0, 0.32, 0.30, { seg: 8 });
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    [0, -0.5, 0.5].forEach(function (a, i) {
      const c = R3.cone(0.02, 0.16 - i * 0.02, OR, Math.sin(a) * 0.05, 0.55 + i * 0.02, -0.02, { seg: 6 });
      c.rotation.x = -1.0;
      c.rotation.z = a * 0.4;
      head.add(c);
    });
    head.add(LL.bigEyes(0.10, 0.36, 0.20, 0.06, { color: ROSE, dark: '#3a2410', angry: 0.35 }));

    // --- Nimbe derrière la tête -------------------------------------------
    const halo = LL.halo(CREME, 0.40, 9, { color2: ROSE, y: 1.42, z: -0.14, plane: 'face' });
    inner.add(halo);

    // --- Grandes ailes en rémiges -------------------------------------------
    const wingR = LL.majesticWing(1.05, OR, { style: 'feather', color2: ROSE, segments: 6, x: 0.26, y: 1.10, z: -0.05, side: 1, tipColor: CREME });
    const wingL = LL.majesticWing(1.05, OR, { style: 'feather', color2: ROSE, segments: 6, x: -0.26, y: 1.10, z: -0.05, side: -1, tipColor: CREME });
    inner.add(wingR, wingL);

    // --- Longue traîne de flammes ---------------------------------------------
    const tail = LL.plumeTail(1.10, OR, 7, { style: 'flame', color2: ROSE, droop: 0.28, y: 0.68, z: -0.35 });
    inner.add(tail);

    // --- Aura en colonne, plus fine et plus haute qu'Auréol --------------------
    const aura = LL.aura(OR, 1.20, { shape: 'column', color2: ROSE, rings: 1, particles: 5, radiusY: 0.7 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false };
    g.userData.attack = function (root, p) {
      // « Envol phénix » : bond vertical, ailes qui claquent, traîne qui
      // s'embrase derrière.
      const inn = root.userData.inner, k = arc(p);
      inn.position.y = k * 0.30;
      inn.rotation.x = -k * 0.18;
      wingR.rotation.z = 0.20 + k * 1.15;
      wingL.rotation.z = -(0.20 + k * 1.15);
      head.rotation.x = -k * 0.22;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, OR);
  });

  // ---------------------------------------------------------------------------
  //  PRISMÉE — « papillon-prisme, ailes en arc-en-ciel »
  //  Petite silhouette délicate qui flotte : 4 ailes translucides multicolores
  //  (à l'inverse des deux oiseaux majestueux ci-dessus), essaim d'étincelles
  //  prismatiques en orbite. La plus « fée » des trois lumières.
  // ---------------------------------------------------------------------------
  R3.registerCreature('prismee', function () {
    const BLANC = '#f4f4f4', VIOLET = '#d896ff', CYAN = '#73eff7';
    const g = shell(), inner = g.userData.inner;

    // --- Corps fin, vertical ---------------------------------------------------
    inner.add(R3.ellipsoid(0.13, 0.30, 0.13, BLANC, 0, 1.33, 0, { rough: 0.5 }));
    const head = new THREE.Group();
    head.position.set(0, 1.66, 0.02);
    inner.add(head);
    head.add(R3.ellipsoid(0.12, 0.12, 0.12, BLANC, 0, 0, 0, { rough: 0.5 }));
    [-1, 1].forEach(function (s) {
      const a = R3.cyl(0.008, 0.02, 0.22, VIOLET, s * 0.06, 0.16, 0.02, { seg: 6, rough: 0.4 });
      a.rotation.z = -s * 0.5;
      head.add(a);
    });
    head.add(LL.bigEyes(0.075, 0.02, 0.10, 0.045, { color: VIOLET, dark: '#241a3d', angry: 0.1 }));

    // --- 2 petites pattes fines, posées au sol ----------------------------------
    inner.add(leg(0.06, 0.38, 0, 0.38, 0.03, BLANC, VIOLET));
    inner.add(leg(-0.06, 0.38, 0, 0.38, 0.03, BLANC, VIOLET));

    // --- 4 ailes en arc-en-ciel (2 paires) ---------------------------------------
    const wingR = LL.majesticWing(0.78, VIOLET, { style: 'membrane', color2: CYAN, x: 0.05, y: 1.28, z: -0.02, side: 1, opacity: 0.72 });
    const wingL = LL.majesticWing(0.78, VIOLET, { style: 'membrane', color2: CYAN, x: -0.05, y: 1.28, z: -0.02, side: -1, opacity: 0.72 });
    const wingR2 = LL.majesticWing(0.46, CYAN, { style: 'crystal', color2: VIOLET, segments: 4, x: 0.05, y: 1.06, z: -0.10, side: 1, opacity: 0.68 });
    const wingL2 = LL.majesticWing(0.46, CYAN, { style: 'crystal', color2: VIOLET, segments: 4, x: -0.05, y: 1.06, z: -0.10, side: -1, opacity: 0.68 });
    inner.add(wingR, wingL, wingR2, wingL2);

    // --- Poussière de prisme en orbite -----------------------------------------
    const dust = LL.starfield(CYAN, 20, 0.75, { color2: VIOLET, spread: 'shell', y: 1.33 });
    inner.add(dust);

    // --- Aura, discrète et haute (une fée, pas un mur de lumière) --------------
    const aura = LL.aura(VIOLET, 0.90, { shape: 'sphere', color2: CYAN, rings: 1, particles: 6, y0: 1.33 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: null, float: true };
    g.userData.attack = function (root, p) {
      // « Éclat prisme » : les 4 ailes s'ouvrent en grand et le corps tournoie.
      const inn = root.userData.inner, k = arc(p);
      inn.position.y = k * 0.18;
      inn.rotation.y = R3.clamp01(p) * Math.PI * 2;
      wingR.rotation.z = 0.25 + k * 0.9; wingL.rotation.z = -(0.25 + k * 0.9);
      wingR2.rotation.z = 0.15 + k * 0.7; wingL2.rotation.z = -(0.15 + k * 0.7);
      if (p >= 1) inn.rotation.y = 0;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // =============================================================================
  //  TYPE OMBRE — nyxaroth · penombra · eclipsion
  //  Consigne du contrat : impressionnants, jamais effrayants. Regards doux,
  //  silhouettes arrondies, teintes sombres réchauffées par une touche rose/or.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  NYXAROTH — « loup des ténèbres, fumée aux pattes »
  //  Quadrupède, bien planté au sol, volutes de fumée qui s'échappent des
  //  pattes avant — le seul des trois à toucher vraiment le sol de tout son
  //  corps (Pénombra flotte, Éclipsion vole).
  // ---------------------------------------------------------------------------
  R3.registerCreature('nyxaroth', function () {
    const NOIR = '#2a2438', VIOLET = '#7a5cbf', ROSE = '#ff6b9d';
    const g = shell(), inner = g.userData.inner;

    inner.add(R3.ellipsoid(0.40, 0.42, 0.74, NOIR, 0, 1.02, 0, { rough: 0.7 }));
    inner.add(R3.ellipsoid(0.27, 0.24, 0.36, VIOLET, 0, 0.86, 0.38, { rough: 0.85 }));
    // Petite crête douce le long du dos — de la majesté, pas des piquants agressifs.
    [-0.30, 0, 0.30].forEach(function (z) {
      inner.add(R3.ellipsoid(0.06, 0.11, 0.11, VIOLET, 0, 1.36, z, { rough: 0.7 }));
    });

    [[0.30, 0.55], [-0.30, 0.55], [0.30, -0.52], [-0.30, -0.52]].forEach(function (hp) {
      inner.add(leg(hp[0], 1.02, hp[1], 0.78, 0.11, NOIR, VIOLET));
    });
    // Fumée aux pattes avant, comme demandé par le contrat.
    inner.add(LL.mistPuff(VIOLET, 0.20, 4, { color2: ROSE, opacity: 0.32, x: 0.30, y: 0.06, z: 0.55 }));
    inner.add(LL.mistPuff(VIOLET, 0.20, 4, { color2: ROSE, opacity: 0.32, x: -0.30, y: 0.06, z: 0.55 }));

    const head = new THREE.Group();
    head.position.set(0, 1.32, 0.52);
    inner.add(head);
    head.add(R3.ellipsoid(0.29, 0.27, 0.34, NOIR, 0, 0, 0, { rough: 0.7 }));
    head.add(R3.ellipsoid(0.15, 0.12, 0.20, VIOLET, 0, -0.12, 0.29, { rough: 0.85 }));
    [-1, 1].forEach(function (s) {
      const ear = R3.cone(0.10, 0.24, NOIR, s * 0.16, 0.32, -0.02, { seg: 6 });
      ear.rotation.x = 0.25;
      ear.rotation.z = s * 0.18;
      head.add(ear);
    });
    // Regard doux malgré le thème sombre : iris rose chaleureux, peu de colère.
    head.add(LL.bigEyes(0.16, 0.02, 0.24, 0.085, { color: ROSE, dark: '#141020', angry: 0.30 }));

    // Traîne de fumée magique en guise de queue.
    const tail = LL.plumeTail(1.00, VIOLET, 6, { style: 'flame', color2: ROSE, droop: 0.22, opacity: 0.85, y: 1.10, z: -0.70 });
    inner.add(tail);

    const aura = LL.aura(NOIR, 1.25, { shape: 'sphere', color2: VIOLET, rings: 1, particles: 4, y0: 1.05 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tail, float: false };
    g.userData.attack = function (root, p) {
      // « Bond des ombres » : il se ramasse puis fonce, gueule en avant.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.55;
      inn.position.y = k * 0.08;
      inn.rotation.x = -k * 0.20;
      head.rotation.x = -k * 0.30;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // ---------------------------------------------------------------------------
  //  PÉNOMBRA — « chat-fantôme translucide, queue vaporeuse »
  //  Flotte au-dessus du sol (float), corps translucide (opacity < 1), queue
  //  en ruban ondulant plutôt qu'en fouet — un mouvement bien plus doux que
  //  celui de Nyxaroth.
  // ---------------------------------------------------------------------------
  R3.registerCreature('penombra', function () {
    const FONCE = '#4a3d6b', CLAIR = '#a99bd6', CYAN = '#73eff7';
    const g = shell(), inner = g.userData.inner;
    const T = { transparent: true, opacity: 0.55, rough: 0.3, side: THREE.DoubleSide, depthWrite: false };

    inner.add(R3.ellipsoid(0.30, 0.30, 0.52, CLAIR, 0, 1.20, 0, T));
    inner.add(LL.glowCore(CYAN, 0.11, { y: 1.15, z: 0.22 }));

    const head = new THREE.Group();
    head.position.set(0, 1.58, 0.34);
    inner.add(head);
    head.add(R3.ellipsoid(0.24, 0.22, 0.26, CLAIR, 0, 0, 0, T));
    [-1, 1].forEach(function (s) {
      const ear = R3.cone(0.08, 0.19, FONCE, s * 0.13, 0.24, -0.02, Object.assign({ seg: 6 }, T));
      ear.rotation.z = s * 0.22;
      head.add(ear);
    });
    head.add(LL.bigEyes(0.12, 0.0, 0.22, 0.07, { color: CYAN, dark: '#241a3d', angry: 0.1 }));

    // Volutes de brume à la base, en guise de « pattes » — le chat flotte.
    const mist = LL.mistPuff(CLAIR, 0.38, 6, { color2: FONCE, opacity: 0.28, y: 0.14, ry: 0.5 });
    inner.add(mist);
    // Un second voile de brume à mi-hauteur relie visuellement la tête au sol.
    const mistMid = LL.mistPuff(FONCE, 0.30, 4, { color2: CLAIR, opacity: 0.20, y: 0.65, ry: 0.7 });
    inner.add(mistMid);

    // Queue vaporeuse : un ruban qui ondule doucement, pas un fouet.
    const tail = LL.flowRibbon(0.95, CYAN, { color2: CLAIR, opacity: 0.48, segments: 8, y: 1.20, z: -0.38 });
    inner.add(tail);

    const aura = LL.aura(FONCE, 1.0, { shape: 'sphere', color2: CYAN, rings: 1, particles: 5, intensity: 1.25, y0: 1.10 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tail, float: true };
    g.userData.attack = function (root, p) {
      // « Traversée spectrale » : le corps s'estompe, glisse en avant, puis
      // réapparaît de l'autre côté.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.60;
      inn.position.x = Math.sin(R3.clamp01(p) * Math.PI * 2) * 0.15;
      inn.scale.setScalar(1 - k * 0.25);
      head.rotation.y = k * 0.4;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, FONCE);
  });

  // ---------------------------------------------------------------------------
  //  ÉCLIPSION — « corbeau d'éclipse, anneau noir au dos »
  //  Le seul des trois qui vole vraiment (grandes ailes déployées en
  //  permanence), avec l'anneau sombre du contrat monté sur le dos comme une
  //  éclipse miniature — un halo à zéro rayon, cerclé d'éclats dorés.
  // ---------------------------------------------------------------------------
  R3.registerCreature('eclipsion', function () {
    const NOIR = '#1a1c2c', VIOLET = '#7a5cbf', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;

    inner.add(R3.ellipsoid(0.26, 0.32, 0.60, NOIR, 0, 1.12, 0, { rough: 0.55 }));
    inner.add(leg(0.14, 0.66, 0, 0.60, 0.06, NOIR, VIOLET));
    inner.add(leg(-0.14, 0.66, 0, 0.60, 0.06, NOIR, VIOLET));

    const head = new THREE.Group();
    head.position.set(0, 1.48, 0.30);
    inner.add(head);
    head.add(R3.ellipsoid(0.12, 0.16, 0.14, NOIR, 0, 0.17, 0.06, { rough: 0.55 }));   // cou
    head.add(R3.ellipsoid(0.21, 0.20, 0.22, NOIR, 0, 0.40, 0.19, { rough: 0.55 }));    // crâne
    const beakTop = R3.cone(0.065, 0.22, VIOLET, 0, 0.39, 0.39, { seg: 6 });
    beakTop.rotation.x = Math.PI / 2 - 0.15;
    head.add(beakTop);
    const beakBot = R3.cone(0.05, 0.14, OR, 0, 0.31, 0.33, { seg: 6 });
    beakBot.rotation.x = Math.PI / 2 + 0.15;
    head.add(beakBot);
    [-1, 1].forEach(function (s) {
      const tuft = R3.cone(0.033, 0.11, VIOLET, s * 0.055, 0.56, 0.15, { seg: 5 });
      tuft.rotation.z = s * 0.3;
      head.add(tuft);
    });
    head.add(LL.bigEyes(0.11, 0.40, 0.33, 0.065, { color: OR, dark: '#0c0d16', angry: 0.45 }));

    const wingR = LL.majesticWing(1.02, NOIR, { style: 'feather', color2: VIOLET, segments: 6, x: 0.26, y: 1.20, z: -0.05, side: 1, tipColor: OR });
    const wingL = LL.majesticWing(1.02, NOIR, { style: 'feather', color2: VIOLET, segments: 6, x: -0.26, y: 1.20, z: -0.05, side: -1, tipColor: OR });
    inner.add(wingR, wingL);

    const tail = LL.plumeTail(0.46, NOIR, 4, { style: 'feather', color2: VIOLET, droop: 0.10, y: 1.05, z: -0.50 });
    inner.add(tail);

    // --- L'anneau noir sur le dos : un halo sans rayons + une couronne dorée --
    const ring = LL.halo(NOIR, 0.58, 0, { color2: VIOLET, y: 1.18, z: -0.46, plane: 'face', solid: true });
    inner.add(ring);
    const glints = LL.orbitRing(OR, 0.63, 6, { shape: 'sphere', size: 0.05, tilt: 1.4, speed: 0.4, glow: true, y: 1.18, z: -0.46 });
    inner.add(glints);

    const aura = LL.aura(NOIR, 1.15, { shape: 'sphere', color2: VIOLET, rings: 2, particles: 4, y0: 1.15 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: true };
    g.userData.attack = function (root, p) {
      // « Éclipse totale » : plongée, l'anneau du dos s'aligne face à
      // l'adversaire, les ailes se replient puis claquent.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.5;
      inn.position.y = -k * 0.10;
      wingR.rotation.z = 0.2 - k * 0.6; wingL.rotation.z = -(0.2 - k * 0.6);
      ring.rotation.y = R3.clamp01(p) * Math.PI;
      head.rotation.x = k * 0.25;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // =============================================================================
  //  TYPE TEMPS — chronoss · eternia · sablion
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  CHRONOSS — « tortue-horloge, cadran sur la carapace »
  //  Basse, trapue, immobile en apparence : la plus « lente » des trois,
  //  posture au ras du sol, cadran d'horloge posé bien à plat sur le dôme.
  // ---------------------------------------------------------------------------
  R3.registerCreature('chronoss', function () {
    const VIOLET = '#d896ff', BRONZE = '#c8a06a', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;

    // Corps bas et large — le socle trapu d'une tortue, pattes courtes.
    inner.add(R3.ellipsoid(0.42, 0.24, 0.54, VIOLET, 0, 0.32, 0, { rough: 0.65 }));
    [[0.34, 0.38], [-0.34, 0.38], [0.34, -0.38], [-0.34, -0.38]].forEach(function (hp) {
      inner.add(leg(hp[0], 0.28, hp[1], 0.24, 0.13, VIOLET, BRONZE));
    });

    const head = new THREE.Group();
    head.position.set(0, 0.40, 0.62);
    inner.add(head);
    head.add(R3.ellipsoid(0.13, 0.12, 0.11, VIOLET, 0, 0, 0, { rough: 0.65 }));
    head.add(R3.cone(0.05, 0.09, BRONZE, 0, -0.02, 0.13, { seg: 6 }));
    head.add(LL.bigEyes(0.08, 0.02, 0.09, 0.045, { color: OR, dark: '#241a3d', brow: false }));

    const tail = LL.plumeTail(0.22, VIOLET, 3, { style: 'feather', droop: 0.4, y: 0.32, z: -0.54 });
    inner.add(tail);

    // --- La carapace se prolonge en petite tour d'horloge -----------------------
    // Un dôme large et peu profond (pour ne jamais passer sous y=0, l'ellipsoïde
    // de plateShell n'étant pas une demi-sphère mais un ellipsoïde complet), qui
    // porte une tourelle conique surmontée du cadran puis d'un fleuron doré :
    // c'est CE qui donne à Chronoss sa taille de légendaire, la tortue restant
    // basse et « lente » comme il se doit.
    const shellDome = LL.plateShell(0.50, BRONZE, { h: 0.20, plateColor: VIOLET, rim: true, y: 0.42 });
    inner.add(shellDome);
    const tower = R3.cyl(0.16, 0.27, 1.05, BRONZE, 0, 1.14, 0, { seg: 12, rough: 0.55 });
    inner.add(tower);
    const towerCap = R3.cone(0.20, 0.22, VIOLET, 0, 1.72, 0, { seg: 10 });
    inner.add(towerCap);
    const finial = R3.ellipsoid(0.06, 0.10, 0.06, OR, 0, 1.90, 0, { rough: 0.4, emissive: OR, emissiveIntensity: 0.4 });
    inner.add(finial);
    const clock = LL.clockFace(0.24, VIOLET, { rimColor: BRONZE, handColor: OR, marks: 6, plane: 'face', y: 1.35, z: 0.24 });
    inner.add(clock);

    // Petites gemmes-rouages en orbite autour de la tour.
    const gears = LL.orbitRing(OR, 0.42, 7, { shape: 'stone', size: 0.05, tilt: 0.2, speed: 0.3, glow: true, y: 1.35 });
    inner.add(gears);

    // Aura au sol : Chronoss est lent, son aura reste posée, pas dressée.
    const aura = LL.aura(VIOLET, 1.05, { shape: 'disc', color2: OR, rings: 1, particles: 4 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tail, float: false };
    g.userData.attack = function (root, p) {
      // « Fissure du temps » : la tour d'horloge s'illumine, la tête
      // s'avance très lentement puis « saute » à l'impact — mouvement
      // saccadé, à l'image d'une trotteuse.
      const inn = root.userData.inner, k = arc(p);
      const step = Math.round(R3.clamp01(p) * 6) / 6;   // saccadé, pas fluide
      inn.position.z = step * 0.30;
      head.position.z = 0.62 + k * 0.10;
      clock.rotation.z = R3.clamp01(p) * Math.PI * 2;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // ---------------------------------------------------------------------------
  //  ÉTERNIA — « sphinx du temps, sabliers suspendus »
  //  La plus grande et la plus régalienne des trois : posture assise de
  //  sphinx, coiffe ornée, aura en colonne (l'éternité qui monte au ciel).
  //  Les « sabliers suspendus » sont stylisés en pierres-temps en orbite,
  //  animées automatiquement par orbitRing plutôt que figées.
  // ---------------------------------------------------------------------------
  R3.registerCreature('eternia', function () {
    const SABLE = '#e3c68d', VIOLET = '#d896ff', BLEU = '#4b62d9';
    const g = shell(), inner = g.userData.inner;

    inner.add(R3.ellipsoid(0.42, 0.40, 0.62, SABLE, 0, 0.85, 0, { rough: 0.55 }));
    inner.add(LL.glowCore(VIOLET, 0.12, { y: 1.05, z: 0.45 }));

    // Pattes avant tendues (posture de sphinx assis), pattes arrière repliées.
    inner.add(leg(0.22, 0.85, 0.55, 0.75, 0.11, SABLE, VIOLET));
    inner.add(leg(-0.22, 0.85, 0.55, 0.75, 0.11, SABLE, VIOLET));
    inner.add(leg(0.28, 0.60, -0.45, 0.35, 0.14, SABLE, VIOLET));
    inner.add(leg(-0.28, 0.60, -0.45, 0.35, 0.14, SABLE, VIOLET));

    const tail = LL.plumeTail(0.70, VIOLET, 5, { style: 'feather', color2: BLEU, droop: 0.15, y: 0.75, z: -0.60 });
    inner.add(tail);

    const head = new THREE.Group();
    head.position.set(0, 1.35, 0.35);
    inner.add(head);
    head.add(R3.ellipsoid(0.15, 0.20, 0.15, SABLE, 0, 0.15, 0.10, { rough: 0.55 })); // cou
    head.add(R3.ellipsoid(0.26, 0.25, 0.27, SABLE, 0, 0.42, 0.25, { rough: 0.5 }));   // crâne noble
    [-1, 1].forEach(function (s) {
      const flap = R3.ellipsoid(0.05, 0.24, 0.13, VIOLET, s * 0.24, 0.32, 0.10, { rough: 0.5 });
      flap.rotation.z = s * 0.15;
      head.add(flap);
    });
    // Coiffe : petite pierre gravée en couronne.
    head.add(LL.runeStone(BLEU, 0.14, { glowColor: VIOLET, rune: 'ring', count: 1, y: 0.68, z: 0.14 }));
    head.add(LL.bigEyes(0.13, 0.42, 0.36, 0.075, { color: BLEU, dark: '#2a2144', angry: 0.35 }));

    // --- Les « sabliers » : deux anneaux de pierres-temps qui orbitent ---------
    const orbA = LL.orbitRing(BLEU, 0.90, 3, { shape: 'stone', size: 0.16, tilt: 0.5, speed: 0.25, glow: true, y: 1.55 });
    const orbB = LL.orbitRing(VIOLET, 0.65, 2, { shape: 'stone', size: 0.12, tilt: -0.6, speed: -0.35, glow: true, y: 1.90 });
    inner.add(orbA, orbB);

    // Aura en colonne : l'éternité qui monte au ciel, plus large que Chronoss.
    const aura = LL.aura(SABLE, 1.20, { shape: 'column', color2: VIOLET, rings: 2, particles: 5 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tail, float: false };
    g.userData.attack = function (root, p) {
      // « Remonter le temps » : la tête se redresse, les pierres-temps se
      // resserrent brutalement autour du corps avant de repartir en orbite.
      const inn = root.userData.inner, k = arc(p);
      head.rotation.x = -k * 0.25;
      inn.position.y = k * 0.14;
      orbA.scale.setScalar(1 - k * 0.35);
      orbB.scale.setScalar(1 - k * 0.35);
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // ---------------------------------------------------------------------------
  //  SABLION — « serpent de sable, corps qui s'écoule »
  //  Un long corps serpentin (serpentBody) qui se cabre légèrement, traîne de
  //  sable qui s'écoule derrière lui (starfield en spirale au ras du sol) —
  //  posture et silhouette très différentes des deux autres légendaires
  //  temps, qui sont l'une trapue au sol, l'autre assise et régalienne.
  // ---------------------------------------------------------------------------
  R3.registerCreature('sablion', function () {
    const SABLE = '#e3c68d', BRUN = '#c08c4a', VIOLET = '#d896ff';
    const g = shell(), inner = g.userData.inner;

    // Corps qui se cabre doucement (rise) : le pivot est à la tête.
    const body = LL.serpentBody(2.1, SABLE, {
      segments: 12, r: 0.20, taper: 0.72, belly: BRUN, color2: BRUN, rise: 0.36,
      y: 1.62, z: 0.30,
    });
    inner.add(body);

    // --- Tête, ajoutée devant le premier anneau du corps -----------------------
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0.48);
    inner.add(head);
    head.add(R3.ellipsoid(0.23, 0.20, 0.26, VIOLET, 0, 0, 0, { rough: 0.55 }));
    head.add(R3.box(0.03, 0.02, 0.16, BRUN, 0, -0.06, 0.28, { rough: 0.4 }));   // langue
    // Petite collerette de sable façon capuchon de cobra.
    [-1, 1].forEach(function (s) {
      const fin = R3.ellipsoid(0.14, 0.10, 0.03, SABLE, s * 0.20, 0.02, 0.02, { rough: 0.7, side: THREE.DoubleSide });
      fin.rotation.y = s * 0.6;
      head.add(fin);
    });
    head.add(LL.bigEyes(0.12, 0.05, 0.22, 0.06, { color: VIOLET, dark: '#2a1f12', angry: 0.45 }));

    // Traîne de sable qui s'écoule au ras du sol.
    const sand = LL.starfield(BRUN, 22, 1.3, { color2: SABLE, spread: 'spiral', y: 0.25, ry: 0.25, z: -0.4 });
    inner.add(sand);
    // Pointe de queue cristallisée (le sable qui se fige).
    const tailTip = LL.crystalCluster(VIOLET, 4, 0.12, { opacity: 0.7, glow: true, base: false, y: 0.35, z: -1.55 });
    inner.add(tailTip);

    // Aura basse, en flaque de sable.
    const aura = LL.aura(SABLE, 1.10, { shape: 'disc', color2: VIOLET, rings: 1, particles: 5 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: null, float: false };
    g.userData.attack = function (root, p) {
      // « Vague de sable » : le corps entier ondule fort et la tête frappe
      // en avant.
      const inn = root.userData.inner, k = arc(p);
      head.position.z = 0.48 + k * 0.55;
      head.position.y = 1.62 - k * 0.15;
      inn.rotation.z = Math.sin(R3.clamp01(p) * Math.PI * 3) * 0.12 * (1 - k * 0.4);
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

  // =============================================================================
  //  TYPE ESPACE — vortexis · astralis · nebulon
  //  Comme pour temps, la silhouette animale s'efface derrière l'aura et les
  //  particules : starfield (quasi gratuit, un seul THREE.Points) est utilisé
  //  sans retenue sur les trois.
  // =============================================================================

  // ---------------------------------------------------------------------------
  //  VORTEXIS — « raie-galaxie, spirale d'étoiles »
  //  Une raie manta plate qui plane, spirale de galaxie qui tourbillonne
  //  derrière elle — la plus « rapide et fine » des trois espace.
  // ---------------------------------------------------------------------------
  R3.registerCreature('vortexis', function () {
    const BLEU = '#4b62d9', NOIR = '#1a1c2c', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    inner.add(R3.ellipsoid(0.50, 0.16, 0.70, NOIR, 0, 1.55, 0, { rough: 0.45 }));
    inner.add(R3.ellipsoid(0.40, 0.10, 0.55, BLEU, 0, 1.49, 0.10, { rough: 0.5 }));
    [-1, 1].forEach(function (s) {
      const lobe = R3.cone(0.05, 0.24, BLEU, s * 0.16, 1.66, 0.62, { seg: 6 });
      lobe.rotation.x = Math.PI / 2 - 0.55;
      lobe.rotation.z = s * 0.2;
      inner.add(lobe);
    });
    const head = new THREE.Group();
    head.position.set(0, 1.55, 0.55);
    inner.add(head);
    head.add(LL.bigEyes(0.16, 0.0, 0.08, 0.06, { color: BLANC, dark: '#05070f', brow: false }));

    const wingR = LL.majesticWing(1.30, NOIR, { style: 'membrane', color2: BLEU, x: 0.05, y: 1.53, z: -0.05, side: 1, opacity: 0.92 });
    const wingL = LL.majesticWing(1.30, NOIR, { style: 'membrane', color2: BLEU, x: -0.05, y: 1.53, z: -0.05, side: -1, opacity: 0.92 });
    inner.add(wingR, wingL);

    // Longue queue-ruban qui plonge vers le sol : c'est elle qui donne à
    // Vortexis toute sa hauteur (une raie à plat resterait basse).
    const tail = LL.plumeTail(1.45, BLEU, 7, { style: 'ribbon', color2: NOIR, droop: 0.05, y: 1.58, z: -0.68 });
    tail.rotation.x = -1.35;
    inner.add(tail);

    const spiral = LL.starfield(BLANC, 26, 1.4, { spread: 'spiral', color2: BLEU, y: 1.30, ry: 0.30 });
    inner.add(spiral);
    const shards = LL.orbitRing(BLANC, 0.85, 7, { shape: 'star', size: 0.05, tilt: 0.3, speed: 0.6, glow: true, y: 1.30 });
    inner.add(shards);

    const aura = LL.aura(BLEU, 1.30, { shape: 'sphere', color2: NOIR, rings: 2, particles: 6, y0: 1.2 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: true };
    g.userData.attack = function (root, p) {
      // « Spirale galactique » : elle pique, effectue une vrille complète,
      // puis se stabilise.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.5;
      inn.rotation.z = R3.clamp01(p) * Math.PI * 2;
      wingR.rotation.z = 0.15 + k * 0.7; wingL.rotation.z = -(0.15 + k * 0.7);
      if (p >= 1) inn.rotation.z = 0;
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, BLEU);
  });

  // ---------------------------------------------------------------------------
  //  ASTRALIS — « baleine stellaire, constellations »
  //  La plus grande et la plus lente des trois espace : un long corps de
  //  baleine tout en rondeur, couvert de constellations, qui plane
  //  paisiblement plutôt que de foncer comme Vortexis.
  // ---------------------------------------------------------------------------
  R3.registerCreature('astralis', function () {
    const NUIT = '#29366f', BLEU = '#4b62d9', JAUNE = '#fcef8d';
    const g = shell(), inner = g.userData.inner;

    inner.add(R3.ellipsoid(0.45, 0.62, 1.00, NUIT, 0, 1.55, 0, { rough: 0.45 }));
    inner.add(R3.ellipsoid(0.34, 0.36, 0.55, BLEU, 0, 1.35, 0.30, { rough: 0.55 }));
    inner.add(R3.ellipsoid(0.36, 0.36, 0.36, NUIT, 0, 1.58, 1.05, { rough: 0.45 }));   // museau
    // Grand aileron dorsal cristallin — c'est lui qui donne à Astralis sa
    // stature de légendaire (une baleine à plat serait trop basse).
    inner.add(R3.cone(0.12, 0.68, BLEU, 0, 2.16, 0.30, { seg: 8 }));

    const head = new THREE.Group();
    head.position.set(0, 1.60, 1.15);
    inner.add(head);
    head.add(LL.bigEyes(0.26, 0.0, 0.10, 0.07, { color: JAUNE, dark: '#0d1230', brow: false }));

    const finR = LL.majesticWing(0.58, BLEU, { style: 'membrane', color2: NUIT, x: 0.42, y: 0.95, z: 0.15, side: 1, arm: false });
    const finL = LL.majesticWing(0.58, BLEU, { style: 'membrane', color2: NUIT, x: -0.42, y: 0.95, z: 0.15, side: -1, arm: false });
    inner.add(finR, finL);

    // --- Nageoire caudale, à plat ------------------------------------------------
    const tail = new THREE.Group();
    tail.position.set(0, 1.35, -1.05);
    inner.add(tail);
    tail.add(R3.cyl(0.10, 0.16, 0.45, NUIT, 0, 0, -0.20, { seg: 8, rough: 0.5 }));
    [-1, 1].forEach(function (s) {
      const lobe = R3.ellipsoid(0.34, 0.05, 0.20, BLEU, s * 0.28, 0, -0.42, { rough: 0.5 });
      lobe.rotation.y = s * 0.35;
      tail.add(lobe);
    });

    // --- Constellations sur la peau + sillage d'étoiles -------------------------
    const constellation = LL.starfield(JAUNE, 30, 0.9, { color2: BLEU, spread: 'shell', ry: 0.85, y: 1.55, z: 0.10 });
    inner.add(constellation);
    const wake = LL.starfield(BLEU, 18, 1.6, { color2: JAUNE, spread: 'ball', y: 1.35, z: -0.9 });
    inner.add(wake);
    const runes = LL.runeStone(BLEU, 0.10, { glowColor: JAUNE, rune: 'star', count: 2, spread: 0.9, y: 1.75, z: -0.30 });
    inner.add(runes);

    // Aura en colonne : la baleine qui domine le ciel, visible de très loin.
    const aura = LL.aura(NUIT, 1.40, { shape: 'column', color2: BLEU, rings: 2, particles: 6, y0: 1.55 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: finL, wingR: finR, tail: tail, float: true };
    g.userData.attack = function (root, p) {
      // « Chant stellaire » : la baleine ondule lentement de tout son long
      // et les constellations scintillent plus fort.
      const inn = root.userData.inner, k = arc(p);
      inn.rotation.z = Math.sin(R3.clamp01(p) * Math.PI * 1.5) * 0.10;
      inn.position.y = k * 0.16;
      finR.rotation.z = 0.1 + k * 0.4; finL.rotation.z = -(0.1 + k * 0.4);
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, BLEU);
  });

  // ---------------------------------------------------------------------------
  //  NÉBULON — « méduse-nébuleuse, voile de gaz coloré »
  //  Flotte très haut, cloche translucide, longs tentacules-rubans qui
  //  pendent (contrairement à la queue horizontale d'Astralis et à la
  //  silhouette plate de Vortexis) — la plus verticale et la plus « molle »
  //  des trois espace.
  // ---------------------------------------------------------------------------
  R3.registerCreature('nebulon', function () {
    const VIOLET = '#7a5cbf', BLEU = '#4b62d9', ROSE = '#ff6b9d';
    const g = shell(), inner = g.userData.inner;
    const T = { transparent: true, opacity: 0.62, rough: 0.25, side: THREE.DoubleSide, depthWrite: false };

    inner.add(R3.ellipsoid(0.50, 0.36, 0.50, VIOLET, 0, 1.85, 0, T));
    inner.add(R3.ellipsoid(0.36, 0.24, 0.36, BLEU, 0, 1.80, 0, Object.assign({}, T, { opacity: 0.4 })));

    const head = new THREE.Group();
    head.position.set(0, 1.80, 0.40);
    inner.add(head);
    head.add(LL.bigEyes(0.15, 0.0, 0.05, 0.055, { color: ROSE, dark: '#241a3d', brow: false }));

    // --- Tentacules-rubans qui pendent sous la cloche, longues et basses --------
    // (c'est leur longueur qui donne à Nébulon sa taille de légendaire)
    const tentacles = [];
    const positions = [[0.30, 0.0], [-0.30, 0.0], [0.16, 0.28], [-0.16, 0.28], [0.0, -0.32]];
    positions.forEach(function (pp, i) {
      const rb = LL.flowRibbon(1.30 + (i % 2) * 0.25, ROSE, {
        color2: VIOLET, segments: 7, opacity: 0.55, x: pp[0], y: 1.62, z: pp[1],
      });
      rb.rotation.x = -Math.PI / 2;   // le ruban, construit vers -z, retombe vers -y
      inner.add(rb);
      tentacles.push(rb);
    });

    // --- Nuage de gaz nébuleux autour de la cloche -------------------------------
    const gas = LL.mistPuff(BLEU, 0.60, 7, { color2: ROSE, opacity: 0.22, ry: 0.6, y: 1.85 });
    inner.add(gas);
    const sparkle = LL.starfield(ROSE, 16, 0.80, { color2: BLEU, spread: 'ball', y: 1.85 });
    inner.add(sparkle);

    const aura = LL.aura(VIOLET, 1.20, { shape: 'sphere', color2: BLEU, rings: 1, particles: 5, intensity: 1.2, y0: 1.30 });
    g.add(aura);

    g.userData.anim = { head: head, wingL: null, wingR: null, tail: tentacles[0], float: true };
    g.userData.attack = function (root, p) {
      // « Voile de nébuleuse » : la cloche se contracte comme une vraie
      // méduse et les tentacules fouettent vers l'avant.
      const inn = root.userData.inner, k = arc(p);
      inn.scale.set(1 + k * 0.12, 1 - k * 0.18, 1 + k * 0.12);
      inn.position.z = k * 0.35;
      tentacles.forEach(function (t, i) {
        t.rotation.z = Math.sin(R3.clamp01(p) * Math.PI + i) * 0.35 * k;
      });
      LL.animateAura(root, R3.clock.t);
    };
    return finishLegendary(g, VIOLET);
  });

})();
