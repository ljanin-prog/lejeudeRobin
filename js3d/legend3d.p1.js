// =============================================================================
//  legend3d.p1.js — LOT P1 DES 36 LÉGENDAIRES (CONTRACT2 §4)
//  feu : pyrathos, emberyx, fournalis
//  eau : abyssalor, ondinae, marea
//  plante : sylvaros, florabelle, racinor
//  foudre : fulguron, voltaris, orageon
// =============================================================================
//  Chaque légendaire s'enregistre via R3.registerCreature(id, build), EXACTEMENT
//  comme les 26 créatures ordinaires (même registre, voir creatures3d.p1..p4.js).
//  Ce qui change : la taille (1,8 à 2,4 unités, contre ~1 pour les autres), une
//  AURA obligatoire (legendlib3d.js), et une attaque spectaculaire.
//
//  Conventions :
//    * Group centré en (0,0,0), posé sur y = 0, tourné vers +z.
//    * g.userData.anim = { head, wingL, wingR, tail, float } — lu par
//      R3.idleCreature() (respiration, regard, battements d'ailes, flottement).
//    * g.userData.legendary = true, g.userData.auraColor = '#xxxxxx'.
//    * g.userData.attack = function (g, p) — p va de 0 à 1, animation de combat.
//    * Aucune exception au chargement : si legendlib3d.js manque, on retombe sur
//      des primitives R3.* nues (voir la section « repli » ci-dessous).
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  const LL = R3.get('llib') || null;

  // ---------------------------------------------------------------------------
  //  REPLI — si legendlib3d.js n'est pas chargé (ne devrait jamais arriver vu
  //  l'ordre du contrat §21, mais la règle §1.7 interdit toute exception).
  //  `safe()` essaie la primitive de la bibliothèque, et si elle est absente ou
  //  échoue, retombe sur une version minimale bâtie avec les primitives R3.*.
  // ---------------------------------------------------------------------------
  function safe(name, fallback) {
    return function () {
      if (LL && typeof LL[name] === 'function') {
        try {
          const r = LL[name].apply(LL, arguments);
          if (r) return r;
        } catch (e) { /* on retente le repli */ }
      }
      try { return fallback.apply(null, arguments) || new THREE.Group(); }
      catch (e) { return new THREE.Group(); }
    };
  }

  function placeFallback(g, o) {
    o = o || {};
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }

  const AURA = safe('aura', function (color, radius, o) {
    o = o || {};
    const r = radius || 1;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(r * 0.8, r * 0.75, r * 0.8, color, 0, r * 0.85, 0,
      { transparent: true, opacity: 0.22, emissive: color, emissiveIntensity: 0.9, depthWrite: false, rough: 0.3 }));
    g.userData.auraColor = color;
    return placeFallback(g, o);
  });

  const WING = safe('majesticWing', function (len, color, o) {
    o = o || {};
    const L = len || 0.9;
    const g = new THREE.Group();
    g.add(R3.wing(L, L * 0.7, color, L * 0.5, 0, 0, { rough: 0.6, side: THREE.DoubleSide }));
    if ((o.side || 1) < 0) g.rotation.y = Math.PI;
    return placeFallback(g, o);
  });

  const TAIL = safe('plumeTail', function (len, color, n, o) {
    o = o || {};
    const L = len || 1, cnt = n || 5;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const u = i / cnt;
      g.add(R3.ellipsoid(0.10 * (1 - u * 0.5), 0.06, 0.14, color, 0, 0, -u * L, { rough: 0.6 }));
    }
    return placeFallback(g, o);
  });

  const EYES = safe('bigEyes', function (spread, y, z, r) {
    return R3.eyes(spread, y, z, r);
  });

  const CORE = safe('glowCore', function (color, r, o) {
    o = o || {};
    const rr = r || 0.2;
    const g = new THREE.Group();
    g.add(R3.sphere(rr, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1.2, rough: 0.3 }));
    return placeFallback(g, o);
  });

  const CRYSTAL = safe('crystalCluster', function (color, n, scale, o) {
    o = o || {};
    const cnt = n || 5, s = scale || 0.3;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.cone(s * 0.22, s * 1.2, color, Math.cos(a) * s * 0.3, s * 0.6, Math.sin(a) * s * 0.3, { rough: 0.5 }));
    }
    return placeFallback(g, o);
  });

  const HALO = safe('halo', function (color, r, rays, o) {
    o = o || {};
    const rr = r || 0.5;
    const g = new THREE.Group();
    g.add(R3.torus(rr, rr * 0.08, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1, rough: 0.4 }));
    return placeFallback(g, o);
  });

  const ORBIT = safe('orbitRing', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.8, cnt = n || 6;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.sphere(rr * 0.08, color, Math.cos(a) * rr, 0, Math.sin(a) * rr, { emissive: color, emissiveIntensity: 0.8 }));
    }
    return placeFallback(g, o);
  });

  const RIBBON = safe('flowRibbon', function (len, color, o) {
    o = o || {};
    const L = len || 1;
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      g.add(R3.box(0.16, 0.02, L / 6, color, 0, 0, -(i + 0.5) * (L / 6),
        { transparent: true, opacity: 0.5, emissive: color, emissiveIntensity: 0.4 }));
    }
    if (o.axis === 'y') g.rotation.x = Math.PI / 2;
    return placeFallback(g, o);
  });

  const MIST = safe('mistPuff', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.4, cnt = n || 5;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.sphere(rr * 0.4, color, Math.cos(a) * rr * 0.4, 0, Math.sin(a) * rr * 0.4,
        { transparent: true, opacity: 0.3, emissive: color, emissiveIntensity: 0.3 }));
    }
    return placeFallback(g, o);
  });

  const SERPENT = safe('serpentBody', function (len, color, o) {
    o = o || {};
    const L = len || 1.5, cnt = 8;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const u = i / cnt;
      g.add(R3.ellipsoid(0.18 * (1 - u * 0.6), 0.16 * (1 - u * 0.6), 0.20, color, 0, 0, -u * L, { rough: 0.6 }));
    }
    return placeFallback(g, o);
  });

  /** Anime tout ce que la bibliothèque a posé sur ce modèle (aura, orbites,
   *  cristaux…). Ne fait rien — sans jamais planter — si LL est absent. */
  function animAura(g, t) {
    if (LL && LL.animateAura) { try { LL.animateAura(g, t); } catch (e) { /* jamais bloquant */ } }
  }

  // ---------------------------------------------------------------------------
  //  Petits utilitaires partagés par les 12 modèles
  // ---------------------------------------------------------------------------

  /** Courbe 0 -> 1 -> 0 : la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Patte simple : cylindre (cuisse) + pied ovale. Pivot en haut (la hanche),
   *  donc on positionne le groupe à la hauteur de la hanche. */
  function leg(h, rTop, rBot, color, footColor, opts) {
    opts = opts || {};
    const g = new THREE.Group();
    g.add(R3.cyl(rTop, rBot, h, color, 0, -h * 0.5, 0, { rough: opts.rough || 0.78, seg: 8 }));
    g.add(R3.ellipsoid(rBot * 1.35, rBot * 0.55, rBot * 1.6, footColor || color, 0, -h, rBot * 0.4, { rough: 0.92 }));
    return g;
  }

  /**
   * Recale automatiquement la hauteur du CORPS (l'aura ne compte pas : c'est
   * un halo lumineux volontairement plus grand que la créature, voir la doc
   * de LL.aura) dans la fourchette 1,8 à 2,4 unités imposée par le contrat
   * §4 — quelle que soit la disposition exacte des parties du modèle.
   * On regroupe tout ce qui n'est PAS l'aura dans un sous-groupe qu'on met à
   * l'échelle autour de l'origine : les pieds, déjà proches de y = 0, restent
   * au sol après coup. À appeler juste avant le `return g;` de chaque modèle.
   */
  function finalizeSize(g) {
    const others = [];
    g.children.slice().forEach(function (c) {
      const isAura = c.userData && c.userData.ll && c.userData.ll.kind === 'aura';
      if (!isAura) others.push(c);
    });
    if (!others.length) return;
    const wrap = new THREE.Group();
    others.forEach(function (c) { g.remove(c); wrap.add(c); });
    g.add(wrap);
    try {
      const box = new THREE.Box3().setFromObject(wrap);
      const h = box.max.y - box.min.y;
      if (h > 0.001) {
        let factor = 1;
        if (h > 2.35) factor = 2.35 / h;
        else if (h < 1.9) factor = 1.9 / h;
        if (factor !== 1) wrap.scale.setScalar(factor);
      }
    } catch (e) { /* jamais bloquant : au pire la taille reste telle quelle */ }
  }

  // =============================================================================
  //  FEU — pyrathos · emberyx · fournalis           (région : Caldeira de Braise)
  // =============================================================================

  // ===========================================================================
  //  PYRATHOS — dragon de magma, ailes de braise.
  //  Silhouette massive et cornue, debout sur ses pattes arrière, la gueule
  //  incandescente. C'est le plus « lourd » et le plus imposant des trois feu.
  // ===========================================================================
  R3.registerCreature('pyrathos', function () {
    const DARK = '#c0392b', FIRE = '#ff6b3d', GLOW = '#ffd166';
    const g = new THREE.Group();

    // --- Torse : croûte de magma sombre, crevasses lumineuses dessous ---------
    const body = new THREE.Group();
    body.position.set(0, 1.15, 0);
    g.add(body);
    body.add(R3.ellipsoid(0.50, 0.60, 0.62, DARK, 0, 0, 0, { rough: 0.85 }));
    body.add(R3.ellipsoid(0.44, 0.30, 0.56, FIRE, 0, -0.20, 0.03, { emissive: FIRE, emissiveIntensity: 0.5, rough: 0.6 }));
    body.add(CORE(GLOW, 0.20, { y: -0.02, z: 0.42, spikes: 4 }));

    // --- Cou et tête (pivot de l'attaque « souffle ») --------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.55, 0.28);
    body.add(head);
    head.add(R3.cyl(0.24, 0.34, 0.55, DARK, 0, 0.25, 0, { rough: 0.85, seg: 10 }));
    head.add(R3.ellipsoid(0.30, 0.26, 0.40, DARK, 0, 0.62, 0.14, { rough: 0.8 }));
    head.add(R3.ellipsoid(0.16, 0.14, 0.30, FIRE, 0, 0.50, 0.42, { emissive: FIRE, emissiveIntensity: 0.45, rough: 0.6 }));
    [-1, 1].forEach(function (s) {
      const horn = R3.cone(0.05, 0.30, GLOW, s * 0.14, 0.86, 0.05, { emissive: GLOW, emissiveIntensity: 0.5, rough: 0.4, seg: 7 });
      horn.rotation.z = -s * 0.30; horn.rotation.x = -0.25;
      head.add(horn);
    });
    head.add(EYES(0.16, 0.62, 0.34, 0.075, { color: GLOW, dark: '#2a1108', angry: 0.8 }));

    // --- Ailes de braise (membrane translucide, majestueuses) ------------------
    const wingL = WING(1.15, FIRE, { style: 'membrane', color2: DARK, tipColor: GLOW, side: -1, x: -0.34, y: 1.45, z: -0.05 });
    const wingR = WING(1.15, FIRE, { style: 'membrane', color2: DARK, tipColor: GLOW, side: 1, x: 0.34, y: 1.45, z: -0.05 });
    g.add(wingL, wingR);

    // --- Crête de cristaux de lave sur la nuque ---------------------------------
    g.add(CRYSTAL(FIRE, 5, 0.22, { tipColor: GLOW, base: false, opacity: 1, x: 0, y: 1.55, z: -0.10 }));

    // --- Pattes puissantes -------------------------------------------------------
    const legPos = [[-0.28, 0.62, 0.18], [0.28, 0.62, 0.18], [-0.24, 0.62, -0.28], [0.24, 0.62, -0.28]];
    legPos.forEach(function (p) {
      const l = leg(0.62, 0.14, 0.11, DARK, FIRE);
      l.position.set(p[0], p[1], p[2]);
      g.add(l);
    });

    // --- Queue à traîne de flammes -----------------------------------------------
    const tail = TAIL(1.3, FIRE, 6, { style: 'flame', color2: GLOW, droop: 0.12, y: 1.05, z: -0.55 });
    g.add(tail);

    // --- Aura obligatoire ----------------------------------------------------------
    g.add(AURA(FIRE, 1.35, { color2: GLOW, rings: 2, particles: 5, shape: 'sphere' }));

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = FIRE;

    g.userData.attack = function (g, p) {
      // « Souffle de magma » : la tête plonge en avant, la gueule s'embrase,
      // les ailes se déploient en grand, la queue fouette derrière.
      const k = arc(p), pc = R3.clamp01(p);
      body.rotation.x = -k * 0.16;
      head.rotation.x = -k * 0.55;
      head.position.z = 0.28 + k * 0.30;
      wingL.rotation.z = 0.3 + Math.sin(pc * Math.PI * 3) * 0.5;
      wingR.rotation.z = -0.3 - Math.sin(pc * Math.PI * 3) * 0.5;
      tail.rotation.y = Math.sin(pc * Math.PI * 5) * 0.5;
      animAura(g, R3.clock.t);
      if (pc >= 1) { body.rotation.x = 0; head.rotation.x = 0; head.position.z = 0.28; }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  EMBERYX — phénix, longue traîne de flammes.
  //  Silhouette élancée d'oiseau altier, longue traîne interminable qui
  //  distingue immédiatement son profil de celui, massif, de Pyrathos.
  // ===========================================================================
  R3.registerCreature('emberyx', function () {
    const BODY = '#ff8c42', BRIGHT = '#ffd166', ACCENT = '#e94b3c';
    const g = new THREE.Group();

    const torso = new THREE.Group();
    torso.position.set(0, 1.35, 0);
    g.add(torso);
    torso.add(R3.ellipsoid(0.30, 0.42, 0.46, BODY, 0, 0, 0, { rough: 0.6 }));
    torso.add(R3.ellipsoid(0.22, 0.28, 0.32, BRIGHT, 0, -0.10, 0.18, { emissive: BRIGHT, emissiveIntensity: 0.5, rough: 0.5 }));
    torso.add(CORE(ACCENT, 0.15, { y: 0.02, z: 0.30 }));

    // --- Long cou et tête altière ------------------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.55, 0.10);
    torso.add(head);
    head.add(R3.cyl(0.10, 0.16, 0.55, BODY, 0, 0.28, 0.06, { rough: 0.6, seg: 9 }));
    head.add(R3.ellipsoid(0.17, 0.15, 0.24, BODY, 0, 0.60, 0.20, { rough: 0.55 }));
    head.add(R3.cone(0.045, 0.16, ACCENT, 0, 0.58, 0.42, { rough: 0.5, seg: 7 }));
    head.add(EYES(0.10, 0.63, 0.28, 0.045, { color: BRIGHT, dark: '#3b1608', angry: 0.4 }));
    head.add(HALO(BRIGHT, 0.22, 5, { color2: ACCENT, y: 0.80, z: -0.02, plane: 'flat' }));

    // --- Ailes flamboyantes -------------------------------------------------------
    const wingL = WING(1.05, BRIGHT, { style: 'feather', color2: ACCENT, tipColor: BODY, segments: 6, side: -1, x: -0.26, y: 0.02, z: -0.05 });
    const wingR = WING(1.05, BRIGHT, { style: 'feather', color2: ACCENT, tipColor: BODY, segments: 6, side: 1, x: 0.26, y: 0.02, z: -0.05 });
    torso.add(wingL, wingR);

    // --- Pattes fines de rapace ------------------------------------------------
    [-0.16, 0.16].forEach(function (x) {
      const l = leg(0.85, 0.06, 0.05, ACCENT, '#2a1108');
      l.position.set(x, 0.85, 0.02);
      g.add(l);
    });

    // --- Traîne de flammes interminable (la marque de fabrique d'Emberyx) ------
    const tail = TAIL(1.7, ACCENT, 9, { style: 'flame', color2: BRIGHT, droop: 0.08, amp: 0.28, y: 1.30, z: -0.35 });
    g.add(tail);

    g.add(AURA(BRIGHT, 1.30, { color2: ACCENT, rings: 2, particles: 6, shape: 'sphere' }));

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = BRIGHT;

    g.userData.attack = function (g, p) {
      // « Renaissance ardente » : le phénix se cabre, les ailes s'embrasent
      // en grand et la traîne se gonfle en une gerbe de flammes.
      const k = arc(p), pc = R3.clamp01(p);
      torso.rotation.x = -k * 0.30;
      torso.position.y = 1.35 + k * 0.18;
      head.rotation.x = -k * 0.20;
      wingL.rotation.z = 0.4 + k * 0.9;
      wingR.rotation.z = -0.4 - k * 0.9;
      tail.rotation.x = -k * 0.35;
      tail.scale.setScalar(1 + k * 0.25);
      animAura(g, R3.clock.t);
      if (pc >= 1) { torso.rotation.x = 0; torso.position.y = 1.35; tail.scale.setScalar(1); }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  FOURNALIS — lion à crinière de lave.
  //  Quadrupède massif, silhouette horizontale — ce qui le distingue net des
  //  deux autres feu, tous deux debout sur leurs pattes arrière.
  // ===========================================================================
  R3.registerCreature('fournalis', function () {
    const BODY = '#e25822', MANE = '#f4a259', DARK = '#3b1f1a';
    const g = new THREE.Group();

    const body = new THREE.Group();
    body.position.set(0, 1.00, 0);
    g.add(body);
    body.add(R3.ellipsoid(0.46, 0.44, 0.72, BODY, 0, 0, -0.05, { rough: 0.7 }));
    body.add(R3.ellipsoid(0.38, 0.30, 0.60, DARK, 0, -0.26, -0.02, { rough: 0.85 }));

    // --- Tête et crinière-brasier (cristaux réutilisés comme pointes de feu) ---
    const head = new THREE.Group();
    head.position.set(0, 0.28, 0.62);
    body.add(head);
    head.add(R3.ellipsoid(0.30, 0.27, 0.32, BODY, 0, 0, 0, { rough: 0.65 }));
    head.add(R3.ellipsoid(0.14, 0.12, 0.18, DARK, 0, -0.10, 0.26, { rough: 0.8 }));   // museau sombre
    head.add(EYES(0.16, 0.06, 0.28, 0.06, { color: MANE, dark: '#2a1108', angry: 0.7 }));
    head.add(CORE('#ffd166', 0.10, { y: -0.16, z: 0.32 }));                            // gueule ardente
    head.add(CRYSTAL(MANE, 9, 0.42, { tipColor: '#ffd166', base: false, opacity: 1, spread: 1.25, x: 0, y: 0.02, z: -0.12 }));

    // --- Pattes puissantes -------------------------------------------------------
    [[-0.30, 1.00, 0.32], [0.30, 1.00, 0.32], [-0.28, 1.00, -0.42], [0.28, 1.00, -0.42]].forEach(function (p) {
      const l = leg(1.00, 0.14, 0.115, DARK, BODY);
      l.position.set(p[0], p[1], p[2]);
      g.add(l);
    });

    // --- Queue à toupet de flamme -------------------------------------------------
    const tail = TAIL(0.95, BODY, 5, { style: 'flame', color2: MANE, droop: -0.10, y: 0.98, z: -0.78 });
    g.add(tail);

    g.add(AURA(BODY, 1.30, { color2: MANE, rings: 1, particles: 5, shape: 'disc', y0: 0.02 }));

    g.userData.anim = { head: head, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = BODY;

    g.userData.attack = function (g, p) {
      // « Rugissement de lave » : le lion se ramasse puis bondit, crinière
      // hérissée, avant de rugir gueule grande ouverte.
      const k = arc(p), pc = R3.clamp01(p);
      body.position.z = -0.08 * (1 - k) + k * 0.55;
      body.position.y = 1.00 + Math.max(0, Math.sin(pc * Math.PI)) * 0.22;
      body.rotation.x = -k * 0.10;
      head.scale.setScalar(1 + k * 0.14);
      tail.rotation.y = Math.sin(pc * Math.PI * 6) * 0.6;
      animAura(g, R3.clock.t);
      if (pc >= 1) { body.position.z = -0.08; body.position.y = 1.00; body.rotation.x = 0; head.scale.setScalar(1); }
    };
    finalizeSize(g);
    return g;
  });

  // =============================================================================
  //  EAU — abyssalor · ondinae · marea                    (région : Côte de Saphir)
  // =============================================================================

  // ===========================================================================
  //  ABYSSALOR — léviathan-serpent des abysses.
  //  Long corps ondulant au ras du sol, cou dressé bien haut — c'est le seul
  //  des trois eau à ne pas avoir de membres.
  // ===========================================================================
  R3.registerCreature('abyssalor', function () {
    const DEEP = '#123a6b', MID = '#2f7fb8', GLOW = '#73eff7';
    const g = new THREE.Group();

    // --- Corps serpentin qui ondule au ras du sol -------------------------------
    const bodyRoot = SERPENT(1.9, DEEP, { segments: 9, color2: MID, belly: GLOW, amp: 0.30, rise: 0.4, x: 0, y: 0.55, z: -0.10 });
    g.add(bodyRoot);

    // --- Cou qui se dresse vers le ciel, terminé par la tête --------------------
    const neck = new THREE.Group();
    neck.position.set(0, 0.60, 0.15);
    g.add(neck);
    neck.add(R3.ellipsoid(0.20, 0.30, 0.20, DEEP, 0, 0.30, 0, { rough: 0.55 }));
    neck.add(R3.ellipsoid(0.17, 0.30, 0.17, MID, 0, 0.62, 0.02, { rough: 0.55 }));

    const head = new THREE.Group();
    head.position.set(0, 0.95, 0.06);
    neck.add(head);
    head.add(R3.ellipsoid(0.22, 0.20, 0.32, DEEP, 0, 0, 0, { rough: 0.5 }));
    head.add(R3.ellipsoid(0.14, 0.10, 0.20, GLOW, 0, -0.10, 0.24, { emissive: GLOW, emissiveIntensity: 0.55, rough: 0.4 }));
    [-1, 1].forEach(function (s) {
      const fin = R3.ellipsoid(0.03, 0.14, 0.18, GLOW, s * 0.22, 0.06, -0.04,
        { transparent: true, opacity: 0.65, emissive: GLOW, emissiveIntensity: 0.5, side: THREE.DoubleSide });
      fin.rotation.z = s * 0.5;
      head.add(fin);
    });
    head.add(EYES(0.13, 0.03, 0.22, 0.06, { color: GLOW, dark: '#081226', angry: 0.7 }));

    // --- Frange dorsale (nageoire qui court sur la nuque) -----------------------
    const dorsal = TAIL(0.9, GLOW, 6, { style: 'fin', width: 0.14, x: 0, y: 1.05, z: -0.10 });
    g.add(dorsal);

    g.add(AURA(MID, 1.35, { color2: GLOW, rings: 2, particles: 5, shape: 'sphere', y0: 0.9 }));

    g.userData.anim = { head: head, tail: bodyRoot.userData.segments ? bodyRoot : dorsal, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = MID;

    g.userData.attack = function (g, p) {
      // « Étreinte abyssale » : le cou plonge en avant, la gueule s'ouvre,
      // tout le corps ondule violemment.
      const k = arc(p), pc = R3.clamp01(p);
      neck.rotation.x = -k * 0.60;
      neck.position.z = 0.15 + k * 0.35;
      head.rotation.x = -k * 0.30;
      bodyRoot.rotation.y = Math.sin(pc * Math.PI * 4) * 0.18;
      animAura(g, R3.clock.t);
      if (pc >= 1) { neck.rotation.x = 0; neck.position.z = 0.15; head.rotation.x = 0; bodyRoot.rotation.y = 0; }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  ONDINAË — esprit d'écume, voiles d'eau.
  //  Silhouette élancée et éthérée qui flotte, drapée de longs rubans d'eau —
  //  aucun rapport avec la masse reptilienne d'Abyssalor.
  // ===========================================================================
  R3.registerCreature('ondinae', function () {
    const CYAN = '#73eff7', LIGHT = '#a8e6ff', WHITE = '#f4f4f4';
    const g = new THREE.Group();

    const torso = new THREE.Group();
    torso.position.set(0, 1.55, 0);
    g.add(torso);
    torso.add(R3.ellipsoid(0.26, 0.42, 0.24, CYAN, 0, 0, 0,
      { transparent: true, opacity: 0.55, emissive: CYAN, emissiveIntensity: 0.35, rough: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    torso.add(CORE(WHITE, 0.14, { y: -0.04 }));

    const head = new THREE.Group();
    head.position.set(0, 0.48, 0.02);
    torso.add(head);
    head.add(R3.ellipsoid(0.15, 0.17, 0.15, LIGHT, 0, 0, 0,
      { transparent: true, opacity: 0.7, emissive: LIGHT, emissiveIntensity: 0.3, rough: 0.2 }));
    head.add(EYES(0.075, 0.02, 0.13, 0.036, { color: WHITE, dark: '#0e3a4a', angry: 0.1, tilt: 0.05 }));
    head.add(HALO(LIGHT, 0.24, 6, { color2: WHITE, y: 0.10, plane: 'flat' }));

    // --- Voiles d'eau qui trament derrière les épaules (jouent le rôle des ailes) --
    const veilL = RIBBON(0.95, LIGHT, { color2: WHITE, opacity: 0.45, segments: 7, x: -0.24, y: 0.18, z: 0.02 });
    const veilR = RIBBON(0.95, LIGHT, { color2: WHITE, opacity: 0.45, segments: 7, x: 0.24, y: 0.18, z: 0.02 });
    torso.add(veilL, veilR);

    // --- Grande jupe d'écume qui coule jusqu'au sol (axe -y via un repère tourné) --
    const skirtWrap = new THREE.Group();
    skirtWrap.rotation.x = -Math.PI / 2;
    skirtWrap.position.set(0, -0.40, 0);
    torso.add(skirtWrap);
    const skirt = RIBBON(1.20, CYAN, { color2: LIGHT, opacity: 0.5, segments: 9, width: 0.34, taper: 0.75 });
    skirtWrap.add(skirt);

    g.add(AURA(CYAN, 1.20, { color2: LIGHT, rings: 2, particles: 6, shape: 'sphere', y0: 1.15 }));

    g.userData.anim = { head: head, wingL: veilL, wingR: veilR, tail: skirt, float: true };
    g.userData.baseY = 0.10;
    g.userData.legendary = true;
    g.userData.auraColor = CYAN;

    g.userData.attack = function (g, p) {
      // « Vague déferlante » : le corps se penche en avant, les voiles se
      // déploient et la jupe d'écume jaillit vers l'adversaire.
      const k = arc(p), pc = R3.clamp01(p);
      torso.rotation.x = -k * 0.35;
      torso.position.z = k * 0.45;
      veilL.rotation.y = -k * 0.9;
      veilR.rotation.y = k * 0.9;
      skirtWrap.scale.setScalar(1 + k * 0.35);
      animAura(g, R3.clock.t);
      if (pc >= 1) { torso.rotation.x = 0; torso.position.z = 0; veilL.rotation.y = 0; veilR.rotation.y = 0; skirtWrap.scale.setScalar(1); }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  MARÉA — raie des marées, longue queue.
  //  Corps large et plat qui « vole » à faible hauteur, immense queue fine —
  //  troisième silhouette bien distincte (ni serpent, ni esprit dressé).
  // ===========================================================================
  R3.registerCreature('marea', function () {
    const BASE = '#2f7fb8', BRIGHT = '#41a6f6', UNDER = '#bce884';
    const g = new THREE.Group();

    const body = new THREE.Group();
    body.position.set(0, 1.05, 0);
    g.add(body);
    body.add(R3.ellipsoid(0.62, 0.16, 0.80, BASE, 0, 0, 0, { rough: 0.45 }));
    body.add(R3.ellipsoid(0.46, 0.10, 0.60, UNDER, 0, -0.10, 0.05, { rough: 0.7 }));
    body.add(R3.ellipsoid(0.26, 0.16, 0.28, BASE, 0, 0.02, 0.62, { rough: 0.45 }));   // tête légèrement bombée
    body.add(EYES(0.16, 0.10, 0.80, 0.05, { color: BRIGHT, dark: '#0c2a44', angry: 0.15 }));
    body.add(CORE(BRIGHT, 0.11, { y: -0.02, z: 0.55 }));

    // --- Grandes nageoires pectorales, portées un peu relevées (ondule en vol) --
    const wingL = WING(1.30, BASE, { style: 'membrane', color2: UNDER, tipColor: BRIGHT, side: -1, x: -0.28, y: 0.05, z: -0.05, sweep: 0.05 });
    const wingR = WING(1.30, BASE, { style: 'membrane', color2: UNDER, tipColor: BRIGHT, side: 1, x: 0.28, y: 0.05, z: -0.05, sweep: 0.05 });
    wingL.rotation.z = 0.24; wingR.rotation.z = -0.24;
    body.add(wingL, wingR);

    // --- Longue queue fine et fouettante (la marque de Maréa) -------------------
    const tail = TAIL(1.6, BASE, 8, { style: 'fin', color2: BRIGHT, width: 0.10, droop: 0.05, amp: 0.20, y: 1.05, z: -0.55 });
    g.add(tail);

    g.add(AURA(BRIGHT, 1.25, { color2: UNDER, rings: 1, particles: 5, shape: 'sphere', y0: 1.0 }));

    g.userData.anim = { head: body, wingL: wingL, wingR: wingR, tail: tail, float: true };
    g.userData.baseY = 0.05;
    g.userData.legendary = true;
    g.userData.auraColor = BRIGHT;

    g.userData.attack = function (g, p) {
      // « Vague de fond » : Maréa plonge, cabre ses nageoires en grand et
      // fait claquer sa longue queue.
      const k = arc(p), pc = R3.clamp01(p);
      body.position.z = k * 0.55;
      body.rotation.x = -k * 0.25;
      wingL.rotation.z = 0.24 + Math.sin(pc * Math.PI * 3) * 0.55;
      wingR.rotation.z = -0.24 - Math.sin(pc * Math.PI * 3) * 0.55;
      tail.rotation.y = Math.sin(pc * Math.PI * 6) * 0.6;
      animAura(g, R3.clock.t);
      if (pc >= 1) { body.position.z = 0; body.rotation.x = 0; wingL.rotation.z = 0.24; wingR.rotation.z = -0.24; }
    };
    finalizeSize(g);
    return g;
  });

  // =============================================================================
  //  PLANTE — sylvaros · florabelle · racinor            (région : Val d'Émeraude)
  // =============================================================================

  // ===========================================================================
  //  SYLVAROS — cerf-forêt millénaire, bois-branches.
  //  Quadrupède élancé au ramure immense — la silhouette la plus « animale »
  //  des trois plante.
  // ===========================================================================
  R3.registerCreature('sylvaros', function () {
    const DGREEN = '#1e8449', WOOD = '#8b5a2b', LGREEN = '#a7f070';
    const g = new THREE.Group();

    const body = new THREE.Group();
    body.position.set(0, 1.10, 0);
    g.add(body);
    body.add(R3.ellipsoid(0.34, 0.36, 0.62, DGREEN, 0, 0, -0.05, { rough: 0.8 }));
    body.add(R3.ellipsoid(0.28, 0.24, 0.50, WOOD, 0, -0.20, -0.02, { rough: 0.85 }));

    const head = new THREE.Group();
    head.position.set(0, 0.30, 0.58);
    body.add(head);
    head.add(R3.ellipsoid(0.16, 0.20, 0.30, DGREEN, 0, 0, 0, { rough: 0.75 }));
    head.add(R3.ellipsoid(0.09, 0.10, 0.16, WOOD, 0, -0.14, 0.22, { rough: 0.85 }));
    head.add(EYES(0.11, 0.06, 0.20, 0.045, { color: LGREEN, dark: '#0c2a12', angry: 0.2 }));
    head.add(CORE(LGREEN, 0.075, { y: 0.16, z: 0.16 }));   // gemme au front

    // --- Ramure de branches (main gauche/droite, distinctes par branche()) -----
    function antler(side) {
      const a = new THREE.Group();
      a.add(R3.cyl(0.035, 0.05, 0.42, WOOD, 0, 0.21, 0, { rough: 0.9, seg: 7 }));
      [[0.30, 0.06, -0.10, 0.6], [0.18, 0.30, 0.08, 0.35], [0.36, 0.16, 0.02, 0.85]].forEach(function (t) {
        const tine = R3.cyl(0.02, 0.03, t[0], WOOD, side * t[1], t[0] * 0.5 + 0.18, t[2], { rough: 0.9, seg: 6 });
        tine.rotation.z = -side * t[3];
        a.add(tine);
      });
      a.add(R3.ellipsoid(0.05, 0.045, 0.03, LGREEN, side * 0.10, 0.40, 0.02, { rough: 0.7 }));  // pousse de feuilles
      return a;
    }
    const antlerL = antler(-1); antlerL.position.set(-0.09, 0.16, -0.02);
    const antlerR = antler(1); antlerR.position.set(0.09, 0.16, -0.02);
    head.add(antlerL, antlerR);

    // --- Pattes fines de cervidé -------------------------------------------------
    [[-0.20, 1.10, 0.28], [0.20, 1.10, 0.28], [-0.18, 1.10, -0.30], [0.18, 1.10, -0.30]].forEach(function (p) {
      const l = leg(1.02, 0.075, 0.055, WOOD, DGREEN);
      l.position.set(p[0], p[1], p[2]);
      g.add(l);
    });

    const tail = TAIL(0.35, DGREEN, 3, { style: 'feather', color2: LGREEN, y: 1.05, z: -0.60 });
    g.add(tail);

    g.add(AURA(LGREEN, 1.30, { color2: DGREEN, rings: 1, particles: 5, shape: 'sphere', y0: 1.15 }));

    g.userData.anim = { head: head, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = LGREEN;

    g.userData.attack = function (g, p) {
      // « Charge de la forêt » : Sylvaros baisse la ramure et charge en avant,
      // la gemme du front s'embrase.
      const k = arc(p), pc = R3.clamp01(p);
      body.position.z = k * 0.55;
      head.rotation.x = -k * 0.45;
      body.rotation.x = -k * 0.10;
      tail.rotation.y = Math.sin(pc * Math.PI * 4) * 0.4;
      animAura(g, R3.clock.t);
      if (pc >= 1) { body.position.z = 0; head.rotation.x = 0; body.rotation.x = 0; }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  FLORABELLE — fée-fleur, robe de pétales.
  //  Silhouette humanoïde élancée qui flotte, très éloignée du quadrupède
  //  Sylvaros ou du colosse trapu Racinor.
  // ===========================================================================
  R3.registerCreature('florabelle', function () {
    const PINK = '#ff6b9d', LPINK = '#ffaad8', GREEN = '#38b764';
    const g = new THREE.Group();

    const torso = new THREE.Group();
    torso.position.set(0, 1.15, 0);
    g.add(torso);
    torso.add(R3.ellipsoid(0.20, 0.34, 0.18, LPINK, 0, 0, 0, { rough: 0.5 }));
    torso.add(CORE(PINK, 0.12, { y: -0.02 }));

    const head = new THREE.Group();
    head.position.set(0, 0.44, 0.02);
    torso.add(head);
    head.add(R3.ellipsoid(0.15, 0.16, 0.15, LPINK, 0, 0, 0, { rough: 0.55 }));
    head.add(EYES(0.07, 0.02, 0.13, 0.036, { color: GREEN, dark: '#3a0e2a', angry: 0.05 }));
    head.add(R3.blush(0.12, -0.05, 0.11, 0.03));
    head.add(HALO(GREEN, 0.24, 6, { color2: LPINK, y: 0.10, plane: 'flat' }));   // couronne de fleurs

    // --- Ailes légères de fée ------------------------------------------------------
    const wingL = WING(0.55, LPINK, { style: 'feather', color2: GREEN, tipColor: PINK, segments: 4, side: -1, x: -0.18, y: 0.14, z: -0.06 });
    const wingR = WING(0.55, LPINK, { style: 'feather', color2: GREEN, tipColor: PINK, segments: 4, side: 1, x: 0.18, y: 0.14, z: -0.06 });
    torso.add(wingL, wingR);

    // --- Robe de pétales : couronne d'ellipsoïdes fanée depuis la taille -------
    const skirt = new THREE.Group();
    skirt.position.set(0, -0.32, 0);
    torso.add(skirt);
    const nPetals = 7;
    for (let i = 0; i < nPetals; i++) {
      const a = (i / nPetals) * Math.PI * 2;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * 0.05, -0.02, Math.sin(a) * 0.05);
      p.rotation.y = -a;
      p.add(R3.ellipsoid(0.13, 0.20, 0.05, i % 2 ? PINK : LPINK, 0, -0.16, 0.10, { rough: 0.55, side: THREE.DoubleSide }));
      skirt.add(p);
    }

    g.add(AURA(PINK, 1.15, { color2: LPINK, rings: 2, particles: 6, shape: 'sphere', y0: 1.20 }));

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: skirt, float: true };
    g.userData.baseY = 0.18;
    g.userData.legendary = true;
    g.userData.auraColor = PINK;

    g.userData.attack = function (g, p) {
      // « Tourbillon de pétales » : Florabelle s'élève, la robe de pétales
      // explose en corolle et les ailes battent à toute vitesse.
      const k = arc(p), pc = R3.clamp01(p);
      torso.position.y = 1.15 + k * 0.30;
      skirt.rotation.y = pc * Math.PI * 3;
      skirt.scale.setScalar(1 + k * 0.6);
      wingL.rotation.z = Math.sin(pc * Math.PI * 10) * 0.5;
      wingR.rotation.z = -Math.sin(pc * Math.PI * 10) * 0.5;
      animAura(g, R3.clock.t);
      if (pc >= 1) { torso.position.y = 1.15; skirt.rotation.y = 0; skirt.scale.setScalar(1); }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  RACINOR — colosse de racines tressées.
  //  Masse trapue et large, bras-racines qui pendent jusqu'au sol — le plus
  //  lourd des trois plante, ancré à son autel.
  // ===========================================================================
  R3.registerCreature('racinor', function () {
    const DBROWN = '#5c3a1e', MOSS = '#3d6b2f', WOOD = '#8b5a2b';
    const g = new THREE.Group();

    const torso = new THREE.Group();
    torso.position.set(0, 1.20, 0);
    g.add(torso);
    torso.add(R3.ellipsoid(0.58, 0.62, 0.56, DBROWN, 0, 0, 0, { rough: 0.9, flat: true }));
    torso.add(R3.ellipsoid(0.40, 0.28, 0.42, MOSS, 0, 0.24, 0.14, { rough: 0.95 }));   // mousse sur le dos
    torso.add(R3.ellipsoid(0.30, 0.18, 0.10, WOOD, 0, -0.10, 0.48, { rough: 0.9 }));   // écorce du torse

    const head = new THREE.Group();
    head.position.set(0, 0.55, 0.32);
    torso.add(head);
    head.add(R3.ellipsoid(0.22, 0.20, 0.22, DBROWN, 0, 0, 0, { rough: 0.9 }));
    head.add(EYES(0.10, 0.02, 0.18, 0.05, { color: MOSS, dark: '#1a1108', angry: 0.55 }));

    // --- Épines-racines aux épaules ----------------------------------------------
    g.add(CRYSTAL(WOOD, 5, 0.26, { tipColor: MOSS, base: false, flat: true, opacity: 1, x: -0.44, y: 1.55, z: 0 }));
    g.add(CRYSTAL(WOOD, 5, 0.26, { tipColor: MOSS, base: false, flat: true, opacity: 1, x: 0.44, y: 1.55, z: 0 }));

    // --- Longs bras-racines qui pendent jusqu'au sol (repère tourné vers -y) ---
    function rootArm(side) {
      const wrap = new THREE.Group();
      wrap.rotation.x = -Math.PI / 2;
      wrap.rotation.z = side * 0.12;
      const arm = TAIL(1.15, WOOD, 6, { style: 'feather', color2: DBROWN, width: 0.16 });
      wrap.add(arm);
      return { wrap: wrap, arm: arm };
    }
    const armL = rootArm(-1), armR = rootArm(1);
    armL.wrap.position.set(-0.52, 1.30, 0.05);
    armR.wrap.position.set(0.52, 1.30, 0.05);
    g.add(armL.wrap, armR.wrap);

    // --- Pattes très courtes et massives -----------------------------------------
    [[-0.28, 0.55, 0.10], [0.28, 0.55, 0.10]].forEach(function (p) {
      const l = leg(0.55, 0.26, 0.24, DBROWN, WOOD);
      l.position.set(p[0], p[1], p[2]);
      g.add(l);
    });

    g.add(AURA(MOSS, 1.40, { color2: WOOD, rings: 1, particles: 4, shape: 'disc', y0: 0.02 }));

    g.userData.anim = { head: head, wingL: armL.arm, wingR: armR.arm, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = MOSS;

    g.userData.attack = function (g, p) {
      // « Étreinte des racines » : les deux bras se lèvent puis s'abattent
      // vers l'avant, comme pour enserrer l'adversaire.
      const k = arc(p), pc = R3.clamp01(p);
      armL.wrap.rotation.x = -Math.PI / 2 + k * 1.1;
      armR.wrap.rotation.x = -Math.PI / 2 + k * 1.1;
      torso.rotation.x = -k * 0.18;
      torso.position.z = k * 0.30;
      animAura(g, R3.clock.t);
      if (pc >= 1) { armL.wrap.rotation.x = -Math.PI / 2; armR.wrap.rotation.x = -Math.PI / 2; torso.rotation.x = 0; torso.position.z = 0; }
    };
    finalizeSize(g);
    return g;
  });

  // =============================================================================
  //  FOUDRE — fulguron · voltaris · orageon           (régions : Sylve / Saphir)
  // =============================================================================

  // ===========================================================================
  //  FULGURON — oiseau-tonnerre, ailes en éclairs.
  //  Silhouette d'oiseau dressé, ailes en zigzags acérés — nettement plus
  //  anguleux que la fourrure douce de Voltaris ou le nuage d'Orageon.
  // ===========================================================================
  R3.registerCreature('fulguron', function () {
    const YEL = '#f1c40f', LYEL = '#fcef8d', BLUE = '#3b5dc9';
    const g = new THREE.Group();

    const torso = new THREE.Group();
    torso.position.set(0, 1.30, 0);
    g.add(torso);
    torso.add(R3.ellipsoid(0.32, 0.40, 0.42, YEL, 0, 0, 0, { rough: 0.55 }));
    torso.add(R3.ellipsoid(0.24, 0.26, 0.30, LYEL, 0, -0.08, 0.16, { emissive: LYEL, emissiveIntensity: 0.35, rough: 0.5 }));
    torso.add(CORE(BLUE, 0.14, { y: 0.02, z: 0.28 }));

    const head = new THREE.Group();
    head.position.set(0, 0.50, 0.06);
    torso.add(head);
    head.add(R3.cyl(0.10, 0.15, 0.42, YEL, 0, 0.22, 0.04, { rough: 0.55, seg: 9 }));
    head.add(R3.ellipsoid(0.16, 0.14, 0.22, YEL, 0, 0.50, 0.16, { rough: 0.5 }));
    head.add(R3.cone(0.04, 0.14, BLUE, 0, 0.48, 0.36, { rough: 0.4, seg: 6 }));
    head.add(EYES(0.09, 0.53, 0.24, 0.04, { color: BLUE, dark: '#101226', angry: 0.55 }));
    head.add(HALO(YEL, 0.20, 5, { color2: BLUE, y: 0.66, plane: 'flat' }));

    // --- Ailes en éclairs (style « bolt ») ----------------------------------------
    const wingL = WING(1.10, YEL, { style: 'bolt', color2: BLUE, segments: 6, side: -1, x: -0.26, y: 0.05, z: -0.05 });
    const wingR = WING(1.10, YEL, { style: 'bolt', color2: BLUE, segments: 6, side: 1, x: 0.26, y: 0.05, z: -0.05 });
    torso.add(wingL, wingR);

    [-0.14, 0.14].forEach(function (x) {
      const l = leg(0.80, 0.055, 0.045, BLUE, '#0f1226');
      l.position.set(x, 0.80, 0.02);
      g.add(l);
    });

    // --- Traîne de rubans électriques ---------------------------------------------
    const tail = TAIL(1.0, BLUE, 6, { style: 'ribbon', color2: YEL, y: 1.28, z: -0.30 });
    g.add(tail);

    g.add(AURA(YEL, 1.25, { color2: BLUE, rings: 2, particles: 6, shape: 'sphere' }));

    g.userData.anim = { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = YEL;

    g.userData.attack = function (g, p) {
      // « Fulguration » : l'oiseau se cabre, les ailes en éclairs se déploient
      // et une décharge parcourt tout le corps.
      const k = arc(p), pc = R3.clamp01(p);
      torso.rotation.x = -k * 0.32;
      torso.position.y = 1.30 + k * 0.16;
      wingL.rotation.z = 0.3 + k * 1.0;
      wingR.rotation.z = -0.3 - k * 1.0;
      tail.rotation.x = -k * 0.4;
      animAura(g, R3.clock.t);
      if (pc >= 1) { torso.rotation.x = 0; torso.position.y = 1.30; }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  VOLTARIS — félin d'arc électrique, crinière vive.
  //  Quadrupède félin sombre, crinière en éclats orbitaux — silhouette
  //  massive au sol, opposée aux deux oiseaux Fulguron et Orageon.
  // ===========================================================================
  R3.registerCreature('voltaris', function () {
    const YEL = '#f1c40f', BLUE = '#41a6f6', DARK = '#1a1c2c';
    const g = new THREE.Group();

    const body = new THREE.Group();
    body.position.set(0, 1.02, 0);
    g.add(body);
    body.add(R3.ellipsoid(0.40, 0.38, 0.62, DARK, 0, 0, -0.05, { rough: 0.5 }));
    [-0.18, 0.18].forEach(function (x) {
      const stripe = R3.ellipsoid(0.03, 0.05, 0.42, YEL, x, 0.10, -0.05,
        { emissive: YEL, emissiveIntensity: 1.0, rough: 0.3, side: THREE.DoubleSide });
      body.add(stripe);
    });

    const head = new THREE.Group();
    head.position.set(0, 0.24, 0.58);
    body.add(head);
    head.add(R3.ellipsoid(0.24, 0.22, 0.26, DARK, 0, 0, 0, { rough: 0.5 }));
    head.add(EYES(0.13, 0.05, 0.22, 0.06, { color: BLUE, dark: '#05070f', angry: 0.85 }));
    head.add(CORE(BLUE, 0.06, { y: -0.10, z: 0.26 }));

    // --- Crinière d'éclats électriques en orbite autour du cou ------------------
    const mane = ORBIT(YEL, 0.34, 8, { shape: 'shard', color2: BLUE, glow: true, guide: true, tilt: 0.20, speed: 0.8, x: 0, y: 0.42, z: 0.34 });
    body.add(mane);

    [[-0.24, 1.02, 0.30], [0.24, 1.02, 0.30], [-0.22, 1.02, -0.34], [0.22, 1.02, -0.34]].forEach(function (p) {
      const l = leg(1.00, 0.11, 0.09, DARK, BLUE);
      l.position.set(p[0], p[1], p[2]);
      g.add(l);
    });

    const tail = TAIL(0.9, DARK, 5, { style: 'flame', color2: YEL, droop: -0.05, y: 1.00, z: -0.66 });
    g.add(tail);

    g.add(AURA(YEL, 1.30, { color2: BLUE, rings: 2, particles: 6, shape: 'sphere', y0: 0.95 }));

    g.userData.anim = { head: head, tail: tail, float: false };
    g.userData.legendary = true;
    g.userData.auraColor = YEL;

    g.userData.attack = function (g, p) {
      // « Charge d'arc » : Voltaris se tapit, la crinière crépite plus vite,
      // puis il fonce toutes griffes dehors.
      const k = arc(p), pc = R3.clamp01(p);
      body.position.y = 1.02 - k * 0.10;
      body.position.z = k * 0.65;
      body.rotation.x = -k * 0.10;
      mane.rotation.y = pc * Math.PI * 4;
      tail.rotation.y = Math.sin(pc * Math.PI * 8) * 0.5;
      animAura(g, R3.clock.t);
      if (pc >= 1) { body.position.y = 1.02; body.position.z = 0; body.rotation.x = 0; }
    };
    finalizeSize(g);
    return g;
  });

  // ===========================================================================
  //  ORAGEON — nuée orageuse à visage, pluie dessous.
  //  Amas nuageux flottant, sans pattes ni ailes — la seule des trois foudre
  //  qui n'a ni plumes ni fourrure.
  // ===========================================================================
  R3.registerCreature('orageon', function () {
    const SLATE = '#566c86', LSLATE = '#94b0c2', YEL = '#f1c40f';
    const g = new THREE.Group();

    const cloud = new THREE.Group();
    cloud.position.set(0, 1.55, 0);
    g.add(cloud);
    cloud.add(R3.ellipsoid(0.50, 0.34, 0.46, SLATE, 0, 0, 0, { rough: 0.85 }));
    cloud.add(MIST(LSLATE, 0.62, 7, { opacity: 0.55, color2: SLATE, ry: 0.6, x: 0, y: 0.06, z: 0 }));

    const face = new THREE.Group();
    face.position.set(0, -0.02, 0.40);
    cloud.add(face);
    face.add(EYES(0.14, 0.02, 0.06, 0.055, { color: YEL, dark: '#0e1420', angry: 0.5 }));

    // --- Éclats de foudre qui percent le sommet du nuage ------------------------
    cloud.add(CRYSTAL(YEL, 4, 0.28, { tipColor: '#fff4d6', base: false, flat: true, opacity: 1, x: 0, y: 0.30, z: -0.05 }));

    // --- Pluie qui tombe sous le nuage (repère tourné vers le bas) --------------
    const rainWrap = new THREE.Group();
    rainWrap.rotation.x = Math.PI;
    rainWrap.position.set(0, -0.32, 0);
    cloud.add(rainWrap);
    const rain = RIBBON(0.85, LSLATE, { color2: YEL, opacity: 0.4, segments: 8, width: 0.06, axis: 'y' });
    rainWrap.add(rain);

    g.add(AURA(SLATE, 1.30, { color2: YEL, rings: 2, particles: 6, shape: 'sphere', y0: 1.55 }));

    g.userData.anim = { head: face, tail: rain, float: true };
    g.userData.baseY = 0.20;
    g.userData.legendary = true;
    g.userData.auraColor = SLATE;

    g.userData.attack = function (g, p) {
      // « Colère du ciel » : le nuage se gonfle et gronde, les éclairs
      // crépitent au sommet, puis une décharge illumine tout le corps.
      const k = arc(p), pc = R3.clamp01(p);
      cloud.scale.setScalar(1 + k * 0.30);
      cloud.position.y = 1.55 + k * 0.20;
      face.position.z = 0.40 + k * 0.10;
      rain.rotation.y = pc * Math.PI * 2;
      animAura(g, R3.clock.t);
      if (pc >= 1) { cloud.scale.setScalar(1); cloud.position.y = 1.55; face.position.z = 0.40; }
    };
    finalizeSize(g);
    return g;
  });

})();
