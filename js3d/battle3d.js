// =============================================================================
//  battle3d.js — LA SCÈNE DE COMBAT EN 3D
// =============================================================================
//  Le combat est le moment fort du jeu : on lui offre sa PROPRE scène Three.js,
//  sa propre caméra (léger travelling permanent) et un éclairage plus contrasté
//  que celui du monde ouvert.
//
//  Timings repris À L'IDENTIQUE du jeu 2D (js/game.js, updateBattle) :
//      0    → 600 ms   lancer de la pokéball en parabole
//      600  → 1800 ms  3 secousses de 400 ms
//      1800 ms         résultat (capture ou fuite)
//
//  Les barres de PV et le menu de capacités sont en HTML (hud3d.js) : rien de
//  tout cela n'est dessiné ici.
//
//  Repères de la scène (mêmes axes que le monde : x droite, y haut, z vers la
//  caméra) : l'adversaire est au fond à droite, le camp du joueur au premier
//  plan à gauche, la caméra recule vers +z.
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
  const HUMAN_SCALE = 1.55; // le dresseur-joueur (combat sauvage)

  const BALL_R = 0.19;

  const CAM_LOOK = new THREE.Vector3(-0.10, 1.25, -0.40);

  // ---------------------------------------------------------------------------
  //  Ambiance d'arène par biome — mélange des couleurs du combat 2D
  //  (drawBattleBackground) et de R3.biomeMood.
  //    plat     : 'grass' | 'sand' | 'stone' | 'snow'
  //    backdrop : 'trees' | 'meadow' | 'water' | 'dunes' | 'peaks' | 'city' | 'village'
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

  /** Nombre de particules ajusté à la qualité choisie. */
  function qCount(n) {
    if (!R3.quality.particles) return Math.max(3, Math.round(n * 0.25));
    if (R3.quality.level === 'medium') return Math.max(4, Math.round(n * 0.65));
    return n;
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

  let ball = null;            // groupe pokéball
  let ballRest = new THREE.Vector3();
  let ballHand = new THREE.Vector3();

  let foe = null, plr = null; // les deux camps (voir makeSide)
  const fxList = [];          // effets en cours

  // Horloge locale du combat sauvage, en millisecondes : on ne dépend pas de
  // battleState.animTick (unité incertaine selon l'appelant), on recompte ici.
  let wildT = 0;
  let lastShakeIdx = -1;
  let suctionDone = false, resultDone = false, sparkleTimer = 0;

  // Combat de dresseur
  let lastFoeHp = 0, lastPlrHp = 0, explicitMoves = false;
  const evQueue = [];

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
      model: null, human: false,
      base: basePos.clone(),
      scale: 1,
      phase: Math.random() * 6.28,
      atkT: -1, atkDur: 0.8, atkDir: new THREE.Vector3(), impactDone: false, atkTarget: null,
      hitT: -1, hitDur: 0.5, hitDir: new THREE.Vector3(),
      shrink: 1,       // 1 = normal, 0 = aspiré dans la ball
      faint: -1,       // animation de K.O.
      visible: true,
      blob: null,      // ombre douce de contact
    };
  }

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
          'void main() {',
          '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
          '  vec3 c = mix(uBot, uMid, smoothstep(0.30, 0.52, h));',
          '  c = mix(c, uTop, smoothstep(0.50, 0.95, h));',
          // petit halo de soleil, en haut à gauche, pour donner une direction
          '  float s = max(0.0, dot(vDir, normalize(vec3(-0.45, 0.50, -0.72))));',
          '  c += vec3(1.0, 0.94, 0.76) * pow(s, 16.0) * 0.40;',
          '  gl_FragColor = vec4(c, 1.0);',
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

  function setBallOpen(p) {
    if (!ball) return;
    ball.userData.hingeTop.rotation.x = -p * 1.55;
    ball.userData.hingeBot.rotation.x = p * 0.28;
  }

  function setBallLit(on) {
    if (!ball) return;
    ball.userData.lens.material = on ? ball.userData.matLit : ball.userData.matDim;
  }

  // ===========================================================================
  //  EFFETS — chaque effet est une petite machine autonome avec sa durée de vie
  // ===========================================================================

  function spawnFx(e) {
    e.age = 0;
    if (e.group) scene.add(e.group);
    fxList.push(e);
    return e;
  }

  function killFx(e) {
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
    if (e.mats) e.mats.forEach(function (m) { m.dispose(); });
    if (e.onEnd) e.onEnd();
  }

  function updateFx(dts) {
    for (let i = fxList.length - 1; i >= 0; i--) {
      const e = fxList[i];
      e.age += dts;
      const p = e.age / e.life;
      if (p >= 1) { killFx(e); fxList.splice(i, 1); continue; }
      if (e.update) e.update(p, e);
    }
  }

  function clearFx() {
    while (fxList.length) killFx(fxList.pop());
  }

  /** Gerbe d'étoiles dorées (capture réussie / victoire). */
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

  /** Petites étincelles rapides. */
  function fxSparks(pos, n, color, spread) {
    n = qCount(n || 10);
    const m = fxMat(color || '#fff0c8', true, 1);
    const g = new THREE.Group();
    const parts = [];
    const sp = spread || 1.6;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(R3.geo.sphere(1, 8), m);
      s.position.copy(pos);
      s.scale.setScalar(0.035 + Math.random() * 0.045);
      s.castShadow = false;
      g.add(s);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      parts.push({
        mesh: s, p0: pos.clone(),
        v: new THREE.Vector3(Math.cos(b) * Math.sin(a), Math.sin(b) * 0.8 + 0.6, Math.cos(b) * Math.cos(a))
          .multiplyScalar(sp * (0.5 + Math.random())),
      });
    }
    spawnFx({
      group: g, mats: [m], life: 0.6,
      update: function (p) {
        const t = p * 0.6;
        parts.forEach(function (q) {
          q.mesh.position.set(q.p0.x + q.v.x * t, q.p0.y + q.v.y * t - 1.6 * t * t, q.p0.z + q.v.z * t);
        });
        m.opacity = 1 - p * p;
      },
    });
  }

  /** Nuage de fumée (la créature qui ressort de la ball). */
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

  /** Anneau de choc qui s'élargit au sol ou dans l'air. */
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

  /** Éclat d'impact : halo + anneau + étincelles + petite secousse. */
  function fxImpact(pos, color) {
    const m = fxMat(color || '#fff0c8', true, 0.95);
    const halo = new THREE.Mesh(R3.geo.sphere(1, 12), m);
    halo.position.copy(pos);
    halo.castShadow = false;
    const g = new THREE.Group();
    g.add(halo);
    spawnFx({
      group: g, mats: [m], life: 0.32,
      update: function (p) {
        halo.scale.setScalar(0.2 + p * 0.85);
        m.opacity = 0.95 * (1 - p);
      },
    });
    fxRing(pos, color || '#ffffff', 1.5, false);
    fxSparks(pos, 14, color || '#fff0c8', 2.2);
    camShake = Math.max(camShake, 0.16);
    if (punchLight) {
      punchLight.position.copy(pos);
      punchLight.intensity = 3.2;
      punchLight.color.set(color || '#fff0c8');
    }
  }

  /** Spirale de particules vertes montantes : un soin a été utilisé. */
  function fxHeal(pos, height) {
    const m = fxMat('#7ef0a0', true, 1);
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
    const crossMat = fxMat('#b8ffcf', true, 1);
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

  /** Éclair de lumière plein écran (capture réussie). */
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
      onEnd: function () { if (quad.parent) quad.parent.remove(quad); },
    });
  }

  // ===========================================================================
  //  ENTRÉE / SORTIE
  // ===========================================================================

  function resolvePlayerCreature(b) {
    if (b && b.playerCreature) return b.playerCreature;
    if (b && b.starter) return b.starter;
    if (typeof window !== 'undefined' && window.GAME3D && window.GAME3D.state && window.GAME3D.state.starter) {
      return window.GAME3D.state.starter;
    }
    if (typeof state !== 'undefined' && state && state.starter) return state.starter;
    return null;
  }

  /** Silhouette de dresseur de secours, si actors3d.js n'est pas là. */
  function fallbackHuman() {
    const g = R3.group(
      R3.cyl(0.16, 0.20, 0.42, '#3b5dc9', 0, 0.24, 0),
      R3.ellipsoid(0.19, 0.24, 0.16, '#41a6f6', 0, 0.62, 0),
      R3.sphere(0.16, '#f6c8a0', 0, 0.90, 0),
      R3.ellipsoid(0.19, 0.10, 0.19, '#e5402f', 0, 1.00, 0),
      R3.box(0.34, 0.06, 0.10, '#e5402f', 0, 0.99, 0.14),
      R3.cyl(0.05, 0.05, 0.34, '#f6c8a0', -0.22, 0.62, 0),
      R3.cyl(0.05, 0.05, 0.34, '#f6c8a0', 0.22, 0.62, 0),
      R3.cyl(0.06, 0.06, 0.26, '#2c3a63', -0.09, 0.10, 0),
      R3.cyl(0.06, 0.06, 0.26, '#2c3a63', 0.09, 0.10, 0)
    );
    return g;
  }

  function buildHuman() {
    const actors = R3.get('actors');
    if (actors && typeof actors.buildPlayer === 'function') {
      try {
        const g = actors.buildPlayer();
        if (g) { g.userData.fromActors = true; return g; }
      } catch (e) { console.warn('[battle3d] buildPlayer indisponible :', e); }
    }
    return fallbackHuman();
  }

  function attachModel(side, model, scale, blobR) {
    side.model = model;
    side.scale = scale;
    model.position.set(0, 0, 0);
    model.userData.baseY = 0;
    side.pivot.add(model);
    side.pivot.scale.setScalar(scale);
    if (!side.blob) {
      side.blob = contactBlob(blobR || 0.45 * scale);
      side.blob.position.set(0, 0.012, 0);
      side.holder.add(side.blob);
    }
  }

  function pushHud() {
    const hud = R3.get('hud');
    if (!hud || !bs || !bs.isTrainer || typeof hud.setHP !== 'function') return;
    try {
      const pc = resolvePlayerCreature(bs);
      hud.setHP('foe', bs.trainerHp, bs.trainerMaxHp, bs.trainerCreature && bs.trainerCreature.name);
      hud.setHP('player', bs.playerHp, bs.playerMaxHp, pc && pc.name);
    } catch (e) { /* le HUD gère ses propres soucis */ }
  }

  function enter(battleState, biome) {
    if (scene) exit();

    bs = battleState || null;
    biomeCur = biome || 'plain';
    const a = arena(biomeCur);
    const mood = R3.biomeMood(biomeCur);

    time = 0; camShake = 0; wildT = 0; lastShakeIdx = -1;
    suctionDone = false; resultDone = false; sparkleTimer = 0;
    explicitMoves = false;
    evQueue.length = 0;

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
    const foePlat = buildPlatform(platKind, FOE_PLAT_R, FOE_PLAT_H);
    foePlat.position.set(FOE_POS.x, 0, FOE_POS.z);
    foePlat.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
    scene.add(foePlat);

    const plrPlat = buildPlatform(platKind, PLR_PLAT_R, PLR_PLAT_H);
    plrPlat.position.set(PLR_POS.x, 0, PLR_POS.z);
    plrPlat.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
    scene.add(plrPlat);

    // --- les deux camps ---
    // L'adversaire regarde vers le joueur (donc à peu près vers la caméra),
    // le camp du joueur nous tourne le dos.
    foe = makeSide(FOE_POS, FOE_TOP, -0.30);
    plr = makeSide(PLR_POS, PLR_TOP, 2.78);
    scene.add(foe.holder, plr.holder);

    const isTrainer = !!(bs && bs.isTrainer);
    const foeCreature = bs ? (isTrainer ? bs.trainerCreature : bs.creature) : null;
    const foeId = foeCreature && foeCreature.id;
    attachModel(foe, R3.buildCreature(foeId || 'feuillou'), FOE_SCALE, 0.42 * FOE_SCALE);

    if (isTrainer) {
      const pc = resolvePlayerCreature(bs);
      attachModel(plr, R3.buildCreature((pc && pc.id) || 'feuillou'), PLR_SCALE, 0.42 * PLR_SCALE);
    } else {
      plr.human = true;
      attachModel(plr, buildHuman(), HUMAN_SCALE, 0.30 * HUMAN_SCALE);
    }
    [foe, plr].forEach(function (s) {
      s.holder.traverse(function (o) {
        if (o.isMesh && o !== s.blob) { o.castShadow = true; o.receiveShadow = true; }
      });
    });

    // --- pokéball (combat sauvage uniquement) ---
    ball = buildPokeball();
    ballRest.set(FOE_POS.x, FOE_TOP + BALL_R, FOE_POS.z);
    ballHand.set(PLR_POS.x + 0.45, PLR_TOP + 0.95, PLR_POS.z + 0.30);
    ball.position.copy(ballHand);
    ball.visible = !isTrainer;
    scene.add(ball);

    if (isTrainer) {
      lastFoeHp = bs.trainerHp | 0;
      lastPlrHp = bs.playerHp | 0;
      pushHud();
    }

    // Cadrage initial (au cas où onResize ne serait pas encore passé)
    if (typeof window !== 'undefined') onResize(window.innerWidth, window.innerHeight);
  }

  function exit() {
    if (!scene) { bs = null; return; }
    clearFx();

    // Tout le décor de l'arène est bâti avec les géométries PARTAGÉES de R3 (ou
    // celles de ownGeo, marquées `shared`) : il n'y a rien à libérer de ce
    // côté-là. Les seules géométries propres au combat sont celles des modèles
    // de créatures ; R3.disposeTree() sait reconnaître ce qui est partagé.
    [foe, plr].forEach(function (s) {
      if (s && s.model) R3.disposeTree(s.model);
      if (s && s.blob && s.blob.material) s.blob.material.dispose();
    });

    while (scene.children.length) scene.remove(scene.children[0]);

    scene = null; camera = null;
    sunLight = rimLight = hemiLight = punchLight = null;
    cloudRing = null; ball = null; foe = null; plr = null; bs = null;
    evQueue.length = 0;
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
    const e = R3.easeOut(R3.clamp01(time / 1.2));
    const ang = R3.lerp(0.34, -0.05, e) + Math.sin(time * 0.155) * 0.10;
    const rad = R3.lerp(10.6, 7.55, e) + Math.sin(time * 0.11) * 0.18;
    const hgt = R3.lerp(5.0, 2.72, e) + Math.sin(time * 0.23) * 0.08;

    camShake = Math.max(0, camShake - dts * 0.85);
    const sx = (Math.random() - 0.5) * camShake, sy = (Math.random() - 0.5) * camShake;

    camera.position.set(Math.sin(ang) * rad + sx, hgt + sy, Math.cos(ang) * rad - 0.55);
    camera.lookAt(CAM_LOOK.x, CAM_LOOK.y + Math.sin(time * 0.19) * 0.05, CAM_LOOK.z);

    if (punchLight) punchLight.intensity = Math.max(0, punchLight.intensity - dts * 14);
    if (cloudRing) cloudRing.rotation.y += dts * 0.006;
  }

  /** Animations communes : respiration, attaque, recul, K.O., aspiration. */
  function updateSide(s, dts) {
    if (!s || !s.model) return;
    const t = R3.clock.t;

    s.holder.visible = s.visible && s.shrink > 0.02;
    if (s.blob) s.blob.material.opacity = 0.28 * s.shrink;

    // --- attaque ---
    let attacking = false;
    if (s.atkT >= 0) {
      s.atkT += dts;
      const p = R3.clamp01(s.atkT / s.atkDur);
      attacking = true;
      // élan : on bondit vers l'adversaire puis on revient
      const push = p < 0.4 ? R3.easeOut(p / 0.4) : 1 - R3.easeInOut((p - 0.4) / 0.6);
      s.pivot.position.set(0, Math.sin(p * Math.PI) * 0.18, 0);
      s.holder.position.x = s.base.x + s.atkDir.x * 0.62 * push;
      s.holder.position.z = s.base.z + s.atkDir.z * 0.62 * push;

      const model = s.model;
      if (typeof model.userData.attack === 'function') {
        try { model.userData.attack(model, p); }
        catch (e) { attacking = false; }
      } else {
        // repli générique : la créature se penche en avant et se ramasse
        model.rotation.x = -Math.sin(p * Math.PI) * 0.45;
        const sq = 1 + Math.sin(p * Math.PI) * 0.10;
        model.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      }

      if (!s.impactDone && p >= 0.40) {
        s.impactDone = true;
        const D = s.atkTarget;
        if (D) {
          const c = new THREE.Vector3(D.base.x, D.holder.position.y + 0.75 * D.scale, D.base.z);
          fxImpact(c, '#fff0c8');
          D.hitT = 0;
          D.hitDir.copy(s.atkDir);
        }
      }
      if (p >= 1) {
        s.atkT = -1;
        s.holder.position.x = s.base.x;
        s.holder.position.z = s.base.z;
        s.pivot.position.set(0, 0, 0);
        if (typeof s.model.userData.attack === 'function') {
          try { s.model.userData.attack(s.model, 0); } catch (e) { /* pose de repos */ }
        } else {
          s.model.rotation.x = 0;
        }
        attacking = false;
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
      if (s.human) {
        // Si actors3d est là, on lui laisse animer le personnage (dir 'down' :
        // c'est le porteur qui l'oriente, on ne veut pas qu'il se retourne).
        const actors = s.model.userData.fromActors ? R3.get('actors') : null;
        if (actors && typeof actors.updatePlayer === 'function') {
          try { actors.updatePlayer(s.model, { moving: false, moveProgress: 0, dir: 'down', t: t }); }
          catch (e) { s.model.userData.fromActors = false; }
        } else {
          // le dresseur respire simplement et se balance à peine
          const b = 1 + Math.sin(t * 2.0 + s.phase) * 0.025;
          s.model.scale.set(1 / Math.sqrt(b), b, 1 / Math.sqrt(b));
          s.model.rotation.z = Math.sin(t * 0.9 + s.phase) * 0.02;
        }
      } else {
        R3.idleCreature(s.model, t, s.phase);
      }
      s.pivot.rotation.z = R3.damp(s.pivot.rotation.z, 0, 0.001, dts);
    }

    // --- aspiration dans la pokéball ---
    s.pivot.scale.setScalar(s.scale * s.shrink);
    if (s.shrink < 1) s.pivot.rotation.y += dts * 9 * (1 - s.shrink);
    else s.pivot.rotation.y = R3.damp(s.pivot.rotation.y, 0, 0.002, dts);
  }

  // ---------------------------------------------------------------------------
  //  COMBAT SAUVAGE — mêmes phases et mêmes durées que le jeu 2D
  // ---------------------------------------------------------------------------
  function updateWild(dts) {
    const ph = bs.phase;

    if (ph === 'intro' || ph === 'await') {
      // La ball attend dans la main du joueur, elle tourne doucement.
      wildT = 0; lastShakeIdx = -1;
      suctionDone = false; resultDone = false;
      ball.visible = true;
      setBallOpen(0);
      setBallLit(false);
      ball.position.set(ballHand.x, ballHand.y + Math.sin(R3.clock.t * 2.2) * 0.03, ballHand.z);
      ball.rotation.set(0.18, R3.clock.t * 0.7, 0);
      foe.shrink = 1;
      foe.visible = true;
      return;
    }

    if (ph === 'throw') {
      wildT += dts * 1000;
      ball.visible = true;

      if (wildT < T_THROW) {
        // ----- parabole 0 → 600 ms, rotation rapide -----
        const p = wildT / T_THROW;
        ball.position.lerpVectors(ballHand, ballRest, p);
        ball.position.y += Math.sin(p * Math.PI) * 2.15;
        ball.rotation.x -= dts * 21;
        ball.rotation.z -= dts * 8;
        // le joueur se penche dans son lancer
        if (plr.human) plr.pivot.rotation.x = -Math.sin(R3.clamp01(p * 2) * Math.PI) * 0.22;
        foe.shrink = 1;
        foe.visible = true;
      } else if (wildT < T_RESULT) {
        // ----- atterrissage + aspiration + 3 secousses de 400 ms -----
        if (!suctionDone) {
          suctionDone = true;
          const cc = new THREE.Vector3(FOE_POS.x, FOE_TOP + 0.55, FOE_POS.z);
          fxSuction(cc, ballRest);
          fxRing(new THREE.Vector3(FOE_POS.x, FOE_TOP + 0.05, FOE_POS.z), '#ffe9b8', 1.9);
          fxSparks(ballRest, 12, '#ffd9a0', 1.4);
          camShake = 0.2;
          if (punchLight) { punchLight.position.copy(ballRest); punchLight.intensity = 2.6; punchLight.color.set('#ffd9a0'); }
        }
        if (plr.human) plr.pivot.rotation.x = R3.damp(plr.pivot.rotation.x, 0, 0.002, dts);

        // la créature est happée en 0,22 s
        const st = wildT - T_THROW;
        foe.shrink = R3.clamp01(1 - st / 220);
        if (foe.shrink <= 0.02) foe.visible = false;

        const idx = Math.floor(st / 400);
        const sp = st % 400;
        if (idx !== lastShakeIdx) {
          lastShakeIdx = idx;
          if (idx > 0) {
            fxSparks(new THREE.Vector3(ballRest.x, ballRest.y + 0.12, ballRest.z), 5, '#ffe27a', 0.9);
            setBallLit(true);
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
          setBallLit(false);
        }
        ball.position.set(ballRest.x, ballRest.y + hop, ballRest.z);
        ball.rotation.set(
          R3.damp(ball.rotation.x, 0.14, 0.0005, dts),
          R3.damp(ball.rotation.y, 0, 0.0005, dts),
          tilt
        );
      } else {
        // La logique du jeu (game3d) va basculer en 'result' : on tient la pose.
        ball.position.copy(ballRest);
        ball.rotation.set(0.14, 0, 0);
      }
      return;
    }

    if (ph === 'result') {
      wildT = Math.max(wildT, T_RESULT);
      if (plr.human) plr.pivot.rotation.x = R3.damp(plr.pivot.rotation.x, 0, 0.002, dts);

      if (!resultDone) {
        resultDone = true;
        if (bs.result === 'caught') {
          // ----- CAPTURE : éclair de lumière + gerbe d'étoiles dorées -----
          fxFlash('#ffffff', 0.5, 0.9);
          fxStars(new THREE.Vector3(ballRest.x, ballRest.y + 0.2, ballRest.z), 20);
          fxRing(new THREE.Vector3(ballRest.x, FOE_TOP + 0.05, ballRest.z), '#ffe27a', 2.4);
          setBallLit(true);
          camShake = 0.22;
          if (punchLight) { punchLight.position.copy(ballRest); punchLight.intensity = 6; punchLight.color.set('#fff3c8'); }
          foe.visible = false;
          foe.shrink = 0;
        } else {
          // ----- ÉCHEC : la ball s'ouvre, fumée, la créature ressort -----
          fxSmoke(new THREE.Vector3(ballRest.x, ballRest.y + 0.1, ballRest.z), 14);
          fxRing(new THREE.Vector3(ballRest.x, FOE_TOP + 0.05, ballRest.z), '#e8eef4', 2.0);
          setBallLit(false);
          camShake = 0.12;
          foe.visible = true;
          foe.shrink = 0.001;
        }
      }

      const rt = (wildT - T_RESULT) / 1000 + 0.0001;   // secondes depuis le résultat
      wildT += dts * 1000;

      if (bs.result === 'caught') {
        // la ball s'élève et scintille, comme le drawCaptureSparkles du 2D
        ball.position.set(ballRest.x, ballRest.y + Math.min(0.22, rt * 0.5) + Math.sin(rt * 2.4) * 0.03, ballRest.z);
        ball.rotation.set(0.14, rt * 1.2, 0);
        sparkleTimer -= dts;
        if (sparkleTimer <= 0) {
          sparkleTimer = 0.42;
          const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.5;
          fxSparks(new THREE.Vector3(ballRest.x + Math.sin(a) * r, ballRest.y + 0.1 + Math.random() * 0.7,
            ballRest.z + Math.cos(a) * r), 4, '#ffe27a', 0.5);
        }
      } else {
        // ouverture de la ball, la créature réapparaît avec un petit rebond
        setBallOpen(R3.clamp01(rt / 0.28));
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
        if (fall >= 1) ball.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  COMBAT DE DRESSEUR
  // ---------------------------------------------------------------------------
  function queueEvent(type, side, delay) {
    evQueue.push({ type: type, side: side, at: time + delay, started: false });
  }

  function startEvent(ev) {
    const A = ev.side === 'player' ? plr : foe;
    const D = ev.side === 'player' ? foe : plr;
    if (!A || !A.model) return;
    if (ev.type === 'attack') {
      A.atkT = 0;
      A.atkDur = 0.8;
      A.impactDone = false;
      A.atkTarget = D;
      A.atkDir.set(D.base.x - A.base.x, 0, D.base.z - A.base.z).normalize();
    } else {
      fxHeal(new THREE.Vector3(A.base.x, A.holder.position.y + 0.05, A.base.z), 1.5 * A.scale);
    }
  }

  function updateTrainer(dts) {
    // Détection des coups : on compare les PV d'une frame à l'autre. game3d peut
    // aussi nous prévenir explicitement via notifyMove() (plus précis).
    if (!explicitMoves) {
      const dFoe = (bs.trainerHp | 0) - lastFoeHp;
      const dPlr = (bs.playerHp | 0) - lastPlrHp;
      if (dFoe !== 0 || dPlr !== 0) {
        if (dFoe < 0) queueEvent('attack', 'player', 0);
        if (dPlr > 0) queueEvent('heal', 'player', 0);
        if (dPlr < 0) queueEvent('attack', 'foe', 0.9);
        if (dFoe > 0) queueEvent('heal', 'foe', 0.9);
        lastFoeHp = bs.trainerHp | 0;
        lastPlrHp = bs.playerHp | 0;
        pushHud();
      }
    }

    for (let i = evQueue.length - 1; i >= 0; i--) {
      const ev = evQueue[i];
      if (!ev.started && time >= ev.at) {
        ev.started = true;
        startEvent(ev);
        evQueue.splice(i, 1);
      }
    }

    // Une fois K.O., la créature reste visible, effondrée : c'est plus lisible
    // qu'une disparition sèche (le jeu 2D, lui, la faisait disparaître).
    foe.visible = (foe.faint >= 0) ? true : (bs.creatureVisible !== false);

    if (bs.phase === 'result' && !resultDone) {
      resultDone = true;
      const c = new THREE.Vector3(foe.base.x, foe.holder.position.y + 0.7 * foe.scale, foe.base.z);
      if (bs.result === 'win') {
        foe.faint = 0;
        fxSmoke(c, 10);
        fxStars(new THREE.Vector3(foe.base.x, foe.holder.position.y + 0.9, foe.base.z), 20);
        fxFlash('#ffffff', 0.45, 0.7);
        camShake = 0.2;
      } else if (bs.result === 'lose') {
        plr.faint = 0;
        fxSmoke(new THREE.Vector3(plr.base.x, plr.holder.position.y + 0.6, plr.base.z), 10);
        camShake = 0.12;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  API publique
  // ---------------------------------------------------------------------------

  function update(dt, battleState) {
    if (!scene) return;
    const dts = normDt(dt);
    time += dts;
    if (battleState) bs = battleState;

    updateCamera(dts);
    updateFx(dts);

    if (bs) {
      try {
        if (bs.isTrainer) updateTrainer(dts); else updateWild(dts);
      } catch (e) {
        console.error('[battle3d] erreur d\'animation :', e);
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
   * (optionnel) game3d peut annoncer précisément un coup, ce qui évite de le
   * deviner à partir des PV. side : 'player' | 'foe'. move : entrée de moves.
   */
  function notifyMove(side, move) {
    if (!scene || !bs || !bs.isTrainer) return;
    explicitMoves = true;
    const delay = (side === 'foe') ? 0.9 : 0;
    queueEvent(move && move.heal ? 'heal' : 'attack', side === 'foe' ? 'foe' : 'player', delay);
    lastFoeHp = bs.trainerHp | 0;
    lastPlrHp = bs.playerHp | 0;
    pushHud();
  }

  R3.register('battle', {
    enter: enter,
    update: update,
    render: render,
    exit: exit,
    onResize: onResize,
    notifyMove: notifyMove,
    get scene() { return scene; },
    get camera() { return camera; },
  });
})();
