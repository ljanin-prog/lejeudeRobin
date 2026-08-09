// =============================================================================
//  creatures3d.p9.js — LOT 9 : LES CINQ LÉGENDAIRES CÉLÈBRES
//  Mewtwo · Rayquaza · Lugia · Ho-Oh · Arceus
//  « L'aventure de Clélia » — version 3D
// =============================================================================
//  Demande explicite de Clélia (6 ans) : « je veux que les legendaire ressemble
//  bcp plus au vrai legendaire de la série ». Les 5 légendaires maison
//  (Sylvania, Ondine, Sablior, Cristalyx, Luminis) RESTENT ; ces cinq-là
//  s'ajoutent, chacun dans son propre repaire. Ce sont les trophées du jeu.
//
//  RÈGLES DE CE LOT (CONTRAT-V4 §3, mêmes que creatures3d.p4.js)
//  --------------------------------------------------------------
//    * GABARIT : 1,4 à 1,7 unité de haut (le joueur en fait 1,0). Rayquaza est
//      LONG plutôt que haut : il est présenté enroulé et dressé, la tête au
//      sommet de sa propre spirale — la silhouette reste compacte.
//    * BUDGET  : 70 meshes chacun (40 pour les communes).
//    * Chacun porte une AURA + des étincelles : c'est ce qui les rend visibles
//      de très loin dans le paysage, et c'est sur quoi repose leur repaire.
//
//  IMPRESSIONNANTS, JAMAIS EFFRAYANTS. C'est tout l'enjeu de ce lot : Mewtwo
//  doit avoir l'air grave et puissant, pas méchant. Aucun croc, aucune griffe
//  coupante, aucun regard mauvais — de grands yeux expressifs, des joues
//  roses, des museaux arrondis. Une enfant de 6 ans doit avoir envie de les
//  approcher, pas de fermer les yeux.
//
//  LES TROIS PIÈGES DU PROJET, SOIGNEUSEMENT ÉVITÉS ICI
//  ----------------------------------------------------
//   1. R3.ellipsoid() range ses rayons dans mesh.scale. Écrire `scale` sur un
//      ellipsoïde efface donc ses proportions et le transforme en boule de
//      rayon 1 (« la volute de 0,08 devenue rocher de 1,1 »). Ici, RIEN
//      n'écrit jamais le `scale` d'un ellipsoïde : on anime toujours un PIVOT
//      parent (Object3D nu), ou bien la `position` / la `rotation` du mesh.
//      Seule exception maîtrisée : animeAnneau(), qui mémorise `scale.clone()`
//      au premier passage et multiplie par cette valeur d'origine.
//   2. Rien n'appelle CL.tick() dans le jeu : battle3d.js et roamers3d.js
//      n'utilisent que R3.idleCreature() et userData.attack(). Les gestes
//      autonomes (aura qui respire, anneau d'Arceus qui tourne, corps de
//      Rayquaza qui ondule) sont donc pilotés par une fonction accrochée à
//      l'`onBeforeRender` d'un mesh du modèle — technique de p3 et p4.
//   3. rotation.x POSITIVE bascule vers +z, donc vers l'AVANT. Une aile ou une
//      queue avec le mauvais signe traverse le corps : invisible de face,
//      flagrant de profil. Tous les signes ci-dessous ont été vérifiés en
//      vue « profil » sur probe-models.html.
//
//  ANIMATION D'ATTENTE — pourquoi si peu de `anim.wingL` / `anim.wingR`
//  --------------------------------------------------------------------
//  R3.idleCreature() bat les ailes à Math.sin(t * 6) : parfait pour un petit
//  hibou frétillant, beaucoup trop nerveux pour Lugia ou Ho-Oh. Les clés
//  wingL / wingR sont bien déclarées (contrat), mais le PILOTE reprend la main
//  sur rotation.z au moment du rendu — il tourne après idleCreature — et les
//  fait battre LENTEMENT et amplement, comme des planeurs.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // La bibliothèque partagée si elle est là — sinon repli complet sur R3.*.
  const CL = (typeof R3.get === 'function' && R3.get('kclib')) || {};
  function has(n) { return typeof CL[n] === 'function'; }

  // ===========================================================================
  //  Petits utilitaires locaux (identiques à creatures3d.p4.js)
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

  /** Ellipsoïde de VERRE (voiles, membranes, arcs-en-ciel). */
  function verre(rx, ry, rz, color, x, y, z, opacity) {
    const m = new THREE.Mesh(R3.geo.sphere(1, 12),
      R3.matGlass(color, opacity === undefined ? 0.5 : opacity));
    m.scale.set(rx, ry, rz);
    m.position.set(x || 0, y || 0, z || 0);
    return noSh(m);
  }

  /** Ellipsoïde LUMINEUX : plumes de feu, yeux de topaze, gemmes. */
  function lueur(rx, ry, rz, color, x, y, z, intensite) {
    const m = new THREE.Mesh(R3.geo.sphere(1, 12), R3.matGlow(color, intensite));
    m.scale.set(rx, ry, rz);
    m.position.set(x || 0, y || 0, z || 0);
    return noSh(m);
  }

  /** Petite étoile lumineuse (étincelle), sans ombre. */
  function etincelle(r, color, x, y, z) {
    return noSh(R3.star(4, r, r * 0.34, r * 0.45, color, x, y, z, {
      emissive: color, emissiveIntensity: 0.95, rough: 0.36,
    }));
  }

  /**
   * Accroche une animation par image au modèle `g`, sur l'onBeforeRender du
   * premier mesh opaque rencontré (three.js l'appelle à chaque rendu).
   * Un garde-fou sur le temps évite de la jouer deux fois (ombre + couleur).
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
    // Repos : une image à t = 0, pour que le modèle soit déjà juste avant
    // même d'avoir été rendu une seule fois.
    try { fn(0); } catch (e) { /* idem */ }
  }

  // ===========================================================================
  //  ENVELOPPES DES HELPERS `clib` — repli complet si la bibliothèque est
  //  absente. Les replis respectent scrupuleusement l'ANCRAGE documenté par
  //  clib, pour que le reste du code soit identique dans les deux cas.
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

  function birdBeak(o) {
    if (has('birdBeak')) return CL.birdBeak(o);
    o = o || {};
    const m = R3.cone(o.r || 0.07, o.len || 0.16, o.color || '#f1c40f', 0, 0, 0, { seg: 10 });
    m.rotation.x = Math.PI / 2 + (o.tilt || 0);
    m.scale.set(o.wide || 1, 1, o.droop || 1);
    return place(o, m);
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
      let s;
      if (o.shape === 'dot') {
        s = noSh(R3.ellipsoid(size * 0.55, size * 0.55, size * 0.55,
          (i % 2 === 0) ? c1 : c2, 0, 0, 0,
          { emissive: (i % 2 === 0) ? c1 : c2, emissiveIntensity: 1.0, rough: 0.35 }));
        s.position.set(Math.cos(a) * r, Math.sin(a * 2) * wave, Math.sin(a) * r);
      } else {
        s = etincelle(size, (i % 2 === 0) ? c1 : c2,
          Math.cos(a) * r, Math.sin(a * 2) * wave, Math.sin(a) * r);
      }
      s.userData.a0 = a;
      spin.add(s); sparks.push(s);
    }
    tiltG.rotation.x = (o.axis === 'z') ? Math.PI / 2 : ((o.tilt === undefined) ? 0.32 : o.tilt);
    g.userData.sparks = sparks;
    g.userData.spin = spin;
    return place(o, g);
  }

  /**
   * Fait tourner l'anneau d'étincelles d'un sparkleRing et fait battre chaque
   * étincelle. `eclat` (>= 1) est le facteur d'éclat de l'attaque.
   *
   * PIÈGE DÉSAMORCÉ : une étincelle en étoile (R3.star) a un scale de 1, mais
   * une perle (`shape:'dot'`) est un ellipsoïde dont les RAYONS sont dans son
   * scale. On mémorise donc l'échelle d'origine au premier passage et on
   * multiplie par elle — correct pour les deux formes.
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
      const k = (0.62 + 0.44 * (0.5 + 0.5 * Math.sin(t * 2.9 + a0 * 3))) * eclat;
      s.rotation.z = t * 1.4 + i;
      s.scale.set(s0.x * k, s0.y * k, s0.z * k);
      s.position.y = Math.sin(a0 * 2 + t * 1.2) * (wave === undefined ? 0.06 : wave);
    }
  }

  // ===========================================================================
  //  MEWTWO — « Le Pokémon le plus puissant du monde. »
  //  Humanoïde violet pâle qui LÉVITE, à peine posé sur la pointe des pieds :
  //  grosse tête bulbeuse, deux cornes courtes, le tube nerveux caractéristique
  //  qui court de la nuque au haut du dos, et une longue queue épaisse qui
  //  s'enroule vers le haut. L'air GRAVE, jamais méchant : grands yeux violets,
  //  un demi-sourire, des joues roses. Il cherche surtout un ami.
  // ===========================================================================
  R3.registerCreature('mewtwo', function () {
    const CORPS = '#e4d0f2', OMBRE = '#c3a4e0', VENTRE = '#f8f0ff';
    const MAUVE = '#a86fd6', MAUVE_CLAIR = '#c79aec', QUEUE = '#b078dd';
    const SCLERE = '#f7efff', IRIS = '#8c4bd0', HALO = '#e2beff';

    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Aura psy : une brume mauve qui l'enveloppe à peine ------------------
    //  Règle de lisibilité de tout le projet : l'aura reste PLUS PETITE que la
    //  créature. Elle se devine, elle ne remplace pas la silhouette.
    const aura = glowAura({ r: 0.44, color: HALO, layers: 2, opacity: 0.11,
      squash: 1.28, y: 0.95 });
    root.add(aura);

    // --- Les jambes (digitigrades, à peine fléchies) -------------------------
    //  hanche -> genou -> cheville : trois pivots imbriqués, aucun ellipsoïde
    //  n'est jamais mis à l'échelle. Les pieds flottent à ~0,12 du sol : il
    //  lévite, il ne marche pas.
    const jambes = [];
    [-1, 1].forEach(function (s, i) {
      const hanche = pivot(s * 0.145, 0.77, 0.005);
      hanche.userData.x0 = -0.30;                 // le genou part vers l'AVANT
      hanche.rotation.x = hanche.userData.x0;
      hanche.add(R3.ellipsoid(0.088, 0.155, 0.098, CORPS, 0, -0.145, 0, { rough: 0.6 }));
      const genou = pivot(0, -0.29, 0);
      genou.userData.x0 = 0.60;                   // le tibia repart vers l'ARRIÈRE
      genou.rotation.x = genou.userData.x0;
      genou.add(R3.ellipsoid(0.062, 0.150, 0.072, CORPS, 0, -0.145, 0, { rough: 0.6 }));
      const cheville = pivot(0, -0.30, 0);
      cheville.userData.x0 = -0.30;               // le pied se remet à plat
      cheville.rotation.x = cheville.userData.x0;
      cheville.add(R3.ellipsoid(0.078, 0.048, 0.125, VENTRE, 0, -0.040, 0.048, { rough: 0.7 }));
      genou.add(cheville);
      hanche.add(genou);
      hanche.userData.ph = i * 1.7;
      root.add(hanche);
      jambes.push(hanche);
    });

    // --- Bassin, torse, plastron mauve --------------------------------------
    root.add(R3.ellipsoid(0.195, 0.150, 0.170, CORPS, 0, 0.845, 0.005, { rough: 0.6 }));
    root.add(bodyBlob({ rx: 0.230, ry: 0.235, rz: 0.195, color: CORPS,
      shade: OMBRE, belly: VENTRE, y: 1.055 }));
    root.add(noSh(R3.ellipsoid(0.125, 0.118, 0.045, MAUVE_CLAIR, 0, 1.015, 0.180,
      { rough: 0.55 })));

    // --- Les bras : épaule -> coude -> main, paumes ouvertes -----------------
    const bras = [];
    [-1, 1].forEach(function (s, i) {
      const ep = pivot(s * 0.215, 1.185, 0.000);
      ep.userData.z0 = s * 0.42;
      ep.userData.x0 = -0.10;
      ep.rotation.z = ep.userData.z0;
      ep.rotation.x = ep.userData.x0;
      ep.add(R3.ellipsoid(0.070, 0.145, 0.078, CORPS, 0, -0.125, 0, { rough: 0.6 }));
      const coude = pivot(0, -0.255, 0);
      coude.userData.x0 = -0.55;                  // l'avant-bras vient devant lui
      coude.rotation.x = coude.userData.x0;
      coude.add(R3.ellipsoid(0.058, 0.130, 0.064, CORPS, 0, -0.115, 0, { rough: 0.6 }));
      const main = pivot(0, -0.235, 0);
      main.add(R3.ellipsoid(0.072, 0.058, 0.084, VENTRE, 0, -0.045, 0.022, { rough: 0.7 }));
      coude.add(main);
      ep.add(coude);
      ep.userData.ph = i * 1.3;
      root.add(ep);
      bras.push(ep);
    });
    // Deux épaulettes plus sombres : elles « soudent » les bras au torse.
    [-1, 1].forEach(function (s) {
      root.add(noSh(R3.ellipsoid(0.090, 0.078, 0.085, OMBRE, s * 0.212, 1.200, 0,
        { rough: 0.6 })));
    });

    // --- Cou et TÊTE BULBEUSE -----------------------------------------------
    root.add(R3.cyl(0.070, 0.086, 0.10, CORPS, 0, 1.320, 0.005, { seg: 10 }));
    const tete = pivot(0, 1.455, 0.010);          // pivot d'idle (rotation.z)
    root.add(tete);
    tete.add(R3.ellipsoid(0.168, 0.172, 0.150, CORPS, 0, 0, -0.005, { rough: 0.55 }));
    tete.add(R3.ellipsoid(0.090, 0.072, 0.078, VENTRE, 0, -0.078, 0.115, { rough: 0.6 }));
    // De grands yeux violets : c'est là que tout se joue. Graves, pas durs.
    tete.add(bigEyes({ spread: 0.080, r: 0.058, pupilR: 0.032, scleraColor: SCLERE,
      pupilColor: IRIS, y: 0.020, z: 0.118 }));
    tete.add(R3.blush(0.128, -0.045, 0.088, 0.040));
    tete.add(mouthSmile({ w: 0.042, depth: 0.018, r: 0.012, count: 3,
      y: -0.108, z: 0.152 }));

    // Deux cornes COURTES, tournées vers l'arrière (rien ne doit ressembler à
    // une arme pointée vers l'avant).
    [-1, 1].forEach(function (s) {
      const c = pivot(s * 0.104, 0.132, -0.020);
      c.rotation.z = -s * 0.40;
      c.rotation.x = -0.55;
      c.add(R3.cone(0.036, 0.140, CORPS, 0, 0.070, 0, { seg: 8, rough: 0.5 }));
      tete.add(c);
    });

    // --- LE TUBE DE LA NUQUE : la signature de Mewtwo ------------------------
    //  Trois maillons qui descendent de l'arrière du crâne vers le haut du dos.
    //  Accroché à la TÊTE : il suit d'eux-mêmes tous ses mouvements.
    const tube = [];
    let parentT = tete;
    for (let i = 0; i < 3; i++) {
      const j = pivot(0, i === 0 ? -0.060 : -0.105, i === 0 ? -0.145 : 0);
      j.userData.x0 = (i === 0) ? 0.55 : 0.30;    // + = vers l'arrière en descendant
      j.rotation.x = j.userData.x0;
      j.add(R3.ellipsoid(0.050, 0.062, 0.050, MAUVE, 0, -0.052, 0, { rough: 0.6 }));
      parentT.add(j);
      parentT = j;
      tube.push(j);
    }

    // --- LA QUEUE : longue, épaisse, elle s'enroule vers le haut -------------
    const queue = pivot(0, 0.865, -0.165);        // pivot d'idle (rotation.y)
    queue.rotation.x = -0.25;
    root.add(queue);
    const vertQ = [];
    let parentQ = queue;
    for (let i = 0; i < 6; i++) {
      const j = pivot(0, 0, -0.155);
      j.userData.x0 = 0.22;                       // + = la queue se relève
      j.rotation.x = j.userData.x0;
      const r = 0.084 - i * 0.009;
      j.add(R3.ellipsoid(r, r, 0.098, QUEUE, 0, 0, 0.078, { rough: 0.65 }));
      parentQ.add(j);
      parentQ = j;
      vertQ.push(j);
    }
    parentQ.add(noSh(R3.ellipsoid(0.044, 0.044, 0.052, MAUVE, 0, 0, -0.040,
      { rough: 0.6 })));

    // --- Étincelles psychiques en orbite ------------------------------------
    const anneau = sparkleRing({ count: 6, r: 0.52, size: 0.055,
      color: '#f4cdff', color2: MAUVE, tilt: 0.28, wave: 0.14, y: 1.00 });
    root.add(anneau);

    g.userData.anim = { head: tete, tail: queue, float: true };

    // --- Vie propre : il respire, il médite ---------------------------------
    let boost = 0;
    pilote(g, function (t) {
      // Les bras s'ouvrent très lentement, paumes offertes.
      for (let i = 0; i < bras.length; i++) {
        const s = (i === 0) ? -1 : 1;
        const b = bras[i];
        b.rotation.z = b.userData.z0 + s * (Math.sin(t * 0.62 + b.userData.ph) * 0.09
          + boost * 0.46);
        b.rotation.x = b.userData.x0 + Math.sin(t * 0.55 + i * 1.3) * 0.07 - boost * 0.30;
      }
      // Les jambes pendent et se balancent : il ne touche pas le sol.
      for (let i = 0; i < jambes.length; i++) {
        const j = jambes[i];
        j.rotation.x = j.userData.x0 + Math.sin(t * 0.75 + j.userData.ph) * 0.07;
        j.rotation.z = Math.sin(t * 0.6 + j.userData.ph) * 0.04;
      }
      // La queue ondule maillon par maillon, lentement, comme un fouet au repos.
      for (let i = 0; i < vertQ.length; i++) {
        vertQ[i].rotation.x = vertQ[i].userData.x0 + Math.sin(t * 0.9 - i * 0.5) * 0.045
          + boost * 0.07;
        vertQ[i].rotation.y = Math.sin(t * 0.8 - i * 0.6) * 0.09;
      }
      // Le tube de la nuque suit avec un temps de retard.
      for (let i = 0; i < tube.length; i++) {
        tube[i].rotation.x = tube[i].userData.x0 + Math.sin(t * 1.0 - i * 0.7) * 0.05;
        tube[i].rotation.z = Math.sin(t * 0.85 - i * 0.5) * 0.05;
      }
      aura.scale.setScalar((1 + Math.sin(t * 0.85) * 0.05) * (1 + boost * 0.18));
      animeAnneau(anneau, t, 0.46, 1 + boost * 0.9, 0.14);
      anneau.rotation.z = Math.sin(t * 0.35) * 0.14;
    });

    // --- Attaque « Choc Mental » --------------------------------------------
    //  Il s'élève, lève lentement les deux mains, la tête se redresse et tout
    //  se met à flotter autour de lui. Rien ne grandit : ce sont les bras qui
    //  s'ouvrent et l'anneau qui s'écarte.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.16;
      root.position.z = k * 0.14;
      tete.rotation.x = -k * 0.16;
      queue.rotation.x = -0.25 - k * 0.24;
      anneau.rotation.y = R3.clamp01(p) * Math.PI * 2;
      anneau.scale.set(1 + k * 0.34, 1, 1 + k * 0.34);
    };
    return g;
  });

  // ===========================================================================
  //  RAYQUAZA — « Le dragon vert du ciel. »
  //  Très long serpent vert émeraude, présenté ENROULÉ ET DRESSÉ : son corps
  //  décrit une spirale montante d'une quinzaine d'anneaux, la tête au sommet.
  //  Motifs jaunes en anneaux, nageoires rouges par paires, museau allongé,
  //  quatre cornes jaunes rejetées en arrière. Il lévite.
  //
  //  Le corps est une CHAÎNE DE PERLES posée sur une courbe recalculée à chaque
  //  image (technique de Sablior, p4) : rien n'est jamais mis à l'échelle, ce
  //  sont des POSITIONS de pivots qui bougent. C'est ce qui le fait « couler ».
  // ===========================================================================
  R3.registerCreature('rayquaza', function () {
    const VERT = '#2fbb6d', VERT_CLAIR = '#57d98d', VERT_SOMBRE = '#1c8c52';
    const JAUNE = '#f7d94c', ROUGE = '#e2453c', VENTRE = '#d9f6e4';
    const OEIL = '#ffd83d', HALO = '#8ef0b6';

    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Halo de haute altitude ---------------------------------------------
    const aura = glowAura({ r: 0.46, color: HALO, layers: 2, opacity: 0.09,
      squash: 1.25, y: 0.72 });
    root.add(aura);

    // --- LA SPIRALE ---------------------------------------------------------
    //  u = 0 à la pointe de la queue (en bas, au cœur de la spirale),
    //  u = 1 à l'encolure (en haut). L'onde voyage le long de u : le serpent
    //  ondule sur place sans jamais changer de gabarit.
    const N = 14;
    function courbe(u, t, ampl) {
      const a = -0.55 + u * 9.0;                       // ~1,43 tour
      const rad = (0.44 - 0.32 * Math.pow(u, 1.35))
        + Math.sin(u * 5.5 - t * 1.30) * 0.030 * ampl;
      const y = 0.17 + 1.00 * Math.pow(u, 1.06)
        + Math.sin(u * 4.2 - t * 1.30) * 0.026 * ampl;
      return { x: Math.sin(a) * rad, y: y, z: Math.cos(a) * rad };
    }
    function rayon(u) {
      const bosse = Math.exp(-Math.pow((u - 0.58) / 0.46, 2));
      return (0.040 + 0.068 * bosse) * (0.36 + 0.64 * Math.min(1, u * 3.4));
    }

    const anneaux = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const r = rayon(u);
      const p = pivot(0, 0, 0);
      p.userData.u = u;
      // Le corps : un ellipsoïde par anneau, un peu allongé sur z (l'axe local
      // du corps, puisque chaque pivot est orienté selon la tangente).
      p.add(R3.ellipsoid(r, r * 0.96, r * 1.30,
        (i % 2 === 0) ? VERT : VERT_CLAIR, 0, 0, 0, { rough: 0.72 }));
      // Anneau jaune une perle sur deux : la signature de Rayquaza.
      if (i >= 2 && i % 2 === 0) {
        p.add(noSh(R3.ellipsoid(r * 1.10, r * 1.06, r * 0.26, JAUNE, 0, 0, 0,
          { rough: 0.55, emissive: JAUNE, emissiveIntensity: 0.18 })));
      }
      // Nageoires rouges par paires, à trois endroits du corps.
      if (i === 4 || i === 8 || i === 11) {
        [-1, 1].forEach(function (s) {
          const f = noSh(R3.ellipsoid(0.105, 0.020, 0.070, ROUGE,
            s * (r + 0.075), 0.020, 0, { rough: 0.6 }));
          f.rotation.z = s * 0.50;
          p.add(f);
        });
      }
      root.add(p);
      anneaux.push(p);
    }

    // --- Encolure et tête, portées par le sommet de la spirale ---------------
    const cou = pivot(0, 1.22, -0.07);            // repositionné à chaque image
    root.add(cou);
    cou.add(R3.ellipsoid(0.078, 0.086, 0.090, VERT, 0, 0.075, 0.020, { rough: 0.7 }));
    const cou2 = pivot(0, 0.150, 0.045);
    cou2.rotation.x = 0.30;
    cou2.add(R3.ellipsoid(0.072, 0.078, 0.086, VERT, 0, 0.062, 0, { rough: 0.7 }));
    cou.add(cou2);

    const tete = pivot(0, 0.125, 0.020);          // pivot d'idle (rotation.z)
    cou2.add(tete);
    tete.add(R3.ellipsoid(0.118, 0.108, 0.140, VERT, 0, 0.010, 0.010, { rough: 0.7 }));
    // MUSEAU ALLONGÉ : c'est lui qui fait lire « dragon » plutôt que « serpent ».
    tete.add(R3.ellipsoid(0.082, 0.072, 0.165, VERT, 0, -0.028, 0.205, { rough: 0.7 }));
    tete.add(noSh(R3.ellipsoid(0.066, 0.040, 0.140, VENTRE, 0, -0.072, 0.190,
      { rough: 0.8 })));                                                 // mâchoire
    // Deux bandes jaunes sur les joues.
    [-1, 1].forEach(function (s) {
      tete.add(noSh(R3.ellipsoid(0.030, 0.032, 0.100, JAUNE, s * 0.088, -0.012, 0.130,
        { rough: 0.55 })));
    });
    // Les yeux : globe d'or lumineux, pupille douce, reflet blanc.
    [-1, 1].forEach(function (s) {
      tete.add(lueur(0.048, 0.044, 0.034, OEIL, s * 0.082, 0.038, 0.092, 0.55));
      tete.add(noSh(R3.ellipsoid(0.022, 0.026, 0.016, '#3a2a08', s * 0.084, 0.036, 0.118,
        { rough: 0.5 })));
      tete.add(noSh(R3.sphere(0.011, '#ffffff', s * 0.092, 0.052, 0.126, { rough: 0.2 })));
    });
    tete.add(R3.blush(0.108, -0.026, 0.098, 0.036));
    tete.add(mouthSmile({ w: 0.046, depth: 0.018, r: 0.012, count: 3,
      y: -0.086, z: 0.300 }));

    // Quatre cornes jaunes rejetées EN ARRIÈRE (jamais vers l'avant).
    const cornes = [];
    [[-1, 0.075, 0.085, 0.150], [1, 0.075, 0.085, 0.150],
     [-1, 0.098, 0.020, 0.105], [1, 0.098, 0.020, 0.105]].forEach(function (C, i) {
      const s = C[0];
      const c = pivot(s * C[1], C[2], -0.045);
      c.userData.z0 = -s * (0.35 + (i > 1 ? 0.30 : 0));
      c.userData.x0 = -0.95;
      c.rotation.z = c.userData.z0;
      c.rotation.x = c.userData.x0;
      c.add(R3.cone(0.026, C[3], JAUNE, 0, C[3] * 0.5, 0, { seg: 7, rough: 0.5 }));
      tete.add(c);
      cornes.push(c);
    });

    // --- Traînée d'étoiles : Draco-Météore au repos --------------------------
    const etoiles = sparkleRing({ count: 6, r: 0.54, size: 0.056,
      color: '#c8ffe0', color2: JAUNE, tilt: 0.26, wave: 0.16, y: 0.86 });
    root.add(etoiles);

    g.userData.anim = { head: tete, float: true };

    // --- Vie propre : la spirale coule --------------------------------------
    //  ampl > 1 pendant l'attaque : l'onde s'amplifie, la COURBE ne s'allonge
    //  jamais — le gabarit reste identique du début à la fin.
    let boost = 0;
    function formeCorps(t, ampl) {
      for (let i = 0; i < anneaux.length; i++) {
        const p = anneaux[i];
        const u = p.userData.u;
        const c = courbe(u, t, ampl);
        p.position.set(c.x, c.y, c.z);
        // Chaque perle regarde le long de la tangente : les anneaux jaunes
        // deviennent de vraies bagues et les nageoires sortent bien de côté.
        const a = courbe(Math.min(1, u + 0.03), t, ampl);
        const b = courbe(Math.max(0, u - 0.03), t, ampl);
        p.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
      }
      const c1 = courbe(1.0, t, ampl);
      const c0 = courbe(0.92, t, ampl);
      cou.position.set(c1.x, c1.y + 0.045, c1.z);
      // L'encolure se redresse et suit doucement la tangente en lacet.
      cou.rotation.y = Math.atan2(c1.x - c0.x, Math.max(0.001, c1.z - c0.z)) * 0.25;
      cou.rotation.x = -0.20 + Math.sin(t * 0.75) * 0.05 - boost * 0.22;
      cou.rotation.z = Math.sin(t * 0.6) * 0.05;
    }
    formeCorps(0, 1);

    pilote(g, function (t) {
      formeCorps(t, 1 + boost * 1.1);
      for (let i = 0; i < cornes.length; i++) {
        const c = cornes[i];
        const s = (i % 2 === 0) ? -1 : 1;
        c.rotation.z = c.userData.z0 - s * Math.sin(t * 1.1 + i) * 0.05;
        c.rotation.x = c.userData.x0 + Math.sin(t * 0.9 + i * 0.7) * 0.04 - boost * 0.12;
      }
      aura.scale.setScalar((1 + Math.sin(t * 0.8) * 0.05) * (1 + boost * 0.16));
      animeAnneau(etoiles, t, 0.58, 1 + boost * 1.0, 0.16);
      etoiles.rotation.z = Math.sin(t * 0.38) * 0.12;
    });

    // --- Attaque « Draco-Météore » ------------------------------------------
    //  Toute la spirale se met à onduler fort, la tête se dresse vers le ciel
    //  et les étoiles filantes tournent autour de lui.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.12;
      root.position.z = k * 0.18;
      tete.rotation.x = -k * 0.26;
      etoiles.rotation.y = R3.clamp01(p) * Math.PI * 2;
      etoiles.scale.set(1 + k * 0.30, 1, 1 + k * 0.30);
    };
    return g;
  });

  // ===========================================================================
  //  LUGIA — « Le gardien blanc et bleu des mers. »
  //  Blanc et bleu ciel, museau pointu, grandes AILES-MAINS à trois doigts,
  //  plaques bleues alignées sur le dos, double queue à deux lobes. Il lévite,
  //  ses petites pattes pendent. Très majestueux : tout est lent chez lui.
  // ===========================================================================
  R3.registerCreature('lugia', function () {
    const BLANC = '#f6fbff', BLANC_CHAUD = '#ffffff', OMBRE = '#d7ebf8';
    const BLEU = '#7fb6dd', BLEU_PALE = '#cfe6f5', BLEU_FONCE = '#4f86b8';
    const OEIL = '#2f5f92', HALO = '#cfeaff';

    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Halo marin ---------------------------------------------------------
    const aura = glowAura({ r: 0.46, color: HALO, layers: 2, opacity: 0.11,
      squash: 1.10, y: 0.92 });
    root.add(aura);

    // --- Le corps -----------------------------------------------------------
    root.add(bodyBlob({ rx: 0.255, ry: 0.275, rz: 0.345, color: BLANC,
      shade: OMBRE, belly: BLANC_CHAUD, y: 0.85 }));

    // --- LES PLAQUES DU DOS : cinq écailles bleues alignées ------------------
    //  C'est le détail qui fait reconnaître Lugia de dos et de profil.
    const plaques = [];
    [[0.12, 1.105, -0.10], [0.00, 1.125, -0.14], [-0.13, 1.115, -0.17],
     [-0.25, 1.070, -0.20], [-0.35, 0.995, -0.22]].forEach(function (P, i) {
      const q = pivot(0, P[1], P[0]);
      q.rotation.x = P[2];
      q.add(noSh(R3.ellipsoid(0.088 - i * 0.006, 0.050, 0.082 - i * 0.005, BLEU,
        0, 0, 0, { rough: 0.6 })));
      root.add(q);
      plaques.push(q);
    });

    // --- Deux petites pattes qui pendent -------------------------------------
    const pattes = [];
    [-1, 1].forEach(function (s, i) {
      const h = pivot(s * 0.135, 0.62, 0.075);
      h.userData.x0 = 0.30;
      h.rotation.x = h.userData.x0;
      h.add(R3.ellipsoid(0.058, 0.125, 0.062, BLANC, 0, -0.115, 0, { rough: 0.65 }));
      const pied = pivot(0, -0.235, 0);
      pied.userData.x0 = -0.30;
      pied.rotation.x = pied.userData.x0;
      pied.add(R3.ellipsoid(0.068, 0.042, 0.105, BLEU_PALE, 0, -0.040, 0.030,
        { rough: 0.7 }));
      h.add(pied);
      h.userData.ph = i * 1.5;
      root.add(h);
      pattes.push(h);
    });

    // --- LA DOUBLE QUEUE ----------------------------------------------------
    const queue = pivot(0, 0.80, -0.32);          // pivot d'idle (rotation.y)
    root.add(queue);
    const vertQ = [];
    let parentQ = queue;
    for (let i = 0; i < 2; i++) {
      const j = pivot(0, 0, -0.22);
      j.userData.x0 = -0.55;                      // - = la queue descend derrière
      j.rotation.x = j.userData.x0;
      j.add(R3.ellipsoid(0.085 - i * 0.014, 0.075 - i * 0.012, 0.130, BLANC,
        0, 0, 0.110, { rough: 0.65 }));
      parentQ.add(j);
      parentQ = j;
      vertQ.push(j);
    }
    const lobes = [];
    [-1, 1].forEach(function (s) {
      const l = pivot(s * 0.045, -0.02, -0.05);
      l.userData.z0 = s * 0.30;
      l.rotation.z = l.userData.z0;
      l.rotation.x = -0.35;
      l.add(noSh(R3.ellipsoid(0.052, 0.145, 0.062, BLEU_PALE, 0, -0.130, -0.010,
        { rough: 0.7 })));
      parentQ.add(l);
      lobes.push(l);
    });

    // --- Le long cou, en trois tronçons --------------------------------------
    const cou = pivot(0, 1.055, 0.100);
    cou.rotation.x = -0.12;
    cou.add(R3.ellipsoid(0.098, 0.105, 0.098, BLANC, 0, 0.085, 0, { rough: 0.6 }));
    const cou2 = pivot(0, 0.168, 0);
    cou2.rotation.x = 0.10;
    cou2.add(R3.ellipsoid(0.088, 0.098, 0.090, BLANC, 0, 0.080, 0, { rough: 0.6 }));
    cou.add(cou2);
    const cou3 = pivot(0, 0.158, 0);
    cou3.rotation.x = 0.14;
    cou3.add(R3.ellipsoid(0.080, 0.090, 0.082, BLANC, 0, 0.072, 0, { rough: 0.6 }));
    cou2.add(cou3);
    root.add(cou);

    // --- La tête ------------------------------------------------------------
    const tete = pivot(0, 0.152, 0.010);          // pivot d'idle (rotation.z)
    cou3.add(tete);
    tete.add(R3.ellipsoid(0.135, 0.130, 0.160, BLANC, 0, 0, 0.005, { rough: 0.55 }));
    // MUSEAU POINTU : la marque de Lugia.
    tete.add(R3.ellipsoid(0.078, 0.068, 0.145, BLANC, 0, -0.028, 0.190, { rough: 0.55 }));
    tete.add(noSh(R3.ellipsoid(0.062, 0.038, 0.115, BLEU_PALE, 0, -0.072, 0.170,
      { rough: 0.7 })));
    // Les yeux : sclère bleutée, pupille bleu profond, reflet.
    [-1, 1].forEach(function (s) {
      tete.add(noSh(R3.ellipsoid(0.050, 0.044, 0.032, '#eef7ff', s * 0.086, 0.028, 0.118,
        { rough: 0.4 })));
      tete.add(noSh(R3.ellipsoid(0.026, 0.030, 0.018, OEIL, s * 0.088, 0.026, 0.142,
        { rough: 0.45 })));
      tete.add(noSh(R3.sphere(0.011, '#ffffff', s * 0.096, 0.042, 0.150, { rough: 0.2 })));
    });
    tete.add(R3.blush(0.116, -0.032, 0.104, 0.038));
    tete.add(mouthSmile({ w: 0.044, depth: 0.018, r: 0.012, count: 3,
      y: -0.092, z: 0.280 }));
    // Les deux ailerons de tête, largement rejetés en arrière.
    const ailerons = [];
    [-1, 1].forEach(function (s) {
      const a = pivot(s * 0.112, 0.048, -0.055);
      a.userData.z0 = -s * 0.50;
      a.userData.x0 = -0.80;
      a.rotation.z = a.userData.z0;
      a.rotation.x = a.userData.x0;
      a.add(noSh(R3.ellipsoid(0.028, 0.150, 0.072, BLEU, 0, 0.115, -0.010,
        { rough: 0.6 })));
      tete.add(a);
      ailerons.push(a);
    });

    // --- LES AILES-MAINS ----------------------------------------------------
    //  Un bras, une paume, trois grands doigts : la silhouette de Lugia tient
    //  entièrement là-dedans. Le pivot est à l'épaule ; les ailes partent vers
    //  l'extérieur ET vers l'arrière (rotation.y positive côté droit).
    const ailes = [];
    [-1, 1].forEach(function (s, i) {
      const a = pivot(s * 0.230, 1.005, -0.055);
      a.userData.z0 = s * 0.26;
      a.userData.y0 = s * 0.40;      // vers l'arrière, jamais vers l'avant
      a.rotation.z = a.userData.z0;
      a.rotation.y = a.userData.y0;

      a.add(R3.ellipsoid(0.175, 0.058, 0.085, BLANC, s * 0.170, 0.010, 0,
        { rough: 0.6 }));
      a.add(R3.ellipsoid(0.120, 0.072, 0.125, BLANC, s * 0.375, -0.015, -0.020,
        { rough: 0.6 }));
      // Trois doigts en éventail, de plus en plus courts vers l'arrière.
      [[0.180, 0.055, 0.075, 0.20], [0.185, 0.030, -0.030, 0.00],
       [0.155, -0.010, -0.130, -0.24]].forEach(function (D) {
        const d = R3.ellipsoid(D[0], 0.032, 0.050, BLANC_CHAUD,
          s * (0.375 + D[0] * 0.95), D[1], D[2], { rough: 0.62 });
        d.rotation.z = s * D[3];
        d.rotation.y = -s * 0.14;
        a.add(d);
      });
      a.userData.ph = i * 1.1;
      root.add(a);
      ailes.push(a);
    });

    // --- Paillettes de vent argenté -----------------------------------------
    const paillettes = sparkleRing({ count: 6, r: 0.58, size: 0.056,
      color: '#eaf7ff', color2: BLEU, tilt: 0.26, wave: 0.14, y: 0.98 });
    root.add(paillettes);

    g.userData.anim = { head: tete, wingL: ailes[0], wingR: ailes[1],
      tail: queue, float: true };

    // --- Vie propre : il plane, il chante ------------------------------------
    let boost = 0;
    pilote(g, function (t) {
      // Battements TRÈS lents et très amples : un planeur, pas un moineau.
      const bat = Math.sin(t * 0.95);
      for (let i = 0; i < ailes.length; i++) {
        const s = (i === 0) ? -1 : 1;
        const a = ailes[i];
        a.rotation.z = a.userData.z0 + s * (bat * 0.24 + boost * 0.62);
        a.rotation.y = a.userData.y0 - s * (Math.sin(t * 0.95 - 0.6) * 0.10 + boost * 0.30);
        a.rotation.x = Math.sin(t * 0.8 + i) * 0.06;
      }
      // Les pattes pendent et se balancent.
      for (let i = 0; i < pattes.length; i++) {
        const p = pattes[i];
        p.rotation.x = p.userData.x0 + Math.sin(t * 0.9 + p.userData.ph) * 0.10;
        p.rotation.z = Math.sin(t * 0.75 + p.userData.ph) * 0.05;
      }
      // La double queue ondule, les deux lobes s'ouvrent et se referment.
      for (let i = 0; i < vertQ.length; i++) {
        vertQ[i].rotation.x = vertQ[i].userData.x0 + Math.sin(t * 0.9 - i * 0.6) * 0.07
          - boost * 0.10;
        vertQ[i].rotation.y = Math.sin(t * 0.85 - i * 0.7) * 0.10;
      }
      for (let i = 0; i < lobes.length; i++) {
        const s = (i === 0) ? -1 : 1;
        lobes[i].rotation.z = lobes[i].userData.z0 + s * (Math.sin(t * 1.0 + i) * 0.10
          + boost * 0.20);
      }
      // Les ailerons de tête frémissent.
      for (let i = 0; i < ailerons.length; i++) {
        const s = (i === 0) ? -1 : 1;
        ailerons[i].rotation.z = ailerons[i].userData.z0 - s * Math.sin(t * 1.2 + i) * 0.07;
        ailerons[i].rotation.x = ailerons[i].userData.x0 + Math.sin(t * 1.0 + i * 0.8) * 0.06;
      }
      // Les plaques du dos respirent une par une, comme une vague.
      for (let i = 0; i < plaques.length; i++) {
        plaques[i].rotation.z = Math.sin(t * 0.9 - i * 0.6) * 0.06;
      }
      aura.scale.setScalar((1 + Math.sin(t * 0.75) * 0.05) * (1 + boost * 0.18));
      animeAnneau(paillettes, t, 0.44, 1 + boost * 0.9, 0.14);
    });

    // --- Attaque « Aéroblast » ----------------------------------------------
    //  Il s'élève, ouvre ses ailes-mains en grand et lance un long chant : un
    //  geste ample et calme, jamais un coup.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.18;
      root.position.z = k * 0.20;
      cou.rotation.x = -0.12 - k * 0.22;
      tete.rotation.x = k * 0.14;
      paillettes.rotation.y = R3.clamp01(p) * Math.PI * 2;
      paillettes.scale.set(1 + k * 0.28, 1, 1 + k * 0.28);
    };
    return g;
  });

  // ===========================================================================
  //  HO-OH — « Le grand oiseau arc-en-ciel. »
  //  Rouge et or, ailes déployées, crête verte, IMMENSE queue de plumes aux
  //  sept couleurs, et trois arcs d'arc-en-ciel translucides qui l'entourent.
  //  Il se pose vraiment sur ses grandes pattes dorées (pas de lévitation).
  // ===========================================================================
  R3.registerCreature('hooh', function () {
    const ROUGE = '#e8503f', ROUGE_SOMBRE = '#c23a2e', OR = '#f7c948';
    const OR_CLAIR = '#ffe07a', BLANC = '#fff6e0', VERT = '#4cc27a';
    const VERT_CLAIR = '#8ce0a8', BLEU_CIEL = '#7fc4f0', HALO = '#ffe6a0';

    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Halo doré ----------------------------------------------------------
    const aura = glowAura({ r: 0.44, color: HALO, layers: 2, opacity: 0.13,
      squash: 1.08, y: 0.95 });
    root.add(aura);

    // --- LES TROIS ARCS D'ARC-EN-CIEL ---------------------------------------
    //  Des tores translucides derrière lui : c'est ce qui se voit de très loin
    //  et ce qui dit « oiseau arc-en-ciel » sans un mot. Volontairement très
    //  transparents (la sonde les compte comme des halos, pas comme du corps).
    const arcs = pivot(0, 1.02, -0.34);
    arcs.rotation.x = 0.30;
    root.add(arcs);
    [[0.56, '#e8503f'], [0.635, '#f7c948'], [0.71, '#4cc27a']].forEach(function (A, i) {
      const t = R3.torus(A[0], 0.024, A[1], 0, 0, 0, {
        seg: 20, transparent: true, opacity: 0.34, depthWrite: false,
        emissive: A[1], emissiveIntensity: 0.8, rough: 0.3, side: THREE.DoubleSide,
      });
      noSh(t);
      t.userData.i = i;
      arcs.add(t);
    });

    // --- Les pattes dorées ---------------------------------------------------
    [-1, 1].forEach(function (s) {
      root.add(R3.cyl(0.032, 0.040, 0.44, OR, s * 0.098, 0.350, 0.030, { seg: 8 }));
      root.add(noSh(R3.ellipsoid(0.080, 0.046, 0.115, OR_CLAIR, s * 0.098, 0.048, 0.062,
        { rough: 0.7 })));
    });

    // --- Le corps ------------------------------------------------------------
    root.add(bodyBlob({ rx: 0.245, ry: 0.275, rz: 0.245, color: ROUGE,
      shade: ROUGE_SOMBRE, belly: OR_CLAIR, y: 0.86 }));
    // Le plastron de soleil : son écusson.
    root.add(lueur(0.085, 0.085, 0.035, OR_CLAIR, 0, 0.895, 0.215, 0.75));

    // --- Cou et tête ---------------------------------------------------------
    const cou = pivot(0, 1.090, 0.045);
    cou.rotation.x = -0.10;
    cou.add(R3.ellipsoid(0.096, 0.096, 0.092, ROUGE, 0, 0.060, 0, { rough: 0.62 }));
    const cou2 = pivot(0, 0.118, 0);
    cou2.rotation.x = 0.06;
    cou2.add(R3.ellipsoid(0.086, 0.082, 0.084, ROUGE, 0, 0.050, 0, { rough: 0.62 }));
    cou.add(cou2);
    root.add(cou);

    const tete = pivot(0, 0.128, 0.020);          // pivot d'idle (rotation.z)
    cou2.add(tete);
    tete.add(R3.ellipsoid(0.150, 0.142, 0.145, ROUGE, 0, 0, 0, { rough: 0.6 }));
    tete.add(birdBeak({ len: 0.160, r: 0.058, color: OR, wide: 1.05, droop: 0.85,
      y: -0.022, z: 0.185, tilt: 0.10 }));
    tete.add(bigEyes({ spread: 0.080, r: 0.054, pupilR: 0.030, scleraColor: '#fff8e8',
      pupilColor: '#3b2b1a', y: 0.032, z: 0.118 }));
    tete.add(R3.blush(0.122, -0.030, 0.098, 0.040));

    // La crête verte : trois plumes dressées.
    const crete = [];
    [[-0.058, 0.150, 0.30, VERT], [0.000, 0.185, 0.00, VERT_CLAIR],
     [0.058, 0.150, -0.30, VERT]].forEach(function (C, i) {
      const p = pivot(C[0], 0.108, -0.020);
      p.userData.z0 = C[2];
      p.rotation.z = C[2];
      p.rotation.x = -0.24;
      p.add(lueur(0.028, C[1] * 0.5, 0.022, C[3], 0, C[1] * 0.5, 0, 0.55));
      p.userData.ph = i * 1.1;
      tete.add(p);
      crete.push(p);
    });

    // --- LES AILES DÉPLOYÉES -------------------------------------------------
    //  Une masse d'aile + quatre rémiges, de plus en plus claires vers le bout.
    const ailes = [];
    [-1, 1].forEach(function (s, i) {
      const a = pivot(s * 0.200, 0.985, -0.030);
      a.userData.z0 = s * 0.30;
      a.userData.y0 = s * 0.24;      // vers l'arrière, jamais vers l'avant
      a.rotation.z = a.userData.z0;
      a.rotation.y = a.userData.y0;
      a.add(R3.ellipsoid(0.140, 0.078, 0.135, ROUGE, s * 0.110, -0.020, -0.020,
        { rough: 0.62 }));
      [[0.230, 0.185, 0.080, ROUGE, 0.28], [0.350, 0.170, 0.066, OR, 0.04],
       [0.445, 0.145, 0.054, OR_CLAIR, -0.22], [0.510, 0.115, 0.044, BLANC, -0.46]]
        .forEach(function (P) {
          const f = R3.ellipsoid(P[1], 0.022, P[2], P[3],
            s * P[0], -0.020 + P[4] * 0.06, -0.030 - P[4] * 0.05, { rough: 0.6 });
          f.rotation.z = s * P[4];
          f.rotation.y = -s * 0.18;
          a.add(f);
        });
      a.userData.ph = i * 1.2;
      root.add(a);
      ailes.push(a);
    });

    // --- L'IMMENSE QUEUE DE PLUMES ------------------------------------------
    //  Cinq longues plumes aux couleurs de l'arc-en-ciel, chacune terminée par
    //  une pointe dorée. C'est la moitié de sa silhouette.
    const queue = pivot(0, 0.800, -0.220);        // pivot d'idle (rotation.y)
    root.add(queue);
    const plumesQ = [];
    [[-2, 0.50, VERT, -2.20], [-1, 0.58, OR, -2.10], [0, 0.64, ROUGE, -2.02],
     [1, 0.58, OR, -2.10], [2, 0.50, VERT_CLAIR, -2.20]].forEach(function (Q, i) {
      const p = pivot(Q[0] * 0.052, 0, 0);
      p.userData.z0 = -Q[0] * 0.15;
      p.userData.x0 = Q[3];                       // très négatif : vers l'arrière-bas
      p.userData.len = Q[1];
      p.rotation.z = p.userData.z0;
      p.rotation.x = p.userData.x0;
      p.add(R3.ellipsoid(0.032, Q[1] * 0.5, 0.020, Q[2], 0, Q[1] * 0.5, 0,
        { rough: 0.6 }));
      p.add(noSh(R3.ellipsoid(0.036, 0.055, 0.024, OR_CLAIR, 0, Q[1] + 0.020, 0,
        { rough: 0.45, emissive: OR_CLAIR, emissiveIntensity: 0.35 })));
      p.userData.ph = i * 0.9;
      queue.add(p);
      plumesQ.push(p);
    });

    // --- Plumes d'or en orbite ----------------------------------------------
    const rayons = sparkleRing({ count: 8, r: 0.54, size: 0.056,
      color: OR_CLAIR, color2: BLEU_CIEL, tilt: 0.24, wave: 0.14, y: 0.95 });
    root.add(rayons);

    g.userData.anim = { head: tete, wingL: ailes[0], wingR: ailes[1], tail: queue };

    // --- Vie propre : il plane sur place, l'arc-en-ciel tourne ---------------
    let boost = 0;
    pilote(g, function (t) {
      const bat = Math.sin(t * 1.05);
      for (let i = 0; i < ailes.length; i++) {
        const s = (i === 0) ? -1 : 1;
        const a = ailes[i];
        a.rotation.z = a.userData.z0 + s * (bat * 0.28 + boost * 0.62);
        a.rotation.y = a.userData.y0 - s * (Math.sin(t * 1.05 - 0.6) * 0.12 + boost * 0.26);
        a.rotation.x = Math.sin(t * 0.85 + i) * 0.07;
      }
      // La queue s'ouvre et se referme comme un éventail.
      for (let i = 0; i < plumesQ.length; i++) {
        const p = plumesQ[i];
        p.rotation.z = p.userData.z0 + Math.sin(t * 0.9 + p.userData.ph) * 0.10
          - p.userData.z0 * boost * 0.55;
        p.rotation.x = p.userData.x0 + Math.sin(t * 0.75 + p.userData.ph) * 0.08
          + boost * 0.22;
      }
      // La crête frémit.
      for (let i = 0; i < crete.length; i++) {
        const c = crete[i];
        c.rotation.z = c.userData.z0 + Math.sin(t * 1.25 + c.userData.ph) * 0.09;
        c.rotation.x = -0.24 - boost * 0.18 + Math.sin(t * 1.05 + c.userData.ph) * 0.06;
      }
      // Les arcs tournent très lentement, chacun à sa vitesse.
      arcs.rotation.z = Math.sin(t * 0.30) * 0.16;
      for (let i = 0; i < arcs.children.length; i++) {
        arcs.children[i].rotation.z = t * (0.12 + i * 0.05);
      }
      aura.scale.setScalar((1 + Math.sin(t * 0.95) * 0.06) * (1 + boost * 0.20));
      animeAnneau(rayons, t, 0.50, 1 + boost * 1.0, 0.14);
    });

    // --- Attaque « Feu Sacré » ----------------------------------------------
    //  Il s'élève d'un grand coup d'aile, la queue s'ouvre en éventail et une
    //  flamme dorée l'entoure : elle ne brûle pas, elle réchauffe.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.20;
      root.position.z = k * 0.18;
      cou.rotation.x = -0.10 - k * 0.18;
      tete.rotation.x = -k * 0.14;
      rayons.rotation.y = R3.clamp01(p) * Math.PI * 2;
      rayons.scale.set(1 + k * 0.30, 1, 1 + k * 0.30);
      arcs.scale.setScalar(1 + k * 0.16);          // pivot nu : sans danger
    };
    return g;
  });

  // ===========================================================================
  //  ARCEUS — « On dit qu'il a créé le monde entier. »
  //  Quadrupède blanc crème et gris, sabots dorés, museau doux, yeux verts, et
  //  surtout L'ANNEAU DORÉ qui l'entoure — sa signature absolue. L'anneau tourne
  //  tout seul, en permanence, avec ses quatre pointes.
  //  Il repose sur le sol : c'est le seul qui pose vraiment ses quatre sabots.
  // ===========================================================================
  R3.registerCreature('arceus', function () {
    const CREME = '#fbf6ea', CREME_OMBRE = '#e9e0cc', GRIS = '#b9bcc4';
    const GRIS_CLAIR = '#d7dae0', OR = '#f4c33c', OR_CLAIR = '#ffdd77';
    const VERT_OEIL = '#3fc46e', HALO = '#fff2c8';

    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // --- Halo de commencement du monde ---------------------------------------
    const aura = glowAura({ r: 0.46, color: HALO, layers: 2, opacity: 0.11,
      squash: 1.05, y: 0.92 });
    root.add(aura);

    // --- L'ANNEAU DORÉ : SA SIGNATURE ---------------------------------------
    //  Un tore doré planté dans le plan XY, autour du milieu du corps, avec
    //  quatre pointes réparties dessus. C'est un GROUPE que l'on fait tourner
    //  (jamais une échelle sur un ellipsoïde).
    const anneauOr = pivot(0, 0.885, -0.030);
    anneauOr.rotation.x = 0.12;
    root.add(anneauOr);
    const roue = pivot(0, 0, 0);
    anneauOr.add(roue);
    roue.add(R3.torus(0.520, 0.046, OR, 0, 0, 0, {
      seg: 22, rough: 0.32, metal: 0.25, emissive: OR, emissiveIntensity: 0.30,
    }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const p = noSh(R3.ellipsoid(0.040, 0.105, 0.040, OR_CLAIR,
        Math.cos(a) * 0.545, Math.sin(a) * 0.545, 0,
        { rough: 0.3, emissive: OR_CLAIR, emissiveIntensity: 0.45 }));
      p.rotation.z = a - Math.PI / 2;
      roue.add(p);
    }

    // --- Le corps ------------------------------------------------------------
    root.add(bodyBlob({ rx: 0.235, ry: 0.220, rz: 0.345, color: CREME,
      shade: CREME_OMBRE, belly: GRIS_CLAIR, y: 0.905 }));
    // Le plastron gris : le dessous de son corps, très reconnaissable.
    root.add(noSh(R3.ellipsoid(0.180, 0.105, 0.260, GRIS, 0, 0.735, 0.020,
      { rough: 0.75 })));

    // --- Quatre pattes, SABOTS DORÉS au bout ---------------------------------
    //  hanche -> genou -> sabot. Les sabots touchent exactement y = 0 : Arceus
    //  ne lévite pas, il marche sur le monde qu'il a fait.
    const pattes = [];
    [[-1, 0.240], [1, 0.240], [-1, -0.255], [1, -0.255]].forEach(function (L, i) {
      const s = L[0], dz = L[1];
      const hanche = pivot(s * 0.150, 0.800, dz);
      hanche.userData.x0 = (dz > 0 ? -0.06 : 0.06);
      hanche.rotation.x = hanche.userData.x0;
      hanche.add(R3.cyl(0.052, 0.070, 0.30, CREME, 0, -0.150, 0, { seg: 8 }));
      const genou = pivot(0, -0.300, 0);
      genou.userData.x0 = (dz > 0 ? 0.07 : -0.07);
      genou.rotation.x = genou.userData.x0;
      genou.add(R3.cyl(0.036, 0.048, 0.30, GRIS_CLAIR, 0, -0.150, 0, { seg: 8 }));
      genou.add(lueur(0.060, 0.100, 0.066, OR, 0, -0.396, 0.008, 0.35));
      hanche.add(genou);
      hanche.userData.ph = i * 1.7;
      root.add(hanche);
      pattes.push(hanche);
    });

    // --- La queue ------------------------------------------------------------
    const queue = pivot(0, 0.960, -0.330);        // pivot d'idle (rotation.y)
    queue.rotation.x = -0.35;
    root.add(queue);
    queue.add(R3.ellipsoid(0.062, 0.070, 0.120, CREME, 0, -0.030, -0.090,
      { rough: 0.7 }));
    queue.add(noSh(R3.ellipsoid(0.048, 0.055, 0.090, GRIS_CLAIR, 0, -0.075, -0.190,
      { rough: 0.75 })));

    // --- L'encolure ----------------------------------------------------------
    const cou = pivot(0, 0.985, 0.260);
    cou.rotation.x = 0.40;
    cou.add(R3.cyl(0.088, 0.108, 0.21, CREME, 0, 0.105, 0, { seg: 10 }));
    const cou2 = pivot(0, 0.210, 0);
    cou2.rotation.x = -0.30;
    cou2.add(R3.cyl(0.076, 0.090, 0.16, CREME, 0, 0.080, 0, { seg: 10 }));
    cou.add(cou2);
    root.add(cou);

    // --- La tête -------------------------------------------------------------
    const tete = pivot(0, 0.175, 0);              // pivot d'idle (rotation.z)
    cou2.add(tete);
    tete.add(R3.ellipsoid(0.128, 0.130, 0.158, CREME, 0, 0.012, 0.025, { rough: 0.6 }));
    tete.add(R3.ellipsoid(0.084, 0.074, 0.108, CREME, 0, -0.048, 0.160, { rough: 0.62 }));
    // Le masque gris du visage : le détail qui fait « Arceus » au premier coup d'œil.
    tete.add(noSh(R3.ellipsoid(0.104, 0.078, 0.092, GRIS, 0, 0.048, 0.108,
      { rough: 0.7 })));
    tete.add(bigEyes({ spread: 0.082, r: 0.050, pupilR: 0.028, scleraColor: '#f8fbff',
      pupilColor: VERT_OEIL, y: 0.036, z: 0.132 }));
    tete.add(R3.blush(0.112, -0.032, 0.108, 0.038));
    tete.add(mouthSmile({ w: 0.040, depth: 0.016, r: 0.012, count: 3,
      y: -0.090, z: 0.238 }));
    // Deux plaques dorées sur les joues.
    [-1, 1].forEach(function (s) {
      tete.add(noSh(R3.ellipsoid(0.026, 0.052, 0.062, OR, s * 0.116, -0.010, 0.055,
        { rough: 0.4, emissive: OR, emissiveIntensity: 0.25 })));
    });
    // La crête grise : trois pointes rejetées en arrière.
    const crete = [];
    [[-0.060, 0.140, 0.34], [0.000, 0.175, 0.00], [0.060, 0.140, -0.34]]
      .forEach(function (C, i) {
        const p = pivot(C[0], 0.098, -0.055);
        p.userData.z0 = C[2];
        p.userData.x0 = -0.75;                    // - = vers l'arrière
        p.rotation.z = C[2];
        p.rotation.x = p.userData.x0;
        p.add(R3.ellipsoid(0.030, C[1] * 0.5, 0.024, GRIS, 0, C[1] * 0.5, 0,
          { rough: 0.65 }));
        p.userData.ph = i * 1.2;
        tete.add(p);
        crete.push(p);
      });

    // --- Poussière d'étoiles primordiale ------------------------------------
    const etoiles = sparkleRing({ count: 6, r: 0.60, size: 0.056,
      color: OR_CLAIR, color2: '#ffffff', tilt: 0.22, wave: 0.14, y: 0.90 });
    root.add(etoiles);

    g.userData.anim = { head: tete, tail: queue };

    // --- Vie propre : l'anneau tourne, toujours ------------------------------
    let boost = 0;
    pilote(g, function (t) {
      // L'ANNEAU : le geste le plus important du modèle. Lent, régulier,
      // hypnotique. Il s'incline aussi très légèrement.
      roue.rotation.z = t * (0.34 + boost * 1.5);
      anneauOr.rotation.x = 0.12 + Math.sin(t * 0.40) * 0.07 - boost * 0.10;
      anneauOr.rotation.y = Math.sin(t * 0.28) * 0.16;
      // Un très léger report de poids d'une patte sur l'autre : majestueux.
      for (let i = 0; i < pattes.length; i++) {
        const p = pattes[i];
        p.rotation.x = p.userData.x0 + Math.sin(t * 0.8 + p.userData.ph) * 0.022;
      }
      // La crête frémit, la queue balaie.
      for (let i = 0; i < crete.length; i++) {
        const c = crete[i];
        c.rotation.z = c.userData.z0 + Math.sin(t * 1.15 + c.userData.ph) * 0.08;
        c.rotation.x = c.userData.x0 + Math.sin(t * 0.95 + c.userData.ph) * 0.06
          - boost * 0.16;
      }
      queue.rotation.x = -0.35 + Math.sin(t * 0.95) * 0.10;
      aura.scale.setScalar((1 + Math.sin(t * 0.85) * 0.05) * (1 + boost * 0.18));
      animeAnneau(etoiles, t, 0.40, 1 + boost * 1.0, 0.14);
    });

    // --- Attaque « Jugement » ------------------------------------------------
    //  Il se cabre à peine, lève la tête, et son anneau s'emballe pendant que
    //  mille traits de lumière descendent. Ample, solennel, jamais brutal.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      boost = k;
      root.position.y = k * 0.11;
      root.position.z = k * 0.16;
      root.rotation.x = -k * 0.11;                // l'avant se soulève
      cou.rotation.x = 0.40 - k * 0.28;           // l'encolure se redresse
      tete.rotation.x = -k * 0.16;
      etoiles.rotation.y = R3.clamp01(p) * Math.PI * 2;
      etoiles.scale.set(1 + k * 0.26, 1, 1 + k * 0.26);
    };
    return g;
  });

  // Enregistrement du lot (informatif : utile au débogage en console).
  R3.register('creaturesP9', {
    ids: ['mewtwo', 'rayquaza', 'lugia', 'hooh', 'arceus'],
    legendary: true,
  });
})();
