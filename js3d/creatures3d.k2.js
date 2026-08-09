// =============================================================================
//  creatures3d.p6.js — LOT 6 des modèles de créatures : LES STARS
//  pikachu · raichu · evoli · aquali · pyroli · voltali
//  rondoudou · grodoudou · miaouss · persian · ronflex
//  « L'aventure de Clélia » — version 3D  (CONTRAT-V4 §3)
// =============================================================================
//  Ce sont les onze Pokémon que Clélia reconnaît AVANT de savoir lire leur nom.
//  Tout le travail consiste donc à rendre la silhouette lisible en un dixième
//  de seconde, de trois quarts comme de face :
//
//    · Pikachu   — oreilles à pointe noire, joues rouges, queue en éclair.
//    · Raichu    — même souris en plus grand, orange, longue queue à éclair.
//    · Évoli     — grande collerette crème, queue touffue, énormes yeux.
//    · Aquali    — la MÊME carrure qu'Évoli, mais tout en nageoires lisses.
//    · Pyroli    — la MÊME carrure, noyée dans une crinière touffue et chaude.
//    · Voltali   — la MÊME carrure, hérissée de piquants anguleux.
//    · Rondoudou — un ballon rose avec la mèche sur le front.
//    · Grodoudou — le même ballon, en grand, avec de longues oreilles.
//    · Miaouss   — la pièce d'or sur le front, les moustaches.
//    · Persian   — le chat élégant à quatre pattes, la gemme rouge.
//    · Ronflex   — une montagne bleue endormie, gros ventre crème.
//
//  CONVENTIONS (voir CONTRACT.md et CONTRACT-V4 §3)
//  ------------------------------------------------
//    - Group racine centré en (0,0,0), posé sur y = 0, regardant vers +z,
//      ~1 unité de haut (Pikachu et Miaouss ~0,88 ; Ronflex ~1,4 et large).
//    - Tout le corps vit dans un sous-groupe `inner` : les animations déplacent
//      `inner`, JAMAIS la racine (que le jeu positionne et met à l'échelle).
//    - userData.anim = { head, wingL, wingR, tail, float } — lu par idleCreature.
//    - userData.attack(g, p) : une animation JOYEUSE, p de 0 à 1.
//    - Budget 40 meshes par créature. Matériaux uniquement via R3.mat().
//
//  DEUX PIÈGES DÉJÀ PAYÉS SUR CE PROJET, ÉVITÉS PARTOUT ICI
//  --------------------------------------------------------
//   1. R3.ellipsoid() range ses rayons dans mesh.scale : écrire
//      `monEllipsoide.scale.setScalar(k)` efface ses proportions et le change en
//      boule de rayon k. Ici, TOUT ce qui est mis à l'échelle est un pivot
//      (THREE.Group nu) ou un mesh d'étoile (R3.star, dont le scale vaut 1).
//   2. Rien n'appelle CL.tick() dans la chaîne de rendu du jeu : les gestes
//      autonomes (joues qui crépitent, oreilles qui frémissent, ronflement)
//      sont accrochés à onBeforeRender via `pilote()`, comme dans p3.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // La bibliothèque partagée si elle est là — sinon repli sur les primitives R3.
  const CL = (typeof R3.get === 'function' && R3.get('kclib')) || {};
  function has(n) { return typeof CL[n] === 'function'; }

  // ===========================================================================
  //  Petits utilitaires locaux (mêmes noms et mêmes rôles que dans p3.js)
  // ===========================================================================

  /** Un pivot (Object3D nu) posé quelque part : sert de point de rotation. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** Détail décoratif : ni ombre portée, ni ombre reçue. */
  function noSh(o) { o.castShadow = false; o.receiveShadow = false; return o; }

  /** Positionne un objet d'après o.x / o.y / o.z (convention des helpers clib). */
  function place(o, obj) { obj.position.set(o.x || 0, o.y || 0, o.z || 0); return obj; }

  /** Courbe 0 -> 1 -> 0, utilisée par presque toutes les attaques. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Petite étoile lumineuse (étincelle) qui ne fait pas d'ombre. */
  function etincelle(r, color, x, y, z) {
    return noSh(R3.star(4, r, r * 0.34, r * 0.45, color, x, y, z, {
      emissive: color, emissiveIntensity: 0.9, rough: 0.38,
    }));
  }

  /**
   * Accroche une animation par image au modèle `g` (voir p3.js).
   * Le jeu n'appelle que R3.idleCreature() et userData.attack() : c'est
   * onBeforeRender qui donne leur vie propre aux modèles.
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
      try { fn(t); } catch (e) { /* une animation ratée ne doit rien casser */ }
    };
  }

  /**
   * GRANDS YEUX RONDS ET BRILLANTS — la signature « jamais menaçant » du lot.
   * Trois meshes par œil : la bille sombre, un gros reflet et un petit.
   * o = { spread, r, y, z, color }            -> 6 meshes
   */
  function regard(o) {
    o = o || {};
    const spread = (o.spread === undefined) ? 0.09 : o.spread;
    const r = o.r || 0.05;
    const y = o.y || 0, z = (o.z === undefined) ? 0.17 : o.z;
    const col = o.color || '#241c2b';
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(noSh(R3.ellipsoid(r, r * 1.06, r * 0.72, col, s * spread, y, z, { rough: 0.35 })));
      g.add(noSh(R3.sphere(r * 0.36, '#ffffff', s * spread + r * 0.34, y + r * 0.42, z + r * 0.42)));
      g.add(noSh(R3.sphere(r * 0.17, '#ffffff', s * spread - r * 0.34, y - r * 0.34, z + r * 0.36)));
    });
    return place(o, g);
  }

  // ===========================================================================
  //  ENVELOPPES DES HELPERS `clib` — avec repli si la bibliothèque est absente.
  //  Les replis respectent l'ANCRAGE documenté par clib (centré / pivot base /
  //  posé), pour que le reste du fichier n'ait pas à savoir lequel est utilisé.
  // ===========================================================================

  function bodyBlob(o) {
    if (has('bodyBlob')) return CL.bodyBlob(o);
    o = o || {};
    const sq = (o.squash === undefined) ? 1 : o.squash;
    const rx = o.rx || 0.30, ry = (o.ry || 0.28) * sq, rz = o.rz || 0.30;
    const g = new THREE.Group();
    g.add(R3.ellipsoid(rx, ry, rz, o.color || '#ffffff', 0, 0, 0));
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
    const shape = o.shape || 'round';
    const color = o.color || '#ffffff', inCol = o.innerColor || '#ffaad8';
    const g = new THREE.Group();
    let outer, inner;
    if (shape === 'pointy') {
      outer = R3.cone(w * 0.5, h, color, 0, h * 0.5, 0, { seg: 9 });
      inner = R3.cone(w * 0.30, h * 0.66, inCol, 0, h * 0.42, w * 0.16, { seg: 9, rough: 0.9 });
    } else if (shape === 'long') {
      outer = R3.ellipsoid(w * 0.5, h * 0.5, w * 0.34, color, 0, h * 0.5, 0);
      inner = R3.ellipsoid(w * 0.28, h * 0.38, w * 0.16, inCol, 0, h * 0.50, w * 0.22);
    } else {
      outer = R3.ellipsoid(w * 0.5, h * 0.5, w * 0.30, color, 0, h * 0.5, 0);
      inner = R3.ellipsoid(w * 0.28, h * 0.30, w * 0.16, inCol, 0, h * 0.48, w * 0.20);
    }
    g.add(outer);
    if (o.inner !== false) g.add(noSh(inner));
    g.userData.outer = outer; g.userData.inner = inner;
    g.rotation.x = o.bend || 0;
    return place(o, g);
  }

  function catHead(o) {
    if (has('catHead')) return CL.catHead(o);
    o = o || {};
    const r = o.r || 0.26, color = o.color || '#ffffff';
    const g = new THREE.Group();
    g.add(R3.ellipsoid(r * 1.05, r, r * 0.98, color, 0, 0, 0));
    if (o.muzzle) {
      g.add(noSh(R3.ellipsoid(r * 0.50, r * 0.36, r * 0.42, o.muzzleColor || '#fff0c8',
        0, -r * 0.26, r * 0.72)));
    }
    if (o.nose || (o.muzzle && o.nose !== false)) {
      g.add(noSh(R3.ellipsoid(r * 0.15, r * 0.11, r * 0.11, o.noseColor || '#ff6b9d',
        0, -r * 0.14, r * 0.96)));
    }
    if (o.ears) {
      const es = (o.earSize === undefined) ? 1 : o.earSize;
      const spread = (o.earSpread === undefined) ? r * 0.62 : o.earSpread;
      [-1, 1].forEach(function (s) {
        const e = ear({
          h: r * (o.ears === 'long' ? 1.7 : 0.82) * es,
          w: r * (o.ears === 'long' ? 0.44 : 0.64) * es,
          color: o.earColor || color, innerColor: o.earInner || '#ffaad8', shape: o.ears,
        });
        e.position.set(s * spread, r * 0.60, -r * 0.06);
        e.rotation.z = -s * (o.ears === 'long' ? 0.10 : (o.ears === 'tuft' ? 0.42 : 0.26));
        g.add(e);
        if (s < 0) g.userData.earL = e; else g.userData.earR = e;
      });
    }
    if (o.eyes !== false) {
      const ey = R3.eyes(o.eyeSpread || r * 0.46, (o.eyeY === undefined ? r * 0.10 : o.eyeY),
        r * 0.88, o.eyeR || r * 0.24);
      g.add(ey); g.userData.eyes = ey;
    }
    if (o.blush !== false) g.add(R3.blush(r * 0.74, -r * 0.20, r * 0.64, r * 0.20));
    if (o.smile !== false) {
      g.add(mouthSmile({ w: r * 0.30, depth: r * 0.13, r: r * 0.07, count: 5,
        y: -r * 0.44, z: r * 0.80 }));
    }
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

  function finTail(o) {
    if (has('finTail')) return CL.finTail(o);
    o = o || {};
    const len = o.len || 0.28, h = o.height || 0.30;
    const color = o.color || '#41a6f6';
    const th = (o.thick === undefined) ? Math.max(0.012, len * 0.06) : o.thick;
    const spread = (o.spread === undefined) ? 0.35 : o.spread;
    const g = new THREE.Group();
    const lobes = [];
    g.add(R3.ellipsoid(th * 2.4, h * 0.26, len * 0.24, color, 0, 0, -len * 0.13,
      { side: THREE.DoubleSide }));
    const n = Math.max(1, o.lobes || 2);
    for (let i = 0; i < n; i++) {
      const s = (n === 1) ? 0 : ((i / (n - 1)) * 2 - 1);
      const lobe = R3.ellipsoid(th, h * 0.52, len * 0.60, color,
        0, s * h * 0.30, -len * 0.58, { side: THREE.DoubleSide });
      lobe.rotation.x = -s * spread;
      g.add(noSh(lobe));
      lobes.push(lobe);
    }
    g.userData.lobes = lobes;
    return place(o, g);
  }

  //  (glowAura et sparkleRing existent aussi dans clib, mais aucun des onze
  //   modèles de ce lot n'en a besoin : leurs étincelles sont posées une à une,
  //   pour ne pas gaspiller six meshes du budget en couronne décorative.)

  // ===========================================================================
  //  PIKACHU — « La petite souris jaune aux joues rouges. »
  //  Signature : oreilles longues à POINTE NOIRE, joues ROUGES bien rondes,
  //  deux bandes brunes dans le dos, et la QUEUE EN ÉCLAIR.
  //  Il reste petit (~0,88) : c'est un Pikachu, pas un Raichu.
  // ===========================================================================
  R3.registerCreature('pikachu', function () {
    const JAUNE = '#f8d030', CLAIR = '#ffe680', BRUN = '#a4622a';
    const NOIR = '#2b2b2b', ROUGE = '#e8342a';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    // --- Corps tout rond, ventre plus clair --------------------------------
    inner.add(bodyBlob({ rx: 0.205, ry: 0.185, rz: 0.180, color: JAUNE,
      belly: CLAIR, y: 0.255 }));

    // Les deux bandes brunes du dos : elles se voient de dos ET de trois quarts.
    inner.add(noSh(R3.ellipsoid(0.135, 0.030, 0.045, BRUN, 0, 0.320, -0.150)));
    inner.add(noSh(R3.ellipsoid(0.115, 0.026, 0.040, BRUN, 0, 0.235, -0.155)));

    // --- Pieds et petits bras -----------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(paw({ r: 0.082, color: JAUNE, squash: 0.55, stretch: 1.30,
        x: s * 0.115, y: 0.052, z: 0.045 }));
      const bras = R3.ellipsoid(0.048, 0.085, 0.055, JAUNE, s * 0.195, 0.245, 0.030);
      bras.rotation.z = -s * 0.30;
      inner.add(bras);
    });

    // --- La queue en éclair : trois éclats qui montent en zigzag ------------
    //  Anguleuse EXPRÈS : c'est la seule pièce du lot qui a le droit de l'être,
    //  parce que c'est elle qui fait dire « Pikachu ! » à trois mètres.
    //  Elle est portée par un pivot EXTÉRIEUR incliné : R3.idleCreature() écrit
    //  dans `tail.rotation.y` à chaque image et effacerait un lacet posé ici.
    //  Grâce à ce pivot, l'éclair reste tourné de trois quarts — donc visible
    //  de face, là où une queue strictement arrière disparaîtrait derrière le dos.
    const socleQueue = pivot(0, 0.230, -0.130);
    socleQueue.rotation.y = 0.42;
    const queue = pivot(0, 0, 0);
    socleQueue.add(queue);
    queue.add(noSh(R3.ellipsoid(0.042, 0.050, 0.038, BRUN, 0, 0.020, -0.020)));
    const z1 = R3.box(0.130, 0.080, 0.052, JAUNE, 0.045, 0.110, -0.020);
    z1.rotation.z = 0.55;
    const z2 = R3.box(0.175, 0.085, 0.052, JAUNE, -0.030, 0.235, -0.020);
    z2.rotation.z = -0.50;
    const z3 = R3.box(0.215, 0.115, 0.052, JAUNE, 0.080, 0.370, -0.020);
    z3.rotation.z = 0.40;
    queue.add(z1, z2, z3);
    inner.add(socleQueue);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.505, 0.020);
    tete.add(R3.ellipsoid(0.200, 0.180, 0.185, JAUNE, 0, 0, 0));
    tete.add(regard({ spread: 0.090, r: 0.048, y: 0.030, z: 0.150 }));
    tete.add(noSh(R3.ellipsoid(0.018, 0.014, 0.014, NOIR, 0, -0.030, 0.190)));
    tete.add(mouthSmile({ w: 0.062, depth: 0.032, r: 0.017, count: 3, y: -0.086, z: 0.163 }));

    // Les joues rouges : chacune dans son pivot, pour pouvoir crépiter sans
    // que le mise à l'échelle n'écrase les rayons de l'ellipsoïde (piège n° 1).
    const joues = [];
    [-1, 1].forEach(function (s) {
      const p = pivot(s * 0.150, -0.030, 0.120);
      p.add(noSh(R3.ellipsoid(0.055, 0.050, 0.032, ROUGE, 0, 0, 0,
        { emissive: ROUGE, emissiveIntensity: 0.25, rough: 0.6 })));
      tete.add(p);
      joues.push(p);
    });

    // Les oreilles : LARGES et dressées, à grosse POINTE NOIRE. Étroites,
    // elles ressemblaient à des antennes ; c'est la largeur qui fait Pikachu.
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = pivot(s * 0.100, 0.118, -0.020);
      o.userData.z0 = -s * 0.40;
      o.rotation.z = o.userData.z0;
      o.rotation.x = -0.14;
      o.add(R3.ellipsoid(0.064, 0.150, 0.044, JAUNE, 0, 0.140, 0));
      o.add(noSh(R3.ellipsoid(0.062, 0.066, 0.044, NOIR, 0, 0.252, 0)));
      tete.add(o);
      oreilles.push(o);
    });
    inner.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : les joues crépitent, les oreilles frémissent ----------
    let boost = 0;
    pilote(g, function (t) {
      const cyc = (t % 2.6) / 2.6;
      const crepite = (cyc < 0.18) ? Math.abs(Math.sin(cyc / 0.18 * Math.PI * 3)) : 0;
      const k = 1 + crepite * 0.16 + boost * 0.30;
      joues[0].scale.setScalar(k);
      joues[1].scale.setScalar(k);
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        const o = oreilles[i];
        o.rotation.z = o.userData.z0 - s * (Math.sin(t * 2.1 + i * 0.7) * 0.05 + crepite * 0.14);
        o.rotation.x = -0.10 + Math.sin(t * 1.6 + i * 0.9) * 0.05 - boost * 0.35;
      }
      queue.rotation.z = Math.sin(t * 1.8) * 0.10 + boost * 0.25;
    });

    // --- Attaque « Éclair ! » : il bondit, la queue fouette, les joues brillent
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.22;
      inner.position.z = k * 0.32;
      inner.rotation.x = -k * 0.14;
      tete.rotation.x = k * 0.16;
      queue.rotation.x = -k * 0.55;
    };
    return g;
  });

  // ===========================================================================
  //  RAICHU — « Plus grand, plus orange, avec une longue queue en éclair. »
  //  Signature : grandes oreilles ouvertes à l'intérieur sombre, ventre crème,
  //  joues JAUNES (et non rouges), longue queue fine terminée par un éclair.
  // ===========================================================================
  R3.registerCreature('raichu', function () {
    const ORANGE = '#f39c12', CREME = '#f7e2b8', BRUN = '#8b5a2b';
    const JAUNE = '#f8d030', NOIR = '#2b2b2b';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    inner.add(bodyBlob({ rx: 0.235, ry: 0.230, rz: 0.205, color: ORANGE,
      belly: CREME, y: 0.315 }));

    [-1, 1].forEach(function (s) {
      inner.add(paw({ r: 0.098, color: CREME, squash: 0.52, stretch: 1.35,
        x: s * 0.135, y: 0.058, z: 0.055 }));
      const bras = R3.ellipsoid(0.055, 0.100, 0.062, ORANGE, s * 0.225, 0.305, 0.030);
      bras.rotation.z = -s * 0.32;
      inner.add(bras);
    });

    // --- La longue queue fine, terminée par un éclair -----------------------
    //  Même astuce que Pikachu : un socle incliné, car idleCreature() écrase
    //  `tail.rotation.y`. Sans lui, l'éclair reste caché derrière le dos.
    const socleQueue = pivot(0, 0.300, -0.175);
    socleQueue.rotation.y = 0.55;
    const queue = pivot(0, 0, 0);
    socleQueue.add(queue);
    //  ATTENTION AU SIGNE : une rotation.x POSITIVE bascule la queue vers +z,
    //  c'est-à-dire vers l'AVANT — elle disparaît alors dans le corps. Toutes
    //  les queues de ce fichier partent donc en rotation.x NÉGATIVE.
    const q1 = pivot(0, 0, 0);
    q1.rotation.x = -0.70;
    q1.add(R3.cyl(0.022, 0.032, 0.26, BRUN, 0, 0.130, 0, { seg: 8 }));
    const q2 = pivot(0, 0.260, 0);
    q2.rotation.x = 1.10;
    q2.add(R3.cyl(0.018, 0.024, 0.24, BRUN, 0, 0.120, 0, { seg: 8 }));
    const eclair = R3.box(0.190, 0.090, 0.040, ORANGE, 0.045, 0.275, 0);
    eclair.rotation.z = 0.42;
    const eclair2 = R3.box(0.130, 0.070, 0.040, ORANGE, -0.055, 0.215, 0);
    eclair2.rotation.z = -0.45;
    q2.add(eclair, eclair2);
    q1.add(q2); queue.add(q1);
    inner.add(socleQueue);

    // --- Tête ---------------------------------------------------------------
    const tete = pivot(0, 0.655, 0.020);
    tete.add(R3.ellipsoid(0.215, 0.195, 0.200, ORANGE, 0, 0, 0));
    tete.add(noSh(R3.ellipsoid(0.095, 0.062, 0.070, CREME, 0, -0.075, 0.160)));
    tete.add(regard({ spread: 0.098, r: 0.050, y: 0.038, z: 0.160 }));
    tete.add(noSh(R3.ellipsoid(0.020, 0.016, 0.016, NOIR, 0, -0.048, 0.212)));
    tete.add(mouthSmile({ w: 0.055, depth: 0.028, r: 0.015, count: 3, y: -0.105, z: 0.180 }));

    const joues = [];
    [-1, 1].forEach(function (s) {
      const p = pivot(s * 0.165, -0.030, 0.125);
      p.add(noSh(R3.ellipsoid(0.056, 0.050, 0.032, JAUNE, 0, 0, 0,
        { emissive: JAUNE, emissiveIntensity: 0.30, rough: 0.55 })));
      tete.add(p);
      joues.push(p);
    });

    // Grandes oreilles évasées, intérieur brun sombre.
    const oreilles = [];
    [-1, 1].forEach(function (s) {
      const o = pivot(s * 0.120, 0.150, -0.030);
      o.userData.z0 = -s * 0.42;
      o.rotation.z = o.userData.z0;
      o.rotation.x = -0.12;
      o.add(R3.ellipsoid(0.058, 0.160, 0.045, ORANGE, 0, 0.155, 0));
      o.add(noSh(R3.ellipsoid(0.040, 0.105, 0.030, BRUN, 0, 0.200, 0.022)));
      tete.add(o);
      oreilles.push(o);
    });
    inner.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    let boost = 0;
    pilote(g, function (t) {
      const cyc = (t % 3.0) / 3.0;
      const crepite = (cyc < 0.15) ? Math.abs(Math.sin(cyc / 0.15 * Math.PI * 3)) : 0;
      const k = 1 + crepite * 0.14 + boost * 0.28;
      joues[0].scale.setScalar(k); joues[1].scale.setScalar(k);
      for (let i = 0; i < 2; i++) {
        const s = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - s * Math.sin(t * 1.9 + i * 0.8) * 0.06;
      }
      q2.rotation.x = 1.10 + Math.sin(t * 1.5) * 0.16 + boost * 0.35;
    });

    // --- Attaque « Tonnerre » : il se dresse et lance sa queue en avant -----
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      inner.position.y = k * 0.20;
      inner.position.z = k * 0.26;
      inner.rotation.x = -k * 0.18;
      queue.rotation.x = -k * 0.70;
      tete.rotation.x = k * 0.20;
    };
    return g;
  });

  // ===========================================================================
  //  LA FAMILLE ÉVOLI — un socle commun, quatre matières.
  //  ---------------------------------------------------------------------
  //  Évoli, Aquali, Pyroli et Voltali doivent se lire comme « la même créature
  //  devenue autre chose » : MÊME CARRURE (petit quadrupède dodu), MÊME MUSEAU,
  //  MÊMES GRANDS YEUX. Seules changent la couleur et la matière — collerette
  //  duveteuse, nageoires lisses, crinière touffue, piquants hérissés.
  //  Le socle coûte 18 meshes ; il reste donc 22 pour la personnalité.
  // ===========================================================================
  function socleEvoli(o) {
    const s = {};
    const inner = pivot(0, 0, 0);
    s.inner = inner;

    // Corps dodu, un peu allongé, ventre plus clair.
    const corps = pivot(0, 0.355, 0);
    corps.add(bodyBlob({ rx: 0.195, ry: 0.175, rz: 0.255, color: o.color,
      belly: o.belly }));
    inner.add(corps);
    s.corps = corps;

    // Quatre pattes courtes (avant et arrière), les pieds posés sur y = 0.
    s.pattes = [];
    [-1, 1].forEach(function (sx) {
      [0.160, -0.150].forEach(function (dz, i) {
        const h = pivot(sx * 0.125, 0.200, dz);
        h.userData.ph = i * 1.6 + (sx > 0 ? 0.8 : 0);
        h.add(R3.ellipsoid(0.054, 0.108, 0.060, o.legColor || o.color, 0, -0.098, 0));
        inner.add(h);
        s.pattes.push(h);
      });
    });

    // Tête ronde de bébé renard, portée en avant.
    const tete = pivot(0, 0.585, 0.135);
    tete.add(R3.ellipsoid(0.175, 0.165, 0.170, o.color, 0, 0, 0));
    tete.add(noSh(R3.ellipsoid(0.080, 0.058, 0.078, o.muzzle || o.belly,
      0, -0.058, 0.132)));
    tete.add(noSh(R3.ellipsoid(0.026, 0.020, 0.020, o.nose || '#3d2b26',
      0, -0.030, 0.202)));
    tete.add(mouthSmile({ w: 0.046, depth: 0.024, r: 0.013, count: 3,
      y: -0.100, z: 0.168 }));
    tete.add(regard({ spread: 0.086, r: 0.050, y: 0.030, z: 0.148,
      color: o.eye || '#241c2b' }));
    inner.add(tete);
    s.tete = tete;

    return s;
  }

  // ===========================================================================
  //  ÉVOLI — « Une petite boule de poils avec une grande collerette. »
  //  Signature : la COLLERETTE CRÈME qui lui mange le cou, la queue touffue à
  //  bout crème, et de très grands yeux. C'est l'une des deux stars du lot.
  // ===========================================================================
  R3.registerCreature('evoli', function () {
    const BRUN = '#d4a373', CREME = '#f5e3c4', FONCE = '#b98a5e';
    const g = R3.group();
    const s = socleEvoli({ color: BRUN, belly: CREME, muzzle: CREME, legColor: FONCE });
    const inner = s.inner, tete = s.tete;
    g.add(inner);

    // --- La grande collerette crème : six touffes serrées autour du cou -----
    const collerette = pivot(0, 0.495, 0.045);
    const touffes = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.12 + (i / 5) * Math.PI * 1.24;   // de gauche à droite
      const p = pivot(Math.cos(a) * 0.185, Math.sin(a) * 0.135, 0.010);
      p.userData.ph = i * 1.05;
      p.add(noSh(R3.ellipsoid(0.098, 0.092, 0.085, CREME, 0, 0, 0, { rough: 0.95 })));
      collerette.add(p);
      touffes.push(p);
    }
    inner.add(collerette);

    // --- La mèche crème sur le front ---------------------------------------
    tete.add(noSh(R3.ellipsoid(0.070, 0.055, 0.060, CREME, 0, 0.135, 0.075)));
    tete.add(noSh(R3.ellipsoid(0.048, 0.040, 0.045, CREME, -0.055, 0.150, 0.035)));
    tete.add(R3.blush(0.130, -0.055, 0.128, 0.042));

    // --- Les grandes oreilles TRIANGULAIRES, intérieur crème ---------------
    //  En ovale elles faisaient un lapin ; c'est la pointe qui fait Évoli.
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.110, 0.115, -0.020);
      o.userData.z0 = -sx * 0.34;
      o.rotation.z = o.userData.z0;
      o.rotation.x = -0.12;
      o.add(R3.cone(0.072, 0.235, BRUN, 0, 0.118, 0, { seg: 10 }));
      o.add(noSh(R3.cone(0.042, 0.145, CREME, 0, 0.110, 0.024, { seg: 9 })));
      tete.add(o);
      oreilles.push(o);
    });

    // --- La queue touffue, relevée en arrière, à gros bout crème -----------
    //  rotation.x NÉGATIVE : positive, la queue basculerait vers l'avant et
    //  irait se coucher sur le dos (piège vérifié en vue de profil).
    const queue = pivot(0, 0.360, -0.235);
    queue.rotation.x = -0.40;
    queue.add(R3.ellipsoid(0.078, 0.078, 0.095, BRUN, 0, 0.070, 0));
    queue.add(R3.ellipsoid(0.098, 0.098, 0.105, BRUN, 0, 0.180, 0.010));
    queue.add(R3.ellipsoid(0.105, 0.105, 0.100, CREME, 0, 0.290, 0.020));
    inner.add(queue);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : la collerette respire, les oreilles pivotent ---------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < touffes.length; i++) {
        touffes[i].scale.setScalar(1 + Math.sin(t * 1.9 + touffes[i].userData.ph) * 0.055
          + boost * 0.14);
      }
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - sx * Math.sin(t * 2.2 + i) * 0.07;
        oreilles[i].rotation.x = -0.14 + Math.sin(t * 1.7 + i * 1.3) * 0.06 - boost * 0.30;
      }
      queue.rotation.z = Math.sin(t * 2.4) * 0.14;
    });

    // --- Attaque « Charge douce » : elle trottine et saute dans tes bras ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.z = k * 0.40;
      inner.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.16;
      inner.rotation.x = -k * 0.20;
      tete.rotation.x = k * 0.22;
      queue.rotation.x = -0.40 - k * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  AQUALI — « Évoli devenue créature des eaux. »
  //  Même carrure, même museau, mêmes yeux — mais TOUT est lisse : nageoires à
  //  la place des oreilles, crête qui court de la tête au dos, collerette de
  //  membranes et queue de sirène.
  // ===========================================================================
  R3.registerCreature('aquali', function () {
    const BLEU = '#41a6f6', PALE = '#dff1ff', SOMBRE = '#2b7fd4';
    const g = R3.group();
    const s = socleEvoli({ color: BLEU, belly: PALE, muzzle: PALE,
      nose: '#2b4a6b', legColor: SOMBRE });
    const inner = s.inner, tete = s.tete;
    g.add(inner);

    // --- Crête : une seule membrane continue, de la tête au milieu du dos ---
    const crete = [];
    [[0.150, 0.735, 0.070, 0.110, 0.075],
     [0.014, 0.640, -0.055, 0.130, 0.115],
     [0.014, 0.545, -0.185, 0.095, 0.100]].forEach(function (v, i) {
      const p = pivot(0, v[1], v[2]);
      p.userData.ph = i * 1.2;
      p.add(noSh(R3.ellipsoid(i === 0 ? 0.016 : v[0], v[3], v[4], PALE, 0, 0, 0,
        { side: THREE.DoubleSide, rough: 0.4 })));
      inner.add(p);
      crete.push(p);
    });

    // --- Collerette de membranes autour du cou (trois voiles lisses) -------
    const voiles = [];
    [-1, 1].forEach(function (sx) {
      const p = pivot(sx * 0.175, 0.475, 0.050);
      p.rotation.z = -sx * 0.55;
      p.add(noSh(R3.ellipsoid(0.100, 0.020, 0.115, PALE, 0, 0, 0,
        { side: THREE.DoubleSide, rough: 0.4 })));
      inner.add(p);
      voiles.push(p);
    });
    const gorge = pivot(0, 0.415, 0.155);
    gorge.add(noSh(R3.ellipsoid(0.115, 0.028, 0.085, PALE, 0, 0, 0,
      { side: THREE.DoubleSide, rough: 0.4 })));
    inner.add(gorge);
    voiles.push(gorge);

    // --- « Oreilles » = deux nageoires plates, dressées --------------------
    const nageoires = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.105, 0.120, -0.020);
      o.userData.z0 = -sx * 0.30;
      o.rotation.z = o.userData.z0;
      o.add(R3.ellipsoid(0.014, 0.125, 0.080, BLEU, 0, 0.120, 0,
        { side: THREE.DoubleSide }));
      o.add(noSh(R3.ellipsoid(0.010, 0.080, 0.050, PALE, 0, 0.135, 0.012,
        { side: THREE.DoubleSide })));
      tete.add(o);
      nageoires.push(o);
    });

    // --- La queue de sirène ------------------------------------------------
    const queue = pivot(0, 0.340, -0.245);
    queue.add(finTail({ len: 0.30, height: 0.30, color: BLEU, lobes: 2, spread: 0.45 }));
    inner.add(queue);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : tout ondule, comme sous l'eau -------------------------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < crete.length; i++) {
        crete[i].rotation.z = Math.sin(t * 1.8 + crete[i].userData.ph) * 0.10;
        crete[i].scale.setScalar(1 + Math.sin(t * 1.4 + crete[i].userData.ph) * 0.05 + boost * 0.10);
      }
      for (let i = 0; i < voiles.length; i++) {
        voiles[i].rotation.x = Math.sin(t * 1.6 + i * 1.4) * 0.16;
      }
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        nageoires[i].rotation.z = nageoires[i].userData.z0 - sx * Math.sin(t * 1.5 + i) * 0.10;
      }
      queue.rotation.z = Math.sin(t * 2.0) * 0.18;
    });

    // --- Attaque « Surf tout doux » : elle ondule et glisse en avant --------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.z = k * 0.42;
      inner.position.y = Math.sin(t * Math.PI * 2) * 0.10;
      inner.rotation.x = Math.sin(t * Math.PI * 2) * 0.18;
      queue.rotation.x = Math.sin(t * Math.PI * 4) * 0.35;
      tete.rotation.x = k * 0.14;
    };
    return g;
  });

  // ===========================================================================
  //  PYROLI — « Évoli devenue créature de feu. »
  //  Même carrure — mais noyée dans une CRINIÈRE crème touffue et chaude, du
  //  front jusqu'à la queue.
  // ===========================================================================
  R3.registerCreature('pyroli', function () {
    const ROUGE = '#e2622a', CRIN = '#f9dfa8', SOMBRE = '#c04a1c';
    const g = R3.group();
    const s = socleEvoli({ color: ROUGE, belly: CRIN, muzzle: CRIN,
      nose: '#5c2e0d', legColor: SOMBRE });
    const inner = s.inner, tete = s.tete;
    g.add(inner);

    // --- La crinière : six grosses touffes chaudes autour des épaules ------
    const crin = pivot(0, 0.500, 0.030);
    const touffes = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.10 + (i / 5) * Math.PI * 1.20;
      const p = pivot(Math.cos(a) * 0.200, Math.sin(a) * 0.150, 0.005);
      p.userData.ph = i * 0.95;
      p.add(noSh(R3.ellipsoid(0.110, 0.100, 0.092, CRIN, 0, 0, 0, { rough: 0.98 })));
      crin.add(p);
      touffes.push(p);
    }
    inner.add(crin);

    // --- La houppe du front, qui retombe entre les oreilles -----------------
    const houppe = pivot(0, 0.140, 0.060);
    houppe.add(noSh(R3.ellipsoid(0.090, 0.075, 0.078, CRIN, 0, 0, 0, { rough: 0.98 })));
    houppe.add(noSh(R3.ellipsoid(0.055, 0.050, 0.050, CRIN, 0.045, 0.060, -0.045)));
    tete.add(houppe);

    // --- Oreilles pointues -------------------------------------------------
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.112, 0.115, -0.030);
      o.userData.z0 = -sx * 0.30;
      o.rotation.z = o.userData.z0;
      o.rotation.x = -0.10;
      o.add(R3.cone(0.058, 0.190, ROUGE, 0, 0.095, 0, { seg: 10 }));
      o.add(noSh(R3.cone(0.034, 0.120, CRIN, 0, 0.090, 0.020, { seg: 9 })));
      tete.add(o);
      oreilles.push(o);
    });

    // --- Queue touffue crème -----------------------------------------------
    const queue = pivot(0, 0.370, -0.235);
    queue.rotation.x = -0.32;
    queue.add(R3.ellipsoid(0.085, 0.085, 0.100, CRIN, 0, 0.075, 0));
    queue.add(R3.ellipsoid(0.105, 0.105, 0.110, CRIN, 0, 0.190, 0.010));
    queue.add(R3.ellipsoid(0.092, 0.092, 0.092, CRIN, 0, 0.300, 0.025));
    inner.add(queue);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : la crinière ondoie comme une flamme paresseuse -------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < touffes.length; i++) {
        const p = touffes[i];
        p.scale.setScalar(1 + Math.sin(t * 2.3 + p.userData.ph) * 0.07 + boost * 0.20);
        p.rotation.z = Math.sin(t * 1.5 + p.userData.ph) * 0.08;
      }
      houppe.rotation.x = Math.sin(t * 1.9) * 0.10 - boost * 0.20;
      queue.rotation.z = Math.sin(t * 2.1) * 0.15;
      for (let i = 0; i < 2; i++) {
        oreilles[i].rotation.x = -0.10 + Math.sin(t * 1.6 + i) * 0.05;
      }
    });

    // --- Attaque « Lance-Flammes » : elle se cabre, la crinière gonfle ------
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      inner.position.z = k * 0.30;
      inner.position.y = k * 0.14;
      inner.rotation.x = -k * 0.26;
      tete.rotation.x = k * 0.24;
      queue.rotation.x = -0.32 - k * 0.30;
    };
    return g;
  });

  // ===========================================================================
  //  VOLTALI — « Évoli devenue créature d'électricité. »
  //  Même carrure — mais TOUT est hérissé : collerette de piquants, crête
  //  dorsale anguleuse, très grandes oreilles droites, queue en pointe.
  // ===========================================================================
  R3.registerCreature('voltali', function () {
    const JAUNE = '#fde74c', PIQUANT = '#fff7c8', SOMBRE = '#e0c22a';
    const g = R3.group();
    const s = socleEvoli({ color: JAUNE, belly: PIQUANT, muzzle: PIQUANT,
      nose: '#4a3a10', legColor: SOMBRE });
    const inner = s.inner, tete = s.tete;
    g.add(inner);

    // --- La collerette de piquants (six pointes crème tournées vers dehors) -
    const collier = pivot(0, 0.480, 0.040);
    const piquants = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.08 + (i / 5) * Math.PI * 1.16;
      const p = pivot(Math.cos(a) * 0.150, Math.sin(a) * 0.110, 0);
      p.rotation.z = a - Math.PI / 2;
      p.userData.ph = i * 0.8;
      p.add(noSh(R3.cone(0.052, 0.180, PIQUANT, 0, 0.090, 0, { seg: 8, flat: true })));
      collier.add(p);
      piquants.push(p);
    }
    inner.add(collier);

    // --- Trois pointes sur le dos ------------------------------------------
    const dos = [];
    [[0.640, 0.010, 0.075], [0.560, -0.130, 0.062], [0.500, -0.230, 0.050]]
      .forEach(function (v, i) {
        const p = pivot(0, v[0], v[1]);
        p.rotation.x = 0.55 + i * 0.20;
        p.userData.ph = i * 1.1;
        p.add(noSh(R3.cone(v[2], v[2] * 2.6, PIQUANT, 0, v[2] * 1.3, 0, { seg: 8, flat: true })));
        inner.add(p);
        dos.push(p);
      });

    // --- Très grandes oreilles droites, presque des paratonnerres ----------
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.100, 0.125, -0.025);
      o.userData.z0 = -sx * 0.20;
      o.rotation.z = o.userData.z0;
      o.add(R3.cone(0.062, 0.270, JAUNE, 0, 0.135, 0, { seg: 10 }));
      o.add(noSh(R3.cone(0.036, 0.170, PIQUANT, 0, 0.125, 0.020, { seg: 9 })));
      tete.add(o);
      oreilles.push(o);
    });

    // --- Queue courte et pointue -------------------------------------------
    const queue = pivot(0, 0.355, -0.240);
    queue.rotation.x = -0.70;
    queue.add(R3.cone(0.085, 0.240, PIQUANT, 0, 0.120, 0, { seg: 9 }));
    queue.add(noSh(R3.ellipsoid(0.070, 0.055, 0.070, JAUNE, 0, 0.010, 0)));
    inner.add(queue);

    // --- Deux étincelles qui crépitent au bout des oreilles ----------------
    const etincelles = [
      etincelle(0.048, '#ffffff', -0.135, 0.985, -0.020),
      etincelle(0.042, JAUNE, 0.150, 0.955, -0.010),
    ];
    etincelles.forEach(function (e) { inner.add(e); });

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : les poils se dressent par vagues, ça crépite ---------
    let boost = 0;
    pilote(g, function (t) {
      const vague = 0.5 + 0.5 * Math.sin(t * 3.0);
      for (let i = 0; i < piquants.length; i++) {
        piquants[i].scale.setScalar(1 + Math.sin(t * 4.0 + piquants[i].userData.ph) * 0.10
          + boost * 0.30);
      }
      for (let i = 0; i < dos.length; i++) {
        dos[i].rotation.x = (0.55 + i * 0.20) - vague * 0.14 - boost * 0.25;
      }
      for (let i = 0; i < etincelles.length; i++) {
        const e = etincelles[i];
        e.rotation.z = t * 2.2 + i;
        e.scale.setScalar((0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 5.0 + i * 2.4)))
          * (1 + boost * 0.9));
      }
      for (let i = 0; i < 2; i++) {
        oreilles[i].rotation.x = Math.sin(t * 2.6 + i * 1.2) * 0.05 - boost * 0.20;
      }
    });

    // --- Attaque « Tonnerre » : elle se ramasse puis se détend d'un coup ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.z = k * 0.38;
      inner.position.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.14;
      inner.rotation.x = -k * 0.20;
      tete.rotation.x = k * 0.18;
    };
    return g;
  });

  // ===========================================================================
  //  RONDOUDOU — « Un ballon rose qui chante. »
  //  Signature : une BOULE, la MÈCHE bouclée sur le front, de petites oreilles
  //  pointues et d'immenses yeux clairs. Tout doit être rond.
  // ===========================================================================
  R3.registerCreature('rondoudou', function () {
    const ROSE = '#ffaad8', FONCE = '#e07aa8', BLEU = '#2f6fbf';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    // Le ballon entier vit dans un pivot : c'est LUI qu'on gonfle (jamais le
    // mesh, dont le `scale` porte déjà les rayons de l'ellipsoïde).
    const ballon = pivot(0, 0.340, 0);
    inner.add(ballon);
    ballon.add(R3.ellipsoid(0.320, 0.310, 0.300, ROSE, 0, 0, 0));

    // --- Petits pieds et petits bras ---------------------------------------
    [-1, 1].forEach(function (sx) {
      inner.add(paw({ r: 0.090, color: ROSE, squash: 0.55, stretch: 1.25,
        x: sx * 0.125, y: 0.050, z: 0.070 }));
      const bras = R3.ellipsoid(0.052, 0.075, 0.060, ROSE, sx * 0.300, 0.300, 0.040);
      bras.rotation.z = -sx * 0.45;
      ballon.add(bras);
    });

    // --- Visage : d'immenses yeux, un sourire, deux joues -------------------
    ballon.add(bigEyes({ spread: 0.115, r: 0.082, pupilR: 0.046,
      pupilColor: BLEU, y: 0.045, z: 0.250 }));
    ballon.add(mouthSmile({ w: 0.055, depth: 0.030, r: 0.016, count: 3,
      y: -0.085, z: 0.288 }));
    ballon.add(R3.blush(0.205, -0.055, 0.230, 0.052));

    // --- Les petites oreilles pointues, dressées en oblique -----------------
    //  Couchées à l'horizontale (0,85 rad) elles ressemblaient à des ailes.
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.170, 0.235, -0.075);
      o.userData.z0 = -sx * 0.48;
      o.rotation.z = o.userData.z0;
      o.add(R3.cone(0.062, 0.170, ROSE, 0, 0.085, 0, { seg: 9 }));
      o.add(noSh(R3.cone(0.036, 0.105, FONCE, 0, 0.080, 0.020, { seg: 8 })));
      ballon.add(o);
      oreilles.push(o);
    });

    // --- LA MÈCHE : la boucle sur le front ---------------------------------
    //  C'est LE détail qui distingue Rondoudou d'une simple boule rose : elle
    //  doit se voir de face, donc elle part du haut du front et s'enroule.
    const meche = pivot(0, 0.275, 0.145);
    meche.add(R3.ellipsoid(0.088, 0.072, 0.080, ROSE, -0.025, 0.055, 0));
    meche.add(R3.ellipsoid(0.072, 0.060, 0.066, ROSE, -0.110, 0.115, 0.010));
    meche.add(R3.ellipsoid(0.055, 0.048, 0.052, ROSE, -0.170, 0.065, 0.015));
    ballon.add(meche);

    // --- Deux petites notes de musique (étincelles roses) ------------------
    const notes = [
      etincelle(0.042, '#ffe1f0', -0.360, 0.720, 0.130),
      etincelle(0.036, '#ffffff', 0.375, 0.660, 0.090),
    ];
    notes.forEach(function (n) { inner.add(n); });

    g.userData.anim = { head: ballon };

    // --- Vie propre : elle respire comme un ballon, la mèche se balance ----
    let boost = 0;
    pilote(g, function (t) {
      const souffle = 1 + Math.sin(t * 1.5) * 0.035 + boost * 0.11;
      ballon.scale.set(souffle, 1 / Math.sqrt(souffle), souffle);
      meche.rotation.z = Math.sin(t * 1.8) * 0.16;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - sx * Math.sin(t * 1.4 + i) * 0.08;
      }
      for (let i = 0; i < notes.length; i++) {
        notes[i].rotation.z = t * 1.3 + i;
        notes[i].position.y = (i === 0 ? 0.720 : 0.660) + Math.sin(t * 1.7 + i * 2) * 0.05;
        notes[i].scale.setScalar((0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.6 + i * 2.2)))
          * (1 + boost * 0.8));
      }
    });

    // --- Attaque « Berceuse » : elle se gonfle et se balance en chantant ----
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.y = k * 0.18;
      inner.position.z = k * 0.16;
      inner.rotation.z = Math.sin(t * Math.PI * 3) * 0.14;
    };
    return g;
  });

  // ===========================================================================
  //  GRODOUDOU — « Le grand ballon rose. »
  //  Le même ballon en plus grand, avec de longues oreilles, un gros ventre
  //  clair et la même mèche bouclée. ~1,05 unité.
  // ===========================================================================
  R3.registerCreature('grodoudou', function () {
    const ROSE = '#ff6b9d', PALE = '#ffd6e4', FONCE = '#c8437a', BLEU = '#2f6fbf';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    const ballon = pivot(0, 0.430, 0);
    inner.add(ballon);
    ballon.add(R3.ellipsoid(0.375, 0.370, 0.350, ROSE, 0, 0, 0));
    ballon.add(noSh(R3.ellipsoid(0.240, 0.250, 0.220, PALE, 0, -0.070, 0.215)));

    [-1, 1].forEach(function (sx) {
      inner.add(paw({ r: 0.105, color: ROSE, squash: 0.52, stretch: 1.25,
        x: sx * 0.150, y: 0.055, z: 0.075 }));
      const bras = R3.ellipsoid(0.060, 0.090, 0.068, ROSE, sx * 0.350, 0.380, 0.040);
      bras.rotation.z = -sx * 0.42;
      ballon.add(bras);
    });

    ballon.add(bigEyes({ spread: 0.130, r: 0.090, pupilR: 0.050,
      pupilColor: BLEU, y: 0.070, z: 0.300 }));
    ballon.add(mouthSmile({ w: 0.062, depth: 0.032, r: 0.017, count: 3,
      y: -0.070, z: 0.335 }));
    ballon.add(R3.blush(0.235, -0.035, 0.278, 0.056));

    // Longues oreilles dressées, intérieur plus soutenu.
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.165, 0.285, -0.060);
      o.userData.z0 = -sx * 0.30;
      o.rotation.z = o.userData.z0;
      o.add(R3.ellipsoid(0.062, 0.185, 0.052, ROSE, 0, 0.175, 0));
      o.add(noSh(R3.ellipsoid(0.038, 0.120, 0.032, FONCE, 0, 0.185, 0.028)));
      ballon.add(o);
      oreilles.push(o);
    });

    const meche = pivot(0, 0.335, 0.190);
    meche.add(R3.ellipsoid(0.095, 0.078, 0.086, ROSE, -0.030, 0.058, 0));
    meche.add(R3.ellipsoid(0.078, 0.064, 0.070, ROSE, -0.125, 0.125, 0.010));
    meche.add(R3.ellipsoid(0.060, 0.052, 0.056, ROSE, -0.190, 0.070, 0.015));
    ballon.add(meche);

    g.userData.anim = { head: ballon };

    let boost = 0;
    pilote(g, function (t) {
      const souffle = 1 + Math.sin(t * 1.3) * 0.030 + boost * 0.10;
      ballon.scale.set(souffle, 1 / Math.sqrt(souffle), souffle);
      meche.rotation.z = Math.sin(t * 1.6) * 0.14;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - sx * Math.sin(t * 1.5 + i) * 0.07;
        oreilles[i].rotation.x = Math.sin(t * 1.1 + i * 1.4) * 0.05 - boost * 0.18;
      }
    });

    // --- Attaque « Voix enjôleuse » : un grand tour sur lui-même, tout doux -
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.y = k * 0.20;
      inner.position.z = k * 0.20;
      ballon.rotation.y = Math.sin(t * Math.PI * 2) * 0.55;
      inner.rotation.z = Math.sin(t * Math.PI * 3) * 0.10;
    };
    return g;
  });

  // ===========================================================================
  //  MIAOUSS — « Un chat malin avec une pièce d'or sur le front. »
  //  Signature : LA PIÈCE D'OR, les oreilles à bout sombre, les moustaches et
  //  la queue en S à bout brun. Il reste petit (~0,88).
  // ===========================================================================
  R3.registerCreature('miaouss', function () {
    const CREME = '#fcd8a0', PALE = '#fff2d8', BRUN = '#a4622a';
    const OR = '#f1c40f', OR2 = '#e0a80c', SOMBRE = '#6b4a2b';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    inner.add(bodyBlob({ rx: 0.190, ry: 0.180, rz: 0.170, color: CREME,
      belly: PALE, y: 0.250 }));

    [-1, 1].forEach(function (sx) {
      inner.add(paw({ r: 0.085, color: CREME, squash: 0.55, stretch: 1.25,
        x: sx * 0.110, y: 0.050, z: 0.050 }));
      const bras = R3.ellipsoid(0.046, 0.080, 0.052, CREME, sx * 0.185, 0.240, 0.035);
      bras.rotation.z = -sx * 0.35;
      inner.add(bras);
    });

    // --- La queue en S, à bout brun ----------------------------------------
    //  La queue part vers l'ARRIÈRE (rotation.x négative), monte, puis recourbe
    //  vers l'avant : c'est le S du chat.
    const queue = pivot(0, 0.270, -0.150);
    queue.rotation.x = -0.55;
    const q1 = pivot(0, 0, 0);
    q1.add(R3.cyl(0.026, 0.032, 0.140, CREME, 0, 0.070, 0, { seg: 8 }));
    const q2 = pivot(0, 0.140, 0);
    q2.rotation.x = 0.85;
    q2.add(R3.cyl(0.022, 0.026, 0.140, CREME, 0, 0.070, 0, { seg: 8 }));
    const q3 = pivot(0, 0.140, 0);
    q3.rotation.x = 0.70;
    q3.add(R3.ellipsoid(0.038, 0.052, 0.038, BRUN, 0, 0.045, 0));
    q2.add(q3); q1.add(q2); queue.add(q1);
    inner.add(queue);

    // --- Tête : crâne + museau + nez viennent de clib ----------------------
    const tete = pivot(0, 0.535, 0.020);
    tete.add(catHead({ r: 0.190, color: CREME, muzzle: true, muzzleColor: PALE,
      noseColor: '#e07a5f', ears: false, eyes: false, blush: false, smile: false }));
    tete.add(regard({ spread: 0.090, r: 0.049, y: 0.030, z: 0.150 }));
    tete.add(mouthSmile({ w: 0.050, depth: 0.026, r: 0.014, count: 3, y: -0.098, z: 0.168 }));
    tete.add(R3.blush(0.140, -0.060, 0.132, 0.044));

    // Les moustaches : deux fins traits clairs de chaque côté du museau.
    [-1, 1].forEach(function (sx) {
      [0.012, -0.030].forEach(function (dy, i) {
        const m = R3.cyl(0.008, 0.009, 0.160, PALE, sx * 0.150, -0.045 + dy, 0.115,
          { seg: 5 });
        m.rotation.z = Math.PI / 2 - sx * 0.18;
        m.rotation.y = -sx * (0.55 + i * 0.15);
        tete.add(noSh(m));
      });
    });

    // Les oreilles, larges à la base, à bout sombre.
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.120, 0.125, -0.020);
      o.userData.z0 = -sx * 0.36;
      o.rotation.z = o.userData.z0;
      o.add(R3.cone(0.062, 0.155, CREME, 0, 0.078, 0, { seg: 10 }));
      o.add(noSh(R3.cone(0.030, 0.070, SOMBRE, 0, 0.128, 0, { seg: 8 })));
      tete.add(o);
      oreilles.push(o);
    });

    // --- LA PIÈCE D'OR sur le front (un pivot : elle brille et oscille) -----
    const piece = pivot(0, 0.132, 0.115);
    piece.rotation.x = -0.35;
    piece.add(noSh(R3.ellipsoid(0.078, 0.056, 0.018, OR, 0, 0, 0,
      { emissive: OR, emissiveIntensity: 0.35, rough: 0.35, metal: 0.35 })));
    piece.add(noSh(R3.ellipsoid(0.046, 0.030, 0.014, OR2, 0, 0, 0.012, { rough: 0.4 })));
    tete.add(piece);

    inner.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : la pièce scintille, les oreilles pivotent -------------
    let boost = 0;
    pilote(g, function (t) {
      const cyc = (t % 3.2) / 3.2;
      const eclat = (cyc < 0.12) ? Math.sin(cyc / 0.12 * Math.PI) : 0;
      piece.scale.setScalar(1 + eclat * 0.12 + boost * 0.25);
      piece.rotation.z = Math.sin(t * 1.4) * 0.08;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - sx * Math.sin(t * 2.0 + i * 1.1) * 0.09;
      }
      q2.rotation.x = 0.85 + Math.sin(t * 1.7) * 0.14;
      q3.rotation.x = 0.70 + Math.sin(t * 1.7 + 0.8) * 0.16;
    });

    // --- Attaque « Jackpot » : il se dresse et montre sa pièce --------------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.18;
      inner.position.z = k * 0.30;
      tete.rotation.x = -k * 0.22;
      queue.rotation.x = -0.55 - k * 0.25;
    };
    return g;
  });

  // ===========================================================================
  //  PERSIAN — « Le chat élégant à la fourrure crème. »
  //  Signature : quatre longues pattes, la GEMME ROUGE au front, de grandes
  //  oreilles et une longue queue qui s'enroule au bout.
  // ===========================================================================
  R3.registerCreature('persian', function () {
    const CREME = '#e8dcc0', PALE = '#f6efdd', OMBRE = '#cbbb99';
    const RUBIS = '#d62828', OR = '#f1c40f', SOMBRE = '#8b6f47';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    // --- Corps long et bas ---------------------------------------------------
    //  Corps volontairement DODU et pattes courtes : la première version, sur
    //  quatre longues tiges, ressemblait à une biche plutôt qu'à un chat.
    inner.add(bodyBlob({ rx: 0.245, ry: 0.215, rz: 0.350, color: CREME,
      shade: OMBRE, y: 0.400 }));

    // --- Quatre pattes courtes et rondes -------------------------------------
    const pattes = [];
    [-1, 1].forEach(function (sx) {
      [0.210, -0.205].forEach(function (dz, i) {
        const h = pivot(sx * 0.155, 0.250, dz);
        h.userData.ph = i * 1.7 + (sx > 0 ? 0.9 : 0);
        h.add(R3.cyl(0.062, 0.078, 0.250, CREME, 0, -0.125, 0, { seg: 8 }));
        inner.add(h);
        pattes.push(h);
      });
    });

    // --- La longue queue, enroulée au bout ----------------------------------
    const queue = pivot(0, 0.420, -0.340);
    queue.rotation.x = -0.85;
    const q1 = pivot(0, 0, 0);
    q1.add(R3.cyl(0.024, 0.032, 0.200, CREME, 0, 0.100, 0, { seg: 8 }));
    const q2 = pivot(0, 0.200, 0);
    q2.rotation.x = 0.70;
    q2.add(R3.cyl(0.020, 0.024, 0.190, CREME, 0, 0.095, 0, { seg: 8 }));
    const q3 = pivot(0, 0.190, 0);
    q3.rotation.x = 0.95;
    q3.add(R3.cyl(0.016, 0.020, 0.150, CREME, 0, 0.075, 0, { seg: 8 }));
    q3.add(noSh(R3.ellipsoid(0.032, 0.038, 0.032, SOMBRE, 0, 0.155, 0)));
    q2.add(q3); q1.add(q2); queue.add(q1);
    inner.add(queue);

    // --- Tête ----------------------------------------------------------------
    const tete = pivot(0, 0.575, 0.295);
    tete.add(catHead({ r: 0.185, color: CREME, muzzle: true, muzzleColor: PALE,
      noseColor: '#c47b6b', ears: false, eyes: false, blush: false, smile: false }));
    tete.add(regard({ spread: 0.088, r: 0.047, y: 0.028, z: 0.148 }));
    tete.add(mouthSmile({ w: 0.048, depth: 0.026, r: 0.014, count: 3, y: -0.095, z: 0.165 }));

    [-1, 1].forEach(function (sx) {
      const m = R3.cyl(0.008, 0.009, 0.175, PALE, sx * 0.145, -0.045, 0.115, { seg: 5 });
      m.rotation.z = Math.PI / 2 - sx * 0.16;
      m.rotation.y = -sx * 0.60;
      tete.add(noSh(m));
    });

    // Grandes oreilles pointues, très écartées : c'est sa silhouette.
    const oreilles = [];
    [-1, 1].forEach(function (sx) {
      const o = pivot(sx * 0.135, 0.115, -0.030);
      o.userData.z0 = -sx * 0.52;
      o.rotation.z = o.userData.z0;
      o.add(R3.cone(0.062, 0.195, CREME, 0, 0.098, 0, { seg: 10 }));
      o.add(noSh(R3.cone(0.036, 0.115, PALE, 0, 0.090, 0.020, { seg: 9 })));
      tete.add(o);
      oreilles.push(o);
    });

    // --- La gemme rouge sertie d'or ------------------------------------------
    const gemme = pivot(0, 0.120, 0.128);
    gemme.rotation.x = -0.30;
    gemme.add(noSh(R3.torus(0.048, 0.013, OR, 0, 0, 0, { metal: 0.5, rough: 0.35, seg: 10 })));
    gemme.add(noSh(R3.ellipsoid(0.042, 0.042, 0.022, RUBIS, 0, 0, 0.006,
      { emissive: RUBIS, emissiveIntensity: 0.30, rough: 0.25 })));
    tete.add(gemme);

    inner.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : il piétine élégamment, la gemme pulse ------------------
    let boost = 0;
    pilote(g, function (t) {
      for (let i = 0; i < pattes.length; i++) {
        pattes[i].rotation.x = Math.sin(t * 1.6 + pattes[i].userData.ph) * 0.06;
      }
      gemme.scale.setScalar(1 + Math.sin(t * 2.0) * 0.06 + boost * 0.20);
      q2.rotation.x = 0.70 + Math.sin(t * 1.5) * 0.12;
      q3.rotation.x = 0.95 + Math.sin(t * 1.5 + 0.9) * 0.18;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        oreilles[i].rotation.z = oreilles[i].userData.z0 - sx * Math.sin(t * 1.8 + i) * 0.07;
      }
    });

    // --- Attaque « Coup de patte véloce » : un bond souple et élégant -------
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      inner.position.z = k * 0.44;
      inner.position.y = Math.sin(t * Math.PI) * 0.16;
      inner.rotation.x = -k * 0.16;
      tete.rotation.x = k * 0.16;
      queue.rotation.x = -0.85 - k * 0.30;
    };
    return g;
  });

  // ===========================================================================
  //  RONFLEX — « Une énorme montagne bleue qui dort au milieu du chemin. »
  //  Signature : ÉNORME, bleu nuit, GROS VENTRE CRÈME, yeux fermés en arcs
  //  contents, grosses mains et grosses plantes de pieds crème. ~1,4 unité.
  //  Il a le droit d'être large : c'est une montagne qui dort.
  // ===========================================================================
  R3.registerCreature('ronflex', function () {
    const BLEU = '#3b5dc9', NUIT = '#2b3f9c', CREME = '#f5deb0';
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    // --- La montagne : un ventre énorme -------------------------------------
    inner.add(R3.ellipsoid(0.600, 0.520, 0.500, BLEU, 0, 0.600, 0));
    inner.add(noSh(R3.ellipsoid(0.440, 0.390, 0.290, CREME, 0, 0.480, 0.330)));

    // --- Les jambes repliées, plantes de pieds crème bien visibles ----------
    [-1, 1].forEach(function (sx) {
      inner.add(R3.ellipsoid(0.230, 0.170, 0.270, BLEU, sx * 0.320, 0.165, 0.140));
      inner.add(noSh(R3.ellipsoid(0.140, 0.100, 0.075, CREME, sx * 0.330, 0.150, 0.375)));
    });

    // --- Les bras posés de chaque côté, grosses mains crème ----------------
    const bras = [];
    [-1, 1].forEach(function (sx) {
      const e = pivot(sx * 0.520, 0.700, 0.060);
      e.userData.z0 = sx * 0.30;
      e.rotation.z = e.userData.z0;
      e.add(R3.ellipsoid(0.150, 0.220, 0.170, BLEU, 0, -0.170, 0));
      e.add(noSh(R3.ellipsoid(0.135, 0.110, 0.135, CREME, 0, -0.350, 0.020)));
      inner.add(e);
      bras.push(e);
    });

    // --- La tête, fondue dans les épaules -----------------------------------
    const tete = pivot(0, 1.010, 0.020);
    tete.add(R3.ellipsoid(0.410, 0.330, 0.350, BLEU, 0, 0, 0));
    // Deux petites oreilles rondes.
    [-1, 1].forEach(function (sx) {
      tete.add(noSh(R3.ellipsoid(0.085, 0.085, 0.060, NUIT, sx * 0.390, 0.105, -0.040)));
    });
    // Les yeux FERMÉS : deux arcs contents — jamais un regard méchant.
    const yeux = [];
    [-1, 1].forEach(function (sx) {
      const y = noSh(R3.ellipsoid(0.085, 0.014, 0.022, '#241c2b', sx * 0.165, 0.030, 0.315));
      y.rotation.z = -sx * 0.22;
      tete.add(y);
      yeux.push(y);
    });
    tete.add(mouthSmile({ w: 0.105, depth: 0.045, r: 0.022, count: 5, y: -0.130, z: 0.320 }));
    tete.add(R3.blush(0.245, -0.075, 0.275, 0.070));

    // --- La bulle de sommeil, qui gonfle et se dégonfle ---------------------
    //  Bien AU-DESSUS de la tête et sur le côté : posée devant son nez, elle
    //  ressemblait à une grosse bille grise collée à sa joue.
    const bulle = pivot(0.300, 1.340, 0.220);
    bulle.add(noSh(R3.sphere(0.058, '#ffffff', 0, 0, 0,
      { transparent: true, opacity: 0.34, rough: 0.15, depthWrite: false })));
    inner.add(bulle);

    inner.add(tete);

    g.userData.anim = { head: tete };

    // --- Vie propre : IL RONFLE. Le ventre se soulève, la bulle grossit -----
    let boost = 0;
    pilote(g, function (t) {
      const cyc = (t % 4.0) / 4.0;
      // Inspiration longue, expiration lente : le rythme d'un gros dormeur.
      const souffle = (cyc < 0.5)
        ? Math.sin(cyc / 0.5 * Math.PI * 0.5)
        : Math.cos((cyc - 0.5) / 0.5 * Math.PI * 0.5);
      tete.position.y = 1.010 + souffle * 0.020;
      tete.rotation.x = 0.06 - souffle * 0.05;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        bras[i].rotation.z = bras[i].userData.z0 + sx * souffle * 0.05;
      }
      bulle.scale.setScalar(0.30 + souffle * 0.95 + boost * 0.4);
      bulle.position.set(0.300, 1.340 + souffle * 0.090, 0.220);
    });

    // --- Attaque « Gros plaquage » : il se penche et se laisse tomber -------
    //  Tout doux : il avance à peine, mais il est TRÈS lourd.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      boost = k;
      const recul = Math.sin(R3.clamp01(t) * Math.PI * 0.5);
      inner.rotation.x = -0.10 * (1 - recul) + k * 0.26;
      inner.position.z = k * 0.24;
      inner.position.y = Math.sin(t * Math.PI) * 0.10;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0) ? -1 : 1;
        bras[i].rotation.x = -k * 0.55;
        bras[i].rotation.z = bras[i].userData.z0 + sx * k * 0.35;
      }
    };
    return g;
  });

  // Enregistrement du lot (informatif : utile au débogage en console).
  R3.register('creaturesP6', {
    ids: ['pikachu', 'raichu', 'evoli', 'aquali', 'pyroli', 'voltali',
      'rondoudou', 'grodoudou', 'miaouss', 'persian', 'ronflex'],
  });
})();
