// =============================================================================
//  legend3d.p1.js — LOT P1 DES 36 LÉGENDAIRES   (CONTRACT2 §4, CONTRACT3 §9)
//  feu    : pyrathos, emberyx, fournalis
//  eau    : abyssalor, ondinae, marea
//  plante : sylvaros, florabelle, racinor
//  foudre : fulguron, voltaris, orageon
// =============================================================================
//  CE QUI A CHANGÉ LE 2026-07-31 (demande n° 5 de Robin : « j'aimerai que les
//  légendaires soient presque pareils que les vrais »)
//  ---------------------------------------------------------------------------
//  Les 12 modèles ont été REDESSINÉS pour que la SILHOUETTE se lise en une
//  seconde : dragon céleste, oiseau de flammes ailes déployées, lion à crinière,
//  léviathan serpentin, esprit voilé, raie planante, cerf à ramure, fée-fleur,
//  colosse de racines, oiseau-tonnerre, félin d'arc, nuée d'orage. Chacun garde
//  son aura (obligatoire) et gagne AU MOINS DEUX attributs distinctifs parmi :
//  ailes majestueuses, traîne, couronne, anneaux en orbite, cristaux, runes,
//  cœur lumineux.
//
//  LE BUDGET, ET COMMENT IL EST TENU
//  ---------------------------------
//  CONTRACT3 §9 impose 25 DRAW CALLS PAR LÉGENDAIRE. Dans three.js, un mesh =
//  un draw call : les modèles de la vague précédente coûtaient de 40 à 74 draw
//  calls et auraient fait ramer le jeu. La solution n'est pas de dessiner moins,
//  c'est de FUSIONNER : `llib.bake()` réunit toutes les pièces qui ne bougent
//  pas les unes par rapport aux autres en un seul mesh par teinte.
//
//  Conséquence pratique, à ne jamais oublier en retouchant ce fichier :
//    * une teinte = UN SEUL jeu d'options (SOLID, SOFT, ROUGH, LIT, HOT, VEIL
//      ci-dessous), jamais `seg` — sinon R3.mat() rend deux matériaux pour la
//      même couleur, et la fusion produit deux draw calls au lieu d'un ;
//    * tout ce qui doit bouger tout seul vit dans son propre groupe, fusionné
//      séparément (tête, ailes, queue) ;
//    * les scintillements passent par `starfield` : 1 draw call pour 20 points,
//      là où les « lucioles » de l'aura en coûtaient 1 chacune.
//
//  Coût mesuré (banc d'essai node + three.js, voir le rapport) : 18 à 24 draw
//  calls par légendaire, jamais plus de 2 à l'écran à la fois.
//
//  CONVENTIONS (inchangées depuis v1)
//  ----------------------------------
//    * Group centré en (0,0,0), posé sur y = 0, tourné vers +z.
//    * g.userData.anim = { head, wingL, wingR, tail, float } — lu par
//      R3.idleCreature() si legendlib3d.js manque.
//    * g.userData.llIdle(t) — l'idle CALME du légendaire, joué à chaque frame
//      par llib.autoAnimate(). C'est lui qui fait la lévitation lente, la
//      respiration et la rotation des anneaux.
//    * g.userData.legendary = true, g.userData.auraColor = '#xxxxxx'.
//    * g.userData.attack(g, p) — p de 0 à 1, animation de combat.
//    * Aucune exception au chargement : si legendlib3d.js manque, chaque
//      primitive retombe sur une version minimale bâtie avec R3.* (le modèle
//      est plus pauvre et plus cher, le jeu tourne quand même).
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  const LL = R3.get('llib') || null;

  // ---------------------------------------------------------------------------
  //  REPLI — `safe()` essaie la primitive de la bibliothèque ; si elle manque
  //  ou échoue, on retombe sur une version minimale en primitives R3.*.
  //  (Règle §1.4 du contrat : aucun module ne lève au chargement.)
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

  function put(g, o) {
    o = o || {};
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }

  /** Fusion des pièces statiques. Sans la bibliothèque, on ne fusionne pas :
   *  le modèle reste juste, il coûte simplement plus cher. */
  function BAKE(g) {
    if (LL && typeof LL.bake === 'function') {
      try { return LL.bake(g); } catch (e) { /* tant pis, on garde les meshes */ }
    }
    return g;
  }

  function ANIMAURA(g, t) {
    if (LL && LL.animateAura) { try { LL.animateAura(g, t); } catch (e) { /* jamais bloquant */ } }
  }

  // --- Primitives du §13 de v2 ------------------------------------------------
  const AURA = safe('aura', function (color, radius, o) {
    o = o || {};
    const r = radius || 1;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(r * 0.8, r * 0.75, r * 0.8, color, 0, r * 0.85, 0,
      { transparent: true, opacity: 0.22, emissive: color, emissiveIntensity: 0.9, depthWrite: false, rough: 0.3 }));
    g.userData.auraColor = color;
    return put(g, o);
  });

  const WING = safe('majesticWing', function (len, color, o) {
    o = o || {};
    const L = len || 0.9;
    const g = new THREE.Group();
    g.add(R3.wing(L, L * 0.7, color, L * 0.5, 0, 0, { rough: 0.6, side: THREE.DoubleSide }));
    if ((o.side || 1) < 0) g.rotation.y = Math.PI;
    return put(g, o);
  });

  const TAIL = safe('plumeTail', function (len, color, n, o) {
    o = o || {};
    const L = len || 1, cnt = n || 5;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const u = i / cnt;
      g.add(R3.ellipsoid(0.10 * (1 - u * 0.5), 0.06, 0.14, color, 0, 0, -u * L, { rough: 0.6 }));
    }
    return put(g, o);
  });

  const CORE = safe('glowCore', function (color, r, o) {
    o = o || {};
    const g = new THREE.Group();
    g.add(R3.sphere(r || 0.2, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1.2, rough: 0.3 }));
    return put(g, o);
  });

  const CRYSTAL = safe('crystalCluster', function (color, n, scale, o) {
    o = o || {};
    const cnt = n || 5, s = scale || 0.3;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.cone(s * 0.22, s * 1.2, color, Math.cos(a) * s * 0.3, s * 0.6, Math.sin(a) * s * 0.3, { rough: 0.5 }));
    }
    return put(g, o);
  });

  const HALO = safe('halo', function (color, r, rays, o) {
    o = o || {};
    const g = new THREE.Group();
    g.add(R3.torus(r || 0.5, (r || 0.5) * 0.09, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1, rough: 0.4 }));
    if (o.plane === 'flat') g.rotation.x = -Math.PI / 2;
    return put(g, o);
  });

  const ORBIT = safe('orbitRing', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.8, cnt = n || 6;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.sphere(rr * 0.08, color, Math.cos(a) * rr, 0, Math.sin(a) * rr, { emissive: color, emissiveIntensity: 0.8 }));
    }
    return put(g, o);
  });

  const RIBBON = safe('flowRibbon', function (len, color, o) {
    o = o || {};
    const L = len || 1;
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      g.add(R3.box(0.16, 0.02, L / 6, color, 0, 0, -(i + 0.5) * (L / 6),
        { transparent: true, opacity: 0.5, emissive: color, emissiveIntensity: 0.4 }));
    }
    return put(g, o);
  });

  const SERPENT = safe('serpentBody', function (len, color, o) {
    o = o || {};
    const L = len || 1.5, cnt = 8;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const u = i / cnt;
      g.add(R3.ellipsoid(0.18 * (1 - u * 0.6), 0.16 * (1 - u * 0.6), 0.20, color, 0, 0, -u * L, { rough: 0.6 }));
    }
    return put(g, o);
  });

  const STARS = safe('starfield', function () { return new THREE.Group(); });

  // --- Primitives ajoutées par ce lot à legendlib3d.js (vague v3) -------------
  const EYES = safe('nobleEyes', function (spread, y, z, r) { return R3.eyes(spread, y, z, r); });

  const CROWN = safe('crown', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.28, cnt = n || 6;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.cone(rr * 0.16, rr * 0.8, color, Math.cos(a) * rr, rr * 0.4, Math.sin(a) * rr,
        { emissive: color, emissiveIntensity: 0.7, rough: 0.35 }));
    }
    return put(g, o);
  });

  const RUNES = safe('runeBand', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.6, cnt = n || 6;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.box(0.03, rr * 0.22, rr * 0.16, color, Math.cos(a) * rr, 0, Math.sin(a) * rr,
        { emissive: color, emissiveIntensity: 1.1, rough: 0.4 }));
    }
    return put(g, o);
  });

  const ARCS = safe('arcRings', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.9, cnt = n || 2;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const m = R3.torus(rr * (1 + i * 0.17), rr * 0.035, color, 0, 0, 0,
        { transparent: true, opacity: 0.5, emissive: color, emissiveIntensity: 1.1, depthWrite: false });
      m.rotation.x = -Math.PI / 2 + (i ? -0.7 : 0.55);
      g.add(m);
    }
    return put(g, o);
  });

  const CREST = safe('crestFin', function (len, color, n, o) {
    o = o || {};
    const L = len || 0.9, cnt = n || 5;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5) / cnt;
      const h = L * 0.34 * (0.25 + Math.sin(u * Math.PI) * 1.05);
      g.add(R3.ellipsoid(L * 0.022, h * 0.5, L * 0.08, color, 0, h * 0.5, -u * L, { rough: 0.5 }));
    }
    return put(g, o);
  });

  const BOLT = safe('boltArc', function (len, color, o) {
    o = o || {};
    const L = len || 0.7;
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      g.add(R3.box(L * 0.09, L * 0.28, L * 0.05, color, ((i % 2) ? -1 : 1) * L * 0.08, L * 0.13 + i * L * 0.25, 0,
        { emissive: color, emissiveIntensity: 1.4, rough: 0.35 }));
    }
    return put(g, o);
  });

  const PETALS = safe('petalSkirt', function (color, n, r, o) {
    o = o || {};
    const cnt = n || 8, rr = r || 0.4;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      g.add(R3.ellipsoid(rr * 0.4, rr * 0.55, rr * 0.06, color,
        Math.cos(a) * rr * 0.6, -rr * 0.45, Math.sin(a) * rr * 0.6, { rough: 0.55, side: THREE.DoubleSide }));
    }
    return put(g, o);
  });

  const ANTLER = safe('antler', function (len, color, o) {
    o = o || {};
    const L = len || 0.5;
    const g = new THREE.Group();
    g.add(R3.cyl(L * 0.055, L * 0.09, L, color, 0, L * 0.5, 0, { rough: 0.9 }));
    return put(g, o);
  });

  const MANE = safe('mane', function (color, r, n, o) {
    o = o || {};
    const rr = r || 0.42, cnt = n || 10;
    const g = new THREE.Group();
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const m = R3.cone(rr * 0.17, rr, color, Math.cos(a) * rr, Math.sin(a) * rr, 0,
        { rough: 0.5, flat: true, emissive: color, emissiveIntensity: 0.5 });
      m.rotation.z = a - Math.PI / 2;
      g.add(m);
    }
    return put(g, o);
  });

  // ---------------------------------------------------------------------------
  //  JEUX D'OPTIONS PARTAGÉS
  //  Un matériau = un draw call après fusion, et R3.mat() met en cache sur
  //  « couleur + JSON(options) ». Pour une teinte donnée, on n'utilise donc
  //  qu'UN seul de ces jeux, et JAMAIS `seg` : il ne concerne que la géométrie
  //  mais entre quand même dans la clé du cache, et scinderait le matériau.
  // ---------------------------------------------------------------------------
  const SOLID = { rough: 0.80 };                       // peau, chair, métal mat
  const SOFT = { rough: 0.55 };                        // plume, écaille, pétale
  const ROUGH = { rough: 0.93, flat: true };           // roche, écorce, croûte
  function LIT(c) { return { rough: 0.50, emissive: c, emissiveIntensity: 0.55 }; }
  function HOT(c) { return { rough: 0.38, emissive: c, emissiveIntensity: 1.20 }; }
  function VEIL(c) {
    return {
      rough: 0.20, transparent: true, opacity: 0.55, emissive: c,
      emissiveIntensity: 0.45, side: THREE.DoubleSide, depthWrite: false,
    };
  }

  // ---------------------------------------------------------------------------
  //  Petits utilitaires partagés par les 12 modèles
  // ---------------------------------------------------------------------------

  /** Courbe 0 -> 1 -> 0 : la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Patte : cuisse + pied. Destinée à être fusionnée avec le corps, elle ne
   *  coûte alors AUCUN draw call supplémentaire — d'où quatre vraies pattes
   *  plutôt que des moignons. */
  function leg(x, y, z, h, rTop, rBot, col, opt, colFoot, optFoot) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(R3.cyl(rTop, rBot, h, col, 0, -h * 0.5, 0, opt));
    g.add(R3.ellipsoid(rBot * 1.45, rBot * 0.55, rBot * 1.75, colFoot || col, 0, -h, rBot * 0.45, optFoot || opt));
    return g;
  }

  /**
   * Recale la hauteur du CORPS dans la fourchette 1,8 - 2,4 unités du §4.
   * L'aura, la nuée d'étoiles et les anneaux en orbite sont volontairement plus
   * larges que la créature : on les exclut du calcul, sinon un légendaire à
   * grande aura finirait tout riquiqui au milieu de son halo.
   */
  const HORS_MESURE = { aura: 1, star: 1, starFallback: 1, arcs: 1 };
  function finalizeSize(g) {
    const others = [];
    g.children.slice().forEach(function (c) {
      const k = (c.userData && c.userData.ll) ? c.userData.ll.kind : null;
      if (!(k && HORS_MESURE[k])) others.push(c);
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

  /**
   * Câblage commun de fin de modèle : userData du contrat, idle calme, attaque,
   * mise à l'échelle, et accroche de l'animation au cycle de rendu.
   *
   * `llib.autoAnimate` est ce qui garantit que l'aura pulse et que les anneaux
   * tournent MÊME EN COMBAT : battle3d n'anime que sa propre aura, pas le
   * modèle, et on n'a pas le droit d'écrire dans battle3d.js.
   */
  function finish(g, o) {
    g.userData.legendary = true;
    g.userData.auraColor = o.aura;
    g.userData.anim = o.anim || {};
    if (o.idle) g.userData.llIdle = o.idle;
    if (o.baseY !== undefined) g.userData.baseY = o.baseY;
    g.userData.attack = function (root, p) {
      // On note l'instant de l'attaque : autoAnimate met alors l'idle en
      // sommeil, sinon les deux se disputeraient les mêmes rotations.
      g.userData.llAtk = R3.clock.t;
      try { o.attack(R3.clamp01(p)); } catch (e) { /* une attaque ne casse rien */ }
      ANIMAURA(g, R3.clock.t);
    };
    finalizeSize(g);
    if (LL && LL.autoAnimate) { try { LL.autoAnimate(g); } catch (e) { /* optionnel */ } }
    return g;
  }

  // ===========================================================================
  // ===========================================================================
  //  FEU — pyrathos · emberyx · fournalis          (région : Caldeira de Braise)
  // ===========================================================================
  // ===========================================================================

  // ---------------------------------------------------------------------------
  //  PYRATHOS — DRAGON DE MAGMA.
  //  Ce qu'on doit lire en une seconde : un dragon. Donc la posture dressée, le
  //  long cou incliné, les deux GRANDES ailes membranées déployées, la queue
  //  lourde qui traîne, et la crête de cristaux de lave sur l'échine.
  //  Attributs distinctifs : ailes majestueuses + cristaux + cœur lumineux.
  //  Budget : 22 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('pyrathos', function () {
    const CRUST = '#c0392b', FIRE = '#ff6b3d', GLOW = '#ffd166';
    const oCrust = ROUGH, oFire = LIT(FIRE), oGlow = HOT(GLOW);
    const g = new THREE.Group();

    // --- CORPS (fusionné : croûte + magma + veines = 3 draw calls) -----------
    const hull = new THREE.Group();
    hull.position.set(0, 0.66, 0);                 // pivot à la hanche
    g.add(hull);
    hull.add(R3.ellipsoid(0.48, 0.54, 0.50, CRUST, 0, 0.52, -0.04, oCrust));   // poitrail haut
    hull.add(R3.ellipsoid(0.44, 0.42, 0.48, CRUST, 0, 0.04, -0.12, oCrust));   // bassin
    hull.add(R3.ellipsoid(0.34, 0.40, 0.34, FIRE, 0, 0.34, 0.24, oFire));      // ventre de magma
    // Veines incandescentes : elles ne coûtent rien une fois fusionnées, et ce
    // sont elles qui font lire « roche fendue » plutôt que « caillou rouge ».
    [[0.32, 0.60, 0.10, 0.6], [-0.34, 0.52, 0.02, -0.5], [0.26, 0.10, 0.16, 0.4], [-0.28, 0.06, 0.10, -0.3]]
      .forEach(function (v) {
        const m = R3.ellipsoid(0.05, 0.20, 0.05, GLOW, v[0], v[1], v[2], oGlow);
        m.rotation.z = v[3];
        hull.add(m);
      });
    // Deux pattes arrière massives + deux bras courts repliés : la posture du
    // dragon debout. Tout part dans la même fusion.
    hull.add(leg(-0.29, -0.02, 0.10, 0.62, 0.17, 0.13, CRUST, oCrust, FIRE, oFire));
    hull.add(leg(0.29, -0.02, 0.10, 0.62, 0.17, 0.13, CRUST, oCrust, FIRE, oFire));
    [-1, 1].forEach(function (s) {
      const arm = R3.cyl(0.09, 0.07, 0.34, CRUST, s * 0.42, 0.42, 0.18, oCrust);
      arm.rotation.z = s * 0.7; arm.rotation.x = -0.5;
      hull.add(arm);
      hull.add(R3.ellipsoid(0.09, 0.07, 0.11, GLOW, s * 0.52, 0.26, 0.30, oGlow));   // griffes
    });
    // Crête de cristaux de lave le long de l'échine (attribut n° 2).
    hull.add(CRYSTAL(GLOW, 5, 0.20, { bake: true, base: false, glow: false, spread: 0.5, tipColor: null, x: 0, y: 0.78, z: -0.28 }));
    BAKE(hull);

    // --- TÊTE + COU (fusionnés : 2 draw calls) -------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.28, 0.06);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.cyl(0.20, 0.30, 0.46, CRUST, 0, 0.16, 0.06, oCrust));           // cou
    skull.add(R3.ellipsoid(0.24, 0.22, 0.36, CRUST, 0, 0.44, 0.24, oCrust));     // crâne
    skull.add(R3.ellipsoid(0.16, 0.11, 0.26, CRUST, 0, 0.34, 0.40, oCrust));     // mâchoire
    skull.add(R3.ellipsoid(0.13, 0.08, 0.20, GLOW, 0, 0.36, 0.46, oGlow));       // gueule ardente
    [-1, 1].forEach(function (s) {
      const horn = R3.cone(0.05, 0.34, GLOW, s * 0.15, 0.62, 0.10, oGlow);
      horn.rotation.z = -s * 0.35; horn.rotation.x = -0.42;
      skull.add(horn);
      const petite = R3.cone(0.035, 0.18, GLOW, s * 0.20, 0.50, -0.02, oGlow);
      petite.rotation.z = -s * 0.75;
      skull.add(petite);
    });
    BAKE(skull);
    head.add(EYES(0.16, 0.46, 0.40, 0.070, { color: GLOW, dark: '#2a1108', angry: 0.85 }));

    // --- AILES DE BRAISE (fusionnées : 2 draw calls chacune) -----------------
    const wingL = WING(1.30, FIRE, { style: 'membrane', color2: CRUST, boneColor: CRUST, bake: true, side: -1, x: -0.36, y: 1.28, z: -0.14 });
    const wingR = WING(1.30, FIRE, { style: 'membrane', color2: CRUST, boneColor: CRUST, bake: true, side: 1, x: 0.36, y: 1.28, z: -0.14 });
    wingL.rotation.z = 0.30; wingR.rotation.z = -0.30;
    g.add(wingL, wingR);

    // --- QUEUE (3 maillons articulés = 3 draw calls) -------------------------
    const tail = TAIL(1.35, FIRE, 3, { style: 'flame', color2: GLOW, width: 0.30, droop: 0.10, y: 0.72, z: -0.50 });
    g.add(tail);

    // --- CŒUR DE MAGMA (attribut n° 3, 1 draw call) --------------------------
    const heart = CORE(GLOW, 0.26, { shells: 1, y: 1.00, z: 0.32 });
    g.add(heart);

    // --- AURA (obligatoire) + braises en suspension --------------------------
    g.add(AURA(FIRE, 1.45, { color2: GLOW, rings: 1, particles: 0, shape: 'sphere' }));
    g.add(STARS(GLOW, 22, 1.50, { color2: FIRE, spread: 'shell', ry: 0.80, size: 0.085, seed: 11, y: 1.05 }));

    return finish(g, {
      aura: FIRE,
      anim: { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false },
      idle: function (t) {
        // Idle CALME : respiration lente, tête qui balaie l'horizon, ailes qui
        // s'ouvrent et se referment à peine — un dragon posé, pas un moineau.
        hull.rotation.x = Math.sin(t * 1.0) * 0.022;
        head.position.y = 1.28 + Math.sin(t * 1.0) * 0.030;
        head.rotation.x = -0.06 + Math.sin(t * 0.85 + 0.7) * 0.055;
        head.rotation.y = Math.sin(t * 0.40) * 0.18;
        wingL.rotation.z = 0.30 + Math.sin(t * 0.75) * 0.14;
        wingR.rotation.z = -0.30 - Math.sin(t * 0.75) * 0.14;
        tail.rotation.y = Math.sin(t * 0.60) * 0.14;
      },
      attack: function (p) {
        // « Souffle de magma » : le buste se cabre, la tête plonge, les ailes
        // claquent en grand et la gueule s'embrase.
        const k = arc(p);
        hull.rotation.x = -k * 0.16;
        head.rotation.x = -k * 0.60;
        head.position.z = 0.06 + k * 0.34;
        head.position.y = 1.28 + k * 0.10;
        wingL.rotation.z = 0.30 + Math.sin(p * Math.PI * 3) * 0.75;
        wingR.rotation.z = -0.30 - Math.sin(p * Math.PI * 3) * 0.75;
        tail.rotation.y = Math.sin(p * Math.PI * 5) * 0.55;
        heart.scale.setScalar(1 + k * 0.6);
        if (p >= 1) { hull.rotation.x = 0; head.rotation.x = 0; head.position.set(0, 1.28, 0.06); heart.scale.setScalar(1); }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  EMBERYX — PHÉNIX.
  //  Ce qu'on doit lire : un oiseau de flammes. Silhouette verticale, ailes de
  //  plumes largement déployées en permanence, et surtout une TRAÎNE de feu
  //  démesurée qui descend jusqu'au sol — c'est elle la signature.
  //  Attributs distinctifs : ailes majestueuses + traîne + couronne.
  //  Budget : 21 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('emberyx', function () {
    const BODY = '#ff8c42', BRIGHT = '#ffd166', ACCENT = '#e94b3c';
    const oBody = SOFT, oBright = HOT(BRIGHT), oAccent = LIT(ACCENT);
    const g = new THREE.Group();

    // --- CORPS + PATTES (fusionnés : 3 draw calls) ---------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 0.90, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.28, 0.44, 0.34, BODY, 0, 0.40, 0, oBody));           // torse dressé
    hull.add(R3.ellipsoid(0.22, 0.26, 0.24, BRIGHT, 0, 0.28, 0.18, oBright));    // poitrail de braise
    // Plumage du dos : 4 écailles qui accrochent la lumière (fusion gratuite).
    [[0.16, 0.60, -0.20], [-0.16, 0.60, -0.20], [0.12, 0.36, -0.26], [-0.12, 0.36, -0.26]].forEach(function (q) {
      hull.add(R3.ellipsoid(0.11, 0.17, 0.05, ACCENT, q[0], q[1], q[2], oAccent));
    });
    [-0.15, 0.15].forEach(function (x) {
      hull.add(leg(x, 0.02, 0.02, 0.62, 0.055, 0.045, ACCENT, oAccent, ACCENT, oAccent));
    });
    BAKE(hull);

    // --- TÊTE (fusionnée : 2 draw calls) -------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.52, 0.02);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.cyl(0.09, 0.14, 0.34, BODY, 0, -0.10, 0.02, oBody));            // cou fin
    skull.add(R3.ellipsoid(0.15, 0.14, 0.20, BODY, 0, 0.14, 0.10, oBody));       // crâne
    skull.add(R3.cone(0.045, 0.20, ACCENT, 0, 0.10, 0.30, oAccent));             // bec
    // Huppe de trois plumes : ce petit détail suffit à faire « oiseau noble ».
    [-1, 0, 1].forEach(function (s) {
      const pl = R3.ellipsoid(0.035, 0.16, 0.05, ACCENT, s * 0.07, 0.30, -0.02, oAccent);
      pl.rotation.z = -s * 0.35; pl.rotation.x = -0.25;
      skull.add(pl);
    });
    BAKE(skull);
    head.add(EYES(0.105, 0.16, 0.24, 0.048, { color: BRIGHT, dark: '#3b1608', angry: 0.45 }));
    // Couronne de flammes flottante (attribut n° 3, 1 draw call).
    head.add(CROWN(BRIGHT, 0.23, 7, { h: 0.22, speed: 0.35, y: 0.36 }));

    // --- AILES DE PLUMES (fusionnées : 2 draw calls chacune) -----------------
    const wingL = WING(1.15, BRIGHT, { style: 'feather', color2: ACCENT, segments: 6, arm: false, bake: true, side: -1, x: -0.26, y: 1.32, z: -0.06 });
    const wingR = WING(1.15, BRIGHT, { style: 'feather', color2: ACCENT, segments: 6, arm: false, bake: true, side: 1, x: 0.26, y: 1.32, z: -0.06 });
    wingL.rotation.z = 0.45; wingR.rotation.z = -0.45;
    g.add(wingL, wingR);

    // --- LA TRAÎNE (4 maillons articulés = 4 draw calls) ---------------------
    // Emboîtés : faire tourner le premier entraîne toute la traîne. C'est ce
    // fouetté qui rend le phénix vivant même immobile.
    const tail = TAIL(1.90, ACCENT, 4, { style: 'flame', color2: BRIGHT, width: 0.42, droop: 0.16, amp: 0.26, y: 1.14, z: -0.22 });
    g.add(tail);

    g.add(AURA(BRIGHT, 1.35, { color2: ACCENT, rings: 1, particles: 0, shape: 'sphere' }));
    g.add(STARS(BRIGHT, 24, 1.45, { color2: ACCENT, spread: 'ball', ry: 1.1, size: 0.075, seed: 22, y: 1.15 }));

    return finish(g, {
      aura: BRIGHT,
      anim: { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false },
      idle: function (t) {
        hull.position.y = 0.90 + Math.sin(t * 1.15) * 0.035;
        head.rotation.x = Math.sin(t * 0.95 + 0.4) * 0.06;
        head.rotation.y = Math.sin(t * 0.5) * 0.20;
        wingL.rotation.z = 0.45 + Math.sin(t * 0.9) * 0.16;
        wingR.rotation.z = -0.45 - Math.sin(t * 0.9) * 0.16;
      },
      attack: function (p) {
        // « Renaissance ardente » : le phénix s'élève, les ailes s'ouvrent
        // largement et la traîne se gonfle en gerbe.
        const k = arc(p);
        hull.position.y = 0.90 + k * 0.32;
        hull.rotation.x = -k * 0.22;
        head.rotation.x = -k * 0.26;
        wingL.rotation.z = 0.45 + k * 0.95;
        wingR.rotation.z = -0.45 - k * 0.95;
        tail.rotation.x = -k * 0.30;
        tail.scale.setScalar(1 + k * 0.30);
        if (p >= 1) { hull.position.y = 0.90; hull.rotation.x = 0; tail.rotation.x = 0; tail.scale.setScalar(1); }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  FOURNALIS — LION À CRINIÈRE DE LAVE.
  //  Ce qu'on doit lire : un fauve. Silhouette HORIZONTALE et basse — ce qui le
  //  distingue net des deux autres feu, dressés — avec une immense crinière
  //  rayonnante et des anneaux de braise qui tournent autour de lui.
  //  Attributs distinctifs : crinière + anneaux en orbite + cristaux.
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('fournalis', function () {
    const BODY = '#e25822', LAVA = '#f4a259', DARK = '#3b1f1a', GLOW = '#ffd166';
    const oBody = SOLID, oDark = ROUGH, oGlow = HOT(GLOW);
    const g = new THREE.Group();

    // --- CORPS + 4 PATTES (fusionnés : 3 draw calls) -------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 1.00, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.44, 0.42, 0.72, BODY, 0, 0, -0.06, oBody));          // tronc
    hull.add(R3.ellipsoid(0.38, 0.26, 0.58, DARK, 0, -0.24, -0.02, oDark));      // ventre sombre
    hull.add(R3.ellipsoid(0.34, 0.34, 0.30, BODY, 0, 0.10, 0.44, oBody));        // épaules
    // Braises incrustées dans le dos (fusion gratuite).
    [[0.18, 0.34, 0.10], [-0.18, 0.34, -0.10], [0, 0.40, -0.30]].forEach(function (q) {
      hull.add(R3.ellipsoid(0.07, 0.05, 0.11, GLOW, q[0], q[1], q[2], oGlow));
    });
    [[-0.30, 0.34], [0.30, 0.34], [-0.28, -0.42], [0.28, -0.42]].forEach(function (q) {
      hull.add(leg(q[0], 0, q[1], 1.00, 0.14, 0.115, DARK, oDark, BODY, oBody));
    });
    // Cristaux de lave sur l'échine (attribut n° 3).
    hull.add(CRYSTAL(GLOW, 5, 0.18, { bake: true, base: false, glow: false, spread: 0.6, x: 0, y: 0.36, z: -0.14 }));
    BAKE(hull);

    // --- TÊTE (fusionnée : 2 draw calls) -------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.12, 0.62);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.ellipsoid(0.28, 0.26, 0.30, BODY, 0, 0, 0, oBody));
    skull.add(R3.ellipsoid(0.15, 0.12, 0.19, DARK, 0, -0.10, 0.26, oDark));      // museau
    skull.add(R3.ellipsoid(0.12, 0.06, 0.14, GLOW, 0, -0.14, 0.32, oGlow));      // gueule ardente
    [-1, 1].forEach(function (s) {
      skull.add(R3.ellipsoid(0.09, 0.11, 0.04, DARK, s * 0.22, 0.20, -0.04, oDark));  // oreilles
    });
    BAKE(skull);
    head.add(EYES(0.16, 0.06, 0.27, 0.058, { color: GLOW, dark: '#2a1108', angry: 0.75 }));
    // LA crinière — 12 mèches rayonnantes, fusionnées en 2 draw calls.
    const crin = MANE(LAVA, 0.50, 12, { color2: GLOW, sweep: 0.10, x: 0, y: 0.02, z: -0.16 });
    head.add(crin);

    // --- QUEUE À TOUPET (3 maillons = 3 draw calls) --------------------------
    const tail = TAIL(1.05, BODY, 3, { style: 'flame', color2: LAVA, width: 0.26, droop: -0.16, y: 1.05, z: -0.74 });
    g.add(tail);

    // --- AURA au sol (le fauve est posé : le halo est une flaque de braise) --
    g.add(AURA(BODY, 1.40, { color2: LAVA, rings: 1, particles: 0, shape: 'disc' }));
    g.add(ARCS(GLOW, 1.00, 2, { color2: LAVA, y0: 0.95 }));      // anneaux de braise
    g.add(STARS(GLOW, 20, 1.35, { color2: BODY, spread: 'ball', ry: 0.8, size: 0.08, seed: 33, y: 1.00 }));

    return finish(g, {
      aura: BODY,
      anim: { head: head, tail: tail, float: false },
      idle: function (t) {
        hull.position.y = 1.00 + Math.sin(t * 1.25) * 0.020;
        head.position.y = 1.12 + Math.sin(t * 1.25 + 0.5) * 0.030;
        head.rotation.y = Math.sin(t * 0.42) * 0.22;
        head.rotation.x = Math.sin(t * 0.9) * 0.045;
        crin.rotation.z = Math.sin(t * 0.55) * 0.10;
        tail.rotation.y = Math.sin(t * 0.8) * 0.20;
      },
      attack: function (p) {
        // « Rugissement de lave » : il se ramasse, bondit, crinière hérissée.
        const k = arc(p);
        hull.position.z = k * 0.55;
        hull.position.y = 1.00 + k * 0.22;
        hull.rotation.x = -k * 0.12;
        head.position.z = 0.62 + k * 0.55;
        head.position.y = 1.12 + k * 0.24;
        head.rotation.x = -k * 0.18;
        crin.scale.setScalar(1 + k * 0.35);
        tail.rotation.y = Math.sin(p * Math.PI * 6) * 0.6;
        if (p >= 1) {
          hull.position.set(0, 1.00, 0); hull.rotation.x = 0;
          head.position.set(0, 1.12, 0.62); head.rotation.x = 0; crin.scale.setScalar(1);
        }
      },
    });
  });

  // ===========================================================================
  // ===========================================================================
  //  EAU — abyssalor · ondinae · marea                 (région : Côte de Saphir)
  // ===========================================================================
  // ===========================================================================

  // ---------------------------------------------------------------------------
  //  ABYSSALOR — LÉVIATHAN-SERPENT DES ABYSSES.
  //  Ce qu'on doit lire : un immense serpent de mer. Long corps qui ondule au
  //  ras du sol, cou dressé très haut, crête dorsale translucide, couronne de
  //  corail. Le seul des trois eau sans membres.
  //  Attributs distinctifs : couronne + cristaux + anneaux en orbite.
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('abyssalor', function () {
    const DEEP = '#123a6b', MID = '#2f7fb8', GLOW = '#73eff7';
    const oDeep = SOLID, oGlow = HOT(GLOW);
    const g = new THREE.Group();

    // --- LE CORPS SERPENTIN (6 anneaux emboîtés = 6 draw calls) --------------
    // C'est le poste le plus cher du modèle, et c'est justifié : c'est LUI la
    // silhouette. Tout le reste a été comprimé pour le financer.
    const body = SERPENT(2.30, DEEP, { segments: 6, color2: MID, r: 0.30, taper: 0.72, amp: 0.28, speed: 1.0, x: 0, y: 0.52, z: -0.05 });
    g.add(body);

    // --- COU + TÊTE (fusionnés : 2 draw calls) -------------------------------
    const neck = new THREE.Group();
    neck.position.set(0, 0.52, 0.18);
    g.add(neck);
    const skull = new THREE.Group();
    neck.add(skull);
    skull.add(R3.cyl(0.19, 0.30, 0.62, DEEP, 0, 0.31, 0.02, oDeep));             // cou dressé
    skull.add(R3.ellipsoid(0.22, 0.22, 0.24, DEEP, 0, 0.68, 0.04, oDeep));
    skull.add(R3.ellipsoid(0.21, 0.19, 0.34, DEEP, 0, 0.92, 0.14, oDeep));       // crâne allongé
    skull.add(R3.ellipsoid(0.14, 0.09, 0.22, GLOW, 0, 0.86, 0.34, oGlow));       // mâchoire lumineuse
    [-1, 1].forEach(function (s) {
      const fin = R3.ellipsoid(0.03, 0.15, 0.19, GLOW, s * 0.23, 0.98, 0.00, oGlow);
      fin.rotation.z = s * 0.55;
      skull.add(fin);                                                             // ouïes-nageoires
      const barb = R3.cyl(0.014, 0.022, 0.30, GLOW, s * 0.10, 0.74, 0.30, oGlow);
      barb.rotation.x = 0.9;
      skull.add(barb);                                                            // barbillons
    });
    BAKE(skull);
    neck.add(EYES(0.14, 0.94, 0.30, 0.058, { color: GLOW, dark: '#081226', angry: 0.75 }));
    // Couronne de corail (attribut n° 1) et crête dorsale translucide.
    neck.add(CROWN(GLOW, 0.22, 7, { h: 0.26, speed: 0.24, y: 1.16, z: 0.04 }));
    neck.add(CREST(0.95, GLOW, 6, { h: 0.30, opacity: 0.62, y: 0.30, z: -0.12 }));

    // --- Cristaux d'abysse sur l'échine (attribut n° 2) ----------------------
    g.add(CRYSTAL(GLOW, 5, 0.20, { bake: true, base: false, glow: false, opacity: 0.7, spread: 0.7, x: 0, y: 0.72, z: -0.55 }));

    g.add(AURA(MID, 1.45, { color2: GLOW, rings: 1, particles: 0, shape: 'sphere', y0: 0.95 }));
    g.add(ARCS(GLOW, 1.05, 2, { color2: MID, y0: 0.95 }));        // anneaux d'eau (attribut n° 3)
    g.add(STARS(GLOW, 22, 1.55, { color2: MID, spread: 'shell', ry: 0.9, size: 0.075, seed: 44, y: 0.95 }));

    return finish(g, {
      aura: MID,
      anim: { head: neck, tail: body, float: false },
      idle: function (t) {
        // Ondulation lente de tout le corps + cou qui berce : le calme d'un
        // animal énorme qui n'a peur de rien.
        neck.rotation.z = Math.sin(t * 0.55) * 0.07;
        neck.rotation.x = Math.sin(t * 0.75 + 0.3) * 0.05;
        neck.position.y = 0.52 + Math.sin(t * 0.9) * 0.035;
        body.rotation.y = Math.sin(t * 0.45) * 0.10;
      },
      attack: function (p) {
        // « Étreinte abyssale » : le cou fouette vers l'avant, tout le corps suit.
        const k = arc(p);
        neck.rotation.x = -k * 0.65;
        neck.position.z = 0.18 + k * 0.45;
        neck.position.y = 0.52 - k * 0.10;
        body.rotation.y = Math.sin(p * Math.PI * 4) * 0.22;
        if (p >= 1) { neck.rotation.x = 0; neck.position.set(0, 0.52, 0.18); body.rotation.y = 0; }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  ONDINAË — ESPRIT D'ÉCUME.
  //  Ce qu'on doit lire : une apparition. Corps translucide qui LÉVITE, deux
  //  voiles d'eau tendus en guise d'ailes, une longue jupe d'écume qui ondule
  //  jusqu'au sol, une couronne de gouttes et des perles en orbite.
  //  Attributs distinctifs : ailes-voiles + couronne + anneaux en orbite.
  //  Budget : 19 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('ondinae', function () {
    const CYAN = '#73eff7', LIGHT = '#a8e6ff', WHITE = '#f4f4f4';
    const oVeil = VEIL(CYAN), oPale = VEIL(LIGHT), oPearl = HOT(WHITE);
    const g = new THREE.Group();

    // --- TORSE TRANSLUCIDE (fusionné : 2 draw calls) -------------------------
    const torso = new THREE.Group();
    torso.position.set(0, 1.34, 0);
    g.add(torso);
    const shell = new THREE.Group();
    torso.add(shell);
    shell.add(R3.ellipsoid(0.26, 0.44, 0.24, CYAN, 0, 0, 0, oVeil));             // buste
    shell.add(R3.ellipsoid(0.19, 0.22, 0.18, LIGHT, 0, 0.30, 0.02, oPale));      // épaules
    [-1, 1].forEach(function (s) {
      const brasg = R3.ellipsoid(0.07, 0.26, 0.07, LIGHT, s * 0.24, 0.02, 0.04, oPale);
      brasg.rotation.z = s * 0.28;
      shell.add(brasg);                                                           // bras d'eau
    });
    BAKE(shell);

    // --- TÊTE (fusionnée : 1 draw call) --------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.02);
    torso.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.ellipsoid(0.155, 0.175, 0.155, LIGHT, 0, 0, 0, oPale));
    // Chevelure d'eau : quatre mèches qui retombent dans la nuque.
    [[-0.13, -0.06, -0.10], [0.13, -0.06, -0.10], [-0.06, -0.16, -0.14], [0.06, -0.16, -0.14]].forEach(function (q) {
      skull.add(R3.ellipsoid(0.055, 0.20, 0.055, LIGHT, q[0], q[1], q[2], oPale));
    });
    BAKE(skull);
    head.add(EYES(0.078, 0.02, 0.135, 0.038, { color: WHITE, dark: '#0e3a4a', angry: 0.08, tilt: 0.06 }));
    // Couronne de gouttes (attribut n° 1).
    head.add(CROWN(WHITE, 0.20, 8, { color2: CYAN, h: 0.17, gem: true, speed: 0.26, y: 0.20 }));

    // --- VOILES D'EAU (ailes membranées translucides : 1 draw call chacune) --
    const veilL = WING(1.05, LIGHT, { style: 'membrane', color2: LIGHT, boneColor: LIGHT, opacity: 0.45, arm: false, bake: true, side: -1, x: -0.24, y: 0.10, z: -0.06 });
    const veilR = WING(1.05, LIGHT, { style: 'membrane', color2: LIGHT, boneColor: LIGHT, opacity: 0.45, arm: false, bake: true, side: 1, x: 0.24, y: 0.10, z: -0.06 });
    veilL.rotation.z = 0.35; veilR.rotation.z = -0.35;
    torso.add(veilL, veilR);

    // --- JUPE D'ÉCUME (5 lames en onde = 5 draw calls) ----------------------
    // Repère tourné pour que le ruban, qui part vers -z par défaut, coule vers
    // le bas : c'est la traîne qui donne toute sa hauteur à la silhouette.
    const skirtWrap = new THREE.Group();
    skirtWrap.rotation.x = -Math.PI / 2;
    skirtWrap.position.set(0, -0.36, 0);
    torso.add(skirtWrap);
    const skirt = RIBBON(1.25, CYAN, { color2: LIGHT, opacity: 0.48, segments: 5, width: 0.42, taper: 0.55, amp: 0.16, speed: 1.2 });
    skirtWrap.add(skirt);

    g.add(AURA(CYAN, 1.30, { color2: LIGHT, rings: 1, particles: 0, shape: 'sphere', y0: 1.20 }));
    g.add(ORBIT(WHITE, 0.62, 7, { shape: 'sphere', size: 0.11, bake: true, tilt: 0.5, speed: 0.55, y: 1.30 }));  // perles
    g.add(STARS(WHITE, 26, 1.40, { color2: CYAN, spread: 'ball', ry: 1.15, size: 0.06, seed: 55, y: 1.25 }));

    return finish(g, {
      aura: CYAN,
      baseY: 0.14,
      anim: { head: head, wingL: veilL, wingR: veilR, tail: skirt, float: true },
      idle: function (t) {
        // Lévitation lente : c'est un esprit, il ne touche jamais le sol.
        g.position.y = 0.14 + Math.sin(t * 0.85) * 0.075;
        torso.rotation.z = Math.sin(t * 0.5) * 0.045;
        head.rotation.y = Math.sin(t * 0.4 + 1.1) * 0.20;
        head.rotation.z = Math.sin(t * 0.65) * 0.05;
        veilL.rotation.z = 0.35 + Math.sin(t * 0.7) * 0.20;
        veilR.rotation.z = -0.35 - Math.sin(t * 0.7) * 0.20;
      },
      attack: function (p) {
        // « Vague déferlante » : elle se penche, les voiles s'ouvrent et la jupe
        // jaillit vers l'adversaire.
        const k = arc(p);
        torso.rotation.x = -k * 0.38;
        torso.position.z = k * 0.50;
        veilL.rotation.y = -k * 0.95;
        veilR.rotation.y = k * 0.95;
        skirtWrap.scale.setScalar(1 + k * 0.40);
        if (p >= 1) {
          torso.rotation.x = 0; torso.position.z = 0;
          veilL.rotation.y = 0; veilR.rotation.y = 0; skirtWrap.scale.setScalar(1);
        }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  MARÉA — RAIE DES MARÉES.
  //  Ce qu'on doit lire : une raie qui plane. Corps large et plat, deux
  //  immenses nageoires-ailes, une queue-fouet interminable, et des runes
  //  lumineuses gravées sur le dos.
  //  Attributs distinctifs : ailes majestueuses + traîne + runes + anneaux.
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('marea', function () {
    const BASE = '#2f7fb8', BRIGHT = '#41a6f6', UNDER = '#bce884';
    const oBase = SOFT, oUnder = LIT(UNDER), oBright = HOT(BRIGHT);
    const g = new THREE.Group();

    // --- DISQUE (fusionné : 3 draw calls) ------------------------------------
    const body = new THREE.Group();
    body.position.set(0, 1.10, 0);
    g.add(body);
    const shell = new THREE.Group();
    body.add(shell);
    shell.add(R3.ellipsoid(0.66, 0.17, 0.86, BASE, 0, 0, 0, oBase));             // disque
    shell.add(R3.ellipsoid(0.48, 0.11, 0.62, UNDER, 0, -0.10, 0.06, oUnder));    // ventre clair
    shell.add(R3.ellipsoid(0.27, 0.17, 0.30, BASE, 0, 0.03, 0.64, oBase));       // bosse frontale
    // Évents et taches lumineuses (fusion gratuite).
    [[0.22, 0.11, 0.30], [-0.22, 0.11, 0.30], [0.34, 0.09, -0.10], [-0.34, 0.09, -0.10]].forEach(function (q) {
      shell.add(R3.ellipsoid(0.075, 0.03, 0.115, BRIGHT, q[0], q[1], q[2], oBright));
    });
    BAKE(shell);
    body.add(EYES(0.17, 0.12, 0.80, 0.050, { color: BRIGHT, dark: '#0c2a44', angry: 0.15 }));

    // --- NAGEOIRES-AILES (1 draw call chacune) -------------------------------
    // Dièdre marqué et permanent : c'est lui qui donne à la raie sa hauteur au
    // repos. Le battement, lui, reste volontairement TRÈS ample en attaque mais
    // minuscule en idle (§9 : « idle calme »).
    const wingL = WING(1.45, BASE, { style: 'membrane', color2: BASE, boneColor: BASE, arm: false, bake: true, side: -1, x: -0.34, y: 0.02, z: -0.04 });
    const wingR = WING(1.45, BASE, { style: 'membrane', color2: BASE, boneColor: BASE, arm: false, bake: true, side: 1, x: 0.34, y: 0.02, z: -0.04 });
    wingL.rotation.z = 0.34; wingR.rotation.z = -0.34;
    body.add(wingL, wingR);

    // --- LA QUEUE-FOUET (5 maillons = 5 draw calls) --------------------------
    // Elle retombe nettement : la traîne descend sous le corps et complète la
    // silhouette en hauteur, ce qu'un disque plat ne peut pas faire seul.
    const tail = TAIL(1.75, BASE, 5, { style: 'fin', color2: BRIGHT, width: 0.24, droop: 0.16, amp: 0.20, y: 1.08, z: -0.62 });
    g.add(tail);

    // --- Runes des marées, en couronne au-dessus du dos (attribut distinctif) -
    const runes = RUNES(BRIGHT, 0.55, 6, { color2: UNDER, size: 0.18, speed: -0.30, y: 1.62 });
    g.add(runes);

    g.add(AURA(BRIGHT, 1.35, { color2: UNDER, rings: 1, particles: 0, shape: 'sphere', y0: 1.05 }));
    g.add(ARCS(BRIGHT, 1.05, 2, { color2: UNDER, y0: 1.05 }));
    g.add(STARS(BRIGHT, 20, 1.45, { color2: UNDER, spread: 'disc', ry: 1, size: 0.07, seed: 66, y: 1.05 }));

    return finish(g, {
      aura: BRIGHT,
      baseY: 0.06,
      anim: { head: body, wingL: wingL, wingR: wingR, tail: tail, float: true },
      idle: function (t) {
        // Vol plané : les nageoires ondulent lentement, tout le corps respire.
        g.position.y = 0.06 + Math.sin(t * 0.8) * 0.070;
        body.rotation.x = Math.sin(t * 0.75) * 0.055;
        body.rotation.z = Math.sin(t * 0.45) * 0.05;
        wingL.rotation.z = 0.34 + Math.sin(t * 0.95) * 0.11;
        wingR.rotation.z = -0.34 - Math.sin(t * 0.95) * 0.11;
        tail.rotation.y = Math.sin(t * 0.7) * 0.16;
      },
      attack: function (p) {
        // « Vague de fond » : Maréa plonge, cabre ses nageoires et fait claquer
        // sa queue comme un fouet.
        const k = arc(p);
        body.position.z = k * 0.60;
        body.rotation.x = -k * 0.30;
        wingL.rotation.z = 0.34 + Math.sin(p * Math.PI * 3) * 0.70;
        wingR.rotation.z = -0.34 - Math.sin(p * Math.PI * 3) * 0.70;
        tail.rotation.y = Math.sin(p * Math.PI * 6) * 0.70;
        if (p >= 1) { body.position.z = 0; body.rotation.x = 0; }
      },
    });
  });

  // ===========================================================================
  // ===========================================================================
  //  PLANTE — sylvaros · florabelle · racinor         (région : Val d'Émeraude)
  // ===========================================================================
  // ===========================================================================

  // ---------------------------------------------------------------------------
  //  SYLVAROS — CERF-FORÊT MILLÉNAIRE.
  //  Ce qu'on doit lire : un grand cerf. Silhouette haute sur pattes, et
  //  surtout une RAMURE de branches démesurée qui double la hauteur de la tête.
  //  Une gemme au front, des feuilles en orbite dans les bois.
  //  Attributs distinctifs : ramure + cœur lumineux + anneaux + cristaux.
  //  Budget : 18 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('sylvaros', function () {
    const DGREEN = '#1e8449', WOOD = '#8b5a2b', LGREEN = '#a7f070';
    const oGreen = SOLID, oWood = ROUGH, oLeaf = LIT(LGREEN);
    const g = new THREE.Group();

    // --- CORPS + 4 PATTES (fusionnés : 3 draw calls) -------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 1.10, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.33, 0.36, 0.64, DGREEN, 0, 0, -0.06, oGreen));       // tronc
    hull.add(R3.ellipsoid(0.28, 0.24, 0.50, WOOD, 0, -0.20, -0.02, oWood));      // ventre d'écorce
    hull.add(R3.ellipsoid(0.30, 0.30, 0.28, DGREEN, 0, 0.10, 0.38, oGreen));     // garrot
    // Mousse et pousses sur l'échine (fusion gratuite).
    [[0.10, 0.32, 0.10], [-0.10, 0.32, -0.10], [0, 0.34, -0.32]].forEach(function (q) {
      hull.add(R3.ellipsoid(0.11, 0.06, 0.14, LGREEN, q[0], q[1], q[2], oLeaf));
    });
    [[-0.20, 0.30], [0.20, 0.30], [-0.18, -0.32], [0.18, -0.32]].forEach(function (q) {
      hull.add(leg(q[0], 0, q[1], 1.04, 0.075, 0.055, WOOD, oWood, DGREEN, oGreen));
    });
    // Cristaux de sève sur la croupe (attribut distinctif).
    hull.add(CRYSTAL(LGREEN, 4, 0.16, { bake: true, base: false, glow: false, spread: 0.6, x: 0, y: 0.30, z: -0.44 }));
    BAKE(hull);

    // --- TÊTE + RAMURE (fusionnées : 2 draw calls) ---------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.42, 0.52);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.cyl(0.13, 0.18, 0.34, DGREEN, 0, -0.16, -0.06, oGreen));        // encolure
    skull.add(R3.ellipsoid(0.16, 0.19, 0.30, DGREEN, 0, 0.06, 0.06, oGreen));    // crâne
    skull.add(R3.ellipsoid(0.10, 0.10, 0.17, WOOD, 0, -0.06, 0.28, oWood));      // museau
    [-1, 1].forEach(function (s) {
      const or = R3.ellipsoid(0.05, 0.10, 0.03, DGREEN, s * 0.17, 0.18, -0.02, oGreen);
      or.rotation.z = -s * 0.6;
      skull.add(or);                                                              // oreilles
    });
    // LA RAMURE — deux ramures branchues avec bourgeons, fusionnées avec la tête.
    const bL = ANTLER(0.58, WOOD, { side: -1, tipColor: LGREEN, bake: false });
    const bR = ANTLER(0.58, WOOD, { side: 1, tipColor: LGREEN, bake: false });
    bL.position.set(-0.10, 0.20, -0.02);
    bR.position.set(0.10, 0.20, -0.02);
    skull.add(bL, bR);
    BAKE(skull);
    head.add(EYES(0.115, 0.08, 0.24, 0.046, { color: LGREEN, dark: '#0c2a12', angry: 0.20 }));
    // Gemme au front (cœur lumineux, 1 draw call) et feuilles en orbite.
    const gemme = CORE(LGREEN, 0.13, { shells: 1, y: 0.19, z: 0.22 });
    head.add(gemme);
    head.add(ORBIT(LGREEN, 0.46, 6, { shape: 'star', size: 0.11, bake: true, tilt: 0.45, speed: 0.4, y: 0.52 }));

    // --- QUEUE (2 maillons = 2 draw calls) -----------------------------------
    const tail = TAIL(0.42, DGREEN, 2, { style: 'feather', color2: LGREEN, width: 0.20, y: 1.10, z: -0.66 });
    g.add(tail);

    g.add(AURA(LGREEN, 1.40, { color2: DGREEN, rings: 1, particles: 0, shape: 'sphere', y0: 1.15 }));
    g.add(STARS(LGREEN, 24, 1.50, { color2: '#f4f4f4', spread: 'ball', ry: 1.05, size: 0.07, seed: 77, y: 1.10 }));

    return finish(g, {
      aura: LGREEN,
      anim: { head: head, tail: tail, float: false },
      idle: function (t) {
        hull.position.y = 1.10 + Math.sin(t * 1.05) * 0.022;
        head.position.y = 1.42 + Math.sin(t * 1.05 + 0.4) * 0.035;
        head.rotation.y = Math.sin(t * 0.35) * 0.24;      // il balaie lentement la forêt
        head.rotation.x = Math.sin(t * 0.8) * 0.05;
        tail.rotation.y = Math.sin(t * 1.1) * 0.22;
        gemme.scale.setScalar(1 + Math.sin(t * 1.6) * 0.12);
      },
      attack: function (p) {
        // « Charge de la forêt » : il baisse la ramure et charge.
        const k = arc(p);
        hull.position.z = k * 0.55;
        head.position.z = 0.52 + k * 0.55;
        head.rotation.x = -k * 0.50;
        gemme.scale.setScalar(1 + k * 0.9);
        tail.rotation.y = Math.sin(p * Math.PI * 4) * 0.4;
        if (p >= 1) { hull.position.z = 0; head.position.z = 0.52; head.rotation.x = 0; gemme.scale.setScalar(1); }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  FLORABELLE — FÉE-FLEUR.
  //  Ce qu'on doit lire : une petite souveraine qui flotte. Corolle de pétales
  //  en guise de robe, couronne de fleurs, ailes de fée translucides, cœur de
  //  pollen lumineux et anneau de graines en orbite.
  //  Attributs distinctifs : couronne + ailes + cœur lumineux + anneaux.
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('florabelle', function () {
    const PINK = '#ff6b9d', LPINK = '#ffaad8', GREEN = '#38b764';
    const oPink = SOFT, oLeaf = LIT(GREEN);
    const g = new THREE.Group();

    // --- BUSTE (fusionné : 2 draw calls) -------------------------------------
    const torso = new THREE.Group();
    torso.position.set(0, 1.16, 0);
    g.add(torso);
    const shell = new THREE.Group();
    torso.add(shell);
    shell.add(R3.ellipsoid(0.19, 0.32, 0.17, LPINK, 0, 0, 0, oPink));            // buste
    shell.add(R3.ellipsoid(0.21, 0.10, 0.19, GREEN, 0, -0.26, 0, oLeaf));        // calice à la taille
    [-1, 1].forEach(function (s) {
      const bras = R3.ellipsoid(0.055, 0.20, 0.055, LPINK, s * 0.20, 0.02, 0.03, oPink);
      bras.rotation.z = s * 0.32;
      shell.add(bras);
      shell.add(R3.ellipsoid(0.10, 0.055, 0.09, GREEN, s * 0.18, 0.26, -0.02, oLeaf));  // épaulettes de feuilles
    });
    BAKE(shell);

    // --- TÊTE (fusionnée : 1 draw call) --------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 0.44, 0.01);
    torso.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.ellipsoid(0.155, 0.165, 0.155, LPINK, 0, 0, 0, oPink));
    [[-0.12, -0.05, -0.10], [0.12, -0.05, -0.10]].forEach(function (q) {
      skull.add(R3.ellipsoid(0.06, 0.20, 0.06, LPINK, q[0], q[1], q[2], oPink));  // mèches
    });
    BAKE(skull);
    head.add(EYES(0.072, 0.02, 0.135, 0.038, { color: GREEN, dark: '#3a0e2a', angry: 0.05, tilt: 0.05 }));
    head.add(BAKE(R3.blush(0.125, -0.05, 0.115, 0.032)));   // fusionnées : 1 draw call
    // Couronne de fleurs (attribut n° 1).
    head.add(CROWN(PINK, 0.21, 7, { color2: GREEN, h: 0.16, gem: true, speed: 0.30, y: 0.19 }));

    // --- AILES DE FÉE (1 draw call chacune) ----------------------------------
    const wingL = WING(0.72, LPINK, { style: 'membrane', color2: LPINK, boneColor: LPINK, opacity: 0.55, arm: false, bake: true, side: -1, x: -0.17, y: 0.14, z: -0.08 });
    const wingR = WING(0.72, LPINK, { style: 'membrane', color2: LPINK, boneColor: LPINK, opacity: 0.55, arm: false, bake: true, side: 1, x: 0.17, y: 0.14, z: -0.08 });
    wingL.rotation.z = 0.55; wingR.rotation.z = -0.55;
    torso.add(wingL, wingR);

    // --- ROBE DE PÉTALES (fusionnée : 2 draw calls) --------------------------
    const skirt = PETALS(PINK, 9, 0.44, { color2: LPINK, drop: 0.62, flare: 0.45, y: -0.28 });
    torso.add(skirt);

    // --- CŒUR DE POLLEN + graines en orbite ---------------------------------
    const heart = CORE(PINK, 0.15, { shells: 1, y: 0.00, z: 0.14 });
    torso.add(heart);
    g.add(ORBIT(GREEN, 0.52, 7, { shape: 'star', size: 0.10, bake: true, tilt: 0.55, speed: 0.6, y: 1.18 }));

    g.add(AURA(PINK, 1.22, { color2: LPINK, rings: 1, particles: 0, shape: 'sphere', y0: 1.20 }));
    g.add(STARS(LPINK, 26, 1.30, { color2: GREEN, spread: 'ball', ry: 1.1, size: 0.06, seed: 88, y: 1.20 }));

    return finish(g, {
      aura: PINK,
      baseY: 0.20,
      anim: { head: head, wingL: wingL, wingR: wingR, tail: skirt, float: true },
      idle: function (t) {
        g.position.y = 0.20 + Math.sin(t * 1.0) * 0.065;
        torso.rotation.z = Math.sin(t * 0.55) * 0.05;
        head.rotation.y = Math.sin(t * 0.45) * 0.22;
        head.rotation.z = Math.sin(t * 0.75) * 0.06;
        // Les ailes de fée frémissent vite, mais de très peu : on garde le calme.
        wingL.rotation.z = 0.55 + Math.sin(t * 3.4) * 0.13;
        wingR.rotation.z = -0.55 - Math.sin(t * 3.4) * 0.13;
        skirt.rotation.y = t * 0.18;
        heart.scale.setScalar(1 + Math.sin(t * 1.8) * 0.14);
      },
      attack: function (p) {
        // « Tourbillon de pétales » : elle s'élève et la corolle explose.
        const k = arc(p);
        torso.position.y = 1.16 + k * 0.34;
        skirt.rotation.y = p * Math.PI * 3;
        skirt.scale.setScalar(1 + k * 0.75);
        wingL.rotation.z = 0.55 + Math.sin(p * Math.PI * 10) * 0.5;
        wingR.rotation.z = -0.55 - Math.sin(p * Math.PI * 10) * 0.5;
        heart.scale.setScalar(1 + k * 1.1);
        if (p >= 1) { torso.position.y = 1.16; skirt.scale.setScalar(1); heart.scale.setScalar(1); }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  RACINOR — COLOSSE DE RACINES TRESSÉES.
  //  Ce qu'on doit lire : une montagne de bois. Masse trapue et large, épaules
  //  hérissées de menhirs, deux bras-racines qui pendent jusqu'au sol, et une
  //  ceinture de runes anciennes qui tourne à sa taille.
  //  Attributs distinctifs : runes + cristaux + anneaux en orbite.
  //  Budget : 19 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('racinor', function () {
    const DBROWN = '#5c3a1e', MOSS = '#3d6b2f', WOOD = '#8b5a2b';
    const oBark = ROUGH, oMoss = LIT(MOSS), oWood = SOLID;
    const g = new THREE.Group();

    // --- TRONC + JAMBES (fusionnés : 3 draw calls) ---------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 0.58, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.60, 0.62, 0.56, DBROWN, 0, 0.62, 0, oBark));         // torse énorme
    hull.add(R3.ellipsoid(0.46, 0.30, 0.44, MOSS, 0, 1.02, -0.10, oMoss));       // mousse sur le dos
    hull.add(R3.ellipsoid(0.32, 0.22, 0.12, WOOD, 0, 0.50, 0.50, oWood));        // plaque d'écorce
    // Racines tressées qui courent sur le torse (fusion gratuite).
    [-1, 1].forEach(function (s) {
      const r1 = R3.cyl(0.05, 0.07, 0.70, WOOD, s * 0.30, 0.62, 0.40, oWood);
      r1.rotation.z = s * 0.30;
      hull.add(r1);
    });
    hull.add(leg(-0.29, 0, 0.06, 0.58, 0.27, 0.25, DBROWN, oBark, WOOD, oWood));
    hull.add(leg(0.29, 0, 0.06, 0.58, 0.27, 0.25, DBROWN, oBark, WOOD, oWood));
    // Menhirs plantés dans les épaules (attribut distinctif).
    hull.add(CRYSTAL(WOOD, 4, 0.26, { bake: true, base: false, glow: false, flat: true, spread: 0.8, x: -0.46, y: 1.00, z: 0 }));
    hull.add(CRYSTAL(WOOD, 4, 0.26, { bake: true, base: false, glow: false, flat: true, spread: 0.8, x: 0.46, y: 1.00, z: 0 }));
    BAKE(hull);

    // --- TÊTE (fusionnée : 2 draw calls) -------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0.24);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.ellipsoid(0.24, 0.22, 0.24, DBROWN, 0, 0, 0, oBark));
    skull.add(R3.ellipsoid(0.20, 0.09, 0.19, MOSS, 0, 0.17, -0.03, oMoss));      // sourcils de mousse
    [-1, 1].forEach(function (s) {
      const corne = R3.cone(0.05, 0.26, WOOD, s * 0.19, 0.20, -0.04, oWood);
      corne.rotation.z = -s * 0.5;
      skull.add(corne);
    });
    BAKE(skull);
    head.add(EYES(0.115, 0.01, 0.21, 0.052, { color: MOSS, dark: '#1a1108', angry: 0.60 }));

    // --- BRAS-RACINES (2 maillons chacun = 4 draw calls) ---------------------
    // Repère tourné : la traîne part vers -z, on la fait descendre vers -y.
    function rootArm(side) {
      const wrap = new THREE.Group();
      wrap.rotation.x = -Math.PI / 2;
      wrap.rotation.z = side * 0.14;
      wrap.position.set(side * 0.60, 1.42, 0.04);
      const arm = TAIL(1.10, WOOD, 2, { style: 'feather', color2: DBROWN, width: 0.36, droop: 0.05, amp: 0.12, speed: 1.0 });
      wrap.add(arm);
      return wrap;
    }
    const armL = rootArm(-1), armR = rootArm(1);
    g.add(armL, armR);

    // --- Runes anciennes à la taille + pierres en orbite ---------------------
    const runes = RUNES(MOSS, 0.78, 6, { color2: '#a7f070', size: 0.20, speed: -0.22, y: 0.95 });
    g.add(runes);
    g.add(ORBIT(WOOD, 0.95, 5, { shape: 'stone', size: 0.20, glow: false, bake: true, tilt: 0.28, speed: 0.30, y: 1.70 }));

    g.add(AURA(MOSS, 1.50, { color2: WOOD, rings: 1, particles: 0, shape: 'disc' }));
    g.add(STARS(MOSS, 18, 1.45, { color2: '#a7f070', spread: 'ball', ry: 0.9, size: 0.075, seed: 99, y: 1.10 }));

    return finish(g, {
      aura: MOSS,
      anim: { head: head, wingL: armL, wingR: armR, float: false },
      idle: function (t) {
        // Un colosse respire lentement et lourdement.
        hull.position.y = 0.58 + Math.sin(t * 0.7) * 0.026;
        hull.rotation.y = Math.sin(t * 0.28) * 0.05;
        head.position.y = 1.62 + Math.sin(t * 0.7 + 0.4) * 0.030;
        head.rotation.y = Math.sin(t * 0.3) * 0.16;
        armL.rotation.z = -0.14 + Math.sin(t * 0.6) * 0.09;
        armR.rotation.z = 0.14 - Math.sin(t * 0.6) * 0.09;
      },
      attack: function (p) {
        // « Étreinte des racines » : les deux bras se lèvent puis s'abattent.
        const k = arc(p);
        armL.rotation.x = -Math.PI / 2 + k * 1.15;
        armR.rotation.x = -Math.PI / 2 + k * 1.15;
        hull.rotation.x = -k * 0.18;
        hull.position.z = k * 0.28;
        head.rotation.x = -k * 0.22;
        if (p >= 1) {
          armL.rotation.x = -Math.PI / 2; armR.rotation.x = -Math.PI / 2;
          hull.rotation.x = 0; hull.position.z = 0; head.rotation.x = 0;
        }
      },
    });
  });

  // ===========================================================================
  // ===========================================================================
  //  FOUDRE — fulguron · voltaris · orageon      (régions : Sylve et Saphir)
  // ===========================================================================
  // ===========================================================================

  // ---------------------------------------------------------------------------
  //  FULGURON — OISEAU-TONNERRE.
  //  Ce qu'on doit lire : un rapace d'orage. Silhouette dressée, ailes en
  //  ZIGZAGS acérés (jamais des plumes rondes), couronne d'éclairs, traîne de
  //  rubans électriques et anneaux qui crépitent autour de lui.
  //  Attributs distinctifs : ailes + couronne + traîne + anneaux.
  //  Budget : 22 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('fulguron', function () {
    const YEL = '#f1c40f', LYEL = '#fcef8d', BLUE = '#3b5dc9';
    const oYel = SOFT, oBlue = LIT(BLUE), oSpark = HOT(LYEL);
    const g = new THREE.Group();

    // --- CORPS + PATTES (fusionnés : 3 draw calls) ---------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 0.88, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.31, 0.42, 0.40, YEL, 0, 0.42, 0, oYel));             // torse
    hull.add(R3.ellipsoid(0.24, 0.24, 0.26, LYEL, 0, 0.32, 0.20, oSpark));       // poitrail lumineux
    [[0.17, 0.62, -0.20], [-0.17, 0.62, -0.20], [0, 0.34, -0.28]].forEach(function (q) {
      hull.add(R3.ellipsoid(0.10, 0.16, 0.05, BLUE, q[0], q[1], q[2], oBlue));   // plumage sombre du dos
    });
    [-0.14, 0.14].forEach(function (x) {
      hull.add(leg(x, 0.02, 0.02, 0.60, 0.055, 0.045, BLUE, oBlue, BLUE, oBlue));
    });
    BAKE(hull);

    // --- TÊTE (fusionnée : 2 draw calls) -------------------------------------
    const head = new THREE.Group();
    head.position.set(0, 1.48, 0.02);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.cyl(0.10, 0.15, 0.32, YEL, 0, -0.10, 0.02, oYel));
    skull.add(R3.ellipsoid(0.16, 0.14, 0.21, YEL, 0, 0.13, 0.10, oYel));
    skull.add(R3.cone(0.045, 0.17, BLUE, 0, 0.10, 0.30, oBlue));                 // bec
    // Aigrettes en éclair de part et d'autre du crâne.
    [-1, 1].forEach(function (s) {
      const a = R3.ellipsoid(0.03, 0.15, 0.04, BLUE, s * 0.13, 0.28, -0.04, oBlue);
      a.rotation.z = -s * 0.55;
      skull.add(a);
    });
    BAKE(skull);
    head.add(EYES(0.098, 0.15, 0.24, 0.045, { color: LYEL, dark: '#101226', angry: 0.60 }));
    head.add(CROWN(LYEL, 0.22, 7, { h: 0.24, speed: 0.45, y: 0.34 }));           // couronne d'éclairs

    // --- AILES EN ZIGZAG (2 draw calls chacune) ------------------------------
    const wingL = WING(1.25, YEL, { style: 'bolt', color2: BLUE, segments: 6, arm: false, bake: true, side: -1, x: -0.26, y: 1.28, z: -0.06 });
    const wingR = WING(1.25, YEL, { style: 'bolt', color2: BLUE, segments: 6, arm: false, bake: true, side: 1, x: 0.26, y: 1.28, z: -0.06 });
    wingL.rotation.z = 0.40; wingR.rotation.z = -0.40;
    g.add(wingL, wingR);

    // --- TRAÎNE DE RUBANS ÉLECTRIQUES (3 lames = 3 draw calls) --------------
    const tailWrap = new THREE.Group();
    tailWrap.position.set(0, 1.14, -0.22);
    g.add(tailWrap);
    const tail = RIBBON(1.05, BLUE, { color2: LYEL, opacity: 0.7, segments: 3, width: 0.26, amp: 0.24, speed: 2.0 });
    tailWrap.add(tail);

    g.add(AURA(YEL, 1.32, { color2: BLUE, rings: 1, particles: 0, shape: 'sphere', y0: 1.10 }));
    g.add(ARCS(LYEL, 1.05, 2, { color2: BLUE, y0: 1.10 }));
    g.add(STARS(LYEL, 22, 1.40, { color2: YEL, spread: 'shell', ry: 1, size: 0.065, seed: 101, y: 1.15 }));

    return finish(g, {
      aura: YEL,
      anim: { head: head, wingL: wingL, wingR: wingR, tail: tail, float: false },
      idle: function (t) {
        hull.position.y = 0.88 + Math.sin(t * 1.2) * 0.030;
        head.rotation.y = Math.sin(t * 0.55) * 0.24;         // regard de rapace, sec et vif
        head.rotation.x = Math.sin(t * 1.0 + 0.5) * 0.05;
        wingL.rotation.z = 0.40 + Math.sin(t * 0.85) * 0.18;
        wingR.rotation.z = -0.40 - Math.sin(t * 0.85) * 0.18;
        tailWrap.rotation.x = Math.sin(t * 0.6) * 0.08;
      },
      attack: function (p) {
        // « Fulguration » : il se cabre, les ailes claquent en croix.
        const k = arc(p);
        hull.rotation.x = -k * 0.30;
        hull.position.y = 0.88 + k * 0.26;
        head.rotation.x = -k * 0.30;
        wingL.rotation.z = 0.40 + k * 1.05;
        wingR.rotation.z = -0.40 - k * 1.05;
        tailWrap.rotation.x = -k * 0.45;
        if (p >= 1) { hull.rotation.x = 0; hull.position.y = 0.88; head.rotation.x = 0; }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  VOLTARIS — FÉLIN D'ARC ÉLECTRIQUE.
  //  Ce qu'on doit lire : une panthère d'orage. Corps sombre et bas, rayures
  //  électriques, crinière d'arcs bleus autour du cou, éclats en orbite, et deux
  //  cornes-éclairs sur le crâne.
  //  Attributs distinctifs : crinière + anneaux en orbite + cristaux + éclairs.
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('voltaris', function () {
    const YEL = '#f1c40f', BLUE = '#41a6f6', DARK = '#1a1c2c';
    const oDark = SOFT, oYel = HOT(YEL), oBlue = HOT(BLUE);
    const g = new THREE.Group();

    // --- CORPS + 4 PATTES (fusionnés : 3 draw calls) -------------------------
    const hull = new THREE.Group();
    hull.position.set(0, 1.02, 0);
    g.add(hull);
    hull.add(R3.ellipsoid(0.40, 0.38, 0.70, DARK, 0, 0, -0.06, oDark));
    hull.add(R3.ellipsoid(0.32, 0.30, 0.28, DARK, 0, 0.06, 0.44, oDark));        // épaules
    // Rayures électriques : quatre traits qui courent sur les flancs.
    [[0.30, 0.14, 0.10], [-0.30, 0.14, 0.10], [0.28, 0.10, -0.24], [-0.28, 0.10, -0.24]].forEach(function (q) {
      const s = R3.ellipsoid(0.04, 0.05, 0.22, YEL, q[0], q[1], q[2], oYel);
      s.rotation.x = 0.3;
      hull.add(s);
    });
    [[-0.24, 0.32], [0.24, 0.32], [-0.22, -0.34], [0.22, -0.34]].forEach(function (q) {
      hull.add(leg(q[0], 0, q[1], 1.02, 0.11, 0.09, DARK, oDark, BLUE, oBlue));
    });
    // Cristaux de foudre sur l'échine.
    hull.add(CRYSTAL(BLUE, 5, 0.16, { bake: true, base: false, glow: false, spread: 0.7, x: 0, y: 0.34, z: -0.20 }));
    BAKE(hull);

    // --- TÊTE (fusionnée : 3 draw calls avec les cornes-éclairs) -------------
    const head = new THREE.Group();
    head.position.set(0, 1.26, 0.60);
    g.add(head);
    const skull = new THREE.Group();
    head.add(skull);
    skull.add(R3.ellipsoid(0.25, 0.23, 0.28, DARK, 0, 0, 0, oDark));
    skull.add(R3.ellipsoid(0.13, 0.10, 0.16, DARK, 0, -0.10, 0.24, oDark));      // museau
    [-1, 1].forEach(function (s) {
      const or = R3.cone(0.075, 0.16, DARK, s * 0.17, 0.22, -0.02, oDark);
      or.rotation.z = -s * 0.35;
      skull.add(or);                                                              // oreilles pointues
    });
    skull.add(R3.ellipsoid(0.09, 0.05, 0.10, BLUE, 0, -0.13, 0.30, oBlue));       // gueule lumineuse
    BAKE(skull);
    // Deux cornes-éclairs (fusionnées ensemble : 1 draw call).
    const cornes = new THREE.Group();
    head.add(cornes);
    [-1, 1].forEach(function (s) {
      const b = BOLT(0.42, YEL, { segments: 4, width: 0.07, zig: 0.06, bake: false });
      b.position.set(s * 0.13, 0.18, -0.02);
      b.rotation.z = -s * 0.30;
      cornes.add(b);
    });
    BAKE(cornes);
    head.add(EYES(0.135, 0.05, 0.25, 0.058, { color: BLUE, dark: '#05070f', angry: 0.90 }));
    // LA crinière d'arcs (attribut n° 1) : 2 draw calls.
    const crin = MANE(YEL, 0.44, 11, { color2: BLUE, sweep: 0.06, x: 0, y: 0.00, z: -0.20 });
    head.add(crin);

    // --- QUEUE (3 maillons = 3 draw calls) -----------------------------------
    const tail = TAIL(1.00, DARK, 3, { style: 'flame', color2: YEL, width: 0.22, droop: -0.10, y: 1.00, z: -0.72 });
    g.add(tail);

    g.add(AURA(YEL, 1.38, { color2: BLUE, rings: 1, particles: 0, shape: 'sphere', y0: 1.00 }));
    g.add(ORBIT(BLUE, 0.95, 6, { shape: 'shard', size: 0.20, bake: true, tilt: 0.32, speed: 0.85, y: 1.05 }));
    g.add(STARS(YEL, 20, 1.40, { color2: BLUE, spread: 'ball', ry: 0.85, size: 0.07, seed: 111, y: 1.05 }));

    return finish(g, {
      aura: YEL,
      anim: { head: head, tail: tail, float: false },
      idle: function (t) {
        hull.position.y = 1.02 + Math.sin(t * 1.3) * 0.020;
        head.position.y = 1.26 + Math.sin(t * 1.3 + 0.5) * 0.028;
        head.rotation.y = Math.sin(t * 0.5) * 0.20;
        head.rotation.x = Math.sin(t * 0.95) * 0.05;
        crin.rotation.z = Math.sin(t * 0.9) * 0.13;      // les arcs crépitent
        tail.rotation.y = Math.sin(t * 1.0) * 0.24;
      },
      attack: function (p) {
        // « Charge d'arc » : il se tapit, puis fonce toutes griffes dehors.
        const k = arc(p);
        hull.position.y = 1.02 - k * 0.12;
        hull.position.z = k * 0.68;
        hull.rotation.x = -k * 0.12;
        head.position.z = 0.60 + k * 0.68;
        head.position.y = 1.26 - k * 0.14;
        crin.scale.setScalar(1 + k * 0.4);
        tail.rotation.y = Math.sin(p * Math.PI * 8) * 0.5;
        if (p >= 1) {
          hull.position.set(0, 1.02, 0); hull.rotation.x = 0;
          head.position.set(0, 1.26, 0.60); crin.scale.setScalar(1);
        }
      },
    });
  });

  // ---------------------------------------------------------------------------
  //  ORAGEON — NUÉE ORAGEUSE À VISAGE.
  //  Ce qu'on doit lire : un nuage vivant. Masse cotonneuse qui flotte, deux
  //  éclairs plantés au sommet, une couronne de foudre, la pluie qui tombe
  //  dessous, et l'œil de l'orage qui brille au cœur du nuage.
  //  Attributs distinctifs : couronne + cœur lumineux + anneaux + traîne (pluie).
  //  Budget : 20 draw calls.
  // ---------------------------------------------------------------------------
  R3.registerCreature('orageon', function () {
    const SLATE = '#566c86', LSLATE = '#94b0c2', YEL = '#f1c40f';
    const oSlate = { rough: 0.95 }, oPuff = VEIL(LSLATE);
    const g = new THREE.Group();

    // --- LE NUAGE (fusionné : 2 draw calls) ----------------------------------
    const cloud = new THREE.Group();
    cloud.position.set(0, 1.52, 0);
    g.add(cloud);
    const mass = new THREE.Group();
    cloud.add(mass);
    mass.add(R3.ellipsoid(0.54, 0.36, 0.48, SLATE, 0, 0, 0, oSlate));
    // Volutes : sept bosses irrégulières qui cassent la sphère. Fusionnées, elles
    // ne coûtent rien, et sans elles ça ressemble à un galet gris.
    [[0.42, 0.10, 0.10, 0.30], [-0.40, 0.06, 0.16, 0.26], [0.20, 0.20, -0.30, 0.24],
     [-0.24, 0.18, -0.28, 0.22], [0.06, 0.26, 0.24, 0.22], [-0.44, -0.06, -0.10, 0.20],
     [0.44, -0.08, -0.18, 0.20]].forEach(function (q) {
      mass.add(R3.ellipsoid(q[3], q[3] * 0.72, q[3], LSLATE, q[0], q[1], q[2], oPuff));
    });
    BAKE(mass);

    // --- LE VISAGE -----------------------------------------------------------
    const face = new THREE.Group();
    face.position.set(0, -0.02, 0.42);
    cloud.add(face);
    face.add(EYES(0.155, 0.02, 0.06, 0.058, { color: YEL, dark: '#0e1420', angry: 0.55 }));

    // --- ÉCLAIRS AU SOMMET (fusionnés ensemble : 1 draw call) ---------------
    const eclairs = new THREE.Group();
    cloud.add(eclairs);
    [[-0.22, 0.22, -0.06, -0.25], [0.26, 0.20, 0.04, 0.32]].forEach(function (q) {
      const b = BOLT(0.46, YEL, { segments: 4, width: 0.09, zig: 0.09, bake: false });
      b.position.set(q[0], q[1], q[2]);
      b.rotation.z = q[3];
      eclairs.add(b);
    });
    BAKE(eclairs);

    // --- COURONNE DE FOUDRE (1 draw call) ------------------------------------
    cloud.add(CROWN(YEL, 0.36, 8, { h: 0.20, speed: 0.40, bob: 0.03, y: 0.42 }));

    // --- L'ŒIL DE L'ORAGE (cœur lumineux, 1 draw call) ----------------------
    const oeil = CORE(YEL, 0.20, { shells: 1, y: -0.06, z: 0.12 });
    cloud.add(oeil);

    // --- LA PLUIE (5 lames en onde = 5 draw calls) ---------------------------
    const rainWrap = new THREE.Group();
    rainWrap.rotation.x = -Math.PI / 2;
    rainWrap.position.set(0, -0.30, 0);
    cloud.add(rainWrap);
    const rain = RIBBON(0.95, LSLATE, { color2: YEL, opacity: 0.38, segments: 5, width: 0.50, taper: 0.35, amp: 0.10, speed: 2.4 });
    rainWrap.add(rain);

    g.add(AURA(SLATE, 1.35, { color2: YEL, rings: 1, particles: 0, shape: 'sphere', y0: 1.50 }));
    g.add(ARCS(YEL, 0.95, 2, { color2: LSLATE, y0: 1.50 }));
    g.add(STARS(YEL, 18, 1.35, { color2: LSLATE, spread: 'shell', ry: 0.8, size: 0.06, seed: 121, y: 1.50 }));

    return finish(g, {
      aura: SLATE,
      baseY: 0.22,
      anim: { head: face, tail: rain, float: true },
      idle: function (t) {
        // Le nuage dérive, enfle et se dégonfle : la respiration d'un orage.
        g.position.y = 0.22 + Math.sin(t * 0.7) * 0.085;
        cloud.rotation.y = Math.sin(t * 0.25) * 0.14;
        cloud.scale.set(1 + Math.sin(t * 0.9) * 0.030, 1 + Math.sin(t * 0.9 + 1.2) * 0.030, 1 + Math.sin(t * 0.9) * 0.030);
        face.position.y = -0.02 + Math.sin(t * 0.8 + 0.6) * 0.020;
        oeil.scale.setScalar(1 + Math.sin(t * 2.1) * 0.16);
      },
      attack: function (p) {
        // « Colère du ciel » : le nuage se gonfle, gronde, et lâche sa décharge.
        const k = arc(p);
        cloud.scale.setScalar(1 + k * 0.34);
        cloud.position.y = 1.52 + k * 0.24;
        face.position.z = 0.42 + k * 0.12;
        oeil.scale.setScalar(1 + k * 1.4);
        eclairs.scale.setScalar(1 + k * 0.7);
        rain.rotation.y = p * Math.PI * 2;
        if (p >= 1) {
          cloud.scale.setScalar(1); cloud.position.y = 1.52;
          face.position.z = 0.42; oeil.scale.setScalar(1); eclairs.scale.setScalar(1);
        }
      },
    });
  });

})();
