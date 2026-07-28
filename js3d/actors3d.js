// =============================================================================
//  actors3d.js — LE JOUEUR ET LES 18 PNJ, en volume
// =============================================================================
//  Un personnage est un petit bonhomme « chibi » : grosse tête (environ un tiers
//  de la hauteur), corps rond, membres courts. Toute la hiérarchie est faite
//  d'Object3D pivots pour pouvoir l'animer :
//
//      groupe (racine, posée sur le sol)
//        └ rig            (rebond vertical / respiration)
//           └ bassin      (hanches)
//              ├ torse    (balancement, respiration)
//              │   ├ tête (regard, hochements)  → cheveux, yeux, chapeau
//              │   ├ bras droit / bras gauche   (pivot à l'épaule)
//              │   └ accessoires (sac, écharpe, cape, pokéball…)
//              └ jambe droite / jambe gauche    (pivot à la hanche)
//
//  Le modèle est construit tourné vers +z (soit dir 'down'), posé sur y = 0,
//  et mesure ~1 unité de haut, comme les créatures.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined') {
    console.error('[actors3d] core3d.js est absent : les personnages ne seront pas construits.');
    return;
  }

  const TAU = Math.PI * 2;

  const _acteurs = [];   // tous les personnages construits (pour la qualité)
  let _pnjs = [];        // les PNJ posés dans le monde

  // ---------------------------------------------------------------------------
  // Orientation : dir du jeu 2D -> rotation autour de Y.
  //   'down' = +z (rotation nulle, le modèle est déjà tourné vers +z)
  // ---------------------------------------------------------------------------
  const ANGLE_DIR = {
    down: 0,
    up: Math.PI,
    right: Math.PI / 2,
    left: -Math.PI / 2,
  };

  // ---------------------------------------------------------------------------
  // Petites utilitaires de couleur (on reste en chaînes '#rrggbb' pour que le
  // cache de matériaux de R3.mat() fonctionne bien).
  // ---------------------------------------------------------------------------
  function _canaux(hex) {
    const h = String(hex || '#ffffff').replace('#', '');
    return [
      parseInt(h.substr(0, 2), 16) || 0,
      parseInt(h.substr(2, 2), 16) || 0,
      parseInt(h.substr(4, 2), 16) || 0,
    ];
  }
  function _hex(r, g, b) {
    const c = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  /** Mélange deux couleurs : t = 0 -> a, t = 1 -> b. */
  function melange(a, b, t) {
    const A = _canaux(a), B = _canaux(b);
    return _hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function assombrir(c, f) { return melange(c, '#000000', f); }
  function eclaircir(c, f) { return melange(c, '#ffffff', f); }

  /** Couleur d'un caractère de PALETTE (js/palette.js), avec repli. */
  function coulPal(ch, defaut) {
    if (typeof PALETTE !== 'undefined' && ch && PALETTE[ch]) return PALETTE[ch];
    return defaut;
  }

  // ---------------------------------------------------------------------------
  // Géométries particulières (calottes, demi-sphères, disque) que R3.geo ne
  // fournit pas. Créées UNE seule fois puis partagées par tous les personnages.
  // ---------------------------------------------------------------------------
  const _geosLocales = new Map();
  function geoLocale(cle, creer) {
    let g = _geosLocales.get(cle);
    if (!g) {
      g = creer();
      // Marquée partagée : R3.disposeTree() ne doit JAMAIS la détruire, sinon
      // le joueur du monde et les 18 PNJ perdraient leur géométrie à la fin
      // du premier combat.
      g.userData.shared = true;
      _geosLocales.set(cle, g);
    }
    return g;
  }
  function GEO_CALOTTE() {   // calotte de cheveux : demi-sphère un peu débordante
    return geoLocale('calotte', () => new THREE.SphereGeometry(1, 16, 12, 0, TAU, 0, Math.PI * 0.53));
  }
  function GEO_DEMI_BAS() {  // moitié basse d'une sphère (pokéball)
    return geoLocale('demiBas', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2));
  }
  function GEO_DISQUE() {    // disque d'ombre de contact
    return geoLocale('disque', () => new THREE.CircleGeometry(1, 20));
  }

  /** Mesh à partir d'une géométrie locale, mise à l'échelle et positionnée. */
  function formeLocale(geometrie, couleur, opts, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(geometrie, R3.mat(couleur, opts));
    m.scale.set(sx, sy, sz);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // ---------------------------------------------------------------------------
  // COTES DU PERSONNAGE (en unités monde ; le personnage fait ~1 de haut)
  // ---------------------------------------------------------------------------
  const Y_BASSIN = 0.30;     // hauteur des hanches
  const Y_TETE = 0.33;       // pivot du cou, relatif au bassin
  const R_TETE = 0.168;      // rayon vertical de la tête

  /**
   * Anneau horizontal (ceinture, écharpe, bandeau). Le tore naît dans le plan
   * XY : on le couche, et on l'aplatit un peu sur l'axe z pour qu'il épouse le
   * corps, qui est ovale et non cylindrique.
   */
  function anneau(rayon, tube, couleur, y, aplat, opts) {
    const a = R3.torus(rayon, tube, couleur, 0, y, 0, Object.assign({ seg: 16 }, opts || {}));
    a.scale.y = (aplat === undefined) ? 0.76 : aplat;   // devient l'axe z une fois couché
    a.rotation.x = Math.PI / 2;
    return a;
  }

  // ---------------------------------------------------------------------------
  // CONSTRUCTION D'UN PERSONNAGE
  // ---------------------------------------------------------------------------
  /**
   * @param {object} cfg
   *   peau, cheveux, haut (vêtement), bas (pantalon/short), chaussures, accent
   *   longs   : chevelure longue tombant sur les épaules
   *   chignon : chignon sur le dessus (mamie)
   *   epi     : mèche rebelle
   *   jupe    : jupe conique à la place du short
   *   robe    : longue robe (vieux sage)
   *   barbe   : barbe et moustache blanches
   *   bandeau : bandeau de sport sur le front
   *   canne   : canne à pêche dans la main droite
   *   sacADos : sac à dos (le joueur, vu de dos par la caméra)
   *   chapeau : 'hat-ranger' | 'hat-fisher' | 'hat-sailor' | null
   *   dresseur: posture dynamique + étoile + écharpe + pokéball à la ceinture
   *   cape    : cape de champion
   */
  function construirePersonnage(cfg) {
    const c = Object.assign({
      peau: '#ffd9a0',
      cheveux: '#5c2e0d',
      haut: '#3b5dc9',
      bas: null,
      chaussures: '#333c57',
      accent: '#f1c40f',
      longs: false, chignon: false, epi: false, jupe: false, robe: false,
      barbe: false, bandeau: false, canne: false, sacADos: false, cape: false,
      chapeau: null, dresseur: false,
    }, cfg || {});

    if (!c.bas) c.bas = melange(assombrir(c.haut, 0.45), '#29366f', 0.35);
    const peauOmbre = assombrir(c.peau, 0.14);
    const hautClair = eclaircir(c.haut, 0.16);
    const cheveuxClair = eclaircir(c.cheveux, 0.14);

    const racine = new THREE.Group();

    // --- rig : porte le rebond de la marche et la respiration ---------------
    const rig = new THREE.Object3D();
    racine.add(rig);

    // --- ombre de contact (utile quand les ombres portées sont coupées) -----
    const ombre = formeLocale(GEO_DISQUE(), '#101528',
      { transparent: true, opacity: 0.26, rough: 1, depthWrite: false },
      0.26, 0.26, 1, 0, 0.02, 0.01);
    ombre.rotation.x = -Math.PI / 2;
    ombre.castShadow = false;
    ombre.receiveShadow = false;
    ombre.visible = !R3.quality.shadows;
    racine.add(ombre);

    // --- bassin -------------------------------------------------------------
    const bassin = new THREE.Object3D();
    bassin.position.y = Y_BASSIN;
    rig.add(bassin);
    bassin.add(R3.ellipsoid(0.115, 0.078, 0.096, c.bas, 0, -0.018, 0));

    // --- torse --------------------------------------------------------------
    const torse = new THREE.Object3D();
    bassin.add(torse);
    torse.add(
      R3.ellipsoid(0.137, 0.162, 0.108, c.haut, 0, 0.152, 0),      // buste
      R3.ellipsoid(0.126, 0.072, 0.100, hautClair, 0, 0.256, 0),   // épaules
      R3.cyl(0.046, 0.052, 0.055, peauOmbre, 0, 0.318, 0, { seg: 10 }) // cou
    );

    // Jupe / robe : cône qui remplace le short.
    if (c.robe) {
      bassin.add(R3.cone(0.188, 0.36, c.haut, 0, -0.10, 0, { seg: 14 }));
      bassin.add(anneau(0.118, 0.024, assombrir(c.haut, 0.35), 0.020, 0.86));
    } else if (c.jupe) {
      bassin.add(R3.cone(0.168, 0.215, c.haut, 0, -0.022, 0, { seg: 14 }));
      bassin.add(anneau(0.114, 0.020, assombrir(c.haut, 0.30), 0.055, 0.86));
    }

    // --- tête ---------------------------------------------------------------
    const tete = new THREE.Object3D();
    tete.position.y = Y_TETE;
    torse.add(tete);

    const crane = R3.ellipsoid(0.175, R_TETE, 0.165, c.peau, 0, 0.152, 0);
    tete.add(crane);
    // Le contenu de la tête est positionné par rapport à son CENTRE : on utilise
    // un sous-groupe décalé pour garder des coordonnées lisibles.
    const visage = new THREE.Object3D();
    visage.position.y = 0.152;
    tete.add(visage);

    // Oreilles
    visage.add(
      R3.ellipsoid(0.028, 0.040, 0.026, c.peau, 0.172, -0.012, 0),
      R3.ellipsoid(0.028, 0.040, 0.026, c.peau, -0.172, -0.012, 0)
    );

    // Yeux (dans un groupe recentré : le clignement écrase le groupe sur place)
    const yeux = R3.eyes(0.078, 0, 0.124, 0.037);
    yeux.position.y = -0.060;
    visage.add(yeux);

    // Nez, bouche, joues — collés à la surface du crâne (qui est un ellipsoïde,
    // donc la profondeur z diminue vite dès qu'on descend vers le menton).
    const details = R3.group(
      R3.sphere(0.020, peauOmbre, 0, -0.098, 0.138, { seg: 8 }),
      R3.ellipsoid(0.032, 0.017, 0.014, '#8a4046', 0, -0.126, 0.103),
      R3.blush(0.105, -0.085, 0.095, 0.040)
    );
    R3.noShadow(details);
    visage.add(details);

    // Cheveux : calotte + mèche de front (+ variantes)
    const calotte = formeLocale(GEO_CALOTTE(), c.cheveux, {},
      0.186, 0.184, 0.180, 0, 0.004, -0.004);
    calotte.rotation.x = 0.10;
    visage.add(calotte);
    visage.add(R3.ellipsoid(0.062, 0.048, 0.045, cheveuxClair, 0.072, 0.028, 0.136));
    if (c.longs) {
      visage.add(R3.ellipsoid(0.172, 0.185, 0.125, c.cheveux, 0, -0.098, -0.075));
      visage.add(R3.ellipsoid(0.048, 0.130, 0.048, c.cheveux, 0.150, -0.085, 0.045));
      visage.add(R3.ellipsoid(0.048, 0.130, 0.048, c.cheveux, -0.150, -0.085, 0.045));
    }
    if (c.chignon) visage.add(R3.sphere(0.078, c.cheveux, 0, 0.180, -0.052, { seg: 10 }));
    if (c.epi) {
      // Mèche rebelle sur le sommet du crâne
      const epi = R3.cone(0.036, 0.090, c.cheveux, 0.052, 0.190, -0.028, { seg: 8 });
      R3.rot(epi, 0.25, 0, -0.45);
      visage.add(epi);
    }
    if (c.barbe) {
      visage.add(R3.ellipsoid(0.108, 0.118, 0.082, '#e9edf0', 0, -0.140, 0.062));
      visage.add(R3.ellipsoid(0.072, 0.026, 0.032, '#e9edf0', 0, -0.100, 0.140));
    }
    if (c.bandeau) visage.add(anneau(0.176, 0.022, c.accent, 0.030, 0.94));
    if (c.chapeau) visage.add(construireChapeau(c.chapeau, c));

    // --- bras ---------------------------------------------------------------
    function bras(signe) {
      const pivot = new THREE.Object3D();
      pivot.position.set(signe * 0.148, 0.258, 0);
      pivot.rotation.z = signe * (c.dresseur ? 0.28 : 0.13);
      pivot.rotation.x = c.dresseur ? -0.14 : 0;
      pivot.add(
        R3.ellipsoid(0.050, 0.080, 0.050, c.haut, 0, -0.058, 0),   // manche
        R3.ellipsoid(0.040, 0.078, 0.040, c.peau, 0, -0.160, 0),   // avant-bras
        R3.sphere(0.047, c.peau, 0, -0.232, 0, { seg: 10 })        // main
      );
      return pivot;
    }
    const brasD = bras(1);
    const brasG = bras(-1);
    torse.add(brasD, brasG);

    // Canne à pêche, tenue dans la main droite.
    if (c.canne) {
      const canne = R3.cyl(0.006, 0.013, 0.62, '#8b5a2b', 0, -0.35, 0.16, { seg: 6 });
      canne.rotation.x = -0.55;
      brasD.add(canne);
    }

    // --- jambes -------------------------------------------------------------
    function jambe(signe) {
      const pivot = new THREE.Object3D();
      pivot.position.set(signe * 0.076, 0, 0);
      pivot.rotation.z = c.dresseur ? signe * 0.10 : 0;
      pivot.add(
        R3.ellipsoid(0.057, 0.078, 0.057, c.bas, 0, -0.050, 0),          // cuisse
        R3.ellipsoid(0.043, 0.078, 0.043, c.peau, 0, -0.158, 0),         // mollet
        R3.ellipsoid(0.056, 0.038, 0.086, c.chaussures, 0, -0.252, 0.024) // chaussure
      );
      return pivot;
    }
    const jambeD = jambe(1);
    const jambeG = jambe(-1);
    bassin.add(jambeD, jambeG);

    // --- sac à dos ----------------------------------------------------------
    if (c.sacADos) {
      const sac = R3.group(
        R3.ellipsoid(0.108, 0.115, 0.070, c.accent, 0, 0.165, -0.118),
        R3.ellipsoid(0.098, 0.042, 0.062, assombrir(c.accent, 0.25), 0, 0.235, -0.115),
        R3.box(0.030, 0.150, 0.024, assombrir(c.accent, 0.30), 0.088, 0.215, 0.062),
        R3.box(0.030, 0.150, 0.024, assombrir(c.accent, 0.30), -0.088, 0.215, 0.062)
      );
      torse.add(sac);
    }

    // --- marques de dresseur ------------------------------------------------
    if (c.dresseur) {
      // Ceinture + pokéball : reconnaissable au premier coup d'œil.
      torse.add(anneau(0.120, 0.024, '#3a3f52', 0.042, 0.80));
      torse.add(construirePokeball(0.052, 0.126, 0.048, 0.052));
      // Étoile dorée sur la poitrine
      torse.add(R3.star(5, 0.048, 0.021, 0.020, c.accent, 0, 0.196, 0.098, { rough: 0.45, metal: 0.25 }));
      // Écharpe au cou, avec un pan qui flotte dans le dos
      torse.add(anneau(0.092, 0.030, c.accent, 0.300, 0.88));
      torse.add(R3.ellipsoid(0.036, 0.090, 0.026, c.accent, 0.052, 0.238, -0.082));
      if (c.cape) {
        const cape = R3.ellipsoid(0.175, 0.235, 0.050, assombrir(c.accent, 0.30),
          0, 0.130, -0.112, { side: THREE.DoubleSide });
        cape.rotation.x = 0.14;
        torse.add(cape);
      }
    } else if (c.sacADos) {
      // Le joueur porte lui aussi une pokéball à la ceinture.
      torse.add(anneau(0.118, 0.022, '#3a3f52', 0.042, 0.80));
      torse.add(construirePokeball(0.050, 0.124, 0.046, 0.050));
    }

    // --- poses de repos (mémorisées pour composer les animations) -----------
    const baseTorseX = c.dresseur ? -0.08 : 0;
    const baseTeteX = c.dresseur ? -0.06 : 0;
    torse.rotation.x = baseTorseX;
    tete.rotation.x = baseTeteX;

    racine.userData.rig = {
      rig, bassin, torse, tete, visage, yeux,
      brasD, brasG, jambeD, jambeG, ombre,
      baseTorseX, baseTeteX,
      baseBrasX: brasD.rotation.x,
      baseBrasZ: Math.abs(brasD.rotation.z),
    };
    racine.userData.phase = 0;
    racine.userData.basePas = 0;
    racine.userData.dernierProgres = 0;
    racine.userData.phaseMarche = 0;
    racine.userData.ampMarche = 0;
    _acteurs.push(racine);
    return racine;
  }

  // ---------------------------------------------------------------------------
  // Pokéball miniature accrochée à la ceinture (rayon r, position x/y/z).
  // ---------------------------------------------------------------------------
  function construirePokeball(r, x, y, z) {
    const g = R3.group(
      R3.sphere(r, '#e74c3c', 0, 0, 0, { seg: 12 }),
      formeLocale(GEO_DEMI_BAS(), '#f4f4f4', {}, r * 1.01, r * 1.01, r * 1.01, 0, 0, 0),
      R3.sphere(r * 0.30, '#f4f4f4', r * 0.94, 0, 0, { seg: 8 })
    );
    const bande = R3.torus(r * 1.0, r * 0.16, '#1a1c2c', 0, 0, 0, { seg: 14 });
    bande.rotation.x = Math.PI / 2;
    g.add(bande);
    g.position.set(x, y, z);
    return g;
  }

  // ---------------------------------------------------------------------------
  // CHAPEAUX — modélisés en volume, posés sur le centre de la tête.
  // ---------------------------------------------------------------------------
  function construireChapeau(type, c) {
    const g = new THREE.Group();

    if (type === 'hat-ranger') {
      // Chapeau d'aventurier vert, bord relevé et plume rouge.
      g.add(R3.cyl(0.252, 0.230, 0.026, '#1e8449', 0, 0.118, 0, { seg: 18 }));
      g.add(R3.cyl(0.118, 0.152, 0.135, '#27ae60', 0, 0.196, 0, { seg: 16 }));
      g.add(R3.cyl(0.156, 0.156, 0.036, '#5c3a1a', 0, 0.140, 0, { seg: 16 }));
      const plume = R3.wing(0.105, 0.036, '#fc7460', 0.150, 0.235, -0.020);
      R3.rot(plume, 0, 0.35, 0.75);
      g.add(plume);
      g.rotation.x = -0.05;

    } else if (type === 'hat-fisher') {
      // Chapeau de paille à large bord qui retombe.
      g.add(R3.cyl(0.305, 0.232, 0.034, '#e0be72', 0, 0.108, 0, { seg: 20 }));
      g.add(R3.ellipsoid(0.156, 0.118, 0.156, '#eccd85', 0, 0.150, 0));
      g.add(R3.cyl(0.160, 0.160, 0.034, '#d35400', 0, 0.120, 0, { seg: 16 }));
      g.rotation.x = 0.04;

    } else if (type === 'hat-sailor') {
      // Béret marin : bandeau bleu, calot blanc, pompon rouge.
      g.add(R3.cyl(0.176, 0.176, 0.052, '#3b5dc9', 0, 0.088, 0, { seg: 18 }));
      const beret = R3.ellipsoid(0.198, 0.078, 0.196, '#f4f4f4', 0, 0.140, 0);
      beret.rotation.z = 0.09;
      g.add(beret);
      g.add(R3.sphere(0.038, '#e74c3c', 0, 0.205, 0.010, { seg: 10 }));

    } else if (c && c.accent) {
      // Type inconnu : petite casquette dans la couleur d'accent (repli).
      g.add(R3.ellipsoid(0.180, 0.090, 0.180, c.accent, 0, 0.120, 0));
    }
    return g;
  }

  // ---------------------------------------------------------------------------
  // JOUEUR — couleurs du sprite 16x16 de js/sprites.js :
  //   'j' cheveux bruns, 'i' peau, '9' t-shirt bleu, '8' short marine.
  // ---------------------------------------------------------------------------
  function buildPlayer() {
    const g = construirePersonnage({
      peau: coulPal('i', '#ffd9a0'),
      cheveux: coulPal('j', '#5c2e0d'),
      haut: coulPal('9', '#3b5dc9'),
      bas: coulPal('8', '#29366f'),
      chaussures: '#2b3145',
      accent: '#ef7d57',
      epi: true,
      sacADos: true,
    });
    g.userData.estJoueur = true;
    return g;
  }

  // ---------------------------------------------------------------------------
  // Petites signatures par PNJ : ce qui les rend uniques d'un coup d'œil.
  // (les couleurs, elles, viennent de npc.colorMap via PALETTE)
  // ---------------------------------------------------------------------------
  const STYLE_PNJ = {
    garde:              { peau: 'h', accent: '#38b764' },
    pecheur:            { peau: 'h', canne: true, accent: '#41a6f6' },
    mamie:              { longs: true, chignon: true, jupe: true, taille: 0.93 },
    garcon:             { epi: true, taille: 0.84 },
    marin:              { peau: 'h', accent: '#3b5dc9' },
    marchand:           { accent: '#f1c40f' },
    mairesse:           { longs: true, jupe: true },
    sage_village:       { barbe: true, robe: true, taille: 0.96 },
    famille:            { longs: true, jupe: true },
    coureur:            { bandeau: true, accent: '#ef7d57' },
    dresseur_foret:     { accent: '#f1c40f' },
    dresseur_lac:       { longs: true, accent: '#73eff7' },
    dresseur_plaine:    { accent: '#41a6f6' },
    dresseur_village:   { longs: true, jupe: true, accent: '#f1c40f' },
    dresseur_montagne1: { accent: '#ffcd75' },
    dresseur_montagne2: { longs: true, accent: '#ffcd75' },
    dresseur_plage:     { peau: 'h', accent: '#73eff7' },
    dresseur_cite:      { longs: true, cape: true, accent: '#f1c40f' },
  };

  /** Choisit une couleur d'accent lisible sur le vêtement (évite jaune sur jaune). */
  function accentLisible(propose, vetement) {
    const a = _canaux(propose), v = _canaux(vetement);
    const ecart = Math.abs(a[0] - v[0]) + Math.abs(a[1] - v[1]) + Math.abs(a[2] - v[2]);
    if (ecart > 150) return propose;
    return (v[0] + v[1] + v[2] > 380) ? '#b13e53' : '#ffcd75';
  }

  // ---------------------------------------------------------------------------
  // PNJ
  // ---------------------------------------------------------------------------
  function buildNPC(npc) {
    npc = npc || {};
    const cm = npc.colorMap || {};
    const st = STYLE_PNJ[npc.id] || {};

    const cheveux = coulPal(cm.j, coulPal('j', '#5c2e0d'));
    const haut = coulPal(cm.l, coulPal('9', '#3b5dc9'));
    const peau = coulPal(st.peau || 'i', '#ffd9a0');
    const accent = accentLisible(st.accent || '#f1c40f', haut);

    const g = construirePersonnage({
      peau: peau,
      cheveux: cheveux,
      haut: haut,
      chaussures: melange(assombrir(haut, 0.62), '#333c57', 0.55),
      accent: accent,
      longs: !!st.longs,
      chignon: !!st.chignon,
      epi: !!st.epi,
      jupe: !!st.jupe,
      robe: !!st.robe,
      barbe: !!st.barbe,
      bandeau: !!st.bandeau,
      canne: !!st.canne,
      cape: !!st.cape,
      chapeau: npc.accessory || null,
      dresseur: !!npc.isTrainer,
    });

    if (st.taille) g.scale.setScalar(st.taille);
    // Déphasage : les PNJ ne respirent pas tous en même temps.
    g.userData.phase = (R3.hash(npc.x || 0, npc.y || 0) * TAU) || 0;
    g.userData.npc = npc;
    g.userData.estDresseur = !!npc.isTrainer;
    return g;
  }

  // ---------------------------------------------------------------------------
  // Placement des 18 PNJ sur la carte.
  // ---------------------------------------------------------------------------
  function hauteurSol(x, z) {
    const monde = R3.get('world');
    if (monde && typeof monde.heightAt === 'function') {
      const h = monde.heightAt(x, z);
      if (typeof h === 'number' && isFinite(h)) return h;
    }
    return null;   // null = le monde n'est pas encore là
  }

  function buildNPCs(scene) {
    const liste = [];
    if (typeof NPCS === 'undefined' || !Array.isArray(NPCS)) {
      console.warn('[actors3d] NPCS introuvable : aucun PNJ placé.');
      _pnjs = liste;
      return liste;
    }
    for (let i = 0; i < NPCS.length; i++) {
      const npc = NPCS[i];
      let g = null;
      try { g = buildNPC(npc); } catch (e) {
        console.error('[actors3d] PNJ en échec :', npc && npc.id, e);
      }
      if (!g) continue;

      const x = (npc.x || 0);
      const z = (npc.y || 0);
      const h = hauteurSol(x, z);
      g.position.set(x, h === null ? 0 : h, z);
      g.userData.solOk = (h !== null);
      g.rotation.y = (ANGLE_DIR[npc.dir] !== undefined) ? ANGLE_DIR[npc.dir] : 0;

      if (scene && typeof scene.add === 'function') scene.add(g);
      liste.push(g);
    }
    _pnjs = liste;
    return liste;
  }

  // ---------------------------------------------------------------------------
  // ANIMATION
  // ---------------------------------------------------------------------------

  /** Clignement d'yeux : court, régulier, décalé d'un personnage à l'autre. */
  function clignement(g, t) {
    const r = g.userData.rig;
    if (!r || !r.yeux) return;
    const cycle = 3.4 + (g.userData.phase % 1) * 2.2;
    const p = (t + g.userData.phase * 3) % cycle;
    r.yeux.scale.y = (p < 0.10) ? 0.12 : 1;
  }

  /**
   * Pose complète : cycle de marche (amp = 1) fondu vers le repos (amp = 0).
   * phase avance de PI par pas de 160 ms, donc jambe gauche puis jambe droite.
   */
  function appliquerPose(g, phase, amp, t) {
    const r = g.userData.rig;
    if (!r) return;
    const ph = g.userData.phase;
    const s = Math.sin(phase);
    const cs = Math.cos(phase);
    const repos = 1 - amp;

    // Respiration à l'arrêt : le buste se gonfle doucement.
    const souffle = Math.sin(t * 2.0 + ph) * 0.032 * repos;
    r.torse.scale.set(1 - souffle * 0.45, 1 + souffle, 1 - souffle * 0.45);

    // Rebond : maximum quand les jambes se croisent, minimum à l'écart maximal.
    r.rig.position.y = Math.abs(cs) * 0.030 * amp + Math.sin(t * 2.0 + ph) * 0.008 * repos;

    // Jambes et bras en opposition.
    r.jambeD.rotation.x = s * 0.90 * amp;
    r.jambeG.rotation.x = -s * 0.90 * amp;
    r.brasD.rotation.x = r.baseBrasX - s * 0.78 * amp + Math.sin(t * 1.5 + ph) * 0.05 * repos;
    r.brasG.rotation.x = r.baseBrasX + s * 0.78 * amp - Math.sin(t * 1.5 + ph) * 0.05 * repos;

    // Balancement du torse et contre-rotation des épaules.
    r.torse.rotation.z = s * 0.055 * amp + Math.sin(t * 0.8 + ph) * 0.030 * repos;
    r.torse.rotation.y = -s * 0.140 * amp;
    r.torse.rotation.x = r.baseTorseX - 0.045 * amp;

    // La tête compense le mouvement des épaules (et regarde autour à l'arrêt).
    r.tete.rotation.y = s * 0.075 * amp + Math.sin(t * 0.45 + ph * 1.7) * 0.22 * repos;
    r.tete.rotation.z = -s * 0.045 * amp + Math.sin(t * 0.9 + ph) * 0.045 * repos;
    r.tete.rotation.x = r.baseTeteX + Math.sin(t * 1.1 + ph) * 0.025 * repos;

    clignement(g, t);
  }

  /**
   * Joueur. opts : { moving, moveProgress (0->1 sur 160 ms), dir, t }
   */
  function updatePlayer(g, opts) {
    if (!g || !g.userData || !g.userData.rig) return;
    const o = opts || {};
    const ud = g.userData;
    const dt = (R3.clock && R3.clock.dt) || 0.016;
    const t = (o.t !== undefined) ? o.t : (R3.clock ? R3.clock.t : 0);

    // --- orientation : lissée, et par le plus court chemin (-PI / +PI) ------
    const cible = ANGLE_DIR[o.dir];
    if (cible !== undefined) {
      // On replie l'angle courant dans [-PI, PI] (l'orientation visible ne
      // change pas) pour qu'il ne dérive pas tour après tour.
      let cur = g.rotation.y;
      if (cur > Math.PI || cur < -Math.PI) cur = Math.atan2(Math.sin(cur), Math.cos(cur));
      let d = cible - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));   // le plus court chemin
      g.rotation.y = R3.damp(cur, cur + d, 0.62, dt);
    }

    // --- phase de marche continue d'un pas à l'autre ------------------------
    const p = R3.clamp01(o.moveProgress || 0);
    if (o.moving) {
      if (p < ud.dernierProgres - 0.0001) ud.basePas += Math.PI;  // nouveau pas
      ud.dernierProgres = p;
      ud.phaseMarche = ud.basePas + p * Math.PI;
    } else {
      ud.dernierProgres = 0;
    }
    ud.ampMarche = R3.damp(ud.ampMarche, o.moving ? 1 : 0, 0.70, dt);

    appliquerPose(g, ud.phaseMarche, ud.ampMarche, t);
  }

  /**
   * PNJ : respiration, léger balancement, regard qui vagabonde.
   * Les dresseurs bougent un peu plus, pour paraître impatients d'en découdre.
   */
  function updateNPC(g, npc, t) {
    if (!g || !g.userData || !g.userData.rig) return;
    const ud = g.userData;
    const r = ud.rig;
    const ph = ud.phase;
    const dyn = (npc && npc.isTrainer) ? 1.6 : 1;

    // Le monde a pu être construit après les PNJ : on rattrape la hauteur.
    if (!ud.solOk) {
      const h = hauteurSol(g.position.x, g.position.z);
      if (h !== null) { g.position.y = h; ud.solOk = true; }
    }

    const souffle = Math.sin(t * 1.9 + ph) * 0.030 * dyn;
    r.torse.scale.set(1 - souffle * 0.45, 1 + souffle, 1 - souffle * 0.45);
    r.rig.position.y = Math.abs(Math.sin(t * 1.9 + ph)) * 0.010 * dyn;

    r.torse.rotation.x = r.baseTorseX;
    r.torse.rotation.y = Math.sin(t * 0.6 + ph) * 0.06 * dyn;
    r.torse.rotation.z = Math.sin(t * 0.75 + ph) * 0.040 * dyn;

    r.tete.rotation.x = r.baseTeteX + Math.sin(t * 1.0 + ph) * 0.030;
    r.tete.rotation.y = Math.sin(t * 0.42 + ph * 1.7) * 0.30;
    r.tete.rotation.z = Math.sin(t * 0.85 + ph) * 0.050;

    const bal = Math.sin(t * 1.25 + ph) * 0.085 * dyn;
    r.brasD.rotation.x = r.baseBrasX + bal;
    r.brasG.rotation.x = r.baseBrasX - bal;

    clignement(g, t);
  }

  // ---------------------------------------------------------------------------
  // L'ombre de contact ne sert que si les vraies ombres sont désactivées.
  // ---------------------------------------------------------------------------
  R3.onQualityChange(function (q) {
    for (let i = 0; i < _acteurs.length; i++) {
      const r = _acteurs[i].userData.rig;
      if (r && r.ombre) r.ombre.visible = !q.shadows;
    }
  });

  // ---------------------------------------------------------------------------
  R3.register('actors', {
    buildPlayer: buildPlayer,
    buildNPC: buildNPC,
    updatePlayer: updatePlayer,
    updateNPC: updateNPC,
    buildNPCs: buildNPCs,
    // Pratique pour game3d.js : la liste des PNJ posés dans le monde.
    get list() { return _pnjs; },
    ANGLE_DIR: ANGLE_DIR,
  });
})();
