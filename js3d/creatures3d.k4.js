// =============================================================================
//  creatures3d.p8.js — LOT 8 des modèles de créatures        (CONTRAT v4, §3)
//  Plaine, désert, montagne et ville — 14 espèces :
//    rattata · chetiflor · goupix · sabelette · galopa · nosferapti · racaillou
//    onix · magneti · farfuret · caninos · fantominus · machoc · abra
//  « L'aventure de Clélia » — version 3D
// =============================================================================
//  C'est ce lot qui complète la couverture des 18 types : il apporte Combat
//  (Machoc), Psy (Abra), Roche (Racaillou, Onix), Spectre (Fantominus),
//  Ténèbres (Farfuret) et Acier (Magnéti).
//
//  RÈGLE LA PLUS IMPORTANTE DE CE FICHIER : **jamais menaçant**. Farfuret,
//  Fantominus, Machoc et Onix pourraient facilement faire peur à une enfant de
//  6 ans. Ils ne le font pas : grands yeux ronds et brillants, joues roses,
//  sourire, aucune griffe pointue, aucun croc, aucun œil méchant.
//  Fantominus est un petit fantôme farceur ; Machoc est un costaud gentil qui
//  aide à porter les courses ; Onix est un long toboggan de pierre.
//
//  Conventions (CONTRACT.md, CONTRACT-V4.md §3) :
//    - R3.registerCreature('id', build) ; build() renvoie un THREE.Group
//      centré en (0,0,0), posé sur y = 0, regardant vers +z, ~1 unité de haut
//      (Onix et Machoc ~1,4 ; Rattata et Racaillou ~0,65).
//    - Tout le corps vit dans un sous-groupe `root` : les animations déplacent
//      `root`, JAMAIS la racine (elle appartient au moteur).
//    - userData.anim = { head, wingL, wingR, tail, float } — lu par
//      R3.idleCreature(). float:true pour Magnéti et Fantominus (ils lévitent).
//    - userData.attack(g, p), p de 0 à 1 : une animation JOYEUSE.
//    - 40 meshes maximum par créature ; matériaux uniquement via R3.mat().
//
//  TROIS PIÈGES DÉJÀ PAYÉS SUR CE PROJET
//   1. R3.ellipsoid() range ses rayons dans mesh.scale : faire
//      `monEllipsoide.scale.setScalar(k)` efface ses proportions et le change
//      en boule. On n'anime donc QUE des pivots (THREE.Group nus), des
//      positions et des rotations — ou bien des cônes/sphères, dont le scale
//      vaut (1,1,1).
//   2. Rien n'appelle CL.tick() dans le jeu : les gestes autonomes passent par
//      `onBeforeRender` (voir `pilote()` plus bas), comme dans p3.
//   3. rotation.x POSITIVE bascule vers +z, donc vers l'AVANT. Une pièce qui
//      pointe vers l'arrière (-z) se RELÈVE avec une rotation.x positive.
//      Toutes les queues de ce fichier ont été vérifiées de profil.
// =============================================================================

(function () {
  'use strict';

  // Dégradation gracieuse : sans socle, ce fichier ne fait rien et ne casse rien.
  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  const TAU = Math.PI * 2;
  const HALF = Math.PI / 2;

  // La bibliothèque partagée si elle est là — sinon repli sur les primitives R3.
  const CL = (typeof R3.get === 'function' && R3.get('kclib')) || {};
  function has(n) { return typeof CL[n] === 'function'; }

  // ===========================================================================
  //  Petits utilitaires locaux
  // ===========================================================================

  /** Pivot (Group nu) posé quelque part : point de rotation propre. */
  function pivot(x, y, z) {
    const o = new THREE.Group();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** Détail décoratif : ni ombre portée, ni ombre reçue. */
  function noSh(o) { o.castShadow = false; o.receiveShadow = false; return o; }

  /** Positionne d'après o.x / o.y / o.z (convention des helpers clib). */
  function place(o, obj) { obj.position.set(o.x || 0, o.y || 0, o.z || 0); return obj; }

  /** Courbe 0 -> 1 -> 0 : le socle de toutes les animations de joie. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Petite étoile lumineuse (étincelle), sans ombre. */
  function etincelle(r, color, x, y, z) {
    return noSh(R3.star(4, r, r * 0.34, r * 0.45, color, x, y, z, {
      emissive: color, emissiveIntensity: 0.9, rough: 0.38,
    }));
  }

  /**
   * Accroche une animation par image au modèle `g` (voir p3.js).
   * On se greffe sur le premier mesh opaque : three.js appelle son
   * onBeforeRender à chaque rendu. Le garde-fou sur le temps évite de jouer
   * l'animation deux fois (passe d'ombre + passe couleur).
   */
  function pilote(g, fn) {
    let cible = null, secours = null;
    g.traverse(function (o) {
      if (!o.isMesh) return;
      if (!secours) secours = o;
      if (!cible && o.material && !o.material.transparent) cible = o;
    });
    cible = cible || secours;
    if (!cible) return;
    cible.frustumCulled = false;          // sinon l'animation s'arrête hors champ
    let dernier = -1;
    cible.onBeforeRender = function () {
      const t = R3.clock.t;
      if (t === dernier) return;
      dernier = t;
      try { fn(t); } catch (e) { /* une animation ratée ne casse jamais rien */ }
    };
  }

  /** Flamme douce : cône lumineux, arrondi, jamais pointu comme une lame. */
  function flamme(r, h, color, x, y, z) {
    return noSh(R3.cone(r, h, color, x, y, z, {
      seg: 9, rough: 0.35, emissive: color, emissiveIntensity: 0.75,
    }));
  }

  // ===========================================================================
  //  ENVELOPPES DES HELPERS `clib` — avec repli si la bibliothèque est absente.
  //  Les replis respectent l'ANCRAGE documenté par clib (centré / pivot base),
  //  pour que le reste du fichier n'ait pas à savoir laquelle est en service.
  // ===========================================================================

  function bodyBlob(o) {
    if (has('bodyBlob')) return CL.bodyBlob(o);
    o = o || {};
    const rx = o.rx || 0.30, ry = o.ry || 0.28, rz = o.rz || 0.30;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(rx, ry, rz, o.color || '#ffffff', 0, 0, 0, { flat: !!o.flat }));
    if (o.shade) {
      const c = (typeof o.shade === 'string') ? o.shade : (o.shadeColor || '#000000');
      g.add(R3.ellipsoid(rx * 0.94, ry * 0.84, rz * 0.86, c, 0, ry * 0.20, -rz * 0.16));
    }
    if (o.belly) {
      const c = (typeof o.belly === 'string') ? o.belly : (o.bellyColor || '#fff0c8');
      g.add(noSh(R3.ellipsoid(rx * 0.70, ry * 0.68, rz * 0.70, c, 0, -ry * 0.16, rz * 0.38)));
    }
    return place(o, g);
  }

  function ear(o) {
    if (has('ear')) return CL.ear(o);
    o = o || {};
    const h = o.h || 0.20, w = o.w || 0.16;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(w * 0.5, h * 0.5, w * 0.32, o.color || '#ffffff', 0, h * 0.5, 0));
    if (o.inner !== false) {
      g.add(noSh(R3.ellipsoid(w * 0.28, h * 0.38, w * 0.16, o.innerColor || '#ffaad8',
        0, h * 0.50, w * 0.20)));
    }
    g.rotation.x = o.bend || 0;
    return place(o, g);
  }

  function paw(o) {
    if (has('paw')) return CL.paw(o);
    o = o || {};
    const r = o.r || 0.09;
    return R3.ellipsoid(r, r * (o.squash || 0.66), r * (o.stretch || 1.20),
      o.color || '#ffffff', o.x || 0, o.y || 0, o.z || 0);
  }

  function bigEyes(o) {
    if (has('bigEyes')) return CL.bigEyes(o);
    o = o || {};
    const spread = (o.spread === undefined) ? 0.12 : o.spread;
    const r = o.r || 0.085, pr = o.pupilR || r * 0.52;
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(noSh(R3.ellipsoid(r, r, r * 0.60, o.scleraColor || '#f8f8f8', s * spread, 0, 0)));
      g.add(noSh(R3.ellipsoid(pr, pr, pr * 0.55, o.pupilColor || '#1a1c2c',
        s * spread, 0, r * 0.46)));
      g.add(noSh(R3.sphere(pr * 0.34, '#ffffff', s * spread + pr * 0.42, pr * 0.42, r * 0.66)));
    });
    return place(o, g);
  }

  function mouthSmile(o) {
    if (has('mouthSmile')) return CL.mouthSmile(o);
    o = o || {};
    const w = (o.w === undefined) ? 0.10 : o.w;
    const depth = (o.depth === undefined) ? 0.035 : o.depth;
    const r = o.r || 0.020, n = Math.max(3, o.count || 5);
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const k = 1 - u * u;
      g.add(noSh(R3.sphere(r * (0.68 + 0.32 * k), o.color || '#1a1c2c',
        u * w, -k * depth, -Math.abs(u) * r * 0.5)));
    }
    return place(o, g);
  }

  function stem(o) {
    if (has('stem')) return CL.stem(o);
    o = o || {};
    const len = o.len || 0.30, r = o.r || 0.030;
    const g = new THREE.Group();
    g.add(R3.cyl(r * 0.75, r, len, o.color || '#27ae60', 0, len * 0.5, 0,
      { rough: 0.86, seg: 8 }));
    g.rotation.z = o.tilt || 0;
    return place(o, g);
  }

  function leafBlade(o) {
    if (has('leafBlade')) return CL.leafBlade(o);
    o = o || {};
    const len = o.len || 0.46, wid = o.wid || 0.34, th = o.thick || 0.10;
    const color = o.color || '#38b764';
    const g = new THREE.Group();
    g.add(R3.ellipsoid(wid * 0.5, len * 0.46, th * 0.5, color, 0, len * 0.48, 0));
    if (o.tip !== false) {
      g.add(noSh(R3.cone(wid * 0.26, len * 0.22, color, 0, len * 0.94, 0, { seg: 9 })));
    }
    if (o.vein !== false) {
      g.add(noSh(R3.box(wid * 0.055, len * 0.78, th * 0.62, o.veinColor || '#1e8449',
        0, len * 0.50, th * 0.16)));
    }
    g.add(noSh(R3.ellipsoid(wid * 0.14, len * 0.08, th * 0.42, color, 0, len * 0.05, 0)));
    g.rotation.z = o.tilt || 0;
    if (o.axis === 'z') g.rotation.x = HALF;
    return place(o, g);
  }

  function sparkleRing(o) {
    if (has('sparkleRing')) return CL.sparkleRing(o);
    o = o || {};
    const n = Math.max(1, o.count || 6);
    const r = (o.r === undefined) ? 0.40 : o.r;
    const size = o.size || 0.05;
    const wave = (o.wave === undefined) ? 0.05 : o.wave;
    const c1 = o.color || '#fde74c', c2 = o.color2 || c1;
    const g = new THREE.Group();
    const tiltG = new THREE.Group();
    const spin = new THREE.Group();
    tiltG.add(spin); g.add(tiltG);
    const sparks = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const s = etincelle(size, (i % 2 === 0) ? c1 : c2,
        Math.cos(a) * r, Math.sin(a * 2) * wave, Math.sin(a) * r);
      s.userData.a0 = a;
      spin.add(s); sparks.push(s);
    }
    tiltG.rotation.x = (o.axis === 'z') ? HALF : ((o.tilt === undefined) ? 0.32 : o.tilt);
    g.userData.sparks = sparks;
    g.userData.spin = spin;
    return place(o, g);
  }

  function glowAura(o) {
    if (has('glowAura')) return CL.glowAura(o);
    o = o || {};
    const r = o.r || 0.45, n = Math.max(1, o.layers || 2);
    const color = o.color || '#fcef8d';
    const op = (o.opacity === undefined) ? 0.20 : o.opacity;
    const squash = (o.squash === undefined) ? 0.8 : o.squash;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const k = 1 + i * 0.30;
      g.add(noSh(R3.ellipsoid(r * k, r * k * squash, r * k, color, 0, 0, 0, {
        transparent: true, opacity: op / (1 + i * 0.7), rough: 0.2,
        emissive: color, emissiveIntensity: 0.8, depthWrite: false,
        side: THREE.BackSide, seg: 12,
      })));
    }
    return place(o, g);
  }

  // ===========================================================================
  //  RATTATA — « Une petite souris violette avec de grandes dents. »
  //  Couleur dominante #a040a0. Petite (~0,7) : elle grignote tout ce qui traîne.
  //  24 meshes.
  // ===========================================================================
  R3.registerCreature('rattata', function () {
    const VIOLET = '#a040a0', CLAIR = '#c46ec4', CREME = '#f0d8a0';
    const DENT = '#fffdf0', NEZ = '#ff6b9d';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps dodu, ventre crème ------------------------------------------
    root.add(bodyBlob({ rx: 0.225, ry: 0.185, rz: 0.245, color: VIOLET,
      belly: CREME, y: 0.235 }));

    // --- Quatre petites pattes ---------------------------------------------
    [-1, 1].forEach(function (s) {
      root.add(paw({ r: 0.070, color: CLAIR, x: s * 0.130, y: 0.048, z: 0.135 }));
      root.add(paw({ r: 0.076, color: CLAIR, squash: 0.55, stretch: 0.9,
        x: s * 0.160, y: 0.048, z: -0.105 }));
    });

    // --- La longue queue : trois tronçons qui montent vers l'arrière --------
    //  Pivot à l'attache : rotation.x POSITIVE = la queue se relève (voir §3).
    const queue = pivot(0, 0.235, -0.225);
    queue.add(R3.ellipsoid(0.026, 0.026, 0.085, CLAIR, 0, 0.020, -0.075));
    queue.add(R3.ellipsoid(0.021, 0.021, 0.075, CLAIR, 0, 0.070, -0.195));
    queue.add(noSh(R3.ellipsoid(0.016, 0.016, 0.060, CREME, 0, 0.140, -0.295)));
    queue.rotation.x = 0.30;
    root.add(queue);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.435, 0.115);
    tete.add(R3.ellipsoid(0.160, 0.150, 0.165, VIOLET, 0, 0, 0));
    tete.add(R3.ellipsoid(0.082, 0.068, 0.090, CREME, 0, -0.050, 0.140));
    tete.add(noSh(R3.sphere(0.026, NEZ, 0, -0.030, 0.222)));
    // Les deux incisives : carrées, blanches et arrondies — rigolotes, pas
    // menaçantes. C'est la signature de Rattata.
    [-1, 1].forEach(function (s) {
      tete.add(noSh(R3.ellipsoid(0.026, 0.038, 0.020, DENT, s * 0.030, -0.100, 0.190)));
    });
    // Oreilles rondes, bien écartées.
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'round', h: 0.150, w: 0.145, color: VIOLET,
        innerColor: '#ffaad8' });
      o.position.set(s * 0.112, 0.105, -0.020);
      o.userData.z0 = -s * 0.30;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    tete.add(R3.eyes(0.078, 0.035, 0.150, 0.044));
    tete.add(R3.blush(0.122, -0.048, 0.128, 0.044));
    root.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : elle renifle sans arrêt, les oreilles aux aguets ------
    let boost = 0;
    pilote(g, function (t) {
      const reniflette = Math.sin(t * 7.5) * 0.012;
      tete.position.y = 0.435 + reniflette;
      tete.rotation.x = Math.sin(t * 3.6) * 0.05 - boost * 0.25;
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.6 + i) * 0.10;
      }
      queue.rotation.x = 0.30 + Math.sin(t * 2.2) * 0.10 + boost * 0.30;
    });

    // --- Attaque « Vive-Attaque » : trois petits bonds véloces --------------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.42;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.13;
      root.rotation.x = -Math.sin(t * TAU) * 0.14;
    };
    return g;
  });

  // ===========================================================================
  //  CHÉTIFLOR — « Une fleur jaune au bout d'une tige verte. »
  //  Couleur dominante #fde74c. Une clochette qui chantonne en se balançant.
  //  23 meshes.
  // ===========================================================================
  R3.registerCreature('chetiflor', function () {
    const JAUNE = '#fde74c', OR = '#f1c40f', TIGE = '#38b764';
    const FEUILLE = '#27ae60', LEVRE = '#ff6b9d';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Les deux petits pieds-racines : c'est ce qui la pose sur le sol ----
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.085, 0.050, 0.120, TIGE, s * 0.085, 0.050, 0.020));
    });

    // --- La tige, dans son pivot : elle se balance tout entière -------------
    const balance = pivot(0, 0.07, 0);
    root.add(balance);
    balance.add(stem({ len: 0.55, r: 0.042, color: TIGE, segments: 2, curve: 0.08 }));

    // --- Deux feuilles presque horizontales, comme deux bras ----------------
    const feuilles = [];
    [-1, 1].forEach(function (s) {
      const f = leafBlade({ len: 0.30, wid: 0.22, thick: 0.075, color: FEUILLE,
        veinColor: '#1e8449', x: s * 0.045, y: 0.26, z: 0 });
      f.rotation.z = -s * 1.20;
      f.rotation.y = s * 0.30;
      f.userData.z0 = f.rotation.z;
      balance.add(f);
      feuilles.push(f);
    });

    // --- La clochette : son visage tout entier ------------------------------
    const cloche = pivot(0, 0.66, 0.01);
    cloche.add(R3.ellipsoid(0.200, 0.190, 0.195, JAUNE, 0, 0, 0));
    const bas = R3.cone(0.135, 0.185, OR, 0, -0.180, 0, { seg: 12 });
    bas.rotation.x = Math.PI;                     // la pointe regarde le sol
    cloche.add(bas);
    // Les lèvres roses : c'est sa bouche, un anneau bien franc.
    const levres = R3.torus(0.098, 0.030, LEVRE, 0, -0.055, 0.155, { seg: 14 });
    cloche.add(noSh(levres));
    cloche.add(R3.eyes(0.088, 0.060, 0.180, 0.050));
    cloche.add(R3.blush(0.155, -0.020, 0.140, 0.048));
    balance.add(cloche);

    g.userData.anim = { head: cloche };

    // --- Vie propre : elle chantonne en se balançant d'un pied sur l'autre --
    let boost = 0;
    pilote(g, function (t) {
      balance.rotation.z = Math.sin(t * 1.5) * 0.10;
      balance.rotation.x = Math.sin(t * 1.1 + 0.7) * 0.06;
      cloche.rotation.x = Math.sin(t * 1.5 + 0.4) * 0.09 - boost * 0.22;
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        feuilles[i].rotation.z = feuilles[i].userData.z0 - s * Math.sin(t * 2.0 + i) * 0.16
          - s * boost * 0.45;
      }
    });

    // --- Attaque « Fouet Lianes » : elle plonge en avant, feuilles au vent ---
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.26;
      root.position.y = k * 0.10;
      balance.rotation.x = k * 0.42 + Math.sin(t * Math.PI * 4) * 0.10;
    };
    return g;
  });

  // ===========================================================================
  //  GOUPIX — « Un petit renard roux à six queues. »
  //  Couleur dominante #ef7d57. Les six queues sont TOUTE sa silhouette : elles
  //  s'ouvrent en éventail derrière lui. 36 meshes.
  // ===========================================================================
  R3.registerCreature('goupix', function () {
    const ROUX = '#ef7d57', SOMBRE = '#d35400', CREME = '#ffd9a8', POIL = '#fff0c8';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps -------------------------------------------------------------
    root.add(bodyBlob({ rx: 0.215, ry: 0.185, rz: 0.250, color: ROUX,
      belly: CREME, y: 0.275 }));

    // --- Pattes -------------------------------------------------------------
    [-1, 1].forEach(function (s) {
      root.add(paw({ r: 0.072, color: SOMBRE, x: s * 0.130, y: 0.052, z: 0.150 }));
      root.add(paw({ r: 0.078, color: SOMBRE, squash: 0.58, stretch: 0.95,
        x: s * 0.155, y: 0.052, z: -0.110 }));
    });

    // --- Les six queues, en éventail ---------------------------------------
    //  Chaque queue est un pivot : rotation.y pour l'écartement, rotation.x
    //  POSITIVE pour la relever (elle pointe vers -z).
    const socleQ = pivot(0, 0.330, -0.195);
    const queues = [];
    for (let i = 0; i < 6; i++) {
      const q = pivot(0, 0, 0);
      const u = (i - 2.5) / 2.5;                   // -1 .. +1
      q.userData.y0 = u * 0.62;
      q.userData.x0 = 0.42 + (1 - Math.abs(u)) * 0.22;
      q.rotation.y = q.userData.y0;
      q.rotation.x = q.userData.x0;
      q.userData.ph = i * 0.8;
      q.add(R3.ellipsoid(0.048, 0.052, 0.130, ROUX, 0, 0, -0.120));
      q.add(noSh(R3.sphere(0.052, POIL, 0, 0.020, -0.245)));
      socleQ.add(q);
      queues.push(q);
    }
    root.add(socleQ);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.500, 0.130);
    tete.add(R3.ellipsoid(0.170, 0.155, 0.170, ROUX, 0, 0, 0));
    tete.add(R3.ellipsoid(0.072, 0.058, 0.088, CREME, 0, -0.058, 0.150));
    tete.add(noSh(R3.sphere(0.024, '#8b4513', 0, -0.040, 0.228)));
    // Le toupet crème : ses deux mèches sur le front.
    tete.add(noSh(R3.ellipsoid(0.090, 0.070, 0.060, POIL, -0.055, 0.135, 0.095)));
    tete.add(noSh(R3.ellipsoid(0.080, 0.062, 0.055, POIL, 0.060, 0.140, 0.080)));
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.165, w: 0.115, color: ROUX,
        innerColor: CREME });
      o.position.set(s * 0.108, 0.115, -0.020);
      o.userData.z0 = -s * 0.22;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    tete.add(R3.eyes(0.080, 0.030, 0.155, 0.046));
    tete.add(R3.blush(0.130, -0.052, 0.128, 0.046));
    tete.add(mouthSmile({ w: 0.048, depth: 0.022, r: 0.015, count: 3,
      y: -0.098, z: 0.192 }));
    root.add(tete);

    g.userData.anim = { head: tete, tail: socleQ };

    // --- Vie propre : les six queues ondulent l'une après l'autre -----------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < queues.length; i++) {
        const q = queues[i];
        q.rotation.x = q.userData.x0 + Math.sin(t * 2.1 + q.userData.ph) * 0.13
          + boost * 0.30;
        q.rotation.y = q.userData.y0 + Math.sin(t * 1.5 + q.userData.ph) * 0.07
          + q.userData.y0 * boost * 0.35;
      }
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.4 + i * 1.1) * 0.08;
      }
    });

    // --- Attaque « Flammèche » : il bondit et déploie ses six queues --------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.34;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.16;
      tete.rotation.x = -k * 0.16;
    };
    return g;
  });

  // ===========================================================================
  //  SABELETTE — « Un pangolin jaune qui se roule en boule. »
  //  Couleur dominante #e0c068. Dos couvert d'écailles, petites griffes
  //  arrondies pour creuser (jamais pointues). 29 meshes.
  // ===========================================================================
  R3.registerCreature('sabelette', function () {
    const JAUNE = '#e0c068', ECAILLE = '#c9a94e', VENTRE = '#f4e0a8';
    const GRIFFE = '#fff0c8';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps tout rond ----------------------------------------------------
    root.add(R3.ellipsoid(0.265, 0.230, 0.285, JAUNE, 0, 0.290, -0.020));
    root.add(noSh(R3.ellipsoid(0.185, 0.170, 0.190, VENTRE, 0, 0.235, 0.135)));

    // --- Les écailles du dos, dans un pivot (elles se hérissent d'un coup) --
    const dos = pivot(0, 0, 0);
    const ecailles = [];
    [[0.00, 0.505, 0.060], [-0.115, 0.470, -0.075], [0.115, 0.470, -0.075],
     [0.00, 0.415, -0.205]].forEach(function (v, i) {
      const p = pivot(v[0], v[1], v[2]);
      p.add(noSh(R3.ellipsoid(0.130, 0.048, 0.105, ECAILLE, 0, 0, 0)));
      p.rotation.x = -0.25;
      p.userData.x0 = -0.25;
      p.userData.ph = i * 0.9;
      dos.add(p);
      ecailles.push(p);
    });
    root.add(dos);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.395, 0.215);
    tete.add(R3.ellipsoid(0.155, 0.140, 0.150, JAUNE, 0, 0, 0));
    tete.add(R3.ellipsoid(0.078, 0.062, 0.080, VENTRE, 0, -0.050, 0.130));
    tete.add(noSh(R3.sphere(0.024, '#8b5a2b', 0, -0.035, 0.200)));
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.130, w: 0.100, color: JAUNE,
        innerColor: '#ffaad8' });
      o.position.set(s * 0.100, 0.100, -0.030);
      o.userData.z0 = -s * 0.34;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    tete.add(R3.eyes(0.074, 0.025, 0.140, 0.044));
    tete.add(R3.blush(0.118, -0.048, 0.116, 0.044));
    tete.add(mouthSmile({ w: 0.045, depth: 0.020, r: 0.015, count: 3,
      y: -0.090, z: 0.170 }));
    root.add(tete);

    // --- Pattes avant, avec deux petites griffes rondes de fouisseur -------
    const pattes = [];
    [-1, 1].forEach(function (s) {
      const pp = pivot(s * 0.155, 0.075, 0.155);
      pp.add(paw({ r: 0.080, color: JAUNE }));
      pp.add(noSh(R3.ellipsoid(0.024, 0.020, 0.048, GRIFFE, s * 0.028, -0.010, 0.095)));
      root.add(pp);
      pattes.push(pp);
      root.add(paw({ r: 0.085, color: JAUNE, squash: 0.55, stretch: 0.95,
        x: s * 0.175, y: 0.060, z: -0.145 }));
    });

    // --- Petite queue conique ----------------------------------------------
    const queue = pivot(0, 0.245, -0.270);
    const cq = R3.cone(0.075, 0.220, JAUNE, 0, 0.020, -0.090, { seg: 10 });
    cq.rotation.x = -HALF - 0.35;                 // couchée vers l'arrière, relevée
    queue.add(cq);
    root.add(queue);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : il gratte le sable, ses écailles frémissent -----------
    let boost = 0;
    pilote(g, function (t) {
      const cyc = (t % 2.8) / 2.8;
      const gratte = (cyc < 0.30) ? Math.abs(Math.sin(cyc / 0.30 * Math.PI * 3)) : 0;
      pattes[0].rotation.x = -gratte * 0.55 - boost * 0.6;
      pattes[1].rotation.x = -gratte * 0.40 - boost * 0.6;
      for (let i = 0; i < ecailles.length; i++) {
        ecailles[i].rotation.x = ecailles[i].userData.x0
          - Math.sin(t * 1.8 + ecailles[i].userData.ph) * 0.06 - boost * 0.30;
      }
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.2 + i) * 0.09;
      }
    });

    // --- Attaque « Roulade de sable » : il se roule en boule et revient -----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.36;
      root.position.y = k * 0.10;
      root.rotation.x = t * TAU;                  // un tour complet, tout rond
    };
    return g;
  });

  // ===========================================================================
  //  GALOPA — « Un cheval blanc à la crinière de feu. »   ★ pièce maîtresse ★
  //  Couleur dominante #f39c12. Corps blanc crème, crinière et queue de flammes
  //  qui dansent en permanence. 32 meshes.
  // ===========================================================================
  R3.registerCreature('galopa', function () {
    const BLANC = '#fdfaf2', OMBRE = '#e6ded0', SABOT = '#8a7358';
    const FEU = '#f39c12', FEU2 = '#ffb14e', FEU3 = '#fde74c';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps et poitrail ---------------------------------------------------
    root.add(R3.ellipsoid(0.185, 0.200, 0.330, BLANC, 0, 0.640, -0.060));
    root.add(R3.ellipsoid(0.165, 0.180, 0.170, BLANC, 0, 0.660, 0.200));

    // --- Les quatre jambes (deux devant, deux derrière) ---------------------
    //  Chacune dans un pivot à la hanche : elles piaffent et ruent.
    const jambes = [];
    [[-0.125, 0.175], [0.125, 0.175], [-0.135, -0.245], [0.135, -0.245]]
      .forEach(function (v, i) {
        const j = pivot(v[0], 0.520, v[1]);
        j.add(R3.cyl(0.052, 0.062, 0.430, BLANC, 0, -0.215, 0, { seg: 9 }));
        j.add(noSh(R3.cyl(0.062, 0.068, 0.090, SABOT, 0, -0.475, 0, { seg: 9 })));
        j.userData.ph = i * 1.6;
        root.add(j);
        jambes.push(j);
      });

    // --- Cou -----------------------------------------------------------------
    const cou = pivot(0, 0.740, 0.185);
    const tigeCou = R3.ellipsoid(0.098, 0.200, 0.115, BLANC, 0, 0.170, 0.060);
    tigeCou.rotation.x = 0.36;
    cou.add(tigeCou);
    root.add(cou);

    // --- Tête, accrochée au sommet du cou ------------------------------------
    const tete = pivot(0, 0.360, 0.185);
    const crane = R3.ellipsoid(0.092, 0.105, 0.150, BLANC, 0, 0.010, 0.040);
    crane.rotation.x = 0.42;
    tete.add(crane);
    const museau = R3.ellipsoid(0.070, 0.070, 0.090, OMBRE, 0, -0.075, 0.145);
    tete.add(museau);
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.036, 0.090, BLANC, s * 0.058, 0.105, -0.030, { seg: 8 });
      o.rotation.x = -0.25;
      tete.add(noSh(o));
    });
    tete.add(R3.eyes(0.076, 0.020, 0.100, 0.038));
    tete.add(R3.blush(0.092, -0.055, 0.115, 0.038));
    cou.add(tete);

    // --- LA CRINIÈRE DE FEU : cinq flammes le long de la nuque --------------
    const crin = [];
    [[0, 0.080, -0.075, 0.075, 0.190, FEU],
     [0, 0.185, -0.060, 0.082, 0.220, FEU2],
     [0, 0.290, -0.040, 0.078, 0.210, FEU],
     [0, 0.385, -0.010, 0.068, 0.185, FEU3],
     [0, 0.455, 0.045, 0.056, 0.150, FEU2]].forEach(function (v, i) {
      const p = pivot(v[0], v[1], v[2]);
      p.add(flamme(v[3], v[4], v[5], 0, v[4] * 0.42, 0));
      p.userData.x0 = -0.30 + i * 0.05;
      p.rotation.x = p.userData.x0;
      p.userData.ph = i * 0.7;
      cou.add(p);
      crin.push(p);
    });
    // Le toupet de feu sur le front.
    //  ⚠ Il rejoint `crin`, donc la boucle d'animation lira son `userData.x0`
    //  et son `userData.ph` comme pour les autres mèches. Sans eux, le calcul
    //  devient `undefined + Math.sin(...)` = NaN : la rotation, l'échelle et
    //  toute la boîte englobante partent en NaN, et Galopa devient invisible.
    //  (Bug réellement rencontré — c'est pour ça que la sonde teste isFinite.)
    const toupet = pivot(0, 0.130, 0.010);
    toupet.add(flamme(0.055, 0.150, FEU3, 0, 0.065, 0));
    toupet.userData.x0 = -0.30;
    toupet.userData.ph = 2.3;
    toupet.rotation.x = toupet.userData.x0;
    tete.add(toupet);
    crin.push(toupet);

    // --- La queue de feu ----------------------------------------------------
    const queue = pivot(0, 0.660, -0.360);
    const flammesQ = [];
    [[0, 0.020, -0.070, 0.085, 0.230, FEU],
     [-0.060, 0.100, -0.140, 0.065, 0.190, FEU2],
     [0.065, 0.090, -0.135, 0.062, 0.185, FEU2],
     [0, 0.190, -0.190, 0.052, 0.160, FEU3]].forEach(function (v, i) {
      const p = pivot(v[0], v[1], v[2]);
      p.add(flamme(v[3], v[4], v[5], 0, v[4] * 0.42, 0));
      p.userData.x0 = 0.55 + i * 0.10;
      p.rotation.x = p.userData.x0;             // +x = relevée vers l'arrière-haut
      p.userData.ph = i * 1.1;
      queue.add(p);
      flammesQ.push(p);
    });
    root.add(queue);

    g.userData.anim = { head: cou, tail: queue };

    // --- Vie propre : les flammes dansent, un sabot gratte le sol -----------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < crin.length; i++) {
        const p = crin[i];
        p.rotation.x = p.userData.x0 + Math.sin(t * 3.4 + p.userData.ph) * 0.16
          - boost * 0.35;
        p.rotation.z = Math.sin(t * 2.6 + p.userData.ph * 1.3) * 0.12;
        const s = 1 + Math.sin(t * 5.2 + p.userData.ph) * 0.10 + boost * 0.25;
        p.scale.set(1, s, 1);                   // pivot nu : aucun ellipsoïde écrasé
      }
      for (let i = 0; i < flammesQ.length; i++) {
        const p = flammesQ[i];
        p.rotation.x = p.userData.x0 + Math.sin(t * 3.0 + p.userData.ph) * 0.14
          + boost * 0.30;
        p.rotation.z = Math.sin(t * 2.2 + p.userData.ph) * 0.14;
        p.scale.set(1, 1 + Math.sin(t * 4.6 + p.userData.ph) * 0.12 + boost * 0.3, 1);
      }
      // Il piaffe : le sabot avant droit gratte le sol de temps en temps.
      const cyc = (t % 3.6) / 3.6;
      const gratte = (cyc < 0.22) ? Math.sin(cyc / 0.22 * Math.PI * 2) : 0;
      jambes[1].rotation.x = gratte * 0.42;
      jambes[0].rotation.x = Math.sin(t * 1.4) * 0.03;
    });

    // --- Attaque « Galop ardent » : il se cabre puis charge ------------------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.34;
      root.position.y = k * 0.10;
      root.rotation.x = -k * 0.26;               // il se cabre (l'avant monte)
      const galop = Math.sin(t * Math.PI * 6);
      jambes[0].rotation.x = galop * 0.55;
      jambes[1].rotation.x = -galop * 0.55;
      jambes[2].rotation.x = -galop * 0.40;
      jambes[3].rotation.x = galop * 0.40;
      cou.rotation.x = -k * 0.20;
    };
    return g;
  });

  // ===========================================================================
  //  NOSFERAPTI — « Une petite chauve-souris bleue sans yeux. »
  //  Couleur dominante #5a5aa8. Pas d'yeux, mais deux jolis yeux fermés en
  //  arc-en-ciel et un grand sourire : elle est ravie, pas inquiétante.
  //  25 meshes.
  // ===========================================================================
  R3.registerCreature('nosferapti', function () {
    const BLEU = '#5a5aa8', CLAIR = '#8b8bd0', MEMBRANE = '#7a6fc0';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Le corps, une grosse bouille toute ronde --------------------------
    const corps = pivot(0, 0.440, 0);
    corps.add(R3.ellipsoid(0.235, 0.220, 0.215, BLEU, 0, 0, 0));
    corps.add(noSh(R3.ellipsoid(0.150, 0.140, 0.120, CLAIR, 0, -0.040, 0.150)));
    root.add(corps);

    // --- Deux grandes oreilles : c'est avec elles qu'elle « voit » ----------
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.230, w: 0.140, color: BLEU,
        innerColor: '#c8b4f0' });
      o.position.set(s * 0.120, 0.155, -0.020);
      o.userData.z0 = -s * 0.30;
      o.rotation.z = o.userData.z0;
      corps.add(o);
      oreilles.push(o);
    });

    // --- Les deux petits pieds : elle est bien posée par terre --------------
    [-1, 1].forEach(function (s) {
      root.add(paw({ r: 0.062, color: CLAIR, squash: 0.55, x: s * 0.090,
        y: 0.045, z: 0.045 }));
    });

    // --- Ailes membranées, chacune dans son pivot d'épaule ------------------
    const ailes = [];
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.195, 0.480, -0.020);
      const m = R3.ellipsoid(0.230, 0.150, 0.030, MEMBRANE, s * 0.220, 0.010, -0.030,
        { side: THREE.DoubleSide, rough: 0.7 });
      m.rotation.z = -s * 0.18;
      ep.add(m);
      ep.add(noSh(R3.ellipsoid(0.150, 0.045, 0.024, BLEU, s * 0.150, 0.085, -0.010,
        { side: THREE.DoubleSide })));
      root.add(ep);
      ailes.push(ep);
    });

    // --- Visage : deux yeux fermés en arc et un grand sourire ---------------
    [-1, 1].forEach(function (s) {
      for (let i = 0; i < 3; i++) {
        const u = (i - 1);
        corps.add(noSh(R3.sphere(0.016, '#2a2a4a',
          s * 0.090 + u * 0.030, 0.045 + (1 - u * u) * 0.022, 0.198)));
      }
    });
    corps.add(mouthSmile({ w: 0.070, depth: 0.032, r: 0.019, count: 5,
      y: -0.055, z: 0.185 }));
    corps.add(R3.blush(0.150, -0.020, 0.155, 0.050));

    g.userData.anim = { head: corps, wingL: ailes[0], wingR: ailes[1] };

    // --- Vie propre : les oreilles pivotent comme deux petits radars --------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.0 + i * 1.4) * 0.14;
        oreilles[i].rotation.x = Math.sin(t * 1.5 + i) * 0.10 - boost * 0.25;
      }
      corps.position.y = 0.440 + Math.sin(t * 2.4) * 0.020;
    });

    // --- Attaque « Ultrason » : elle s'élève et bat vivement des ailes ------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.30;
      root.position.z = k * 0.24;
      const bat = Math.sin(t * Math.PI * 8);
      ailes[0].rotation.z = -0.10 - bat * 0.80;
      ailes[1].rotation.z = 0.10 + bat * 0.80;
      corps.rotation.x = -k * 0.14;
    };
    return g;
  });

  // ===========================================================================
  //  RACAILLOU — « Un caillou vivant avec deux bras musclés. »
  //  Couleur dominante #8a9199. Minéral : c'est l'un des deux seuls modèles du
  //  lot à avoir droit aux facettes (flat: true). Petit (~0,65). 22 meshes.
  // ===========================================================================
  R3.registerCreature('racaillou', function () {
    const PIERRE = '#8a9199', CLAIRE = '#a8b0b8', SOMBRE = '#6a727e';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Le caillou : une sphère à facettes, volontairement irrégulière -----
    const bloc = pivot(0, 0.315, 0);
    bloc.add(R3.sphere(0.295, PIERRE, 0, 0, 0, { flat: true, seg: 8, rough: 0.95 }));
    [[-0.190, 0.150, -0.110, 0.130], [0.205, 0.115, -0.060, 0.115],
     [0.040, 0.230, -0.160, 0.120], [-0.090, -0.185, 0.140, 0.105]]
      .forEach(function (v) {
        bloc.add(R3.sphere(v[3], (v[1] > 0) ? CLAIRE : SOMBRE, v[0], v[1], v[2],
          { flat: true, seg: 7, rough: 0.95 }));
      });
    root.add(bloc);

    // --- Les deux bras, pivot à l'épaule ------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.265, 0.360, 0.040);
      const b = R3.ellipsoid(0.075, 0.075, 0.100, PIERRE, s * 0.075, -0.055, 0,
        { flat: true, seg: 8 });
      b.rotation.z = s * 0.30;
      ep.add(b);
      ep.add(R3.sphere(0.098, CLAIRE, s * 0.140, -0.130, 0.010,
        { flat: true, seg: 8, rough: 0.95 }));
      ep.userData.z0 = -s * 0.15;
      ep.rotation.z = ep.userData.z0;
      root.add(ep);
      bras.push(ep);
    });

    // --- Visage : de GRANDS yeux ronds, deux sourcils rieurs, un sourire ----
    bloc.add(bigEyes({ spread: 0.115, r: 0.090, pupilR: 0.048, y: 0.035, z: 0.235 }));
    [-1, 1].forEach(function (s) {
      const sc = noSh(R3.ellipsoid(0.075, 0.024, 0.030, SOMBRE, s * 0.115, 0.145, 0.215));
      sc.rotation.z = -s * 0.28;
      bloc.add(sc);
    });
    bloc.add(mouthSmile({ w: 0.075, depth: 0.034, r: 0.020, count: 3,
      y: -0.105, z: 0.245 }));
    bloc.add(R3.blush(0.190, -0.055, 0.205, 0.050));

    g.userData.anim = { head: bloc };

    // --- Vie propre : il fait des petits mouvements de gros bras ------------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        bras[i].rotation.z = bras[i].userData.z0 - s * Math.sin(t * 2.0 + i * 1.2) * 0.14
          - s * boost * 0.55;
        bras[i].rotation.x = Math.sin(t * 1.6 + i) * 0.08;
      }
      bloc.position.y = 0.315 + Math.sin(t * 2.2) * 0.014;
    });

    // --- Attaque « Roulade » : il roule sur lui-même et revient tout fier ---
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.40;
      root.position.y = k * 0.08;
      bloc.rotation.x = t * TAU;
    };
    return g;
  });

  // ===========================================================================
  //  ONIX — « Un immense serpent de rochers. »          ★ pièce maîtresse ★
  //  Couleur dominante #7f8c8d. ~1,4 unité : une chaîne de blocs à facettes qui
  //  s'élève en S depuis le sol, une grosse tête ronde avec de GRANDS yeux et
  //  un franc sourire, et une corne ÉMOUSSÉE (aucune pointe agressive).
  //  C'est un toboggan de pierre, pas un monstre. 25 meshes.
  // ===========================================================================
  R3.registerCreature('onix', function () {
    const ROC = '#7f8c8d', ROC2 = '#95a5a6', SOMBRE = '#5f6a6b', CORNE = '#bdc3c7';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- La queue, posée au sol, dans son pivot (elle balaie doucement) -----
    const queue = pivot(0, 0.130, -0.300);
    queue.add(R3.ellipsoid(0.110, 0.100, 0.130, ROC, 0, -0.005, -0.115,
      { flat: true, seg: 9 }));
    queue.add(noSh(R3.ellipsoid(0.080, 0.072, 0.100, ROC2, 0, 0.005, -0.290,
      { flat: true, seg: 8 })));
    root.add(queue);

    // --- Le corps : sept blocs qui montent en S -----------------------------
    const blocs = [];
    [[0.000, 0.150, -0.240, 0.145],
     [0.045, 0.195, -0.100, 0.165],
     [0.020, 0.300, 0.020, 0.180],
     [-0.030, 0.460, 0.060, 0.190],
     [0.000, 0.630, 0.040, 0.190],
     [0.030, 0.790, 0.020, 0.180],
     [0.000, 0.940, 0.030, 0.170]].forEach(function (v, i) {
      const p = pivot(v[0], v[1], v[2]);
      p.add(R3.sphere(v[3], (i % 2 === 0) ? ROC : ROC2, 0, 0, 0,
        { flat: true, seg: 8, rough: 0.95 }));
      p.userData.x0 = v[0];
      p.userData.i = i;
      root.add(p);
      blocs.push(p);
    });

    // --- La tête : ronde, rassurante, très expressive -----------------------
    const tete = pivot(0, 1.105, 0.100);
    tete.add(R3.ellipsoid(0.185, 0.175, 0.220, ROC, 0, 0, 0, { flat: true, seg: 9 }));
    tete.add(R3.ellipsoid(0.130, 0.090, 0.110, ROC2, 0, -0.090, 0.170,
      { flat: true, seg: 8 }));                  // le menton, tout arrondi
    // La corne : courte, épaisse, à bout ROND. Rien qui puisse faire peur.
    const corne = R3.cone(0.078, 0.150, CORNE, 0, 0.235, -0.010, { seg: 9 });
    corne.rotation.x = -0.18;
    tete.add(noSh(corne));
    tete.add(bigEyes({ spread: 0.098, r: 0.078, pupilR: 0.042, y: 0.050, z: 0.195 }));
    tete.add(mouthSmile({ w: 0.085, depth: 0.038, r: 0.021, count: 5,
      y: -0.075, z: 0.215 }));
    tete.add(R3.blush(0.165, -0.030, 0.180, 0.052));
    root.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : une onde lente parcourt toute la chaîne de blocs ------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < blocs.length; i++) {
        const b = blocs[i];
        b.position.x = b.userData.x0 + Math.sin(t * 1.4 - i * 0.55) * (0.030 + boost * 0.05);
        b.position.z += 0;                       // (la profondeur ne bouge pas)
      }
      tete.position.x = Math.sin(t * 1.4 - blocs.length * 0.55) * (0.030 + boost * 0.05);
      tete.rotation.x = Math.sin(t * 1.1) * 0.05 - boost * 0.20;
      queue.rotation.x = Math.sin(t * 1.2 + 1.0) * 0.10;
    });

    // --- Attaque « Enroulade » : il ondule très fort et se penche vers vous --
    //  Jamais un plongeon d'attaque : il vient dire bonjour, de tout son long.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.rotation.y = Math.sin(t * TAU) * 0.22;
      root.position.z = k * 0.16;
      root.position.y = k * 0.05;
    };
    return g;
  });

  // ===========================================================================
  //  MAGNÉTI — « Un aimant flottant avec un grand œil. »
  //  Couleur dominante #b8b8d0. Il LÉVITE (float: true) et grésille de petites
  //  étincelles. 26 meshes.
  // ===========================================================================
  R3.registerCreature('magneti', function () {
    const ACIER = '#b8b8d0', ACIER2 = '#8f8fa8', ROUGE = '#e74c3c', BLEU = '#41a6f6';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- La sphère de métal -------------------------------------------------
    const corps = pivot(0, 0.610, 0);
    corps.add(R3.sphere(0.275, ACIER, 0, 0, 0, { rough: 0.32, metal: 0.55, seg: 16 }));
    root.add(corps);

    // --- Son unique grand œil, tout rond ------------------------------------
    corps.add(noSh(R3.ellipsoid(0.135, 0.135, 0.075, '#f8f8f8', 0, 0.030, 0.215)));
    corps.add(noSh(R3.ellipsoid(0.068, 0.068, 0.045, '#1a1c2c', 0, 0.030, 0.262)));
    corps.add(noSh(R3.sphere(0.030, '#ffffff', 0.048, 0.078, 0.278)));
    corps.add(mouthSmile({ w: 0.055, depth: 0.026, r: 0.017, count: 3,
      y: -0.125, z: 0.245 }));
    corps.add(R3.blush(0.175, -0.090, 0.190, 0.046));

    // --- Les trois vis (une sur le crâne, deux sur les côtés) ---------------
    const visHaut = R3.cyl(0.042, 0.048, 0.140, ACIER2, 0, 0.330, 0,
      { seg: 8, rough: 0.35, metal: 0.6 });
    corps.add(visHaut);
    [-1, 1].forEach(function (s) {
      const v = R3.cyl(0.038, 0.044, 0.110, ACIER2, s * 0.300, -0.075, -0.040,
        { seg: 8, rough: 0.35, metal: 0.6 });
      v.rotation.z = HALF;
      corps.add(v);
    });

    // --- Les deux aimants en fer à cheval, dans leur pivot ------------------
    const aimants = [];
    [-1, 1].forEach(function (s) {
      const a = pivot(s * 0.300, 0.470, -0.020);
      a.rotation.y = -s * 0.42;
      a.add(R3.box(0.055, 0.190, 0.060, ACIER, 0, 0, -0.075, { rough: 0.35, metal: 0.5 }));
      a.add(R3.box(0.055, 0.062, 0.150, ACIER, 0, 0.064, 0.020, { rough: 0.35, metal: 0.5 }));
      a.add(R3.box(0.055, 0.062, 0.150, ACIER, 0, -0.064, 0.020, { rough: 0.35, metal: 0.5 }));
      a.add(noSh(R3.box(0.058, 0.066, 0.050, ROUGE, 0, 0.064, 0.118, { rough: 0.5 })));
      a.add(noSh(R3.box(0.058, 0.066, 0.050, BLEU, 0, -0.064, 0.118, { rough: 0.5 })));
      a.userData.y0 = -s * 0.42;
      root.add(a);
      aimants.push(a);
    });

    // --- Les étincelles qui tournent autour de lui --------------------------
    const anneau = sparkleRing({ count: 4, r: 0.400, size: 0.045, color: '#fde74c',
      color2: BLEU, tilt: 0.34, wave: 0.05, y: 0.610 });
    root.add(anneau);
    const spin = (anneau.userData && anneau.userData.spin) || anneau;
    const sparks = (anneau.userData && anneau.userData.sparks) || [];

    g.userData.anim = { head: corps, tail: anneau, float: true };
    g.userData.baseY = 0.03;

    // --- Vie propre : il grésille, ses aimants tressaillent -----------------
    let boost = 0;
    pilote(g, function (t) {
      spin.rotation.y = t * 1.30;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.rotation.z = t * 2.2 + i;
        s.scale.setScalar((0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 6.0 + i * 2)))
          * (1 + boost * 0.9));
      }
      for (let i = 0; i < 2; i++) {
        const a = aimants[i];
        a.rotation.y = a.userData.y0 + Math.sin(t * 3.2 + i * 1.7) * 0.09
          + a.userData.y0 * boost * 0.5;
        a.rotation.z = Math.sin(t * 4.4 + i) * 0.05;
      }
      corps.rotation.y = Math.sin(t * 0.9) * 0.12;
    });

    // --- Attaque « Éclair » : il tourne sur lui-même et crépite -------------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.28;
      root.position.y = k * 0.14;
      root.rotation.y = Math.sin(t * Math.PI * 4) * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  FARFURET — « Un petit espiègle noir et rouge, vif comme l'éclair. »
  //  Couleur dominante #5d275d. PIÈGE DU LOT : il pourrait faire peur. Ici il a
  //  de grands yeux ronds brillants, des joues roses, un sourire malicieux et
  //  des pattes ARRONDIES (aucune griffe). 27 meshes.
  // ===========================================================================
  R3.registerCreature('farfuret', function () {
    const SOMBRE = '#5d275d', CLAIR = '#7b3a7b', ROUGE = '#e74c3c';
    const OR = '#f1c40f';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps --------------------------------------------------------------
    root.add(bodyBlob({ rx: 0.200, ry: 0.215, rz: 0.185, color: SOMBRE,
      belly: CLAIR, y: 0.400 }));
    // Le petit médaillon doré sur la poitrine.
    root.add(noSh(R3.ellipsoid(0.070, 0.060, 0.035, OR, 0, 0.430, 0.180)));

    // --- Bras et jambes, tout ronds -----------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.190, 0.450, 0.020);
      b.add(paw({ r: 0.078, color: CLAIR, squash: 0.85, stretch: 0.95,
        x: s * 0.045, y: -0.100, z: 0.020 }));
      b.userData.z0 = -s * 0.20;
      b.rotation.z = b.userData.z0;
      root.add(b);
      bras.push(b);
      root.add(paw({ r: 0.088, color: CLAIR, squash: 0.55, stretch: 1.15,
        x: s * 0.115, y: 0.055, z: 0.055 }));
    });

    // --- La queue-plume rouge, relevée derrière -----------------------------
    const queue = pivot(0, 0.360, -0.180);
    queue.add(R3.ellipsoid(0.055, 0.075, 0.130, ROUGE, 0, 0.030, -0.110));
    queue.add(noSh(R3.ellipsoid(0.040, 0.055, 0.100, '#ff8f7a', 0, 0.075, -0.230)));
    queue.rotation.x = 0.42;                    // relevée : +x sur une pièce en -z
    root.add(queue);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.680, 0.030);
    tete.add(R3.ellipsoid(0.170, 0.160, 0.165, SOMBRE, 0, 0, 0));
    tete.add(noSh(R3.ellipsoid(0.070, 0.055, 0.070, CLAIR, 0, -0.060, 0.140)));
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.170, w: 0.100, color: SOMBRE,
        innerColor: '#c86ec8' });
      o.position.set(s * 0.105, 0.115, -0.020);
      o.userData.z0 = -s * 0.30;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    // La grande plume rouge sur le front : sa marque de fabrique.
    const plume = pivot(0, 0.140, -0.020);
    plume.add(noSh(R3.ellipsoid(0.055, 0.135, 0.045, ROUGE, 0, 0.115, -0.060)));
    plume.add(noSh(R3.ellipsoid(0.040, 0.090, 0.035, '#ff8f7a', 0, 0.250, -0.130)));
    plume.rotation.x = -0.30;
    tete.add(plume);
    tete.add(bigEyes({ spread: 0.088, r: 0.070, pupilR: 0.038, y: 0.020, z: 0.155 }));
    tete.add(R3.blush(0.135, -0.055, 0.135, 0.048));
    tete.add(mouthSmile({ w: 0.052, depth: 0.024, r: 0.016, count: 3,
      y: -0.100, z: 0.170 }));
    root.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : il ne tient pas en place, la plume frémit -------------
    let boost = 0;
    pilote(g, function (t) {
      plume.rotation.x = -0.30 + Math.sin(t * 2.8) * 0.12 - boost * 0.30;
      plume.rotation.z = Math.sin(t * 2.1) * 0.10;
      queue.rotation.x = 0.42 + Math.sin(t * 2.5) * 0.13 + boost * 0.25;
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        bras[i].rotation.z = bras[i].userData.z0 - s * Math.sin(t * 3.0 + i * 1.5) * 0.16;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.3 + i) * 0.08;
      }
      root.position.x = Math.sin(t * 1.9) * 0.020;
    });

    // --- Attaque « Feinte » : il file à gauche… et revient par la droite ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.x = Math.sin(t * TAU) * 0.30;
      root.position.z = k * 0.34;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.14;
      root.rotation.y = Math.sin(t * TAU) * 0.45;
    };
    return g;
  });

  // ===========================================================================
  //  CANINOS — « Un chiot orange rayé de noir. »
  //  Couleur dominante #f08030. Crinière et queue crème bien touffues.
  //  31 meshes.
  // ===========================================================================
  R3.registerCreature('caninos', function () {
    const ORANGE = '#f08030', SOMBRE = '#2a2a3a', CREME = '#fff0c8';
    const PATTE = '#d35400';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Corps + rayures ----------------------------------------------------
    root.add(bodyBlob({ rx: 0.225, ry: 0.200, rz: 0.265, color: ORANGE,
      belly: CREME, y: 0.315 }));
    [[0.00, 0.470, 0.060], [-0.010, 0.440, -0.110], [0.010, 0.395, -0.230]]
      .forEach(function (v) {
        root.add(noSh(R3.ellipsoid(0.150, 0.048, 0.045, SOMBRE, v[0], v[1], v[2])));
      });

    // --- Quatre pattes ------------------------------------------------------
    const pattes = [];
    [[-0.135, 0.165], [0.135, 0.165], [-0.150, -0.155], [0.150, -0.155]]
      .forEach(function (v, i) {
        const p = pivot(v[0], 0.140, v[1]);
        p.add(paw({ r: 0.078, color: PATTE, squash: 0.85, stretch: 1.0, y: -0.075 }));
        p.userData.ph = i * 1.5;
        root.add(p);
        pattes.push(p);
      });

    // --- La crinière crème, autour du cou -----------------------------------
    root.add(R3.ellipsoid(0.215, 0.190, 0.115, CREME, 0, 0.470, 0.185));
    root.add(noSh(R3.ellipsoid(0.155, 0.135, 0.080, '#fffaf0', 0, 0.480, 0.230)));

    // --- La queue touffue ---------------------------------------------------
    const queue = pivot(0, 0.410, -0.230);
    queue.add(R3.ellipsoid(0.085, 0.095, 0.110, CREME, 0, 0.075, -0.075));
    queue.add(noSh(R3.ellipsoid(0.070, 0.075, 0.085, '#fffaf0', 0, 0.180, -0.135)));
    queue.rotation.x = 0.35;
    root.add(queue);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.590, 0.215);
    tete.add(R3.ellipsoid(0.175, 0.160, 0.170, ORANGE, 0, 0, 0));
    tete.add(R3.ellipsoid(0.085, 0.070, 0.090, CREME, 0, -0.055, 0.150));
    tete.add(noSh(R3.sphere(0.030, SOMBRE, 0, -0.030, 0.228)));
    tete.add(noSh(R3.ellipsoid(0.070, 0.055, 0.045, CREME, 0, 0.125, 0.105)));
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.150, w: 0.115, color: ORANGE,
        innerColor: '#ffaad8' });
      o.position.set(s * 0.118, 0.105, -0.020);
      o.userData.z0 = -s * 0.34;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    tete.add(R3.eyes(0.082, 0.030, 0.155, 0.048));
    tete.add(R3.blush(0.132, -0.050, 0.132, 0.048));
    tete.add(mouthSmile({ w: 0.052, depth: 0.024, r: 0.016, count: 3,
      y: -0.095, z: 0.190 }));
    // La petite langue rose : il est content de vous voir.
    tete.add(noSh(R3.ellipsoid(0.035, 0.018, 0.045, '#ff6b9d', 0, -0.115, 0.185)));
    root.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : la queue bat sans arrêt, il piétine de joie -----------
    let boost = 0;
    pilote(g, function (t) {
      queue.rotation.z = Math.sin(t * 6.5) * (0.30 + boost * 0.25);
      queue.rotation.x = 0.35 + Math.sin(t * 3.2) * 0.08;
      for (let i = 0; i < pattes.length; i++) {
        pattes[i].rotation.x = Math.sin(t * 2.6 + pattes[i].userData.ph) * 0.07;
      }
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 2.5 + i) * 0.10;
      }
      tete.rotation.x = Math.sin(t * 1.7) * 0.05 - boost * 0.20;
    });

    // --- Attaque « Crocs Feu » : il bondit vers vous en aboyant de joie -----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.40;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.22;
      root.rotation.x = -k * 0.16;
      pattes[0].rotation.x = -k * 0.6;
      pattes[1].rotation.x = -k * 0.6;
    };
    return g;
  });

  // ===========================================================================
  //  FANTOMINUS — « Un petit fantôme violet qui flotte. »
  //  Couleur dominante #705898. PIÈGE DU LOT : ce n'est PAS une menace, c'est un
  //  farceur. Bouille ronde, énormes yeux brillants, langue tirée pour rire, et
  //  un nuage de gaz translucide tout autour. Il LÉVITE. 20 meshes.
  // ===========================================================================
  R3.registerCreature('fantominus', function () {
    const VIOLET = '#705898', PALE = '#a58fd0', GAZ = '#4a3a6a';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Le noyau : sa bouille, bien opaque et bien ronde -------------------
    const noyau = pivot(0, 0.560, 0);
    noyau.add(R3.ellipsoid(0.320, 0.310, 0.300, VIOLET, 0, 0, 0, { rough: 0.55 }));
    root.add(noyau);

    // --- Le nuage de gaz : cinq bulles translucides autour de lui -----------
    //  Translucides (opacité < 0,68) : la sonde les traite comme un halo et ne
    //  les compte pas dans la silhouette. C'est voulu.
    const bulles = [];
    [[-0.330, 0.220, 0.060, 0.185], [0.345, 0.250, -0.040, 0.170],
     [0.000, 0.140, -0.200, 0.160], [-0.230, 0.840, -0.080, 0.150],
     [0.260, 0.830, 0.030, 0.140]].forEach(function (v, i) {
      const p = pivot(v[0], v[1], v[2]);
      p.add(noSh(R3.sphere(v[3], GAZ, 0, 0, 0, {
        transparent: true, opacity: 0.42, depthWrite: false, rough: 0.45, seg: 12,
      })));
      p.userData.y0 = v[1];
      p.userData.x0 = v[0];
      p.userData.ph = i * 1.25;
      root.add(p);
      bulles.push(p);
    });

    // --- Le visage : c'est lui qui dit tout ---------------------------------
    noyau.add(bigEyes({ spread: 0.128, r: 0.105, pupilR: 0.055, y: 0.060, z: 0.255 }));
    noyau.add(mouthSmile({ w: 0.105, depth: 0.045, r: 0.024, count: 5,
      y: -0.105, z: 0.270 }));
    noyau.add(noSh(R3.ellipsoid(0.048, 0.024, 0.060, '#ff6b9d', 0, -0.165, 0.265)));
    noyau.add(R3.blush(0.215, -0.070, 0.230, 0.058));

    g.userData.anim = { head: noyau, float: true };
    g.userData.baseY = 0.06;

    // --- Vie propre : le gaz dérive paresseusement, il fait des grimaces ----
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < bulles.length; i++) {
        const b = bulles[i];
        b.position.y = b.userData.y0 + Math.sin(t * 0.9 + b.userData.ph) * 0.045;
        b.position.x = b.userData.x0 + Math.sin(t * 0.7 + b.userData.ph * 1.4) * 0.045;
        b.scale.setScalar(1 + Math.sin(t * 1.2 + b.userData.ph) * 0.12 + boost * 0.35);
      }
      noyau.rotation.y = Math.sin(t * 1.1) * 0.16;
      noyau.rotation.x = Math.sin(t * 1.6) * 0.07 - boost * 0.18;
    });

    // --- Attaque « Lechouille » : il fonce, fait un tour et repart en riant --
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.44;
      root.position.y = k * 0.18;
      root.rotation.y = Math.sin(t * TAU) * 0.55;
      root.rotation.z = Math.sin(t * Math.PI * 4) * 0.14;
    };
    return g;
  });

  // ===========================================================================
  //  MACHOC — « Un costaud bleu très musclé. »
  //  Couleur dominante #5aa8ff. ~1,4 unité. PIÈGE DU LOT : il ne doit pas faire
  //  peur. C'est le gentil déménageur du quartier — grands yeux, joues roses,
  //  grand sourire, poings tout ronds. 30 meshes.
  // ===========================================================================
  R3.registerCreature('machoc', function () {
    const BLEU = '#5aa8ff', BLEU2 = '#8ec8ff', CLAIR = '#cfe8ff';
    const BRUN = '#8b5a2b';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Les jambes ---------------------------------------------------------
    const jambes = [];
    [-1, 1].forEach(function (s) {
      const j = pivot(s * 0.135, 0.400, 0);
      j.add(R3.ellipsoid(0.098, 0.200, 0.105, BLEU, 0, -0.180, 0));
      j.add(R3.ellipsoid(0.105, 0.060, 0.140, BLEU2, 0, -0.345, 0.035));
      root.add(j);
      jambes.push(j);
    });

    // --- Le torse -----------------------------------------------------------
    const torse = pivot(0, 0.760, 0);
    torse.add(R3.ellipsoid(0.245, 0.265, 0.185, BLEU, 0, 0, 0));
    torse.add(noSh(R3.ellipsoid(0.165, 0.190, 0.100, CLAIR, 0, -0.030, 0.135)));
    // Les trois côtes brunes du ventre : sa musculature de dessin animé.
    [0.055, -0.030, -0.115].forEach(function (y) {
      torse.add(noSh(R3.ellipsoid(0.090, 0.020, 0.030, BRUN, 0, y, 0.185)));
    });
    root.add(torse);

    // --- Les bras, avec des poings tout ronds -------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.255, 0.930, 0.010);
      ep.add(R3.sphere(0.110, BLEU, 0, 0, 0));
      ep.add(R3.ellipsoid(0.082, 0.165, 0.090, BLEU, s * 0.030, -0.175, 0));
      ep.add(R3.sphere(0.105, BLEU2, s * 0.060, -0.330, 0.020));
      ep.userData.z0 = -s * 0.22;
      ep.rotation.z = ep.userData.z0;
      root.add(ep);
      bras.push(ep);
    });

    // --- La tête ------------------------------------------------------------
    const tete = pivot(0, 1.185, 0.015);
    tete.add(R3.ellipsoid(0.185, 0.170, 0.170, BLEU, 0, 0, 0));
    tete.add(R3.ellipsoid(0.105, 0.080, 0.085, BLEU2, 0, -0.065, 0.145));
    // Les trois crêtes brunes sur le crâne.
    [-1, 0, 1].forEach(function (s) {
      const c = noSh(R3.ellipsoid(0.038, 0.055, 0.075, BRUN, s * 0.085, 0.160, -0.020));
      c.rotation.z = -s * 0.25;
      tete.add(c);
    });
    tete.add(R3.eyes(0.088, 0.035, 0.160, 0.050));
    tete.add(R3.blush(0.140, -0.045, 0.140, 0.052));
    tete.add(mouthSmile({ w: 0.070, depth: 0.032, r: 0.019, count: 3,
      y: -0.105, z: 0.185 }));
    root.add(tete);

    // --- Sa petite queue ----------------------------------------------------
    const queue = pivot(0, 0.700, -0.185);
    queue.add(R3.ellipsoid(0.048, 0.048, 0.110, BLEU2, 0, 0.020, -0.090));
    queue.rotation.x = 0.30;
    root.add(queue);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : il respire fort et fait rouler ses épaules ------------
    let boost = 0;
    pilote(g, function (t) {
      torse.position.y = 0.760 + Math.sin(t * 2.0) * 0.018;
      torse.rotation.y = Math.sin(t * 1.2) * 0.09;
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        bras[i].rotation.z = bras[i].userData.z0 - s * Math.sin(t * 1.8 + i * 1.1) * 0.12
          - s * boost * 0.35;
        bras[i].rotation.x = Math.sin(t * 1.5 + i * 2.0) * 0.10 - boost * 0.65;
      }
      queue.rotation.z = Math.sin(t * 2.6) * 0.16;
    });

    // --- Attaque « Poing-Karaté » : un coup net, arrêté avant de toucher ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.z = k * 0.28;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.10;
      root.rotation.y = Math.sin(t * TAU) * 0.28;
      tete.rotation.x = -k * 0.12;
    };
    return g;
  });

  // ===========================================================================
  //  ABRA — « Un petit renard doré qui dort dix-huit heures par jour. »
  //  Couleur dominante #f1c40f. ASSIS EN TAILLEUR, les yeux fermés, entouré
  //  d'étincelles psy roses. 31 meshes.
  // ===========================================================================
  R3.registerCreature('abra', function () {
    const OR = '#f1c40f', OR2 = '#fde74c', BRUN = '#8b5a2b', BRUN2 = '#a5713a';
    const PSY = '#f85888';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Les jambes croisées : c'est ce qui le pose au sol -------------------
    [-1, 1].forEach(function (s) {
      const j = R3.ellipsoid(0.150, 0.085, 0.115, OR, s * 0.115, 0.090, 0.075);
      j.rotation.y = -s * 0.45;
      root.add(j);
    });

    // --- Le corps, dans son pivot : il respire lentement --------------------
    const corps = pivot(0, 0.320, 0);
    corps.add(R3.ellipsoid(0.195, 0.180, 0.170, OR, 0, 0, 0));
    corps.add(noSh(R3.ellipsoid(0.145, 0.130, 0.090, BRUN, 0, -0.015, 0.115)));
    [-1, 1].forEach(function (s) {
      corps.add(R3.ellipsoid(0.070, 0.075, 0.070, BRUN2, s * 0.180, 0.060, 0.010));
      // Les mains posées bien à plat sur les genoux.
      corps.add(paw({ r: 0.072, color: OR2, squash: 0.60, stretch: 1.05,
        x: s * 0.185, y: -0.150, z: 0.120 }));
    });
    root.add(corps);

    // --- La queue enroulée derrière -----------------------------------------
    const queue = pivot(0, 0.180, -0.150);
    queue.add(R3.ellipsoid(0.062, 0.062, 0.110, BRUN2, 0, 0.020, -0.090));
    queue.add(noSh(R3.ellipsoid(0.048, 0.048, 0.075, OR2, 0, 0.090, -0.185)));
    queue.rotation.x = 0.45;
    root.add(queue);

    // --- La tête, longue et douce -------------------------------------------
    const tete = pivot(0, 0.600, 0.010);
    tete.add(R3.ellipsoid(0.165, 0.150, 0.180, OR, 0, 0, 0));
    tete.add(R3.ellipsoid(0.090, 0.070, 0.095, OR2, 0, -0.055, 0.160));
    tete.add(noSh(R3.sphere(0.022, BRUN, 0, -0.030, 0.245)));
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = ear({ shape: 'pointy', h: 0.195, w: 0.100, color: OR,
        innerColor: BRUN2 });
      o.position.set(s * 0.100, 0.110, -0.030);
      o.userData.z0 = -s * 0.24;
      o.rotation.z = o.userData.z0;
      tete.add(o);
      oreilles.push(o);
    });
    // Les yeux FERMÉS, en arcs souriants : Abra dort, et il en est ravi.
    [-1, 1].forEach(function (s) {
      for (let i = 0; i < 3; i++) {
        const u = i - 1;
        tete.add(noSh(R3.sphere(0.016, '#5a3a10',
          s * 0.082 + u * 0.030, 0.030 + (1 - u * u) * 0.024, 0.163)));
      }
    });
    tete.add(R3.blush(0.130, -0.040, 0.150, 0.048));
    tete.add(mouthSmile({ w: 0.048, depth: 0.022, r: 0.015, count: 3,
      y: -0.100, z: 0.185 }));
    root.add(tete);

    // --- Les étincelles psy qui tournent au-dessus de sa tête ---------------
    const anneau = sparkleRing({ count: 4, r: 0.300, size: 0.042, color: PSY,
      color2: '#ffaad8', tilt: 0.22, wave: 0.04, y: 0.760 });
    root.add(anneau);
    const spin = (anneau.userData && anneau.userData.spin) || anneau;
    const sparks = (anneau.userData && anneau.userData.sparks) || [];

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : il respire dans son sommeil, les étoiles tournent -----
    let boost = 0;
    pilote(g, function (t) {
      corps.position.y = 0.320 + Math.sin(t * 1.3) * 0.016;
      tete.position.y = 0.600 + Math.sin(t * 1.3) * 0.018;
      tete.rotation.x = 0.06 + Math.sin(t * 0.9) * 0.05 - boost * 0.25;
      spin.rotation.y = t * 0.75;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.rotation.z = t * 1.4 + i;
        s.scale.setScalar((0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.6 + i * 2)))
          * (1 + boost * 0.8));
      }
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 1.5 + i) * 0.06;
      }
    });

    // --- Attaque « Téléport farceur » : il disparaît d'un côté, revient de
    //     l'autre, et ses étoiles s'affolent. Aucun choc, que de la magie. ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      root.position.x = Math.sin(t * TAU) * 0.34;
      root.position.y = k * 0.22;
      root.position.z = k * 0.16;
      root.rotation.y = Math.sin(t * TAU) * 0.60;
    };
    return g;
  });

  // Enregistrement du lot (informatif : utile au débogage en console).
  R3.register('creaturesP8', {
    ids: ['rattata', 'chetiflor', 'goupix', 'sabelette', 'galopa', 'nosferapti',
      'racaillou', 'onix', 'magneti', 'farfuret', 'caninos', 'fantominus',
      'machoc', 'abra'],
  });
})();
