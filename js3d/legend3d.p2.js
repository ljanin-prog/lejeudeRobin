// =============================================================================
//  legend3d.p2.js — LOT P2 DES 36 LÉGENDAIRES (CONTRACT2 §4)
//  glace · air · terre · roche
//  cryonix · givréa · banquisor · bourrasca · zéphyrion · aélune ·
//  géomastre · terracor · limonis · monolithe · cristallia · obsidion
// =============================================================================
//  Chaque modèle :
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z.
//    * 1,8 à 2,4 unités de haut, ≤ 90 meshes.
//    * Porte une aura (LL.aura) — c'est ce qui le distingue d'une créature
//      ordinaire, même de loin sur la carte.
//    * userData.anim = { head, wingL, wingR, tail, float } (R3.idleCreature)
//    * userData.legendary = true, userData.auraColor = '#xxxxxx'
//    * userData.attack = function (racine, p) avec p de 0 à 1 — obligatoire.
//
//  Comme dans creatures3d.p1.js, tout le corps est rangé dans un sous-groupe
//  `inner` : les attaques bougent `inner` (position/rotation), jamais le
//  Group racine, que battle3d.js positionne et que R3.idleCreature() met à
//  l'échelle pour la respiration.
//
//  Bibliothèques utilisées :
//    LL = R3.get('llib')  — primitives des légendaires (aura, ailes, cristaux…)
//    CL = R3.get('clib')  — primitives des créatures ordinaires (oreille, patte…)
//  Les deux sont FACULTATIVES : un repli local (LIB(), pawM(), earG()…) permet
//  au fichier de ne jamais lever d'exception si l'une d'elles manque, même si
//  le résultat est visuellement plus simple.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Accès à clib, avec repli silencieux à null (voir pawM/earG/hornM/beakM).
  // ---------------------------------------------------------------------------
  function CLIB() { return R3.get('clib') || null; }

  // ---------------------------------------------------------------------------
  //  Repli local pour llib — n'est utilisé QUE si R3.get('llib') est absent au
  //  moment de la construction (jamais au chargement du fichier : LIB() est
  //  appelée depuis l'intérieur de chaque build(), pas au niveau du module).
  //  Chaque fonction reprend la signature exacte de legendlib3d.js §13, en
  //  version très simplifiée, mais ne casse jamais la construction.
  // ---------------------------------------------------------------------------
  let _fallback = null;
  function LIB() { return R3.get('llib') || (_fallback || (_fallback = buildFallback())); }

  function buildFallback() {
    function grp() { return new THREE.Group(); }
    function safe(fn) {
      return function () {
        try { const r = fn.apply(null, arguments); return r || grp(); }
        catch (e) { return grp(); }
      };
    }
    const F = {};
    F.aura = safe(function (color, r, o) {
      o = o || {};
      r = Math.max(0.15, r || 1);
      const y = (o.y0 !== undefined) ? o.y0 : r * 0.85;
      const g = grp();
      g.add(R3.ellipsoid(r * 0.7, r * 0.66, r * 0.7, color, 0, y, 0,
        { transparent: true, opacity: 0.22, depthWrite: false, emissive: color, emissiveIntensity: 0.8, rough: 0.3 }));
      g.add(R3.ellipsoid(r, r * 0.95, r, o.color2 || color, 0, y, 0,
        { transparent: true, opacity: 0.10, depthWrite: false, emissive: o.color2 || color, emissiveIntensity: 0.6, rough: 0.3 }));
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.bigEyes = safe(function (spread, y, z, r, o) {
      o = o || {};
      const eyes = R3.eyes(spread !== undefined ? spread : 0.16, y !== undefined ? y : 0.1, z !== undefined ? z : 0.28, r || 0.075);
      eyes.position.set(o.x || 0, o.y || 0, o.z || 0);
      return eyes;
    });
    F.majesticWing = safe(function (len, color, o) {
      o = o || {};
      len = Math.max(0.15, len || 0.9);
      const g = grp();
      g.add(R3.wing(len, len * 0.7, color, len * 0.5, 0, 0, { side: THREE.DoubleSide }));
      if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.crystalCluster = safe(function (color, n, scale, o) {
      o = o || {};
      n = Math.max(1, Math.min(10, Math.round(n || 5)));
      scale = Math.max(0.05, scale || 0.35);
      const g = grp();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.add(R3.cone(scale * 0.18, scale * 1.2, o.tipColor && i % 3 === 1 ? o.tipColor : color,
          Math.cos(a) * scale * 0.3, scale * 0.6, Math.sin(a) * scale * 0.3, { flat: true }));
      }
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.plumeTail = safe(function (len, color, n, o) {
      o = o || {};
      len = Math.max(0.15, len || 1);
      n = Math.max(1, Math.min(12, Math.round(n || 6)));
      const g = grp(); const step = len / n;
      for (let i = 0; i < n; i++) {
        g.add(R3.ellipsoid(step * 0.5, step * 0.3, step * 0.5, (i % 2) ? (o.color2 || color) : color,
          0, 0, -step * (i + 0.5), { rough: 0.6 }));
      }
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.plateShell = safe(function (r, color, o) {
      o = o || {};
      r = Math.max(0.1, r || 0.7);
      const h = o.h || r * 0.55;
      const g = grp();
      g.add(R3.ellipsoid(r, h, r, color, 0, 0, 0, { rough: 0.9 }));
      g.add(R3.torus(r * 0.98, r * 0.09, o.plateColor || color, 0, h * 0.06, 0, { rough: 0.9 }));
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.orbitRing = safe(function (color, r, n, o) {
      o = o || {};
      r = Math.max(0.1, r || 0.8);
      n = Math.max(1, Math.min(12, Math.round(n || 6)));
      const g = grp();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.add(R3.sphere(r * 0.08, color, Math.cos(a) * r, 0, Math.sin(a) * r, { emissive: color, emissiveIntensity: 0.6 }));
      }
      g.rotation.x = o.tilt !== undefined ? o.tilt : 0.35;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.runeStone = safe(function (color, size, o) {
      o = o || {};
      size = Math.max(0.05, size || 0.3);
      const g = grp();
      g.add(R3.box(size * 0.8, size * 1.2, size * 0.6, color, 0, 0, 0, { flat: true, rough: 0.85 }));
      g.add(R3.sphere(size * 0.4, o.glowColor || '#ffe066', 0, 0, size * 0.5,
        { emissive: o.glowColor || '#ffe066', emissiveIntensity: 1 }));
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.flowRibbon = safe(function (len, color, o) {
      o = o || {};
      len = Math.max(0.15, len || 1.2);
      const g = grp(); const n = 8, step = len / n;
      for (let i = 0; i < n; i++) {
        g.add(R3.box((o.width || len * 0.22) * (1 - i / n * 0.5), o.thick || 0.05, step,
          (i % 2) ? (o.color2 || color) : color, 0, 0, -(i + 0.5) * step,
          { transparent: true, opacity: o.opacity || 0.75, emissive: color, emissiveIntensity: 0.5, depthWrite: false }));
      }
      if (o.axis === 'y') g.rotation.x = Math.PI / 2; else if (o.axis === 'x') g.rotation.y = -Math.PI / 2;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.glowCore = safe(function (color, r, o) {
      o = o || {};
      r = Math.max(0.03, r || 0.25);
      const g = grp();
      g.add(R3.sphere(r * 0.55, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1.5 }));
      g.add(R3.sphere(r * 0.9, o.color2 || color, 0, 0, 0,
        { transparent: true, opacity: 0.3, emissive: o.color2 || color, emissiveIntensity: 0.9, depthWrite: false }));
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });
    F.animateAura = function () {};
    F.refresh = function () {};
    function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
    return F;
  }

  // ---------------------------------------------------------------------------
  //  Petites briques de corps réutilisées d'une créature à l'autre. Chacune
  //  passe par clib SI présente, sinon un repli minimal en primitives R3.*.
  // ---------------------------------------------------------------------------
  function pawM(o) {
    const CL = CLIB();
    if (CL && CL.paw) return CL.paw(o);
    o = o || {};
    const r = o.r || 0.09;
    return R3.ellipsoid(r, r * 0.66, r * 1.2, o.color || '#ffffff', o.x || 0, o.y || 0, o.z || 0, { rough: 0.88 });
  }
  function earG(o) {
    const CL = CLIB();
    if (CL && CL.ear) return CL.ear(o);
    o = o || {};
    const h = o.h || 0.2, w = o.w || 0.16;
    const g = new THREE.Group();
    g.add(R3.cone(w * 0.5, h, o.color || '#ffffff', 0, h * 0.5, 0, { seg: 9 }));
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }
  function hornM(o) {
    const CL = CLIB();
    if (CL && CL.horn) return CL.horn(o);
    o = o || {};
    const len = o.len || 0.18, r = o.r || 0.05;
    const m = R3.cone(r, len, o.color || '#fff0c8', 0, 0, 0, { flat: true, seg: 8 });
    m.rotation.x = o.tilt || 0;
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    return m;
  }
  function beakM(o) {
    const CL = CLIB();
    if (CL && CL.birdBeak) return CL.birdBeak(o);
    o = o || {};
    const len = o.len || 0.16, r = o.r || 0.07;
    const m = R3.cone(r, len, o.color || '#f1c40f', 0, 0, 0, { seg: 10 });
    m.rotation.x = Math.PI / 2;
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    return m;
  }

  /** Ossature commune : racine + sous-groupe `inner` (voir creatures3d.p1.js). */
  function shell() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  /** Courbe 0 -> 1 -> 0, la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  // ===========================================================================
  //  CRYONIX — dragon de glace, ailes cristallines  (glace)
  //  #a8e6ff  #41a6f6  #f4f4f4
  // ===========================================================================
  R3.registerCreature('cryonix', function () {
    const LL = LIB();
    const GLACE = '#a8e6ff', BLEU = '#41a6f6', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    // --- Quatre pattes trapues, posées au sol -------------------------------
    const legs = [];
    [[-0.36, 0.55], [0.36, 0.55], [-0.34, -0.45], [0.34, -0.45]].forEach(function (p) {
      const L = 0.62;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.10, 0.14, L, BLEU, 0, -L / 2, 0, { rough: 0.55, seg: 8 }));
      leg.add(pawM({ r: 0.14, color: GLACE, y: -L * 0.96, z: 0.06 }));
      inner.add(leg);
      legs.push(leg);
    });

    // --- Torse et poitrail ---------------------------------------------------
    inner.add(R3.ellipsoid(0.50, 0.46, 0.72, BLEU, 0, 1.05, -0.05, { rough: 0.45 }));
    inner.add(R3.ellipsoid(0.40, 0.38, 0.34, GLACE, 0, 0.98, 0.55, { rough: 0.4 }));
    // Crête dorsale de cristaux
    inner.add(LL.crystalCluster(GLACE, 4, 0.20, { spread: 1.3, base: false, glow: false, opacity: 1, y: 1.48, z: -0.10 }));

    // --- Cou et tête (le cou plonge à l'attaque) ------------------------------
    const cou = new THREE.Group();
    cou.position.set(0, 1.35, 0.55);
    inner.add(cou);
    cou.add(R3.ellipsoid(0.26, 0.28, 0.42, BLEU, 0, 0.28, 0.28, { rough: 0.45 }));
    const tete = new THREE.Group();
    tete.position.set(0, 0.56, 0.56);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.34, GLACE, 0, 0, 0, { rough: 0.4 }));
    tete.add(R3.ellipsoid(0.15, 0.13, 0.24, BLANC, 0, -0.08, 0.32, { rough: 0.4 }));
    tete.add(hornM({ len: 0.32, r: 0.045, color: GLACE, x: -0.11, y: 0.18, z: -0.05, tilt: -0.35 }));
    tete.add(hornM({ len: 0.32, r: 0.045, color: GLACE, x: 0.11, y: 0.18, z: -0.05, tilt: -0.35 }));
    tete.add(LL.bigEyes(0.155, 0.02, 0.28, 0.052, { color: '#eafcff', dark: '#12222e' }));

    // Souffle glacial : invisible hors combat
    const souffle = R3.ellipsoid(0.16, 0.16, 0.55, GLACE, 0, -0.04, 0.75,
      { transparent: true, opacity: 0.65, emissive: GLACE, emissiveIntensity: 0.9, depthWrite: false });
    souffle.visible = false;
    tete.add(souffle);

    // --- Ailes cristallines ---------------------------------------------------
    const aileD = LL.majesticWing(0.95, GLACE, { style: 'crystal', color2: BLEU, segments: 6, side: 1, x: 0.32, y: 1.30, z: -0.05, sweep: 0.18 });
    const aileG = LL.majesticWing(0.95, GLACE, { style: 'crystal', color2: BLEU, segments: 6, side: -1, x: -0.32, y: 1.30, z: -0.05, sweep: 0.18 });
    inner.add(aileD, aileG);

    // --- Queue (segments emboîtés, pointe cristalline) ------------------------
    const qBase = new THREE.Group();
    qBase.position.set(0, 0.95, -0.62);
    inner.add(qBase);
    let qParent = qBase;
    [0.30, 0.24, 0.18, 0.12].forEach(function (r, i) {
      const s = new THREE.Group();
      s.position.z = i === 0 ? -0.10 : -0.30;
      s.add(R3.ellipsoid(r, r * 0.85, 0.28, i % 2 ? GLACE : BLEU, 0, 0, -0.10, { rough: 0.5 }));
      qParent.add(s);
      qParent = s;
    });
    qParent.add(hornM({ len: 0.30, r: 0.07, color: GLACE, tilt: Math.PI / 2, z: -0.22 }));

    // --- Aura obligatoire -------------------------------------------------------
    const auraColor = BLEU;
    inner.add(LL.aura(auraColor, 1.30, { color2: GLACE, shape: 'sphere', rings: 1, particles: 5, y0: 0.9 }));

    g.userData.anim = {
      head: cou, wingL: aileG, wingR: aileD, tail: qBase, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Souffle glacial » : le cou plonge, les ailes se déploient, le souffle jaillit.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.30;
      cou.rotation.x = -k * 0.35;
      aileD.rotation.z = -k * 0.55;
      aileG.rotation.z = k * 0.55;
      souffle.visible = pc > 0.25 && pc < 0.95;
      souffle.scale.set(1, 1, 0.3 + pc * 2.2);
      if (p >= 1) { cou.rotation.x = 0; aileD.rotation.z = 0; aileG.rotation.z = 0; souffle.visible = false; }
    };
    return g;
  });

  // ===========================================================================
  //  GIVRÉA — biche de givre, bois de cristal  (glace)
  //  #e8f4f8  #a8e6ff  #d896ff
  // ===========================================================================
  R3.registerCreature('givrea', function () {
    const LL = LIB();
    const BLANC = '#e8f4f8', GLACE = '#a8e6ff', MAUVE = '#d896ff';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes fines et hautes : elle est élancée -----------------------------
    const legs = [];
    [[-0.20, 0.34], [0.20, 0.34], [-0.19, -0.30], [0.19, -0.30]].forEach(function (p) {
      const L = 0.98;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.045, 0.065, L, BLANC, 0, -L / 2, 0, { rough: 0.6, seg: 8 }));
      leg.add(pawM({ r: 0.075, color: GLACE, y: -L * 0.97, z: 0.03 }));
      inner.add(leg);
      legs.push(leg);
    });

    // --- Corps fuselé ------------------------------------------------------------
    inner.add(R3.ellipsoid(0.30, 0.32, 0.62, BLANC, 0, 1.40, -0.05, { rough: 0.55 }));
    inner.add(R3.ellipsoid(0.24, 0.24, 0.30, GLACE, 0, 1.28, 0.45, { rough: 0.5 }));

    // --- Cou et tête -------------------------------------------------------------
    const cou = new THREE.Group();
    cou.position.set(0, 1.62, 0.42);
    cou.rotation.x = -0.35;
    inner.add(cou);
    cou.add(R3.ellipsoid(0.13, 0.15, 0.34, BLANC, 0, 0.24, 0.16, { rough: 0.55 }));
    const tete = new THREE.Group();
    tete.position.set(0, 0.46, 0.32);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.135, 0.125, 0.185, BLANC, 0, 0, 0, { rough: 0.5 }));
    tete.add(R3.ellipsoid(0.07, 0.065, 0.12, GLACE, 0, -0.05, 0.17, { rough: 0.5 }));
    [-1, 1].forEach(function (s) {
      tete.add(earG({ h: 0.16, w: 0.10, color: BLANC, innerColor: MAUVE, x: s * 0.11, y: 0.13, z: -0.02 }));
    });
    tete.add(LL.bigEyes(0.085, 0.01, 0.145, 0.032, { color: MAUVE, dark: '#1a1c2c' }));

    // --- Bois de cristal (paire, pointes mauves) ---------------------------------
    const boisD = LL.crystalCluster(GLACE, 5, 0.30, { tipColor: MAUVE, spread: 1.4, base: false, glow: true, opacity: 1, x: 0.09, y: 0.16, z: -0.04 });
    const boisG = LL.crystalCluster(GLACE, 5, 0.30, { tipColor: MAUVE, spread: 1.4, base: false, glow: true, opacity: 1, x: -0.09, y: 0.16, z: -0.04 });
    boisD.rotation.z = -0.35; boisG.rotation.z = 0.35;
    tete.add(boisD, boisG);

    // --- Petite queue en pompon ----------------------------------------------
    const queue = new THREE.Group();
    queue.position.set(0, 1.32, -0.62);
    queue.add(R3.ellipsoid(0.09, 0.10, 0.09, MAUVE, 0, 0, 0, { rough: 0.7 }));
    inner.add(queue);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.15, { color2: MAUVE, shape: 'sphere', rings: 1, particles: 4, y0: 0.85 }));

    g.userData.anim = {
      head: cou, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Charge de givre » : elle abaisse les bois et fonce.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.55;
      cou.rotation.x = -0.35 - k * 0.30;
      boisD.scale.setScalar(1 + k * 0.30); boisG.scale.setScalar(1 + k * 0.30);
      legs.forEach(function (l, i) { l.rotation.x = Math.sin(R3.clamp01(p) * Math.PI * 5 + i) * 0.25 * k; });
      if (p >= 1) {
        cou.rotation.x = -0.35; boisD.scale.setScalar(1); boisG.scale.setScalar(1);
        legs.forEach(function (l) { l.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  BANQUISOR — ours des glaciers, dos en banquise  (glace)
  //  #f4f4f4  #bfe3f2  #566c86
  // ===========================================================================
  R3.registerCreature('banquisor', function () {
    const LL = LIB();
    const BLANC = '#f4f4f4', GLACE = '#bfe3f2', ARDOISE = '#566c86';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes massives -------------------------------------------------------
    const legs = [];
    [[-0.40, 0.42], [0.40, 0.42], [-0.38, -0.38], [0.38, -0.38]].forEach(function (p) {
      const L = 0.62;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.19, 0.24, L, BLANC, 0, -L / 2, 0, { rough: 0.85, seg: 9 }));
      leg.add(pawM({ r: 0.22, color: GLACE, y: -L * 0.95, z: 0.08 }));
      inner.add(leg);
      legs.push(leg);
    });

    // --- Corps trapu -------------------------------------------------------------
    const corps = R3.ellipsoid(0.62, 0.58, 0.80, BLANC, 0, 1.20, -0.02, { rough: 0.82 });
    inner.add(corps);
    inner.add(R3.ellipsoid(0.48, 0.42, 0.30, GLACE, 0, 1.05, 0.62, { rough: 0.85 }));

    // --- Banquise sur le dos (plaque plate plutôt que dôme) -----------------------
    const banquise = LL.plateShell(0.66, GLACE, { h: 0.22, plates: 6, plateColor: ARDOISE, rim: true, y: 1.68, z: -0.05 });
    banquise.scale.set(1.20, 0.55, 1.0);
    inner.add(banquise);

    // --- Tête --------------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.55, 0.72);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.34, 0.30, 0.36, BLANC, 0, 0, 0, { rough: 0.82 }));
    tete.add(R3.ellipsoid(0.17, 0.15, 0.22, GLACE, 0, -0.08, 0.28, { rough: 0.85 }));
    tete.add(R3.sphere(0.06, ARDOISE, 0, -0.02, 0.48, { rough: 0.6 }));
    [-1, 1].forEach(function (s) {
      tete.add(earG({ h: 0.12, w: 0.14, color: BLANC, innerColor: ARDOISE, shape: 'round', x: s * 0.24, y: 0.24, z: -0.05 }));
    });
    tete.add(LL.bigEyes(0.135, 0.02, 0.27, 0.045, { color: GLACE, dark: '#12222e', angry: 0.35 }));

    // --- Petits éclats de glace sur les épaules ---------------------------------
    inner.add(LL.crystalCluster(GLACE, 3, 0.14, { spread: 1.1, base: false, glow: false, x: -0.50, y: 1.30, z: 0.20 }));
    inner.add(LL.crystalCluster(GLACE, 3, 0.14, { spread: 1.1, base: false, glow: false, x: 0.50, y: 1.30, z: 0.20 }));

    // --- Petite queue ---------------------------------------------------------
    const queue = R3.ellipsoid(0.12, 0.11, 0.10, BLANC, 0, 1.05, -0.78, { rough: 0.85 });
    inner.add(queue);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.35, { color2: ARDOISE, shape: 'sphere', rings: 1, particles: 4, y0: 0.9 }));

    g.userData.anim = {
      head: tete, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Poing de banquise » : il se cabre puis s'abat, la banquise tremble.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.rotation.x = -k * 0.28;
      inn.position.y = pc < 0.5 ? k * 0.20 : 0;
      corps.scale.set(1 + k * 0.10, 1 - k * 0.10, 1 + k * 0.10);
      banquise.rotation.z = Math.sin(pc * Math.PI * 8) * 0.05 * k;
      if (p >= 1) { inn.rotation.x = 0; corps.scale.setScalar(1); banquise.rotation.z = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  BOURRASCA — griffon des cimes, plumes en spirale  (air)
  //  #bfe3f2  #f4f4f4  #94b0c2
  // ===========================================================================
  R3.registerCreature('bourrasca', function () {
    const LL = LIB();
    const GLACE = '#bfe3f2', BLANC = '#f4f4f4', ARDOISE = '#94b0c2';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes arrière (lion) et pattes avant (serres) --------------------------
    const legs = [];
    [[-0.30, -0.42, 'lion'], [0.30, -0.42, 'lion'], [-0.28, 0.40, 'serre'], [0.28, 0.40, 'serre']]
      .forEach(function (p) {
        const L = 0.62;
        const leg = new THREE.Group();
        leg.position.set(p[0], L, p[1]);
        leg.add(R3.cyl(0.10, 0.13, L, ARDOISE, 0, -L / 2, 0, { rough: 0.75, seg: 8 }));
        if (p[2] === 'serre') {
          for (let i = -1; i <= 1; i++) {
            const griffe = R3.cone(0.028, 0.14, BLANC, i * 0.05, -L * 0.98, 0.09, { flat: true, seg: 6 });
            griffe.rotation.x = Math.PI / 2.3;
            leg.add(griffe);
          }
        } else {
          leg.add(pawM({ r: 0.13, color: ARDOISE, y: -L * 0.95, z: 0.05 }));
        }
        inner.add(leg);
        legs.push(leg);
      });

    // --- Corps de lion ailé -------------------------------------------------------
    const corps = R3.ellipsoid(0.42, 0.40, 0.62, ARDOISE, 0, 1.10, -0.10, { rough: 0.72 });
    inner.add(corps);
    inner.add(R3.ellipsoid(0.36, 0.36, 0.34, GLACE, 0, 1.05, 0.48, { rough: 0.55 }));

    // --- Tête d'aigle --------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.55, 0.55);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.24, 0.22, 0.26, BLANC, 0, 0, 0, { rough: 0.55 }));
    tete.add(beakM({ len: 0.24, r: 0.10, color: '#e3c68d', y: -0.04, z: 0.28 }));
    tete.add(LL.bigEyes(0.135, 0.03, 0.20, 0.046, { color: '#ffe066', dark: '#1a1c2c', angry: 0.7 }));

    // --- Crête de plumes en spirale, au sommet du crâne ----------------------------
    let curl = new THREE.Group();
    curl.position.set(0, 0.20, -0.05);
    tete.add(curl);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 0.02 : 0.12;
      seg.rotation.y = 0.9;   // chaque plume tourne un peu plus : la crête s'enroule
      seg.rotation.x = -0.3;
      seg.add(R3.ellipsoid(0.05, 0.115, 0.025, i % 2 ? GLACE : BLANC, 0, 0.10, 0, { rough: 0.5 }));
      curl.add(seg);
      curl = seg;
    }

    // --- Grandes ailes de plumes, envergure impressionnante -----------------------
    const aileD = LL.majesticWing(1.05, GLACE, { style: 'feather', color2: BLANC, segments: 6, side: 1, x: 0.36, y: 1.30, z: -0.10 });
    const aileG = LL.majesticWing(1.05, GLACE, { style: 'feather', color2: BLANC, segments: 6, side: -1, x: -0.36, y: 1.30, z: -0.10 });
    inner.add(aileD, aileG);

    // --- Queue de lion à pompon ----------------------------------------------------
    const queue = LL.plumeTail(0.55, ARDOISE, 6, { style: 'feather', color2: GLACE, y: 1.05, z: -0.68, droop: 0.12 });
    inner.add(queue);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.25, { color2: ARDOISE, shape: 'sphere', rings: 1, particles: 4, y0: 0.85 }));

    g.userData.anim = {
      head: tete, wingL: aileG, wingR: aileD, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Vrille ascendante » : il se cabre, les ailes claquent, il fond en avant.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.35;
      inn.position.z = k * 0.35;
      inn.rotation.x = -k * 0.30;
      aileD.rotation.z = -Math.sin(pc * Math.PI * 6) * 0.5 - 0.2;
      aileG.rotation.z = Math.sin(pc * Math.PI * 6) * 0.5 + 0.2;
      if (p >= 1) { inn.rotation.x = 0; aileD.rotation.z = 0; aileG.rotation.z = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  ZÉPHYRION — serpent de vent, corps en ruban  (air)
  //  #cfe8f3  #a7f070  #f4f4f4
  // ===========================================================================
  R3.registerCreature('zephyrion', function () {
    const LL = LIB();
    const CIEL = '#cfe8f3', VERT = '#a7f070', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    // --- Tête de serpent, suspendue en l'air : il vole, pas de pattes -------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.55, 0.95);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.20, 0.18, 0.34, CIEL, 0, 0, 0, { rough: 0.4 }));
    tete.add(R3.ellipsoid(0.12, 0.10, 0.18, BLANC, 0, -0.06, 0.28, { rough: 0.4 }));
    [-1, 1].forEach(function (s) {
      tete.add(hornM({ len: 0.18, r: 0.03, color: VERT, x: s * 0.09, y: 0.13, z: -0.05, tilt: -0.4 }));
    });
    tete.add(LL.bigEyes(0.115, 0.02, 0.25, 0.040, { color: VERT, dark: '#1a1c2c' }));

    // --- Corps-ruban : un long ruban ondulant qui part du cou -----------------------
    const ruban = LL.flowRibbon(2.30, CIEL, {
      segments: 12, width: 0.42, thick: 0.10, color2: VERT, opacity: 0.92,
      amp: 0.32, waves: 1.8, speed: 1.5, taper: 0.55, x: 0, y: 1.50, z: 0.65,
    });
    inner.add(ruban);
    // Nageoire-crête le long du dos : pour lire « serpent », pas « écharpe »
    const crete = LL.plumeTail(1.60, BLANC, 8, { style: 'fin', width: 0.16, color2: VERT, y: 1.62, z: 0.60, droop: -0.05, amp: 0.10, speed: 1.5 });
    inner.add(crete);

    const auraColor = CIEL;
    inner.add(LL.aura(auraColor, 1.20, { color2: VERT, shape: 'sphere', rings: 2, particles: 5, y0: 1.30 }));

    g.userData.anim = {
      head: tete, tail: ruban, float: true,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.baseY = 0.20;
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Tourbillon » : le corps se love en spirale puis fouette vers l'avant.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.55;
      tete.rotation.y = Math.sin(pc * Math.PI * 4) * 0.4;
      ruban.rotation.y = pc * Math.PI * 2 * (1 - pc);
      if (p >= 1) { tete.rotation.y = 0; ruban.rotation.y = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  AÉLUNE — raie céleste, voile translucide  (air)
  //  #e6f1f7  #d896ff  #a8e6ff
  // ===========================================================================
  R3.registerCreature('aelune', function () {
    const LL = LIB();
    const CIEL = '#e6f1f7', MAUVE = '#d896ff', GLACE = '#a8e6ff';
    const g = shell(), inner = g.userData.inner;
    g.userData.baseY = 0.35;   // elle plane, jamais posée au sol

    // --- Corps central aplati -------------------------------------------------
    const corps = R3.ellipsoid(0.34, 0.16, 0.62, CIEL, 0, 1.35, 0,
      { rough: 0.35, transparent: true, opacity: 0.92 });
    inner.add(corps);
    const tete = new THREE.Group();
    tete.position.set(0, 1.41, 0.55);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.20, 0.10, 0.16, GLACE, 0, 0, 0, { rough: 0.35 }));
    tete.add(LL.bigEyes(0.135, 0.03, 0.13, 0.040, { color: MAUVE, dark: '#1a1c2c', tilt: 0.05 }));

    // --- Grand voile translucide : les deux « ailes » de la raie -------------------
    const voileD = LL.majesticWing(1.35, CIEL, { style: 'membrane', color2: MAUVE, opacity: 0.78, side: 1, x: 0.10, y: 1.33, z: 0.05, arm: false });
    const voileG = LL.majesticWing(1.35, CIEL, { style: 'membrane', color2: MAUVE, opacity: 0.78, side: -1, x: -0.10, y: 1.33, z: 0.05, arm: false });
    inner.add(voileD, voileG);

    // --- Longue queue fouettante ----------------------------------------------------
    const queue = LL.plumeTail(1.10, GLACE, 8, { style: 'ribbon', width: 0.10, color2: MAUVE, y: 1.33, z: -0.55, droop: 0.05, amp: 0.28, speed: 2.0 });
    inner.add(queue);

    const auraColor = MAUVE;
    inner.add(LL.aura(auraColor, 1.15, { color2: GLACE, shape: 'disc', rings: 1, particles: 5 }));

    g.userData.anim = {
      head: tete, wingL: voileG, wingR: voileD, tail: queue, float: true,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Voile stellaire » : elle ondule et plonge en avant dans une gerbe de lumière.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.60;
      inn.rotation.x = -k * 0.25;
      voileD.rotation.z = Math.sin(pc * Math.PI * 5) * 0.4 - 0.15;
      voileG.rotation.z = -Math.sin(pc * Math.PI * 5) * 0.4 + 0.15;
      if (p >= 1) { inn.rotation.x = 0; voileD.rotation.z = 0; voileG.rotation.z = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  GÉOMASTRE — tortue-montagne, carapace-plateau  (terre)
  //  #7a5c3a  #3d6b2f  #8a9199
  // ===========================================================================
  R3.registerCreature('geomastre', function () {
    const LL = LIB();
    const BRUN = '#7a5c3a', MOUSSE = '#3d6b2f', GRIS = '#8a9199';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes trapues, larges : elle porte une montagne --------------------------
    const legs = [];
    [[-0.55, 0.44], [0.55, 0.44], [-0.52, -0.40], [0.52, -0.40]].forEach(function (p) {
      const L = 0.55;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.17, 0.22, L, BRUN, 0, -L / 2, 0, { rough: 0.85, seg: 8 }));
      leg.add(pawM({ r: 0.19, color: GRIS, y: -L * 0.94, z: 0.06 }));
      inner.add(leg);
      legs.push(leg);
    });

    // --- Tête sur un cou court -------------------------------------------------------
    const cou = new THREE.Group();
    cou.position.set(0, 0.72, 0.75);
    inner.add(cou);
    cou.add(R3.ellipsoid(0.17, 0.16, 0.32, BRUN, 0, 0.05, 0.18, { rough: 0.85 }));
    const tete = new THREE.Group();
    tete.position.set(0, 0.12, 0.46);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.20, 0.18, 0.23, BRUN, 0, 0, 0, { rough: 0.85 }));
    tete.add(R3.ellipsoid(0.11, 0.09, 0.14, GRIS, 0, -0.06, 0.18, { rough: 0.8 }));
    tete.add(LL.bigEyes(0.12, 0.02, 0.20, 0.038, { color: MOUSSE, dark: '#1a1c2c', angry: 0.2 }));

    // --- La grande carapace-plateau : c'est elle, la vraie montagne ----------------
    const carapace = LL.plateShell(1.00, BRUN, { h: 1.25, plates: 7, plateColor: GRIS, rim: true, spikes: false, y: 0.62, z: -0.06 });
    inner.add(carapace);
    // Touffes de mousse posées sur le plateau : ce qui pousse dessus
    [[-0.36, 1.30, 0.78], [0.30, 1.34, 0.72], [0.0, 1.40, 1.05], [-0.56, 1.20, 0.42]].forEach(function (p) {
      inner.add(R3.ellipsoid(0.15, 0.11, 0.15, MOUSSE, p[0], p[1], p[2], { rough: 0.95 }));
    });

    // --- Petite queue -----------------------------------------------------------
    const queue = R3.ellipsoid(0.13, 0.12, 0.16, BRUN, 0, 0.52, -0.92, { rough: 0.85 });
    inner.add(queue);

    const auraColor = MOUSSE;
    inner.add(LL.aura(auraColor, 1.40, { color2: GRIS, shape: 'disc', rings: 1, particles: 3 }));

    g.userData.anim = {
      head: cou, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Séisme » : elle s'enfonce puis frappe le sol, la montagne tremble.
      const inn = root.userData.inner, k = arc(p);
      inn.position.y = -k * 0.10;
      carapace.rotation.z = Math.sin(R3.clamp01(p) * Math.PI * 10) * 0.04 * k;
      cou.rotation.x = -k * 0.20;
      legs.forEach(function (l) { l.scale.y = 1 - k * 0.15; });
      if (p >= 1) {
        inn.position.y = 0; carapace.rotation.z = 0; cou.rotation.x = 0;
        legs.forEach(function (l) { l.scale.y = 1; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  TERRACOR — taupe-titan, griffes de roche  (terre)
  //  #c08c4a  #5c3a1e  #e3c68d
  // ===========================================================================
  R3.registerCreature('terracor', function () {
    const LL = LIB();
    const BRUN = '#c08c4a', SOMBRE = '#5c3a1e', PALE = '#e3c68d';
    const g = shell(), inner = g.userData.inner;

    // --- Jambes courtes et puissantes ---------------------------------------------
    const legs = [];
    [-0.28, 0.28].forEach(function (x) {
      const L = 0.48;
      const leg = new THREE.Group();
      leg.position.set(x, L, -0.10);
      leg.add(R3.cyl(0.17, 0.22, L, SOMBRE, 0, -L / 2, 0, { rough: 0.85, seg: 8 }));
      leg.add(pawM({ r: 0.20, color: PALE, y: -L * 0.96, z: 0.08 }));
      inner.add(leg);
      legs.push(leg);
    });

    // --- Torse dressé, massif ----------------------------------------------------
    const torse = R3.ellipsoid(0.52, 0.62, 0.48, BRUN, 0, 1.18, -0.02, { rough: 0.8 });
    inner.add(torse);
    inner.add(R3.ellipsoid(0.40, 0.48, 0.30, PALE, 0, 1.05, 0.34, { rough: 0.9 }));

    // --- Bras et griffes de roche géantes (pivot à l'épaule) -----------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const epaule = new THREE.Group();
      epaule.position.set(s * 0.48, 1.40, 0.05);
      inner.add(epaule);
      epaule.add(R3.ellipsoid(0.18, 0.30, 0.20, SOMBRE, 0, -0.24, 0, { rough: 0.8 }));
      const main = new THREE.Group();
      main.position.set(0, -0.54, 0.06);
      epaule.add(main);
      main.add(R3.ellipsoid(0.19, 0.16, 0.16, BRUN, 0, 0, 0, { rough: 0.8 }));
      for (let i = -1; i <= 1; i++) {
        const griffe = R3.cone(0.06, 0.34, '#8a9199', s * 0.02, -0.12, 0.16 + i * 0.11, { flat: true, seg: 6 });
        griffe.rotation.x = Math.PI / 2.4;
        main.add(griffe);
      }
      bras.push(epaule);
    });

    // --- Tête, petits yeux, museau fouisseur -----------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.72, 0.30);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.26, BRUN, 0, 0, 0, { rough: 0.8 }));
    tete.add(R3.cone(0.13, 0.22, SOMBRE, 0, -0.06, 0.28, { seg: 10 }));
    [-1, 1].forEach(function (s) {
      tete.add(earG({ h: 0.09, w: 0.09, color: SOMBRE, innerColor: PALE, shape: 'round', x: s * 0.20, y: 0.14, z: -0.06 }));
    });
    tete.add(LL.bigEyes(0.10, 0.02, 0.22, 0.026, { color: '#1a1c2c', dark: '#1a1c2c', brow: false }));

    // --- Débris rocheux en orbite : ce qu'il déterre --------------------------------
    inner.add(LL.orbitRing(SOMBRE, 0.85, 6, { shape: 'stone', y: 0.35, tilt: 1.35, speed: 0.4, glow: false }));

    const auraColor = SOMBRE;
    inner.add(LL.aura(auraColor, 1.30, { color2: BRUN, shape: 'sphere', rings: 1, particles: 3, y0: 0.9 }));

    g.userData.anim = {
      head: tete, wingL: bras[0], wingR: bras[1], float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Griffe sismique » : les bras fauchent en croix, le torse pivote.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.30;
      bras[0].rotation.z = k * 1.1; bras[1].rotation.z = -k * 1.1;
      torse.rotation.y = Math.sin(pc * Math.PI * 3) * 0.15 * k;
      if (p >= 1) { bras[0].rotation.z = 0; bras[1].rotation.z = 0; torse.rotation.y = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  LIMONIS — golem de glaise, coulures douces  (terre)
  //  #a97b50  #c8a06a  #6b4423
  // ===========================================================================
  R3.registerCreature('limonis', function () {
    const LL = LIB();
    const ARGILE = '#a97b50', CLAIR = '#c8a06a', SOMBRE = '#6b4423';
    const g = shell(), inner = g.userData.inner;

    // --- Base fondue, posée au sol comme une flaque épaisse -----------------------
    inner.add(R3.ellipsoid(0.62, 0.22, 0.58, SOMBRE, 0, 0.22, 0, { rough: 0.95 }));

    // --- Torse massif, sans jambes distinctes : il coule ---------------------------
    const torse = R3.ellipsoid(0.48, 0.66, 0.42, ARGILE, 0, 0.95, 0, { rough: 0.9 });
    inner.add(torse);
    inner.add(R3.ellipsoid(0.34, 0.46, 0.26, CLAIR, 0, 0.90, 0.30, { rough: 0.92 }));

    // --- Bras trapus, pivot à l'épaule ---------------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const epaule = new THREE.Group();
      epaule.position.set(s * 0.44, 1.28, 0);
      inner.add(epaule);
      epaule.add(R3.ellipsoid(0.16, 0.34, 0.18, ARGILE, 0, -0.28, 0, { rough: 0.9 }));
      epaule.add(R3.ellipsoid(0.14, 0.14, 0.14, CLAIR, 0, -0.58, 0.02, { rough: 0.92 }));
      // Coulure qui pend du poignet
      epaule.add(R3.cone(0.06, 0.30, SOMBRE, 0, -0.78, 0, { rough: 0.9, seg: 7 }));
      bras.push(epaule);
    });

    // --- Tête, simple bloc arrondi, yeux magiques lumineux --------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.62, 0.06);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.24, ARGILE, 0, 0, 0, { rough: 0.88 }));
    tete.add(LL.glowCore(CLAIR, 0.09, { color2: '#ffe066', x: -0.10, y: 0.02, z: 0.20 }));
    tete.add(LL.glowCore(CLAIR, 0.09, { color2: '#ffe066', x: 0.10, y: 0.02, z: 0.20 }));

    // --- Coulures douces le long du corps : la signature de Limonis -----------------
    [[-0.30, 1.30, 0.30], [0.24, 1.10, 0.35], [0.0, 1.55, 0.28], [-0.10, 0.75, 0.42]].forEach(function (p) {
      inner.add(R3.cone(0.055, 0.22 + p[1] * 0.02, SOMBRE, p[0], p[1] - 0.11, p[2], { rough: 0.9, seg: 6 }));
    });

    const auraColor = ARGILE;
    inner.add(LL.aura(auraColor, 1.25, { color2: CLAIR, shape: 'sphere', rings: 1, particles: 3, y0: 0.85 }));

    g.userData.anim = {
      head: tete, wingL: bras[0], wingR: bras[1], float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Coulée de glaise » : le corps s'étire vers l'avant puis reflue.
      const inn = root.userData.inner, k = arc(p);
      torse.scale.set(1 + k * 0.12, 1 - k * 0.22, 1 + k * 0.12);
      inn.position.z = k * 0.35;
      bras[0].rotation.x = -k * 0.6; bras[1].rotation.x = -k * 0.6;
      if (p >= 1) { torse.scale.setScalar(1); bras[0].rotation.x = 0; bras[1].rotation.x = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  MONOLITHE — colosse de menhirs flottants  (roche)
  //  #8a9199  #566c86  #ffe066
  // ===========================================================================
  R3.registerCreature('monolithe', function () {
    const LL = LIB();
    const GRIS = '#8a9199', ARDOISE = '#566c86', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;
    g.userData.baseY = 0.15;   // le colosse flotte, il ne touche jamais le sol

    // --- Menhir central, la colonne vertébrale du colosse --------------------------
    const torse = R3.box(0.56, 0.90, 0.44, GRIS, 0, 1.15, 0, { flat: true, rough: 0.9 });
    torse.rotation.y = 0.06;
    inner.add(torse);
    inner.add(R3.box(0.40, 0.66, 0.30, ARDOISE, 0, 1.15, 0.25, { flat: true, rough: 0.9 }));

    // --- Tête : un petit menhir qui flotte au-dessus, jamais posé -------------------
    const tete = new THREE.Group();
    tete.position.set(0, 2.05, 0.02);
    inner.add(tete);
    tete.add(R3.box(0.32, 0.36, 0.28, GRIS, 0, 0, 0, { flat: true, rough: 0.85 }));
    tete.add(LL.bigEyes(0.09, -0.02, 0.15, 0.032, { color: OR, dark: '#1a1c2c', angry: 0.8 }));

    // --- Bras : deux menhirs flottants reliés par un lien de lumière ----------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const bloc = new THREE.Group();
      bloc.position.set(s * 0.62, 1.30, 0.05);
      inner.add(bloc);
      bloc.add(R3.box(0.24, 0.62, 0.24, ARDOISE, 0, 0, 0, { flat: true, rough: 0.9 }));
      const lien = R3.cyl(0.02, 0.02, 0.34, OR, s * 0.34, 1.30, 0.05, { emissive: OR, emissiveIntensity: 1.1, seg: 6 });
      lien.rotation.z = Math.PI / 2;
      inner.add(lien);
      bras.push(bloc);
    });

    // --- Socle : menhirs qui flottent sous le colosse, pas de jambes ----------------
    inner.add(LL.runeStone(ARDOISE, 0.30, { glowColor: OR, rune: 'ring', count: 3, spread: 0.55, y: 0.35, z: 0 }));

    // --- Ceinture de fragments en orbite ---------------------------------------------
    inner.add(LL.orbitRing(GRIS, 0.95, 6, { shape: 'stone', color2: ARDOISE, y: 1.10, tilt: 0.25, speed: 0.35, glow: false }));

    const auraColor = OR;
    inner.add(LL.aura(auraColor, 1.10, { color2: ARDOISE, shape: 'column', height: 2.6, rings: 1, particles: 4 }));

    g.userData.anim = {
      head: tete, wingL: bras[0], wingR: bras[1], float: true,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Chute de menhirs » : les blocs s'écartent puis convergent en un coup.
      const inn = root.userData.inner, k = arc(p);
      bras[0].position.x = -0.62 - k * 0.35; bras[1].position.x = 0.62 + k * 0.35;
      bras[0].position.y = 1.30 + k * 0.30; bras[1].position.y = 1.30 + k * 0.30;
      inn.position.z = k * 0.30;
      tete.position.y = 2.05 - k * 0.15;
      if (p >= 1) {
        bras[0].position.set(-0.62, 1.30, 0.05); bras[1].position.set(0.62, 1.30, 0.05);
        tete.position.y = 2.05;
      }
    };
    return g;
  });

  // ===========================================================================
  //  CRISTALLIA — cerf de cristal, bois en prismes  (roche)
  //  #d896ff  #a8e6ff  #f4f4f4
  // ===========================================================================
  R3.registerCreature('cristallia', function () {
    const LL = LIB();
    const MAUVE = '#d896ff', GLACE = '#a8e6ff', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    const legs = [];
    [[-0.22, 0.36], [0.22, 0.36], [-0.20, -0.32], [0.20, -0.32]].forEach(function (p) {
      const L = 0.98;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.05, 0.07, L, GLACE, 0, -L / 2, 0, { flat: true, rough: 0.35, seg: 6 }));
      leg.add(pawM({ r: 0.075, color: MAUVE, y: -L * 0.96, z: 0.03 }));
      inner.add(leg);
      legs.push(leg);
    });

    const corps = R3.ellipsoid(0.32, 0.34, 0.66, BLANC, 0, 1.42, -0.05,
      { flat: true, rough: 0.25, transparent: true, opacity: 0.94, emissive: GLACE, emissiveIntensity: 0.15 });
    inner.add(corps);
    inner.add(R3.ellipsoid(0.26, 0.26, 0.32, GLACE, 0, 1.30, 0.48, { flat: true, rough: 0.3 }));

    const cou = new THREE.Group();
    cou.position.set(0, 1.66, 0.44);
    cou.rotation.x = -0.30;
    inner.add(cou);
    cou.add(R3.ellipsoid(0.14, 0.16, 0.36, BLANC, 0, 0.24, 0.16, { flat: true, rough: 0.3 }));
    const tete = new THREE.Group();
    tete.position.set(0, 0.48, 0.32);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.14, 0.13, 0.19, BLANC, 0, 0, 0, { flat: true, rough: 0.3 }));
    tete.add(R3.ellipsoid(0.07, 0.06, 0.12, GLACE, 0, -0.05, 0.17, { flat: true, rough: 0.3 }));
    tete.add(LL.bigEyes(0.088, 0.01, 0.15, 0.032, { color: MAUVE, dark: '#1a1c2c' }));

    const boisD = LL.crystalCluster(GLACE, 6, 0.36, { tipColor: MAUVE, spread: 1.6, base: false, glow: true, opacity: 0.95, x: 0.10, y: 0.16, z: -0.04 });
    const boisG = LL.crystalCluster(GLACE, 6, 0.36, { tipColor: MAUVE, spread: 1.6, base: false, glow: true, opacity: 0.95, x: -0.10, y: 0.16, z: -0.04 });
    boisD.rotation.z = -0.32; boisG.rotation.z = 0.32;
    tete.add(boisD, boisG);

    const queue = LL.crystalCluster(MAUVE, 3, 0.16, { base: false, glow: false, y: 1.38, z: -0.66 });
    inner.add(queue);

    // --- Éclats en orbite : les prismes qui se détachent de sa lumière -------------
    inner.add(LL.orbitRing(GLACE, 0.70, 6, { shape: 'shard', color2: MAUVE, y: 1.20, tilt: 0.5, speed: 0.6, guide: true }));

    const auraColor = MAUVE;
    inner.add(LL.aura(auraColor, 1.20, { color2: GLACE, shape: 'sphere', rings: 2, particles: 5, y0: 0.85 }));

    g.userData.anim = {
      head: cou, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Prisme aveuglant » : les bois flamboient, elle s'élance.
      const inn = root.userData.inner, k = arc(p);
      cou.rotation.x = -0.30 - k * 0.30;
      boisD.scale.setScalar(1 + k * 0.4); boisG.scale.setScalar(1 + k * 0.4);
      inn.position.z = k * 0.30;
      if (p >= 1) { cou.rotation.x = -0.30; boisD.scale.setScalar(1); boisG.scale.setScalar(1); }
    };
    return g;
  });

  // ===========================================================================
  //  OBSIDION — panthère d'obsidienne, veines de lave  (roche)
  //  #1a1c2c  #3d4e62  #ff6b3d
  // ===========================================================================
  R3.registerCreature('obsidion', function () {
    const LL = LIB();
    const NOIR = '#1a1c2c', ARDOISE = '#3d4e62', LAVE = '#ff6b3d';
    const g = shell(), inner = g.userData.inner;

    const legs = [];
    [[-0.24, 0.55], [0.24, 0.55], [-0.22, -0.50], [0.22, -0.50]].forEach(function (p) {
      const L = 0.75;
      const leg = new THREE.Group();
      leg.position.set(p[0], L, p[1]);
      leg.add(R3.cyl(0.075, 0.10, L, NOIR, 0, -L / 2, 0, { rough: 0.35, seg: 8 }));
      leg.add(pawM({ r: 0.10, color: ARDOISE, y: -L * 0.96, z: 0.06 }));
      inner.add(leg);
      legs.push(leg);
    });

    const corps = R3.ellipsoid(0.34, 0.34, 0.80, NOIR, 0, 1.30, -0.05, { rough: 0.30, metal: 0.15 });
    inner.add(corps);
    inner.add(R3.ellipsoid(0.26, 0.24, 0.36, ARDOISE, 0, 1.22, 0.62, { rough: 0.3 }));

    const tete = new THREE.Group();
    tete.position.set(0, 1.50, 0.85);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.22, 0.19, 0.24, NOIR, 0, 0, 0, { rough: 0.3 }));
    tete.add(R3.ellipsoid(0.11, 0.09, 0.13, ARDOISE, 0, -0.06, 0.20, { rough: 0.3 }));
    [-1, 1].forEach(function (s) {
      tete.add(earG({ h: 0.13, w: 0.09, color: NOIR, innerColor: LAVE, x: s * 0.14, y: 0.16, z: -0.03 }));
    });
    tete.add(LL.bigEyes(0.115, 0.02, 0.20, 0.040, { color: LAVE, dark: '#050608', angry: 0.75 }));

    // --- Veines de lave, incandescentes le long du corps -----------------------------
    [[0, 1.30, -0.55, 0.55], [0.14, 1.27, -0.15, 0.5], [-0.14, 1.27, 0.10, 0.5], [0, 1.45, 0.75, 0.25]]
      .forEach(function (v) {
        inner.add(R3.ellipsoid(0.025, 0.025, v[3], LAVE, v[0], v[1], v[2],
          { emissive: LAVE, emissiveIntensity: 1.3, rough: 0.3 }));
      });
    inner.add(LL.glowCore(LAVE, 0.09, { x: 0, y: 1.23, z: 0.72 }));

    // --- Longue queue, pointe de flamme ------------------------------------------------
    const queue = LL.plumeTail(0.85, NOIR, 7, { style: 'flame', color2: LAVE, width: 0.10, y: 1.25, z: -0.78, droop: -0.05, amp: 0.20, speed: 1.8 });
    inner.add(queue);

    const auraColor = LAVE;
    inner.add(LL.aura(auraColor, 1.20, { color2: NOIR, shape: 'sphere', rings: 1, particles: 4, y0: 0.9 }));

    g.userData.anim = {
      head: tete, tail: queue, float: false,
      update: function (root, t) { LL.animateAura(root, t); },
    };
    g.userData.legendary = true;
    g.userData.auraColor = auraColor;
    g.userData.attack = function (root, p) {
      // « Griffe de lave » : elle bondit, les veines s'embrasent.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.75;
      inn.position.y = Math.sin(pc * Math.PI) * 0.22;
      inn.rotation.x = -k * 0.30;
      tete.rotation.x = k * 0.15;
      if (p >= 1) { inn.rotation.x = 0; tete.rotation.x = 0; }
    };
    return g;
  });

})();
