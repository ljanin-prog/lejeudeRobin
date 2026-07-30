// =============================================================================
//  battle3d.js — LA SCÈNE DE COMBAT EN 3D                          (CONTRACT2 §17)
// =============================================================================
//  Le combat est le moment de jeu le plus regardé : il a sa PROPRE scène Three.js,
//  sa propre caméra (léger travelling permanent) et un éclairage plus contrasté
//  que celui du monde ouvert. Ce module gère :
//    · le décor (dôme de ciel, arrière-plan de biome, deux plateformes) ;
//    · les DEUX camps, toujours des créatures (jamais le dresseur à l'écran —
//      c'est la règle du contrat : « le Mon du joueur vu de dos ») ;
//    · le changement de créature en cours de combat (swapIn) ;
//    · les 18 effets visuels des capacités (playFx), un par `move.fx` ;
//    · la capture pendant un combat (throwBall), timings repris du jeu 2D ;
//    · le traitement spécial des légendaires : plus grands, plateforme plus
//      large, caméra reculée, aura, entrée en scène plus longue.
//
//  CE QUI N'EST PAS ICI : les barres de PV, les menus, le sac. Tout ça est en
//  HTML dans hud3d.js — battle3d ne lit ni n'écrit aucun texte à l'écran.
//
//  Timings de la Pokéball (identiques au jeu 2D et au contrat) :
//      0    → 600 ms   lancer en parabole
//      600  → 1800 ms  3 secousses de 400 ms
//      1800 ms          résultat (capture ou échec)
//
//  Repères de la scène (mêmes axes que le monde : x droite, y haut, z vers la
//  caméra) : l'adversaire est au fond, le camp du joueur au premier plan, la
//  caméra recule vers +z.
//
//  DÉPENDANCES — TOUTES FACULTATIVES (dégradation gracieuse obligatoire) :
//    R3.get('dex')   -> savoir qui est légendaire, ses types, sa couleur
//    R3.get('types') -> couleur d'un type (sinon gris neutre)
//    R3.get('llib')  -> aura des légendaires (sinon pas d'aura, juste plus grand)
//    R3.buildCreature(id) -> toujours défini par core3d, jamais null
// =============================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Constantes de mise en scène
  // ---------------------------------------------------------------------------

  const T_THROW  = 600;    // ms : durée du lancer
  const T_SHAKE  = 1200;   // ms : durée totale des secousses (3 × 400)
  const T_RESULT = T_THROW + T_SHAKE;

  // Emplacements des deux camps
  const FOE_POS  = new THREE.Vector3(0.75, 0, -2.40);   // adversaire, au fond
  const PLR_POS  = new THREE.Vector3(-1.90, 0, 2.20);   // joueur, au premier plan
  const FOE_PLAT_R = 1.95, FOE_PLAT_H = 0.36;
  const PLR_PLAT_R = 2.20, PLR_PLAT_H = 0.32;
  const FOE_TOP  = FOE_PLAT_H;                          // hauteur du dessus de plateforme
  const PLR_TOP  = PLR_PLAT_H;

  const FOE_SCALE = 1.55;   // l'adversaire fait ~1,5 unité de haut
  const PLR_SCALE = 1.75;   // le compagnon du joueur est plus près : plus grand

  // Traitement des légendaires : « ils doivent en imposer ».
  //   - LEGEND_SCALE_MULT s'applique à tout modèle légendaire (le vrai modèle,
  //     une fois modélisé, fait déjà 1,8 à 2,4 unités de haut — un léger boost
  //     suffit).
  //   - LEGEND_PLACEHOLDER_BOOST compense la silhouette de repli que
  //     R3.buildCreature() renvoie tant que les 36 légendaires ne sont pas
  //     tous modélisés (elle a la taille d'une créature normale) : sans ce
  //     boost, un légendaire en cours de modélisation serait minuscule.
  const LEGEND_SCALE_MULT = 1.18;
  const LEGEND_PLACEHOLDER_BOOST = 2.6;
  const LEGEND_PLAT_MULT = 1.32;   // plateforme plus large (X/Z seulement)

  const BALL_R = 0.19;

  const CAM_LOOK = new THREE.Vector3(-0.10, 1.25, -0.40);
  const NEUTRAL_COLOR = '#94b0c2';   // repli si types3d est absent ou capacité neutre

  // ---------------------------------------------------------------------------
  //  Ambiance d'arène par biome — mélange des couleurs du combat 2D et de
  //  R3.biomeMood. Les biomes historiques ET les 8 nouveaux du contrat (§5)
  //  ont chacun leur entrée ; un biome inconnu retombe sur `plain`.
  //    plat     : 'grass' | 'sand' | 'stone' | 'snow'
  //    backdrop : 'trees' | 'meadow' | 'water' | 'dunes' | 'peaks' | 'city' |
  //               'village' | 'volcano' | 'celestial'
  // ---------------------------------------------------------------------------
  const ARENA = {
    forest:   { top: '#6fe3f2', mid: '#bfeedd', ground: '#4f9e3f', plat: 'grass', backdrop: 'trees'   },
    lake:     { top: '#73eff7', mid: '#a9dcf7', ground: '#5aa657', plat: 'grass', backdrop: 'water'   },
    plain:    { top: '#8ed0f7', mid: '#d8f0ae', ground: '#7fbe56', plat: 'grass', backdrop: 'meadow'  },
    beach:    { top: '#a6ddf7', mid: '#ffe3b0', ground: '#e3c68d', plat: 'sand',  backdrop: 'dunes'   },
    sea:      { top: '#7cc4ef', mid: '#a9d6ea', ground: '#3d86bd', plat: 'stone', backdrop: 'water'   },
    park:     { top: '#9ad9f7', mid: '#d3f2b6', ground: '#6cc04c', plat: 'grass', backdrop: 'meadow'  },
    city:     { top: '#a8d4ea', mid: '#dfe7ec', ground: '#a5aab0', plat: 'stone', backdrop: 'city'    },
    mountain: { top: '#b6dcf2', mid: '#dceaf2', ground: '#8a9199', plat: 'snow',  backdrop: 'peaks'   },
    village:  { top: '#95d4f2', mid: '#cfeeb4', ground: '#63b846', plat: 'grass', backdrop: 'village' },
    city2:    { top: '#a0cfe8', mid: '#d8e3ea', ground: '#a5aab0', plat: 'stone', backdrop: 'city'    },
    // --- les 8 nouveaux biomes du monde légendaire (tiles3d.js §5) ---
    jungle:    { top: '#6fd0c8', mid: '#bfe8c9', ground: '#2f6b34', plat: 'grass', backdrop: 'trees'    },
    swamp:     { top: '#8fc0b0', mid: '#c9d6a8', ground: '#4c6238', plat: 'grass', backdrop: 'water'    },
    volcano:   { top: '#e08a5a', mid: '#c96a44', ground: '#3a2018', plat: 'stone', backdrop: 'volcano'  },
    desert:    { top: '#8fc9ef', mid: '#f0dca0', ground: '#d8b46a', plat: 'sand',  backdrop: 'dunes'    },
    glacier:   { top: '#bfe4f6', mid: '#eaf6ff', ground: '#cfe9f5', plat: 'snow',  backdrop: 'peaks'    },
    celestial: { top: '#9a8ce0', mid: '#dcd2f7', ground: '#6a5fa8', plat: 'stone', backdrop: 'celestial'},
    coast:     { top: '#8fd4f4', mid: '#ffe6bd', ground: '#e0c489', plat: 'sand',  backdrop: 'dunes'    },
    citadel:   { top: '#a8d4ea', mid: '#dfe7ec', ground: '#b6b0a4', plat: 'stone', backdrop: 'city'     },
  };
  function arena(b) { return ARENA[b] || ARENA.plain; }

  // ---------------------------------------------------------------------------
  //  Cache de géométries propres à ce module.
  //  Elles sont marquées `shared` pour que R3.disposeTree() ne les libère pas :
  //  elles vivent aussi longtemps que la page et resservent à chaque combat.
  // ---------------------------------------------------------------------------
  const _ownGeos = new Map();
  function ownGeo(key, make) {
    let g = _ownGeos.get(key);
    if (!g) { g = make(); g.userData.shared = true; _ownGeos.set(key, g); }
    return g;
  }

  /**
   * Matériau d'EFFET (particule, éclat, fumée).
   * Ceux-là ne peuvent pas passer par R3.mat() : on anime leur opacité, et un
   * matériau partagé ferait clignoter tout le reste de la scène. Ils sont donc
   * créés à la volée puis libérés avec l'effet qui les porte.
   */
  function fxMat(color, additive, opacity) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: opacity !== undefined ? opacity : 1,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
  }

  /** Nombre de particules ajusté à la qualité choisie.
   *  En qualité haute on est GÉNÉREUX : les combats ne rendent qu'une poignée
   *  d'objets (deux créatures et deux plateformes), tout le budget peut partir
   *  dans les effets — c'est là que se joue le spectacle. */
  function qCount(n) {
    if (!R3.quality.particles) return Math.max(3, Math.round(n * 0.25));
    if (R3.quality.level === 'medium') return Math.max(4, Math.round(n * 0.70));
    return n;
  }

  // ---------------------------------------------------------------------------
  //  HALO DOUX PARTAGÉ — c'est LA brique qui fait la différence entre un effet
  //  « géométrique » et un effet lumineux : un dégradé radial dessiné au canvas,
  //  affiché en sprite additif. Une seule texture pour tout le jeu.
  // ---------------------------------------------------------------------------
  let _glowTex = null;
  function glowTexture() {
    if (_glowTex) return _glowTex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.34)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.08)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(cv);
    return _glowTex;
  }

  /** Sprite lumineux additif (toujours face caméra, jamais d'ombre). */
  function glowSprite(color, size, opacity) {
    const m = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(color),
      transparent: true,
      opacity: (opacity === undefined) ? 1 : opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }

  // ---------------------------------------------------------------------------
  //  État du module
  // ---------------------------------------------------------------------------

  let scene = null, camera = null;
  let sunLight = null, rimLight = null, hemiLight = null, punchLight = null;
  let bs = null;              // battleState courant (state.battle de game3d)
  let biomeCur = 'plain';
  let time = 0;               // secondes écoulées depuis enter()
  let camShake = 0;           // amplitude résiduelle de secousse de caméra
  let cloudRing = null;       // nuages lointains (tournent doucement)
  let skyMat = null;          // matériau du dôme (créé une fois, réutilisé)

  let foePlat = null, plrPlat = null;   // groupes des deux plateformes
  let ball = null;             // groupe pokéball (capture pendant le combat)
  let ballRest = new THREE.Vector3();
  let ballHand = new THREE.Vector3();
  let ballAnim = null;         // { active, t, chance, cb, result, ... } | null

  let foe = null, plr = null;  // les deux camps (voir makeSide)
  const fxList = [];           // effets en cours

  // Ressenti de l'impact : un très court arrêt sur image + un coup de zoom.
  // Ce sont les deux astuces qui font qu'un coup « se sent » au lieu d'être
  // simplement affiché.
  let hitStop = 0;             // secondes de quasi-gel restantes
  let zoomPunch = 0;           // amplitude du coup de zoom (0 = repos)
  const CAM_FOV = 42;          // fov de repos de la caméra de combat

  // Puissance du coup en cours (1 = normal, ~1,8 = super efficace + critique).
  // Posée par playFx() le temps d'un dispatchFx : les 18 effets appellent
  // fxImpact() sans paramètre, elle leur sert d'amplificateur commun.
  let fxForce = 1;

  let resultDone = false;      // le flourish de fin de combat n'a joué qu'une fois
  let animSeqLocal = 0;        // compteur local pour bs.anim.seq

  // ---------------------------------------------------------------------------
  //  Un « camp » : porteur de position + pivot d'animation + modèle
  // ---------------------------------------------------------------------------
  function makeSide(basePos, topY, facing) {
    const holder = new THREE.Group();          // position au sol du camp
    holder.position.copy(basePos);
    holder.position.y = topY;
    const pivot = new THREE.Group();           // secoué / reculé / aspiré
    holder.add(pivot);
    holder.rotation.y = facing;
    return {
      holder, pivot,
      model: null, mon: null, legendary: false, auraGroup: null,
      base: basePos.clone(),
      scale: 1,
      phase: Math.random() * 6.28,
      atkT: -1, atkDur: 0.8, atkDir: new THREE.Vector3(), impactDone: false,
      atkTarget: null, atkMove: null, atkIsHeal: false,
      hitT: -1, hitDur: 0.5, hitDir: new THREE.Vector3(),
      shrink: 1,       // 1 = normal, 0 = aspiré / pas encore apparu
      faint: -1,       // animation de K.O.
      visible: true,
      blob: null,      // ombre douce de contact
      introT: 0, introDur: 1.2, introDone: true, introFxDone: false,
      swap: null,      // { phase:'out'|'in', t, nextMon } pendant un changement
    };
  }

  function sideKeyOf(s) { return s === foe ? 'foe' : 'player'; }

  // ===========================================================================
  //  CONSTRUCTION DU DÉCOR
  // ===========================================================================

  /** Dôme de ciel dégradé — un seul ShaderMaterial pour toute la scène. */
  function buildSky(a) {
    if (!skyMat) {
      skyMat = new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color(a.top) },
          uMid: { value: new THREE.Color(a.mid) },
          uBot: { value: new THREE.Color(a.mid) },
        },
        vertexShader: [
          'varying vec3 vDir;',
          'void main() {',
          '  vDir = normalize(position);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}',
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;',
          'varying vec3 vDir;',
          // Un ShaderMaterial court-circuite renderer.outputColorSpace : comme les
          // uniformes THREE.Color sont en espace LINEAIRE, il faut convertir en
          // sRGB nous-memes, sinon l'arene sort plus sombre que le monde.
          'vec3 toSRGB(vec3 c) {',
          '  c = max(c, vec3(0.0));',
          '  return mix(pow(c, vec3(0.4166667)) * 1.055 - 0.055, c * 12.92,',
          '             vec3(lessThanEqual(c, vec3(0.0031308))));',
          '}',
          'void main() {',
          '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
          '  vec3 c = mix(uBot, uMid, smoothstep(0.30, 0.52, h));',
          '  c = mix(c, uTop, smoothstep(0.50, 0.95, h));',
          // petit halo de soleil, en haut à gauche, pour donner une direction
          '  float s = max(0.0, dot(vDir, normalize(vec3(-0.45, 0.50, -0.72))));',
          '  c += vec3(1.0, 0.94, 0.76) * pow(s, 16.0) * 0.40;',
          '  gl_FragColor = vec4(toSRGB(c), 1.0);',
          '}',
        ].join('\n'),
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
    } else {
      skyMat.uniforms.uTop.value.set(a.top);
      skyMat.uniforms.uMid.value.set(a.mid);
      skyMat.uniforms.uBot.value.set(a.mid);
    }
    const dome = new THREE.Mesh(ownGeo('sky-dome', function () {
      return new THREE.SphereGeometry(70, 24, 16);
    }), skyMat);
    dome.frustumCulled = false;
    return dome;
  }

  // NOTE IMPORTANTE sur les tailles : les caches de R3 sont indexés par les
  // dimensions. Créer une géométrie avec une taille tirée au hasard ferait
  // grossir le cache à chaque combat. Tous les décors sont donc construits à
  // taille 1 puis mis à l'échelle par le groupe qui les porte — le cache reste
  // minuscule et tout est varié quand même.

  /** Petit arbre stylisé pour le fond (tronc + 3 boules de feuillage). */
  function backdropTree(x, z, s, leaf, trunk, rnd) {
    const g = R3.group(
      R3.cyl(0.13, 0.19, 1.0, trunk, 0, 0.5, 0, { rough: 0.95 }),
      R3.ellipsoid(0.62, 0.58, 0.62, leaf, 0, 1.25, 0),
      R3.ellipsoid(0.44, 0.42, 0.44, leaf, 0.22, 1.72, -0.10),
      R3.ellipsoid(0.34, 0.32, 0.34, leaf, -0.26, 1.60, 0.14)
    );
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = rnd() * 6.28;
    return g;
  }

  /** Maisonnette de fond (village). */
  function backdropHouse(x, z, s, wall, roof, rnd) {
    const g = R3.group(
      R3.box(1.6, 1.1, 1.4, wall, 0, 0.55, 0, { rough: 0.9 }),
      R3.rot(R3.cone(1.35, 0.85, roof, 0, 1.55, 0, { seg: 4 }), 0, Math.PI / 4, 0),
      R3.box(0.34, 0.55, 0.06, '#7a4b2a', 0, 0.28, 0.72),
      R3.box(0.28, 0.26, 0.06, '#bfe8ff', -0.5, 0.68, 0.72),
      R3.box(0.28, 0.26, 0.06, '#bfe8ff', 0.5, 0.68, 0.72)
    );
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = (rnd() - 0.5) * 1.2;
    return g;
  }

  /** Cône « unité » (rayon 1, hauteur 1) que l'on met à l'échelle librement. */
  function unitCone(color, seg, flat) {
    return R3.cone(1, 1, color, 0, 0, 0, { seg: seg || 12, flat: !!flat });
  }
  /** Cube « unité » (1×1×1). */
  function unitBox(color, opts) {
    return R3.box(1, 1, 1, color, 0, 0, 0, opts);
  }

  /** Décor de fond, choisi selon le biome. Tout est low-poly et peu nombreux :
   *  c'est un arrière-plan, il doit poser l'ambiance sans coûter cher. */
  function buildBackdrop(a) {
    const g = new THREE.Group();
    const rnd = R3.rng(1234 + a.backdrop.length * 97);
    const ring = function (n, rMin, rMax, fn) {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + rnd() * 0.4;
        const r = rMin + rnd() * (rMax - rMin);
        fn(Math.sin(ang) * r, Math.cos(ang) * r, rnd(), ang);
      }
    };

    // Sol de l'arène : un grand disque, plus quelques ondulations douces
    const floor = R3.cyl(26, 26, 0.6, a.ground, 0, -0.30, 0, { seg: 40, rough: 0.95 });
    floor.castShadow = false;
    g.add(floor);
    ring(9, 9, 20, function (x, z, r) {
      const m = R3.ellipsoid(3 + r * 4, 0.7 + r * 1.2, 3 + r * 4, a.ground, x, -0.2, z, { rough: 1 });
      m.castShadow = false;
      g.add(m);
    });

    if (a.backdrop === 'trees' || a.backdrop === 'meadow' || a.backdrop === 'village') {
      const leafA = a.backdrop === 'trees' ? '#2f7d3a' : '#3f9440';
      const leafB = a.backdrop === 'trees' ? '#409a45' : '#57ac4a';
      const n = a.backdrop === 'trees' ? 16 : 9;
      ring(n, 10, 19, function (x, z, r) {
        g.add(backdropTree(x, z, 1.1 + r * 1.5, r > 0.5 ? leafA : leafB, '#7a5230', rnd));
      });
      // buissons et fleurs proches, pour habiller le pied de l'arène
      ring(14, 5.5, 9, function (x, z, r) {
        const b = R3.ellipsoid(0.5 + r * 0.4, 0.35 + r * 0.3, 0.5 + r * 0.4, leafB, x, 0.15, z);
        g.add(b);
        if (r > 0.6) {
          g.add(R3.sphere(0.09, r > 0.8 ? '#ff8fb8' : '#ffe27a', x + 0.3, 0.55, z + 0.2));
        }
      });
      if (a.backdrop === 'village') {
        ring(5, 11, 15, function (x, z, r) {
          g.add(backdropHouse(x, z, 1.3 + r * 0.6, '#f0e0c0', r > 0.5 ? '#d1483f' : '#3355b8', rnd));
        });
      }
    } else if (a.backdrop === 'water' || a.backdrop === 'dunes') {
      // Grande étendue d'eau derrière l'arène + quelques rochers / dunes
      const sea = R3.cyl(44, 44, 0.4, a.backdrop === 'dunes' ? '#41a6f6' : '#2f7fb8',
        0, -0.42, -18, { seg: 36, rough: 0.35 });
      sea.castShadow = false;
      g.add(sea);
      // écume : un anneau clair au bord
      const foam = R3.torus(44, 0.35, '#cfeeff', 0, -0.25, -18, { seg: 40, rough: 0.6 });
      foam.rotation.x = Math.PI / 2;
      foam.castShadow = false;
      g.add(foam);
      ring(10, 8, 17, function (x, z, r) {
        if (a.backdrop === 'dunes') {
          const d = R3.ellipsoid(2.4 + r * 2, 0.9 + r, 2.4 + r * 2, '#eed6a4', x, -0.1, z, { rough: 1 });
          d.castShadow = false;
          g.add(d);
          if (r > 0.6) g.add(backdropTree(x + 1.4, z + 0.8, 1.2, '#3f9440', '#8a6b3a', rnd));
        } else {
          const rock = R3.ellipsoid(0.8 + r, 0.6 + r * 0.8, 0.8 + r, '#7e8894', x, 0.1 + r * 0.3, z, { flat: true });
          rock.rotation.set(r, r * 3, r * 0.5);
          g.add(rock);
        }
      });
    } else if (a.backdrop === 'peaks') {
      ring(9, 11, 20, function (x, z, r, ang) {
        const h = 5 + r * 7;
        const w = 2.2 + r * 2.2;
        const peak = unitCone('#79838f', 6, true);
        peak.position.set(x, h / 2 - 0.4, z);
        peak.scale.set(w, h, w);
        peak.rotation.y = ang;
        g.add(peak);
        const snow = unitCone('#f2f8ff', 6, true);
        snow.position.set(x, h * 0.83 - 0.4, z);
        snow.scale.set(w * 0.42, h * 0.34, w * 0.42);
        snow.rotation.y = ang;
        g.add(snow);
      });
      ring(8, 6, 10, function (x, z, r) {
        const s = R3.ellipsoid(0.7 + r, 0.4 + r * 0.5, 0.7 + r, '#e6f1f7', x, 0, z, { flat: true });
        s.castShadow = false;
        g.add(s);
      });
    } else if (a.backdrop === 'city') {
      const walls = ['#c9d2da', '#dfe6ec', '#b6c2cd', '#e8d9c4'];
      ring(14, 10, 19, function (x, z, r, ang) {
        const h = 3 + r * 8;
        const w = 1.6 + r * 1.6;
        const b = unitBox(walls[(r * 4) | 0], { rough: 0.75 });
        b.position.set(x, h / 2 - 0.3, z);
        b.scale.set(w, h, w);
        b.rotation.y = ang;
        g.add(b);
        // bandeaux de fenêtres lumineuses
        for (let k = 1; k < Math.floor(h / 1.2); k++) {
          const win = unitBox('#ffe9a8', { emissive: '#ffd76a', emissiveIntensity: 0.55, rough: 0.4 });
          win.position.set(x, k * 1.2 - 0.2, z);
          win.scale.set(w * 0.94, 0.28, w * 0.94);
          win.rotation.y = ang;
          win.castShadow = false;
          g.add(win);
        }
      });
      ring(6, 6.5, 9, function (x, z) {
        g.add(R3.cyl(0.07, 0.09, 2.4, '#5a6673', x, 1.2, z));
        const lamp = R3.sphere(0.18, '#fff4c8', x, 2.5, z, { emissive: '#ffe27a', emissiveIntensity: 1.1 });
        lamp.castShadow = false;
        g.add(lamp);
      });
    } else if (a.backdrop === 'volcano') {
      // Roches basaltiques sombres, fissures de lave incandescentes et mares
      // de magma : le décor de la Caldeira de Braise.
      ring(9, 10, 19, function (x, z, r, ang) {
        const h = 3 + r * 6, w = 1.6 + r * 1.6;
        const rock = unitCone('#2b1a16', 6, true);
        rock.position.set(x, h / 2 - 0.3, z);
        rock.scale.set(w, h, w);
        rock.rotation.y = ang;
        g.add(rock);
        if (r > 0.45) {
          const crack = R3.box(0.5, 0.05, 0.05, '#ff6b3d', x, 0.04, z,
            { emissive: '#ff6b3d', emissiveIntensity: 1.4, rough: 0.5 });
          crack.rotation.y = ang;
          crack.castShadow = false;
          g.add(crack);
        }
      });
      ring(7, 6.5, 13, function (x, z, r) {
        const pool = R3.ellipsoid(0.8 + r, 0.10, 0.8 + r, '#ff6b3d', x, -0.18, z,
          { emissive: '#ff8c42', emissiveIntensity: 1.1, rough: 0.4 });
        pool.castShadow = false;
        g.add(pool);
      });
    } else if (a.backdrop === 'celestial') {
      // Colonnes de ruines flottantes à différentes hauteurs, couronnées
      // d'or : le Plateau d'Aurore, observatoire céleste.
      ring(10, 9, 18, function (x, z, r, ang) {
        const h = 3 + r * 5;
        const hover = r * 1.4;
        const pillar = R3.cyl(0.45 + r * 0.25, 0.55 + r * 0.25, h, '#cfc6ee', x, h / 2 + hover, z, { rough: 0.7 });
        pillar.rotation.y = ang;
        g.add(pillar);
        const cap = R3.cyl(0.62 + r * 0.25, 0.62 + r * 0.25, 0.18, '#ffe066', x, h + hover + 0.09, z,
          { emissive: '#ffe066', emissiveIntensity: 0.6, rough: 0.5 });
        cap.castShadow = false;
        g.add(cap);
      });
    }

    // Nuages très lointains, qui dérivent lentement
    cloudRing = new THREE.Group();
    const cn = R3.quality.particles ? 7 : 4;
    for (let i = 0; i < cn; i++) {
      const ang = (i / cn) * Math.PI * 2 + rnd();
      const r = 20 + rnd() * 12;
      const y = 8 + rnd() * 7;
      const c = new THREE.Group();
      c.position.set(Math.sin(ang) * r, y, Math.cos(ang) * r);
      const s = 1.4 + rnd() * 1.6;
      c.add(R3.ellipsoid(2.2 * s, 0.85 * s, 1.6 * s, '#ffffff', 0, 0, 0, { rough: 1 }));
      c.add(R3.ellipsoid(1.5 * s, 0.7 * s, 1.2 * s, '#f6fbff', 1.7 * s, 0.25 * s, 0.2 * s, { rough: 1 }));
      c.add(R3.ellipsoid(1.2 * s, 0.6 * s, 1.0 * s, '#eef7ff', -1.6 * s, 0.1 * s, -0.15 * s, { rough: 1 }));
      R3.noShadow(c);
      cloudRing.add(c);
    }
    g.add(cloudRing);

    return g;
  }

  /** Plateforme circulaire épaisse, décorée selon le biome. */
  function buildPlatform(kind, radius, height) {
    const g = new THREE.Group();
    const tops = { grass: '#63c24a', sand: '#efd7a0', stone: '#9aa4ad', snow: '#eef6fb' };
    const sides = { grass: '#8a6b46', sand: '#cfae72', stone: '#77818c', snow: '#c7d8e4' };
    const top = tops[kind] || tops.grass;
    const side = sides[kind] || sides.grass;

    // corps de la plateforme (bord en terre) + galette de surface
    const body = R3.cyl(radius, radius * 0.92, height, side, 0, height / 2, 0, { seg: 34, rough: 0.95 });
    body.castShadow = false;
    g.add(body);
    const cap = R3.cyl(radius * 1.005, radius * 1.005, height * 0.34, top, 0, height * 0.9, 0, { seg: 34, rough: 0.9 });
    cap.castShadow = false;
    g.add(cap);
    // liseré clair sur l'arête, ça « détoure » joliment la plateforme
    const rimColor = kind === 'grass' ? '#8ade63' : (kind === 'sand' ? '#fff0c8' : '#c3ccd4');
    const rim = R3.torus(radius, height * 0.09, rimColor, 0, height * 1.02, 0, { seg: 34, rough: 0.8 });
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = false;
    g.add(rim);

    // petits détails posés sur le pourtour
    const rnd = R3.rng(radius * 1000 + kind.length);
    const n = R3.quality.particles ? 14 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
      const r = radius * (0.62 + rnd() * 0.3);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      let d = null;
      if (kind === 'grass') {
        const hh = 0.28 + rnd() * 0.2;
        d = unitCone(rnd() > 0.5 ? '#4f9e3f' : '#5fb548', 5);
        d.position.set(x, height + hh * 0.5, z);
        d.scale.set(0.07, hh, 0.07);
        d.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4);
        if (rnd() > 0.72) {
          const f = R3.sphere(0.07, rnd() > 0.5 ? '#ff8fb8' : '#ffe27a', x, height + 0.24, z);
          f.castShadow = false;
          g.add(f);
        }
      } else if (kind === 'sand') {
        if (rnd() > 0.6) {
          d = R3.ellipsoid(0.11, 0.05, 0.13, '#ffd7e2', x, height + 0.03, z, { rough: 0.6 });
          d.rotation.y = rnd() * 3;
        }
      } else if (kind === 'stone') {
        d = R3.ellipsoid(0.1 + rnd() * 0.1, 0.07 + rnd() * 0.07, 0.1 + rnd() * 0.1, '#828d97',
          x, height + 0.05, z, { flat: true });
        d.rotation.set(rnd(), rnd() * 3, rnd());
      } else {
        d = R3.ellipsoid(0.13 + rnd() * 0.1, 0.06, 0.13 + rnd() * 0.1, '#ffffff', x, height + 0.02, z, { rough: 1 });
      }
      if (d) g.add(d);
    }
    return g;
  }

  /** Ombre de contact : un disque sombre translucide sous la créature.
   *  Indispensable en qualité basse (pas de shadow map) pour « poser » le modèle. */
  function contactBlob(radius) {
    const m = new THREE.Mesh(R3.geo.plane(1, 1), fxMat('#1a1c2c', false, 0.28));
    m.material.blending = THREE.NormalBlending;
    m.rotation.x = -Math.PI / 2;
    m.scale.set(radius * 2, radius * 2, 1);
    m.renderOrder = 1;
    return m;
  }

  // ---------------------------------------------------------------------------
  //  LA POKÉBALL — vrai modèle 3D : deux demi-sphères, une bande noire,
  //  un bouton central. Les deux moitiés sont montées sur charnière pour
  //  pouvoir s'ouvrir quand la créature s'échappe.
  // ---------------------------------------------------------------------------
  function buildPokeball() {
    const half = ownGeo('pb-half', function () {
      return new THREE.SphereGeometry(BALL_R, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    });

    const g = new THREE.Group();

    const hingeTop = new THREE.Group();
    hingeTop.position.set(0, 0, -BALL_R * 0.86);
    const topHalf = new THREE.Mesh(half, R3.mat('#e5402f', { rough: 0.3, metal: 0.08 }));
    topHalf.position.set(0, 0, BALL_R * 0.86);
    topHalf.castShadow = true;
    hingeTop.add(topHalf);

    const hingeBot = new THREE.Group();
    hingeBot.position.set(0, 0, -BALL_R * 0.86);
    const botHalf = new THREE.Mesh(half, R3.mat('#f2f4f7', { rough: 0.3, metal: 0.08 }));
    botHalf.rotation.x = Math.PI;
    botHalf.position.set(0, 0, BALL_R * 0.86);
    botHalf.castShadow = true;
    hingeBot.add(botHalf);

    // bande noire à l'équateur (portée par la moitié basse)
    const band = R3.cyl(BALL_R * 1.012, BALL_R * 1.012, BALL_R * 0.16, '#23252f',
      0, 0, BALL_R * 0.86, { seg: 22, rough: 0.5 });
    band.castShadow = false;
    hingeBot.add(band);

    // bouton : anneau noir + pastille claire, tournés vers +z
    const btn = new THREE.Group();
    btn.position.set(0, 0, BALL_R * 0.86 + BALL_R * 0.93);
    const ringGeo = ownGeo('pb-ring', function () {
      return new THREE.TorusGeometry(BALL_R * 0.32, BALL_R * 0.09, 8, 18);
    });
    const ring = new THREE.Mesh(ringGeo, R3.mat('#23252f', { rough: 0.5 }));
    ring.castShadow = false;
    btn.add(ring);
    const lens = R3.cyl(BALL_R * 0.26, BALL_R * 0.26, BALL_R * 0.10, '#f7f9fb', 0, 0, 0.02, { seg: 16, rough: 0.25 });
    lens.rotation.x = Math.PI / 2;
    lens.castShadow = false;
    btn.add(lens);
    hingeBot.add(btn);

    g.add(hingeTop, hingeBot);
    g.userData.hingeTop = hingeTop;
    g.userData.hingeBot = hingeBot;
    g.userData.lens = lens;
    g.userData.matDim = R3.mat('#f7f9fb', { rough: 0.25 });
    g.userData.matLit = R3.mat('#fff3c8', { emissive: '#ffcf3f', emissiveIntensity: 1.8, rough: 0.3 });
    lens.material = g.userData.matDim;
    return g;
  }

  function setBallOpen(ballObj, p) {
    if (!ballObj) return;
    ballObj.userData.hingeTop.rotation.x = -p * 1.55;
    ballObj.userData.hingeBot.rotation.x = p * 0.28;
  }

  function setBallLit(ballObj, on) {
    if (!ballObj) return;
    ballObj.userData.lens.material = on ? ballObj.userData.matLit : ballObj.userData.matDim;
  }

  // ===========================================================================
  //  PETITS EFFETS RÉUTILISABLES — les briques dans lesquelles les 18 effets
  //  de capacité (plus bas) puisent.
  // ===========================================================================

  const FX_MAX = 60;

  function spawnFx(e) {
    // Garde-fou anti-avalanche : au-delà de FX_MAX effets vivants, on retire
    // les plus anciens. Une explosion en compte une dizaine ; dépasser 60
    // signifie qu'un enchaînement inattendu s'emballe.
    while (fxList.length >= FX_MAX) {
      const vieux = fxList.shift();
      if (vieux && !vieux.mort) { vieux.mort = true; killFx(vieux, true); }
    }
    e.age = 0;
    // `delay` : l'effet existe mais reste invisible et figé le temps voulu.
    // Indispensable pour mettre en scène en trois actes (charge → frappe →
    // explosion) sans dépendre de setTimeout, qui ignorerait l'arrêt sur image.
    if (e.delay > 0 && e.group) e.group.visible = false;
    if (e.group) scene.add(e.group);
    fxList.push(e);
    return e;
  }

  /**
   * @param {boolean} [avorte] true = l'effet est interrompu (fin de combat,
   *        garde-fou anti-avalanche) : on nettoie, mais on n'enchaîne PAS sur
   *        la suite (onEnd), sinon on rallume des effets dans une scène qui
   *        disparaît. onKill, lui, est toujours appelé : c'est le ménage
   *        (retirer un voile accroché à la caméra, par exemple).
   */
  function killFx(e, avorte) {
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
    if (e.mats) e.mats.forEach(function (m) { m.dispose(); });
    if (e.onKill) e.onKill();
    // Les géométries CRÉÉES pour l'effet (tubes d'éclair, lames…) doivent être
    // libérées ici : contrairement à celles de R3/ownGeo, elles ne resservent pas.
    if (e.geos) e.geos.forEach(function (g) { if (g && g.dispose) g.dispose(); });
    if (e.onEnd && !avorte) e.onEnd();
  }

  function retirerFx(e) {
    const i = fxList.indexOf(e);
    if (i >= 0) fxList.splice(i, 1);
  }

  // On parcourt un INSTANTANÉ de la liste : la fin d'un effet peut en créer
  // d'autres (mise en scène en trois actes) et le garde-fou peut en supprimer.
  // Boucler sur des index vivants faisait alors sauter un effet de la liste
  // sans jamais retirer son groupe de la scène — une fuite silencieuse.
  const _fxSnap = [];

  function updateFx(dts) {
    _fxSnap.length = 0;
    for (let i = 0; i < fxList.length; i++) _fxSnap.push(fxList[i]);
    for (let i = 0; i < _fxSnap.length; i++) {
      const e = _fxSnap[i];
      if (e.mort) continue;
      if (e.delay > 0) {
        e.delay -= dts;
        if (e.delay > 0) continue;
        if (e.group) e.group.visible = true;
      }
      e.age += dts;
      const p = e.age / e.life;
      if (p >= 1) { e.mort = true; retirerFx(e); killFx(e); continue; }
      if (e.update) e.update(p, e);
    }
  }

  /**
   * Minuterie du combat : rappelle `fn` dans `delai` secondes de TEMPS DE JEU.
   * On n'utilise jamais `setTimeout` ici — il continuerait à tourner pendant un
   * arrêt sur image, une pause ou un changement d'écran, et ferait exploser des
   * effets dans une scène déjà détruite.
   */
  function setTimeoutFx(delai, fn) {
    spawnFx({ group: null, mats: null, life: Math.max(0.001, delai), onEnd: fn });
  }

  function clearFx() {
    while (fxList.length) {
      const e = fxList.pop();
      if (e && !e.mort) { e.mort = true; killFx(e, true); }
    }
  }

  /** Gerbe d'étoiles dorées (capture réussie / victoire / créature qui jaillit). */
  function fxStars(pos, n) {
    n = qCount(n || 16);
    const m = fxMat('#ffd75e', false, 1);
    const m2 = fxMat('#fff3c8', true, 1);
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const up = 1.4 + Math.random() * 2.6;
      const sp = 1.1 + Math.random() * 2.0;
      // taille de géométrie FIXE (cache), variété obtenue par l'échelle du mesh
      const s = R3.star(5, 0.12, 0.05, 0.04, '#ffd75e', 0, 0, 0);
      s.material = (i % 3 === 0) ? m2 : m;
      s.castShadow = false;
      s.scale.setScalar(0.75 + Math.random() * 0.6);
      s.position.copy(pos);
      g.add(s);
      parts.push({
        mesh: s,
        v: new THREE.Vector3(Math.sin(a) * sp, up, Math.cos(a) * sp),
        spin: (Math.random() - 0.5) * 14,
        p0: pos.clone(),
      });
    }
    spawnFx({
      group: g, mats: [m, m2], life: 1.35,
      update: function (p) {
        const t = p * 1.35;
        parts.forEach(function (q) {
          q.mesh.position.set(
            q.p0.x + q.v.x * t,
            q.p0.y + q.v.y * t - 3.2 * t * t,
            q.p0.z + q.v.z * t
          );
          q.mesh.rotation.z += q.spin * 0.016;
          q.mesh.rotation.y += q.spin * 0.010;
        });
        const f = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
        m.opacity = f; m2.opacity = f;
      },
    });
  }

  /** Étincelles : des braises lumineuses (un seul sprite additif chacune, donc
   *  bon marché) qui s'étirent dans le sens de leur vitesse — c'est cette
   *  traînée qui les fait « filer » au lieu de flotter. */
  function fxSparks(pos, n, color, spread) {
    n = qCount(n || 10);
    const col = color || '#fff0c8';
    const halo = new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(col), transparent: true,
      opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const g = new THREE.Group();
    const parts = [];
    const sp = spread || 1.6;
    for (let i = 0; i < n; i++) {
      const q = new THREE.Sprite(halo);
      q.position.copy(pos);
      const taille = 0.22 + Math.random() * 0.22;
      q.scale.set(taille, taille, 1);
      g.add(q);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      parts.push({
        halo: q, t0: taille, p0: pos.clone(),
        v: new THREE.Vector3(Math.cos(b) * Math.sin(a), Math.sin(b) * 0.8 + 0.6, Math.cos(b) * Math.cos(a))
          .multiplyScalar(sp * (0.5 + Math.random())),
      });
    }
    spawnFx({
      group: g, mats: [halo], life: 0.62,
      update: function (p) {
        const t = p * 0.62;
        parts.forEach(function (q) {
          q.halo.position.set(
            q.p0.x + q.v.x * t,
            q.p0.y + q.v.y * t - 1.6 * t * t,
            q.p0.z + q.v.z * t
          );
          const vit = 1 + Math.min(1.7, q.v.length() * (1 - p) * 0.25);
          q.halo.scale.set(q.t0 * (1 - p * 0.45), q.t0 * vit * (1 - p * 0.45), 1);
        });
        halo.opacity = (1 - p) * (1 - p * 0.4);
      },
    });
  }

  /** Nuage de fumée (la créature qui ressort de la ball, un rocher qui s'écrase…). */
  function fxSmoke(pos, n) {
    n = qCount(n || 12);
    const m = fxMat('#eef2f6', false, 0.85);
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(R3.geo.sphere(1, 8), m);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.35;
      s.position.set(pos.x + Math.sin(a) * r, pos.y + Math.random() * 0.3, pos.z + Math.cos(a) * r);
      s.castShadow = false;
      g.add(s);
      parts.push({ mesh: s, a: a, s0: 0.12 + Math.random() * 0.14, up: 0.5 + Math.random() * 0.7 });
    }
    spawnFx({
      group: g, mats: [m], life: 1.0,
      update: function (p) {
        parts.forEach(function (q) {
          q.mesh.scale.setScalar(q.s0 * (1 + p * 4));
          q.mesh.position.x += Math.sin(q.a) * 0.008;
          q.mesh.position.z += Math.cos(q.a) * 0.008;
          q.mesh.position.y += q.up * 0.012;
        });
        m.opacity = 0.85 * (1 - p) * (1 - p);
      },
    });
  }

  /** Anneau de choc qui s'élargit au sol (par défaut) ou face à la caméra (flat=false). */
  function fxRing(pos, color, rMax, flat) {
    const m = fxMat(color || '#ffffff', true, 0.9);
    const geo = ownGeo('fx-ring', function () { return new THREE.TorusGeometry(1, 0.06, 8, 30); });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(pos);
    if (flat !== false) mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    const g = new THREE.Group();
    g.add(mesh);
    spawnFx({
      group: g, mats: [m], life: 0.55,
      update: function (p) {
        const s = 0.12 + R3.easeOut(p) * (rMax || 1.6);
        mesh.scale.set(s, s, s * 0.6);
        m.opacity = 0.9 * (1 - p);
      },
    });
  }

  /** Tourbillon d'aspiration : la créature est happée vers la pokéball. */
  function fxSuction(from, to) {
    const m = fxMat('#ffd9a0', true, 0.95);
    const g = new THREE.Group();
    const n = qCount(24);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(R3.geo.sphere(1, 8), m);
      s.castShadow = false;
      g.add(s);
      parts.push({
        mesh: s,
        a0: Math.random() * Math.PI * 2,
        r0: 0.35 + Math.random() * 0.55,
        y0: from.y - 0.1 + Math.random() * 1.1,
        sp: 0.045 + Math.random() * 0.05,
      });
    }
    // faisceau lumineux de la ball vers la créature
    const beamMat = fxMat('#ffe9b8', true, 0.55);
    const beam = new THREE.Mesh(R3.geo.cone(0.42, 1.0, 14), beamMat);
    beam.castShadow = false;
    g.add(beam);

    spawnFx({
      group: g, mats: [m, beamMat], life: 0.6,
      update: function (p) {
        parts.forEach(function (q) {
          const r = q.r0 * (1 - p) * (1 - p * 0.3);
          const a = q.a0 + p * 9;
          q.mesh.position.set(
            to.x + Math.sin(a) * r,
            R3.lerp(q.y0, to.y, p * p),
            to.z + Math.cos(a) * r
          );
          q.mesh.scale.setScalar(q.sp * (1 - p * 0.6));
        });
        m.opacity = 0.95 * (1 - p * p);
        const h = R3.lerp(1.25, 0.15, p);
        beam.position.set(to.x, to.y + h / 2, to.z);
        beam.scale.set(1 - p * 0.55, h, 1 - p * 0.55);
        beamMat.opacity = 0.55 * (1 - p);
      },
    });
  }

  /** Halo lumineux qui enfle puis s'éteint — la brique de base du spectacle. */
  function fxGlow(pos, color, size, life, opacity) {
    const s = glowSprite(color || '#ffffff', size || 2, opacity === undefined ? 1 : opacity);
    s.position.copy(pos);
    const g = new THREE.Group();
    g.add(s);
    const o0 = (opacity === undefined) ? 1 : opacity;
    spawnFx({
      group: g, mats: [s.material], life: life || 0.35,
      update: function (p) {
        const k = 0.35 + R3.easeOut(p) * 1.05;
        s.scale.set((size || 2) * k, (size || 2) * k, 1);
        s.material.opacity = o0 * (1 - p) * (1 - p);
      },
    });
  }

  /** Rayons de lumière radiaux, toujours face caméra : la signature « anime »
   *  d'un coup puissant. */
  function fxRays(pos, color, n, len) {
    n = Math.max(5, Math.round(qCount(n || 7) * 0.5));
    const m = fxMat(color || '#ffffff', true, 0.9);
    const geo = ownGeo('fx-ray', function () { return new THREE.PlaneGeometry(0.06, 1); });
    const g = new THREE.Group();
    g.position.copy(pos);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, m);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      mesh.rotation.z = -a;
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({ mesh: mesh, a: a, l: (len || 1.6) * (0.6 + Math.random() * 0.8) });
    }
    spawnFx({
      group: g, mats: [m], life: 0.34,
      update: function (p) {
        if (camera) g.quaternion.copy(camera.quaternion);   // billboard
        const e = R3.easeOut(p);
        parts.forEach(function (q) {
          const L = q.l * (0.25 + e * 1.0);
          q.mesh.scale.set(1 - p * 0.6, L, 1);
          q.mesh.position.set(Math.sin(q.a) * L * 0.5, Math.cos(q.a) * L * 0.5, 0);
        });
        m.opacity = 0.9 * (1 - p) * (1 - p);
      },
    });
  }

  /** Éclats projetés par le choc : petits fragments qui retombent en tournant. */
  function fxDebris(pos, color, n) {
    n = qCount(n || 9);
    const m = fxMat(color || '#ffffff', false, 1);
    const geo = ownGeo('fx-shard', function () { return new THREE.TetrahedronGeometry(0.11, 0); });
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.copy(pos);
      mesh.castShadow = false;
      mesh.scale.setScalar(0.5 + Math.random() * 0.9);
      g.add(mesh);
      const a = Math.random() * Math.PI * 2, b = Math.random() * 0.9;
      parts.push({
        mesh: mesh,
        v: new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b) + 0.55, Math.cos(a) * Math.cos(b))
          .multiplyScalar(2.0 + Math.random() * 2.2),
        sx: (Math.random() - 0.5) * 22, sy: (Math.random() - 0.5) * 22,
      });
    }
    spawnFx({
      group: g, mats: [m], life: 0.75,
      update: function (p) {
        const t = p * 0.75;
        parts.forEach(function (q) {
          q.mesh.position.set(pos.x + q.v.x * t, pos.y + q.v.y * t - 4.6 * t * t, pos.z + q.v.z * t);
          q.mesh.rotation.x += q.sx * 0.016;
          q.mesh.rotation.y += q.sy * 0.016;
        });
        m.opacity = 1 - p * p;
      },
    });
  }

  /** Dôme de choc : la bulle d'énergie qui se propage au point d'impact. */
  function fxShockDome(pos, color, rMax) {
    const m = fxMat(color || '#ffffff', true, 0.5);
    const geo = ownGeo('fx-dome', function () { return new THREE.SphereGeometry(1, 18, 10); });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(pos);
    mesh.castShadow = false;
    const g = new THREE.Group();
    g.add(mesh);
    spawnFx({
      group: g, mats: [m], life: 0.42,
      update: function (p) {
        const s = 0.15 + R3.easeOut(p) * (rMax || 1.9);
        mesh.scale.set(s, s * 0.78, s);
        m.opacity = 0.5 * (1 - p) * (1 - p);
      },
    });
  }

  /**
   * Éclat d'impact — la « confirmation de coup » commune aux 18 effets.
   * Version spectacle : cœur blanc incandescent, halo teinté, deux anneaux de
   * choc, dôme d'énergie, rayons, éclats, étincelles, voile d'écran teinté,
   * secousse de caméra, arrêt sur image et coup de zoom.
   * @param {number} [force] 1 = coup normal ; 1,4 = coup super efficace.
   */
  function fxImpact(pos, color, force) {
    const f = force || fxForce || 1;
    const col = color || '#fff0c8';

    // Coup RATÉ : pas de gerbe d'impact, juste un souffle qui passe à côté —
    // sinon l'écran explose alors que le message annonce « Raté… ».
    if (f <= 0.5) {
      fxGlow(pos, col, 1.5, 0.28, 0.45);
      camShake = Math.max(camShake, 0.06);
      return;
    }

    // Tout le spectacle est dans fxExplosion() : fxImpact n'est plus qu'un
    // raccourci, pour que les rares appels qui ne passent pas par une capacité
    // (projectile générique, effets de secours) aient le même rendu.
    fxExplosion(pos, col, 0.85 * f);
  }

  /** Spirale de particules montantes + croix blanche : un soin a été utilisé.
   *  La croix reste blanche (lisible sur toutes les couleurs) ; la spirale,
   *  elle, prend la couleur du type de la capacité. */
  function fxHeal(pos, height, color) {
    const col = color || '#7ef0a0';
    const m = fxMat(col, true, 1);
    const g = new THREE.Group();
    const n = qCount(20);
    const h = height || 1.6;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(R3.geo.sphere(1, 8), m);
      s.castShadow = false;
      g.add(s);
      parts.push({ mesh: s, a0: (i / n) * Math.PI * 4, off: i / n, r: 0.42 + (i % 3) * 0.12 });
    }
    const crossMat = fxMat('#ffffff', true, 1);
    const cross = new THREE.Group();
    cross.add(new THREE.Mesh(R3.geo.box(0.34, 0.11, 0.02), crossMat));
    cross.add(new THREE.Mesh(R3.geo.box(0.11, 0.34, 0.02), crossMat));
    R3.noShadow(cross);
    g.add(cross);

    spawnFx({
      group: g, mats: [m, crossMat], life: 1.25,
      update: function (p) {
        parts.forEach(function (q) {
          const u = (p * 1.4 + q.off) % 1;
          const a = q.a0 + u * 6.5;
          q.mesh.position.set(pos.x + Math.sin(a) * q.r, pos.y + u * h, pos.z + Math.cos(a) * q.r);
          q.mesh.scale.setScalar(0.05 * (1 - u * 0.5));
        });
        m.opacity = p < 0.75 ? 1 : (1 - p) / 0.25;
        cross.position.set(pos.x, pos.y + h * 0.55 + p * 0.5, pos.z + 0.35);
        cross.scale.setScalar(0.7 + R3.easeOut(Math.min(1, p * 3)) * 0.6);
        crossMat.opacity = 1 - p;
      },
    });
  }

  /** Éclair de lumière plein écran (capture réussie, victoire). */
  function fxFlash(color, life, strength) {
    if (!camera) return;
    const m = fxMat(color || '#ffffff', true, strength || 0.85);
    const quad = new THREE.Mesh(R3.geo.plane(1, 1), m);
    quad.position.set(0, 0, -0.5);
    const hh = Math.tan((camera.fov * Math.PI / 180) / 2) * 0.5 * 2.2;
    quad.scale.set(hh * camera.aspect * 2.4, hh * 2.4, 1);
    quad.renderOrder = 999;
    camera.add(quad);
    spawnFx({
      group: null, mats: [m], life: life || 0.45,
      update: function (p) { m.opacity = (strength || 0.85) * (1 - R3.easeOut(p)); },
      onKill: function () { if (quad.parent) quad.parent.remove(quad); },
    });
  }

  // ===========================================================================
  //  LES EFFETS DE CAPACITÉ — VERSION SPECTACLE
  // ---------------------------------------------------------------------------
  //  Demande de Robin : « des attaques spectaculaires, de la vraie 3D ».
  //  Chaque capacité se joue donc en TROIS ACTES, comme dans un dessin animé :
  //
  //     1. LA CHARGE   — l'énergie s'accumule sur l'attaquant (particules qui
  //                      convergent, orbe qui grossit, anneaux qui montent) ;
  //     2. LA FRAPPE   — quelque chose de VOLUMIQUE traverse l'arène : colonne
  //                      de feu, éclair en tube 3D, mur d'eau, blocs de pierre,
  //                      lames géantes… avec sa traînée et sa lumière ;
  //     3. L'EXPLOSION — `fxExplosion()`, commune à tous : flash, boule de feu
  //                      volumétrique, double onde de choc, éclats 3D, rayons,
  //                      fumée qui monte, braises, trace au sol, secousse,
  //                      arrêt sur image et coup de zoom.
  //
  //  `origin` = position de l'attaquant, `target` = position de la cible,
  //  `color` = couleur du type de la capacité. Tout est mis à l'échelle par
  //  `fxForce` (raté 0,45 → super efficace + critique ≈ 1,8).
  // ===========================================================================

  // --- Textures dessinées au canvas (aucun fichier : le jeu doit rester
  //     jouable par simple double-clic) ---------------------------------------

  function makeTex(dessin, taille) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = taille || 128;
    dessin(cv.getContext('2d'), cv.width);
    const t = new THREE.CanvasTexture(cv);
    if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  let _flameTex = null, _smokeTex = null, _ringTex = null;

  /** Boule de feu : cœur blanc, corps saturé, bords déchiquetés. */
  function flameTexture() {
    if (_flameTex) return _flameTex;
    _flameTex = makeTex(function (c, S) {
      const h = S / 2;
      const g = c.createRadialGradient(h, h, 0, h, h, h);
      // Volontairement PEU opaque : en fondu additif, une dizaine de sprites
      // qui se recouvrent saturent tout de suite en blanc et la couleur du
      // type disparaît. Mieux vaut un dégradé discret, très étalé.
      g.addColorStop(0.00, 'rgba(255,255,255,0.80)');
      g.addColorStop(0.20, 'rgba(255,246,222,0.52)');
      g.addColorStop(0.48, 'rgba(255,255,255,0.26)');
      g.addColorStop(0.78, 'rgba(255,255,255,0.07)');
      g.addColorStop(1.00, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
      // langues de flamme : quelques pointes claires vers l'extérieur
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        const r = h * (0.45 + (i % 3) * 0.16);
        const gg = c.createRadialGradient(h + Math.cos(a) * r, h + Math.sin(a) * r, 0,
          h + Math.cos(a) * r, h + Math.sin(a) * r, h * 0.30);
        gg.addColorStop(0, 'rgba(255,255,255,0.22)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg;
        c.fillRect(0, 0, S, S);
      }
    }, 128);
    return _flameTex;
  }

  /** Fumée : gros flocon mou et irrégulier. */
  function smokeTexture() {
    if (_smokeTex) return _smokeTex;
    _smokeTex = makeTex(function (c, S) {
      const h = S / 2;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = (i === 0) ? 0 : h * 0.36;
        const x = h + Math.cos(a) * r, y = h + Math.sin(a) * r;
        const rad = h * (i === 0 ? 0.62 : 0.42);
        const g = c.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0.0, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
        g.addColorStop(1.0, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, S, S);
      }
    }, 128);
    return _smokeTex;
  }

  /** Anneau de choc plein écran (sprite accroché à la caméra). */
  function ringTexture() {
    if (_ringTex) return _ringTex;
    _ringTex = makeTex(function (c, S) {
      const h = S / 2;
      const g = c.createRadialGradient(h, h, h * 0.62, h, h, h * 0.99);
      g.addColorStop(0.00, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
      g.addColorStop(1.00, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(h, h, h, 0, Math.PI * 2);
      c.fill();
    }, 256);
    return _ringTex;
  }

  /** Matériau de sprite jetable (libéré avec l'effet). */
  function sprMat(tex, color, opacity, additive) {
    return new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(color || '#ffffff'),
      transparent: true,
      opacity: (opacity === undefined) ? 1 : opacity,
      depthWrite: false,
      blending: (additive === false) ? THREE.NormalBlending : THREE.AdditiveBlending,
      fog: false,
    });
  }

  /** Point de lumière qui accompagne un effet (une seule à la fois). */
  function setPunch(pos, color, intensity) {
    if (!punchLight) return;
    punchLight.position.copy(pos);
    punchLight.color.set(color || '#fff0c8');
    punchLight.intensity = Math.max(punchLight.intensity, intensity);
  }

  // ---------------------------------------------------------------------------
  //  NUAGE VOLUMÉTRIQUE — la brique du feu, de la fumée, de la poussière et des
  //  boules de feu. Des dizaines de sprites qui se dispersent, tournent et
  //  grossissent : de loin, ça se lit comme un volume, pas comme des pastilles.
  // ---------------------------------------------------------------------------
  function fxCloud(pos, o) {
    o = o || {};
    const n = qCount(o.n || 14);
    const tex = o.tex || flameTexture();
    const m = sprMat(tex, o.color || '#ffffff', o.opacity === undefined ? 1 : o.opacity, o.additive !== false);
    const g = new THREE.Group();
    const parts = [];
    const spread = (o.spread === undefined) ? 1.2 : o.spread;
    const size = o.size || 1;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const v = new THREE.Vector3(Math.cos(b) * Math.cos(a), Math.sin(b) * 0.7 + (o.rise || 0), Math.cos(b) * Math.sin(a))
        .multiplyScalar(spread * (0.35 + Math.random()));
      if (o.vel) v.add(o.vel);
      const s0 = size * (0.55 + Math.random() * 0.9);
      s.position.copy(pos);
      s.scale.set(s0, s0, 1);
      s.material.rotation = Math.random() * Math.PI * 2;
      g.add(s);
      parts.push({ s: s, v: v, s0: s0, d: (Math.random() - 0.5) * 2.4, ph: Math.random() * 6.28 });
    }
    const life = o.life || 0.9;
    const grav = (o.gravity === undefined) ? 0 : o.gravity;
    const grow = (o.grow === undefined) ? 1.5 : o.grow;
    const op0 = (o.opacity === undefined) ? 1 : o.opacity;
    spawnFx({
      group: g, mats: [m], life: life, delay: o.delay || 0,
      update: function (p) {
        const t = p * life;
        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          q.s.position.set(
            pos.x + q.v.x * t + Math.sin(q.ph + t * 3) * 0.06,
            pos.y + q.v.y * t - grav * t * t,
            pos.z + q.v.z * t + Math.cos(q.ph + t * 3) * 0.06
          );
          const k = q.s0 * (1 + p * grow);
          q.s.scale.set(k, k, 1);
          q.s.material.rotation += q.d * 0.012;
        }
        m.opacity = op0 * (o.fadeIn && p < 0.15 ? p / 0.15 : (1 - p) * (1 - p * 0.4));
      },
    });
    return m;
  }

  // ---------------------------------------------------------------------------
  //  L'EXPLOSION — le clou du spectacle, commune à toutes les capacités.
  // ---------------------------------------------------------------------------
  function fxExplosion(pos, color, scale, o) {
    o = o || {};
    const col = color || '#fff0c8';

    // Ce qui coûte cher dans une explosion, ce n'est pas le nombre d'objets
    // mais la SURFACE d'écran repeinte (des dizaines de sprites translucides
    // superposés). On réduit donc la taille — pas seulement le nombre — dès
    // que la qualité descend, et on coupe les fioritures plein écran.
    const riche = R3.quality.particles !== false;
    const moyen = R3.quality.level === 'medium';
    const S = (scale || 1) * (riche ? (moyen ? 0.85 : 1) : 0.7);

    // 1. Flash blanc : très gros, très court. C'est lui qui « claque ».
    const flashM = sprMat(flameTexture(), '#ffffff', 1, true);
    const flash = new THREE.Sprite(flashM);
    flash.position.copy(pos);
    const gF = new THREE.Group(); gF.add(flash);
    spawnFx({
      group: gF, mats: [flashM], life: 0.18,
      update: function (p) {
        const k = (1.2 + R3.easeOut(p) * 3.0) * S;
        flash.scale.set(k, k, 1);
        flashM.opacity = 0.8 * (1 - p) * (1 - p);
      },
    });

    // 2. Noyau plein : une sphère qui enfle et se teinte.
    const coreM = fxMat('#ffffff', true, 1);
    const core = new THREE.Mesh(R3.geo.sphere(1, 16), coreM);
    core.position.copy(pos);
    core.castShadow = false;
    const gC = new THREE.Group(); gC.add(core);
    spawnFx({
      group: gC, mats: [coreM], life: 0.34,
      update: function (p) {
        core.scale.setScalar((0.25 + R3.easeOut(p) * 1.5) * S);
        coreM.color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color(col), Math.min(1, p * 2.2));
        coreM.opacity = (1 - p) * (1 - p);
      },
    });

    // 3. La boule de feu, en DEUX COUCHES.
    //    Le corps est en fondu NORMAL : sur le ciel très clair d'une arène, le
    //    fondu additif vire immédiatement au blanc et la couleur du type
    //    disparaît. Seul le cœur, plus petit, reste additif — c'est lui qui
    //    donne l'incandescence sans laver l'image.
    fxCloud(pos, {
      n: o.fireballs || 16, tex: flameTexture(), color: col, size: 1.0 * S,
      spread: 2.6 * S, rise: 0.55, life: 0.70, grow: 1.1, opacity: 0.92,
      additive: false,
    });
    if (riche) {
      fxCloud(pos, {
        n: 7, tex: flameTexture(),
        color: o.heart || '#fff0c0', size: 0.75 * S,
        spread: 1.4 * S, rise: 0.4, life: 0.44, grow: 1.0, opacity: 0.75,
      });
    }

    // 4. Deux ondes de choc : une au sol qui court loin, une verticale.
    fxRing(new THREE.Vector3(pos.x, 0.06, pos.z), col, 4.6 * S, true);
    fxRing(pos, '#ffffff', 2.0 * S, false);
    fxShockDome(pos, col, 2.6 * S);

    // 5. Éclats 3D et braises.
    fxDebris(pos, col, o.debris === undefined ? 12 : o.debris);
    fxSparks(pos, 16, col, 3.4 * S);
    fxRays(pos, col, 10, 2.4 * S);

    // 6. La fumée monte APRÈS le feu — c'est ce décalage qui donne le volume.
    if (riche) fxCloud(pos, {
      n: 8, tex: smokeTexture(), color: o.smoke || '#d8d3cc', size: 1.1 * S,
      spread: 1.0 * S, rise: 1.5, life: 1.35, grow: 1.6, opacity: 0.5,
      additive: false, delay: 0.10, fadeIn: true,
    });

    // 7. La trace au sol : un disque sombre qui s'efface.
    if (o.scorch !== false) {
      const scM = fxMat('#000000', false, 0.34);
      scM.blending = THREE.NormalBlending;
      const sc = new THREE.Mesh(R3.geo.cyl(1, 1, 0.02, 20), scM);
      sc.position.set(pos.x, 0.045, pos.z);
      sc.castShadow = false;
      const gS = new THREE.Group(); gS.add(sc);
      spawnFx({
        group: gS, mats: [scM], life: 1.6,
        update: function (p) {
          const k = (0.9 + R3.easeOut(Math.min(1, p * 4)) * 0.9) * S;
          sc.scale.set(k, 1, k);
          scM.opacity = 0.34 * (1 - p);
        },
      });
    }

    // 8. L'onde de choc PLEIN ÉCRAN, accrochée à la caméra (qualité haute).
    if (riche && !moyen) fxScreenRing(col, 0.5 + 0.5 * S);

    // 9. Le ressenti.
    setPunch(pos, col, 7.5 * S);
    camShake = Math.max(camShake, 0.34 * S);
    hitStop = Math.max(hitStop, 0.075 * S);
    zoomPunch = Math.max(zoomPunch, 1.25 * S);
    fxFlash(col, 0.26, 0.16 * S);
  }

  /** Anneau de choc en surimpression, accroché à la caméra : très « cinéma ». */
  function fxScreenRing(color, force) {
    if (!camera) return;
    const m = sprMat(ringTexture(), color || '#ffffff', 0.8, true);
    const s = new THREE.Sprite(m);
    s.position.set(0, 0, -2.2);
    s.renderOrder = 998;
    camera.add(s);
    spawnFx({
      group: null, mats: [m], life: 0.42,
      update: function (p) {
        const k = (0.25 + R3.easeOut(p) * 4.6) * (force || 1);
        s.scale.set(k, k, 1);
        m.opacity = 0.8 * (1 - p) * (1 - p);
      },
      onKill: function () { if (s.parent) s.parent.remove(s); },
    });
  }

  // ---------------------------------------------------------------------------
  //  CHARGE — l'énergie s'accumule avant le tir. C'est ce temps d'attente qui
  //  rend la frappe impressionnante.
  // ---------------------------------------------------------------------------
  function fxCharge(pos, color, duree, taille) {
    const dur = duree || 0.30;
    const T = taille || 1;
    const m = sprMat(glowTexture(), color, 0.95, true);
    const orbe = new THREE.Sprite(m);
    orbe.position.copy(pos);
    const g = new THREE.Group();
    g.add(orbe);

    // particules qui convergent vers l'orbe
    const n = qCount(12);
    const pm = sprMat(glowTexture(), color, 0.9, true);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(pm);
      const k = 0.16 + Math.random() * 0.12;
      s.scale.set(k, k, 1);
      g.add(s);
      parts.push({ s: s, a: Math.random() * 6.28, b: (Math.random() - 0.5) * 2, r: 1.4 + Math.random() * 1.5, off: Math.random() * 0.4 });
    }
    // anneau qui se resserre
    const rm = fxMat(color, true, 0.7);
    const anneau = new THREE.Mesh(ownGeo('fx-ring', function () { return new THREE.TorusGeometry(1, 0.06, 8, 30); }), rm);
    anneau.position.copy(pos);
    anneau.rotation.x = -Math.PI / 2;
    anneau.castShadow = false;
    g.add(anneau);

    spawnFx({
      group: g, mats: [m, pm, rm], life: dur,
      update: function (p) {
        const k = (0.5 + R3.easeOut(p) * 1.5) * T;
        orbe.scale.set(k, k, 1);
        m.opacity = 0.55 + p * 0.45;
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / (1 - q.off));
          const r = q.r * (1 - u) * T;
          const a = q.a + u * 7;
          q.s.position.set(pos.x + Math.cos(a) * r, pos.y + q.b * (1 - u) * T, pos.z + Math.sin(a) * r);
          q.s.material.opacity = 0.9 * (1 - u * 0.4);
        });
        const ra = (2.4 - p * 1.9) * T;
        anneau.scale.set(ra, ra, ra);
        anneau.rotation.z += 0.06;
        rm.opacity = 0.7 * (1 - p * 0.5);
      },
    });
    setPunch(pos, color, 2.6);
  }

  // ---------------------------------------------------------------------------
  //  PROJECTILE — un corps volumique qui traverse l'arène en laissant une
  //  traînée continue, puis explose. Utilisé par la moitié des capacités.
  // ---------------------------------------------------------------------------
  function fxProjectile(origin, target, color, o) {
    o = o || {};
    const arc = (o.arc === undefined) ? 1.1 : o.arc;
    const dur = o.dur || 0.42;
    const taille = o.size || 1;

    const g = new THREE.Group();
    const mats = [];
    const geos = [];

    // Le corps : une sphère lumineuse, doublée d'un halo et d'une queue conique.
    const coreM = fxMat('#ffffff', true, 1);
    const core = new THREE.Mesh(R3.geo.sphere(1, 12), coreM);
    core.scale.setScalar(0.22 * taille);
    core.castShadow = false;
    const haloM = sprMat(flameTexture(), color, 0.95, false);
    const halo = new THREE.Sprite(haloM);
    halo.scale.set(1.5 * taille, 1.5 * taille, 1);
    const queueM = fxMat(color, true, 0.55);
    const queue = new THREE.Mesh(R3.geo.cone(0.3, 1.4, 10), queueM);
    queue.castShadow = false;
    mats.push(coreM, haloM, queueM);
    g.add(core, halo, queue);

    const pos = new THREE.Vector3();
    const prev = origin.clone();
    let trainee = 0;

    spawnFx({
      group: g, mats: mats, geos: geos, life: dur,
      update: function (p) {
        pos.copy(origin).lerp(target, R3.easeInOut(p));
        pos.y += Math.sin(p * Math.PI) * arc;
        core.position.copy(pos);
        halo.position.copy(pos);
        const s = 1 + Math.sin(p * 18) * 0.12;
        halo.scale.set(1.5 * taille * s, 1.5 * taille * s, 1);

        // La queue s'oriente selon le déplacement réel.
        const d = pos.clone().sub(prev);
        const l = d.length();
        if (l > 0.001) {
          queue.position.copy(pos).addScaledVector(d.normalize(), -0.5 * taille);
          queue.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().multiplyScalar(-1));
          queue.scale.set(taille * 0.8, taille * (0.8 + l * 6), taille * 0.8);
        }
        prev.copy(pos);

        // Traînée : on sème des braises derrière soi.
        trainee += 1;
        if (trainee % 2 === 0 && R3.quality.particles) {
          fxCloud(pos.clone(), {
            n: 2, tex: flameTexture(), color: color, size: 0.6 * taille,
            spread: 0.35, life: 0.4, grow: 0.7, opacity: 0.8, additive: false,
          });
        }
        setPunch(pos, color, 3.2);
      },
      onEnd: function () {
        if (o.onArrive) o.onArrive();
        else fxImpact(target, color);
      },
    });
  }

  // ---------------------------------------------------------------------------
  //  ÉCLAIR 3D — une vraie géométrie en tube, brisée en zigzag. C'est ce qui
  //  distingue un éclair d'un simple trait.
  // ---------------------------------------------------------------------------
  function boltMesh(from, to, mat, jag, rayon) {
    const seg = 9;
    const pts = [];
    const axe = to.clone().sub(from);
    const long = axe.length() || 1;
    const perp1 = new THREE.Vector3(-axe.z, 0, axe.x).normalize();
    const perp2 = axe.clone().normalize().cross(perp1).normalize();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const p = from.clone().lerp(to, t);
      if (i > 0 && i < seg) {
        const amp = (jag || 0.35) * long * 0.25 * Math.sin(t * Math.PI);
        p.addScaledVector(perp1, (Math.random() - 0.5) * amp);
        p.addScaledVector(perp2, (Math.random() - 0.5) * amp);
      }
      pts.push(p);
    }
    const courbe = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(courbe, seg * 2, rayon || 0.07, 5, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    return mesh;
  }

  /** Une décharge complète : tronc + ramifications + halo, qui clignote. */
  function fxLightning(from, to, color, o) {
    o = o || {};
    const g = new THREE.Group();
    const mats = [];
    const geos = [];
    const mCore = fxMat('#ffffff', true, 1);
    const mGlow = fxMat(color, true, 0.55);
    mats.push(mCore, mGlow);

    const tronc = boltMesh(from, to, mCore, o.jag, 0.055 * (o.size || 1));
    const halo = boltMesh(from, to, mGlow, o.jag, 0.17 * (o.size || 1));
    geos.push(tronc.geometry, halo.geometry);
    g.add(halo, tronc);

    // ramifications : elles partent du tronc et meurent dans le vide
    const nb = qCount(o.branches === undefined ? 3 : o.branches);
    for (let i = 0; i < nb; i++) {
      const t = 0.25 + Math.random() * 0.55;
      const a = from.clone().lerp(to, t);
      const b = a.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.6));
      const br = boltMesh(a, b, mCore, 0.6, 0.03);
      geos.push(br.geometry);
      g.add(br);
    }

    spawnFx({
      group: g, mats: mats, geos: geos, life: o.life || 0.34,
      update: function (p) {
        // clignotement : trois éclats francs plutôt qu'un fondu mou
        const f = (p < 0.12) ? 1 : (p < 0.24 ? 0.35 : (p < 0.4 ? 1 : (p < 0.55 ? 0.5 : 1 - (p - 0.55) / 0.45)));
        mCore.opacity = f;
        mGlow.opacity = 0.55 * f;
      },
    });
    setPunch(to, color, 6);
  }

  // ---------------------------------------------------------------------------
  //  AUTRES BRIQUES VOLUMIQUES
  // ---------------------------------------------------------------------------

  /** Colonne montante (feu, lumière, glace…) : des anneaux empilés qui montent. */
  function fxColumn(pos, color, hauteur, o) {
    o = o || {};
    const H = hauteur || 3.2;
    const n = qCount(o.n || 10);
    const m = sprMat(o.tex || flameTexture(), color, 0.95, o.additive === true);
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(m);
      const k = (o.size || 1.1) * (1 - (i / n) * 0.45);
      s.scale.set(k, k, 1);
      g.add(s);
      parts.push({ s: s, off: i / n, a: Math.random() * 6.28, r: (o.rayon || 0.42) * (0.4 + Math.random()) });
    }
    spawnFx({
      group: g, mats: [m], life: o.life || 0.75,
      update: function (p) {
        parts.forEach(function (q) {
          const u = (p * 1.5 + q.off) % 1;
          const a = q.a + u * 5;
          q.s.position.set(pos.x + Math.cos(a) * q.r * (1 - u * 0.4),
            pos.y + u * H,
            pos.z + Math.sin(a) * q.r * (1 - u * 0.4));
          const k = (o.size || 1.1) * (1 - u * 0.55);
          q.s.scale.set(k, k, 1);
        });
        m.opacity = 0.95 * (1 - p * p);
      },
    });
  }

  /** Fissures qui courent au sol depuis un point : le sol se déchire. */
  function fxCracks(pos, color, n, longueur) {
    n = qCount(n || 6);
    const m = fxMat(color || '#3a2a1e', false, 0.9);
    m.blending = THREE.NormalBlending;
    const geo = ownGeo('fx-crack', function () { return new THREE.PlaneGeometry(0.22, 1); });
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, m);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -a;
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({ mesh: mesh, a: a, L: (longueur || 3.4) * (0.55 + Math.random() * 0.8) });
    }
    spawnFx({
      group: g, mats: [m], life: 0.9,
      update: function (p) {
        const e = R3.easeOut(Math.min(1, p * 2.2));
        parts.forEach(function (q) {
          const L = q.L * e;
          q.mesh.scale.set(1 + p * 0.6, L, 1);
          q.mesh.position.set(pos.x + Math.sin(q.a) * L * 0.5, 0.05, pos.z + Math.cos(q.a) * L * 0.5);
        });
        m.opacity = 0.9 * (1 - Math.max(0, (p - 0.5) / 0.5));
      },
    });
  }

  /** Vrai rocher : un bloc irrégulier, pas un cube. */
  function rockMesh(mat, taille) {
    const geo = ownGeo('fx-rock', function () { return new THREE.DodecahedronGeometry(0.5, 0); });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(taille * (0.7 + Math.random() * 0.6), taille * (0.7 + Math.random() * 0.6), taille * (0.7 + Math.random() * 0.6));
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    mesh.castShadow = false;
    return mesh;
  }

  // ===========================================================================
  //  LES 17 CAPACITÉS OFFENSIVES
  // ===========================================================================

  /** slash — trois lames géantes qui balaient la cible en croix. */
  function fxSlash(origin, target, color) {
    fxCharge(origin, color, 0.16, 0.7);
    const n = 3;
    const mats = [];
    const geos = [];
    const g = new THREE.Group();
    const parts = [];
    const geo = new THREE.TorusGeometry(1, 0.075, 8, 26, Math.PI * 0.62);
    geos.push(geo);
    for (let i = 0; i < n; i++) {
      const m = fxMat(i === 1 ? '#ffffff' : color, true, 0);
      mats.push(m);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.copy(target);
      mesh.rotation.z = (-0.7 + i * 0.7) + (Math.random() - 0.5) * 0.3;
      mesh.rotation.y = 0.35;
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({ mesh: mesh, mat: m, off: i * 0.10, sens: i % 2 ? 1 : -1 });
    }
    spawnFx({
      group: g, mats: mats, geos: geos, life: 0.55,
      update: function (p) {
        if (camera) g.quaternion.copy(camera.quaternion);
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / 0.30);
          const s = (0.4 + u * 2.4);
          q.mesh.scale.set(s, s, 1);
          q.mesh.rotation.z += 0.04 * q.sens;
          q.mat.opacity = (u <= 0 || u >= 1) ? 0 : Math.sin(u * Math.PI);
        });
      },
    });
    fxExplosion(target, color, 0.85 * fxForce, { debris: 8, scorch: false });
  }

  /** beam — un rayon massif : charge, tir continu, anneaux qui filent dessus. */
  function fxBeam(origin, target, color) {
    fxCharge(origin, color, 0.26, 1.2);
    const dir = target.clone().sub(origin);
    const dist = Math.max(0.6, dir.length());
    const dirN = dir.clone().normalize();
    const mid = origin.clone().addScaledVector(dir, 0.5);

    const mOuter = fxMat(color, true, 0.5);
    const mInner = fxMat('#ffffff', true, 0.95);
    const outer = new THREE.Mesh(R3.geo.cyl(0.42, 0.42, 1, 14), mOuter);
    const inner = new THREE.Mesh(R3.geo.cyl(0.14, 0.14, 1, 10), mInner);
    [outer, inner].forEach(function (c) {
      c.position.copy(mid);
      c.castShadow = false;
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
    });

    // anneaux qui remontent le long du rayon : c'est ce qui donne la vitesse
    const mRing = fxMat(color, true, 0.85);
    const geoRing = ownGeo('fx-ring', function () { return new THREE.TorusGeometry(1, 0.06, 8, 30); });
    const anneaux = [];
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(geoRing, mRing);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirN);
      r.castShadow = false;
      anneaux.push({ mesh: r, off: i / 5 });
      // on l'ajoute plus bas
    }

    const g = new THREE.Group();
    g.add(outer, inner);
    anneaux.forEach(function (a) { g.add(a.mesh); });

    spawnFx({
      group: g, mats: [mOuter, mInner, mRing], life: 0.55, delay: 0.22,
      update: function (p) {
        const grow = R3.easeOut(Math.min(1, p / 0.22));
        const fin = p > 0.62 ? (p - 0.62) / 0.38 : 0;
        const L = dist * grow;
        outer.scale.set(1 + Math.sin(p * 40) * 0.08, L, 1 + Math.sin(p * 40) * 0.08);
        inner.scale.set(1, L, 1);
        mOuter.opacity = 0.5 * (1 - fin);
        mInner.opacity = 0.95 * (1 - fin);
        anneaux.forEach(function (a) {
          const u = (p * 2.2 + a.off) % 1;
          a.mesh.position.copy(origin).addScaledVector(dirN, u * L);
          const s = 0.55 + Math.sin(u * Math.PI) * 0.35;
          a.mesh.scale.set(s, s, s);
        });
        mRing.opacity = 0.85 * (1 - fin);
        setPunch(origin, color, 4);
      },
    });
    setTimeoutFx(0.30, function () { fxExplosion(target, color, 1.15 * fxForce); });
  }

  /** ball — un orbe chargé qui traverse l'arène en laissant une traînée. */
  function fxBall(origin, target, color) {
    fxCharge(origin, color, 0.22, 1);
    fxProjectile(origin, target, color, {
      dur: 0.42, arc: 1.2, size: 1.25, delay: 0.20,
      onArrive: function () { fxExplosion(target, color, 1.1 * fxForce); },
    });
  }

  /** wave — un mur d'eau qui déferle, gouttes comprises. */
  function fxWave(origin, target, color) {
    const dir = target.clone().sub(origin); dir.y = 0;
    const dist = Math.max(0.6, dir.length());
    const dirN = dir.clone().normalize();

    const m = fxMat(color, true, 0.9);
    const geo = ownGeo('fx-wave', function () { return new THREE.TorusGeometry(1, 0.16, 10, 30, Math.PI); });
    const mur = new THREE.Mesh(geo, m);
    mur.position.copy(origin); mur.position.y = 0.05;
    mur.rotation.x = -Math.PI / 2;
    mur.rotation.z = Math.atan2(dirN.x, dirN.z);
    mur.castShadow = false;

    // la crête : des gouttes qui roulent sur le mur
    const dm = sprMat(glowTexture(), color, 0.9, true);
    const gouttes = [];
    const g = new THREE.Group();
    g.add(mur);
    const nd = qCount(16);
    for (let i = 0; i < nd; i++) {
      const s = new THREE.Sprite(dm);
      const k = 0.28 + Math.random() * 0.3;
      s.scale.set(k, k, 1);
      g.add(s);
      gouttes.push({ s: s, a: (Math.random() - 0.5) * 2.6, h: 0.4 + Math.random() * 1.5, ph: Math.random() });
    }

    spawnFx({
      group: g, mats: [m, dm], life: 0.6,
      update: function (p) {
        const trav = R3.easeOut(p);
        const cx = origin.x + dir.x * trav, cz = origin.z + dir.z * trav;
        mur.position.set(cx, 0.05, cz);
        const s = 0.4 + trav * (dist * 0.62);
        mur.scale.set(s, s, 1 + trav * 2.2);
        m.opacity = 0.9 * (1 - p * 0.7);
        gouttes.forEach(function (q) {
          const u = (p * 1.6 + q.ph) % 1;
          q.s.position.set(cx + Math.cos(q.a) * s * 0.9, 0.2 + Math.sin(u * Math.PI) * q.h, cz + Math.sin(q.a) * s * 0.9);
        });
        dm.opacity = 0.9 * (1 - p);
      },
    });
    fxExplosion(target, color, 1.0 * fxForce, { smoke: '#cfe6f5', scorch: false });
    fxColumn(target, color, 3.4, { n: 12, size: 0.9, rayon: 0.6, tex: glowTexture(), life: 0.7 , additive: true });
  }

  /** burst — l'explosion pure, en plus gros. */
  function fxBurst(origin, target, color) {
    fxCharge(target, color, 0.18, 1.3);
    fxExplosion(target, color, 1.4 * fxForce, { fireballs: 24, debris: 16 });
  }

  /** storm — un orage : nuage noir, éclairs multiples, pluie oblique. */
  function fxStorm(origin, target, color) {
    const cloudM = sprMat(smokeTexture(), '#1e2434', 0.9, false);
    const g = new THREE.Group();
    const nuages = [];
    const nc = qCount(9);
    for (let i = 0; i < nc; i++) {
      const s = new THREE.Sprite(cloudM);
      const a = (i / nc) * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.5;
      s.position.set(target.x + Math.cos(a) * r, target.y + 2.6 + Math.random() * 0.5, target.z + Math.sin(a) * r);
      const k = 1.9 + Math.random();
      s.scale.set(k, k * 0.8, 1);
      g.add(s);
      nuages.push({ s: s, a: a, r: r });
    }
    const pluieM = fxMat(color, true, 0.8);
    const gouttes = [];
    const np = qCount(22);
    for (let i = 0; i < np; i++) {
      const mesh = new THREE.Mesh(R3.geo.box(0.035, 0.5, 0.035), pluieM);
      mesh.castShadow = false;
      g.add(mesh);
      gouttes.push({ mesh: mesh, x: (Math.random() - 0.5) * 3.4, z: (Math.random() - 0.5) * 3.4, off: Math.random() });
    }
    spawnFx({
      group: g, mats: [cloudM, pluieM], life: 1.15,
      update: function (p) {
        cloudM.opacity = 0.9 * (p < 0.18 ? p / 0.18 : (p > 0.75 ? (1 - p) / 0.25 : 1));
        nuages.forEach(function (q, i) {
          q.s.position.x = target.x + Math.cos(q.a + p * 1.2) * q.r;
          q.s.position.z = target.z + Math.sin(q.a + p * 1.2) * q.r;
        });
        gouttes.forEach(function (q) {
          const u = (p * 2.4 + q.off) % 1;
          q.mesh.position.set(target.x + q.x, target.y + 2.6 - u * 3.4, target.z + q.z);
          q.mesh.rotation.z = 0.35;
        });
        pluieM.opacity = 0.8 * (p < 0.2 ? p / 0.2 : 1 - p);
      },
    });
    // trois éclairs successifs
    const haut = new THREE.Vector3(target.x, target.y + 2.6, target.z);
    fxLightning(haut, target, color, { size: 1.2, branches: 4 });
    setTimeoutFx(0.22, function () { fxLightning(haut.clone().add(new THREE.Vector3(0.5, 0, 0.3)), target, color, { size: 0.9, branches: 2 }); });
    setTimeoutFx(0.42, function () {
      fxLightning(haut.clone().add(new THREE.Vector3(-0.6, 0, -0.2)), target, color, { size: 1.1, branches: 3 });
      fxExplosion(target, color, 1.15 * fxForce);
    });
  }

  /** quake — le sol se soulève, se fissure, et des blocs jaillissent. */
  function fxQuake(origin, target, color) {
    fxCracks(target, '#3a2a1e', 8, 4.4);
    fxRing(new THREE.Vector3(target.x, 0.06, target.z), color, 5.5, true);

    // blocs qui jaillissent du sol
    const m = fxMat(color, false, 1);
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(9);
    for (let i = 0; i < n; i++) {
      const mesh = rockMesh(m, 0.34 + Math.random() * 0.3);
      const a = (i / n) * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.7;
      g.add(mesh);
      parts.push({
        mesh: mesh, x: target.x + Math.cos(a) * r, z: target.z + Math.sin(a) * r,
        h: 1.1 + Math.random() * 1.6, sx: (Math.random() - 0.5) * 12, sy: (Math.random() - 0.5) * 12,
        off: Math.random() * 0.25,
      });
    }
    spawnFx({
      group: g, mats: [m], life: 1.0,
      update: function (p) {
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / (1 - q.off));
          const y = Math.sin(u * Math.PI) * q.h;
          q.mesh.position.set(q.x, Math.max(0, y), q.z);
          q.mesh.rotation.x += q.sx * 0.008;
          q.mesh.rotation.z += q.sy * 0.008;
        });
        m.opacity = p < 0.7 ? 1 : (1 - p) / 0.3;
      },
    });
    fxCloud(new THREE.Vector3(target.x, 0.2, target.z), {
      n: 14, tex: smokeTexture(), color: '#c9bda8', size: 1.5,
      spread: 2.2, rise: 0.5, life: 1.2, grow: 2.0, opacity: 0.55, additive: false,
    });
    camShake = Math.max(camShake, 0.55);
    fxExplosion(target, color, 1.2 * fxForce, { scorch: true, smoke: '#c9bda8' });
  }

  /** ice — des lames de glace se forment en l'air puis s'abattent. */
  function fxIce(origin, target, color) {
    const m = fxMat(color, true, 0.9);
    const mCore = fxMat('#ffffff', true, 0.95);
    const geo = ownGeo('fx-shard-long', function () { return new THREE.ConeGeometry(0.22, 1.5, 6); });
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(8);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, i % 3 === 0 ? mCore : m);
      mesh.castShadow = false;
      g.add(mesh);
      const a = (i / n) * Math.PI * 2;
      parts.push({
        mesh: mesh, a: a, r: 1.5 + Math.random() * 0.8,
        h: 2.4 + Math.random() * 1.2, off: i * 0.045,
      });
    }
    spawnFx({
      group: g, mats: [m, mCore], life: 0.85,
      update: function (p) {
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / 0.55);
          // 1re moitié : la lame se forme en tournant ; 2e : elle plonge
          const desc = u < 0.45 ? 0 : R3.easeInOut((u - 0.45) / 0.55);
          const r = q.r * (1 - desc * 0.85);
          const y = q.h * (1 - desc) + 0.4;
          q.mesh.position.set(target.x + Math.cos(q.a + p * 2) * r, y, target.z + Math.sin(q.a + p * 2) * r);
          q.mesh.rotation.set(Math.PI, p * 6 + q.a, 0);
          const s = Math.min(1, u * 3) * (1 + desc * 0.4);
          q.mesh.scale.setScalar(s);
        });
        m.opacity = 0.9 * (1 - Math.max(0, (p - 0.7) / 0.3));
        mCore.opacity = 0.95 * (1 - Math.max(0, (p - 0.7) / 0.3));
      },
    });
    setTimeoutFx(0.42, function () {
      fxExplosion(target, color, 1.05 * fxForce, { smoke: '#e8f6ff', scorch: false });
      fxColumn(target, '#ffffff', 2.6, { n: 10, size: 0.8, tex: glowTexture(), life: 0.6 , additive: true });
    });
  }

  /** star — une pluie d'étoiles filantes converge, puis grande déflagration. */
  function fxStar(origin, target, color) {
    const n = qCount(9);
    const m = fxMat(color, true, 1);
    const halo = sprMat(glowTexture(), '#ffffff', 0.9, true);
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const etoile = R3.star(5, 0.26, 0.11, 0.05, color, 0, 0, 0);
      etoile.material = m;
      etoile.castShadow = false;
      g.add(etoile);
      const q = new THREE.Sprite(halo);
      q.scale.set(0.9, 0.9, 1);
      g.add(q);
      const a = (i / n) * Math.PI * 2;
      parts.push({
        mesh: etoile, halo: q, a: a,
        from: new THREE.Vector3(target.x + Math.cos(a) * 6, target.y + 3.5 + Math.random() * 2, target.z + Math.sin(a) * 6),
        off: i * 0.035,
      });
    }
    spawnFx({
      group: g, mats: [m, halo], life: 0.7,
      update: function (p) {
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / 0.5);
          const pos = q.from.clone().lerp(target, R3.easeInOut(u));
          q.mesh.position.copy(pos);
          q.halo.position.copy(pos);
          q.mesh.rotation.z += 0.25;
          q.mesh.rotation.y += 0.12;
          const k = 1 - u * 0.4;
          q.halo.scale.set(k, k, 1);
        });
        m.opacity = 1 - Math.max(0, (p - 0.5) / 0.5);
        halo.opacity = 0.9 * (1 - Math.max(0, (p - 0.5) / 0.5));
      },
    });
    setTimeoutFx(0.42, function () {
      fxExplosion(target, color, 1.35 * fxForce, { fireballs: 22, scorch: false });
      fxStars(target, 26);
    });
  }

  /** void — un trou noir aspire tout, puis implose en onde de choc. */
  function fxVoid(origin, target, color) {
    const mTrou = fxMat('#0a0713', false, 0.98);
    mTrou.blending = THREE.NormalBlending;
    const trou = new THREE.Mesh(R3.geo.sphere(1, 16), mTrou);
    trou.position.copy(target);
    trou.castShadow = false;

    const mDisque = fxMat(color, true, 0.9);
    const disque = new THREE.Mesh(
      ownGeo('fx-disc', function () { return new THREE.TorusGeometry(1, 0.22, 10, 34); }), mDisque);
    disque.position.copy(target);
    disque.rotation.x = 1.15;
    disque.castShadow = false;

    const pm = sprMat(glowTexture(), color, 0.9, true);
    const g = new THREE.Group();
    g.add(trou, disque);
    const parts = [];
    const n = qCount(20);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(pm);
      const k = 0.2 + Math.random() * 0.22;
      s.scale.set(k, k, 1);
      g.add(s);
      parts.push({ s: s, a: Math.random() * 6.28, r: 2.2 + Math.random() * 2.4, y: (Math.random() - 0.5) * 2.4, off: Math.random() * 0.3 });
    }
    spawnFx({
      group: g, mats: [mTrou, mDisque, pm], life: 0.85,
      update: function (p) {
        const enfle = p < 0.7 ? R3.easeOut(p / 0.7) : 1 - (p - 0.7) / 0.3;
        trou.scale.setScalar(0.15 + enfle * 0.85);
        disque.scale.setScalar(0.5 + enfle * 1.5);
        disque.rotation.z += 0.09;
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / 0.7);
          const r = q.r * (1 - u);
          const a = q.a + u * 12;
          q.s.position.set(target.x + Math.cos(a) * r, target.y + q.y * (1 - u), target.z + Math.sin(a) * r);
          const k = 0.22 * (1 - u * 0.5);
          q.s.scale.set(k, k, 1);
        });
        pm.opacity = 0.9 * (1 - Math.max(0, (p - 0.6) / 0.4));
        mTrou.opacity = 0.98 * (1 - Math.max(0, (p - 0.75) / 0.25));
        mDisque.opacity = 0.9 * (1 - Math.max(0, (p - 0.75) / 0.25));
      },
    });
    setTimeoutFx(0.62, function () {
      fxExplosion(target, color, 1.45 * fxForce, { fireballs: 22, smoke: '#2a2340' });
    });
  }

  /** time — des cadrans concentriques tournent, le temps se déchire. */
  function fxTime(origin, target, color) {
    const g = new THREE.Group();
    const mats = [];
    const geoR = ownGeo('fx-ring', function () { return new THREE.TorusGeometry(1, 0.06, 8, 30); });
    const anneaux = [];
    for (let i = 0; i < 4; i++) {
      const m = fxMat(i === 0 ? '#ffffff' : color, true, 0.9);
      mats.push(m);
      const mesh = new THREE.Mesh(geoR, m);
      mesh.position.copy(target);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      mesh.castShadow = false;
      g.add(mesh);
      anneaux.push({ mesh: mesh, mat: m, s: 0.8 + i * 0.55, v: (i % 2 ? 1 : -1) * (0.03 + i * 0.02) });
    }
    // aiguilles
    const mA = fxMat('#ffffff', true, 0.95);
    mats.push(mA);
    for (let i = 0; i < 2; i++) {
      const a = new THREE.Mesh(R3.geo.box(0.06, i ? 1.5 : 1.0, 0.06), mA);
      a.position.copy(target);
      a.castShadow = false;
      g.add(a);
      anneaux.push({ mesh: a, mat: mA, s: 1, v: (i ? 0.22 : 0.06), aiguille: true, len: i ? 1.5 : 1.0 });
    }
    spawnFx({
      group: g, mats: mats, life: 0.8,
      update: function (p) {
        if (camera) g.quaternion.copy(camera.quaternion);
        anneaux.forEach(function (q) {
          if (q.aiguille) {
            q.mesh.rotation.z += q.v;
            const s = R3.easeOut(Math.min(1, p * 3));
            q.mesh.scale.set(1, s, 1);
            q.mesh.position.set(
              target.x + Math.sin(q.mesh.rotation.z) * -q.len * 0.5 * s,
              target.y + Math.cos(q.mesh.rotation.z) * q.len * 0.5 * s,
              target.z);
          } else {
            const s = q.s * (0.4 + R3.easeOut(Math.min(1, p * 2)) * 1.1);
            q.mesh.scale.set(s, s, s);
            q.mesh.rotation.z += q.v;
          }
          q.mat.opacity = 0.9 * (1 - Math.max(0, (p - 0.55) / 0.45));
        });
      },
    });
    setTimeoutFx(0.42, function () { fxExplosion(target, color, 1.2 * fxForce, { scorch: false }); });
  }

  /** leaf — une tornade de feuilles enveloppe la cible. */
  function fxLeaf(origin, target, color) {
    const m = fxMat(color, false, 1);
    m.side = THREE.DoubleSide;
    const geo = ownGeo('fx-leaf', function () { return new THREE.PlaneGeometry(0.32, 0.5); });
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(26);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({
        mesh: mesh, a: Math.random() * 6.28, r: 0.5 + Math.random() * 1.5,
        y0: Math.random() * 2.6, v: 2 + Math.random() * 3, sp: (Math.random() - 0.5) * 14,
      });
    }
    spawnFx({
      group: g, mats: [m], life: 0.95,
      update: function (p) {
        parts.forEach(function (q) {
          const a = q.a + p * q.v * 2.4;
          const r = q.r * (1 + Math.sin(p * 3) * 0.25);
          q.mesh.position.set(target.x + Math.cos(a) * r, ((q.y0 + p * 2.6) % 3.2), target.z + Math.sin(a) * r);
          q.mesh.rotation.set(p * q.sp * 0.4, a, p * q.sp * 0.3);
        });
        m.opacity = 1 - Math.max(0, (p - 0.55) / 0.45);
      },
    });
    setTimeoutFx(0.38, function () {
      fxExplosion(target, color, 1.0 * fxForce, { smoke: '#9fd08a', scorch: false });
    });
  }

  /** flame — un lance-flammes : un torrent de feu, puis un brasier. */
  function fxFlame(origin, target, color) {
    fxCharge(origin, color, 0.18, 0.9);
    const dir = target.clone().sub(origin);
    const dist = Math.max(0.6, dir.length());
    const dirN = dir.clone().normalize();
    // Corps du jet en fondu normal (la couleur reste lisible), cœur additif.
    const m = sprMat(flameTexture(), color, 0.95, false);
    const mC = sprMat(flameTexture(), '#fff3c8', 0.8, true);
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(22);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(i % 4 === 0 ? mC : m);
      g.add(s);
      parts.push({
        s: s, off: i / n, lat: (Math.random() - 0.5) * 0.55, ver: (Math.random() - 0.5) * 0.5,
        k: 0.55 + Math.random() * 0.7, ph: Math.random() * 6.28,
      });
    }
    spawnFx({
      group: g, mats: [m, mC], life: 0.72, delay: 0.14,
      update: function (p) {
        parts.forEach(function (q) {
          const u = (p * 1.9 + q.off) % 1;
          const d = u * dist;
          // le jet s'évase en avançant
          const evase = 0.25 + u * 1.5;
          q.s.position.set(
            origin.x + dirN.x * d + q.lat * evase + Math.sin(q.ph + p * 14) * 0.1,
            origin.y + q.ver * evase + Math.sin(u * 2.2) * 0.35,
            origin.z + dirN.z * d + q.lat * evase + Math.cos(q.ph + p * 14) * 0.1
          );
          const k = q.k * (0.5 + u * 1.5);
          q.s.scale.set(k, k, 1);
          q.s.material.rotation += 0.03;
        });
        const f = 1 - Math.max(0, (p - 0.6) / 0.4);
        m.opacity = 0.95 * f;
        mC.opacity = 0.9 * f;
        setPunch(origin.clone().lerp(target, 0.5), color, 4.5);
      },
    });
    setTimeoutFx(0.34, function () {
      fxExplosion(target, color, 1.25 * fxForce, { fireballs: 22 });
      fxColumn(target, color, 4.0, { n: 14, size: 1.3, rayon: 0.7, life: 0.9 });
    });
  }

  /** bubble — un torrent de bulles, puis une gerbe d'eau. */
  function fxBubble(origin, target, color) {
    const m = fxMat(color, true, 0.65);
    const mB = fxMat('#ffffff', true, 0.5);
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(20);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(R3.geo.sphere(1, 10), i % 3 ? m : mB);
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({
        mesh: mesh, off: i / n, k: 0.16 + Math.random() * 0.2,
        lat: (Math.random() - 0.5) * 0.8, ver: (Math.random() - 0.5) * 0.7, ph: Math.random() * 6.28,
      });
    }
    spawnFx({
      group: g, mats: [m, mB], life: 0.7,
      update: function (p) {
        parts.forEach(function (q) {
          const u = (p * 1.7 + q.off) % 1;
          const pos = origin.clone().lerp(target, u);
          pos.x += q.lat + Math.sin(q.ph + u * 9) * 0.18;
          pos.y += q.ver + Math.sin(u * Math.PI) * 0.9;
          pos.z += Math.cos(q.ph + u * 9) * 0.18;
          q.mesh.position.copy(pos);
          q.mesh.scale.setScalar(q.k * (0.6 + u));
        });
        const f = 1 - Math.max(0, (p - 0.6) / 0.4);
        m.opacity = 0.65 * f; mB.opacity = 0.5 * f;
      },
    });
    setTimeoutFx(0.36, function () {
      fxExplosion(target, color, 1.05 * fxForce, { smoke: '#cfe6f5', scorch: false });
      fxColumn(target, color, 3.6, { n: 14, size: 1.0, rayon: 0.55, tex: glowTexture(), life: 0.8 , additive: true });
    });
  }

  /** bolt — LA foudre : un éclair 3D tombe du ciel, puis remonte du sol. */
  function fxBolt(origin, target, color) {
    const ciel = new THREE.Vector3(target.x + (Math.random() - 0.5), target.y + 7.5, target.z + (Math.random() - 0.5));
    fxLightning(ciel, target, color, { size: 1.5, branches: 5, life: 0.4, jag: 0.5 });
    fxScreenRing(color, 0.7);
    camShake = Math.max(camShake, 0.4);

    // arcs qui rampent sur la cible
    setTimeoutFx(0.10, function () {
      for (let i = 0; i < 3; i++) {
        const a = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4));
        const b = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 1.2, (Math.random() - 0.5) * 1.4));
        fxLightning(a, b, color, { size: 0.7, branches: 1, life: 0.22, jag: 0.9 });
      }
      fxExplosion(target, color, 1.3 * fxForce, { fireballs: 18, smoke: '#dfe6ff' });
    });
  }

  /** wind — un vortex visible, avec ses lames d'air. */
  function fxWind(origin, target, color) {
    const m = fxMat(color, true, 0.55);
    m.side = THREE.DoubleSide;
    const geo = ownGeo('fx-arc', function () { return new THREE.TorusGeometry(1, 0.045, 6, 22, Math.PI * 1.5); });
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(12);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.castShadow = false;
      g.add(mesh);
      parts.push({ mesh: mesh, off: i / n, r: 0.5 + Math.random() * 0.9 });
    }
    const pm = sprMat(glowTexture(), '#ffffff', 0.5, true);
    const poussiere = [];
    const np = qCount(14);
    for (let i = 0; i < np; i++) {
      const s = new THREE.Sprite(pm);
      const k = 0.2 + Math.random() * 0.25;
      s.scale.set(k, k, 1);
      g.add(s);
      poussiere.push({ s: s, a: Math.random() * 6.28, r: 0.6 + Math.random() * 1.4, y: Math.random() * 3 });
    }
    spawnFx({
      group: g, mats: [m, pm], life: 0.85,
      update: function (p) {
        parts.forEach(function (q) {
          const u = (p * 1.4 + q.off) % 1;
          q.mesh.position.set(target.x, 0.2 + u * 3.4, target.z);
          const s = q.r * (1.6 - u * 0.8);
          q.mesh.scale.set(s, s, 1);
          q.mesh.rotation.z = u * 14;
        });
        poussiere.forEach(function (q) {
          const a = q.a + p * 13;
          const y = (q.y + p * 3.2) % 3.4;
          q.s.position.set(target.x + Math.cos(a) * q.r * (1.2 - y * 0.2), 0.2 + y, target.z + Math.sin(a) * q.r * (1.2 - y * 0.2));
        });
        const f = 1 - Math.max(0, (p - 0.6) / 0.4);
        m.opacity = 0.55 * f; pm.opacity = 0.5 * f;
      },
    });
    setTimeoutFx(0.4, function () {
      fxExplosion(target, color, 1.0 * fxForce, { scorch: false, smoke: '#e6f2ff' });
    });
  }

  /** rock — de vrais blocs arrachés au sol et projetés sur la cible. */
  function fxRock(origin, target, color) {
    const m = fxMat(color, false, 1);
    const g = new THREE.Group();
    const parts = [];
    const n = qCount(7);
    for (let i = 0; i < n; i++) {
      const mesh = rockMesh(m, 0.42 + Math.random() * 0.34);
      g.add(mesh);
      const from = origin.clone();
      from.x += (Math.random() - 0.5) * 1.5;
      from.z += (Math.random() - 0.5) * 1.0;
      from.y = 0.2;
      parts.push({
        mesh: mesh, from: from, off: i * 0.045,
        sx: (Math.random() - 0.5) * 16, sy: (Math.random() - 0.5) * 16,
        arc: 1.4 + Math.random() * 1.1,
      });
    }
    spawnFx({
      group: g, mats: [m], life: 0.72,
      update: function (p) {
        parts.forEach(function (q) {
          const u = R3.clamp01((p - q.off) / 0.55);
          // 1er tiers : le bloc s'arrache du sol ; ensuite il file vers la cible
          if (u < 0.3) {
            const k = u / 0.3;
            q.mesh.position.set(q.from.x, q.from.y + k * 1.1, q.from.z);
          } else {
            const k = (u - 0.3) / 0.7;
            const pos = q.from.clone().setY(q.from.y + 1.1).lerp(target, R3.easeIn ? R3.easeIn(k) : k * k);
            pos.y += Math.sin(k * Math.PI) * q.arc;
            q.mesh.position.copy(pos);
          }
          q.mesh.rotation.x += q.sx * 0.012;
          q.mesh.rotation.y += q.sy * 0.012;
        });
        m.opacity = 1 - Math.max(0, (p - 0.75) / 0.25);
      },
    });
    fxCloud(new THREE.Vector3(origin.x, 0.15, origin.z), {
      n: 8, tex: smokeTexture(), color: '#c9bda8', size: 1.1,
      spread: 1.2, rise: 0.3, life: 0.8, grow: 1.8, opacity: 0.5, additive: false,
    });
    setTimeoutFx(0.5, function () {
      fxExplosion(target, color, 1.2 * fxForce, { smoke: '#c9bda8', debris: 16 });
    });
  }

  // Table des 18 identifiants -> fonction. `heal` n'y figure pas : il est
  // traité à part dans playFx() car sa cible est l'attaquant lui-même.
  const FX_TABLE = {
    slash: fxSlash, beam: fxBeam, ball: fxBall, wave: fxWave, burst: fxBurst,
    storm: fxStorm, quake: fxQuake, ice: fxIce, star: fxStar, 'void': fxVoid,
    time: fxTime, leaf: fxLeaf, flame: fxFlame, bubble: fxBubble, bolt: fxBolt,
    wind: fxWind, rock: fxRock,
  };

  function dispatchFx(fxId, origin, target, color) {
    const fn = FX_TABLE[fxId];
    if (fn) {
      try { fn(origin, target, color); return; } catch (e) { console.warn('[battle3d] effet en échec :', fxId, e); }
    }
    fxImpact(target, color);   // repli : un fx inconnu (ou en échec) reste visible
  }

  (function selfCheckFx() {
    try {
      const REQUIRED = ['slash', 'beam', 'ball', 'wave', 'burst', 'heal', 'storm', 'quake',
        'ice', 'star', 'void', 'time', 'leaf', 'flame', 'bubble', 'bolt', 'wind', 'rock'];
      const missing = REQUIRED.filter(function (id) { return id !== 'heal' && !FX_TABLE[id]; });
      if (missing.length && typeof console !== 'undefined' && console.warn) {
        console.warn('[battle3d] effets manquants dans FX_TABLE : ' + missing.join(', '));
      }
    } catch (e) { /* pas bloquant */ }
  })();

  // ===========================================================================
  //  CRÉATURES — construction / reconstruction d'un camp
  // ===========================================================================

  /** Résout légende, types et couleur d'un Mon via dex3d, avec repli tolérant. */
  function speciesInfoFor(mon) {
    let legendary = false, color = null, types = (mon && mon.types) || null;
    const dex = R3.get('dex');
    if (dex) {
      try {
        const id = mon && mon.id;
        legendary = !!dex.isLegendary(id);
        const sp = dex.get ? dex.get(id) : null;
        if (sp) { types = sp.types || types; color = sp.color || null; }
      } catch (e) { /* dex indisponible ou id inconnu : on reste sur le repli */ }
    }
    return { legendary: legendary, types: types || [], color: color };
  }

  function attachModel(side, model, scale, blobR) {
    side.model = model;
    side.scale = scale;
    model.position.set(0, 0, 0);
    model.userData.baseY = 0;
    side.pivot.add(model);
    const br = blobR || 0.45 * scale;
    if (!side.blob) {
      side.blob = contactBlob(br);
      side.blob.position.set(0, 0.012, 0);
      side.holder.add(side.blob);
    } else {
      side.blob.scale.set(br * 2, br * 2, 1);
    }
  }

  /**
   * (Re)construit le modèle 3D d'un camp à partir d'un Mon (team3d).
   * Utilisé à l'entrée en combat ET par swapIn() pour changer de créature.
   * `opts.skipIntro` : ne relance pas le pop d'apparition (swapIn gère lui-même
   * sa propre animation d'apparition, voir updateSwap).
   */
  function rebuildSide(s, mon, sideKey, opts) {
    opts = opts || {};
    if (s.model) { R3.disposeTree(s.model); s.model = null; }
    if (s.auraGroup) { if (s.auraGroup.parent) s.auraGroup.parent.remove(s.auraGroup); s.auraGroup = null; }

    const info = speciesInfoFor(mon);
    s.mon = mon || null;
    s.legendary = info.legendary;
    s.phase = Math.random() * 6.28;

    const baseScale = sideKey === 'foe' ? FOE_SCALE : PLR_SCALE;
    const model = R3.buildCreature((mon && mon.id) || 'feuillou');
    let scaleMult = info.legendary ? LEGEND_SCALE_MULT : 1;
    // Tant que les 36 légendaires ne sont pas tous modélisés, buildCreature()
    // renvoie une silhouette de repli minuscule pour ceux qui manquent : on la
    // gonfle nettement pour que « ça en impose » quand même (voir §4 du contrat).
    if (info.legendary && model.userData.placeholder) scaleMult *= LEGEND_PLACEHOLDER_BOOST;
    attachModel(s, model, baseScale * scaleMult, 0.42 * baseScale * scaleMult);

    const plat = sideKey === 'foe' ? foePlat : plrPlat;
    if (plat) {
      const pm = info.legendary ? LEGEND_PLAT_MULT : 1;
      plat.scale.set(pm, 1, pm);   // jamais l'axe Y : la hauteur du plateau ne bouge pas
    }

    s.introDur = info.legendary ? 2.4 : 1.2;

    if (info.legendary) {
      const LL = R3.get('llib');
      const T = R3.get('types');
      const c = (T && T.color && info.types[0]) ? T.color(info.types[0]) : (info.color || '#ffe066');
      if (LL && LL.aura) {
        try {
          s.auraGroup = LL.aura(c, 0.9, { shape: 'sphere' });
          s.pivot.add(s.auraGroup);
        } catch (e) { s.auraGroup = null; }
      }
    }

    s.holder.traverse(function (o) { if (o.isMesh && o !== s.blob) { o.castShadow = true; o.receiveShadow = true; } });

    if (opts.skipIntro) {
      s.introDone = true;
    } else {
      s.introDone = false; s.introT = 0; s.introFxDone = false; s.shrink = 0.001;
    }
  }

  // ===========================================================================
  //  ENTRÉE / SORTIE
  // ===========================================================================

  function enter(battleState, biome) {
    if (scene) exit();

    bs = battleState || null;
    biomeCur = biome || (bs && bs.biome) || 'plain';
    const a = arena(biomeCur);
    const mood = R3.biomeMood(biomeCur);

    time = 0; camShake = 0; resultDone = false; ballAnim = null;
    hitStop = 0; zoomPunch = 0; fxForce = 1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(a.mid);
    scene.fog = new THREE.Fog(new THREE.Color(a.mid), 17, 52);

    camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
    camera.position.set(0, 3.2, 8);
    scene.add(camera);   // la caméra porte les éclairs plein écran

    scene.add(buildSky(a));
    // Le décor lointain ne projette pas d'ombre : il est de toute façon hors du
    // frustum d'ombre (± 7 unités), autant l'exclure de la passe d'ombres.
    const back = buildBackdrop(a);
    back.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    scene.add(back);

    // --- lumières : clé chaude de face-gauche, contre-jour froid, ambiance ---
    hemiLight = new THREE.HemisphereLight(new THREE.Color(a.top), new THREE.Color(a.ground), mood.ambient + 0.25);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(new THREE.Color(mood.sun), 1.55);
    sunLight.position.set(-5.5, 8.5, 5.5);
    sunLight.target.position.set(0, 0.6, -0.8);
    scene.add(sunLight.target);
    if (R3.quality.shadows) {
      sunLight.castShadow = true;
      const S = Math.min(2048, R3.quality.shadowSize || 1024);
      sunLight.shadow.mapSize.set(S, S);
      const c = sunLight.shadow.camera;
      c.left = -7; c.right = 7; c.top = 7; c.bottom = -7; c.near = 1; c.far = 26;
      c.updateProjectionMatrix();
      sunLight.shadow.bias = -0.0007;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    rimLight = new THREE.DirectionalLight(0xbfe0ff, 0.75);
    rimLight.position.set(4.5, 4.0, -7.0);
    scene.add(rimLight);

    punchLight = new THREE.PointLight(0xfff0c8, 0, 9, 2);
    punchLight.position.set(0, 1.4, 0);
    scene.add(punchLight);

    // --- plateformes ---
    const platKind = a.plat;
    foePlat = buildPlatform(platKind, FOE_PLAT_R, FOE_PLAT_H);
    foePlat.position.set(FOE_POS.x, 0, FOE_POS.z);
    foePlat.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
    scene.add(foePlat);

    plrPlat = buildPlatform(platKind, PLR_PLAT_R, PLR_PLAT_H);
    plrPlat.position.set(PLR_POS.x, 0, PLR_POS.z);
    plrPlat.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
    scene.add(plrPlat);

    // --- les deux camps : TOUJOURS des créatures, jamais le dresseur.
    // L'adversaire regarde vers le joueur (donc à peu près vers la caméra),
    // le camp du joueur nous tourne le dos (« vu de dos », contrat §17).
    foe = makeSide(FOE_POS, FOE_TOP, -0.30);
    plr = makeSide(PLR_POS, PLR_TOP, 2.78);
    scene.add(foe.holder, plr.holder);

    rebuildSide(foe, bs && bs.foe && bs.foe.mon, 'foe');
    rebuildSide(plr, bs && bs.player && bs.player.mon, 'player');

    // --- pokéball (capture pendant le combat) : cachée tant que throwBall()
    // n'a pas été appelé — rien ne tient de ball en main, il n'y a plus de
    // personnage humain visible dans cette scène.
    ball = buildPokeball();
    ballRest.set(FOE_POS.x, FOE_TOP + BALL_R, FOE_POS.z);
    ballHand.set(PLR_POS.x + 0.4, PLR_TOP + 2.1, PLR_POS.z + 0.9);
    ball.position.copy(ballHand);
    ball.visible = false;
    scene.add(ball);

    // Cadrage initial (au cas où onResize ne serait pas encore passé)
    if (typeof window !== 'undefined') onResize(window.innerWidth, window.innerHeight);
  }

  function exit() {
    if (!scene) { bs = null; return; }
    clearFx();

    // Tout le décor de l'arène est bâti avec les géométries PARTAGÉES de R3 (ou
    // celles de ownGeo, marquées `shared`) : il n'y a rien à libérer de ce
    // côté-là. Les seules géométries propres au combat sont celles des modèles
    // de créatures et des auras ; R3.disposeTree() sait reconnaître ce qui est
    // partagé (llib et R3 partagent tous deux le même cache de géométries).
    [foe, plr].forEach(function (s) {
      if (!s) return;
      if (s.model) R3.disposeTree(s.model);
      if (s.auraGroup) R3.disposeTree(s.auraGroup);
      if (s.blob && s.blob.material) s.blob.material.dispose();
    });

    while (scene.children.length) scene.remove(scene.children[0]);

    scene = null; camera = null;
    sunLight = rimLight = hemiLight = punchLight = null;
    cloudRing = null; ball = null; foe = null; plr = null; bs = null;
    foePlat = null; plrPlat = null; ballAnim = null;
  }

  function onResize(w, h) {
    if (!camera || !w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ===========================================================================
  //  MISE À JOUR
  // ===========================================================================

  /** dt peut arriver en secondes (moteur 3D) ou en millisecondes (logique 2D
   *  reprise telle quelle) : au-delà d'une demi-seconde, ce sont des ms. */
  function normDt(dt) {
    if (!dt || dt < 0) return 0;
    const s = dt > 0.5 ? dt / 1000 : dt;
    return Math.min(0.05, s);
  }

  function updateCamera(dts) {
    // Travelling : arrivée en douceur puis lente respiration autour de l'arène.
    // Un légendaire (de l'un ou l'autre camp) recule la caméra et allonge
    // l'entrée en scène : « il doit occuper l'écran ».
    const introDur = Math.max((foe && foe.introDur) || 1.2, ((plr && plr.introDur) || 1.2) * 0.6, 1.2);
    const pull = (foe && foe.legendary ? 1.5 : 0) + (plr && plr.legendary ? 0.5 : 0);
    const e = R3.easeOut(R3.clamp01(time / introDur));
    const ang = R3.lerp(0.34, -0.05, e) + Math.sin(time * 0.155) * 0.10;
    const rad = R3.lerp(10.6 + pull, 7.55 + pull, e) + Math.sin(time * 0.11) * 0.18;
    const hgt = R3.lerp(5.0 + pull * 0.3, 2.72 + pull * 0.35, e) + Math.sin(time * 0.23) * 0.08;

    camShake = Math.max(0, camShake - dts * 0.85);
    const sx = (Math.random() - 0.5) * camShake, sy = (Math.random() - 0.5) * camShake;

    camera.position.set(Math.sin(ang) * rad + sx, hgt + sy, Math.cos(ang) * rad - 0.55);
    camera.lookAt(CAM_LOOK.x, CAM_LOOK.y + Math.sin(time * 0.19) * 0.05, CAM_LOOK.z);

    // Coup de zoom à l'impact : le champ se resserre d'un coup puis se rouvre.
    if (zoomPunch > 0.001) {
      zoomPunch = Math.max(0, zoomPunch - dts * 4.2);
      const f = CAM_FOV - zoomPunch * 3.4;
      if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
    } else if (Math.abs(camera.fov - CAM_FOV) > 0.01) {
      camera.fov = CAM_FOV;
      camera.updateProjectionMatrix();
    }

    if (punchLight) punchLight.intensity = Math.max(0, punchLight.intensity - dts * 14);
    if (cloudRing) cloudRing.rotation.y += dts * 0.006;
  }

  /** Pop d'apparition à l'entrée en combat (et après un swapIn). */
  function updateIntro(s, dts) {
    s.introT += dts;
    const p = R3.clamp01(s.introT / s.introDur);
    s.shrink = R3.easeOut(p);
    if (s.legendary && !s.introFxDone && p > 0.7) {
      s.introFxDone = true;
      const c = new THREE.Vector3(s.base.x, s.holder.position.y + 0.8 * s.scale, s.base.z);
      fxRing(c, '#ffe27a', 2.1, false);
      fxSparks(c, 16, '#fff3c8', 1.8);
      camShake = Math.max(camShake, 0.18);
    }
    if (p >= 1) { s.shrink = 1; s.introDone = true; }
  }

  /** Changement de créature (swapIn) : la sortante rentre « dans sa ball »
   *  (rotation + rétrécissement + gerbe blanche), puis la nouvelle jaillit
   *  avec une gerbe d'étoiles dorées — reconstruite via rebuildSide(). */
  function updateSwap(s, dts) {
    const sw = s.swap;
    sw.t += dts;
    if (sw.phase === 'out') {
      const dur = 0.5;
      const p = R3.clamp01(sw.t / dur);
      s.shrink = 1 - R3.easeInOut(p);
      s.pivot.rotation.y += dts * 10;
      if (!sw.puffDone && p > 0.08) {
        sw.puffDone = true;
        const c = new THREE.Vector3(s.base.x, s.holder.position.y + 0.4 * s.scale, s.base.z);
        fxRing(c, '#ffffff', 1.1, false);
        fxSparks(c, 10, '#ffe9b8', 1.2);
      }
      if (p >= 1) {
        rebuildSide(s, sw.nextMon, sideKeyOf(s), { skipIntro: true });
        sw.phase = 'in'; sw.t = 0; sw.puffDone = false;
        s.shrink = 0.001;
      }
    } else {
      const dur = 0.55;
      const p = R3.clamp01(sw.t / dur);
      s.shrink = R3.easeOut(p);
      if (!sw.starsDone && p > 0.03) {
        sw.starsDone = true;
        const c = new THREE.Vector3(s.base.x, s.holder.position.y + 0.5 * s.scale, s.base.z);
        fxStars(c, 18);
        fxRing(c, '#ffe27a', 1.6, false);
      }
      if (p >= 1) { s.shrink = 1; s.swap = null; }
    }
  }

  /** Animations communes : intro, changement, attaque, recul, K.O., respiration. */
  function updateSide(s, dts) {
    if (!s || !s.model) return;
    const t = R3.clock.t;

    if (s.swap) {
      updateSwap(s, dts);
      s.holder.visible = s.visible && s.shrink > 0.02;
      if (s.blob) s.blob.material.opacity = 0.28 * s.shrink;
      s.pivot.scale.setScalar(s.scale * s.shrink);
      if (s.auraGroup) {
        s.auraGroup.visible = s.shrink > 0.05;
        const LL = R3.get('llib');
        if (LL && LL.animateAura) { try { LL.animateAura(s.auraGroup, t); } catch (e) { /* rien de bloquant */ } }
      }
      return;
    }

    if (!s.introDone) updateIntro(s, dts);

    s.holder.visible = s.visible && s.shrink > 0.02;
    if (s.blob) s.blob.material.opacity = 0.28 * s.shrink;

    // --- attaque (ou soin, déclenchés par notifyMove) ---
    let attacking = false;
    if (s.atkT >= 0) {
      s.atkT += dts;
      const p = R3.clamp01(s.atkT / s.atkDur);
      attacking = true;
      const isHeal = s.atkIsHeal;
      // élan : on bondit vers l'adversaire puis on revient (pas de bond pour un soin)
      const push = isHeal ? 0 : (p < 0.4 ? R3.easeOut(p / 0.4) : 1 - R3.easeInOut((p - 0.4) / 0.6));
      s.pivot.position.set(0, Math.sin(p * Math.PI) * (isHeal ? 0.10 : 0.18), 0);
      if (!isHeal) {
        s.holder.position.x = s.base.x + s.atkDir.x * 0.62 * push;
        s.holder.position.z = s.base.z + s.atkDir.z * 0.62 * push;
      }

      const model = s.model;
      if (typeof model.userData.attack === 'function') {
        try { model.userData.attack(model, p); }
        catch (e) { attacking = false; }
      } else {
        // repli générique : la créature se penche en avant et se ramasse
        model.rotation.x = -Math.sin(p * Math.PI) * (isHeal ? 0.12 : 0.45);
        const sq = 1 + Math.sin(p * Math.PI) * (isHeal ? 0.06 : 0.10);
        model.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      }

      if (!s.impactDone && p >= 0.40) {
        s.impactDone = true;
        if (isHeal) {
          playFx(sideKeyOf(s), s.atkMove);
        } else if (s.atkTarget) {
          playFx(sideKeyOf(s), s.atkMove);
          s.atkTarget.hitT = 0;
          s.atkTarget.hitDir.copy(s.atkDir);
        }
      }
      if (bs && bs.anim && bs.anim.side === sideKeyOf(s)) bs.anim.progress = p;

      if (p >= 1) {
        s.atkT = -1;
        s.holder.position.x = s.base.x;
        s.holder.position.z = s.base.z;
        s.pivot.position.set(0, 0, 0);
        if (typeof s.model.userData.attack === 'function') {
          try { s.model.userData.attack(s.model, 0); } catch (e) { /* pose de repos */ }
        } else {
          s.model.rotation.x = 0; s.model.scale.set(1, 1, 1);
        }
        attacking = false;
        if (bs && bs.anim && bs.anim.side === sideKeyOf(s)) bs.anim.progress = 1;
      }
    }

    // --- recul après avoir été touché ---
    if (s.hitT >= 0) {
      s.hitT += dts;
      const p = R3.clamp01(s.hitT / s.hitDur);
      const kick = Math.sin(Math.min(1, p * 3.2) * Math.PI * 0.5) * (1 - p);
      s.holder.position.x = s.base.x + s.hitDir.x * 0.34 * kick;
      s.holder.position.z = s.base.z + s.hitDir.z * 0.34 * kick;
      s.pivot.rotation.z = Math.sin(p * 34) * 0.10 * (1 - p);
      if (p >= 1) {
        s.hitT = -1;
        s.pivot.rotation.z = 0;
        s.holder.position.x = s.base.x;
        s.holder.position.z = s.base.z;
      }
    }

    // --- K.O. ---
    if (s.faint >= 0) {
      s.faint += dts;
      const p = R3.clamp01(s.faint / 0.9);
      s.pivot.rotation.x = R3.easeOut(p) * 1.35;
      s.pivot.position.y = -R3.easeOut(p) * 0.12;
      if (s.blob) s.blob.material.opacity = 0.28 * (1 - p * 0.6);
      attacking = true;   // on gèle la respiration
    }

    // --- respiration / flottement (si rien d'autre ne joue) ---
    if (!attacking) {
      R3.idleCreature(s.model, t, s.phase);
      s.pivot.rotation.z = R3.damp(s.pivot.rotation.z, 0, 0.001, dts);
    }

    // --- aura d'un légendaire ---
    if (s.auraGroup) {
      const LL = R3.get('llib');
      if (LL && LL.animateAura) { try { LL.animateAura(s.auraGroup, t); } catch (e) { /* rien de bloquant */ } }
    }

    // --- rétrécissement (fin d'intro / éventuel effet à venir) ---
    s.pivot.scale.setScalar(s.scale * s.shrink);
    if (s.shrink < 1) s.pivot.rotation.y += dts * 9 * (1 - s.shrink);
    else s.pivot.rotation.y = R3.damp(s.pivot.rotation.y, 0, 0.002, dts);
  }

  // ---------------------------------------------------------------------------
  //  CAPTURE PENDANT LE COMBAT — throwBall()
  //  Timings identiques au jeu 2D et au contrat : lancer 0→600 ms, secousses
  //  600→1800 ms (3 cycles de 400 ms), résultat à 1800 ms. Le déroulé écrit sa
  //  progression dans battleState.ball pour que hud3d puisse en tenir compte.
  // ---------------------------------------------------------------------------

  function throwBall(chance, cb) {
    if (!scene || !foe) { if (cb) cb('escaped'); return; }
    if (ballAnim && ballAnim.active) return;   // un seul lancer à la fois
    const c = (typeof chance === 'number' && isFinite(chance)) ? R3.clamp01(chance) : 0.3;
    ballAnim = {
      active: true, t: 0, chance: c, cb: cb, result: null,
      suctionDone: false, resultDone: false, lastShakeIdx: -1, sparkleTimer: 0, done: false,
    };
    ball.visible = true;
    setBallOpen(ball, 0);
    setBallLit(ball, false);
    ball.scale.setScalar(1);
    ball.position.copy(ballHand);
    ball.rotation.set(0, 0, 0);
    if (bs) bs.ball = { active: true, progress: 0, shakeIndex: 0, result: null };
  }

  function updateBall(dts) {
    if (!ballAnim || !ballAnim.active) return;
    const A = ballAnim;
    A.t += dts * 1000;
    ball.visible = true;

    if (A.t < T_THROW) {
      // ----- parabole 0 → 600 ms, rotation rapide -----
      const p = A.t / T_THROW;
      ball.position.lerpVectors(ballHand, ballRest, p);
      ball.position.y += Math.sin(p * Math.PI) * 2.15;
      ball.rotation.x -= dts * 21;
      ball.rotation.z -= dts * 8;
      foe.shrink = 1;
      foe.visible = true;
    } else if (A.t < T_RESULT) {
      // ----- atterrissage + aspiration + 3 secousses de 400 ms -----
      if (!A.suctionDone) {
        A.suctionDone = true;
        const cc = new THREE.Vector3(FOE_POS.x, FOE_TOP + 0.55, FOE_POS.z);
        fxSuction(cc, ballRest);
        fxRing(new THREE.Vector3(FOE_POS.x, FOE_TOP + 0.05, FOE_POS.z), '#ffe9b8', 1.9);
        fxSparks(ballRest, 12, '#ffd9a0', 1.4);
        camShake = Math.max(camShake, 0.2);
        if (punchLight) { punchLight.position.copy(ballRest); punchLight.intensity = 2.6; punchLight.color.set('#ffd9a0'); }
      }

      // la créature est happée en 0,22 s
      const st = A.t - T_THROW;
      foe.shrink = R3.clamp01(1 - st / 220);
      if (foe.shrink <= 0.02) foe.visible = false;

      const idx = Math.floor(st / 400);
      const sp = st % 400;
      if (idx !== A.lastShakeIdx) {
        A.lastShakeIdx = idx;
        if (bs && bs.ball) bs.ball.shakeIndex = idx;
        if (idx > 0) {
          fxSparks(new THREE.Vector3(ballRest.x, ballRest.y + 0.12, ballRest.z), 5, '#ffe27a', 0.9);
          setBallLit(ball, true);
        }
      }
      // Secousse : 300 ms de balancement, 100 ms de repos, direction alternée.
      let tilt = 0, hop = 0;
      if (sp < 300) {
        const q = sp / 300;
        const dir = (idx % 2 === 0) ? -1 : 1;
        tilt = dir * 0.44 * Math.sin(q * Math.PI);
        hop = Math.sin(q * Math.PI) * 0.055;
      } else {
        setBallLit(ball, false);
      }
      ball.position.set(ballRest.x, ballRest.y + hop, ballRest.z);
      ball.rotation.set(
        R3.damp(ball.rotation.x, 0.14, 0.0005, dts),
        R3.damp(ball.rotation.y, 0, 0.0005, dts),
        tilt
      );
      if (bs && bs.ball) bs.ball.progress = R3.clamp01(A.t / T_RESULT);
    } else {
      if (!A.resultDone) {
        A.resultDone = true;
        A.result = (Math.random() < A.chance) ? 'caught' : 'escaped';
        if (bs && bs.ball) { bs.ball.result = A.result; bs.ball.progress = 1; }
        if (A.result === 'caught') {
          // ----- CAPTURE : éclair de lumière + gerbe d'étoiles dorées -----
          fxFlash('#ffffff', 0.5, 0.9);
          fxStars(new THREE.Vector3(ballRest.x, ballRest.y + 0.2, ballRest.z), 20);
          fxRing(new THREE.Vector3(ballRest.x, FOE_TOP + 0.05, ballRest.z), '#ffe27a', 2.4);
          setBallLit(ball, true);
          camShake = Math.max(camShake, 0.22);
          if (punchLight) { punchLight.position.copy(ballRest); punchLight.intensity = 6; punchLight.color.set('#fff3c8'); }
          foe.visible = false;
          foe.shrink = 0;
        } else {
          // ----- ÉCHEC : la ball s'ouvre, fumée, la créature ressort -----
          fxSmoke(new THREE.Vector3(ballRest.x, ballRest.y + 0.1, ballRest.z), 14);
          fxRing(new THREE.Vector3(ballRest.x, FOE_TOP + 0.05, ballRest.z), '#e8eef4', 2.0);
          setBallLit(ball, false);
          camShake = Math.max(camShake, 0.12);
          foe.visible = true;
          foe.shrink = 0.001;
        }
        if (A.cb) { try { A.cb(A.result); } catch (e) { console.error('[battle3d] callback throwBall :', e); } }
      }

      const rt = (A.t - T_RESULT) / 1000 + 0.0001;   // secondes depuis le résultat
      if (A.result === 'caught') {
        // la ball s'élève et scintille, comme le drawCaptureSparkles du 2D
        ball.position.set(ballRest.x, ballRest.y + Math.min(0.22, rt * 0.5) + Math.sin(rt * 2.4) * 0.03, ballRest.z);
        ball.rotation.set(0.14, rt * 1.2, 0);
        A.sparkleTimer -= dts;
        if (A.sparkleTimer <= 0) {
          A.sparkleTimer = 0.42;
          const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.5;
          fxSparks(new THREE.Vector3(ballRest.x + Math.sin(a) * r, ballRest.y + 0.1 + Math.random() * 0.7,
            ballRest.z + Math.cos(a) * r), 4, '#ffe27a', 0.5);
        }
        if (rt > 1.6 && !A.done) { A.done = true; A.active = false; if (bs && bs.ball) bs.ball.active = false; }
      } else {
        // ouverture de la ball, la créature réapparaît avec un petit rebond
        setBallOpen(ball, R3.clamp01(rt / 0.28));
        const pop = R3.clamp01((rt - 0.10) / 0.45);
        foe.visible = true;
        foe.shrink = pop <= 0 ? 0.001 : (1 + Math.sin(pop * Math.PI) * 0.18) * R3.easeOut(pop);
        if (foe.shrink > 1.18) foe.shrink = 1.18;
        if (pop >= 1) foe.shrink = 1;
        foe.pivot.position.y = Math.max(0, Math.sin(pop * Math.PI) * 0.28);
        // la ball retombe et disparaît
        const fall = R3.clamp01((rt - 0.5) / 0.6);
        ball.position.set(ballRest.x, ballRest.y - fall * 0.06, ballRest.z + fall * 0.35);
        ball.rotation.z = fall * 1.2;
        ball.scale.setScalar(Math.max(0.001, 1 - fall));
        if (fall >= 1) {
          ball.visible = false;
          if (!A.done) { A.done = true; A.active = false; if (bs && bs.ball) bs.ball.active = false; }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  FIN DE COMBAT — flourish selon bs.result, une seule fois
  // ---------------------------------------------------------------------------
  function updateResultPhase() {
    if (resultDone || !bs) return;
    resultDone = true;
    if (bs.result === 'win') {
      foe.faint = 0;
      const c = new THREE.Vector3(foe.base.x, foe.holder.position.y + 0.7 * foe.scale, foe.base.z);
      fxSmoke(c, 10);
      fxStars(new THREE.Vector3(foe.base.x, foe.holder.position.y + 0.9, foe.base.z), 20);
      fxFlash('#ffffff', 0.45, 0.7);
      camShake = Math.max(camShake, 0.2);
    } else if (bs.result === 'lose') {
      plr.faint = 0;
      fxSmoke(new THREE.Vector3(plr.base.x, plr.holder.position.y + 0.6, plr.base.z), 10);
      camShake = Math.max(camShake, 0.12);
    } else if (bs.result === 'caught') {
      // Le ball a déjà tout joué (throwBall) : on s'assure juste que l'adversaire
      // reste invisible pour la suite de l'écran de fin.
      foe.visible = false; foe.shrink = 0;
    } else if (bs.result === 'escaped' || bs.result === 'fled') {
      // Fuite (du joueur ou de l'adversaire) : un petit nuage de poussière et
      // rien de plus spectaculaire, le combat se referme vite.
      fxSmoke(new THREE.Vector3(plr.base.x, plr.holder.position.y + 0.3, plr.base.z), 6);
    }
  }

  // ---------------------------------------------------------------------------
  //  API publique
  // ---------------------------------------------------------------------------

  function update(dt, battleState) {
    if (!scene) return;
    let dts = normDt(dt);

    // ARRÊT SUR IMAGE : pendant les ~65 ms qui suivent un impact, le temps du
    // combat est ralenti à 15 %. La minuterie, elle, s'écoule en temps RÉEL —
    // sinon le gel durerait indéfiniment.
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dts);
      dts *= 0.15;
    }

    time += dts;
    if (battleState) bs = battleState;

    updateCamera(dts);
    updateFx(dts);
    updateBall(dts);

    if (bs) {
      try {
        if (bs.phase === 'result') updateResultPhase();
      } catch (e) {
        console.error('[battle3d] erreur de mise à jour :', e);
      }
    }

    updateSide(foe, dts);
    updateSide(plr, dts);
  }

  function render(renderer) {
    if (!scene || !camera || !renderer) return;
    const prev = renderer.autoClear;
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = prev;
  }

  /**
   * game3d annonce qu'un coup vient de partir : c'est CE QUI DÉCLENCHE
   * l'animation (élan, effet visuel au bon moment, recul de la cible). Écrit
   * aussi bs.anim pour que hud3d / game3d puissent suivre la progression sans
   * avoir à deviner les timings internes.
   *   side : 'player' | 'foe'   (le camp qui AGIT)
   *   move : entrée de moves3d (peut être absente : on retombe sur un coup neutre)
   */
  /**
   * @param {object} [res] résultat du calcul de dégâts (moves3d.compute) :
   *        { mult, crit, missed }. Facultatif — sert seulement à savoir si le
   *        coup doit être SPECTACULAIRE (super efficace / critique) ou sobre.
   */
  function notifyMove(side, move, res) {
    if (!scene || !bs) return;
    const sk = (side === 'foe') ? 'foe' : 'player';
    const A = (sk === 'foe') ? foe : plr;
    const D = (sk === 'foe') ? plr : foe;
    if (!A || !A.model) return;

    let force = 1;
    if (res) {
      if (res.missed) force = 0.45;
      else {
        if (res.mult > 1.05) force += 0.45;
        else if (res.mult < 0.95) force -= 0.25;
        if (res.crit) force += 0.35;
      }
    }
    A.atkForce = force;

    animSeqLocal++;
    if (!bs.anim) bs.anim = {};
    bs.anim.seq = animSeqLocal;
    bs.anim.side = sk;
    bs.anim.moveId = move && move.id;
    bs.anim.fx = move && move.fx;
    bs.anim.progress = 0;

    A.atkMove = move || null;
    A.atkIsHeal = !!(move && move.heal);
    A.atkT = 0;
    A.atkDur = A.atkIsHeal ? 0.9 : 0.85;
    A.impactDone = false;
    A.atkTarget = A.atkIsHeal ? null : D;
    if (!A.atkIsHeal && D) A.atkDir.set(D.base.x - A.base.x, 0, D.base.z - A.base.z).normalize();
  }

  /**
   * Change la créature active d'un camp, en scène : la sortante rentre dans
   * sa ball, la nouvelle en jaillit avec une gerbe d'étoiles (voir updateSwap).
   *   side : 'player' | 'foe'
   *   mon  : le nouveau Mon (team3d) à afficher
   */
  function swapIn(side, mon) {
    if (!scene) return;
    const s = (side === 'foe') ? foe : plr;
    if (!s) return;
    s.atkT = -1; s.hitT = -1; s.faint = -1;   // on interrompt toute animation en cours
    s.swap = { phase: 'out', t: 0, nextMon: mon, puffDone: false, starsDone: false };
  }

  /**
   * Joue l'effet visuel d'une capacité. Peut être appelée directement par
   * game3d (contrôle fin), ou est appelée automatiquement par le déroulé
   * interne de notifyMove() au moment de l'impact.
   *   side : 'player' | 'foe'   (celui qui AGIT — la cible est déduite : le
   *          camp adverse, ou soi-même si `move.heal`)
   */
  function playFx(side, move) {
    if (!scene) return;
    const sk = (side === 'foe') ? 'foe' : 'player';
    const A = (sk === 'foe') ? foe : plr;
    const D = (sk === 'foe') ? plr : foe;
    if (!A) return;
    const m = move || {};
    const T = R3.get('types');
    const color = (T && T.color) ? T.color(m.type) : NEUTRAL_COLOR;
    const origin = new THREE.Vector3(A.base.x, A.holder.position.y + 0.6 * A.scale, A.base.z);

    if (m.heal) {
      const self = new THREE.Vector3(A.base.x, A.holder.position.y + 0.15, A.base.z);
      fxHeal(self, 1.4 * A.scale, color);
      return;
    }

    const target = (D && D.model)
      ? new THREE.Vector3(D.base.x, D.holder.position.y + 0.7 * D.scale, D.base.z)
      : origin.clone();

    // Départ du coup : une lueur de charge sur l'attaquant, pour que l'œil
    // parte de lui avant de suivre l'effet.
    fxGlow(origin, color, 2.2, 0.30, 0.8);
    camShake = Math.max(camShake, 0.10);
    // `fxForce` reste posée jusqu'au prochain coup : certains effets (le
    // projectile, par exemple) n'appellent fxImpact() qu'à la fin de leur vol.
    fxForce = (typeof A.atkForce === 'number') ? A.atkForce : 1;
    dispatchFx(m.fx, origin, target, color);
  }

  R3.register('battle', {
    enter: enter,
    exit: exit,
    onResize: onResize,
    update: update,
    render: render,
    notifyMove: notifyMove,
    swapIn: swapIn,
    playFx: playFx,
    throwBall: throwBall,
    // Accès pratique pour le débogage / les tests hors contrat.
    get scene() { return scene; },
    get camera() { return camera; },
  });
})();
