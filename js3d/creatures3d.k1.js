// =============================================================================
//  creatures3d.p5.js — LOT 5 : LES NEUF DÉPARTS DE KANTO
//  « L'aventure de Clélia » — version 3D
//  bulbizarre · herbizarre · florizarre
//  salameche  · reptincel  · dracaufeu
//  carapuce   · carabaffe  · tortank
// =============================================================================
//  Trois lignées, trois palettes, et dans chaque lignée la MÊME créature qui
//  grandit : mêmes yeux, mêmes joues, même sourire, la silhouette qui s'affirme
//  et la taille qui monte (≈ 0,7 → 0,9 → 1,3 unité).
//
//  DRACAUFEU est la pièce maîtresse : Clélia le chevauche pendant tout le vol
//  (CONTRACT-V4 §6), il est donc vu de très près et sous tous les angles. Ailes
//  bleues bien déployées, museau doux, ventre crème, flamme vivante au bout de
//  la queue — et pas un seul croc.
//
//  CONVENTIONS (identiques à p1..p4)
//  --------------------------------
//    * Group racine centré en (0,0,0), posé sur y = 0, regardant vers +z.
//    * Tout le corps vit dans un sous-groupe `inner` : les animations déplacent
//      `inner`, JAMAIS la racine (le jeu la positionne et la met à l'échelle).
//    * userData.anim = { head, wingL, wingR, tail, float } — lu par
//      R3.idleCreature().
//    * userData.attack(racine, p), p de 0 à 1 : une animation JOYEUSE.
//    * Budget : 40 meshes maximum par créature.
//    * Tous les matériaux passent par R3.mat() (via R3.ellipsoid, R3.cone, …) :
//      ils sont partagés, donc gratuits. Jamais de `new THREE.Material`.
//
//  LES DEUX PIÈGES DU PROJET, ÉVITÉS ICI
//  -------------------------------------
//   1. R3.ellipsoid() range ses rayons dans mesh.scale : écrire `scale` sur un
//      ellipsoïde efface ses proportions et le transforme en boule (« la volute
//      de 0,08 devenue rocher de 1,1 »). Dans ce fichier, AUCUN ellipsoïde ne
//      voit jamais son `scale` réécrit : on anime toujours un PIVOT parent
//      (un THREE.Group nu), ou bien la `position` / la `rotation` du mesh.
//   2. Rien n'appelle CL.tick() dans la chaîne de rendu : le jeu n'utilise que
//      R3.idleCreature() et userData.attack(). Les gestes autonomes (la flamme
//      qui vacille, les ailes qui respirent, les feuilles qui frissonnent) sont
//      donc pilotés par une fonction accrochée à l'`onBeforeRender` d'un mesh
//      du modèle — la technique de creatures3d.p3.js et p4.js.
//
//  Les assemblages viennent de creatures3d.lib.js (`R3.get('kclib')`). Chaque
//  appel passe par une enveloppe qui sait se replier sur les primitives R3.* si
//  la bibliothèque n'est pas chargée : ce fichier ne lève jamais d'exception,
//  ni au chargement, ni à la construction.
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

  /** Un pivot : un Group NU, le seul objet qu'on ait le droit de mettre à
   *  l'échelle sans risque puisqu'il ne porte aucune géométrie. */
  function pivot(x, y, z) {
    const p = new THREE.Group();
    p.position.set(x || 0, y || 0, z || 0);
    return p;
  }

  // ---------------------------------------------------------------------------
  //  Enveloppes « clib si présente, sinon repli ». Les replis ne cherchent pas
  //  à être aussi beaux, seulement à rester lisibles et à ne rien casser.
  // ---------------------------------------------------------------------------

  /** Sourire en arc de perles. */
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
        u * w, -k * d, 0, { rough: 0.85 })));
    }
    return at(g, o);
  }

  /** Grands yeux ronds et brillants — la signature des amies de Clélia. */
  function bigEyes(o) {
    const f = CLIB('bigEyes');
    if (f) return f(o);
    o = o || {};
    const spread = (o.spread !== undefined) ? o.spread : 0.12;
    const r = o.r || 0.085, pr = (o.pupilR !== undefined) ? o.pupilR : r * 0.52;
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(R3.sphere(r, o.scleraColor || '#f8f8f8', s * spread, 0, 0, { rough: 0.42 }));
      g.add(faint(R3.sphere(pr, o.pupilColor || '#1a1c2c', s * spread, 0, r * 0.72,
        { rough: 0.5 })));
      g.add(faint(R3.sphere(pr * 0.42, '#ffffff',
        s * spread + pr * 0.45, r * 0.30, r * 0.86, { rough: 0.2 })));
    });
    return at(g, o);
  }

  /** Feuille arrondie, pivot à la base, pousse vers +y, s'incline avec `tilt`. */
  function leafBlade(o) {
    const f = CLIB('leafBlade');
    if (f) return f(o);
    o = o || {};
    const len = o.len || 0.46, wid = o.wid || 0.34, th = o.thick || 0.10;
    const col = o.color || '#38b764';
    const g = new THREE.Group();
    g.add(R3.ellipsoid(wid * 0.5, len * 0.46, th * 0.5, col, 0, len * 0.48, 0,
      { rough: 0.88 }));
    g.add(faint(R3.ellipsoid(wid * 0.14, len * 0.08, th * 0.42, col, 0, len * 0.05, 0,
      { rough: 0.88 })));
    g.rotation.z = o.tilt || 0;
    return at(g, o);
  }

  /** Petite patte / petit pied bien rond. -> THREE.Mesh */
  function paw(o) {
    const f = CLIB('paw');
    if (f) return f(o);
    o = o || {};
    const r = (o.r !== undefined) ? o.r : 0.09;
    return R3.ellipsoid(r, r * ((o.squash !== undefined) ? o.squash : 0.66),
      r * ((o.stretch !== undefined) ? o.stretch : 1.20),
      o.color || '#ffffff', o.x || 0, o.y || 0, o.z || 0,
      { rough: (o.rough !== undefined) ? o.rough : 0.9 });
  }

  // ===========================================================================
  //  ASSEMBLAGES PROPRES À CE LOT
  // ===========================================================================

  /**
   * Flamme douce : cône orange translucide + cœur jaune lumineux, le tout dans
   * un PIVOT (2 meshes). On anime le pivot, jamais les cônes — et surtout
   * jamais un ellipsoïde.  Ancrage : la base de la flamme est à l'origine.
   */
  function flamme(o) {
    o = o || {};
    const h = o.h || 0.24, r = o.r || 0.105;
    const g = pivot(o.x, o.y, o.z);
    const ext = R3.cone(r, h, o.color || '#ff9b4a', 0, h * 0.5, 0, {
      seg: 10, rough: 0.42, transparent: true, opacity: 0.93,
      emissive: o.color || '#ff7a2a', emissiveIntensity: 0.9,
    });
    const coeur = R3.cone(r * 0.50, h * 0.62, o.coreColor || '#ffe98a', 0, h * 0.34, 0, {
      seg: 8, rough: 0.34, emissive: o.coreColor || '#ffd24a', emissiveIntensity: 1.0,
    });
    g.add(faint(ext), faint(coeur));
    g.userData.ext = ext;
    g.userData.coeur = coeur;
    return g;
  }

  /**
   * Couronne de pétales HORIZONTALE (une fleur posée à plat sur un dos).
   * Chaque pétale vit dans son propre pivot placé au CŒUR de la fleur :
   *   petals[i].rotation.z relève ou abaisse le pétale, sans jamais toucher au
   *   `scale` de l'ellipsoïde qu'il contient.
   * `lift` = redressement au repos (0 = fleur à plat, 1,2 = bouton fermé).
   */
  function corolle(o) {
    o = o || {};
    const n = Math.max(3, o.count || 5);
    const r = (o.r !== undefined) ? o.r : 0.20;
    const pl = o.petalLen || 0.24, pw = o.petalWid || 0.17, th = o.thick || 0.08;
    const lift = (o.lift !== undefined) ? o.lift : 0.3;
    const g = new THREE.Group();
    const petals = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (o.start || 0);
      const tour = pivot(0, 0, 0);
      tour.rotation.y = -a;
      const p = pivot(0, 0, 0);
      p.rotation.z = lift;
      p.add(R3.ellipsoid(pl * 0.5, th * 0.5, pw * 0.5, o.color || '#ff8fb8',
        r + pl * 0.42, 0, 0, { rough: 0.82 }));
      tour.add(p);
      g.add(tour);
      petals.push(p);
    }
    g.userData.petals = petals;
    g.userData.lift = lift;
    g.userData.animate = function (t) {
      for (let i = 0; i < petals.length; i++) {
        petals[i].rotation.z = lift + Math.sin(t * 1.2 + i * 0.9) * 0.05;
      }
    };
    return at(g, o);
  }

  // ===========================================================================
  //  OSSATURE & ANIMATION COMMUNES
  // ===========================================================================

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

  /** Joue les userData.animate() d'une liste de sous-groupes. */
  function play(parts, t) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const f = p && p.userData && p.userData.animate;
      if (typeof f === 'function') { try { f(t); } catch (e) { /* jamais bloquant */ } }
    }
  }

  /**
   * Le moteur d'animation continue, désormais UNIQUE pour tous les lots :
   * `CL.pilote` (creatures3d.lib.js). Repli local identique si la bibliothèque
   * manque — ce fichier doit rester autonome.
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
   * Ancien nom, conservé pour ne rien réécrire dans les neuf modèles.
   * `host` n'est plus utilisé : le pilote choisit lui-même le premier mesh
   * OPAQUE du modèle, plus sûr qu'un mesh désigné à la main.
   */
  function heartbeat(root, host, fn) { return pilote(root, fn); }

  /**
   * Marque le modèle « occupé » PENDANT l'animation de joie — et seulement
   * pendant. battle3d.js:2606 rappelle `attack(modele, 0)` en fin de geste pour
   * remettre la pose au repos : avec l'ancien `(p < 1)`, busy restait vrai pour
   * toujours et la créature ne bougeait plus de la partie (contrat v5 §13.1).
   */
  function busy(root, p) { root.userData.busy = (p > 0 && p < 1); }

  // ###########################################################################
  //  LIGNÉE 1 — BULBIZARRE › HERBIZARRE › FLORIZARRE
  //  Palette commune : corps vert tendre à taches sombres, bulbe qui devient
  //  bouton de fleur puis grande fleur rose. Petit dinosaure à quatre pattes,
  //  museau rond, oreilles en feuille.
  // ###########################################################################

  const V_CORPS = '#7ec861', V_TACHE = '#48883a';
  const V_CORPS2 = '#66b04c', V_TACHE2 = '#3a7030';
  const V_CORPS3 = '#4f9c48', V_TACHE3 = '#2f6b34';
  const ROSE = '#ff8fb8', ROSE_VIF = '#ef5a86', COEUR_OR = '#f7d774';

  // ===========================================================================
  //  BULBIZARRE — « Un petit dinosaure vert avec un bulbe sur le dos. »
  //  ~0,72 unité · 31 meshes
  // ===========================================================================
  R3.registerCreature('bulbizarre', function () {
    const BULBE = '#53a03a', BULBE_CLAIR = '#75bd58', FEUILLE = '#418a2e';
    const g = shell(), inner = g.userData.inner;

    // --- Quatre petites pattes bien rondes -------------------------------------
    [[-1, 0.175], [1, 0.175], [-1, -0.155], [1, -0.155]].forEach(function (p) {
      inner.add(paw({
        r: 0.090, squash: 0.72, stretch: 1.10, color: V_CORPS,
        x: p[0] * 0.155, y: 0.064, z: p[1],
      }));
    });

    // --- Corps trapu -----------------------------------------------------------
    const corps = R3.ellipsoid(0.235, 0.200, 0.285, V_CORPS, 0, 0.278, 0, { rough: 0.86 });
    inner.add(corps);

    // Taches sombres du dos (le motif qui fait « Bulbizarre » au premier coup d'œil)
    [[0.105, 0.452, 0.055], [-0.125, 0.446, -0.070], [0.028, 0.462, -0.180]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.062, 0.036, 0.062, V_TACHE, t[0], t[1], t[2],
          { rough: 0.95 })));
      });

    // Petite queue en goutte
    inner.add(faint(R3.ellipsoid(0.048, 0.048, 0.085, V_CORPS, 0, 0.288, -0.318,
      { rough: 0.88 })));

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.352, 0.238);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.185, 0.168, 0.172, V_CORPS, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.112, 0.082, 0.098, V_CORPS, 0, -0.050, 0.132,
      { rough: 0.86 })));
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.052, 0.108, V_CORPS, s * 0.118, 0.152, -0.022,
        { seg: 8, rough: 0.86 });
      o.rotation.z = -s * 0.32;
      o.rotation.x = -0.14;
      tete.add(faint(o));
    });
    tete.add(bigEyes({ spread: 0.090, r: 0.060, pupilR: 0.032, y: 0.032, z: 0.150 }));
    tete.add(R3.blush(0.150, -0.034, 0.130, 0.038));
    tete.add(smile({ w: 0.050, depth: 0.026, r: 0.014, y: -0.076, z: 0.224, count: 5 }));

    // --- Le bulbe ---------------------------------------------------------------
    const bulbe = pivot(0, 0.400, -0.062);
    inner.add(bulbe);
    bulbe.add(R3.ellipsoid(0.172, 0.148, 0.170, BULBE, 0, 0.062, 0, { rough: 0.80 }));
    bulbe.add(faint(R3.ellipsoid(0.100, 0.058, 0.100, BULBE_CLAIR, 0, 0.178, 0,
      { rough: 0.78 })));
    const feuilles = [];
    [-1, 1].forEach(function (s) {
      const f = leafBlade({
        len: 0.190, wid: 0.148, thick: 0.070, color: FEUILLE, vein: false, tip: false,
        x: s * 0.070, y: 0.180, z: -0.012, tilt: -s * 0.48,
      });
      bulbe.add(f);
      feuilles.push(f);
    });

    g.userData.anim = { head: tete, tail: bulbe, float: false };
    heartbeat(g, corps, function (t) {
      play(feuilles, t);
      // Le bulbe respire : il pousse un peu chaque jour, comme dit sa fiche.
      const k = 1 + Math.sin(t * 1.5) * 0.035;
      bulbe.scale.set(k, 1 / Math.sqrt(k), k);
      feuilles[0].rotation.x = Math.sin(t * 1.8) * 0.09;
      feuilles[1].rotation.x = Math.sin(t * 1.8 + 0.7) * 0.09;
    });

    g.userData.attack = function (root, p) {
      // « Fouet Lianes » : les feuilles fouettent l'air et il pousse du museau.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.34;
      inn.rotation.x = -k * 0.16;
      tete.rotation.x = -k * 0.22;
      feuilles.forEach(function (f, i) {
        f.rotation.x = Math.sin(pc * Math.PI * 3 + i * 0.9) * 0.85;
      });
      bulbe.scale.setScalar(1 + k * 0.16);
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0;
        feuilles.forEach(function (f) { f.rotation.x = 0; });
        bulbe.scale.setScalar(1);
      }
    };
    return g;
  });

  // ===========================================================================
  //  HERBIZARRE — « Son bulbe est devenu un gros bouton de fleur. »
  //  ~0,92 unité · 37 meshes
  // ===========================================================================
  R3.registerCreature('herbizarre', function () {
    const FEUILLE = '#4e9a3a';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes ----------------------------------------------------------------
    [[-1, 0.205], [1, 0.205], [-1, -0.185], [1, -0.185]].forEach(function (p) {
      inner.add(paw({
        r: 0.102, squash: 0.74, stretch: 1.12, color: V_CORPS2,
        x: p[0] * 0.180, y: 0.074, z: p[1],
      }));
    });

    // --- Corps -----------------------------------------------------------------
    const corps = R3.ellipsoid(0.272, 0.232, 0.330, V_CORPS2, 0, 0.330, 0, { rough: 0.86 });
    inner.add(corps);

    [[0.135, 0.532, 0.060], [-0.158, 0.526, -0.085], [0.032, 0.548, -0.215]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.072, 0.040, 0.072, V_TACHE2, t[0], t[1], t[2],
          { rough: 0.95 })));
      });

    inner.add(faint(R3.ellipsoid(0.052, 0.052, 0.090, V_CORPS2, 0, 0.340, -0.362,
      { rough: 0.88 })));

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.412, 0.288);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.198, 0.180, 0.185, V_CORPS2, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.122, 0.090, 0.105, V_CORPS2, 0, -0.054, 0.142,
      { rough: 0.86 })));
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.056, 0.125, V_CORPS2, s * 0.126, 0.164, -0.024,
        { seg: 8, rough: 0.86 });
      o.rotation.z = -s * 0.34;
      o.rotation.x = -0.14;
      tete.add(faint(o));
    });
    tete.add(bigEyes({ spread: 0.096, r: 0.064, pupilR: 0.034, y: 0.034, z: 0.160 }));
    tete.add(R3.blush(0.160, -0.038, 0.140, 0.040));
    tete.add(smile({ w: 0.055, depth: 0.028, r: 0.015, y: -0.082, z: 0.240, count: 5 }));

    // --- Le bouton de fleur, encore fermé --------------------------------------
    const bouton = pivot(0, 0.520, -0.055);
    inner.add(bouton);
    bouton.add(R3.ellipsoid(0.165, 0.095, 0.165, '#4e9a3a', 0, 0.048, 0, { rough: 0.82 }));
    const bourgeon = corolle({
      count: 4, r: 0.052, petalLen: 0.185, petalWid: 0.140, thick: 0.085,
      color: ROSE, lift: 1.12, y: 0.115,
    });
    bouton.add(bourgeon);
    bouton.add(faint(R3.ellipsoid(0.062, 0.070, 0.062, ROSE_VIF, 0, 0.185, 0,
      { rough: 0.80 })));

    // Trois feuilles autour du bouton
    const feuilles = [];
    [-1, 0, 1].forEach(function (s, i) {
      const f = leafBlade({
        len: 0.320, wid: 0.215, thick: 0.080, color: FEUILLE, vein: false, tip: false,
        x: s * 0.155, y: 0.055, z: (i === 1) ? -0.175 : 0.020, tilt: -s * 0.95,
      });
      if (i === 1) f.rotation.x = -0.55;
      bouton.add(f);
      feuilles.push(f);
    });

    g.userData.anim = { head: tete, tail: bouton, float: false };
    heartbeat(g, corps, function (t) {
      play(feuilles, t);
      play([bourgeon], t);
      const k = 1 + Math.sin(t * 1.4) * 0.030;
      bouton.scale.set(k, 1 / Math.sqrt(k), k);
    });

    g.userData.attack = function (root, p) {
      // « Tranch'Herbe » : le bouton s'entrouvre et les feuilles tournoient.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.36;
      inn.rotation.x = -k * 0.15;
      tete.rotation.x = -k * 0.20;
      bouton.rotation.y = pc * Math.PI * 2;
      bourgeon.userData.petals.forEach(function (pt, i) {
        pt.rotation.z = 1.12 - k * (0.55 + (i % 2) * 0.12);
      });
      feuilles.forEach(function (f, i) {
        f.rotation.x = Math.sin(pc * Math.PI * 3 + i * 0.8) * 0.70;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0;
        bouton.rotation.y = 0;
        bourgeon.userData.petals.forEach(function (pt) { pt.rotation.z = 1.12; });
        feuilles.forEach(function (f) { f.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  FLORIZARRE — « Une immense fleur rose s'est ouverte sur son dos. »
  //  ~1,28 unité · 38 meshes
  // ===========================================================================
  R3.registerCreature('florizarre', function () {
    const FEUILLE = '#3d8a35';
    const g = shell(), inner = g.userData.inner;

    // --- Grosses pattes --------------------------------------------------------
    [[-1, 0.275], [1, 0.275], [-1, -0.250], [1, -0.250]].forEach(function (p) {
      inner.add(paw({
        r: 0.148, squash: 0.72, stretch: 1.08, color: V_CORPS3,
        x: p[0] * 0.250, y: 0.104, z: p[1],
      }));
    });

    // --- Corps massif ----------------------------------------------------------
    const corps = R3.ellipsoid(0.395, 0.330, 0.470, V_CORPS3, 0, 0.470, 0, { rough: 0.86 });
    inner.add(corps);

    [[0.198, 0.752, 0.085], [-0.228, 0.742, -0.130], [0.048, 0.775, -0.300]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.096, 0.050, 0.096, V_TACHE3, t[0], t[1], t[2],
          { rough: 0.95 })));
      });

    inner.add(faint(R3.ellipsoid(0.068, 0.068, 0.110, V_CORPS3, 0, 0.470, -0.518,
      { rough: 0.88 })));

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.545, 0.418);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.245, 0.222, 0.230, V_CORPS3, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.152, 0.112, 0.130, V_CORPS3, 0, -0.068, 0.176,
      { rough: 0.86 })));
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.066, 0.150, V_CORPS3, s * 0.156, 0.202, -0.030,
        { seg: 8, rough: 0.86 });
      o.rotation.z = -s * 0.34;
      o.rotation.x = -0.14;
      tete.add(faint(o));
    });
    tete.add(bigEyes({ spread: 0.118, r: 0.078, pupilR: 0.041, y: 0.042, z: 0.198 }));
    tete.add(R3.blush(0.196, -0.048, 0.176, 0.050));
    tete.add(smile({ w: 0.068, depth: 0.034, r: 0.018, y: -0.103, z: 0.298, count: 5 }));

    // --- LA grande fleur --------------------------------------------------------
    const fleur = pivot(0, 0.775, -0.045);
    inner.add(fleur);
    // Tronc court et charnu qui la porte
    fleur.add(R3.cyl(0.115, 0.170, 0.170, '#4e9a3a', 0, 0.085, 0,
      { seg: 10, rough: 0.88 }));
    const petales = corolle({
      count: 6, r: 0.155, petalLen: 0.330, petalWid: 0.245, thick: 0.090,
      color: ROSE, lift: 0.34, y: 0.215,
    });
    fleur.add(petales);
    fleur.add(R3.ellipsoid(0.145, 0.075, 0.145, ROSE_VIF, 0, 0.235, 0, { rough: 0.82 }));
    fleur.add(faint(R3.ellipsoid(0.085, 0.055, 0.085, COEUR_OR, 0, 0.288, 0,
      { rough: 0.70 })));

    // Quatre grandes feuilles à la base de la fleur
    const feuilles = [];
    [[-1, 0.9], [1, 0.9], [-1, -0.9], [1, -0.9]].forEach(function (q) {
      const piv = pivot(q[0] * 0.230, 0.055, q[1] * 0.230);
      piv.rotation.y = Math.atan2(q[0], q[1]);
      piv.rotation.x = -0.62;
      piv.add(R3.ellipsoid(0.130, 0.048, 0.235, FEUILLE, 0, 0.020, 0.215,
        { rough: 0.88 }));
      fleur.add(piv);
      feuilles.push(piv);
    });

    g.userData.anim = { head: tete, tail: fleur, float: false };
    heartbeat(g, corps, function (t) {
      play([petales], t);
      // La grande fleur s'ouvre et se referme au rythme du souffle.
      const k = 1 + Math.sin(t * 1.1) * 0.025;
      fleur.scale.set(k, 1 / Math.sqrt(k), k);
      for (let i = 0; i < feuilles.length; i++) {
        feuilles[i].rotation.x = -0.62 + Math.sin(t * 1.3 + i) * 0.06;
      }
    });

    g.userData.attack = function (root, p) {
      // « Lance-Soleil » : la fleur s'ouvre en grand et le soleil ressort.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.28;
      inn.position.y = k * 0.10;
      inn.rotation.x = -k * 0.12;
      tete.rotation.x = -k * 0.26;
      petales.userData.petals.forEach(function (pt, i) {
        pt.rotation.z = 0.34 - k * (0.62 + (i % 2) * 0.10);
      });
      fleur.scale.setScalar(1 + k * 0.22);
      feuilles.forEach(function (f, i) {
        f.rotation.x = -0.62 - k * 0.35 + Math.sin(k * 6 + i) * 0.05;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0;
        petales.userData.petals.forEach(function (pt) { pt.rotation.z = 0.34; });
        fleur.scale.setScalar(1);
        feuilles.forEach(function (f) { f.rotation.x = -0.62; });
      }
    };
    return g;
  });

  // ###########################################################################
  //  LIGNÉE 2 — SALAMÈCHE › REPTINCEL › DRACAUFEU
  //  Palette commune : orange chaud, ventre crème, flamme vive au bout de la
  //  queue. Bipède, museau rond, jamais un croc.
  // ###########################################################################

  const F_ORANGE = '#f08030', F_VENTRE = '#ffdca8';
  const F_ORANGE2 = '#e2622a', F_VENTRE2 = '#ffd79a';
  const F_ORANGE3 = '#ef7d57', F_VENTRE3 = '#ffe0a8';
  const AILE = '#6fa3e4', AILE_SOMBRE = '#5182c8';

  // ===========================================================================
  //  SALAMÈCHE — « Un petit lézard orange, sa flamme dit s'il est content. »
  //  ~0,80 unité · 29 meshes
  // ===========================================================================
  R3.registerCreature('salameche', function () {
    const g = shell(), inner = g.userData.inner;

    // --- Jambes ----------------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(R3.ellipsoid(0.078, 0.105, 0.080, F_ORANGE, s * 0.098, 0.175, 0.010,
        { rough: 0.85 }));
      inner.add(paw({ r: 0.082, squash: 0.66, stretch: 1.25, color: F_ORANGE,
        x: s * 0.102, y: 0.056, z: 0.062 }));
    });

    // --- Torse et ventre crème -------------------------------------------------
    const torse = R3.ellipsoid(0.170, 0.198, 0.162, F_ORANGE, 0, 0.398, 0, { rough: 0.84 });
    inner.add(torse);
    inner.add(faint(R3.ellipsoid(0.122, 0.148, 0.092, F_VENTRE, 0, 0.368, 0.098,
      { rough: 0.88 })));

    // --- Petits bras -----------------------------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.162, 0.452, 0.020);
      b.rotation.z = s * 0.55;
      b.add(R3.ellipsoid(0.042, 0.082, 0.045, F_ORANGE, 0, -0.062, 0, { rough: 0.85 }));
      b.add(faint(R3.sphere(0.050, F_ORANGE, 0, -0.132, 0.012, { rough: 0.88 })));
      inner.add(b);
      bras.push(b);
    });

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.622, 0.012);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.162, 0.148, 0.152, F_ORANGE, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.102, 0.072, 0.098, F_ORANGE, 0, -0.040, 0.132,
      { rough: 0.86 })));
    tete.add(bigEyes({ spread: 0.082, r: 0.058, pupilR: 0.030, y: 0.036, z: 0.140 }));
    tete.add(R3.blush(0.138, -0.030, 0.122, 0.036));
    tete.add(smile({ w: 0.046, depth: 0.024, r: 0.013, y: -0.063, z: 0.224, count: 5 }));

    // --- Queue et sa flamme ----------------------------------------------------
    const queue = pivot(0, 0.288, -0.142);
    inner.add(queue);
    queue.add(R3.ellipsoid(0.078, 0.078, 0.118, F_ORANGE, 0, -0.030, -0.105, { rough: 0.86 }));
    queue.add(R3.ellipsoid(0.062, 0.062, 0.105, F_ORANGE, 0, -0.030, -0.265, { rough: 0.86 }));
    queue.add(R3.ellipsoid(0.050, 0.050, 0.088, F_ORANGE, 0, 0.070, -0.378,
      { rough: 0.86 }));
    const feu = flamme({ h: 0.185, r: 0.082, y: 0.132, z: -0.428 });
    queue.add(feu);

    g.userData.anim = { head: tete, tail: queue, float: false };
    heartbeat(g, torse, function (t) {
      // La flamme vacille : c'est elle qui dit son humeur.
      const a = 1 + Math.sin(t * 7.3) * 0.13 + Math.sin(t * 3.1) * 0.06;
      feu.scale.set(1 / Math.sqrt(a), a, 1 / Math.sqrt(a));
      feu.rotation.z = Math.sin(t * 4.1) * 0.10;
      queue.rotation.y = Math.sin(t * 1.5) * 0.10;
      bras[0].rotation.x = Math.sin(t * 1.9) * 0.12;
      bras[1].rotation.x = Math.sin(t * 1.9 + 0.6) * 0.12;
    });

    g.userData.attack = function (root, p) {
      // « Flammèche » : il se dresse tout content et sa flamme fait « pouf ! ».
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.30;
      inn.position.y = k * 0.14;
      inn.rotation.x = -k * 0.14;
      tete.rotation.x = -k * 0.30;
      queue.rotation.x = -k * 0.45;
      feu.scale.setScalar(1 + k * 1.05);
      bras.forEach(function (b, i) {
        b.rotation.x = -Math.sin(pc * Math.PI * 2 + i * 1.2) * 0.75;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0; queue.rotation.set(0, 0, 0);
        feu.scale.setScalar(1);
        bras.forEach(function (b) { b.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  REPTINCEL — « Il a grandi, sa flamme est plus haute. »
  //  ~1,05 unité · 34 meshes
  // ===========================================================================
  R3.registerCreature('reptincel', function () {
    const g = shell(), inner = g.userData.inner;

    // --- Jambes ----------------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(R3.ellipsoid(0.098, 0.140, 0.100, F_ORANGE2, s * 0.122, 0.222, 0.008,
        { rough: 0.85 }));
      inner.add(paw({ r: 0.100, squash: 0.64, stretch: 1.28, color: F_ORANGE2,
        x: s * 0.128, y: 0.068, z: 0.072 }));
    });

    // --- Torse -----------------------------------------------------------------
    const torse = R3.ellipsoid(0.205, 0.250, 0.195, F_ORANGE2, 0, 0.512, 0, { rough: 0.84 });
    inner.add(torse);
    inner.add(faint(R3.ellipsoid(0.148, 0.190, 0.110, F_VENTRE2, 0, 0.478, 0.118,
      { rough: 0.88 })));

    // --- Bras ------------------------------------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.196, 0.586, 0.022);
      b.rotation.z = s * 0.52;
      b.add(R3.ellipsoid(0.048, 0.100, 0.052, F_ORANGE2, 0, -0.078, 0, { rough: 0.85 }));
      b.add(faint(R3.sphere(0.058, F_ORANGE2, 0, -0.168, 0.014, { rough: 0.88 })));
      inner.add(b);
      bras.push(b);
    });

    // --- Ébauches d'ailes : la promesse de Dracaufeu ---------------------------
    const ailerons = [];
    [-1, 1].forEach(function (s) {
      const a = pivot(s * 0.168, 0.652, -0.128);
      a.rotation.y = s * 0.62;
      a.rotation.z = s * 0.42;
      a.add(faint(R3.wing(0.155, 0.115, AILE, s * 0.150, 0.030, -0.020,
        { rough: 0.70 })));
      inner.add(a);
      ailerons.push(a);
    });

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.808, 0.026);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.180, 0.162, 0.172, F_ORANGE2, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.118, 0.084, 0.126, F_ORANGE2, 0, -0.046, 0.152,
      { rough: 0.86 })));
    // Sa petite corne arrière : elle deviendra les deux cornes de Dracaufeu.
    const corne = R3.cone(0.044, 0.150, F_ORANGE2, 0, 0.128, -0.120, { seg: 8, rough: 0.85 });
    corne.rotation.x = 0.85;
    tete.add(faint(corne));
    tete.add(bigEyes({ spread: 0.090, r: 0.062, pupilR: 0.032, y: 0.038, z: 0.152 }));
    tete.add(R3.blush(0.152, -0.032, 0.136, 0.040));
    tete.add(smile({ w: 0.053, depth: 0.028, r: 0.015, y: -0.072, z: 0.270, count: 5 }));

    // --- Queue et flamme --------------------------------------------------------
    const queue = pivot(0, 0.372, -0.178);
    inner.add(queue);
    queue.add(R3.ellipsoid(0.092, 0.092, 0.142, F_ORANGE2, 0, -0.035, -0.128, { rough: 0.86 }));
    queue.add(R3.ellipsoid(0.074, 0.074, 0.125, F_ORANGE2, 0, -0.032, -0.318, { rough: 0.86 }));
    queue.add(R3.ellipsoid(0.058, 0.058, 0.102, F_ORANGE2, 0, 0.092, -0.452,
      { rough: 0.86 }));
    const feu = flamme({ h: 0.235, r: 0.098, y: 0.160, z: -0.512 });
    queue.add(feu);

    g.userData.anim = { head: tete, tail: queue, float: false };
    heartbeat(g, torse, function (t) {
      const a = 1 + Math.sin(t * 6.8) * 0.15 + Math.sin(t * 2.9) * 0.07;
      feu.scale.set(1 / Math.sqrt(a), a, 1 / Math.sqrt(a));
      feu.rotation.z = Math.sin(t * 3.8) * 0.12;
      queue.rotation.y = Math.sin(t * 1.4) * 0.12;
      ailerons[0].rotation.x = Math.sin(t * 2.4) * 0.20;
      ailerons[1].rotation.x = Math.sin(t * 2.4 + 0.5) * 0.20;
    });

    g.userData.attack = function (root, p) {
      // « Danse-Flammes » : il pivote, sa queue dessine un cercle de feu.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.34;
      inn.position.y = k * 0.16;
      inn.rotation.y = pc * Math.PI * 2;
      tete.rotation.x = -k * 0.28;
      queue.rotation.x = -k * 0.40;
      queue.rotation.y = Math.sin(pc * Math.PI * 2) * 0.55;
      feu.scale.setScalar(1 + k * 1.15);
      ailerons.forEach(function (a, i) {
        a.rotation.x = -Math.sin(pc * Math.PI * 4 + i) * 0.55;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.set(0, 0, 0);
        tete.rotation.x = 0; queue.rotation.set(0, 0, 0);
        feu.scale.setScalar(1);
        ailerons.forEach(function (a) { a.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  DRACAUFEU — « Le grand dragon orange aux ailes bleues. »
  //  ~1,44 unité · 39 meshes — LA créature du jeu : Clélia la chevauche pendant
  //  tout le vol (CONTRACT-V4 §6). Vue de près, de dos, de trois quarts.
  // ===========================================================================
  R3.registerCreature('dracaufeu', function () {
    const g = shell(), inner = g.userData.inner;

    // --- Jambes puissantes mais rondes -----------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(R3.ellipsoid(0.122, 0.178, 0.132, F_ORANGE3, s * 0.172, 0.298, 0.006,
        { rough: 0.84 }));
      inner.add(paw({ r: 0.132, squash: 0.62, stretch: 1.32, color: F_ORANGE3,
        x: s * 0.176, y: 0.088, z: 0.096 }));
    });

    // --- Torse et grand ventre crème -------------------------------------------
    const torse = R3.ellipsoid(0.252, 0.320, 0.235, F_ORANGE3, 0, 0.672, 0, { rough: 0.83 });
    inner.add(torse);
    inner.add(R3.ellipsoid(0.182, 0.268, 0.132, F_VENTRE3, 0, 0.630, 0.138, { rough: 0.88 }));

    // --- Cou --------------------------------------------------------------------
    //  LE COU — allongé et penché vers l'avant (corrigé après relecture des
    //  captures : la tête était posée à même le torse, et Dracaufeu se lisait
    //  comme un ourson à ailes bleues plutôt que comme un dragon). C'est le cou
    //  qui fait la silhouette de dragon, bien plus que les ailes.
    const cou = R3.ellipsoid(0.104, 0.215, 0.116, F_ORANGE3, 0, 1.002, 0.104, { rough: 0.84 });
    cou.rotation.x = -0.40;
    inner.add(cou);

    // --- Petits bras ------------------------------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.248, 0.752, 0.028);
      b.rotation.z = s * 0.50;
      b.add(R3.ellipsoid(0.054, 0.112, 0.058, F_ORANGE3, 0, -0.090, 0, { rough: 0.85 }));
      b.add(faint(R3.sphere(0.064, F_ORANGE3, 0, -0.192, 0.016, { rough: 0.88 })));
      inner.add(b);
      bras.push(b);
    });

    // --- LES AILES BLEUES -------------------------------------------------------
    //  Deux niveaux : `piv` reçoit le battement (R3.idleCreature écrit sa
    //  rotation.z), `rig` porte l'ouverture fixe de l'aile déployée. Aucune
    //  géométrie n'est mise à l'échelle.
    const ailes = [];
    [-1, 1].forEach(function (s) {
      const piv = pivot(s * 0.198, 0.856, -0.188);
      const rig = pivot(0, 0, 0);
      // ATTENTION AU SIGNE : R_y(+θ) envoie +x vers -z. Un `rotation.y` négatif
      // rabattrait les ailes DEVANT le museau (erreur vue à la sonde).
      rig.rotation.y = s * 0.72;    // balayées vers l'arrière
      rig.rotation.z = s * 0.36;    // et bien levées : la silhouette du dragon
      piv.add(rig);
      // Grande membrane, montante
      rig.add(faint(R3.ellipsoid(0.300, 0.265, 0.030, AILE, s * 0.315, 0.055, -0.015,
        { rough: 0.66, seg: 18, side: THREE.DoubleSide })));
      // Lobe extérieur : c'est lui qui donne la découpe en feston de l'aile
      rig.add(faint(R3.ellipsoid(0.200, 0.170, 0.026, AILE_SOMBRE, s * 0.545, -0.098, 0,
        { rough: 0.66, seg: 16, side: THREE.DoubleSide })));
      // Bras de l'aile (orange, comme dans la vraie série), rangé À L'INTÉRIEUR
      // de la silhouette de la membrane pour ne jamais dépasser en pique.
      const os = R3.ellipsoid(0.300, 0.030, 0.038, F_ORANGE3, s * 0.290, 0.175, 0.014,
        { rough: 0.85 });
      os.rotation.z = -s * 0.18;
      rig.add(faint(os));
      piv.userData.rig = rig;
      inner.add(piv);
      ailes.push(piv);
    });

    // --- Tête : museau doux, grands yeux, deux petites cornes ------------------
    //  La tête est portée EN AVANT, au bout du cou, et non posée sur le dos.
    const tete = pivot(0, 1.212, 0.252);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.172, 0.156, 0.176, F_ORANGE3, 0, 0, 0, { rough: 0.83 }));
    // Le museau : LONG (c'est lui qui dit « dragon »), rond, sans le moindre croc.
    tete.add(R3.ellipsoid(0.116, 0.092, 0.232, F_ORANGE3, 0, -0.050, 0.216, { rough: 0.85 }));
    // Une narine de chaque côté du bout du museau : le détail qui achève de le
    // rendre lisible de profil.
    [-1, 1].forEach(function (s) {
      tete.add(faint(R3.sphere(0.017, '#c8551f', s * 0.045, -0.020, 0.418, { rough: 0.7 })));
    });
    [-1, 1].forEach(function (s) {
      const c = R3.cone(0.042, 0.185, F_ORANGE3, s * 0.098, 0.140, -0.108,
        { seg: 8, rough: 0.84 });
      c.rotation.x = 0.95;
      c.rotation.z = -s * 0.20;
      tete.add(faint(c));
    });
    tete.add(bigEyes({ spread: 0.098, r: 0.068, pupilR: 0.035, y: 0.046, z: 0.148 }));
    tete.add(R3.blush(0.168, -0.026, 0.140, 0.046));
    // count: 3 et non 4 — les deux narines ajoutées valent mieux qu'une perle
    // de sourire de plus, et le budget de 40 meshes est une règle du contrat.
    tete.add(smile({ w: 0.056, depth: 0.030, r: 0.017, y: -0.086, z: 0.398, count: 3 }));

    // --- Le souffle de feu, replié au repos ------------------------------------
    //  Translucide (opacité < 0,68) : la sonde l'exclut de la silhouette, et il
    //  ne déforme pas la boîte englobante que le jeu utilise pour poser la
    //  créature sur sa plateforme.
    const souffle = pivot(0, -0.058, 0.418);
    //  Le cône est rangé À PLAT sur +z (rotation.x) : sa position doit donc être
    //  décalée en z, PAS en y — sinon la gerbe sort du front et non de la bouche.
    const jet = R3.cone(0.115, 0.520, '#ffb14a', 0, 0, 0.260, {
      seg: 10, rough: 0.35, transparent: true, opacity: 0.62,
      emissive: '#ff8a2a', emissiveIntensity: 1.0,
    });
    jet.rotation.x = Math.PI / 2;
    souffle.add(faint(jet));
    souffle.visible = false;
    souffle.scale.set(1, 1, 0.001);
    tete.add(souffle);

    // --- Queue et grande flamme -------------------------------------------------
    const queue = pivot(0, 0.462, -0.205);
    inner.add(queue);
    queue.add(R3.ellipsoid(0.112, 0.112, 0.175, F_ORANGE3, 0, -0.045, -0.155, { rough: 0.85 }));
    queue.add(R3.ellipsoid(0.090, 0.090, 0.155, F_ORANGE3, 0, -0.040, -0.385, { rough: 0.85 }));
    queue.add(R3.ellipsoid(0.070, 0.070, 0.122, F_ORANGE3, 0, 0.112, -0.548,
      { rough: 0.85 }));
    // La flamme de la queue : agrandie. C'est LA signature de Dracaufeu, et
    // Clélia la verra de très près pendant tout le vol.
    const feu = flamme({ h: 0.360, r: 0.142, y: 0.212, z: -0.652 });
    queue.add(feu);

    g.userData.anim = {
      head: tete, wingL: ailes[0], wingR: ailes[1], tail: queue, float: false,
    };

    heartbeat(g, torse, function (t) {
      // Flamme vivante — c'est le détail qu'on regarde pendant tout le vol.
      const a = 1 + Math.sin(t * 6.2) * 0.16 + Math.sin(t * 2.7) * 0.08;
      feu.scale.set(1 / Math.sqrt(a), a, 1 / Math.sqrt(a));
      feu.rotation.z = Math.sin(t * 3.4) * 0.13;
      // Les grandes ailes respirent : un gonflement lent, jamais nerveux.
      // (R3.idleCreature() écrit rotation.z sur le pivot ; on n'y touche pas.)
      for (let i = 0; i < ailes.length; i++) {
        const s = (i === 0) ? -1 : 1;
        ailes[i].userData.rig.rotation.y = s * (0.72 + Math.sin(t * 1.5) * 0.10);
        ailes[i].userData.rig.rotation.x = Math.sin(t * 1.5 + 0.6) * 0.07;
      }
      queue.rotation.x = Math.sin(t * 1.2) * 0.05;
      bras[0].rotation.x = Math.sin(t * 1.8) * 0.10;
      bras[1].rotation.x = Math.sin(t * 1.8 + 0.7) * 0.10;
    });

    g.userData.attack = function (root, p) {
      // « Lance-Flammes » : il prend appui, ouvre grand les ailes, lève la tête
      // et souffle une belle gerbe orange. Joyeux, jamais menaçant.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.y = k * 0.26;
      inn.position.z = k * 0.24;
      inn.rotation.x = -k * 0.12;

      ailes.forEach(function (piv, i) {
        const s = (i === 0) ? -1 : 1;
        piv.rotation.z = s * Math.sin(pc * Math.PI * 3) * 0.55;
        piv.userData.rig.rotation.y = s * (0.72 - k * 0.45);
        piv.userData.rig.rotation.x = -k * 0.25;
      });

      tete.rotation.x = -k * 0.34;
      queue.rotation.x = -k * 0.38;
      feu.scale.setScalar(1 + k * 1.35);

      const ouvert = (pc > 0.30 && pc < 0.88);
      souffle.visible = ouvert;
      souffle.scale.set(0.6 + k * 0.9, 0.6 + k * 0.9, ouvert ? (0.3 + k * 1.5) : 0.001);

      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        ailes.forEach(function (piv, i) {
          const s = (i === 0) ? -1 : 1;
          piv.rotation.z = 0;
          piv.userData.rig.rotation.set(0, s * 0.72, s * 0.36);
        });
        tete.rotation.x = 0; queue.rotation.x = 0;
        feu.scale.setScalar(1);
        souffle.visible = false;
        souffle.scale.set(1, 1, 0.001);
      }
    };
    return g;
  });

  // ###########################################################################
  //  LIGNÉE 3 — CARAPUCE › CARABAFFE › TORTANK
  //  Palette commune : peau bleu ciel, carapace brune à liseré clair, plastron
  //  crème. Petite tortue debout, tête ronde, grands yeux.
  // ###########################################################################

  const E_PEAU = '#7ec8f0', E_OMBRE = '#5f9fdd';
  const E_PEAU2 = '#6fa8e8', E_OMBRE2 = '#5081d6';
  const E_PEAU3 = '#5f8fd8', E_OMBRE3 = '#3f63c4';
  const CARAPACE = '#c8763c', CARAPACE2 = '#b86b3c', CARAPACE3 = '#a2572c';
  const PLASTRON = '#f6dfae', LISERE = '#efaf68';

  // ===========================================================================
  //  CARAPUCE — « Une petite tortue bleue. »
  //  ~0,73 unité · 26 meshes
  // ===========================================================================
  R3.registerCreature('carapuce', function () {
    const g = shell(), inner = g.userData.inner;

    // --- Pieds et bras ---------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(paw({ r: 0.092, squash: 0.62, stretch: 1.30, color: E_PEAU,
        x: s * 0.128, y: 0.058, z: 0.086 }));
    });
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.212, 0.322, 0.036);
      b.rotation.z = s * 0.62;
      b.add(R3.ellipsoid(0.052, 0.088, 0.058, E_PEAU, 0, -0.058, 0, { rough: 0.86 }));
      inner.add(b);
      bras.push(b);
    });

    // --- Carapace : dôme brun, liseré clair, plastron crème --------------------
    const carapace = R3.ellipsoid(0.245, 0.212, 0.232, CARAPACE, 0, 0.312, -0.032,
      { rough: 0.80 });
    inner.add(carapace);
    inner.add(R3.ellipsoid(0.192, 0.182, 0.132, PLASTRON, 0, 0.302, 0.128, { rough: 0.88 }));
    const liseré = R3.torus(0.238, 0.032, LISERE, 0, 0.296, -0.045, { rough: 0.82, seg: 16 });
    liseré.rotation.x = Math.PI / 2;
    inner.add(faint(liseré));
    [[0, 0.485, -0.045], [-0.135, 0.415, -0.130], [0.135, 0.415, -0.130]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.058, 0.028, 0.058, '#9d5629', t[0], t[1], t[2],
          { rough: 0.9 })));
      });

    // --- Queue enroulée --------------------------------------------------------
    const queue = pivot(0, 0.268, -0.252);
    inner.add(queue);
    queue.add(faint(R3.ellipsoid(0.048, 0.048, 0.075, E_PEAU, 0, 0.010, -0.060,
      { rough: 0.88 })));
    queue.add(faint(R3.ellipsoid(0.036, 0.036, 0.052, E_OMBRE, 0, 0.072, -0.108,
      { rough: 0.88 })));

    // --- Tête ------------------------------------------------------------------
    const tete = pivot(0, 0.545, 0.108);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.186, 0.168, 0.172, E_PEAU, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.112, 0.078, 0.098, E_PEAU, 0, -0.048, 0.132,
      { rough: 0.86 })));
    tete.add(bigEyes({ spread: 0.090, r: 0.064, pupilR: 0.034, y: 0.036, z: 0.148 }));
    tete.add(R3.blush(0.152, -0.036, 0.130, 0.038));
    tete.add(smile({ w: 0.050, depth: 0.026, r: 0.014, y: -0.072, z: 0.224, count: 5 }));

    g.userData.anim = { head: tete, tail: queue, float: false };
    heartbeat(g, carapace, function (t) {
      bras[0].rotation.x = Math.sin(t * 2.1) * 0.22;
      bras[1].rotation.x = Math.sin(t * 2.1 + 0.8) * 0.22;
      queue.rotation.y = Math.sin(t * 1.7) * 0.16;
    });

    g.userData.attack = function (root, p) {
      // « Pistolet à O » : elle gonfle les joues et envoie son jet, puis rit.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.32;
      inn.position.y = k * 0.10;
      inn.rotation.x = -k * 0.18;
      tete.rotation.x = -k * 0.26;
      tete.position.z = 0.108 + k * 0.055;
      bras.forEach(function (b, i) {
        b.rotation.x = -Math.sin(pc * Math.PI * 2 + i * 1.1) * 0.85;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0; tete.position.z = 0.108;
        bras.forEach(function (b) { b.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  CARABAFFE — « Sa queue est devenue toute duveteuse. »
  //  ~0,95 unité · 30 meshes
  // ===========================================================================
  R3.registerCreature('carabaffe', function () {
    const FOURRURE = '#eaf2ff';
    const g = shell(), inner = g.userData.inner;

    [-1, 1].forEach(function (s) {
      inner.add(paw({ r: 0.108, squash: 0.62, stretch: 1.30, color: E_PEAU2,
        x: s * 0.152, y: 0.068, z: 0.098 }));
    });
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.252, 0.412, 0.042);
      b.rotation.z = s * 0.60;
      b.add(R3.ellipsoid(0.060, 0.108, 0.066, E_PEAU2, 0, -0.072, 0, { rough: 0.86 }));
      inner.add(b);
      bras.push(b);
    });

    // --- Carapace ---------------------------------------------------------------
    const carapace = R3.ellipsoid(0.292, 0.252, 0.278, CARAPACE2, 0, 0.398, -0.038,
      { rough: 0.80 });
    inner.add(carapace);
    inner.add(R3.ellipsoid(0.228, 0.216, 0.156, PLASTRON, 0, 0.386, 0.156, { rough: 0.88 }));
    const liseré = R3.torus(0.282, 0.038, LISERE, 0, 0.380, -0.055, { rough: 0.82, seg: 16 });
    liseré.rotation.x = Math.PI / 2;
    inner.add(faint(liseré));
    [[0, 0.622, -0.055], [-0.162, 0.532, -0.155], [0.162, 0.532, -0.155]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.068, 0.032, 0.068, '#8f5028', t[0], t[1], t[2],
          { rough: 0.9 })));
      });

    // --- La grande queue duveteuse ----------------------------------------------
    const queue = pivot(0, 0.352, -0.298);
    inner.add(queue);
    queue.add(R3.ellipsoid(0.088, 0.088, 0.112, FOURRURE, 0, 0.020, -0.078, { rough: 0.95 }));
    queue.add(faint(R3.ellipsoid(0.078, 0.078, 0.098, FOURRURE, 0, 0.128, -0.142,
      { rough: 0.95 })));
    queue.add(faint(R3.ellipsoid(0.062, 0.062, 0.078, FOURRURE, 0, 0.252, -0.146,
      { rough: 0.95 })));

    // --- Tête et ses oreilles duveteuses ---------------------------------------
    const tete = pivot(0, 0.692, 0.126);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.208, 0.188, 0.192, E_PEAU2, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.126, 0.088, 0.110, E_PEAU2, 0, -0.054, 0.148,
      { rough: 0.86 })));
    [-1, 1].forEach(function (s) {
      const o = R3.ellipsoid(0.115, 0.048, 0.062, FOURRURE, s * 0.212, 0.062, -0.062,
        { rough: 0.95 });
      o.rotation.z = -s * 0.55;
      o.rotation.y = s * 0.35;
      tete.add(faint(o));
    });
    tete.add(bigEyes({ spread: 0.100, r: 0.070, pupilR: 0.037, y: 0.040, z: 0.166 }));
    tete.add(R3.blush(0.168, -0.040, 0.146, 0.042));
    tete.add(smile({ w: 0.056, depth: 0.028, r: 0.015, y: -0.081, z: 0.251, count: 5 }));

    g.userData.anim = { head: tete, tail: queue, float: false };
    heartbeat(g, carapace, function (t) {
      bras[0].rotation.x = Math.sin(t * 2.0) * 0.20;
      bras[1].rotation.x = Math.sin(t * 2.0 + 0.8) * 0.20;
      queue.rotation.y = Math.sin(t * 1.9) * 0.22;
      queue.rotation.x = Math.sin(t * 1.3) * 0.08;
    });

    g.userData.attack = function (root, p) {
      // « Vibraqua » : elle se penche, sa queue fouette l'eau et tout tremble.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.36;
      inn.position.y = k * 0.12;
      inn.rotation.x = -k * 0.18;
      tete.rotation.x = -k * 0.28;
      queue.rotation.y = Math.sin(pc * Math.PI * 5) * 0.85;
      bras.forEach(function (b, i) {
        b.rotation.x = -Math.sin(pc * Math.PI * 2 + i * 1.1) * 0.90;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0; queue.rotation.set(0, 0, 0);
        bras.forEach(function (b) { b.rotation.x = 0; });
      }
    };
    return g;
  });

  // ===========================================================================
  //  TORTANK — « Deux gros canons à eau sortent de sa carapace. »
  //  ~1,27 unité · 33 meshes. La carapace a le droit d'être un peu ferme :
  //  c'est de la matière minérale. Le reste est tout rond.
  // ===========================================================================
  R3.registerCreature('tortank', function () {
    const CANON = '#c3ccda', CANON_SOMBRE = '#98a4b6';
    const g = shell(), inner = g.userData.inner;

    // --- Jambes ----------------------------------------------------------------
    [-1, 1].forEach(function (s) {
      inner.add(R3.ellipsoid(0.132, 0.155, 0.140, E_PEAU3, s * 0.248, 0.262, 0.028,
        { rough: 0.85 }));
      inner.add(paw({ r: 0.152, squash: 0.60, stretch: 1.24, color: E_PEAU3,
        x: s * 0.252, y: 0.098, z: 0.112 }));
    });

    // --- Carapace massive -------------------------------------------------------
    const carapace = R3.ellipsoid(0.415, 0.352, 0.400, CARAPACE3, 0, 0.648, -0.052,
      { rough: 0.78 });
    inner.add(carapace);
    inner.add(R3.ellipsoid(0.302, 0.300, 0.212, PLASTRON, 0, 0.618, 0.238, { rough: 0.88 }));
    const liseré = R3.torus(0.400, 0.046, LISERE, 0, 0.606, -0.075, { rough: 0.82, seg: 18 });
    liseré.rotation.x = Math.PI / 2;
    inner.add(faint(liseré));
    [[0, 0.968, -0.085], [-0.230, 0.848, -0.212], [0.230, 0.848, -0.212]]
      .forEach(function (t) {
        inner.add(faint(R3.ellipsoid(0.098, 0.042, 0.098, '#8a4922', t[0], t[1], t[2],
          { rough: 0.9 })));
      });

    // --- Les deux canons à eau ---------------------------------------------------
    const canons = [];
    [-1, 1].forEach(function (s) {
      const c = pivot(s * 0.372, 0.772, -0.132);
      c.rotation.x = 1.10;          // ils pointent vers l'avant, légèrement levés
      c.rotation.z = -s * 0.26;
      c.add(R3.cyl(0.092, 0.108, 0.320, CANON, 0, 0.150, 0, { seg: 12, rough: 0.55 }));
      const bague = R3.torus(0.092, 0.030, CANON_SOMBRE, 0, 0.300, 0, { rough: 0.5, seg: 14 });
      bague.rotation.x = Math.PI / 2;
      c.add(faint(bague));
      inner.add(c);
      canons.push(c);
    });

    // --- Bras -------------------------------------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const b = pivot(s * 0.372, 0.665, 0.096);
      b.rotation.z = s * 0.58;
      b.add(R3.ellipsoid(0.082, 0.135, 0.088, E_PEAU3, 0, -0.096, 0, { rough: 0.86 }));
      b.add(faint(R3.sphere(0.096, E_PEAU3, 0, -0.216, 0.026, { rough: 0.88 })));
      inner.add(b);
      bras.push(b);
    });

    // --- Queue ------------------------------------------------------------------
    const queue = pivot(0, 0.478, -0.418);
    inner.add(queue);
    queue.add(faint(R3.ellipsoid(0.072, 0.072, 0.128, E_PEAU3, 0, 0.010, -0.092,
      { rough: 0.88 })));

    // --- Tête -------------------------------------------------------------------
    const tete = pivot(0, 0.985, 0.258);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.238, 0.212, 0.220, E_PEAU3, 0, 0, 0, { rough: 0.84 }));
    tete.add(faint(R3.ellipsoid(0.146, 0.100, 0.126, E_PEAU3, 0, -0.062, 0.170,
      { rough: 0.86 })));
    tete.add(bigEyes({ spread: 0.114, r: 0.078, pupilR: 0.041, y: 0.046, z: 0.190 }));
    tete.add(R3.blush(0.192, -0.046, 0.168, 0.048));
    tete.add(smile({ w: 0.065, depth: 0.032, r: 0.017, y: -0.093, z: 0.288, count: 5 }));

    g.userData.anim = { head: tete, tail: queue, float: false };
    heartbeat(g, carapace, function (t) {
      bras[0].rotation.x = Math.sin(t * 1.7) * 0.16;
      bras[1].rotation.x = Math.sin(t * 1.7 + 0.9) * 0.16;
      // Les canons se règlent doucement, comme deux petits périscopes.
      for (let i = 0; i < canons.length; i++) {
        const s = (i === 0) ? -1 : 1;
        canons[i].rotation.z = -s * 0.26 + Math.sin(t * 1.1 + i * 0.5) * 0.09;
      }
      queue.rotation.y = Math.sin(t * 1.5) * 0.14;
    });

    g.userData.attack = function (root, p) {
      // « Hydrocanon » : elle se cale sur ses pattes, les canons se lèvent et
      // tout le monde est trempé. C'est une fête, pas une bataille.
      busy(root, p);
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.26;
      inn.rotation.x = -k * 0.10;
      tete.rotation.x = -k * 0.20;
      canons.forEach(function (c, i) {
        const s = (i === 0) ? -1 : 1;
        c.rotation.x = 1.10 + k * 0.30;
        c.rotation.z = -s * 0.26 + Math.sin(pc * Math.PI * 4) * 0.12;
        c.position.y = 0.772 - k * 0.035;
      });
      bras.forEach(function (b, i) {
        b.rotation.x = -Math.sin(pc * Math.PI * 2 + i) * 0.55;
      });
      if (p >= 1) {
        inn.position.set(0, 0, 0); inn.rotation.x = 0;
        tete.rotation.x = 0;
        canons.forEach(function (c, i) {
          const s = (i === 0) ? -1 : 1;
          c.rotation.x = 1.10; c.rotation.z = -s * 0.26; c.position.y = 0.772;
        });
        bras.forEach(function (b) { b.rotation.x = 0; });
      }
    };
    return g;
  });

})();
