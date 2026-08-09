// =============================================================================
//  creatures3d.p10.js — LOT 10 : TERAPAGOS, LA TORTUE DE CRISTAL
//  terapagos (forme normale, endormie) · terapagos-cristal (forme réveillée)
//  « L'aventure de Clélia » — version 3D · contrat v4 §3 et §7
// =============================================================================
//  Clélia a demandé deux choses : « apprendre la terracristalisation » et
//  « attraper Pagogo ». C'est la MÊME histoire. Terapagos dort au fond de la
//  Caverne de Cristal depuis mille ans ; en l'attrapant, Clélia reçoit le
//  pouvoir cristal. C'est le grand moment de la partie — d'où ce fichier
//  entier pour une seule créature, mais sous deux formes.
//
//  LES DEUX FORMES DOIVENT ÊTRE LA MÊME BÊTE
//  -----------------------------------------
//  Même squelette, mêmes proportions de tête, mêmes pattes rondes, même
//  sourire, mêmes joues roses. Ce qui change :
//    * la carapace : dôme d'écailles douces  ->  dôme de facettes de cristal ;
//    * le regard   : deux fentes ensommeillées  ->  deux grands yeux brillants ;
//    * la posture  : posée au sol, tassée  ->  dressée et en lévitation ;
//    * la taille   : ~0,85 unité  ->  ~1,3 unité.
//  Une enfant doit reconnaître la tortue au premier coup d'œil, et voir tout
//  de suite qu'elle vient de se RÉVEILLER.
//
//  LES DEUX PIÈGES CONNUS DU PROJET, ÉVITÉS ICI COMME DANS p4
//  ----------------------------------------------------------
//   1. R3.ellipsoid() range ses RAYONS dans mesh.scale. Écrire `scale` dessus
//      efface ses proportions et le change en boule. Ici, aucun ellipsoïde ne
//      voit jamais son `scale` réécrit : on anime des PIVOTS (Object3D nus),
//      ou bien `position` / `rotation`, qui sont sans danger. La seule
//      exception (les étincelles de l'anneau) mémorise `scale.clone()` au
//      premier passage et multiplie par elle.
//   2. Rien n'appelle CL.tick() dans le jeu : la chaîne de rendu n'utilise que
//      R3.idleCreature() et userData.attack(). Les gestes autonomes (facettes
//      qui palpitent, éclats qui tournent, bulles de sommeil qui montent) sont
//      donc accrochés à l'`onBeforeRender` d'un mesh, comme dans p4.
//
//  PARTAGE DES RÔLES DANS L'ANIMATION
//  ----------------------------------
//   R3.idleCreature() écrit : g.scale, anim.head.rotation.z, anim.tail.rotation.y
//   et g.position.y (si anim.float). Le pilote local ne touche donc JAMAIS à
//   ces propriétés-là : il travaille sur rotation.x/z des autres pivots et sur
//   le sous-groupe `inner`. Les deux animations se superposent sans se battre.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // La bibliothèque partagée si elle est là — sinon repli complet sur R3.*.
  const CL = (typeof R3.get === 'function' && R3.get('kclib')) || {};
  function has(n) { return typeof CL[n] === 'function'; }

  // ===========================================================================
  //  PALETTE — c'est elle qui raconte l'histoire.
  // ===========================================================================

  // Forme endormie : turquoise doux, laiteux, presque pastel.
  const PEAU        = '#9fe6f5';   // la petite tortue, toute ronde
  const PEAU_OMBRE  = '#6fcbe4';   // le dessus du corps, un ton plus bas
  const VENTRE      = '#f2fbff';   // plastron laiteux
  const CARAPACE    = '#4fc0e0';   // le dôme
  const ECAILLE     = '#8fe0f7';   // les écailles douces (couleur officielle)
  const BORD        = '#d8f6ff';   // le liseré clair du dôme
  const DORMANT     = '#bff2ff';   // le petit bourgeon de cristal encore éteint
  const SOMMEIL     = '#eafaff';   // les bulles de sommeil

  // Forme cristal : toutes les couleurs du monde.
  const TURQ        = '#8fe0f7';
  const ROSE        = '#ff9ad8';
  const OR          = '#ffd977';
  const VIOLET      = '#b98cff';
  const PRISME      = [TURQ, ROSE, OR, VIOLET, TURQ, ROSE, OR];
  const NOYAU       = '#ffffff';   // le cœur de lumière, sous la carapace

  // ===========================================================================
  //  Petits utilitaires locaux (identiques à ceux de creatures3d.p4.js)
  // ===========================================================================

  /** Un pivot (Object3D nu) : le SEUL objet qu'on ait le droit de mettre à
   *  l'échelle sans risque, puisqu'il ne porte aucune géométrie. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** Détail décoratif : ni ombre portée, ni ombre reçue. */
  function noSh(o) { o.castShadow = false; o.receiveShadow = false; return o; }

  /** Positionne un objet d'après o.x / o.y / o.z (convention des helpers clib). */
  function place(o, obj) { obj.position.set(o.x || 0, o.y || 0, o.z || 0); return obj; }

  /** Courbe 0 -> 1 -> 0 : la base de toutes les attaques. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Ellipsoïde de VERRE : le dôme de cristal, les bulles de sommeil. */
  function verre(rx, ry, rz, color, x, y, z, opacity, flat, seg) {
    const m = new THREE.Mesh(R3.geo.sphere(1, seg || 12),
      R3.mat(color, {
        transparent: true, opacity: (opacity === undefined) ? 0.5 : opacity,
        rough: 0.18, side: THREE.DoubleSide, depthWrite: false,
        flat: !!flat, emissive: color, emissiveIntensity: 0.30,
      }));
    m.scale.set(rx, ry, rz);
    m.position.set(x || 0, y || 0, z || 0);
    return noSh(m);
  }

  /** Ellipsoïde LUMINEUX, opaque mais émissif : il brille même dans la caverne. */
  function lueur(rx, ry, rz, color, x, y, z, intensite) {
    const m = new THREE.Mesh(R3.geo.sphere(1, 12), R3.matGlow(color, intensite));
    m.scale.set(rx, ry, rz);
    m.position.set(x || 0, y || 0, z || 0);
    return noSh(m);
  }

  /** Petite étoile lumineuse (éclat de cristal en suspension). */
  function etincelle(r, color, x, y, z) {
    return noSh(R3.star(4, r, r * 0.34, r * 0.45, color, x, y, z, {
      emissive: color, emissiveIntensity: 1.0, rough: 0.30,
    }));
  }

  /**
   * Accroche une animation par image au modèle `g`, sur l'onBeforeRender du
   * premier mesh OPAQUE rencontré (three.js l'appelle à chaque rendu).
   * Un garde-fou sur le temps évite de la jouer deux fois (passe d'ombre).
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
    try { fn(0); } catch (e) { /* idem : le modèle est juste dès l'image 0 */ }
  }

  // ===========================================================================
  //  ENVELOPPES DES HELPERS `clib` — repli complet si la bibliothèque manque.
  //  Les replis respectent l'ANCRAGE documenté par clib, pour que le reste du
  //  fichier soit rigoureusement identique dans les deux cas.
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

  function paw(o) {
    if (has('paw')) return CL.paw(o);
    o = o || {};
    const r = (o.r === undefined) ? 0.09 : o.r;
    const sq = (o.squash === undefined) ? 0.66 : o.squash;
    const st = (o.stretch === undefined) ? 1.20 : o.stretch;
    return R3.ellipsoid(r, r * sq, r * st, o.color || '#ffffff',
      o.x || 0, o.y || 0, o.z || 0, { rough: (o.rough === undefined) ? 0.9 : o.rough });
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
      const a = (i / n) * Math.PI * 2;
      const s = etincelle(size, (i % 2 === 0) ? c1 : c2,
        Math.cos(a) * r, Math.sin(a * 2) * wave, Math.sin(a) * r);
      s.userData.a0 = a;
      spin.add(s); sparks.push(s);
    }
    tiltG.rotation.x = (o.tilt === undefined) ? 0.32 : o.tilt;
    g.userData.sparks = sparks;
    g.userData.spin = spin;
    return place(o, g);
  }

  /**
   * Fait tourner l'anneau d'éclats et fait battre chacun d'eux.
   * PIÈGE DÉSAMORCÉ : on mémorise l'échelle d'origine au premier passage et on
   * multiplie par elle — ça reste juste même si clib renvoie des ellipsoïdes.
   */
  function animeAnneau(anneau, t, vitesse, eclat, wave) {
    const spin = (anneau.userData && anneau.userData.spin) || anneau;
    const sparks = (anneau.userData && anneau.userData.sparks) || [];
    spin.rotation.y = t * vitesse;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      if (!s.userData.s0) s.userData.s0 = s.scale.clone();
      const s0 = s.userData.s0;
      const a0 = (s.userData.a0 === undefined) ? i : s.userData.a0;
      const k = (0.60 + 0.46 * (0.5 + 0.5 * Math.sin(t * 2.9 + a0 * 3))) * eclat;
      s.rotation.z = t * 1.5 + i;
      s.scale.set(s0.x * k, s0.y * k, s0.z * k);
      s.position.y = Math.sin(a0 * 2 + t * 1.2) * (wave === undefined ? 0.06 : wave);
    }
  }

  /**
   * Pose une pièce SUR un dôme, à la façon d'une écaille ou d'une facette.
   * Renvoie le pivot d'inclinaison : le faire tourner sur x « ouvre » la pièce
   * vers l'extérieur sans jamais toucher au `scale` d'un ellipsoïde.
   *
   *   parent -> [lacet: rotation.y = a] -> [inclinaison: rotation.x] -> pièce
   *
   * @param {THREE.Object3D} parent  le centre géométrique du dôme
   * @param {number} a       angle de lacet (0 = devant, sens trigonométrique)
   * @param {number} tilt    inclinaison depuis la verticale, en radians
   * @param {number} dist    distance depuis le centre du dôme
   * @param {THREE.Object3D} piece  la pièce, construite autour de l'origine
   */
  function surLeDome(parent, a, tilt, dist, piece) {
    const lacet = pivot(0, 0, 0);
    lacet.rotation.y = a;
    const inclin = pivot(0, 0, 0);
    inclin.userData.x0 = tilt;
    inclin.rotation.x = tilt;
    piece.position.y = dist;
    piece.userData.d0 = dist;
    inclin.add(piece);
    lacet.add(inclin);
    parent.add(lacet);
    inclin.userData.piece = piece;
    return inclin;
  }

  // ===========================================================================
  //  TERAPAGOS — forme normale, « la tortue qui dort depuis mille ans ».
  //  Une petite tortue turquoise toute ronde, tassée sur elle-même, museau
  //  court, grands yeux mi-clos, carapace en dôme d'écailles douces avec, au
  //  sommet, un bourgeon de cristal encore éteint : la promesse de la suite.
  //  Trois bulles de sommeil montent doucement au-dessus de sa tête.
  //  Hauteur ≈ 0,84 unité. Elle repose sur le sol : pas de lévitation.
  // ===========================================================================
  R3.registerCreature('terapagos', function () {
    const g = R3.group();
    const inner = pivot(0, 0, 0);          // TOUT le corps vit là-dedans
    g.add(inner);

    // --- Un souffle de lumière très discret, comme une veilleuse ------------
    //  Règle de lisibilité du projet : l'aura reste PLUS PETITE que la
    //  créature. Ici elle est presque invisible en plein jour, et se devine
    //  seulement dans le noir de la caverne — exactement ce qu'on veut.
    const aura = glowAura({ r: 0.30, color: DORMANT, layers: 2, opacity: 0.09,
      squash: 0.85, y: 0.36 });
    inner.add(aura);

    // --- Quatre pattes rondes, à peine sorties de la carapace ---------------
    const pattes = [];
    [[-1, 0.21], [1, 0.21], [-1, -0.20], [1, -0.20]].forEach(function (L, i) {
      const p = pivot(L[0] * 0.245, 0.082, L[1]);
      p.add(paw({ r: 0.115, squash: 0.68, stretch: 1.18, color: PEAU }));
      p.userData.ph = i * 1.4;
      inner.add(p);
      pattes.push(p);
    });

    // --- Le corps : une grosse bille tassée sous le dôme --------------------
    const corps = bodyBlob({ rx: 0.335, ry: 0.215, rz: 0.355, color: PEAU,
      shade: PEAU_OMBRE, belly: VENTRE, y: 0.26 });
    inner.add(corps);

    // --- LA CARAPACE : un dôme tout doux ------------------------------------
    //  Aucune arête : à ce stade, elle n'est encore que de la pierre tendre.
    const domeCentre = pivot(0, 0.34, 0);
    inner.add(domeCentre);
    domeCentre.add(R3.ellipsoid(0.400, 0.295, 0.420, CARAPACE, 0, 0, 0,
      { rough: 0.62, seg: 16 }));
    inner.add(noSh(R3.ellipsoid(0.435, 0.045, 0.455, BORD, 0, 0.262, 0,
      { rough: 0.45 })));                                            // liseré

    // Six écailles autour + une au sommet. Ce sont des galets, pas des piques.
    const ecailles = [];
    for (let i = 0; i < 6; i++) {
      const e = noSh(R3.ellipsoid(0.118, 0.030, 0.128, ECAILLE, 0, 0, 0,
        { rough: 0.55, seg: 12 }));
      // 0,350 = la distance exacte où le rayon du dôme (0,40 × 0,295) croise la
      // direction inclinée à 0,98 rad : l'écaille affleure sans flotter.
      ecailles.push(surLeDome(domeCentre, (i / 6) * Math.PI * 2, 0.98, 0.350, e));
    }
    ecailles.push(surLeDome(domeCentre, 0, 0, 0.282,
      noSh(R3.ellipsoid(0.135, 0.032, 0.145, ECAILLE, 0, 0, 0,
        { rough: 0.55, seg: 12 }))));

    // Le bourgeon de cristal : encore laiteux, encore endormi. C'est LUI qui
    // deviendra le prisme de la forme cristal — Clélia doit pouvoir le montrer
    // du doigt avant même la transformation.
    const bourgeon = pivot(0, 0.688, 0);
    bourgeon.add(verre(0.078, 0.092, 0.078, DORMANT, 0, 0, 0, 0.55, true, 8));
    bourgeon.add(lueur(0.036, 0.044, 0.036, '#ffffff', 0, 0, 0, 0.45));
    inner.add(bourgeon);

    // --- La tête : museau court, joues rondes, et ces yeux mi-clos ----------
    const tete = pivot(0, 0.355, 0.335);     // pivot d'idle (R3.idleCreature)
    tete.userData.x0 = 0.10;                 // la tête penche : elle dort
    tete.rotation.x = tete.userData.x0;
    inner.add(tete);

    tete.add(R3.ellipsoid(0.185, 0.170, 0.190, PEAU, 0, 0, 0, { rough: 0.68 }));
    tete.add(R3.ellipsoid(0.126, 0.100, 0.116, PEAU, 0, -0.048, 0.152,
      { rough: 0.68 }));                                              // museau
    [-1, 1].forEach(function (s) {
      tete.add(noSh(R3.sphere(0.017, PEAU_OMBRE, s * 0.038, -0.028, 0.252,
        { rough: 0.8 })));                                            // narines
    });

    // Les yeux existent en entier dessous : c'est ce qui rend le réveil
    // possible sans changer de modèle, et ce qui donne ce regard « presque
    // ouvert » quand on la regarde de près.
    tete.add(bigEyes({ r: 0.080, pupilR: 0.042, spread: 0.107,
      scleraColor: '#ffffff', pupilColor: '#2a4f66', y: 0.042, z: 0.138 }));

    // Deux paupières turquoise, tombantes : elles couvrent les deux tiers de
    // l'œil. C'est tout ce qui sépare « endormie » de « réveillée ».
    const paupieres = [];
    [-1, 1].forEach(function (s) {
      const pa = pivot(s * 0.107, 0.042, 0.128);
      pa.userData.x0 = 0.30;
      pa.rotation.x = pa.userData.x0;
      pa.add(noSh(R3.ellipsoid(0.090, 0.062, 0.062, PEAU, 0, 0.030, 0.006,
        { rough: 0.7 })));
      tete.add(pa);
      paupieres.push(pa);
    });

    tete.add(R3.blush(0.148, -0.045, 0.118, 0.046));
    tete.add(mouthSmile({ w: 0.046, depth: 0.018, r: 0.014, count: 3,
      y: -0.100, z: 0.246 }));

    // --- Une petite queue en goutte -----------------------------------------
    const queue = pivot(0, 0.205, -0.395);   // pivot de queue (R3.idleCreature)
    queue.add(R3.ellipsoid(0.058, 0.052, 0.090, PEAU, 0, -0.010, -0.055,
      { rough: 0.75 }));
    inner.add(queue);

    // --- Trois bulles de sommeil ---------------------------------------------
    //  Le signe universel du sommeil, lisible à 6 ans sans un mot d'explication.
    const bulles = [];
    [[0.140, 0.560, 0.455, 0.036], [0.198, 0.665, 0.500, 0.049],
     [0.258, 0.770, 0.540, 0.062]].forEach(function (B, i) {
      const b = pivot(B[0], B[1], B[2]);
      b.userData.y0 = B[1];
      b.userData.ph = i * 2.1;
      b.add(verre(B[3], B[3], B[3], SOMMEIL, 0, 0, 0, 0.42, false, 10));
      inner.add(b);
      bulles.push(b);
    });

    g.userData.anim = { head: tete, tail: queue, float: false };

    // --- Vie propre : elle respire, très lentement --------------------------
    //  Tout est réglé une octave plus bas que d'habitude : une tortue qui dort
    //  depuis mille ans ne frétille pas. `reveil` (0 -> 1) est poussé par
    //  l'attaque : c'est le seul moment où elle entrouvre les yeux.
    let reveil = 0;
    pilote(g, function (t) {
      const souffle = Math.sin(t * 0.85);

      // La carapace se soulève et retombe : la respiration passe par un PIVOT,
      // jamais par le `scale` du dôme (piège n° 1).
      domeCentre.position.y = 0.34 + souffle * 0.016 + reveil * 0.030;
      corps.position.y = 0.26 + souffle * 0.010;

      // Les écailles frémissent une par une, comme des plaques qui respirent.
      for (let i = 0; i < ecailles.length; i++) {
        const e = ecailles[i];
        e.rotation.x = e.userData.x0 + reveil * 0.18
          + Math.sin(t * 0.7 + i * 0.9) * 0.020;
        e.userData.piece.position.y = e.userData.piece.userData.d0
          + reveil * 0.045 + Math.sin(t * 0.9 + i) * 0.006;
      }

      // Le bourgeon de cristal palpite : la lumière du réveil est déjà dedans.
      bourgeon.scale.setScalar(1 + Math.sin(t * 1.25) * 0.10 + reveil * 0.42);
      bourgeon.position.y = 0.688 + souffle * 0.016 + reveil * 0.055;

      // La tête dodeline et se relève un peu quand elle s'éveille.
      tete.rotation.x = tete.userData.x0 - reveil * 0.26 + souffle * 0.035;
      tete.position.y = 0.355 + souffle * 0.012;

      // Les paupières se lèvent : le geste le plus important du modèle.
      for (let i = 0; i < paupieres.length; i++) {
        const pa = paupieres[i];
        pa.rotation.x = pa.userData.x0 - reveil * 0.72
          + Math.sin(t * 0.55 + i * 0.4) * 0.030;
      }

      // Les pattes se détendent alternativement.
      for (let i = 0; i < pattes.length; i++) {
        pattes[i].position.y = 0.082 + Math.sin(t * 0.8 + pattes[i].userData.ph) * 0.008;
        pattes[i].rotation.x = Math.sin(t * 0.6 + i) * 0.05;
      }

      // La queue bat très doucement (rotation.x : idle possède rotation.y).
      queue.rotation.x = -0.10 + Math.sin(t * 0.7) * 0.09;

      // Les bulles de sommeil montent, grossissent, et repartent d'en bas.
      for (let i = 0; i < bulles.length; i++) {
        const b = bulles[i];
        const u = ((t * 0.28 + i * 0.33) % 1);
        b.position.y = b.userData.y0 + u * 0.10;
        b.position.x = 0.140 + i * 0.059 + Math.sin(t * 0.9 + b.userData.ph) * 0.018;
        b.scale.setScalar((0.55 + u * 0.75) * (1 - reveil * 0.85));
      }

      // L'aura reste petite : au-delà, elle passerait sous le sol et mangerait
      // la silhouette (la sonde le refuse, et elle a raison).
      aura.scale.setScalar((1 + Math.sin(t * 0.7) * 0.05) * (1 + reveil * 0.20));
    });

    // --- Attaque « Lumière des mille ans » ----------------------------------
    //  Elle s'éveille à moitié : elle entrouvre les yeux, redresse la tête, la
    //  carapace se soulève et le bourgeon de cristal s'allume. Puis elle se
    //  rendort. Amplitudes sobres : c'est rejoué en boucle tout le combat, et
    //  son gabarit doit être exactement le même au début et à la fin.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      reveil = k;
      inner.position.z = k * 0.16;
      inner.position.y = k * 0.045;
      inner.rotation.x = -k * 0.07;
    };

    return g;
  });

  // ===========================================================================
  //  TERAPAGOS-CRISTAL — « Elle s'est réveillée. »
  //  La MÊME tortue : mêmes pattes rondes, même museau court, même sourire,
  //  mêmes joues. Mais elle lévite, elle se dresse, ses yeux sont grands
  //  ouverts, et sa carapace est devenue un dôme de facettes de cristal qui
  //  contient toutes les couleurs du monde. Sept éclats tournent autour d'elle.
  //  Hauteur ≈ 1,3 unité. C'est la récompense d'une quête entière.
  // ===========================================================================
  R3.registerCreature('terapagos-cristal', function () {
    const g = R3.group();
    const inner = pivot(0, 0, 0);
    g.add(inner);

    // --- L'aura prismatique --------------------------------------------------
    //  Elle reste plus petite que la créature (règle de lisibilité) : c'est le
    //  cristal qui doit briller, pas un nuage flou qui mange la silhouette.
    const aura = glowAura({ r: 0.42, color: TURQ, layers: 2, opacity: 0.14,
      squash: 0.95, y: 0.70 });
    inner.add(aura);

    // --- Quatre pattes rondes, détendues sous elle ---------------------------
    //  Elles ne portent plus rien : elle flotte. Elles pendent, un peu écartées.
    const pattes = [];
    [[-1, 0.20], [1, 0.20], [-1, -0.19], [1, -0.19]].forEach(function (L, i) {
      const p = pivot(L[0] * 0.225, 0.285, L[1]);
      p.userData.z0 = L[0] * 0.16;
      p.rotation.z = p.userData.z0;
      p.add(paw({ r: 0.115, squash: 0.70, stretch: 1.15, color: PEAU }));
      p.userData.ph = i * 1.6;
      inner.add(p);
      pattes.push(p);
    });

    // --- Le corps et le plastron ---------------------------------------------
    const corps = pivot(0, 0, 0);
    inner.add(corps);
    corps.add(R3.ellipsoid(0.395, 0.285, 0.415, PEAU, 0, 0.620, 0, { rough: 0.60 }));
    corps.add(noSh(R3.ellipsoid(0.330, 0.185, 0.350, VENTRE, 0, 0.500, 0.045,
      { rough: 0.66 })));

    // --- LA CARAPACE DE CRISTAL ----------------------------------------------
    //  Un dôme de verre franchement FACETTÉ (flat: true, 8 segments) : c'est la
    //  seule pièce du bestiaire qui a le droit d'être anguleuse. Dessous, on
    //  voit le corps turquoise par transparence — la carapace « contient » la
    //  tortue, exactement comme la légende le raconte.
    const domeCentre = pivot(0, 0.660, 0);
    inner.add(domeCentre);
    domeCentre.add(verre(0.500, 0.400, 0.520, TURQ, 0, 0, 0, 0.42, true, 8));
    inner.add(noSh(R3.ellipsoid(0.545, 0.055, 0.565, OR, 0, 0.520, 0,
      { rough: 0.30, metal: 0.25, emissive: OR, emissiveIntensity: 0.35 })));

    // Sept facettes de cristal plantées dans le dôme, du turquoise au violet en
    // passant par le rose et l'or : le dégradé prismatique demandé. Chacune est
    // une pyramide à quatre pans (seg: 4, flat) — du vrai cristal taillé.
    const facettes = [];
    for (let i = 0; i < 7; i++) {
      const c = PRISME[i % PRISME.length];
      const f = noSh(R3.cone(0.115, 0.300, c, 0, 0, 0, {
        seg: 4, flat: true, rough: 0.16, metal: 0.10,
        transparent: true, opacity: 0.88, depthWrite: true,
        emissive: c, emissiveIntensity: 0.55,
      }));
      facettes.push(surLeDome(domeCentre, (i / 7) * Math.PI * 2 + 0.22, -0.80, 0.540, f));
    }

    // Le prisme du sommet : le bourgeon endormi de la forme normale, devenu une
    // flèche de lumière. C'est le point le plus haut du modèle.
    const flecheP = pivot(0, 1.040, 0);
    const fleche = noSh(R3.cone(0.140, 0.400, NOYAU, 0, 0.200, 0, {
      seg: 5, flat: true, rough: 0.12, metal: 0.15,
      transparent: true, opacity: 0.80, depthWrite: true,
      emissive: TURQ, emissiveIntensity: 0.85,
    }));
    flecheP.add(fleche);
    inner.add(flecheP);

    // Le cœur de lumière, blotti sous la flèche : c'est de là que tout jaillit.
    const coeurP = pivot(0, 1.010, 0);
    coeurP.add(lueur(0.090, 0.090, 0.090, NOYAU, 0, 0, 0, 1.0));
    inner.add(coeurP);

    // --- La tête : la MÊME que dans la forme endormie, mais réveillée --------
    const tete = pivot(0, 0.665, 0.435);     // pivot d'idle (R3.idleCreature)
    tete.userData.x0 = -0.06;                // relevée : elle regarde devant
    tete.rotation.x = tete.userData.x0;
    inner.add(tete);

    tete.add(R3.ellipsoid(0.195, 0.182, 0.200, PEAU, 0, 0, 0, { rough: 0.62 }));
    tete.add(R3.ellipsoid(0.133, 0.108, 0.122, PEAU, 0, -0.052, 0.160,
      { rough: 0.62 }));                                              // museau

    // Grands yeux ouverts, pupille violette : le regard de quelqu'un qui vient
    // de voir la lumière pour la première fois depuis mille ans.
    tete.add(bigEyes({ r: 0.092, pupilR: 0.050, spread: 0.115,
      scleraColor: '#ffffff', pupilColor: '#6a3f9e', y: 0.048, z: 0.146 }));
    tete.add(R3.blush(0.156, -0.048, 0.124, 0.048));
    tete.add(mouthSmile({ w: 0.050, depth: 0.022, r: 0.015, count: 3,
      y: -0.106, z: 0.258 }));

    // --- La queue -------------------------------------------------------------
    const queue = pivot(0, 0.545, -0.400);   // pivot de queue (R3.idleCreature)
    queue.add(R3.ellipsoid(0.060, 0.055, 0.100, PEAU, 0, -0.012, -0.060,
      { rough: 0.70 }));
    inner.add(queue);

    // --- Les éclats en suspension --------------------------------------------
    const eclats = sparkleRing({ count: 6, r: 0.615, size: 0.070,
      color: ROSE, color2: OR, tilt: 0.30, wave: 0.14, y: 0.720 });
    inner.add(eclats);

    g.userData.anim = { head: tete, tail: queue, float: true };

    // --- Vie propre : le cristal vit ------------------------------------------
    //  `eclat` (0 -> 1) est poussé par l'attaque. Le pilote est le SEUL
    //  propriétaire de tout ce qu'il anime ; l'attaque ne touche qu'à `inner`
    //  et à cette variable partagée.
    let eclat = 0;
    pilote(g, function (t) {
      const souffle = Math.sin(t * 1.05);

      // Le dôme respire (pivot : le `scale` du dôme n'est jamais réécrit).
      domeCentre.position.y = 0.660 + souffle * 0.018;
      corps.position.y = souffle * 0.012;

      // Les facettes palpitent en vague et s'ouvrent pendant l'attaque : chacune
      // pivote un peu plus tard que la précédente, ce qui fait « fleurir » la
      // carapace au lieu de la faire claquer d'un bloc.
      for (let i = 0; i < facettes.length; i++) {
        const f = facettes[i];
        const retard = i * 0.18;
        const onde = Math.sin(t * 1.15 - retard);
        f.rotation.x = f.userData.x0 - eclat * 0.52 + onde * 0.045;
        f.rotation.y = onde * 0.09 + eclat * 0.22;
        f.userData.piece.position.y = f.userData.piece.userData.d0
          + eclat * 0.150 + onde * 0.012;
      }

      // La flèche du sommet tourne lentement sur elle-même et monte à l'attaque.
      flecheP.rotation.y = t * 0.55;
      flecheP.position.y = 1.040 + souffle * 0.020 + eclat * 0.110;
      flecheP.scale.setScalar(1 + eclat * 0.20);

      // Le cœur de lumière bat — et jaillit quand elle attaque.
      coeurP.position.y = 1.010 + souffle * 0.018 + eclat * 0.090;
      coeurP.scale.setScalar(1 + Math.sin(t * 2.1) * 0.12 + eclat * 1.35);

      // La tête suit le souffle (rotation.x seulement : idle possède le z).
      tete.rotation.x = tete.userData.x0 + souffle * 0.045 - eclat * 0.16;
      tete.position.y = 0.665 + souffle * 0.014;

      // Les pattes pendent et se balancent doucement dans le vide.
      for (let i = 0; i < pattes.length; i++) {
        const p = pattes[i];
        const s = (i % 2 === 0) ? -1 : 1;
        p.rotation.x = Math.sin(t * 0.95 + p.userData.ph) * 0.10 - eclat * 0.20;
        p.rotation.z = p.userData.z0 + s * (Math.sin(t * 0.8 + i) * 0.05 + eclat * 0.16);
      }

      // La queue ondule (rotation.x : idle possède rotation.y).
      queue.rotation.x = -0.08 + Math.sin(t * 1.1) * 0.11;

      // L'aura respire, les éclats tournent de plus en plus vite.
      aura.scale.setScalar((1 + souffle * 0.055) * (1 + eclat * 0.26));
      // Vitesse CONSTANTE : la faire varier ferait sauter l'anneau d'un coup,
      // puisque l'angle vaut t × vitesse. C'est l'ouverture de l'anneau et
      // l'éclat des étoiles qui portent l'accélération ressentie.
      animeAnneau(eclats, t, 0.50, 1 + eclat * 1.10, 0.14);
      eclats.scale.set(1 + eclat * 0.32, 1 + eclat * 0.18, 1 + eclat * 0.32);
      eclats.rotation.z = Math.sin(t * 0.4) * 0.10;
    });

    // --- Attaque « Rayon Prisme » : les facettes s'ouvrent, la lumière jaillit
    //  C'est la transformation rendue jouable. Elle s'élève, s'incline en
    //  arrière, la carapace s'ouvre comme une fleur de cristal (voir le pilote,
    //  qui lit `eclat`), le cœur blanc gonfle et les éclats s'emballent.
    //  Le gabarit revient exactement au même à p = 0 et à p = 1.
    g.userData.attack = function (gg, p) {
      const q = R3.clamp01(p);
      const k = pulse(q);
      eclat = k;
      inner.position.y = k * 0.170;
      inner.position.z = k * 0.130;
      inner.rotation.x = -k * 0.14;
      // Une lente demi-rotation sur elle-même : la lumière balaie toute la salle.
      inner.rotation.y = Math.sin(q * Math.PI) * 0.55;
    };

    return g;
  });

})();
