// =============================================================================
//  camera3d.js — LES DEUX VUES  (CONTRACT2.md §18 bis)
// -----------------------------------------------------------------------------
//  Robin doit pouvoir CHOISIR sa vue et en changer à tout moment sans perdre
//  ses repères. Ce module possède la caméra du monde ouvert et propose :
//
//    • vue 'aventure' — celle d'aujourd'hui, RIGOUREUSEMENT inchangée.
//      C'est la vue par défaut. Le code de `updateCamera()` de game3d.js est
//      repris ici tel quel (hauteur 9, recul 11, regard 1,6 unité devant,
//      orientation fixe, lissage R3.damp à 0.86, zoom ×0,60 à ×1,70,
//      caméra qui ne descend jamais sous `sol + 2.2`).
//
//    • vue 'rpg' — plongée façon RPG classique : la carte se lit comme un
//      plateau de jeu. Caméra haute (~16), très inclinée (~62° sous
//      l'horizontale), `fov` resserré à 38 pour aplatir la perspective et
//      obtenir ce rendu presque isométrique. Le joueur est au centre de
//      l'écran, la vue est TOUJOURS alignée sur la grille et pivote par
//      quarts de tour (Shift + ←/→).
//
//  API — R3.register('camera', { init, MODES, mode, setMode, toggle, rotate,
//                                zoom, update, frame, serialize, deserialize })
//
// -----------------------------------------------------------------------------
//  COMMENT game3d.js UTILISE frame().yaw
// -----------------------------------------------------------------------------
//  En vue 'aventure', `yaw` vaut toujours 0 : les commandes restent absolues
//  (← va vers −x), exactement comme aujourd'hui. Rien à faire.
//
//  En vue 'rpg', `yaw` est l'angle (multiple exact de π/2) autour duquel la
//  caméra a tourné. Pour que « haut » aille toujours vers le haut de l'écran,
//  game3d.js doit faire pivoter le vecteur de commande :
//
//      const f = R3.get('camera').frame();
//      const a = f.rotating ? f.yawTarget : f.yaw;   // pendant la rotation on
//                                                    // vise déjà l'orientation
//                                                    // d'arrivée
//      const c = Math.cos(a), s = Math.sin(a);
//      const wx =  dx * c + dz * s;        // dx,dz = commande brute :
//      const wz = -dx * s + dz * c;        // haut (0,-1) bas (0,1)
//                                          // gauche (-1,0) droite (1,0)
//
//  `frame().rotating` est vrai pendant les ~0,4 s de la rotation ; `frame().yaw`
//  n'est un multiple exact de π/2 qu'une fois la transition terminée.
//
// -----------------------------------------------------------------------------
//  AJOUTS HORS CONTRAT (documentés, sans conséquence si inutilisés)
// -----------------------------------------------------------------------------
//    suspend() / resume(instant) / isSuspended()
//        `airship3d.js` prend la main sur la caméra pendant la cinématique de
//        vol : il appelle `suspend()` au décollage et `resume()` à l'arrivée.
//        Tant que le module est suspendu, `update()` ne touche plus à la
//        caméra (mais continue d'entretenir zoom, rotation et transitions).
//        `resume(true)` recolle la caméra sur sa position idéale sans lissage.
//    player.sway (optionnel)
//        léger balancement décoratif ajouté en x, utilisé par game3d.js sur
//        l'écran titre. Absent = 0, donc aucun changement.
//    frame() renvoie en plus : rotating, yawTarget, quarter, mode, fov, zoom,
//        pitch — pratique pour sky3d, le culling et le débogage.
// =============================================================================

(function () {
  'use strict';

  // Dégradation gracieuse : sans le socle, le module ne s'installe pas et
  // game3d.js retombe sur son ancien calcul de caméra (prévu au §18 bis).
  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') {
    if (typeof console !== 'undefined') {
      console.warn('[camera3d] THREE ou R3 absent : module inactif.');
    }
    return;
  }

  // ---------------------------------------------------------------------------
  //  RÉGLAGES
  // ---------------------------------------------------------------------------

  const MODES = ['aventure', 'rpg'];

  // --- Vue AVENTURE : valeurs recopiées de game3d.js, à ne pas retoucher -----
  const A_BACK = 11;          // recul derrière le joueur (sur +z)
  const A_HEIGHT = 9;         // hauteur au-dessus du joueur
  const A_LOOK_AHEAD = 1.6;   // on vise un peu DEVANT le joueur
  const A_AIM_Y = 0.85;       // hauteur visée : le buste, pas les pieds
  const A_ZOOM_MIN = 0.60;
  const A_ZOOM_MAX = 1.70;

  // --- Vue RPG ---------------------------------------------------------------
  // On définit la vue par sa HAUTEUR et son ANGLE : c'est l'angle qui fait le
  // rendu « plateau de jeu ». 16 de haut sous 60° donnent 9,24 de recul —
  // exactement le cadrage annoncé au §18 bis (hauteur ≈ 16, recul ≈ 10,
  // 60–65° sous l'horizontale).
  const R_PITCH = 60 * Math.PI / 180;
  const R_HEIGHT = 16;
  const R_DIST = R_HEIGHT / Math.sin(R_PITCH);      // ≈ 18.48 (distance totale)
  const R_BACK = R_DIST * Math.cos(R_PITCH);        // ≈ 9.24
  const R_AIM_Y = 0.80;       // le joueur reste au CENTRE de l'écran
  const R_ZOOM_MIN = 0.70;
  const R_ZOOM_MAX = 2.00;
  const R_FOV = 38;           // resserré : perspective aplatie, presque isométrique

  const SMOOTH = 0.86;        // ≈ 14 % de rattrapage par image à 60 Hz
  const GROUND_MARGIN = 2.2;  // la caméra ne descend jamais sous sol + 2.2
  const MODE_DUR = 0.60;      // durée de la bascule entre les deux vues
  const ROT_DUR = 0.40;       // durée d'un quart de tour en vue RPG
  const QUARTER = Math.PI / 2;

  // ---------------------------------------------------------------------------
  //  ÉTAT
  // ---------------------------------------------------------------------------

  const S = {
    cam: null,
    baseFov: 50,          // fov d'origine de la caméra de game3d.js

    modeIndex: 0,         // index du mode CIBLE dans MODES
    fromIndex: 0,         // mode d'où l'on vient (pendant la bascule)
    mix: 1,               // 0 = ancien mode, 1 = mode cible

    zooms: [1, 1],        // un zoom mémorisé par mode

    quarter: 0,           // quart de tour courant en vue RPG (entier)
    yaw: 0,               // orientation lissée réellement appliquée
    yawFrom: 0,
    yawTo: 0,
    rotT: 1,              // 1 = rotation terminée

    groundH: null,        // dernière fonction (x,z)=>hauteur connue
    suspended: false,
    started: false,       // false tant qu'on n'a pas posé la caméra une 1re fois
  };

  // Vecteurs de travail : jamais d'allocation dans la boucle de rendu.
  const _posA = new THREE.Vector3();
  const _aimA = new THREE.Vector3();
  const _posB = new THREE.Vector3();
  const _aimB = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _aim = new THREE.Vector3();

  // ---------------------------------------------------------------------------
  //  OUTILS
  // ---------------------------------------------------------------------------

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function zoomRange(index) {
    return index === 1 ? [R_ZOOM_MIN, R_ZOOM_MAX] : [A_ZOOM_MIN, A_ZOOM_MAX];
  }

  /** Hauteur du sol sous (x, z) ; repli à 0 si personne ne nous la fournit. */
  function ground(x, z) {
    const f = S.groundH;
    if (typeof f !== 'function') return 0;
    let h = 0;
    try { h = f(x, z); } catch (e) { h = 0; }
    return (typeof h === 'number' && isFinite(h)) ? h : 0;
  }

  /**
   * Repère idéal de la vue AVENTURE.
   * C'est la copie conforme de `updateCamera()` de game3d.js : orientation
   * fixe, la caméra est toujours plein sud du joueur, et on vise 1,6 unité
   * devant lui pour qu'il ne soit jamais collé au bas de l'écran.
   */
  function rigAventure(p, sway, outPos, outAim) {
    const z = clamp(S.zooms[0], A_ZOOM_MIN, A_ZOOM_MAX);
    outPos.set(p.worldX + sway, p.worldY + A_HEIGHT * z, p.worldZ + A_BACK * z);
    outAim.set(p.worldX + sway * 0.5, p.worldY + A_AIM_Y, p.worldZ - A_LOOK_AHEAD);
  }

  /**
   * Repère idéal de la vue RPG : plongée alignée sur la grille.
   * `yaw` = 0 place la caméra exactement là où la vue aventure la met (sur +z),
   * pour que la bascule ne fasse jamais tourner le monde sous les pieds de
   * Robin. Chaque quart de tour ajoute π/2.
   */
  function rigRpg(p, sway, outPos, outAim) {
    const z = clamp(S.zooms[1], R_ZOOM_MIN, R_ZOOM_MAX);
    const s = Math.sin(S.yaw), c = Math.cos(S.yaw);
    outPos.set(
      p.worldX + sway + R_BACK * z * s,
      p.worldY + R_HEIGHT * z,
      p.worldZ + R_BACK * z * c
    );
    // Le joueur est visé pile au centre : pas de « regard devant » ici, sinon
    // il glisserait vers un bord de l'écran à chaque rotation.
    outAim.set(p.worldX + sway * 0.5, p.worldY + R_AIM_Y, p.worldZ);
  }

  // ---------------------------------------------------------------------------
  //  API
  // ---------------------------------------------------------------------------

  /** Reçoit la THREE.PerspectiveCamera de game3d.js. */
  function init(camera) {
    if (!camera) return;
    S.cam = camera;
    if (typeof camera.fov === 'number' && camera.fov > 1) S.baseFov = camera.fov;
    S.started = false;
    applyFov(currentFov());
  }

  function mode() { return MODES[S.modeIndex]; }

  /** Bascule de vue. `instant` = pas de transition (chargement d'une partie). */
  function setMode(id, instant) {
    let idx = MODES.indexOf(id);
    if (idx < 0) idx = 0;
    if (idx === S.modeIndex && S.mix >= 1) return mode();
    // On part de l'état RÉELLEMENT affiché : si l'on rebascule en plein
    // fondu, la caméra ne fait pas de saut en arrière.
    S.fromIndex = (S.mix >= 1) ? S.modeIndex : S.fromIndex;
    S.modeIndex = idx;
    S.mix = instant ? 1 : (S.fromIndex === idx ? 1 : 0);
    if (instant) S.fromIndex = idx;
    return mode();
  }

  /** Passe à la vue suivante (touche V, bouton de l'interface). */
  function toggle() {
    return setMode(MODES[(S.modeIndex + 1) % MODES.length], false);
  }

  /**
   * Vue RPG uniquement : pivote d'un quart de tour, avec transition douce.
   * Renvoie true si la rotation a été acceptée.
   */
  function rotate(quarterTurns) {
    if (S.modeIndex !== 1) return false;          // orientation fixe en aventure
    const n = Math.round(quarterTurns || 0);
    if (!n) return false;
    // Une rotation déjà en cours ? On repart de l'angle courant : deux appuis
    // rapides s'enchaînent au lieu de se téléscoper.
    S.yawFrom = S.yaw;
    S.quarter += n;
    S.yawTo = S.quarter * QUARTER;
    S.rotT = 0;
    return true;
  }

  /**
   * Molette. `delta` est exprimé en unités de zoom (±0.09 comme game3d.js) ;
   * si l'on nous passe un `event.deltaY` brut (±100), on le ramène au pas
   * habituel — game3d.js peut appeler comme il veut.
   */
  function zoom(delta) {
    let d = Number(delta) || 0;
    if (Math.abs(d) > 3) d = (d > 0 ? 1 : -1) * 0.09;
    const i = S.modeIndex;
    const r = zoomRange(i);
    S.zooms[i] = clamp(S.zooms[i] + d, r[0], r[1]);
    return S.zooms[i];
  }

  function currentFov() {
    const k = R3.easeInOut(R3.clamp01(S.mix));
    const a = S.fromIndex === 1 ? R_FOV : S.baseFov;
    const b = S.modeIndex === 1 ? R_FOV : S.baseFov;
    return R3.lerp(a, b, k);
  }

  function applyFov(f) {
    if (!S.cam || typeof S.cam.fov !== 'number') return;
    if (Math.abs(S.cam.fov - f) < 0.01) return;
    S.cam.fov = f;
    S.cam.updateProjectionMatrix();
  }

  /**
   * À appeler une fois par image.
   * @param {number} dt      secondes (un dt > 1 signifie « recentre tout de suite »)
   * @param {object} player  { worldX, worldY, worldZ, dir, moving, sway? }
   * @param {function} groundH  (x, z) => hauteur du terrain (facultatif)
   */
  function update(dt, player, groundH) {
    if (typeof groundH === 'function') S.groundH = groundH;
    if (!S.cam || !player) return;

    const snap = !(dt > 0) || dt > 1;               // dt géant = repositionnement sec
    const d = snap ? 0.016 : dt;

    // --- avancement des transitions ------------------------------------------
    if (S.mix < 1) S.mix = snap ? 1 : Math.min(1, S.mix + d / MODE_DUR);
    if (S.rotT < 1) {
      S.rotT = snap ? 1 : Math.min(1, S.rotT + d / ROT_DUR);
      S.yaw = R3.lerp(S.yawFrom, S.yawTo, R3.easeInOut(S.rotT));
      if (S.rotT >= 1) {
        // On replie le compteur dans 0..3 : invisible (sin/cos sont
        // périodiques) mais évite de dériver après cent rotations.
        S.quarter = ((S.quarter % 4) + 4) % 4;
        S.yaw = S.quarter * QUARTER;
      }
    }

    // Suspendu (cinématique du dirigeable) : on entretient l'état, on ne
    // touche pas à la caméra — airship3d.js la pilote.
    if (S.suspended) return;

    const sway = Number(player.sway) || 0;
    const k = R3.easeInOut(R3.clamp01(S.mix));

    // --- repère idéal, éventuellement mélangé pendant la bascule -------------
    if (S.mix >= 1) {
      if (S.modeIndex === 1) rigRpg(player, sway, _pos, _aim);
      else rigAventure(player, sway, _pos, _aim);
    } else {
      if (S.fromIndex === 1) rigRpg(player, sway, _posA, _aimA);
      else rigAventure(player, sway, _posA, _aimA);
      if (S.modeIndex === 1) rigRpg(player, sway, _posB, _aimB);
      else rigAventure(player, sway, _posB, _aimB);
      _pos.lerpVectors(_posA, _posB, k);
      _aim.lerpVectors(_aimA, _aimB, k);
    }

    // --- anti-traversée du relief (les DEUX modes) ---------------------------
    const hCam = ground(_pos.x, _pos.z);
    if (_pos.y < hCam + GROUND_MARGIN) _pos.y = hCam + GROUND_MARGIN;

    // --- suivi lissé ---------------------------------------------------------
    const smooth = (snap || !S.started) ? 0 : SMOOTH;
    S.cam.position.set(
      R3.damp(S.cam.position.x, _pos.x, smooth, d),
      R3.damp(S.cam.position.y, _pos.y, smooth, d),
      R3.damp(S.cam.position.z, _pos.z, smooth, d)
    );

    // Seconde passe, APRÈS le lissage : game3d.js ne bornait que la position
    // VISÉE, si bien qu'au pied d'une falaise la caméra, en retard sur sa
    // cible, traversait quand même le relief pendant une demi-seconde. On
    // reborne donc la position réellement appliquée — invisible en terrain
    // normal (la borne ne mord que si la caméra est déjà sous le sol).
    const hReal = ground(S.cam.position.x, S.cam.position.z);
    if (S.cam.position.y < hReal + GROUND_MARGIN) S.cam.position.y = hReal + GROUND_MARGIN;

    S.cam.lookAt(_aim);
    applyFov(currentFov());
    S.started = true;
  }

  /**
   * Repère courant, pour sky3d, le culling et les commandes du joueur.
   * `yaw` est un multiple EXACT de π/2 dès que `rotating` est faux.
   */
  function frame() {
    const rpg = S.modeIndex === 1;
    const z = clamp(S.zooms[S.modeIndex], zoomRange(S.modeIndex)[0], zoomRange(S.modeIndex)[1]);
    return {
      yaw: rpg ? S.yaw : 0,
      dist: (rpg ? R_BACK : A_BACK) * z,
      height: (rpg ? R_HEIGHT : A_HEIGHT) * z,
      // extras
      rotating: S.rotT < 1,
      yawTarget: rpg ? (((S.quarter % 4) + 4) % 4) * QUARTER : 0,
      quarter: rpg ? (((S.quarter % 4) + 4) % 4) : 0,
      mode: MODES[S.modeIndex],
      fov: currentFov(),
      zoom: z,
      pitch: rpg ? R_PITCH : Math.atan2(A_HEIGHT, A_BACK),
      switching: S.mix < 1,
    };
  }

  // --- prise de contrôle par airship3d.js ------------------------------------

  function suspend() { S.suspended = true; }
  function resume(instant) {
    S.suspended = false;
    if (instant) S.started = false;   // prochaine image : repositionnement sec
  }
  function isSuspended() { return S.suspended; }

  // --- sauvegarde ------------------------------------------------------------

  function serialize() {
    return {
      mode: MODES[S.modeIndex],
      zoomAventure: S.zooms[0],
      zoomRpg: S.zooms[1],
      quarter: ((S.quarter % 4) + 4) % 4,
    };
  }

  function deserialize(o) {
    if (!o) return;
    // Tolérant : on accepte aussi bien l'objet complet que le simple champ
    // `cameraMode` de la sauvegarde (§20).
    const src = (typeof o === 'string') ? { mode: o } : o;
    if (src.mode) setMode(src.mode, true);
    const za = Number(src.zoomAventure);
    if (isFinite(za) && za > 0) S.zooms[0] = clamp(za, A_ZOOM_MIN, A_ZOOM_MAX);
    const zr = Number(src.zoomRpg);
    if (isFinite(zr) && zr > 0) S.zooms[1] = clamp(zr, R_ZOOM_MIN, R_ZOOM_MAX);
    const q = Number(src.quarter);
    if (isFinite(q)) {
      S.quarter = ((Math.round(q) % 4) + 4) % 4;
      S.yaw = S.yawFrom = S.yawTo = S.quarter * QUARTER;
      S.rotT = 1;
    }
    S.started = false;      // on recolle la caméra sans lissage
    applyFov(currentFov());
  }

  // ---------------------------------------------------------------------------

  R3.register('camera', {
    init: init,
    MODES: MODES,
    mode: mode,
    setMode: setMode,
    toggle: toggle,
    rotate: rotate,
    zoom: zoom,
    update: update,
    frame: frame,
    serialize: serialize,
    deserialize: deserialize,
    // Extensions (voir le bandeau) — utilisées par airship3d.js.
    suspend: suspend,
    resume: resume,
    isSuspended: isSuspended,
  });
})();
