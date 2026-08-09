// =============================================================================
//  creatures3d.p7.js — LOT 7 DES MODÈLES 3D DE CRÉATURES
//  « L'aventure de Clélia » — version 3D
//  FORÊT, LAC, MER ET PLAGE (12 espèces)
//    chenipan · chrysacier · papilusion   (une lignée : même vert, mêmes yeux)
//    roucool · mystherbe · minidraco · psykokwak
//    lokhlass · tentacool · krabby · otaria · kokiyas
// =============================================================================
//  Conventions respectées par les douze modèles (CONTRACT.md, CONTRACT-V4 §3) :
//    * Group racine centré en (0,0,0), posé sur y = 0, regardant vers +z,
//      environ 1 unité de haut (Lokhlass ~1,35 ; Chenipan et Krabby ~0,6).
//    * Tout le corps vit dans un sous-groupe `inner` : les animations de joie
//      déplacent `inner` et JAMAIS la racine, que battle3d.js positionne dans
//      l'arène et que R3.idleCreature() met à l'échelle pour la respiration.
//    * userData.anim = { head, wingL, wingR, tail, float } — lu automatiquement
//      par R3.idleCreature().
//    * userData.attack = function (racine, p), p de 0 à 1 : petite animation
//      JOYEUSE. Aucune de ces créatures ne menace : les pinces de Krabby
//      applaudissent, la corne d'Otaria est un bisou pointu.
//    * Budget : 40 meshes maximum par créature.
//
//  Les assemblages viennent de creatures3d.lib.js (`R3.get('kclib')`). Chaque
//  appel passe par une enveloppe qui sait se replier sur les primitives R3.*
//  si la bibliothèque n'est pas chargée : ce fichier ne lève jamais
//  d'exception, ni au chargement, ni à la construction.
//
//  TROIS PIÈGES CONNUS, ÉVITÉS PARTOUT DANS CE FICHIER
//   1. R3.ellipsoid() range ses RAYONS dans mesh.scale : on n'appelle jamais
//      .scale.setScalar() sur un ellipsoïde. On anime un pivot (Group nu), une
//      position ou une rotation. Les seules mises à l'échelle portent sur des
//      Group ou sur des R3.sphere (dont le scale vaut bien (1,1,1)).
//   2. Rien n'appelle CL.tick() dans le jeu : les gestes autonomes sont
//      accrochés à onBeforeRender via `pilote()`, comme dans creatures3d.p3.js.
//   3. rotation.x POSITIVE bascule le sommet vers +z, c'est-à-dire vers
//      l'AVANT. Cous, queues, nageoires et coquilles ont été vérifiés DE PROFIL.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ===========================================================================
  //  ACCÈS À LA BIBLIOTHÈQUE PARTAGÉE
  //  Résolu à la CONSTRUCTION du modèle, pas au chargement du script : l'ordre
  //  des balises <script> n'a donc aucune importance.
  // ===========================================================================

  /** Renvoie le helper `name` de clib s'il existe, sinon null. */
  function CLIB(name) {
    const C = (typeof R3.get === 'function') ? R3.get('kclib') : null;
    return (C && typeof C[name] === 'function') ? C[name] : null;
  }

  /** Petit raccourci : place un objet et le renvoie. */
  function at(obj, o) {
    o = o || {};
    obj.position.set(o.x || 0, o.y || 0, o.z || 0);
    return obj;
  }

  /** Détail décoratif : ni ombre portée, ni ombre reçue. */
  function faint(m) { m.castShadow = false; m.receiveShadow = false; return m; }

  /** Racine + sous-groupe `inner` où tout est modélisé. */
  function shell() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  /** Courbe 0 -> 1 -> 0 : la base de toutes les animations de joie. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /**
   * Chaîne de Groups emboîtés — le squelette souple des cous et des serpents.
   * joints[0] est à l'origine, joints[i+1] est à segLen sur +y dans le repère
   * de joints[i]. Faire tourner joints[i] entraîne tout ce qui est au-dessus.
   */
  function chaine(n, segLen) {
    const root = new THREE.Group();
    const joints = [];
    let parent = root;
    for (let i = 0; i < n; i++) {
      const j = new THREE.Group();
      if (i > 0) j.position.y = segLen;
      parent.add(j);
      joints.push(j);
      parent = j;
    }
    return { root: root, joints: joints };
  }

  /** Joue les userData.animate() d'une liste de sous-groupes. */
  function play(parts, t) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const f = p && p.userData && p.userData.animate;
      if (typeof f === 'function') { try { f(t); } catch (e) { /* jamais bloquant */ } }
    }
  }

  /**
   * Accroche une animation par image au modèle `g` (gestes autonomes).
   * Le moteur vit désormais dans la bibliothèque (`CL.pilote`), pour que les
   * quatre lots partagent exactement le même — repli local identique si
   * creatures3d.lib.js manque, ce fichier doit rester autonome.
   */
  function pilote(g, fn) {
    const f = CLIB('pilote');
    if (f) return f(g, fn);
    // --- repli : la même mécanique, en local ---------------------------------
    let cible = null, secours = null;
    g.traverse(function (o) {
      if (!o.isMesh) return;
      if (!secours) secours = o;
      if (!cible && o.material && !o.material.transparent) cible = o;
    });
    cible = cible || secours;
    if (!cible) return null;
    cible.frustumCulled = false;          // sinon l'animation s'arrête hors champ
    let dernier = -1, ratés = 0;
    cible.onBeforeRender = function () {
      if (g.userData.busy) return;
      const t = (R3.clock && R3.clock.t) || 0;
      if (t === dernier) return;          // passe d'ombre + passe couleur
      dernier = t;
      try { fn(t); }
      catch (e) { if (++ratés >= 2) cible.onBeforeRender = function () {}; }
    };
    return cible;
  }

  /**
   * Marque le modèle « occupé » PENDANT l'animation de joie — et seulement
   * pendant. battle3d.js:2606 rappelle `attack(modele, 0)` en fin de geste pour
   * remettre la pose au repos : avec l'ancien `(p < 1)`, busy restait vrai pour
   * toujours et la créature ne bougeait plus de la partie (contrat v5 §13.1).
   */
  function busy(root, p) { root.userData.busy = (p > 0 && p < 1); }

  // ===========================================================================
  //  ENVELOPPES « clib si présente, sinon repli ». Les replis ne cherchent pas
  //  à être aussi beaux, seulement à rester lisibles, à respecter l'ANCRAGE
  //  documenté par clib, et à ne rien casser.
  // ===========================================================================

  /** Sourire en arc de perles. Ancrage : centré, face vers +z. */
  function smile(o) {
    const f = CLIB('mouthSmile');
    if (f) return f(o);
    o = o || {};
    const g = new THREE.Group();
    const w = o.w || 0.10, d = o.depth || 0.035, r = o.r || 0.020;
    const n = Math.max(3, o.count || 5);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1, k = 1 - u * u;
      g.add(faint(R3.sphere(r * (0.68 + 0.32 * k), o.color || '#1a1c2c',
        u * w, -k * d, -Math.abs(u) * r * 0.5, { rough: 0.85 })));
    }
    return at(g, o);
  }

  /** Grands yeux ronds à pupille sombre. Ancrage : centré entre les deux. */
  function bigEyes(o) {
    const f = CLIB('bigEyes');
    if (f) return f(o);
    o = o || {};
    const spread = o.spread || 0.12, r = o.r || 0.085;
    const pr = (o.pupilR !== undefined) ? o.pupilR : r * 0.52;
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(faint(R3.ellipsoid(r, r, r * 0.60, o.scleraColor || '#f8f8f8',
        s * spread, 0, 0, { rough: 0.55 })));
      g.add(faint(R3.ellipsoid(pr, pr, pr * 0.55, o.pupilColor || '#1a1c2c',
        s * spread, 0, r * 0.46, { rough: 0.5 })));
      g.add(faint(R3.sphere(pr * 0.34, '#ffffff',
        s * spread + pr * 0.42, pr * 0.42, r * 0.66, { rough: 0.25 })));
    });
    return at(g, o);
  }

  /** Corps dodu : coque, calotte du dos, ventre clair. Ancrage : centré. */
  function bodyBlob(o) {
    const f = CLIB('bodyBlob');
    if (f) return f(o);
    o = o || {};
    const rx = o.rx || 0.30, ry = o.ry || 0.28, rz = o.rz || 0.30;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(rx, ry, rz, o.color || '#ffffff', 0, 0, 0));
    if (o.shade) {
      g.add(R3.ellipsoid(rx * 0.94, ry * 0.84, rz * 0.86,
        (typeof o.shade === 'string') ? o.shade : '#000000', 0, ry * 0.20, -rz * 0.16));
    }
    if (o.belly) {
      g.add(faint(R3.ellipsoid(rx * 0.70, ry * 0.68, rz * 0.70,
        (typeof o.belly === 'string') ? o.belly : '#fff0c8',
        0, -ry * 0.16, rz * 0.38, { rough: 0.92 })));
    }
    return at(g, o);
  }

  /** Feuille arrondie, pivot à la base, pousse vers +y. */
  function leafBlade(o) {
    const f = CLIB('leafBlade');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.46, wid = o.wid || 0.34, th = o.thick || 0.10;
    const col = o.color || '#38b764';
    const g = new THREE.Group();
    g.add(R3.ellipsoid(wid * 0.5, len * 0.46, th * 0.5, col, 0, len * 0.48, 0));
    if (o.tip !== false) {
      g.add(faint(R3.cone(wid * 0.26, len * 0.22, col, 0, len * 0.94, 0, { seg: 9 })));
    }
    if (o.vein !== false) {
      g.add(faint(R3.box(wid * 0.055, len * 0.78, th * 0.62,
        o.veinColor || '#1e8449', 0, len * 0.50, th * 0.16)));
    }
    g.add(faint(R3.ellipsoid(wid * 0.14, len * 0.08, th * 0.42, col, 0, len * 0.05, 0)));
    g.rotation.z = o.tilt || 0;
    return at(g, o);
  }

  /** Nageoire caudale à deux lobes, pivot à l'attache, s'étend vers -z. */
  function finTail(o) {
    const f = CLIB('finTail');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.28, h = o.height || 0.30;
    const th = o.thick || Math.max(0.012, len * 0.06);
    const col = o.color || '#41a6f6';
    const g = new THREE.Group();
    g.add(R3.ellipsoid(th * 2.4, h * 0.26, len * 0.24, col, 0, 0, -len * 0.13));
    [1, -1].forEach(function (s) {
      const l = R3.ellipsoid(th, h * 0.52, len * 0.60, col, 0, s * h * 0.30, -len * 0.58,
        { side: THREE.DoubleSide });
      l.rotation.x = -s * (o.spread || 0.35);
      g.add(faint(l));
    });
    g.userData.animate = function (t) { g.rotation.y = Math.sin(t * 2.6) * 0.20; };
    return at(g, o);
  }

  /** Tentacule souple qui pend vers -y. Pivot à l'attache. */
  function tentacle(o) {
    const f = CLIB('tentacle');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.40, n = Math.max(1, o.count || 5), r = o.r || 0.045;
    const taper = (o.taper !== undefined) ? o.taper : 0.55;
    const wave = (o.wave !== undefined) ? o.wave : 0.16;
    const phase = o.phase || 0, speed = o.speed || 2.2;
    const segLen = len / n;
    const col = o.color || '#ffaad8';
    const g = new THREE.Group();
    const joints = [];
    let parent = g;
    for (let i = 0; i < n; i++) {
      const j = new THREE.Group();
      if (i > 0) j.position.y = -segLen;
      parent.add(j); joints.push(j); parent = j;
      const rr = Math.max(0.006, r * (1 - taper * (n === 1 ? 0 : i / (n - 1))));
      j.rotation.z = wave * Math.sin(i * 1.15 + phase);
      j.add(R3.ellipsoid(rr, segLen * 0.62, rr, col, 0, -segLen * 0.5, 0));
    }
    const rEnd = Math.max(0.006, r * (1 - taper));
    joints[n - 1].add(faint(R3.ellipsoid(rEnd * 1.05, rEnd * 1.05, rEnd * 1.05,
      o.tipColor || col, 0, -segLen, 0)));
    g.userData.joints = joints;
    g.userData.animate = function (t) {
      for (let i = 0; i < joints.length; i++) {
        joints[i].rotation.z = wave * Math.sin(i * 1.15 + phase + t * speed);
        joints[i].rotation.x = wave * 0.5 * Math.sin(i * 0.9 + phase * 1.7 + t * speed * 0.8);
      }
    };
    g.rotation.y = o.yaw || 0;
    return at(g, o);
  }

  /** Aile de papillon à deux lobes. Pivot au corps, se déploie vers +x. */
  function butterflyWing(o) {
    const f = CLIB('butterflyWing');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.34, h = o.height || 0.32, th = o.thick || 0.02;
    const g = new THREE.Group();
    const mo = { side: THREE.DoubleSide, rough: 0.62 };
    const up = R3.ellipsoid(len * 0.50, h * 0.42, th, o.color || '#ff6b9d',
      len * 0.48, h * 0.22, 0, mo);
    up.rotation.z = 0.14;
    g.add(faint(up));
    const lo = R3.ellipsoid(len * 0.37, h * 0.33, th, o.lowerColor || '#d896ff',
      len * 0.36, -h * 0.30, 0, mo);
    lo.rotation.z = -0.16;
    g.add(faint(lo));
    g.add(faint(R3.ellipsoid(len * 0.20, h * 0.16, th * 1.3, o.innerColor || '#ffaad8',
      len * 0.40, h * 0.22, th * 0.9, mo)));
    g.userData.upper = up;
    g.userData.lower = lo;
    if ((o.side || 1) < 0) g.rotation.y = Math.PI;
    return at(g, o);
  }

  /** Aile de plumes repliée le long du corps. Pivot à l'épaule. */
  function featherWing(o) {
    const f = CLIB('featherWing');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.34, wid = o.wid || 0.15;
    const col = o.color || '#f4f4f4';
    const g = new THREE.Group();
    const main = R3.ellipsoid(wid * 0.5, len * 0.42, len * 0.5, col,
      0, -len * 0.16, -len * 0.10);
    main.rotation.x = 0.12;
    g.add(main);
    const n = Math.max(1, o.layers || 3);
    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : i / (n - 1);
      const c = (o.tipColor && i === n - 1) ? o.tipColor : col;
      const p = R3.ellipsoid(wid * 0.32, len * (0.26 - u * 0.06), len * (0.34 - u * 0.05),
        c, wid * 0.06 * (1 - u), -len * (0.34 + u * 0.10), -len * (0.34 + u * 0.16));
      p.rotation.x = 0.24 + u * 0.16;
      g.add(faint(p));
    }
    g.userData.main = main;
    if ((o.side || 1) < 0) g.rotation.y = Math.PI;
    return at(g, o);
  }

  /** Bec conique pointant vers +z. Ancrage : centré. -> THREE.Mesh */
  function birdBeak(o) {
    const f = CLIB('birdBeak');
    if (f) return f(o);
    o = o || {};
    const m = R3.cone(o.r || 0.07, o.len || 0.16, o.color || '#f1c40f', 0, 0, 0,
      { seg: 10, rough: 0.68 });
    m.rotation.x = Math.PI / 2 + (o.tilt || 0);
    m.scale.set(o.wide || 1, 1, o.droop || 1);
    return at(m, o);
  }

  /** Antenne souple terminée par une boule. Pivot à la base, pousse vers +y. */
  function antenna(o) {
    const f = CLIB('antenna');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.24, bR = o.ballR || 0.045;
    const g = new THREE.Group();
    g.add(R3.cyl(len * 0.045, len * 0.075, len, o.color || '#5d275d', 0, len * 0.5, 0,
      { rough: 0.8, seg: 6 }));
    if (o.ball !== false) {
      const bc = o.ballColor || '#f1c40f';
      g.userData.ball = R3.sphere(bR, bc, 0, len + bR * 0.5, 0,
        (o.glow === false) ? { rough: 0.6 } : { emissive: bc, emissiveIntensity: 0.6, rough: 0.42 });
      g.add(g.userData.ball);
    }
    g.rotation.z = o.tilt || 0;
    return at(g, o);
  }

  /** Pince arrondie, pivot au poignet, pointe vers +z. */
  function claw(o) {
    const f = CLIB('claw');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.22, col = o.color || '#b13e53';
    const open = (o.open !== undefined) ? o.open : 0.30;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(len * 0.30, len * 0.36, len * 0.38, col, 0, 0, len * 0.26));
    g.add(faint(R3.ellipsoid(len * 0.18, len * 0.14, len * 0.22,
      o.innerColor || '#e74c3c', 0, 0, len * 0.44)));
    const up = new THREE.Group();
    up.position.set(0, len * 0.12, len * 0.48);
    up.rotation.x = -open;
    up.add(R3.ellipsoid(len * 0.17, len * 0.15, len * 0.34, col, 0, 0, len * 0.30));
    g.add(up);
    const lo = new THREE.Group();
    lo.position.set(0, -len * 0.12, len * 0.48);
    lo.rotation.x = open;
    lo.add(R3.ellipsoid(len * 0.16, len * 0.13, len * 0.30, col, 0, 0, len * 0.28));
    g.add(lo);
    g.userData.upper = up;
    g.userData.lower = lo;
    g.userData.animate = function (t) {
      const k = open * (0.55 + 0.45 * Math.sin(t * 3.4));
      up.rotation.x = -k; lo.rotation.x = k;
    };
    g.rotation.y = o.yaw || 0;
    return at(g, o);
  }

  /** Œil sur tige. Pivot à la base, pousse vers +y. */
  function eyeStalk(o) {
    const f = CLIB('eyeStalk');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.16, r = o.r || 0.05;
    const g = new THREE.Group();
    g.add(R3.cyl(r * 0.42, r * 0.52, len, o.stalkColor || '#b13e53', 0, len * 0.5, 0,
      { rough: 0.8, seg: 8 }));
    g.add(R3.sphere(r, o.eyeColor || '#f8f8f8', 0, len + r * 0.8, 0, { rough: 0.5 }));
    g.add(faint(R3.ellipsoid(r * 0.48, r * 0.48, r * 0.30, o.pupilColor || '#1a1c2c',
      0, len + r * 0.8, r * 0.80, { rough: 0.5 })));
    g.add(faint(R3.sphere(r * 0.20, '#ffffff', r * 0.28, len + r * 1.05, r * 0.80,
      { rough: 0.25 })));
    g.userData.animate = function (t) {
      g.rotation.z = (o.tilt || 0) + Math.sin(t * 2.1) * 0.10;
    };
    g.rotation.z = o.tilt || 0;
    return at(g, o);
  }

  /** Halo lumineux translucide. Ancrage : centré. */
  function glowAura(o) {
    const f = CLIB('glowAura');
    if (f) return f(o);
    o = o || {};
    const r = o.r || 0.45, col = o.color || '#fcef8d';
    const g = new THREE.Group();
    g.add(faint(R3.ellipsoid(r, r * (o.squash || 0.8), r, col, 0, 0, 0, {
      transparent: true, opacity: (o.opacity !== undefined) ? o.opacity : 0.20,
      rough: 0.2, emissive: col, emissiveIntensity: 0.8,
      depthWrite: false, side: THREE.BackSide, seg: 12,
    })));
    g.userData.animate = function (t) { g.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06); };
    return at(g, o);
  }

  // ===========================================================================
  //  LA LIGNÉE CHENIPAN → CHRYSACIER → PAPILUSION
  //  Trois modèles, un seul vert et les mêmes grands yeux : Clélia doit voir
  //  d'un coup d'œil que c'est la même petite bête qui grandit.
  // ===========================================================================
  const CH_VERT = '#8fce5e';        // le vert de la lignée
  const CH_VERT_FONCE = '#63a83f';
  const CH_CLAIR = '#e9f5b0';       // le ventre / les anneaux clairs

  // ===========================================================================
  //  CHENIPAN — « Une chenille verte toute ronde. »
  //  Petite (~0,65) : cinq anneaux qui ondulent, six petits pieds, une antenne
  //  rouge sur le front et d'énormes yeux.
  // ===========================================================================
  R3.registerCreature('chenipan', function () {
    const ANT = '#e0533f';
    const g = shell(), inner = g.userData.inner;

    // --- Le corps : quatre anneaux, chacun sur son pivot pour onduler --------
    const anneaux = [];
    const DEFS = [
      { r: 0.185, y: 0.190, z: 0.010 },
      { r: 0.175, y: 0.178, z: -0.200 },
      { r: 0.152, y: 0.162, z: -0.390 },
      { r: 0.122, y: 0.148, z: -0.545 },
    ];
    DEFS.forEach(function (d, i) {
      const piv = new THREE.Group();
      piv.position.set(0, d.y, d.z);
      piv.add(R3.ellipsoid(d.r, d.r * 0.94, d.r * 1.06,
        (i % 2 === 0) ? CH_VERT : CH_VERT_FONCE, 0, 0, 0, { rough: 0.85 }));
      inner.add(piv);
      anneaux.push(piv);
    });
    // Bout de queue jaune pâle
    inner.add(faint(R3.ellipsoid(0.075, 0.070, 0.070, CH_CLAIR, 0, 0.145, -0.650,
      { rough: 0.9 })));
    // Deux bandes claires sur le ventre
    [0.010, -0.200].forEach(function (z) {
      inner.add(faint(R3.ellipsoid(0.130, 0.070, 0.090, CH_CLAIR, 0, 0.080, z + 0.05,
        { rough: 0.92 })));
    });

    // --- Six petits pieds ----------------------------------------------------
    [0.02, -0.20, -0.40].forEach(function (z) {
      [-1, 1].forEach(function (s) {
        inner.add(faint(R3.ellipsoid(0.052, 0.048, 0.062, CH_VERT_FONCE,
          s * 0.140, 0.048, z, { rough: 0.9 })));
      });
    });

    // --- La tête -------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 0.248, 0.235);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.210, 0.200, 0.200, CH_VERT, 0, 0, 0, { rough: 0.82 }));
    tete.add(bigEyes({ spread: 0.108, r: 0.076, y: 0.030, z: 0.160 }));
    tete.add(R3.blush(0.168, -0.055, 0.150, 0.044));
    tete.add(smile({ w: 0.062, depth: 0.028, r: 0.017, y: -0.082, z: 0.180, count: 4 }));

    // Antenne rouge (le petit organe rigolo de Chenipan)
    const ant = antenna({
      len: 0.135, ballR: 0.048, color: CH_VERT_FONCE, ballColor: ANT,
      y: 0.180, z: -0.010,
    });
    tete.add(ant);

    g.userData.anim = { head: tete, float: false };

    pilote(g, function (t) {
      // La chenille ondule : chaque anneau monte et descend avec un décalage.
      for (let i = 0; i < anneaux.length; i++) {
        anneaux[i].position.y = DEFS[i].y + Math.sin(t * 3.0 - i * 0.9) * 0.022;
      }
      tete.position.y = 0.248 + Math.sin(t * 3.0 + 0.9) * 0.022;
      ant.rotation.x = Math.sin(t * 2.1) * 0.16;
    });

    g.userData.attack = function (root, p) {
      // « Charge douce » : elle se roule en boule et vient toucher le pied.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.34;
      inn.position.y = k * 0.10;
      for (let i = 0; i < anneaux.length; i++) {
        anneaux[i].position.y = DEFS[i].y + k * 0.05 * (i + 1) * 0.4;
        anneaux[i].position.z = DEFS[i].z + k * 0.055 * (i + 1);
      }
      tete.rotation.x = -k * 0.30;
      ant.rotation.x = Math.sin(pc * Math.PI * 4) * 0.35;
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        anneaux.forEach(function (a, i) { a.position.set(0, DEFS[i].y, DEFS[i].z); });
        tete.rotation.x = 0; ant.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  CHRYSACIER — « Une chrysalide verte et brillante. »
  //  La même bête, mais close : un cocon lisse qui se balance, avec les mêmes
  //  grands yeux à mi-hauteur.
  // ===========================================================================
  R3.registerCreature('chrysacier', function () {
    const g = shell(), inner = g.userData.inner;

    // --- Le cocon : pivot À LA BASE, il se balance sans décoller du sol ------
    const cocon = new THREE.Group();
    cocon.position.set(0, 0.020, 0);
    inner.add(cocon);

    cocon.add(R3.ellipsoid(0.245, 0.360, 0.235, CH_VERT, 0, 0.360, 0, { rough: 0.68 }));
    // Calotte plus foncée sur le dos
    cocon.add(faint(R3.ellipsoid(0.225, 0.250, 0.205, CH_VERT_FONCE,
      0, 0.470, -0.040, { rough: 0.7 })));
    // Sommet arrondi (jamais une pointe : c'est doux, ça ne pique pas)
    cocon.add(R3.ellipsoid(0.125, 0.165, 0.120, CH_VERT, 0, 0.700, 0, { rough: 0.68 }));
    // Socle
    cocon.add(faint(R3.ellipsoid(0.185, 0.075, 0.180, CH_VERT_FONCE, 0, 0.030, 0,
      { rough: 0.88 })));

    // Deux anneaux de coque : la « segmentation » de la chrysalide
    [{ y: 0.330, r: 0.246 }, { y: 0.150, r: 0.218 }].forEach(function (d) {
      const t = R3.torus(d.r, 0.026, CH_VERT_FONCE, 0, d.y, 0, { rough: 0.6, seg: 16 });
      t.rotation.x = Math.PI / 2;
      cocon.add(faint(t));
    });

    // --- Le visage -----------------------------------------------------------
    cocon.add(bigEyes({ spread: 0.100, r: 0.072, y: 0.420, z: 0.200 }));
    cocon.add(R3.blush(0.150, 0.330, 0.185, 0.042));
    cocon.add(smile({ w: 0.052, depth: 0.024, r: 0.016, y: 0.300, z: 0.212, count: 4 }));

    g.userData.anim = { head: cocon, float: false };

    pilote(g, function (t) {
      // Elle ne bouge presque pas : elle se prépare. Juste un balancement.
      cocon.rotation.x = Math.sin(t * 1.1) * 0.045;
    });

    g.userData.attack = function (root, p) {
      // « Coque dure » : elle se raidit, brille, et vient bousculer — pouf !
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.26;
      inn.position.y = k * 0.12;
      cocon.rotation.x = k * 0.34;
      // On met à l'échelle un GROUP, jamais un ellipsoïde.
      cocon.scale.set(1 + k * 0.10, 1 - k * 0.08, 1 + k * 0.10);
      cocon.rotation.y = Math.sin(pc * Math.PI * 2) * 0.25;
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        cocon.rotation.set(0, 0, 0);
        cocon.scale.set(1, 1, 1);
      }
    };
    return g;
  });

  // ===========================================================================
  //  PAPILUSION — « Le papillon aux grandes ailes blanches. »
  //  Corps violet de la lignée éclose, grands yeux rouges tout ronds, quatre
  //  ailes blanches. Il flotte : il ne se pose jamais vraiment.
  // ===========================================================================
  R3.registerCreature('papilusion', function () {
    const VIOLET = '#c48ce8', VIOLET_FONCE = '#9b6cc0';
    const AILE = '#f7f7fb', AILE_BORD = '#dff0ff';
    const OEIL = '#e74c3c', FOURRURE = '#f7f7fb';
    const g = shell(), inner = g.userData.inner;

    const corps = new THREE.Group();
    corps.position.set(0, 0.560, 0);
    inner.add(corps);

    // --- Abdomen, thorax, collerette blanche ---------------------------------
    corps.add(R3.ellipsoid(0.135, 0.145, 0.200, VIOLET, 0, -0.105, -0.140, { rough: 0.85 }));
    corps.add(R3.ellipsoid(0.170, 0.170, 0.170, VIOLET, 0, 0.020, 0.020, { rough: 0.85 }));
    corps.add(faint(R3.ellipsoid(0.150, 0.105, 0.130, FOURRURE, 0, -0.050, 0.085,
      { rough: 0.95 })));

    // --- La tête et les yeux rouges (la signature de Papilusion) -------------
    const tete = new THREE.Group();
    tete.position.set(0, 0.205, 0.055);
    corps.add(tete);
    tete.add(R3.ellipsoid(0.155, 0.145, 0.145, VIOLET, 0, 0, 0, { rough: 0.82 }));
    tete.add(bigEyes({
      spread: 0.108, r: 0.086, pupilR: 0.042, y: 0.005, z: 0.105,
      scleraColor: OEIL, pupilColor: '#5d2233',
    }));
    tete.add(smile({ w: 0.048, depth: 0.022, r: 0.014, y: -0.105, z: 0.130, count: 4 }));
    tete.add(R3.blush(0.170, -0.075, 0.075, 0.036));

    // Deux antennes qui se balancent
    const antennes = [];
    [-1, 1].forEach(function (s) {
      const a = antenna({
        len: 0.185, ballR: 0.040, color: VIOLET_FONCE, ballColor: VIOLET_FONCE,
        glow: false, x: s * 0.070, y: 0.115, z: -0.010, tilt: -s * 0.42,
      });
      tete.add(a);
      antennes.push(a);
    });

    // --- Les quatre ailes ----------------------------------------------------
    const ailes = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.130, 0.075, -0.010);
      piv.add(butterflyWing({
        len: 0.520, height: 0.440, thick: 0.022, side: s,
        color: AILE, lowerColor: AILE, innerColor: AILE_BORD, dotColor: VIOLET_FONCE,
      }));
      // Petite aile arrière, plus discrète
      const bas = R3.ellipsoid(0.185, 0.115, 0.020, AILE_BORD,
        s * 0.230, -0.145, -0.075, { side: THREE.DoubleSide, rough: 0.65 });
      bas.rotation.z = -s * 0.30;
      piv.add(faint(bas));
      corps.add(piv);
      ailes.push(piv);
    });

    // --- Deux petites mains --------------------------------------------------
    [-1, 1].forEach(function (s) {
      corps.add(faint(R3.ellipsoid(0.048, 0.062, 0.050, VIOLET_FONCE,
        s * 0.085, -0.130, 0.105, { rough: 0.9 })));
    });

    g.userData.anim = { head: tete, wingL: ailes[0], wingR: ailes[1], float: true };
    g.userData.baseY = 0.020;

    pilote(g, function (t) {
      for (let i = 0; i < antennes.length; i++) {
        antennes[i].rotation.x = Math.sin(t * 2.0 + i) * 0.14;
      }
      corps.rotation.x = Math.sin(t * 1.6) * 0.05;
    });

    g.userData.attack = function (root, p) {
      // « Tornade » : il monte, bat des ailes à toute vitesse et tournoie.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.26;
      inn.position.z = k * 0.30;
      inn.rotation.y = pc * Math.PI * 2;
      const f = Math.sin(pc * Math.PI * 14) * 0.85;
      ailes[0].rotation.z = f;
      ailes[1].rotation.z = -f;
      corps.rotation.x = -k * 0.24;
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.y = 0;
        ailes[0].rotation.z = 0; ailes[1].rotation.z = 0;
        corps.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  ROUCOOL — « Un petit oiseau brun très sage. »
  //  Corps rond brun, ventre crème, petite huppe, bec doux, ailes repliées.
  // ===========================================================================
  R3.registerCreature('roucool', function () {
    const BRUN = '#c08a5e', BRUN_FONCE = '#996a44', CREME = '#f5e3c0';
    const BEC = '#e8a25c', HUPPE = '#f0d0b0';
    const g = shell(), inner = g.userData.inner;

    const corps = new THREE.Group();
    corps.position.set(0, 0.340, 0);
    inner.add(corps);
    corps.add(bodyBlob({
      rx: 0.280, ry: 0.270, rz: 0.255, color: BRUN, shade: BRUN_FONCE, belly: CREME,
      rough: 0.86,
    }));

    // --- Les pattes ----------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(faint(R3.cyl(0.026, 0.030, 0.100, BEC, s * 0.105, 0.052, 0.055,
        { rough: 0.85, seg: 7 })));
    });

    // --- La tête -------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 0.305, 0.030);
    corps.add(tete);
    tete.add(R3.ellipsoid(0.215, 0.205, 0.205, BRUN, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.150, 0.130, 0.105, CREME, 0, -0.030, 0.150,
      { rough: 0.92 })));
    tete.add(birdBeak({ len: 0.150, r: 0.062, color: BEC, wide: 1.15, droop: 0.72,
      y: -0.030, z: 0.245 }));
    tete.add(bigEyes({ spread: 0.118, r: 0.072, y: 0.060, z: 0.170 }));
    tete.add(R3.blush(0.180, -0.045, 0.140, 0.040));

    // Huppe : trois plumes crème sur le crâne
    const huppe = new THREE.Group();
    huppe.position.set(0, 0.165, 0.010);
    tete.add(huppe);
    [{ x: 0, z: 0.03, r: 0.062, h: 0.095 },
     { x: -0.085, z: -0.015, r: 0.050, h: 0.072 },
     { x: 0.085, z: -0.015, r: 0.050, h: 0.072 }].forEach(function (d) {
      const pl = R3.ellipsoid(d.r, d.h, d.r * 0.8, HUPPE, d.x, d.h * 0.7, d.z,
        { rough: 0.9 });
      pl.rotation.z = -d.x * 2.4;
      huppe.add(faint(pl));
    });

    // --- Les ailes repliées --------------------------------------------------
    const ailes = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.255, 0.060, -0.010);
      piv.add(featherWing({
        len: 0.330, wid: 0.140, layers: 2, side: s,
        color: BRUN, tipColor: BRUN_FONCE,
      }));
      corps.add(piv);
      ailes.push(piv);
    });

    // --- La queue en éventail ------------------------------------------------
    const queue = new THREE.Group();
    queue.position.set(0, -0.030, -0.235);
    corps.add(queue);
    [-1, 0, 1].forEach(function (s) {
      const pl = R3.ellipsoid(0.055, 0.030, 0.170, (s === 0) ? BRUN : BRUN_FONCE,
        s * 0.075, s * 0.010, -0.150, { rough: 0.88 });
      pl.rotation.y = -s * 0.30;
      queue.add(faint(pl));
    });

    g.userData.anim = { head: tete, wingL: ailes[0], wingR: ailes[1], tail: queue };

    pilote(g, function (t) {
      // Il regarde autour de lui, tranquillement, et sa huppe frissonne.
      tete.rotation.y = Math.sin(t * 0.9) * 0.28;
      huppe.rotation.x = Math.sin(t * 2.4) * 0.10;
    });

    g.userData.attack = function (root, p) {
      // « Cru-Aile » : il décolle d'un coup d'ailes tout content.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.30;
      inn.position.z = k * 0.34;
      inn.rotation.x = -k * 0.20;
      const f = Math.sin(pc * Math.PI * 8) * 0.95;
      ailes[0].rotation.z = f;
      ailes[1].rotation.z = -f;
      queue.rotation.x = -k * 0.35;
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        ailes[0].rotation.z = 0; ailes[1].rotation.z = 0;
        queue.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  MYSTHERBE — « Une petite plante bleue à pattes. »
  //  Bulbe bleu tout rond, quatre grandes feuilles vertes sur la tête,
  //  deux petits pieds et un sourire immense.
  // ===========================================================================
  R3.registerCreature('mystherbe', function () {
    const BLEU = '#5aa8ff', BLEU_FONCE = '#3f86d8';
    const VERT = '#4fae4a', VERT_CLAIR = '#6dc95a';
    const g = shell(), inner = g.userData.inner;

    // --- Le bulbe : pivot au centre du corps ---------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.300, 0);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.300, 0.285, 0.290, BLEU, 0, 0, 0, { rough: 0.84 }));
    corps.add(faint(R3.ellipsoid(0.262, 0.150, 0.250, BLEU_FONCE, 0, -0.140, 0,
      { rough: 0.9 })));

    // --- Les deux petits pieds -----------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(faint(R3.ellipsoid(0.090, 0.055, 0.115, BLEU_FONCE,
        s * 0.135, 0.048, 0.060, { rough: 0.9 })));
    });

    // --- Les quatre feuilles -------------------------------------------------
    const feuilles = new THREE.Group();
    feuilles.position.set(0, 0.255, 0);
    corps.add(feuilles);
    const brins = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const piv = new THREE.Group();
      piv.rotation.y = -a;
      piv.add(leafBlade({
        len: 0.360, wid: 0.205, thick: 0.085,
        color: (i % 2 === 0) ? VERT : VERT_CLAIR, vein: false, tilt: 0.52,
      }));
      feuilles.add(piv);
      brins.push(piv);
    }

    // --- Le visage -----------------------------------------------------------
    corps.add(bigEyes({ spread: 0.126, r: 0.086, y: 0.035, z: 0.240 }));
    corps.add(R3.blush(0.212, -0.075, 0.210, 0.050));
    corps.add(smile({ w: 0.086, depth: 0.040, r: 0.020, y: -0.125, z: 0.235, count: 5 }));

    g.userData.anim = { head: corps, float: false };

    pilote(g, function (t) {
      // Les feuilles ondulent comme au vent, et la plante se dandine.
      for (let i = 0; i < brins.length; i++) {
        brins[i].rotation.x = Math.sin(t * 1.8 + i * 1.3) * 0.11;
      }
      corps.rotation.x = Math.sin(t * 1.5) * 0.05;
    });

    g.userData.attack = function (root, p) {
      // « Tranch'Herbe » : elle tourne sur elle-même et lance ses feuilles.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.16;
      inn.position.z = k * 0.28;
      feuilles.rotation.y = pc * Math.PI * 4;
      for (let i = 0; i < brins.length; i++) {
        brins[i].rotation.x = -k * 0.45;
      }
      corps.rotation.x = -k * 0.18;
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        feuilles.rotation.y = 0;
        brins.forEach(function (b) { b.rotation.x = 0; });
        corps.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  MINIDRACO — « Un tout petit dragon bleu, rare et timide. »
  //  Un serpent lové au sol dont le corps s'élève en S, une perle dorée sur le
  //  front et deux nageoires blanches en guise d'oreilles.
  // ===========================================================================
  R3.registerCreature('minidraco', function () {
    const BLEU = '#8fd3f4', BLEU_FONCE = '#5fb0e0';
    const BLANC = '#f6fbff', ORB = '#f2e2a8';
    const g = shell(), inner = g.userData.inner;

    // --- La boucle posée au sol ----------------------------------------------
    const boucle = new THREE.Group();
    boucle.position.set(0, 0.100, -0.030);
    inner.add(boucle);
    const anneau = R3.torus(0.235, 0.098, BLEU, 0, 0, 0, { rough: 0.7, seg: 18 });
    anneau.rotation.x = Math.PI / 2;
    boucle.add(anneau);
    boucle.add(faint(R3.ellipsoid(0.080, 0.075, 0.115, BLEU_FONCE, 0.215, 0.010, -0.150,
      { rough: 0.75 })));

    // --- Le corps qui s'élève en S -------------------------------------------
    const SEG = 0.185;
    const c = chaine(4, SEG);
    c.root.position.set(0, 0.150, 0.020);
    inner.add(c.root);
    const REPOS = [0.30, -0.10, -0.18, -0.05];   // rotation.x de repos (S doux)
    for (let i = 0; i < 4; i++) {
      const rr = 0.135 - i * 0.010;
      c.joints[i].rotation.x = REPOS[i];
      c.joints[i].add(R3.ellipsoid(rr, SEG * 0.62, rr, BLEU, 0, SEG * 0.5, 0,
        { rough: 0.72 }));
    }

    // --- La tête, au sommet de la chaîne -------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, SEG * 0.92, 0);
    tete.rotation.x = 0.03;                  // elle regarde droit devant
    c.joints[3].add(tete);
    tete.add(R3.ellipsoid(0.148, 0.135, 0.165, BLEU, 0, 0, 0.015, { rough: 0.7 }));
    tete.add(faint(R3.ellipsoid(0.092, 0.070, 0.070, BLANC, 0, -0.052, 0.135,
      { rough: 0.85 })));
    // Perle dorée sur le front
    const perle = R3.sphere(0.052, ORB, 0, 0.098, 0.108,
      { emissive: ORB, emissiveIntensity: 0.55, rough: 0.35 });
    tete.add(faint(perle));
    // Nageoires-oreilles
    [-1, 1].forEach(function (s) {
      const n = R3.ellipsoid(0.032, 0.105, 0.058, BLANC, s * 0.135, 0.030, -0.020,
        { rough: 0.8 });
      n.rotation.z = -s * 0.55;
      tete.add(faint(n));
    });
    tete.add(bigEyes({ spread: 0.088, r: 0.060, y: 0.020, z: 0.140 }));
    tete.add(smile({ w: 0.042, depth: 0.018, r: 0.013, y: -0.078, z: 0.150, count: 3 }));
    tete.add(R3.blush(0.128, -0.040, 0.120, 0.034));

    g.userData.anim = { head: tete, tail: boucle, float: false };

    pilote(g, function (t) {
      // Le corps ondule comme sous l'eau ; la perle respire.
      for (let i = 0; i < 4; i++) {
        c.joints[i].rotation.x = REPOS[i] + Math.sin(t * 1.5 - i * 0.6) * 0.055;
        c.joints[i].rotation.y = Math.sin(t * 1.1 + i * 0.8) * 0.045;
      }
      perle.scale.setScalar(1 + Math.sin(t * 2.6) * 0.10);   // R3.sphere : scale = 1
    });

    g.userData.attack = function (root, p) {
      // « Draco-Souffle » : il se dresse et souffle un air scintillant.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.22;
      for (let i = 0; i < 4; i++) {
        c.joints[i].rotation.x = REPOS[i] + k * 0.22 * (i === 3 ? 1.6 : 0.5);
        c.joints[i].rotation.y = Math.sin(pc * Math.PI * 3 + i) * 0.14 * k;
      }
      tete.rotation.x = 0.03 - k * 0.25;
      perle.scale.setScalar(1 + k * 0.65);
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        for (let i = 0; i < 4; i++) { c.joints[i].rotation.set(REPOS[i], 0, 0); }
        tete.rotation.x = 0.03;
        perle.scale.setScalar(1);
      }
    };
    return g;
  });

  // ===========================================================================
  //  PSYKOKWAK — « Un canard jaune qui a toujours un peu mal à la tête. »
  //  Les deux mains sur les tempes, le bec plat, le regard dans le vide et
  //  trois cheveux : impossible de le confondre.
  // ===========================================================================
  R3.registerCreature('psykokwak', function () {
    const JAUNE = '#f7d94c', VENTRE = '#fdf0b8', BEC = '#e8a33d', CHEVEU = '#3a3a4a';
    const g = shell(), inner = g.userData.inner;

    // --- Le corps ------------------------------------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.345, 0);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.250, 0.300, 0.230, JAUNE, 0, 0, 0, { rough: 0.86 }));
    corps.add(faint(R3.ellipsoid(0.180, 0.200, 0.140, VENTRE, 0, -0.045, 0.135,
      { rough: 0.92 })));
    corps.add(faint(R3.ellipsoid(0.080, 0.062, 0.100, JAUNE, 0, -0.150, -0.215,
      { rough: 0.88 })));

    // --- Les palmes ----------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(faint(R3.ellipsoid(0.100, 0.048, 0.135, BEC, s * 0.120, 0.046, 0.095,
        { rough: 0.88 })));
    });

    // --- La tête -------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 0.742, 0.010);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.255, 0.235, 0.235, JAUNE, 0, 0, 0, { rough: 0.84 }));
    // Le bec plat, en deux valves
    tete.add(R3.ellipsoid(0.135, 0.045, 0.130, BEC, 0, -0.020, 0.195, { rough: 0.75 }));
    tete.add(faint(R3.ellipsoid(0.110, 0.034, 0.108, BEC, 0, -0.078, 0.175,
      { rough: 0.8 })));
    // Le regard vide de Psykokwak : grande sclère, minuscule pupille
    tete.add(bigEyes({ spread: 0.118, r: 0.084, pupilR: 0.028, y: 0.058, z: 0.190 }));
    tete.add(R3.blush(0.198, -0.030, 0.150, 0.044));
    // Les trois cheveux
    const cheveux = new THREE.Group();
    cheveux.position.set(0, 0.215, -0.015);
    tete.add(cheveux);
    [-1, 0, 1].forEach(function (s) {
      const ch = R3.ellipsoid(0.011, 0.058, 0.011, CHEVEU, s * 0.042, 0.052, 0,
        { rough: 0.7 });
      ch.rotation.z = -s * 0.30;
      cheveux.add(faint(ch));
    });

    // --- Les deux bras, mains sur les tempes ---------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.290, 0.520, 0.015);
      piv.rotation.z = -s * 0.16;
      piv.add(R3.ellipsoid(0.058, 0.130, 0.062, JAUNE, 0, 0.115, 0, { rough: 0.88 }));
      piv.add(R3.ellipsoid(0.080, 0.075, 0.075, JAUNE, 0, 0.245, 0.010, { rough: 0.88 }));
      inner.add(piv);
      bras.push(piv);
    });

    // --- L'aura psy, cachée au repos -----------------------------------------
    const aura = glowAura({ r: 0.400, color: '#f8a8e0', opacity: 0.22, squash: 0.92 });
    aura.position.set(0, 0.742, 0.010);
    aura.visible = false;
    inner.add(aura);

    g.userData.anim = { head: tete, wingL: bras[0], wingR: bras[1], float: false };

    pilote(g, function (t) {
      // Il se masse les tempes, tout doucement, en soupirant.
      const k = Math.sin(t * 1.4);
      bras[0].rotation.z = -0.16 + k * 0.055;
      bras[1].rotation.z = 0.16 - k * 0.055;
      tete.rotation.x = Math.sin(t * 1.1) * 0.05;
      cheveux.rotation.z = Math.sin(t * 2.2) * 0.12;
    });

    g.userData.attack = function (root, p) {
      // « Choc Mental » : il se tient la tête... et tout se met à flotter !
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.14;
      inn.position.z = k * 0.20;
      tete.rotation.x = -k * 0.16;
      bras[0].rotation.z = -0.16 - k * 0.22;
      bras[1].rotation.z = 0.16 + k * 0.22;
      cheveux.rotation.z = Math.sin(pc * Math.PI * 8) * 0.35;
      aura.visible = pc > 0.10 && pc < 0.95;
      aura.scale.setScalar(0.6 + k * 0.9);           // Group : mise à l'échelle sûre
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        tete.rotation.x = 0;
        bras[0].rotation.z = -0.16; bras[1].rotation.z = 0.16;
        cheveux.rotation.z = 0;
        aura.visible = false; aura.scale.setScalar(1);
      }
    };
    return g;
  });

  // ===========================================================================
  //  LOKHLASS — « Un grand dinosaure marin tout doux. »
  //  LE modèle soigné du lot : corps massif, coquille à bosses, long cou qui
  //  se balance, tête aux immenses yeux calmes, quatre nageoires. ~1,35 unité.
  // ===========================================================================
  R3.registerCreature('lokhlass', function () {
    const CORPS = '#86d5ee', CORPS_OMBRE = '#66b8d8';
    const VENTRE = '#fdf3d6', COQUILLE = '#9d8fb0', BOSSE = '#f0e6cd';
    const g = shell(), inner = g.userData.inner;

    // --- Le corps ------------------------------------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.350, 0);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.440, 0.300, 0.560, CORPS, 0, 0, 0, { rough: 0.78 }));
    corps.add(faint(R3.ellipsoid(0.340, 0.200, 0.430, VENTRE, 0, -0.125, 0.060,
      { rough: 0.9 })));

    // --- La coquille du dos et ses bosses -------------------------------------
    const coque = new THREE.Group();
    coque.position.set(0, 0.170, -0.080);
    corps.add(coque);
    coque.add(R3.ellipsoid(0.395, 0.275, 0.460, COQUILLE, 0, 0, 0, { rough: 0.86 }));
    [{ x: 0, y: 0.245, z: 0.020, r: 0.098 },
     { x: -0.215, y: 0.165, z: -0.135, r: 0.082 },
     { x: 0.215, y: 0.165, z: -0.135, r: 0.082 },
     { x: -0.170, y: 0.180, z: 0.200, r: 0.076 },
     { x: 0.170, y: 0.180, z: 0.200, r: 0.076 }].forEach(function (d) {
      coque.add(faint(R3.ellipsoid(d.r, d.r * 0.80, d.r, BOSSE, d.x, d.y, d.z,
        { rough: 0.88 })));
    });

    // --- Les quatre nageoires -------------------------------------------------
    const nageoires = [];
    [{ x: 0.400, z: 0.230, r: 0.30 }, { x: -0.400, z: 0.230, r: -0.30 },
     { x: 0.365, z: -0.255, r: 0.26 }, { x: -0.365, z: -0.255, r: -0.26 }]
      .forEach(function (d) {
        const piv = new THREE.Group();
        piv.position.set(d.x, 0.130, d.z);
        const n = R3.ellipsoid(0.145, 0.070, 0.195, CORPS_OMBRE, d.x * 0.22, -0.055, 0,
          { rough: 0.82 });
        n.rotation.z = d.r;
        piv.add(n);
        inner.add(piv);
        nageoires.push(piv);
      });

    // --- La petite queue ------------------------------------------------------
    const queue = new THREE.Group();
    queue.position.set(0, 0.230, -0.520);
    inner.add(queue);
    queue.add(faint(R3.ellipsoid(0.105, 0.090, 0.150, CORPS, 0, 0, -0.090,
      { rough: 0.82 })));

    // --- Le long cou ----------------------------------------------------------
    const SEG = 0.158;
    const c = chaine(4, SEG);
    c.root.position.set(0, 0.575, 0.290);
    inner.add(c.root);
    // rotation.x POSITIVE penche vers l'AVANT (+z) : le cou monte en s'avançant.
    const REPOS = [0.10, 0.20, 0.15, 0.10];
    for (let i = 0; i < 4; i++) {
      const rr = 0.118 - i * 0.009;
      c.joints[i].rotation.x = REPOS[i];
      c.joints[i].add(R3.ellipsoid(rr, SEG * 0.66, rr, CORPS, 0, SEG * 0.5, 0,
        { rough: 0.78 }));
    }

    // --- La tête --------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, SEG * 0.95, 0);
    tete.rotation.x = -0.55;                  // elle redresse le regard à l'horizontale
    c.joints[3].add(tete);
    tete.add(R3.ellipsoid(0.185, 0.165, 0.200, CORPS, 0, 0.010, 0.020, { rough: 0.76 }));
    tete.add(faint(R3.ellipsoid(0.115, 0.082, 0.095, VENTRE, 0, -0.062, 0.155,
      { rough: 0.9 })));
    // Petite corne arrondie sur le front (un bourgeon, pas une pointe)
    tete.add(faint(R3.ellipsoid(0.046, 0.058, 0.046, BOSSE, 0, 0.155, 0.080,
      { rough: 0.85 })));
    // Les oreilles-nageoires
    [-1, 1].forEach(function (s) {
      const o = R3.ellipsoid(0.042, 0.105, 0.088, CORPS_OMBRE, s * 0.170, 0.050, -0.030,
        { rough: 0.82 });
      o.rotation.z = -s * 0.58;
      tete.add(faint(o));
    });
    tete.add(bigEyes({ spread: 0.104, r: 0.070, y: 0.030, z: 0.155 }));
    tete.add(R3.blush(0.162, -0.062, 0.130, 0.044));
    tete.add(smile({ w: 0.058, depth: 0.026, r: 0.016, y: -0.098, z: 0.168, count: 4 }));

    g.userData.anim = { head: tete, tail: queue, float: false };

    pilote(g, function (t) {
      // Le grand cou se balance lentement, les nageoires rament tout doucement.
      for (let i = 0; i < 4; i++) {
        c.joints[i].rotation.x = REPOS[i] + Math.sin(t * 0.9 - i * 0.5) * 0.045;
        c.joints[i].rotation.y = Math.sin(t * 0.7 + i * 0.6) * 0.040;
      }
      for (let i = 0; i < nageoires.length; i++) {
        nageoires[i].rotation.x = Math.sin(t * 1.3 + i * 1.5) * 0.16;
      }
      corps.rotation.x = Math.sin(t * 0.8) * 0.025;
    });

    g.userData.attack = function (root, p) {
      // « Surf tout doux » : il se soulève sur la vague et penche vers l'avant.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.22;
      inn.position.z = k * 0.30;
      inn.rotation.x = -k * 0.14;
      for (let i = 0; i < 4; i++) {
        c.joints[i].rotation.x = REPOS[i] + k * 0.28;
        c.joints[i].rotation.y = Math.sin(pc * Math.PI * 2 + i * 0.7) * 0.12 * k;
      }
      tete.rotation.x = -0.55 - k * 0.30;
      for (let i = 0; i < nageoires.length; i++) {
        nageoires[i].rotation.x = Math.sin(pc * Math.PI * 4 + i) * 0.45;
      }
      queue.rotation.x = -k * 0.30;
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        for (let i = 0; i < 4; i++) { c.joints[i].rotation.set(REPOS[i], 0, 0); }
        tete.rotation.x = -0.55;
        nageoires.forEach(function (n) { n.rotation.x = 0; });
        queue.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  TENTACOOL — « Une méduse bleue translucide avec deux perles rouges. »
  //  Elle FLOTTE (float: true) et ses tentacules ondulent sans jamais se presser.
  // ===========================================================================
  R3.registerCreature('tentacool', function () {
    const BLEU_CLAIR = '#8fd3f4', BLEU = '#41a6f6';
    const PERLE = '#e74c3c', TENT = '#7fc4ef';
    const g = shell(), inner = g.userData.inner;

    // --- La cloche ------------------------------------------------------------
    const dome = new THREE.Group();
    dome.position.set(0, 0.620, 0);
    inner.add(dome);
    const cloche = new THREE.Group();
    dome.add(cloche);
    // Opacité 0,80 : assez translucide pour faire « méduse », assez opaque pour
    // que la sonde compte bien la cloche dans la silhouette.
    cloche.add(R3.ellipsoid(0.300, 0.270, 0.300, BLEU_CLAIR, 0, 0, 0,
      { transparent: true, opacity: 0.80, rough: 0.20 }));
    cloche.add(faint(R3.ellipsoid(0.220, 0.190, 0.220, BLEU, 0, 0.015, 0,
      { rough: 0.45 })));

    // Les deux perles rouges, la signature de Tentacool
    const perles = [];
    [-1, 1].forEach(function (s) {
      const pl = R3.sphere(0.088, PERLE, s * 0.285, -0.020, 0.020,
        { emissive: PERLE, emissiveIntensity: 0.35, rough: 0.4 });
      dome.add(pl);
      perles.push(pl);
    });

    // --- Le visage ------------------------------------------------------------
    dome.add(bigEyes({ spread: 0.108, r: 0.072, y: -0.020, z: 0.235 }));
    dome.add(R3.blush(0.180, -0.115, 0.210, 0.044));
    dome.add(smile({ w: 0.060, depth: 0.026, r: 0.016, y: -0.135, z: 0.240, count: 4 }));

    // --- Les tentacules -------------------------------------------------------
    const bras = new THREE.Group();
    bras.position.set(0, 0.440, 0);
    inner.add(bras);
    const brins = [];
    [{ x: -0.130, z: 0.040, len: 0.400, n: 3, ph: 0.0 },
     { x: 0.130, z: 0.040, len: 0.400, n: 3, ph: 1.6 },
     { x: -0.085, z: -0.130, len: 0.250, n: 2, ph: 2.6 },
     { x: 0.085, z: -0.130, len: 0.250, n: 2, ph: 3.9 }].forEach(function (d) {
      const t = tentacle({
        len: d.len, count: d.n, r: 0.052, taper: 0.45,
        color: TENT, tipColor: BLEU, wave: 0.20, phase: d.ph, speed: 1.7,
        x: d.x, y: 0, z: d.z,
      });
      bras.add(t);
      brins.push(t);
    });

    g.userData.anim = { head: dome, tail: bras, float: true };
    g.userData.baseY = 0.050;

    pilote(g, function (t) {
      play(brins, t);
      // La cloche respire : elle se contracte puis se détend (Group, pas ellipsoïde).
      const k = Math.sin(t * 1.5);
      cloche.scale.set(1 - k * 0.05, 1 + k * 0.075, 1 - k * 0.05);
      bras.position.y = 0.440 - k * 0.025;
    });

    g.userData.attack = function (root, p) {
      // « Enlacement » : elle ouvre grand ses tentacules pour un gros câlin.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.32;
      inn.position.y = k * 0.16;
      cloche.scale.set(1 + k * 0.20, 1 - k * 0.22, 1 + k * 0.20);
      bras.rotation.x = -k * 0.30;
      for (let i = 0; i < brins.length; i++) {
        brins[i].rotation.z = Math.sin(pc * Math.PI * 3 + i * 1.1) * 0.45;
        brins[i].rotation.x = -k * 0.35;
      }
      for (let i = 0; i < perles.length; i++) {
        perles[i].scale.setScalar(1 + k * 0.40);     // R3.sphere : scale = 1
      }
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        cloche.scale.set(1, 1, 1);
        bras.rotation.set(0, 0, 0);
        brins.forEach(function (b) { b.rotation.z = 0; b.rotation.x = 0; });
        perles.forEach(function (pl) { pl.scale.setScalar(1); });
      }
    };
    return g;
  });

  // ===========================================================================
  //  KRABBY — « Un petit crabe rouge avec deux pinces énormes. »
  //  Petit (~0,6). Ses pinces sont GROSSES mais toutes rondes : elles
  //  applaudissent, elles ne pincent pas.
  // ===========================================================================
  R3.registerCreature('krabby', function () {
    const ROUGE = '#e05a45', ROUGE_FONCE = '#bd4030', VENTRE = '#f6d7ab';
    const INT = '#f8bfa8';
    const g = shell(), inner = g.userData.inner;

    // --- La carapace ----------------------------------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.220, 0);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.290, 0.180, 0.230, ROUGE, 0, 0, 0, { rough: 0.7 }));
    corps.add(faint(R3.ellipsoid(0.225, 0.110, 0.170, VENTRE, 0, -0.090, 0.055,
      { rough: 0.9 })));
    corps.add(smile({ w: 0.072, depth: 0.030, r: 0.018, y: -0.045, z: 0.215, count: 4 }));
    corps.add(R3.blush(0.190, -0.010, 0.185, 0.042));

    // --- Les deux yeux sur tiges ----------------------------------------------
    const tiges = [];
    [-1, 1].forEach(function (s) {
      const t = eyeStalk({
        len: 0.135, r: 0.054, stalkColor: ROUGE_FONCE,
        x: s * 0.100, y: 0.140, z: 0.130, tilt: -s * 0.12,
      });
      corps.add(t);
      tiges.push(t);
    });

    // --- Les deux grosses pinces ----------------------------------------------
    const pinces = [];
    const griffes = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.300, 0.200, 0.040);
      piv.add(R3.ellipsoid(0.085, 0.070, 0.070, ROUGE_FONCE, s * 0.040, 0, 0,
        { rough: 0.8 }));
      const pc = claw({
        len: 0.260, color: ROUGE, innerColor: INT, open: 0.34,
        yaw: -s * 0.32, x: s * 0.090, y: 0.010, z: 0.030,
      });
      piv.add(pc);
      inner.add(piv);
      pinces.push(piv);
      griffes.push(pc);
    });

    // --- Les six pattes -------------------------------------------------------
    [0.120, -0.020, -0.160].forEach(function (z) {
      [-1, 1].forEach(function (s) {
        const pt = R3.ellipsoid(0.042, 0.038, 0.075, ROUGE_FONCE, s * 0.255, 0.058, z,
          { rough: 0.85 });
        pt.rotation.y = -s * 0.35;
        inner.add(faint(pt));
      });
    });

    g.userData.anim = { head: corps, wingL: pinces[0], wingR: pinces[1], float: false };

    pilote(g, function (t) {
      play(griffes, t);           // clic-clac joyeux des pinces
      play(tiges, t);             // les yeux se dandinent
      corps.position.y = 0.220 + Math.abs(Math.sin(t * 2.6)) * 0.018;
    });

    g.userData.attack = function (root, p) {
      // « Grande pince » : il court de côté, puis applaudit avec ses pinces.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.x = Math.sin(pc * Math.PI * 2) * 0.22;
      inn.position.z = k * 0.28;
      inn.position.y = k * 0.10;
      const clac = Math.sin(pc * Math.PI * 6);
      pinces[0].rotation.z = 0.35 + clac * 0.30;
      pinces[1].rotation.z = -0.35 - clac * 0.30;
      for (let i = 0; i < griffes.length; i++) {
        const u = griffes[i].userData.upper, l = griffes[i].userData.lower;
        const o = 0.34 * (0.5 + 0.5 * clac);
        if (u) u.rotation.x = -o;
        if (l) l.rotation.x = o;
      }
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        pinces[0].rotation.z = 0; pinces[1].rotation.z = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  OTARIA — « Un bébé phoque blanc avec une corne sur le nez. »
  //  Tout rond, tout blanc, il glisse sur le ventre. Sa corne est un bourgeon
  //  arrondi : une bise pointue, jamais une arme.
  // ===========================================================================
  R3.registerCreature('otaria', function () {
    const BLANC = '#f6f6f8', OMBRE = '#dde6ee', VENTRE = '#ffffff';
    const CORNE = '#f0e2c0', NEZ = '#3a4a63';
    const g = shell(), inner = g.userData.inner;

    // --- Le corps -------------------------------------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.285, -0.030);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.300, 0.265, 0.420, BLANC, 0, 0, 0, { rough: 0.86 }));
    corps.add(faint(R3.ellipsoid(0.270, 0.215, 0.350, OMBRE, 0, 0.065, -0.060,
      { rough: 0.9 })));
    corps.add(faint(R3.ellipsoid(0.215, 0.170, 0.300, VENTRE, 0, -0.095, 0.070,
      { rough: 0.94 })));

    // --- La tête --------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 0.520, 0.265);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.235, 0.215, 0.225, BLANC, 0, 0, 0, { rough: 0.86 }));
    tete.add(faint(R3.ellipsoid(0.140, 0.108, 0.120, VENTRE, 0, -0.078, 0.155,
      { rough: 0.94 })));
    tete.add(faint(R3.ellipsoid(0.046, 0.036, 0.036, NEZ, 0, -0.048, 0.250,
      { rough: 0.6 })));
    // La corne : un ellipsoïde incliné vers l'avant (rotation.x positive = +z)
    const corne = R3.ellipsoid(0.048, 0.105, 0.048, CORNE, 0, 0.145, 0.155,
      { rough: 0.8 });
    corne.rotation.x = 0.55;
    tete.add(corne);
    tete.add(bigEyes({ spread: 0.108, r: 0.064, y: 0.050, z: 0.180 }));
    tete.add(R3.blush(0.168, -0.062, 0.180, 0.044));
    tete.add(smile({ w: 0.056, depth: 0.026, r: 0.016, y: -0.118, z: 0.210, count: 4 }));

    // --- Les nageoires avant ---------------------------------------------------
    const nageoires = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.250, 0.180, 0.080);
      const n = R3.ellipsoid(0.080, 0.048, 0.155, BLANC, s * 0.055, -0.030, 0.010,
        { rough: 0.88 });
      n.rotation.z = -s * 0.40;
      piv.add(n);
      inner.add(piv);
      nageoires.push(piv);
    });

    // --- La queue --------------------------------------------------------------
    const queue = finTail({
      len: 0.260, height: 0.260, thick: 0.030, color: BLANC, spread: 0.40,
      y: 0.245, z: -0.430,
    });
    inner.add(queue);

    g.userData.anim = {
      head: tete, wingL: nageoires[0], wingR: nageoires[1], tail: queue, float: false,
    };

    pilote(g, function (t) {
      // Il se dandine sur le ventre, tout content, et sa queue bat l'eau.
      const k = Math.sin(t * 1.7);
      corps.rotation.z = k * 0.05;
      tete.rotation.x = Math.sin(t * 1.3) * 0.07;
      queue.rotation.x = -0.10 + Math.sin(t * 2.0) * 0.14;
    });

    g.userData.attack = function (root, p) {
      // « Coup de corne » : il glisse en avant en riant, museau en l'air.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.40;
      inn.position.y = k * 0.08;
      inn.rotation.x = -k * 0.18;
      tete.rotation.x = -k * 0.35;
      queue.rotation.x = Math.sin(pc * Math.PI * 4) * 0.35;
      nageoires[0].rotation.z = k * 0.55;
      nageoires[1].rotation.z = -k * 0.55;
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0; queue.rotation.x = 0;
        nageoires[0].rotation.z = 0; nageoires[1].rotation.z = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  KOKIYAS — « Un coquillage bleu qui claque en s'ouvrant. »
  //  Deux valves bleues à côtes, une chair rose, une grosse langue et une
  //  perle qui brille au fond.
  // ===========================================================================
  R3.registerCreature('kokiyas', function () {
    const COQ = '#3f5fc9', COQ_CLAIR = '#6a86e8';
    const CHAIR = '#ffc0cb', LANGUE = '#ff8fb8', PERLE = '#ffe3ef';
    const g = shell(), inner = g.userData.inner;

    // Tout le coquillage dans un seul groupe : c'est lui la « tête ».
    const coquillage = new THREE.Group();
    inner.add(coquillage);

    // --- La valve du bas -------------------------------------------------------
    coquillage.add(R3.ellipsoid(0.300, 0.155, 0.275, COQ, 0, 0.155, 0, { rough: 0.6 }));
    [-0.150, 0, 0.150].forEach(function (x) {
      const co = R3.ellipsoid(0.042, 0.048, 0.260, COQ_CLAIR, x, 0.215, 0.010,
        { rough: 0.55 });
      co.rotation.y = -x * 1.1;
      coquillage.add(faint(co));
    });

    // --- La chair, la langue et la perle ---------------------------------------
    coquillage.add(faint(R3.ellipsoid(0.235, 0.095, 0.200, CHAIR, 0, 0.255, 0.020,
      { rough: 0.9 })));
    const langue = R3.ellipsoid(0.100, 0.048, 0.135, LANGUE, 0, 0.215, 0.185,
      { rough: 0.85 });
    langue.rotation.x = -0.25;
    coquillage.add(faint(langue));
    const perle = R3.sphere(0.052, PERLE, 0, 0.255, -0.095,
      { emissive: PERLE, emissiveIntensity: 0.45, rough: 0.3 });
    coquillage.add(faint(perle));

    // --- Le visage sur la chair ------------------------------------------------
    coquillage.add(bigEyes({ spread: 0.108, r: 0.074, y: 0.300, z: 0.115 }));
    coquillage.add(R3.blush(0.180, 0.245, 0.120, 0.040));

    // --- La valve du haut, sur charnière ARRIÈRE -------------------------------
    //  rotation.x NÉGATIVE fait remonter le bord avant : la coquille s'ouvre.
    const haut = new THREE.Group();
    haut.position.set(0, 0.285, -0.190);
    haut.rotation.x = -0.68;
    coquillage.add(haut);
    haut.add(R3.ellipsoid(0.300, 0.150, 0.275, COQ, 0, 0.060, 0.195, { rough: 0.6 }));
    [-0.150, 0, 0.150].forEach(function (x) {
      const co = R3.ellipsoid(0.042, 0.046, 0.255, COQ_CLAIR, x, 0.115, 0.200,
        { rough: 0.55 });
      co.rotation.y = -x * 1.1;
      haut.add(faint(co));
    });

    g.userData.anim = { head: coquillage, float: false };

    pilote(g, function (t) {
      // Il respire en ouvrant et refermant un peu sa coquille ; la perle brille.
      haut.rotation.x = -0.68 + Math.sin(t * 1.6) * 0.16;
      langue.rotation.x = -0.25 + Math.sin(t * 2.4) * 0.12;
      perle.scale.setScalar(1 + Math.sin(t * 3.0) * 0.12);   // R3.sphere : scale = 1
    });

    g.userData.attack = function (root, p) {
      // « Claquoir » : il ouvre grand... et CLAC ! en bondissant vers l'avant.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.30;
      inn.position.y = k * 0.16;
      // Grande ouverture jusqu'à la moitié, fermeture sèche ensuite.
      const ouv = (pc < 0.5) ? (pc / 0.5) : (1 - (pc - 0.5) / 0.5);
      haut.rotation.x = -0.68 - ouv * 0.55 + (pc > 0.55 ? 0.60 * (pc - 0.55) / 0.45 : 0);
      langue.rotation.x = -0.25 - ouv * 0.30;
      coquillage.rotation.x = -k * 0.20;
      if (p >= 1) {
        inn.position.set(0, 0, 0);
        haut.rotation.x = -0.68;
        langue.rotation.x = -0.25;
        coquillage.rotation.x = 0;
      }
    };
    return g;
  });

})();
