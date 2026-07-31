// =============================================================================
//  buddy3d.js — LE COMPAGNON HORS DE SA BALL                      (CONTRACT3 §4)
// =============================================================================
//  Demande n°2 de Robin, telle quelle : « j'aimerai pouvoir sortir les Pokémon
//  de ma Pokéball et qu'ils restent à côté de moi ».
//
//  CE QUE FAIT CE MODULE
//  ---------------------
//    · `release(mon)` joue une petite fête de 0,72 s : la Ball part en cloche
//      DEVANT le joueur, s'ouvre, un éclair blanc, et la créature grandit
//      depuis zéro avec un rebond. C'est le geste que Robin va refaire cent
//      fois : il doit être court, net et joyeux — jamais une cinématique.
//    · la créature suit ensuite le joueur à 1,6 tuile derrière lui, LE LONG DE
//      SA TRACE (voir « pourquoi une trace » plus bas), légèrement décalée sur
//      sa droite ; elle s'arrête quand il s'arrête et se tourne alors vers lui.
//    · `recall()` la range en 0,5 s : éclair, la créature rapetisse, la Ball se
//      referme et revient dans la main du joueur.
//    · `reactTo(kind)` joue une réaction courte : recul étonné devant un
//      légendaire, bond de combat, sauts de joie à une capture.
//
//  CE QU'IL NE FAIT JAMAIS
//  -----------------------
//    · il ne BLOQUE rien : le compagnon n'est inscrit dans aucune grille de
//      collision, ne prend aucune tuile, ne déclenche aucune rencontre. Ni le
//      joueur ni les PNJ ne peuvent se retrouver coincés par lui — c'est la
//      règle n°1 quand on ajoute un corps qui se balade dans les pieds du
//      joueur d'un jeu à la tuile.
//    · il ne dépasse jamais UNE créature dehors à la fois, et son modèle 3D
//      est mis en cache : sortir/rappeler cent fois ne reconstruit rien.
//
//  POURQUOI UNE TRACE (breadcrumbs) PLUTÔT QU'UN SIMPLE « DERRIÈRE LE JOUEUR »
//  ---------------------------------------------------------------------------
//  Viser bêtement `joueur − direction × 1,6` fait sauter la cible d'un coup
//  quand le joueur tourne à angle droit — et le compagnon coupe alors à
//  travers les maisons et les remparts. On mémorise donc les 64 derniers
//  points du joueur et on suit le point situé 1,6 tuile EN ARRIÈRE LE LONG DE
//  CE CHEMIN : le compagnon marche littéralement dans ses pas, prend les mêmes
//  virages, et ne traverse plus rien que le joueur n'ait déjà traversé.
//
//  POURQUOI UN `holder` ENTRE LA RACINE ET LE MODÈLE
//  -------------------------------------------------
//  `R3.idleCreature()` écrit dans `model.scale` à chaque image (la
//  respiration). Si l'animation de sortie écrivait AUSSI dans `model.scale`,
//  l'une écraserait l'autre et la créature clignoterait. Le grossissement
//  depuis zéro est donc porté par un groupe parent (`holder`), la respiration
//  par le modèle : les deux se composent sans se marcher dessus.
//
//  DÉPENDANCES — TOUTES FACULTATIVES (dégradation gracieuse, §1.4)
//  ---------------------------------------------------------------
//    R3.buildCreature(id) / R3.idleCreature()  → toujours fournis par core3d.
//    R3.get('regions').heightAt / R3.get('world').heightAt → relief. Le contrat
//        §4 annonce `regions.heightAt` ; dans le code d'aujourd'hui c'est
//        `world.heightAt` qui existe. On essaie les deux, puis y = 0.
//    R3.get('regions').isWalkable → pour ne pas faire éclore la créature dans
//        un mur. Absent : on sort tout de même, ce n'est pas bloquant.
//    R3.get('team')       → retrouver un `Mon` par son uid (deserialize).
//    R3.get('airship')    → rangement automatique pendant un vol.
//    window.GAME3D        → filet de sécurité : si le lot Intégration n'a pas
//        (encore) branché `update()`/`group()`, le module s'accroche tout seul
//        à la scène et se cache hors du monde ouvert. Voir « AUTONOMIE ».
//
//  AUTONOMIE (extensions hors contrat, documentées, sans effet si inutilisées)
//  ---------------------------------------------------------------------------
//    attach(scene)          ajoute le groupe racine à une scène.
//    autoRecall(raison)     rangement immédiat, EN MÉMORISANT qui était dehors.
//    autoRelease()          ressortie de celui qui avait été rangé.
//    setRegion(id)          changement de région : rangement + ressortie.
//    serialize()/deserialize(o)  pour le champ `buddy` de la sauvegarde (§12).
//    wasOut()               qui attend de ressortir, ou null.
//  Et, en dernier recours, `update()` détecte tout seul un vol, un combat ou un
//  changement de région : même sans branchement, le compagnon ne reste jamais
//  planté au milieu d'un écran de combat.
//
//  BUDGET DE DESSIN
//  ----------------
//    au repos, compagnon dehors : le modèle de la créature SEUL (15 à 35 draw
//      calls selon l'espèce, exactement le coût d'un roamer) ; tout le reste
//      (Ball, éclair, étincelles) est `visible = false`, donc gratuit.
//    pendant les 0,72 s de la sortie : +13 au maximum (5 Ball, 2 éclair,
//      6 étincelles), et rien n'est alloué pendant l'animation.
//    compagnon rangé : 0.
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  //  GARDE-FOU DE CHARGEMENT — aucun module ne lève au chargement (§1.4).
  //  Sans R3 on ne peut même pas s'enregistrer : on part en silence.
  // ---------------------------------------------------------------------------
  if (typeof R3 === 'undefined') {
    if (typeof console !== 'undefined') {
      console.warn('[buddy3d] core3d.js est absent : pas de compagnon.');
    }
    return;
  }
  var THREE_OK = (typeof THREE !== 'undefined');

  function warn(step, e) {
    if (typeof console !== 'undefined') console.warn('[buddy3d] ' + step + ' —', e);
  }

  // ---------------------------------------------------------------------------
  //  RÉGLAGES — tous en tuiles / secondes, jamais en images.
  // ---------------------------------------------------------------------------

  var FOLLOW_DIST = 1.6;     // §4 : « 1,6 tuile derrière »
  var FOLLOW_SIDE = 0.45;    // décalage sur la droite du joueur : on ne marche
                             // pas EXACTEMENT dans ses pas, c'est plus vivant
                             // et ça évite définitivement de se glisser entre
                             // la caméra et lui en vue aventure.
  var TELEPORT_DIST = 8.0;   // §4 : distancé de plus de 8 tuiles → on rattrape
  var STOP_SPEED = 0.35;     // tuiles/s en dessous desquelles on est « arrêté »

  var SMOOTH_FAR = 0.55;     // rattrapage vif quand on est loin de sa cible
  var SMOOTH_NEAR = 0.80;    // suivi doux quand on est déjà en place
  var SMOOTH_SWITCH = 1.0;   // au-delà de 1 tuile d'erreur : mode « vif »
  var YAW_SMOOTH = 0.72;     // lissage de l'orientation du corps
  var HEAD_MAX = 0.75;       // rad : le cou ne se dévisse pas

  var TRAIL_MAX = 64;        // points de trace mémorisés
  var TRAIL_STEP = 0.16;     // distance minimale entre deux points de trace

  // --- Chronologie de la SORTIE (jubilatoire, < 0,8 s — §4) ------------------
  var REL_FLY = 0.24;        // la Ball vole en cloche
  var REL_POP = 0.24;        // elle s'ouvre : éclair blanc
  var REL_GROW = 0.58;       // la créature a fini de grandir (avec rebond)
  var REL_END = 0.72;        // petit saut de fin, puis suivi normal

  // --- Chronologie du RAPPEL -------------------------------------------------
  var REC_FLASH = 0.10;
  var REC_SHRINK = 0.32;
  var REC_END = 0.50;

  var CACHE_MAX = 6;         // modèles gardés en cache (le reste est libéré)

  // Le modèle d'une créature est construit tourné vers +z (core3d, §1.4) :
  // 'down' correspond donc à une rotation nulle. Même table que roamers3d.
  var DIR_VEC = {
    up: { x: 0, z: -1 },
    down: { x: 0, z: 1 },
    left: { x: -1, z: 0 },
    right: { x: 1, z: 0 },
  };

  // ---------------------------------------------------------------------------
  //  ÉTAT
  // ---------------------------------------------------------------------------

  var S = {
    root: null,        // groupe racine, ajouté à la scène par le lot Intégration
    holder: null,      // porte position/orientation/échelle de la créature
    model: null,       // modèle courant (enfant de holder), issu du cache
    ball: null,        // la Pokéball, réutilisée à chaque sortie
    flash: null,       // l'éclair blanc de l'ouverture
    halo: null,        // l'anneau de l'éclair
    sparks: null,      // les étincelles de la sortie

    mon: null,         // le `Mon` dehors (ou en train de sortir)
    speciesId: null,
    phase: 'in',       // 'in' | 'release' | 'out' | 'recall'
    animT: 0,          // avancement de l'animation de sortie / rappel

    x: 0, z: 0, y: 0,  // position monde du compagnon
    yaw: 0,
    lastX: 0, lastZ: 0,
    speed: 0,
    phaseSeed: 0,      // déphasage de la respiration : deux compagnons
                       // successifs ne respirent pas au même rythme

    react: null,       // { kind, t, dur }
    hidden: false,     // caché (combat, vol, écran-titre) mais toujours dehors
    pendingUid: null,  // qui doit ressortir après un rangement automatique
    pendingMon: null,
    regionId: null,    // dernière région connue (détection de changement)
    attached: false,
  };

  var _cache = [];     // [{ id, group }] — modèles réutilisés, plus récent en tête

  // Objets de travail : AUCUNE allocation dans la boucle de rendu.
  var _P = { x: 0, z: 0, y: 0, dir: 'down', moving: false, ok: false };
  var _T = { x: 0, z: 0 };
  var _F = { x: 0, z: 1 };
  var _from = { x: 0, y: 0, z: 0 };
  var _to = { x: 0, y: 0, z: 0 };

  // Trace du joueur : tampon circulaire pré-alloué.
  var TR = [];
  var _trHead = 0, _trCount = 0;
  for (var _i = 0; _i < TRAIL_MAX; _i++) TR.push({ x: 0, z: 0 });

  // ---------------------------------------------------------------------------
  //  PETITS OUTILS
  // ---------------------------------------------------------------------------

  /** Hauteur du sol. Le contrat §4 annonce `regions.heightAt` ; le code
   *  d'aujourd'hui la place dans `world`. On essaie les deux, puis 0. */
  function groundY(x, z) {
    var m = R3.get('regions');
    if (m && typeof m.heightAt === 'function') {
      try {
        var h = m.heightAt(x, z);
        if (typeof h === 'number' && isFinite(h)) return h;
      } catch (e) { /* on tente la suivante */ }
    }
    m = R3.get('world');
    if (m && typeof m.heightAt === 'function') {
      try {
        var h2 = m.heightAt(x, z);
        if (typeof h2 === 'number' && isFinite(h2)) return h2;
      } catch (e2) { /* repli plat */ }
    }
    return 0;
  }

  /** Une tuile accueille-t-elle la créature ? Sert UNIQUEMENT à choisir un joli
   *  point d'éclosion : on ne bloque jamais rien avec cette réponse. */
  function looksFree(x, z) {
    var R = R3.get('regions');
    if (!R || typeof R.isWalkable !== 'function') return true;
    try { return !!R.isWalkable(Math.round(x), Math.round(z)); }
    catch (e) { return true; }
  }

  function nowT() {
    return (R3.clock && typeof R3.clock.t === 'number') ? R3.clock.t : 0;
  }

  function angleDamp(cur, target, smoothing, dt) {
    var d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * (1 - Math.pow(smoothing, Math.max(0.0001, dt) * 60));
  }

  function clampAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /** Le vecteur « devant » du joueur, dans _F. */
  function forwardOf(dir) {
    var v = DIR_VEC[dir] || DIR_VEC.down;
    _F.x = v.x; _F.z = v.z;
    return _F;
  }

  /** État du joueur, normalisé dans _P. Accepte l'objet `state.player` de
   *  game3d (worldX/worldZ/dir/moving) ET un THREE.Object3D (playerGroup),
   *  pour que le branchement ne puisse pas se tromper. */
  function readPlayer(p) {
    _P.ok = false;
    if (!p) {
      // Filet : on va chercher l'état du jeu tout seul.
      try {
        if (typeof window !== 'undefined' && window.GAME3D && window.GAME3D.state) {
          p = window.GAME3D.state.player;
        }
      } catch (e) { p = null; }
      if (!p) return _P;
    }
    if (typeof p.worldX === 'number' && isFinite(p.worldX)) {
      _P.x = p.worldX; _P.z = p.worldZ;
    } else if (p.position && typeof p.position.x === 'number') {
      _P.x = p.position.x; _P.z = p.position.z;
    } else if (typeof p.x === 'number' && isFinite(p.x)) {
      _P.x = p.x; _P.z = (typeof p.z === 'number') ? p.z : p.y;
    } else {
      return _P;
    }
    _P.y = (typeof p.worldY === 'number' && isFinite(p.worldY)) ? p.worldY : groundY(_P.x, _P.z);
    _P.dir = p.dir || (p.userData && p.userData.dir) || 'down';
    _P.moving = !!p.moving;
    _P.ok = true;
    return _P;
  }

  // --- La trace ---------------------------------------------------------------

  function trailReset(x, z) {
    _trHead = 0; _trCount = 1;
    TR[0].x = x; TR[0].z = z;
  }

  function trailPush(x, z) {
    if (_trCount > 0) {
      var last = TR[_trHead];
      var dx = x - last.x, dz = z - last.z;
      if (dx * dx + dz * dz < TRAIL_STEP * TRAIL_STEP) return;
    }
    _trHead = (_trHead + 1) % TRAIL_MAX;
    TR[_trHead].x = x; TR[_trHead].z = z;
    if (_trCount < TRAIL_MAX) _trCount++;
  }

  /** Point situé `dist` tuiles en arrière LE LONG de la trace. Renvoie false si
   *  la trace est trop courte (juste sorti, ou joueur immobile depuis le
   *  début) : l'appelant retombe alors sur « derrière le joueur ». */
  function trailAt(dist, out) {
    if (_trCount < 2) return false;
    var acc = 0, i = _trHead;
    for (var n = 1; n < _trCount; n++) {
      var j = (i - 1 + TRAIL_MAX) % TRAIL_MAX;
      var a = TR[i], b = TR[j];
      var seg = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));
      if (seg > 1e-6 && acc + seg >= dist) {
        var k = (dist - acc) / seg;
        out.x = a.x + (b.x - a.x) * k;
        out.z = a.z + (b.z - a.z) * k;
        return true;
      }
      acc += seg;
      i = j;
    }
    return false;
  }

  /** Où le compagnon devrait se tenir : 1,6 tuile en arrière sur la trace,
   *  décalé sur la droite du joueur. Résultat dans _T. */
  function followTarget(P) {
    var f = forwardOf(P.dir);
    if (!trailAt(FOLLOW_DIST, _T)) {
      _T.x = P.x - f.x * FOLLOW_DIST;
      _T.z = P.z - f.z * FOLLOW_DIST;
    }
    // Droite du joueur = perpendiculaire de « devant ».
    _T.x += -f.z * FOLLOW_SIDE;
    _T.z += f.x * FOLLOW_SIDE;
    return _T;
  }

  // ---------------------------------------------------------------------------
  //  CONSTRUCTION DES ACCESSOIRES (une seule fois, réutilisés à vie)
  // ---------------------------------------------------------------------------

  var _ballHalfGeo = null;

  /** La Pokéball : deux demi-sphères, une bande, un bouton. 5 meshes, tous
   *  avec des matériaux partagés via R3.mat(). */
  function buildBall() {
    var r = 0.19;
    if (!_ballHalfGeo) {
      _ballHalfGeo = new THREE.SphereGeometry(r, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2);
      // Marquée « partagée » : R3.disposeTree ne doit jamais la libérer.
      _ballHalfGeo.userData.shared = true;
    }
    var g = new THREE.Group();
    var top = new THREE.Mesh(_ballHalfGeo, R3.mat('#e5402f', { rough: 0.32 }));
    var bot = new THREE.Mesh(_ballHalfGeo, R3.mat('#f4f4f4', { rough: 0.32 }));
    bot.rotation.x = Math.PI;
    top.castShadow = bot.castShadow = true;
    var band = R3.torus(r * 1.02, r * 0.15, '#1a1c2c', 0, 0, 0, { seg: 16, rough: 0.5 });
    band.rotation.x = Math.PI / 2;
    var button = R3.cyl(r * 0.30, r * 0.30, r * 0.10, '#f4f4f4', 0, 0, r * 0.02, { seg: 12, rough: 0.3 });
    button.rotation.x = Math.PI / 2;
    var ring = R3.torus(r * 0.30, r * 0.055, '#1a1c2c', 0, 0, r * 0.07, { seg: 12, rough: 0.5 });
    ring.rotation.x = Math.PI / 2;
    // La moitié haute de la Ball s'écarte à l'ouverture : c'est ce petit détail
    // qui fait « elle s'ouvre » plutôt que « elle disparaît ».
    var lid = new THREE.Group();
    lid.add(top);
    g.add(lid, bot, band, button, ring);
    g.userData.lid = lid;
    g.visible = false;
    return g;
  }

  /** Matériau lumineux PROPRE au module.
   *  R3.mat() partage ses matériaux entre tous les modules : animer l'opacité
   *  d'un matériau partagé ferait clignoter les auras des légendaires et les
   *  vitres des maisons. On part donc du matériau du socle et on le clone —
   *  la couleur et les réglages restent ceux de R3.mat(), l'opacité devient
   *  la nôtre. Trois clones pour toute la vie du module.
   */
  function ownGlow(color, intensity) {
    var base = R3.mat(color, {
      emissive: color,
      emissiveIntensity: intensity,
      rough: 0.35,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    var m = base.clone();
    m.fog = false;       // l'éclair reste franc même à 40 tuiles
    return m;
  }

  /** L'éclair blanc de l'ouverture : une sphère + un anneau qui s'évase. */
  function buildFlash() {
    var m = ownGlow('#ffffff', 2.4);
    var s = new THREE.Mesh(R3.geo.sphere(1, 12), m);
    s.scale.setScalar(0.01);
    s.visible = false;
    R3.noShadow(s);
    s.userData.mat = m;
    return s;
  }

  function buildHalo() {
    var m = ownGlow('#ffe9a8', 2.0);
    var t = new THREE.Mesh(R3.geo.torus(0.5, 0.06, 18), m);
    t.rotation.x = Math.PI / 2;
    t.visible = false;
    R3.noShadow(t);
    t.userData.mat = m;
    return t;
  }

  /** Six étincelles qui jaillissent : un seul matériau, six petites sphères.
   *  Elles ne sont visibles que pendant l'animation, donc gratuites au repos. */
  function buildSparks() {
    var m = ownGlow('#ffd75e', 1.8);
    var g = new THREE.Group();
    for (var i = 0; i < 6; i++) {
      var s = new THREE.Mesh(R3.geo.sphere(1, 6), m);
      s.scale.setScalar(0.05);
      var a = (i / 6) * Math.PI * 2;
      // Direction fixe, mémorisée une fois : rien n'est alloué à l'animation.
      s.userData.vx = Math.cos(a);
      s.userData.vz = Math.sin(a);
      s.userData.vy = 0.9 + (i % 3) * 0.35;
      g.add(s);
    }
    g.visible = false;
    R3.noShadow(g);
    g.userData.mat = m;
    return g;
  }

  /** Racine + accessoires. Appelée une fois, à la première utilisation. */
  function ensureBuilt() {
    if (S.root || !THREE_OK) return S.root;
    try {
      S.root = new THREE.Group();
      S.root.name = 'buddy3d';
      S.holder = new THREE.Group();
      S.holder.visible = false;
      S.ball = buildBall();
      S.flash = buildFlash();
      S.halo = buildHalo();
      S.sparks = buildSparks();
      S.root.add(S.holder, S.ball, S.flash, S.halo, S.sparks);
    } catch (e) {
      warn('construction du compagnon', e);
      S.root = null;
    }
    return S.root;
  }

  // ---------------------------------------------------------------------------
  //  CACHE DES MODÈLES — « une seule créature dehors, modèle réutilisé » (§4)
  // ---------------------------------------------------------------------------

  function modelFor(speciesId) {
    for (var i = 0; i < _cache.length; i++) {
      if (_cache[i].id === speciesId) {
        var hit = _cache.splice(i, 1)[0];
        _cache.unshift(hit);                 // le plus récent en tête
        return hit.group;
      }
    }
    var g = null;
    try { g = R3.buildCreature(speciesId); }
    catch (e) { warn('modèle de « ' + speciesId + ' »', e); }
    if (!g) return null;
    _cache.unshift({ id: speciesId, group: g });
    while (_cache.length > CACHE_MAX) {
      var old = _cache.pop();
      if (old.group === S.model) { _cache.push(old); break; }   // jamais le modèle affiché
      try { R3.disposeTree(old.group); } catch (e2) { /* déjà détaché */ }
    }
    return g;
  }

  /** Détache le modèle affiché sans le détruire : il retourne au cache. */
  function detachModel() {
    if (S.model && S.model.parent) S.model.parent.remove(S.model);
    S.model = null;
  }

  // ---------------------------------------------------------------------------
  //  ANIMATIONS D'ACCESSOIRES
  // ---------------------------------------------------------------------------

  function hideProps() {
    if (S.ball) {
      S.ball.visible = false;
      S.ball.scale.setScalar(1);   // le rappel la rétrécit : on la remet d'aplomb
      if (S.ball.userData.lid) S.ball.userData.lid.position.y = 0;
    }
    if (S.flash) S.flash.visible = false;
    if (S.halo) S.halo.visible = false;
    if (S.sparks) S.sparks.visible = false;
  }

  /** L'éclair : une bulle blanche qui gonfle et s'efface en 0,22 s. */
  function playFlash(p, x, y, z) {
    if (!S.flash || !S.halo) return;
    if (p >= 1) { S.flash.visible = false; S.halo.visible = false; return; }
    var k = R3.easeOut(p);
    S.flash.visible = true;
    S.flash.position.set(x, y, z);
    S.flash.scale.setScalar(0.06 + k * 0.85);
    S.flash.userData.mat.opacity = (1 - p) * (1 - p);
    S.halo.visible = true;
    S.halo.position.set(x, y, z);
    S.halo.scale.setScalar(0.3 + k * 2.6);
    S.halo.userData.mat.opacity = (1 - p) * 0.85;
  }

  function playSparks(p, x, y, z) {
    if (!S.sparks) return;
    if (p >= 1) { S.sparks.visible = false; return; }
    S.sparks.visible = true;
    var t = p * 0.55;
    var kids = S.sparks.children;
    for (var i = 0; i < kids.length; i++) {
      var s = kids[i], u = s.userData;
      s.position.set(x + u.vx * t * 2.2, y + u.vy * t - 3.2 * t * t, z + u.vz * t * 2.2);
    }
    S.sparks.userData.mat.opacity = 1 - p * p;
  }

  // ---------------------------------------------------------------------------
  //  SORTIE / RAPPEL
  // ---------------------------------------------------------------------------

  /** Où la créature éclôt : environ 1,7 tuile DEVANT le joueur, bien en vue.
   *  (Faire éclore derrière lui serait invisible en vue aventure, et c'est
   *  justement le moment que Robin veut voir.) Si la tuile n'est pas libre,
   *  on se rabat sur ses pieds : mieux vaut une éclosion moche qu'aucune. */
  function releaseSpot(P, out) {
    var f = forwardOf(P.dir);
    var x = P.x + f.x * 1.7, z = P.z + f.z * 1.7;
    if (!looksFree(x, z)) {
      x = P.x + f.x * 0.9; z = P.z + f.z * 0.9;
      if (!looksFree(x, z)) { x = P.x; z = P.z; }
    }
    out.x = x; out.z = z; out.y = groundY(x, z);
    return out;
  }

  function release(mon, opts) {
    opts = opts || {};
    if (!mon) return false;
    if (!ensureBuilt()) return false;

    // Une seule dehors à la fois : on range l'ancienne sèchement (le joueur a
    // demandé la nouvelle, il ne veut pas attendre une animation de rangement).
    if (S.mon && S.mon.uid && mon.uid && S.mon.uid === mon.uid && S.phase !== 'in') return true;
    if (S.phase !== 'in') hardRecall();

    var speciesId = mon.id || mon.speciesId || null;
    if (!speciesId) return false;
    var g = modelFor(speciesId);
    if (!g) return false;

    var P = readPlayer(opts.player || null);
    if (!P.ok) { P.x = 0; P.z = 0; P.y = 0; P.dir = 'down'; }

    detachModel();
    S.model = g;
    S.holder.add(g);
    S.mon = mon;
    S.speciesId = speciesId;
    S.phaseSeed = Math.random() * 6.2832;
    S.react = null;
    S.hidden = false;
    S.pendingUid = null;
    S.pendingMon = null;

    var spot = (opts.at && typeof opts.at.x === 'number')
      ? (function (a) { _to.x = a.x; _to.z = (typeof a.z === 'number') ? a.z : a.y; _to.y = groundY(_to.x, _to.z); return _to; })(opts.at)
      : releaseSpot(P, _to);

    S.x = spot.x; S.z = spot.z; S.y = spot.y;
    S.lastX = S.x; S.lastZ = S.z; S.speed = 0;
    S.yaw = Math.atan2(P.x - S.x, P.z - S.z);   // elle regarde son dresseur
    S.holder.position.set(S.x, S.y, S.z);
    S.holder.rotation.set(0, S.yaw, 0);
    S.holder.visible = true;

    // La trace repart du joueur : le compagnon ne va pas « rattraper » un
    // chemin d'il y a dix minutes.
    trailReset(P.x, P.z);

    _from.x = P.x; _from.y = P.y + 0.95; _from.z = P.z;   // l'épaule du joueur

    if (opts.instant) {
      // Chargement d'une partie : elle est simplement là, sans fanfare.
      S.phase = 'out';
      S.animT = REL_END;
      S.holder.scale.setScalar(1);
      hideProps();
    } else {
      S.phase = 'release';
      S.animT = 0;
      S.holder.scale.setScalar(0.001);
      hideProps();
      if (S.ball) {
        S.ball.visible = true;
        S.ball.position.set(_from.x, _from.y, _from.z);
        S.ball.rotation.set(0, 0, 0);
      }
    }
    return true;
  }

  /** Rangement instantané, sans animation (changement de région, combat, vol,
   *  remplacement par une autre créature). */
  function hardRecall() {
    detachModel();
    if (S.holder) { S.holder.visible = false; S.holder.scale.setScalar(1); }
    hideProps();
    S.mon = null;
    S.speciesId = null;
    S.phase = 'in';
    S.animT = 0;
    S.react = null;
    S.hidden = false;
  }

  function recall(opts) {
    opts = opts || {};
    if (S.phase === 'in' || S.phase === 'recall') return false;
    if (opts.instant) { hardRecall(); return true; }
    S.phase = 'recall';
    S.animT = 0;
    S.react = null;
    if (S.ball) {
      S.ball.visible = true;
      S.ball.position.set(S.x, S.y + 0.55, S.z);
      if (S.ball.userData.lid) S.ball.userData.lid.position.y = 0.16;
    }
    return true;
  }

  function toggle(mon) {
    if (S.phase !== 'in') {
      // Rappeler, sauf si l'on demande explicitement une AUTRE créature.
      if (mon && mon.uid && S.mon && S.mon.uid && mon.uid !== S.mon.uid) return release(mon);
      return recall();
    }
    return release(mon || activeMon());
  }

  /** La créature active de l'équipe, quand l'appelant ne précise rien. */
  function activeMon() {
    var T = R3.get('team');
    if (!T || typeof T.active !== 'function') return null;
    try { return T.active() || null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------------
  //  RÉACTIONS (§4 : « une petite animation quand un légendaire passe… »)
  // ---------------------------------------------------------------------------

  var REACT_DUR = { legendaire: 1.30, combat: 0.85, capture: 1.15 };

  function reactTo(kind) {
    if (S.phase === 'in' || S.hidden) return false;
    var k = String(kind || '').toLowerCase();
    if (!REACT_DUR[k]) k = 'legendaire';
    // Une réaction en cours n'est pas empilée : elle repart de zéro, sinon
    // trois légendaires d'affilée donneraient une créature épileptique.
    S.react = { kind: k, t: 0, dur: REACT_DUR[k] };
    return true;
  }

  /** Applique la réaction PAR-DESSUS la pose de suivi. On ne touche qu'à des
   *  décalages : la position de suivi reste la vérité, la réaction n'est qu'un
   *  vernis, elle ne peut donc jamais faire dériver le compagnon. */
  function applyReact(dt) {
    var R = S.react;
    if (!R) return;
    R.t += dt;
    var p = R.t / R.dur;
    if (p >= 1) {
      S.react = null;
      return;
    }
    var env = Math.sin(p * Math.PI);          // ouverture / fermeture douce
    var H = S.holder;
    if (R.kind === 'legendaire') {
      // Étonnement : recul d'un demi-pas, museau vers le ciel, frisson.
      // `yaw` est l'orientation du corps : (sin, cos) est donc son « devant ».
      H.position.x -= Math.sin(S.yaw) * 0.35 * env;
      H.position.z -= Math.cos(S.yaw) * 0.35 * env;
      H.position.y += Math.abs(Math.sin(p * Math.PI * 2)) * 0.10;
      H.rotation.x = -0.28 * env;
      H.rotation.z = Math.sin(R.t * 26) * 0.07 * env;
      H.scale.multiplyScalar(1 + 0.06 * env);
    } else if (R.kind === 'combat') {
      // Prêt à en découdre : on s'écrase, puis on bondit vers l'avant.
      var bond = Math.sin(p * Math.PI) * Math.sin(p * Math.PI);
      H.position.x += Math.sin(S.yaw) * 0.30 * bond;
      H.position.z += Math.cos(S.yaw) * 0.30 * bond;
      H.position.y += Math.sin(p * Math.PI) * 0.22;
      H.rotation.x = 0.22 * env;
      H.scale.set(H.scale.x * (1 + 0.10 * env), H.scale.y * (1 - 0.08 * env), H.scale.z * (1 + 0.10 * env));
    } else {
      // Joie : trois sauts et un tour sur soi-même.
      var sauts = Math.abs(Math.sin(p * Math.PI * 3));
      H.position.y += sauts * 0.34 * (1 - p * 0.4);
      H.rotation.y += p * Math.PI * 2;
      H.scale.multiplyScalar(1 + 0.05 * sauts);
    }
  }

  // ---------------------------------------------------------------------------
  //  DÉTECTIONS AUTOMATIQUES — le module se protège tout seul si le lot
  //  Intégration n'a pas (encore) branché les rappels du §4.
  // ---------------------------------------------------------------------------

  function gameScreen() {
    try {
      if (typeof window !== 'undefined' && window.GAME3D && window.GAME3D.state) {
        return window.GAME3D.state.screen || null;
      }
    } catch (e) { /* pas de jeu autour : on ne cache rien */ }
    return null;
  }

  function isFlying() {
    var A = R3.get('airship');
    if (!A || typeof A.isFlying !== 'function') return false;
    try { return !!A.isFlying(); } catch (e) { return false; }
  }

  /** Le compagnon doit-il disparaître de l'écran sans être « rangé » ?
   *  On CACHE plutôt qu'on ne range : au retour du combat, il est encore là,
   *  sans refaire l'animation de sortie — c'est plus doux et plus rapide. */
  function shouldHide() {
    if (isFlying()) return true;
    var s = gameScreen();
    if (!s) return false;
    return (s !== 'world');
  }

  /** Changement de région détecté tout seul : on téléporte le compagnon aux
   *  pieds du joueur plutôt que de le laisser à l'autre bout de l'ancienne
   *  carte. Le contrat demande « rappel avant, ressortie après » ; le résultat
   *  visible est le même, en moins brutal. */
  function watchRegion(P) {
    var R = R3.get('regions');
    if (!R || typeof R.activeId !== 'function') return;
    var id = null;
    try { id = R.activeId(); } catch (e) { return; }
    if (id === S.regionId) return;
    var connue = (S.regionId !== null);
    S.regionId = id;
    // La toute PREMIÈRE lecture n'est pas un changement de région : sans ce
    // garde-fou, le compagnon se téléporterait dès son premier update.
    if (!connue || S.phase === 'in') return;
    snapBehind(P);
  }

  /** Téléportation discrète derrière le joueur (§4 : distancé de > 8 tuiles,
   *  ou changement de carte). Discrète = pas d'étincelles, pas de bruit : on
   *  se contente de réapparaître là où le regard n'est pas. */
  function snapBehind(P) {
    if (!P || !P.ok) return;
    var f = forwardOf(P.dir);
    S.x = P.x - f.x * FOLLOW_DIST - f.z * FOLLOW_SIDE;
    S.z = P.z - f.z * FOLLOW_DIST + f.x * FOLLOW_SIDE;
    S.y = groundY(S.x, S.z);
    S.lastX = S.x; S.lastZ = S.z; S.speed = 0;
    S.yaw = Math.atan2(f.x, f.z);
    trailReset(P.x, P.z);
    if (S.holder) S.holder.position.set(S.x, S.y, S.z);
  }

  // ---------------------------------------------------------------------------
  //  BOUCLE — update(dt, player), appelée par game3d à chaque image (§4)
  // ---------------------------------------------------------------------------

  function update(dt, player) {
    if (!S.root) return;
    // Filet : si personne ne nous a ajoutés à une scène, on s'y accroche.
    if (!S.attached) autoAttach();
    if (S.phase === 'in') return;

    var d = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(0.05, dt) : 0.016;
    var t = nowT();
    var P = readPlayer(player);

    watchRegion(P);

    // --- 1. faut-il s'effacer (combat, vol, écran-titre) ? --------------------
    var hide = shouldHide();
    if (hide !== S.hidden) {
      S.hidden = hide;
      if (hide) hideProps();
      // Au retour, on réapparaît directement à sa place : pas de course
      // depuis l'endroit où l'on se trouvait avant le combat.
      if (!hide) snapBehind(P);
    }
    if (S.hidden) {
      S.holder.visible = false;
      return;
    }

    // --- 2. animation de rappel ----------------------------------------------
    if (S.phase === 'recall') {
      S.animT += d;
      var a = S.animT;
      playFlash(R3.clamp01(a / REC_FLASH + 0.15), S.x, S.y + 0.5, S.z);
      if (a < REC_SHRINK) {
        var kk = R3.clamp01(a / REC_SHRINK);
        S.holder.visible = true;
        S.holder.scale.setScalar(Math.max(0.001, 1 - R3.easeOut(kk)));
        S.holder.rotation.y = S.yaw + kk * 3.0;
        if (S.ball) {
          S.ball.visible = true;
          S.ball.position.set(S.x, S.y + 0.55, S.z);
          if (S.ball.userData.lid) S.ball.userData.lid.position.y = 0.16 * (1 - kk);
        }
      } else {
        S.holder.visible = false;
        var kb = R3.clamp01((a - REC_SHRINK) / Math.max(0.001, REC_END - REC_SHRINK));
        if (S.ball) {
          // La Ball revient dans la main : on vise le joueur s'il est connu.
          var bx = P.ok ? P.x : S.x, by = (P.ok ? P.y : S.y) + 0.95, bz = P.ok ? P.z : S.z;
          S.ball.visible = true;
          S.ball.position.set(
            R3.lerp(S.x, bx, R3.easeOut(kb)),
            R3.lerp(S.y + 0.55, by, R3.easeOut(kb)) + Math.sin(kb * Math.PI) * 0.5,
            R3.lerp(S.z, bz, R3.easeOut(kb))
          );
          S.ball.rotation.x -= d * 16;
          S.ball.scale.setScalar(Math.max(0.05, 1 - kb * 0.7));
        }
        if (a >= REC_END) {
          if (S.ball) S.ball.scale.setScalar(1);
          hardRecall();
        }
      }
      return;
    }

    // --- 3. animation de sortie ----------------------------------------------
    if (S.phase === 'release') {
      S.animT += d;
      var r = S.animT;
      S.holder.visible = (r >= REL_POP);

      if (r < REL_FLY) {
        // La Ball part en cloche : c'est ce geste-là que Robin refera cent fois.
        var pf = r / REL_FLY;
        if (S.ball) {
          S.ball.visible = true;
          S.ball.position.set(
            R3.lerp(_from.x, S.x, pf),
            R3.lerp(_from.y, S.y + 0.3, pf) + Math.sin(pf * Math.PI) * 1.15,
            R3.lerp(_from.z, S.z, pf)
          );
          S.ball.rotation.x -= d * 26;
          S.ball.rotation.z -= d * 9;
        }
        S.holder.scale.setScalar(0.001);
      } else {
        // Ouverture : la Ball s'écarte puis s'efface, l'éclair prend le relais.
        var po = (r - REL_POP) / 0.22;
        if (S.ball) {
          if (po < 1) {
            S.ball.visible = true;
            S.ball.position.set(S.x, S.y + 0.3 + po * 0.35, S.z);
            if (S.ball.userData.lid) S.ball.userData.lid.position.y = po * 0.30;
            S.ball.rotation.set(0, 0, 0);
          } else {
            S.ball.visible = false;
            if (S.ball.userData.lid) S.ball.userData.lid.position.y = 0;
          }
        }
        playFlash(R3.clamp01(po), S.x, S.y + 0.45, S.z);
        playSparks(R3.clamp01((r - REL_POP) / 0.5), S.x, S.y + 0.3, S.z);

        // Grossissement depuis ZÉRO, avec dépassement : un simple ease-out
        // donne une créature molle ; le rebond donne un « pop » joyeux.
        var pg = R3.clamp01((r - REL_POP) / Math.max(0.001, REL_GROW - REL_POP));
        var e = R3.easeOut(pg);
        var over = 1 + Math.sin(pg * Math.PI) * 0.18;      // ×1,18 au sommet
        S.holder.scale.setScalar(Math.max(0.001, e * over));
        S.holder.position.set(S.x, S.y + Math.sin(pg * Math.PI) * 0.18, S.z);
        S.holder.rotation.set(0, S.yaw, 0);
      }

      if (S.animT >= REL_END) {
        S.phase = 'out';
        S.holder.scale.setScalar(1);
        hideProps();
      } else {
        // Pendant la sortie, la créature respire déjà : elle est vivante dès
        // la première image où on la voit.
        if (S.model && S.holder.visible) {
          try { R3.idleCreature(S.model, t, S.phaseSeed); } catch (e2) { /* tolérant */ }
        }
        return;
      }
    }

    // --- 4. suivi ------------------------------------------------------------
    if (!P.ok) return;
    trailPush(P.x, P.z);

    var far = Math.sqrt((S.x - P.x) * (S.x - P.x) + (S.z - P.z) * (S.z - P.z));
    if (far > TELEPORT_DIST) { snapBehind(P); }

    var T = followTarget(P);
    var err = Math.sqrt((T.x - S.x) * (T.x - S.x) + (T.z - S.z) * (T.z - S.z));
    var smooth = (err > SMOOTH_SWITCH) ? SMOOTH_FAR : SMOOTH_NEAR;
    S.x = R3.damp(S.x, T.x, smooth, d);
    S.z = R3.damp(S.z, T.z, smooth, d);
    S.y = groundY(S.x, S.z);          // elle suit le relief, jamais un plan fixe

    // Vitesse réelle : c'est elle (pas l'état du joueur) qui décide si l'on
    // marche ou si l'on s'arrête — au moment où le joueur stoppe, le compagnon
    // est encore en train de finir son approche.
    var mx = S.x - S.lastX, mz = S.z - S.lastZ;
    var inst = Math.sqrt(mx * mx + mz * mz) / d;
    // Lissage en TEMPS (R3.damp), jamais par image : à 120 Hz un simple
    // « +25 % par frame » réagirait deux fois plus vite qu'à 60 Hz.
    S.speed = R3.damp(S.speed, inst, 0.75, d);
    S.lastX = S.x; S.lastZ = S.z;

    // --- 5. orientation ------------------------------------------------------
    var toPlayer = Math.atan2(P.x - S.x, P.z - S.z);
    var wantYaw;
    if (S.speed > STOP_SPEED) {
      wantYaw = Math.atan2(mx, mz);       // en marche : on regarde où l'on va
    } else {
      wantYaw = toPlayer;                 // à l'arrêt : on se tourne vers lui (§4)
    }
    S.yaw = angleDamp(S.yaw, wantYaw, YAW_SMOOTH, d);

    S.holder.visible = true;
    S.holder.position.set(S.x, S.y, S.z);
    S.holder.rotation.set(0, S.yaw, 0);
    S.holder.scale.setScalar(1);

    // --- 6. respiration + tête tournée vers le dresseur ----------------------
    if (S.model) {
      try { R3.idleCreature(S.model, t, S.phaseSeed); } catch (e3) { /* tolérant */ }
      var anim = S.model.userData && S.model.userData.anim;
      if (anim && anim.head) {
        // `idleCreature` n'écrit que dans head.rotation.z (l'inclinaison) :
        // le lacet reste à nous, aucun conflit.
        var dy = clampAngle(toPlayer - S.yaw);
        if (dy > HEAD_MAX) dy = HEAD_MAX;
        if (dy < -HEAD_MAX) dy = -HEAD_MAX;
        anim.head.rotation.y = R3.damp(anim.head.rotation.y || 0, dy, 0.86, d);
      }
      // Trottinement : un léger balancement quand elle court après le joueur.
      if (S.speed > STOP_SPEED) {
        S.holder.position.y += Math.abs(Math.sin(t * 9.0 + S.phaseSeed)) * 0.055;
        S.holder.rotation.z = Math.sin(t * 9.0 + S.phaseSeed) * 0.06;
      } else {
        S.holder.rotation.z = 0;
      }
    }

    // --- 7. réaction éventuelle, par-dessus tout le reste --------------------
    applyReact(d);
  }

  // ---------------------------------------------------------------------------
  //  RACCORDEMENT À LA SCÈNE
  // ---------------------------------------------------------------------------

  function attach(scene) {
    if (!ensureBuilt() || !scene || typeof scene.add !== 'function') return false;
    if (S.root.parent === scene) { S.attached = true; return true; }
    try { scene.add(S.root); S.attached = true; return true; }
    catch (e) { warn('ajout à la scène', e); return false; }
  }

  /** Filet de sécurité : si le lot Intégration n'a pas appelé `attach()` ni
   *  ajouté `group()` à la scène, on va chercher la scène du jeu nous-mêmes.
   *  Sans cela, la créature « sortirait » sans jamais s'afficher — un bug
   *  invisible dans la console et incompréhensible pour un enfant. */
  function autoAttach() {
    if (S.attached || !S.root) return;
    if (S.root.parent) { S.attached = true; return; }
    try {
      if (typeof window !== 'undefined' && window.GAME3D && window.GAME3D.scene) {
        window.GAME3D.scene.add(S.root);
        S.attached = true;
      }
    } catch (e) { /* pas de scène : on réessaiera à la prochaine image */ }
  }

  // ---------------------------------------------------------------------------
  //  RANGEMENTS AUTOMATIQUES (combat, vol, changement de région) — §4
  // ---------------------------------------------------------------------------

  /** Range le compagnon EN MÉMORISANT qui était dehors, pour pouvoir le
   *  ressortir ensuite. À appeler avant un combat, un vol, un changement de
   *  région. Sans effet si personne n'est dehors. */
  function autoRecall(reason) {
    if (S.phase === 'in') return false;
    S.pendingUid = (S.mon && S.mon.uid) || null;
    S.pendingMon = S.mon;
    hardRecall();
    void reason;   // le paramètre n'existe que pour la lisibilité de l'appelant
    return true;
  }

  /** Ressort celui qui avait été rangé par `autoRecall()`. Sans effet si
   *  personne n'attendait, ou si une créature est déjà dehors. */
  function autoRelease() {
    if (S.phase !== 'in') return false;
    var m = S.pendingMon;
    if (!m && S.pendingUid) {
      var T = R3.get('team');
      if (T && typeof T.mon === 'function') {
        try { m = T.mon(S.pendingUid); } catch (e) { m = null; }
      }
    }
    S.pendingUid = null;
    S.pendingMon = null;
    if (!m) return false;
    return release(m);
  }

  function wasOut() { return S.pendingMon || null; }

  /** Changement de région : on range et on ressort à la nouvelle position. */
  function setRegion(regionId) {
    S.regionId = regionId || null;
    if (S.phase === 'in') return;
    var m = S.mon;
    hardRecall();
    if (m) {
      S.pendingUid = m.uid || null;
      S.pendingMon = m;
      autoRelease();
    }
  }

  // ---------------------------------------------------------------------------
  //  SAUVEGARDE — champ `buddy` du §12 : simplement l'uid, ou null.
  // ---------------------------------------------------------------------------

  function serialize() {
    if (S.mon && S.mon.uid) return S.mon.uid;
    if (S.pendingUid) return S.pendingUid;   // rangé pour un combat : il est « dehors »
    return null;
  }

  function deserialize(o) {
    if (!o) { hardRecall(); return false; }
    var uid = (typeof o === 'string') ? o : (o.uid || o.buddy || null);
    if (!uid) return false;
    var T = R3.get('team');
    var m = null;
    if (T && typeof T.mon === 'function') {
      try { m = T.mon(uid); } catch (e) { m = null; }
    }
    if (!m) return false;
    // `instant` : au chargement d'une partie, le compagnon est déjà là. Rejouer
    // la fanfare à chaque ouverture du jeu la banaliserait.
    return release(m, { instant: true });
  }

  // ---------------------------------------------------------------------------
  //  API — signature EXACTE du §4, plus les extensions documentées en tête.
  // ---------------------------------------------------------------------------

  R3.register('buddy', {
    out: function () { return (S.phase === 'in') ? null : S.mon; },
    release: release,
    recall: recall,
    toggle: toggle,
    update: update,
    group: function () { return ensureBuilt(); },
    isOut: function () { return S.phase !== 'in'; },
    reactTo: reactTo,

    // --- extensions (hors contrat, sans effet si inutilisées) ---
    attach: attach,
    autoRecall: autoRecall,
    autoRelease: autoRelease,
    wasOut: wasOut,
    setRegion: setRegion,
    serialize: serialize,
    deserialize: deserialize,
    position: function () { return { x: S.x, y: S.y, z: S.z }; },
    speciesId: function () { return S.speciesId; },
  });
})();
