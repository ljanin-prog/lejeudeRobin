// =============================================================================
//  airship3d.js — LE DIRIGEABLE  (CONTRACT2.md §17 bis)
// -----------------------------------------------------------------------------
//  Traverser six régions à pied prend du temps : chaque région possède un port
//  aérien, et le dirigeable saute de l'un à l'autre. 95 % du temps il est
//  AMARRÉ à son mât au-dessus de la ville — un gros repère rassurant dans le
//  ciel ; le reste du temps c'est la plus belle chose du jeu, alors la
//  cinématique de vol a droit à six secondes de spectacle.
//
//  API — R3.register('airship', { build, PORTS, registerPort, portOf, dockAt,
//                                 fly, isFlying, update, model })
//
// =============================================================================
//  ⚠️  POINT D'INTÉGRATION LE PLUS IMPORTANT — LE CHARGEMENT DE LA RÉGION
// -----------------------------------------------------------------------------
//  Changer de région coûte ~150 ms (génération + chunks) : c'est un à-coup
//  visible. Il doit tomber PENDANT la traversée, au moment précis où l'écran
//  est noyé dans les nuages — Robin ne verra rien.
//
//  Deux façons de s'y accrocher, au choix (les deux marchent ensemble) :
//
//   1) un rappel, posé UNE FOIS au démarrage :
//
//        R3.get('airship').onMidFlight(function (from, to) {
//          world.setRegion(to);          // ~150 ms : c'est le bon moment
//          roamers.setRegion(to);
//          regions.load(to);
//        });
//
//   2) ou en surveillant l'état à chaque image :
//
//        const a = R3.get('airship');
//        if (a.isFlying() && a.phase() === 'cruise' && !dejaCharge) { ... }
//
//      `phase()` vaut 'idle' | 'board' | 'lift' | 'cruise' | 'descent' | 'dock'.
//      La phase 'cruise' commence à t = 2,4 s ; le rappel `onMidFlight` est
//      déclenché à t = 3,1 s, quand le voile de nuages est à son maximum.
//
//  GARANTIES, dans TOUS les cas — y compris si Robin appuie sur Espace pour
//  sauter la cinématique, si `sky3d`/`world` manquent, ou si `update()` n'est
//  jamais appelé :
//    • `onMidFlight` est appelé exactement UNE fois par vol, TOUJOURS avant
//      `onArrive` (donc la région est chargée avant qu'on rende la main) ;
//    • `onArrive()` est appelé exactement UNE fois par vol ;
//    • un garde-fou (setTimeout de 9 s + horloge murale) termine le vol quoi
//      qu'il arrive : on ne laisse JAMAIS un enfant bloqué en l'air.
//  Rien ne dépend d'un `dt` non borné : le temps de vol avance avec un dt
//  plafonné à 50 ms, et la sécurité utilise l'horloge murale.
//
// -----------------------------------------------------------------------------
//  AJOUTS HORS CONTRAT (documentés)
// -----------------------------------------------------------------------------
//    takeCamera(camera) / releaseCamera()
//        Le dirigeable prend la main sur la caméra pendant le vol et la rend à
//        l'arrivée. `takeCamera` suspend `camera3d.js` (`camera.suspend()`) et
//        `releaseCamera` le réveille (`camera.resume()`), qui reprend le suivi
//        du joueur en douceur depuis la position laissée par le dirigeable.
//        `fly()` les appelle tout seul si une caméra a été fournie
//        (via `build(scene, camera)`, `setCamera(cam)` ou `takeCamera(cam)`).
//    setPlayer(group) / phase() / progress() / skip() / onMidFlight(fn)
//        `setPlayer` confie à `airship3d` le THREE.Group du joueur : il est
//        posé dans la nacelle pendant le vol (reparenté), puis rendu à son
//        parent d'origine à l'arrivée, à charge pour game3d.js de le
//        repositionner sur la tuile AIRSHIP_DOCK.
//    canFly(from, to, visitedRegions) / travelOptions(current, visitedRegions)
//        La règle de déblocage n'est écrite qu'ICI. `travelOptions` renvoie la
//        liste prête à afficher pour `hud3d.openAirshipMenu(...)`.
//    REGION_OF / PORT_NAMES / mast(), seat()
// =============================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') {
    if (typeof console !== 'undefined') {
      console.warn('[airship3d] THREE ou R3 absent : module inactif.');
    }
    return;
  }

  // ---------------------------------------------------------------------------
  //  PALETTE ET DIMENSIONS
  // ---------------------------------------------------------------------------

  const C = {
    toile: '#f4e4c1',      // enveloppe : toile crème
    vert: '#38b764',
    bleu: '#41a6f6',
    jaune: '#f1c40f',
    rose: '#ff6b9d',
    bois: '#8b5a2b',
    boisClair: '#c8a06a',
    metal: '#9aa0a6',
    corde: '#e3c68d',
    nuit: '#3d4e62',
    hublot: '#ffe066',
  };

  // Le nez du dirigeable pointe vers +z dans le repère du modèle.
  const HULL_LEN = 7.4;    // demi-longueur de l'enveloppe
  const HULL_R = 3.15;     // rayon de l'enveloppe
  const GOND_Y = -4.6;     // hauteur de la nacelle sous le centre de l'enveloppe

  const MAST_TOP = 9.2;    // hauteur du sommet du mât au-dessus du sol
  const CRUISE_UP = 34;    // altitude de croisière au-dessus du point de départ

  // ---------------------------------------------------------------------------
  //  LES SIX PORTS  (§17 bis — noms figés)
  // ---------------------------------------------------------------------------

  const PORT_NAMES = {
    val: "Escale d'Émeraude",
    sylve: "Ponton d'Ambrelune",
    saphir: 'Amarre du Phare',
    givre: 'Mât de Cimefroide',
    braise: 'Pont de Fournaise',
    aurore: 'Quai des Nuées',
  };

  const REGION_NAMES = {
    val: "Val d'Émeraude",
    sylve: "Sylve d'Ambre",
    saphir: 'Côte de Saphir',
    givre: 'Massif de Givre',
    braise: 'Caldeira de Braise',
    aurore: "Plateau d'Aurore",
  };

  // Disposition logique du monde (§3) : elle sert à donner au vol un CAP
  // plausible — on part vraiment dans la direction de la région visée.
  //        [givre]  [aurore]  [braise]
  //        [val]    [sylve]   [saphir]
  const GRID = {
    givre: { gx: 0, gy: 0 }, aurore: { gx: 1, gy: 0 }, braise: { gx: 2, gy: 0 },
    val: { gx: 0, gy: 1 }, sylve: { gx: 1, gy: 1 }, saphir: { gx: 2, gy: 1 },
  };

  const ORDER = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];

  // { regionId: { x, y, name } } — x/y en tuiles, null tant que regions3d.js
  // n'a pas déclaré le port de sa région.
  const PORTS = {};
  ORDER.forEach(function (id) {
    PORTS[id] = { x: null, y: null, name: PORT_NAMES[id], regionId: id };
  });

  // ---------------------------------------------------------------------------
  //  ÉTAT
  // ---------------------------------------------------------------------------

  const S = {
    scene: null,
    ship: null,          // THREE.Group du dirigeable
    clouds: null,        // banc de nuages de croisière
    anim: null,          // références des pièces animées
    cam: null,
    player: null,        // THREE.Group du joueur (facultatif)
    playerHome: null,    // { parent, pos, rot, scale } pour le rendre intact

    docked: { region: null, x: 0, y: 0, wx: 0, wy: 0, wz: 0, yaw: 0 },

    flying: false,
    phase: 'idle',
    t: 0,                // temps de vol (s), avancé avec un dt plafonné
    wallStart: 0,        // horloge murale : garde-fou
    from: null, to: null,
    heading: { x: 0, z: -1 },
    origin: new THREE.Vector3(),
    target: new THREE.Vector3(),
    midDone: false,
    arriveDone: false,
    onArrive: null,
    onMidOnce: null,
    midHooks: [],
    guard: 0,            // id du setTimeout de sécurité
    keyHandler: null,
    camTaken: false,
    veilK: 0,
  };

  // ---------------------------------------------------------------------------
  //  MINUTAGE DE LA CINÉMATIQUE (secondes)
  // ---------------------------------------------------------------------------

  const T_BOARD = 0.9;      // 1. embarquement (fondu court)
  const T_LIFT = 2.4;       // 2. décollage : la région s'éloigne
  const T_MID = 3.1;        // ← CHARGEMENT DE LA RÉGION (voile au maximum)
  const T_CRUISE = 4.5;     // 3. traversée au-dessus des nuages
  const T_DESCENT = 5.8;    // 4. descente vers le port d'arrivée
  const T_END = 6.3;        //    amarrage, on rend la main
  const GUARD_MS = 9000;    // garde-fou absolu

  // Vecteurs de travail (aucune allocation par image).
  const _v = new THREE.Vector3();
  const _aim = new THREE.Vector3();
  const _camPos = new THREE.Vector3();

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }
  function smooth01(t) { return R3.easeInOut(R3.clamp01(t)); }
  function seg(t, a, b) { return R3.clamp01((t - a) / Math.max(0.0001, b - a)); }

  // ===========================================================================
  //  LE MODÈLE  (≤ 90 meshes — on en compte ~60)
  // ===========================================================================

  /**
   * Construit le dirigeable. Nez vers +z, centre de l'enveloppe à l'origine :
   * il suffit de poser le groupe et de régler `rotation.y` pour l'orienter.
   * Majestueux et rassurant : des rondeurs, du bois, des lanternes — rien de
   * militaire.
   */
  function buildAirship() {
    const g = R3.group();
    const anim = { props: [], banner: [], rudders: [], lanterns: [], glow: [] };

    // --- L'ENVELOPPE ---------------------------------------------------------
    const toile = { rough: 0.9, flat: false };
    g.add(R3.ellipsoid(HULL_R, HULL_R * 0.94, HULL_LEN, C.toile, 0, 0, 0, toile));
    // Nez arrondi et queue effilée : la silhouette fuselée vient de là.
    g.add(R3.ellipsoid(HULL_R * 0.62, HULL_R * 0.58, 1.9, C.toile, 0, 0, HULL_LEN * 0.72, toile));
    const queue = R3.cone(HULL_R * 0.66, 3.0, C.toile, 0, 0, -HULL_LEN * 0.86, toile);
    queue.rotation.x = -Math.PI / 2;   // pointe vers -z
    g.add(queue);

    // Trois anneaux de couleur : c'est ce qui le rend reconnaissable de loin.
    const ringCols = [C.vert, C.bleu, C.vert];
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 3.1;
      const rr = HULL_R * Math.sqrt(Math.max(0.12, 1 - (z / HULL_LEN) * (z / HULL_LEN))) + 0.05;
      const t = R3.torus(rr, 0.17, ringCols[i], 0, 0, z, { rough: 0.6, seg: 18 });
      g.add(t);
    }

    // --- LES GOUVERNES (arrière) --------------------------------------------
    const zf = -HULL_LEN * 0.66;
    const finOpt = { rough: 0.75, side: THREE.DoubleSide };
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const f = R3.wing(2.1, 1.35, C.rose, Math.cos(a) * 2.0, Math.sin(a) * 2.0, zf, finOpt);
      f.rotation.z = a;
      f.rotation.y = Math.PI / 2;     // l'aile pointe vers l'extérieur, à plat
      g.add(f);
    }
    // Deux volets mobiles : ils bougent doucement, le dirigeable a l'air vivant.
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const piv = R3.group();
      piv.position.set(s * 2.4, 0, zf - 1.5);
      const r = R3.box(1.5, 0.16, 0.9, C.jaune, 0, 0, -0.35, { rough: 0.7 });
      piv.add(r);
      g.add(piv);
      anim.rudders.push(piv);
    }

    // --- LES CÂBLES DE SUSPENSION -------------------------------------------
    for (let i = 0; i < 6; i++) {
      const s = (i % 2) ? 1 : -1;
      const z = (Math.floor(i / 2) - 1) * 1.7;
      const top = -HULL_R * 0.86, bot = GOND_Y + 0.8;
      const h = top - bot;
      const c = R3.cyl(0.055, 0.055, h, C.corde, s * 0.95, (top + bot) / 2, z,
        { rough: 0.9, seg: 5 });
      c.rotation.z = s * 0.13;
      R3.noShadow(c);
      g.add(c);
    }

    // --- LA NACELLE (bois, ouverte, on y monte) ------------------------------
    const nac = R3.group();
    nac.position.set(0, GOND_Y, 0.4);
    const boisOpt = { rough: 0.88 };
    nac.add(R3.ellipsoid(1.28, 0.72, 3.05, C.bois, 0, 0, 0, boisOpt));           // coque
    nac.add(R3.box(2.2, 0.16, 5.2, C.boisClair, 0, 0.62, 0, boisOpt));           // pont
    nac.add(R3.ellipsoid(0.55, 0.32, 3.3, C.bois, 0, -0.66, 0, boisOpt));        // quille
    nac.add(R3.box(2.5, 0.14, 0.5, C.jaune, 0, 0.16, 0, { rough: 0.6 }));        // liston
    nac.add(R3.box(2.5, 0.10, 0.4, C.vert, 0, -0.12, 0, { rough: 0.6 }));

    // Garde-corps : quatre montants et deux lisses. C'est ce qui dit « on peut
    // s'y accouder sans tomber » — rassurant.
    for (let i = 0; i < 4; i++) {
      const s = (i % 2) ? 1 : -1;
      const z = (i < 2) ? 1.9 : -1.9;
      nac.add(R3.cyl(0.06, 0.06, 0.8, C.boisClair, s * 1.02, 1.05, z, { rough: 0.85, seg: 6 }));
    }
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      nac.add(R3.box(0.09, 0.09, 4.4, C.boisClair, s * 1.02, 1.42, 0, { rough: 0.85 }));
    }

    // Auvent de toile au-dessus du poste de pilotage.
    nac.add(R3.box(2.0, 0.12, 1.9, C.rose, 0, 2.05, -1.2, { rough: 0.85 }));
    nac.add(R3.cyl(0.07, 0.07, 1.5, C.boisClair, -0.9, 1.35, -1.9, { rough: 0.85, seg: 6 }));
    nac.add(R3.cyl(0.07, 0.07, 1.5, C.boisClair, 0.9, 1.35, -1.9, { rough: 0.85, seg: 6 }));

    // Barre à roue : le petit détail qui raconte le voyage.
    nac.add(R3.torus(0.42, 0.07, C.boisClair, 0, 1.15, 2.05, { rough: 0.8, seg: 12 }));
    nac.add(R3.cyl(0.09, 0.09, 0.6, C.bois, 0, 0.85, 2.05, { rough: 0.85, seg: 6 }));

    // Hublots lumineux : quatre, deux par bord.
    for (let i = 0; i < 4; i++) {
      const s = (i % 2) ? 1 : -1;
      const z = (i < 2) ? 1.15 : -1.15;
      const cadre = R3.torus(0.30, 0.08, C.jaune, s * 1.22, -0.12, z, { rough: 0.5, seg: 10 });
      cadre.rotation.y = Math.PI / 2;
      nac.add(cadre);
      const vitre = R3.sphere(0.26, C.hublot, s * 1.24, -0.12, z,
        { emissive: C.hublot, emissiveIntensity: 0.75, rough: 0.4, seg: 10 });
      vitre.scale.set(0.35, 1, 1);
      R3.noShadow(vitre);
      nac.add(vitre);
      anim.glow.push(vitre);
    }
    g.add(nac);
    anim.gondola = nac;

    // Deux lanternes suspendues, avant et arrière.
    for (let i = 0; i < 2; i++) {
      const z = i ? 2.9 : -2.9;
      const lam = R3.sphere(0.22, C.jaune, 0, GOND_Y + 1.05, z + 0.4,
        { emissive: C.jaune, emissiveIntensity: 0.9, rough: 0.4, seg: 8 });
      R3.noShadow(lam);
      g.add(lam);
      anim.lanterns.push(lam);
      g.add(R3.cyl(0.04, 0.04, 0.5, C.metal, 0, GOND_Y + 1.45, z + 0.4, { rough: 0.5, seg: 5 }));
    }

    // --- LES DEUX HÉLICES (elles tournent vraiment) --------------------------
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const px = s * 3.05, py = GOND_Y + 1.5, pz = -1.4;
      const pod = R3.cyl(0.34, 0.44, 1.5, C.bleu, px, py, pz, { rough: 0.55, seg: 10 });
      pod.rotation.x = Math.PI / 2;
      g.add(pod);
      const hub = R3.group();
      hub.position.set(px, py, pz + 0.95);
      hub.add(R3.sphere(0.24, C.jaune, 0, 0, 0, { rough: 0.5, seg: 8 }));
      for (let b = 0; b < 3; b++) {
        const pale = R3.wing(1.35, 0.30, C.boisClair, 0, 0, 0.06,
          { rough: 0.7, side: THREE.DoubleSide });
        pale.rotation.z = b * (Math.PI * 2 / 3);
        pale.position.set(Math.cos(pale.rotation.z) * 1.25, Math.sin(pale.rotation.z) * 1.25, 0.06);
        R3.noShadow(pale);
        hub.add(pale);
      }
      g.add(hub);
      anim.props.push(hub);
    }

    // --- LA BANNIÈRE QUI CLAQUE ---------------------------------------------
    const bmat = R3.group();
    bmat.position.set(0, HULL_R * 0.98, -HULL_LEN * 0.35);
    bmat.add(R3.cyl(0.06, 0.06, 1.1, C.boisClair, 0, 0.55, 0, { rough: 0.85, seg: 6 }));
    const cols = [C.jaune, C.rose, C.bleu];
    for (let i = 0; i < 3; i++) {
      const p = R3.group();
      p.position.set(0, 1.02, -i * 0.72);
      const t = R3.box(0.04, 0.62, 0.74, cols[i], 0, -0.31, -0.37,
        { rough: 0.8, side: THREE.DoubleSide });
      R3.noShadow(t);
      p.add(t);
      bmat.add(p);
      anim.banner.push(p);
    }
    g.add(bmat);

    // Fanion de nez.
    const fan = R3.wing(0.55, 0.35, C.vert, 0, HULL_R * 0.35, HULL_LEN * 0.95,
      { rough: 0.8, side: THREE.DoubleSide });
    R3.noShadow(fan);
    g.add(fan);
    anim.pennant = fan;

    // Point d'accroche du joueur dans la nacelle (à l'avant, face à la barre).
    const seat = new THREE.Object3D();
    seat.position.set(0, GOND_Y + 0.72, 1.05);
    g.add(seat);
    anim.seat = seat;

    g.userData.airship = true;
    S.anim = anim;
    return g;
  }

  /**
   * Banc de nuages de croisière : de gros flocons de toile blanche que l'on
   * traverse. On les fabrique nous-mêmes plutôt que d'emprunter ceux de
   * `sky3d.js` (qui ne les expose pas) — et surtout, ça marche même si
   * `sky3d.js` est absent.
   */
  function buildClouds() {
    const g = R3.group();
    const m = { transparent: true, opacity: 0.72, rough: 1, depthWrite: false, flat: true };
    const n = (R3.quality && R3.quality.particles === false) ? 10 : 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const r = 14 + (i % 5) * 7;
      const p = R3.ellipsoid(
        4 + (i % 4) * 1.8, 1.5 + (i % 3) * 0.5, 3.4 + (i % 5) * 1.4,
        i % 3 ? '#ffffff' : '#e8f4f8',
        Math.cos(a) * r, ((i % 7) - 3) * 2.6, Math.sin(a) * r, m
      );
      R3.noShadow(p);
      g.add(p);
    }
    g.visible = false;
    return g;
  }

  // ===========================================================================
  //  LE VOILE ET LE CARTOUCHE DE DESTINATION  (HTML, créés à la demande)
  // ===========================================================================

  let _veil = null, _label = null, _labelTitle = null, _labelSub = null;

  function ensureOverlay() {
    if (_veil || typeof document === 'undefined' || !document.body) return;
    try {
      _veil = document.createElement('div');
      _veil.id = 'airship-veil';
      _veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;'
        + 'opacity:0;transition:none;background:radial-gradient(circle at 50% 45%,'
        + '#ffffff 0%,#e8f4f8 55%,#bfe3f2 100%);';
      document.body.appendChild(_veil);

      _label = document.createElement('div');
      _label.id = 'airship-label';
      _label.style.cssText = 'position:fixed;left:50%;top:16%;transform:translateX(-50%);'
        + 'pointer-events:none;z-index:61;opacity:0;text-align:center;'
        + "font-family:'Segoe UI',system-ui,sans-serif;color:#1a1c2c;"
        + 'background:rgba(255,255,255,.86);border-radius:18px;padding:14px 30px;'
        + 'box-shadow:0 10px 28px rgba(26,28,44,.25);';
      _labelSub = document.createElement('div');
      _labelSub.style.cssText = 'font-size:15px;letter-spacing:.22em;text-transform:uppercase;'
        + 'color:#41a6f6;font-weight:700;';
      _labelTitle = document.createElement('div');
      _labelTitle.style.cssText = 'font-size:34px;font-weight:800;margin-top:2px;';
      _label.appendChild(_labelSub);
      _label.appendChild(_labelTitle);
      document.body.appendChild(_label);
    } catch (e) {
      _veil = null;
      if (typeof console !== 'undefined') console.warn('[airship3d] voile HTML indisponible.', e);
    }
  }

  function setVeil(k) {
    S.veilK = k;
    if (_veil) _veil.style.opacity = String(clamp(k, 0, 1));
  }

  function setLabel(k, to) {
    if (!_label) return;
    _label.style.opacity = String(clamp(k, 0, 1));
    if (k > 0 && _labelTitle.textContent !== (REGION_NAMES[to] || to)) {
      _labelSub.textContent = 'Cap sur';
      _labelTitle.textContent = (REGION_NAMES[to] || to || '') +
        (PORT_NAMES[to] ? ' · ' + PORT_NAMES[to] : '');
    }
  }

  function hideOverlay() { setVeil(0); if (_label) _label.style.opacity = '0'; }

  // ===========================================================================
  //  PORTS, POSITIONS, DÉBLOCAGE
  // ===========================================================================

  function registerPort(regionId, x, y, name) {
    if (!regionId) return null;
    const p = PORTS[regionId] || (PORTS[regionId] = { regionId: regionId });
    p.x = (typeof x === 'number') ? x : p.x;
    p.y = (typeof y === 'number') ? y : p.y;
    p.name = name || p.name || PORT_NAMES[regionId] || 'Port aérien';
    return p;
  }

  function portOf(regionId) { return PORTS[regionId] || null; }

  /** Hauteur du terrain sous une tuile (repli à 0 si `world3d` est absent). */
  function groundAt(x, z) {
    const w = R3.get('world');
    if (w && typeof w.heightAt === 'function') {
      try {
        const h = w.heightAt(x, z);
        if (typeof h === 'number' && isFinite(h)) return h;
      } catch (e) { /* région pas encore chargée : on reste à 0 */ }
    }
    return 0;
  }

  /**
   * Peut-on voler de `from` vers `to` ?
   * LA RÈGLE N'EST ÉCRITE QU'ICI : on ne vole que vers une région déjà
   * visitée à pied. `val` est visitée d'office (c'est le départ de la partie).
   */
  function canFly(fromRegion, toRegion, visitedRegions) {
    if (!toRegion || !PORTS[toRegion]) return false;
    if (toRegion === fromRegion) return false;
    if (toRegion === 'val') return true;
    const v = visitedRegions || {};
    return v[toRegion] === true || v[toRegion] === 1;
  }

  /** Liste prête pour `hud3d.openAirshipMenu(ports, current, onChoose)`. */
  function travelOptions(current, visitedRegions) {
    return ORDER.map(function (id) {
      const ok = canFly(current, id, visitedRegions);
      return {
        regionId: id,
        region: REGION_NAMES[id],
        name: PORT_NAMES[id],
        current: id === current,
        enabled: ok,
        // Ce que le menu affiche en gris pour une région pas encore atteinte.
        reason: (id === current) ? 'Vous y êtes'
          : (ok ? null : 'À découvrir à pied'),
        x: PORTS[id] ? PORTS[id].x : null,
        y: PORTS[id] ? PORTS[id].y : null,
      };
    });
  }

  // ===========================================================================
  //  AMARRAGE
  // ===========================================================================

  /**
   * Amarre le dirigeable au mât du port : le nez accroché au sommet du mât, le
   * corps qui pend en aval du vent et qui oscille très lentement. C'est son
   * état 95 % du temps — il doit être beau vu de la ville.
   */
  function dockAt(regionId, x, y) {
    const p = registerPort(regionId, x, y);
    if (!S.ship) return null;
    const tx = (typeof x === 'number') ? x : (p && p.x);
    const ty = (typeof y === 'number') ? y : (p && p.y);
    if (typeof tx !== 'number' || typeof ty !== 'number') {
      // Port pas encore connu : on garde le dirigeable hors de vue plutôt que
      // de le planter au milieu de la carte.
      S.ship.visible = false;
      return null;
    }
    S.docked.region = regionId;
    S.docked.x = tx; S.docked.y = ty;
    S.docked.wx = tx;
    S.docked.wz = ty;
    S.docked.wy = groundAt(tx, ty) + MAST_TOP;
    // Cap d'amarrage stable par port : chaque ville a « son » vent.
    S.docked.yaw = R3.hash ? (R3.hash(tx, ty) % 1) * Math.PI * 2 : 0;
    S.ship.visible = true;
    if (!S.flying) placeDocked(R3.clock ? R3.clock.t : 0);
    return S.docked;
  }

  /** Pose le dirigeable amarré, avec son balancement au vent. */
  function placeDocked(t) {
    if (!S.ship || S.docked.region === null) return;
    const yaw = S.docked.yaw + Math.sin(t * 0.16) * 0.16;
    S.ship.rotation.set(Math.sin(t * 0.21) * 0.02, yaw, Math.sin(t * 0.27) * 0.035);
    // Le nez reste accroché au mât : le corps pend en arrière.
    const d = HULL_LEN + 0.9;
    S.ship.position.set(
      S.docked.wx - Math.sin(yaw) * d,
      S.docked.wy - 1.2 + Math.sin(t * 0.5) * 0.22,
      S.docked.wz - Math.cos(yaw) * d
    );
  }

  /** Position du sommet du mât d'un port (utile au débogage / à l'intégration). */
  function mast(regionId) {
    const p = PORTS[regionId];
    if (!p || typeof p.x !== 'number') return null;
    return { x: p.x, y: groundAt(p.x, p.y) + MAST_TOP, z: p.y };
  }

  /** Le point où se tient le joueur dans la nacelle (repère monde). */
  function seat() {
    if (!S.anim || !S.anim.seat) return null;
    return S.anim.seat.getWorldPosition(new THREE.Vector3());
  }

  // ===========================================================================
  //  CAMÉRA
  // ===========================================================================

  function setCamera(cam) { if (cam) S.cam = cam; }

  /** Prend la main sur la caméra et endort `camera3d.js`. */
  function takeCamera(cam) {
    if (cam) S.cam = cam;
    const c3 = R3.get('camera');
    if (c3 && typeof c3.suspend === 'function') {
      try { c3.suspend(); } catch (e) { /* on continue quand même */ }
    }
    S.camTaken = true;
    return S.cam;
  }

  /** Rend la caméra : `camera3d.js` reprend le suivi du joueur en douceur. */
  function releaseCamera() {
    if (!S.camTaken) return;
    S.camTaken = false;
    const c3 = R3.get('camera');
    if (c3 && typeof c3.resume === 'function') {
      try { c3.resume(false); } catch (e) { /* idem */ }
    }
  }

  // ===========================================================================
  //  LE JOUEUR DANS LA NACELLE
  // ===========================================================================

  function setPlayer(group) { S.player = group || null; }

  function boardPlayer() {
    const g = S.player, seatObj = S.anim && S.anim.seat;
    if (!g || !seatObj || S.playerHome) return;
    try {
      S.playerHome = {
        parent: g.parent,
        pos: g.position.clone(),
        rot: g.rotation.clone(),
        scale: g.scale.clone(),
        visible: g.visible,
      };
      seatObj.add(g);
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.visible = true;
    } catch (e) {
      S.playerHome = null;
    }
  }

  function unboardPlayer() {
    const g = S.player, h = S.playerHome;
    S.playerHome = null;
    if (!g || !h) return;
    try {
      if (h.parent) h.parent.add(g); else if (g.parent) g.parent.remove(g);
      g.position.copy(h.pos);
      g.rotation.copy(h.rot);
      g.scale.copy(h.scale);
      g.visible = h.visible;
    } catch (e) { /* game3d.js le repositionnera de toute façon */ }
  }

  // ===========================================================================
  //  LA SÉQUENCE DE VOL
  // ===========================================================================

  function onMidFlight(fn) {
    if (typeof fn === 'function' && S.midHooks.indexOf(fn) < 0) S.midHooks.push(fn);
    return fn;
  }

  function phase() { return S.phase; }
  function isFlying() { return S.flying; }
  function progress() { return S.flying ? R3.clamp01(S.t / T_END) : 0; }

  /**
   * Déclenche le chargement de la région, une seule fois par vol.
   * Appelé au milieu de la traversée — ou tout de suite si Robin saute la
   * cinématique, ou par le garde-fou. TOUJOURS avant `onArrive`.
   */
  function fireMid() {
    if (S.midDone) return;
    S.midDone = true;
    const from = S.from, to = S.to;
    if (typeof S.onMidOnce === 'function') {
      try { S.onMidOnce(from, to); } catch (e) { console.warn('[airship3d] onMidFlight', e); }
    }
    for (let i = 0; i < S.midHooks.length; i++) {
      try { S.midHooks[i](from, to); } catch (e) { console.warn('[airship3d] onMidFlight', e); }
    }
    // La région a changé sous nos ailes : on se réancre au-dessus du port
    // d'arrivée. On est dans les nuages, personne ne voit le saut.
    reanchorToDestination();
  }

  function reanchorToDestination() {
    const p = PORTS[S.to];
    if (p && typeof p.x === 'number') {
      S.target.set(p.x, groundAt(p.x, p.y) + MAST_TOP, p.y);
    } else {
      // Port d'arrivée inconnu : on descend là où l'on est, plutôt que rien.
      S.target.set(S.ship ? S.ship.position.x : 0, MAST_TOP, S.ship ? S.ship.position.z : 0);
    }
    if (S.ship) {
      // On replace l'appareil sur la trajectoire d'arrivée, altitude conservée.
      S.ship.position.x = S.target.x - S.heading.x * 46;
      S.ship.position.z = S.target.z - S.heading.z * 46;
    }
  }

  function finish() {
    if (!S.flying) return;
    fireMid();                       // sécurité : jamais d'arrivée sans chargement
    S.flying = false;
    S.phase = 'idle';
    if (S.guard) { clearTimeout(S.guard); S.guard = 0; }
    if (S.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', S.keyHandler, true);
      S.keyHandler = null;
    }
    if (S.clouds) S.clouds.visible = false;
    unboardPlayer();
    hideOverlay();
    // On amarre au port d'arrivée : le dirigeable reste dans le décor.
    const p = PORTS[S.to];
    if (p && typeof p.x === 'number') dockAt(S.to, p.x, p.y);
    releaseCamera();
    if (!S.arriveDone) {
      S.arriveDone = true;
      const cb = S.onArrive;
      S.onArrive = null;
      if (typeof cb === 'function') {
        try { cb(S.from, S.to); } catch (e) { console.warn('[airship3d] onArrive', e); }
      }
    }
  }

  /** Espace : on saute la cinématique. Idempotent. */
  function skip() {
    if (!S.flying) return false;
    fireMid();
    // Petit fondu de sortie plutôt qu'une coupure sèche.
    S.t = T_DESCENT + (T_END - T_DESCENT) * 0.55;
    S.phase = 'dock';
    setVeil(0.55);
    setLabel(0, S.to);
    return true;
  }

  /**
   * Séquence complète (~6 s), sautable par Espace.
   * @param {string} fromRegion
   * @param {string} toRegion
   * @param {function|object} onArrive  fonction, ou { onArrive, onMid }
   */
  function fly(fromRegion, toRegion, onArrive) {
    // Un vol déjà en cours : on le termine proprement avant d'en lancer un autre.
    if (S.flying) finish();

    let cb = onArrive, mid = null;
    if (onArrive && typeof onArrive === 'object') {
      cb = onArrive.onArrive || onArrive.arrive || null;
      mid = onArrive.onMid || onArrive.onMidFlight || null;
    }

    S.from = fromRegion || S.docked.region || null;
    S.to = toRegion || null;
    S.onArrive = (typeof cb === 'function') ? cb : null;
    S.onMidOnce = (typeof mid === 'function') ? mid : null;
    S.midDone = false;
    S.arriveDone = false;
    S.t = 0;
    S.wallStart = now();
    S.flying = true;
    S.phase = 'board';

    ensureOverlay();
    setLabel(0, S.to);
    setVeil(0);

    // --- cap du voyage, d'après la carte du monde (§3) ------------------------
    const a = GRID[S.from], b = GRID[S.to];
    let hx = 0, hz = -1;
    if (a && b && (a.gx !== b.gx || a.gy !== b.gy)) {
      const dx = b.gx - a.gx, dy = b.gy - a.gy;
      const n = Math.sqrt(dx * dx + dy * dy) || 1;
      hx = dx / n; hz = dy / n;           // grille +y = monde +z
    }
    S.heading.x = hx; S.heading.z = hz;

    // --- point de départ ------------------------------------------------------
    const pf = PORTS[S.from];
    if (S.ship) {
      if (S.docked.region === S.from || (pf && typeof pf.x === 'number')) {
        if (S.docked.region !== S.from && pf && typeof pf.x === 'number') {
          dockAt(S.from, pf.x, pf.y);
        }
        placeDocked(R3.clock ? R3.clock.t : 0);
      }
      S.ship.visible = true;
      S.origin.copy(S.ship.position);
    } else {
      S.origin.set(0, MAST_TOP, 0);
    }
    S.target.copy(S.origin);

    if (S.clouds) S.clouds.visible = false;

    boardPlayer();
    if (S.cam) takeCamera(S.cam);

    // --- Espace saute la cinématique -----------------------------------------
    if (typeof window !== 'undefined' && !S.keyHandler) {
      S.keyHandler = function (e) {
        if (!S.flying) return;
        if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32
          || e.code === 'Escape' || e.key === 'Escape') {
          e.preventDefault();
          skip();
        }
      };
      window.addEventListener('keydown', S.keyHandler, true);
    }

    // --- garde-fou : le vol se termine, quoi qu'il arrive ---------------------
    // (même si `update()` n'est jamais appelé, même si le rendu s'arrête)
    if (typeof setTimeout === 'function') {
      S.guard = setTimeout(function () {
        if (S.flying) {
          console.warn('[airship3d] garde-fou : atterrissage forcé.');
          finish();
        }
      }, GUARD_MS);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  //  Trajectoire et caméra, image par image
  // ---------------------------------------------------------------------------

  function updateFlight(t, dt) {
    // Sécurité horloge murale : si le temps réel dérape (onglet en arrière-plan,
    // chargement très long), on termine.
    if (now() - S.wallStart > GUARD_MS) { finish(); return; }

    S.t += dt;
    const T = S.t;

    // --- phase ---------------------------------------------------------------
    S.phase = (T < T_BOARD) ? 'board'
      : (T < T_LIFT) ? 'lift'
        : (T < T_CRUISE) ? 'cruise'
          : (T < T_DESCENT) ? 'descent' : 'dock';

    if (!S.midDone && T >= T_MID) fireMid();

    const hx = S.heading.x, hz = S.heading.z;
    let sx, sy, sz, roll = 0;

    if (T < T_BOARD) {
      // 1. EMBARQUEMENT : le dirigeable reste amarré, il respire.
      placeDocked(t);
      sx = S.ship ? S.ship.position.x : 0;
      sy = S.ship ? S.ship.position.y : 0;
      sz = S.ship ? S.ship.position.z : 0;
    } else if (T < T_CRUISE) {
      // 2. DÉCOLLAGE puis 3. TRAVERSÉE : on monte au-dessus des nuages et on
      //    prend de la vitesse. La région s'éloigne sous les pieds.
      const k = seg(T, T_BOARD, T_CRUISE);
      const up = smooth01(seg(T, T_BOARD, T_LIFT + 0.4));
      const fwd = Math.pow(seg(T, T_BOARD + 0.25, T_CRUISE), 1.8) * 62;
      sx = S.origin.x + hx * fwd;
      sz = S.origin.z + hz * fwd;
      sy = S.origin.y + CRUISE_UP * up + Math.sin(t * 0.9) * 0.25;
      roll = Math.sin(t * 0.7) * 0.05 * k;
    } else if (T < T_DESCENT) {
      // 4a. DESCENTE : on vise le mât d'arrivée.
      const k = smooth01(seg(T, T_CRUISE, T_DESCENT));
      const startY = S.origin.y + CRUISE_UP;
      const d0 = 46;                                  // distance au mât en début de descente
      const d = R3.lerp(d0, HULL_LEN + 0.9, k);
      sx = S.target.x - hx * d;
      sz = S.target.z - hz * d;
      sy = R3.lerp(startY, S.target.y - 1.2, k) + Math.sin(t * 0.8) * 0.2 * (1 - k);
      roll = Math.sin(t * 0.7) * 0.04 * (1 - k);
    } else {
      // 4b. AMARRAGE : on se cale sur la pose amarrée du port d'arrivée.
      const k = smooth01(seg(T, T_DESCENT, T_END));
      const d = HULL_LEN + 0.9;
      sx = R3.lerp(S.target.x - hx * d, S.target.x - Math.sin(headingYaw()) * d, k);
      sz = R3.lerp(S.target.z - hz * d, S.target.z - Math.cos(headingYaw()) * d, k);
      sy = S.target.y - 1.2 + Math.sin(t * 0.5) * 0.22;
    }

    if (S.ship) {
      S.ship.position.set(sx, sy, sz);
      const yaw = (T < T_BOARD) ? S.ship.rotation.y : headingYaw();
      S.ship.rotation.set(S.ship.rotation.x * 0.9, yaw, roll);
    }

    // --- nuages : ils suivent l'appareil pendant la traversée -----------------
    if (S.clouds) {
      const inCloud = T > T_LIFT - 0.5 && T < T_CRUISE + 0.6;
      S.clouds.visible = inCloud;
      if (inCloud) {
        S.clouds.position.set(sx - hx * 4, sy - 2.2, sz - hz * 4);
        S.clouds.rotation.y = t * 0.03;
      }
    }

    // --- voile : plongée dans l'épaisseur des nuages au moment du chargement --
    // C'est ce voile qui masque les ~150 ms de `world.setRegion`.
    let veil = 0;
    if (T < 0.45) veil = 1 - seg(T, 0, 0.45);                      // fondu d'embarquement
    else if (T > T_LIFT && T < T_CRUISE) {
      const up = seg(T, T_LIFT, T_MID);
      const down = 1 - seg(T, T_MID + 0.28, T_CRUISE);
      veil = Math.min(up, Math.max(0, down)) * 0.92;
    } else if (T > T_END - 0.5) veil = seg(T, T_END - 0.5, T_END) * 0.35;
    setVeil(veil);

    // --- cartouche « Cap sur … » ---------------------------------------------
    let lab = 0;
    if (T > T_LIFT - 0.2 && T < T_DESCENT - 0.1) {
      lab = Math.min(seg(T, T_LIFT - 0.2, T_LIFT + 0.5),
        1 - seg(T, T_DESCENT - 0.7, T_DESCENT - 0.1));
    }
    setLabel(lab, S.to);

    updateFlightCamera(T, t, sx, sy, sz);

    if (T >= T_END) finish();
  }

  function headingYaw() { return Math.atan2(S.heading.x, S.heading.z); }

  /**
   * Chorégraphie de la caméra. Les décalages sont exprimés dans le repère du
   * voyage : `back` = derrière l'appareil, `side` = à sa droite, `up` = au-dessus.
   */
  function updateFlightCamera(T, t, sx, sy, sz) {
    const cam = S.cam;
    if (!cam) return;

    const hx = S.heading.x, hz = S.heading.z;
    const rx = -hz, rz = hx;                 // vecteur « droite »
    let back, side, up, aimY, aimF;

    if (T < T_BOARD) {
      // On regarde le joueur monter à bord : proche, un peu en dessous.
      const k = smooth01(seg(T, 0, T_BOARD));
      back = R3.lerp(9, 11, k); side = R3.lerp(-7, -6, k);
      up = R3.lerp(-2.2, 0.5, k); aimY = GOND_Y + 0.4; aimF = 0;
    } else if (T < T_LIFT) {
      // Décollage : la caméra recule et monte, la région s'éloigne.
      const k = smooth01(seg(T, T_BOARD, T_LIFT));
      back = R3.lerp(11, 24, k); side = R3.lerp(-6, -9, k);
      up = R3.lerp(0.5, 9, k); aimY = R3.lerp(GOND_Y + 0.4, -6, k); aimF = 0;
    } else if (T < T_CRUISE) {
      // Traversée : trois-quarts avant, l'appareil traverse les nuages.
      const k = smooth01(seg(T, T_LIFT, T_CRUISE));
      back = R3.lerp(24, 15, k); side = R3.lerp(-9, -13, k);
      up = R3.lerp(9, 3.5, k) + Math.sin(t * 0.5) * 0.6; aimY = R3.lerp(-6, 0, k); aimF = 4;
    } else if (T < T_DESCENT) {
      // Descente : caméra derrière et haute, on découvre le port d'arrivée.
      const k = smooth01(seg(T, T_CRUISE, T_DESCENT));
      back = R3.lerp(15, 18, k); side = R3.lerp(-13, -3, k);
      up = R3.lerp(3.5, 9, k); aimY = R3.lerp(0, -3.5, k); aimF = R3.lerp(4, 16, k);
    } else {
      // Amarrage : on converge vers un cadrage proche de la vue de jeu, pour
      // que `camera3d.js` reprenne la main sans saut.
      const k = smooth01(seg(T, T_DESCENT, T_END));
      back = R3.lerp(18, 13, k); side = R3.lerp(-3, 0, k);
      up = R3.lerp(9, 7.5, k); aimY = R3.lerp(-3.5, GOND_Y + 1, k); aimF = R3.lerp(16, 0, k);
    }

    _camPos.set(
      sx - hx * back + rx * side,
      sy + up,
      sz - hz * back + rz * side
    );
    _aim.set(sx + hx * aimF, sy + aimY, sz + hz * aimF);

    // Lissage doux : même en cas d'à-coup, le mouvement reste continu.
    const s = 0.80;
    const dt = Math.min(0.05, (R3.clock && R3.clock.dt) || 0.016);
    cam.position.set(
      R3.damp(cam.position.x, _camPos.x, s, dt),
      R3.damp(cam.position.y, _camPos.y, s, dt),
      R3.damp(cam.position.z, _camPos.z, s, dt)
    );
    cam.lookAt(_aim);
  }

  // ===========================================================================
  //  BOUCLE
  // ===========================================================================

  function build(scene, camera) {
    try {
      if (camera) S.cam = camera;
      if (!S.ship) {
        S.ship = buildAirship();
        S.ship.visible = false;      // invisible tant qu'aucun port n'est connu
      }
      if (!S.clouds) S.clouds = buildClouds();
      if (scene && S.ship.parent !== scene) {
        scene.add(S.ship);
        scene.add(S.clouds);
        S.scene = scene;
      }
    } catch (e) {
      console.warn('[airship3d] construction impossible : le voyage reste possible.', e);
    }
    return S.ship;
  }

  function model() {
    if (!S.ship) { try { S.ship = buildAirship(); } catch (e) { return null; } }
    return S.ship;
  }

  /** Animations permanentes : hélices, bannière, hublots, volets. */
  function animateParts(t, dt, fast) {
    const a = S.anim;
    if (!a) return;
    const spin = fast ? 13 : 1.4;
    for (let i = 0; i < a.props.length; i++) {
      a.props[i].rotation.z += spin * dt * (i ? 1 : -1);
    }
    for (let i = 0; i < a.banner.length; i++) {
      a.banner[i].rotation.y = Math.sin(t * (2.4 + i * 0.5) - i * 0.7) * (0.28 + i * 0.12);
      a.banner[i].rotation.x = Math.sin(t * 1.7 + i) * 0.06;
    }
    for (let i = 0; i < a.rudders.length; i++) {
      a.rudders[i].rotation.y = Math.sin(t * 0.6 + i * 1.3) * (fast ? 0.28 : 0.10);
    }
    if (a.pennant) a.pennant.rotation.y = Math.sin(t * 3.1) * 0.3;
    const pulse = 0.62 + Math.sin(t * 1.6) * 0.16;
    for (let i = 0; i < a.lanterns.length; i++) {
      a.lanterns[i].scale.setScalar(0.95 + Math.sin(t * 1.6 + i) * 0.06);
    }
    if (a.glow.length && a.glow[0].material) {
      a.glow[0].material.emissiveIntensity = pulse + 0.2;
    }
  }

  function update(t, dt) {
    if (!S.ship) return;
    // Rien ne dépend d'un dt non borné : un à-coup de chargement ne doit pas
    // téléporter le dirigeable ni sauter une phase du vol.
    const d = clamp((typeof dt === 'number' && isFinite(dt)) ? dt : 0.016, 0, 0.05);
    const tt = (typeof t === 'number' && isFinite(t)) ? t : (R3.clock ? R3.clock.t : 0);
    try {
      animateParts(tt, d, S.flying && S.phase !== 'board');
      if (S.flying) updateFlight(tt, d);
      else placeDocked(tt);
      // Le joueur reste calé sur son siège même si game3d.js écrit sa position.
      if (S.playerHome && S.player) S.player.position.set(0, 0, 0);
    } catch (e) {
      console.warn('[airship3d] update : vol interrompu proprement.', e);
      finish();
    }
  }

  // ===========================================================================

  R3.register('airship', {
    build: build,
    PORTS: PORTS,
    registerPort: registerPort,
    portOf: portOf,
    dockAt: dockAt,
    fly: fly,
    isFlying: isFlying,
    update: update,
    model: model,
    // --- extensions documentées en tête de fichier ---------------------------
    phase: phase,
    progress: progress,
    skip: skip,
    onMidFlight: onMidFlight,
    canFly: canFly,
    travelOptions: travelOptions,
    takeCamera: takeCamera,
    releaseCamera: releaseCamera,
    setCamera: setCamera,
    setPlayer: setPlayer,
    mast: mast,
    seat: seat,
    PORT_NAMES: PORT_NAMES,
    REGION_NAMES: REGION_NAMES,
    TIMING: {
      board: T_BOARD, lift: T_LIFT, mid: T_MID,
      cruise: T_CRUISE, descent: T_DESCENT, end: T_END,
    },
  });
})();
