// =============================================================================
//  sky3d.js — CIEL, LUMIÈRE ET ATMOSPHÈRE
// =============================================================================
//  C'est ce module qui donne au jeu son « âme visuelle » :
//    - un dôme de ciel en dégradé (shader) avec un vrai soleil et son halo,
//    - un éclairage chaleureux de milieu d'après-midi (soleil + ciel + ambiante),
//    - des ombres nettes grâce à un frustum d'ombre recentré sur le joueur,
//    - un brouillard exponentiel accordé au biome,
//    - des nuages volumétriques légers qui dérivent très au-dessus,
//    - des particules d'ambiance (pollen, scintillements, neige, embruns).
//
//  Tout est procédural : aucune texture sur disque, aucun fetch. Le jeu doit
//  rester jouable en double-cliquant index3d.html.
//
//  API — R3.register('sky', { build, setBiome, update, sun })   (voir CONTRACT.md)
// =============================================================================

(function () {
  'use strict';

  // Dégradation gracieuse : si le socle n'est pas là, on ne casse rien.
  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') {
    if (typeof console !== 'undefined') console.warn('[sky3d] THREE ou R3 absent : module inactif.');
    return;
  }

  // ---------------------------------------------------------------------------
  //  RÉGLAGES GÉNÉRAUX
  // ---------------------------------------------------------------------------

  // Direction DU SOL VERS LE SOLEIL. Milieu d'après-midi : ~42° au-dessus de
  // l'horizon, à gauche et du côté de la caméra (+z). Les faces que Robin voit
  // sont donc éclairées, et les ombres s'étirent vers l'arrière-droite — assez
  // longues pour bien poser les objets au sol, sans faire « coucher de soleil ».
  const SUN_DIR = new THREE.Vector3(-0.55, 0.669, 0.50).normalize();

  const SHADOW_DIST = 70;   // distance de la lumière au joueur (ortho : sans effet visuel)
  const SHADOW_HALF = 17;   // demi-côté du frustum d'ombre (≈ 34 unités de côté)
  const SHADOW_NEAR = 40;
  const SHADOW_FAR = 105;

  const SUN_INTENSITY = 1.10;   // soleil : dominant, mais sans brûler les blancs
  const HEMI_FACTOR = 0.62;     // × R3.biomeMood().ambient
  const AMB_FACTOR = 0.22;      // × R3.biomeMood().ambient

  const TRANSITION_DUR = 1.5;   // secondes, transition d'ambiance entre biomes

  // Densité de brouillard relative, par biome (× R3.quality.fogDensity).
  const FOG_MUL = {
    forest: 1.05, lake: 0.95, plain: 0.90, beach: 0.85, sea: 0.95,
    park: 0.90, city: 1.00, mountain: 1.30, village: 1.00, city2: 1.05,
  };

  // Nuages
  const CLOUD_CLUSTERS = 22;
  const CLOUD_PUFFS = 6;                       // maximum de boules par amas
  const CLOUD_FIELD = 360;                     // côté du damier de nuages (bouclé)
  const CLOUD_WIND = { x: 0.85, z: 0.30 };     // unités/seconde

  // Particules
  const PART_MAX = 300;
  const PART_HALF = 20;                        // demi-côté de la boîte autour du joueur

  // ---------------------------------------------------------------------------
  //  LUMIÈRES — créées tout de suite pour que `api.sun` existe dès le chargement.
  // ---------------------------------------------------------------------------

  const sun = new THREE.DirectionalLight(0xfff3d6, SUN_INTENSITY);
  sun.position.copy(SUN_DIR).multiplyScalar(SHADOW_DIST);
  sun.castShadow = true;
  sun.shadow.camera.left = -SHADOW_HALF;
  sun.shadow.camera.right = SHADOW_HALF;
  sun.shadow.camera.top = SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = SHADOW_NEAR;
  sun.shadow.camera.far = SHADOW_FAR;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.028;   // évite l'acné sur le terrain lissé
  sun.shadow.mapSize.set(R3.quality.shadowSize, R3.quality.shadowSize);

  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x6d9a52, 0.4);
  hemi.position.set(0, 40, 0);

  const ambient = new THREE.AmbientLight(0xfff2e0, 0.15);

  // ---------------------------------------------------------------------------
  //  ÉTAT DU MODULE
  // ---------------------------------------------------------------------------

  const S = {
    scene: null,
    root: new THREE.Group(),
    dome: null,
    clouds: null,        // THREE.InstancedMesh
    cloudData: [],
    points: null,        // THREE.Points
    part: null,          // données CPU des particules
    biome: 'plain',
    from: null, to: null,
    mix: 1,              // avancement de la transition (1 = terminée)
    pType: null,         // type de particules réellement affiché
    pFade: 1,            // opacité globale des particules (fondu de transition)
    pSwap: false,        // la transition en cours change-t-elle de particules ?
    renderer: null,
    built: false,
    pending: null,       // biome demandé avant build()
    px: 0, pz: 0,        // dernière position du joueur transmise à update()
  };

  // Couleurs de travail (évite d'allouer une THREE.Color par frame).
  const _c = [0, 1, 2, 3, 4, 5, 6].map(function () { return new THREE.Color(); });
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const _dummy = new THREE.Object3D();

  // ---------------------------------------------------------------------------
  //  AMBIANCE : on dérive de R3.biomeMood() toutes les couleurs dont on a besoin.
  // ---------------------------------------------------------------------------

  const DEEP_BLUE = new THREE.Color('#2a68cf');   // pour saturer le zénith
  const WHITE = new THREE.Color('#ffffff');
  const WARM = new THREE.Color('#ffe6bd');

  function makeMood(biome) {
    const m = R3.biomeMood(biome);
    const sky = new THREE.Color(m.sky);
    const fog = new THREE.Color(m.fog);
    return {
      biome: biome,
      // Dégradé du dôme : horizon clair -> ciel -> zénith plus profond.
      top: sky.clone().lerp(DEEP_BLUE, 0.58),
      mid: sky.clone(),
      bot: fog.clone().lerp(WHITE, 0.20),
      fog: fog.clone(),
      sun: new THREE.Color(m.sun),
      hemiSky: sky.clone().lerp(WHITE, 0.28),
      hemiGround: new THREE.Color(m.ground).lerp(WARM, 0.28),
      ambI: m.ambient * AMB_FACTOR,
      hemiI: m.ambient * HEMI_FACTOR,
      fogMul: FOG_MUL[biome] || 1,
      particles: m.particles || null,
    };
  }

  // ---------------------------------------------------------------------------
  //  DÔME DE CIEL — ShaderMaterial minimal : dégradé vertical + disque solaire.
  // ---------------------------------------------------------------------------

  const SKY_VERT = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = normalize(position);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n');

  // NOTE COULEURS : un ShaderMaterial écrit sa couleur telle quelle dans le
  // framebuffer (three n'applique la conversion de sortie qu'à ses propres
  // shaders). Les uniformes arrivent donc en espace LINÉAIRE (comme toutes les
  // THREE.Color) et on fait nous-mêmes la conversion linéaire -> sRGB, sans
  // dépendre du nom interne des ShaderChunk. Un micro-tramage supprime le
  // « banding » disgracieux des grands aplats de ciel.
  const SKY_FRAG = [
    'uniform vec3 topColor;',
    'uniform vec3 midColor;',
    'uniform vec3 botColor;',
    'uniform vec3 sunColor;',
    'uniform vec3 sunDir;',
    'varying vec3 vDir;',
    'vec3 toSRGB(vec3 c) {',
    '  c = max(c, vec3(0.0));',
    '  return mix(pow(c, vec3(0.4166667)) * 1.055 - 0.055, c * 12.92,',
    '             vec3(lessThanEqual(c, vec3(0.0031308))));',
    '}',
    // Le corps du shader reste en ASCII pur : certains pilotes refusent les
    // caractères accentués, même à l'intérieur d'un commentaire GLSL.
    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float h = clamp(d.y, -1.0, 1.0);',
    '  // degrade : voile clair sur l\'horizon, ciel, puis zenith sature',
    '  float t1 = smoothstep(-0.10, 0.26, h);',
    '  float t2 = smoothstep(0.16, 0.88, h);',
    '  vec3 col = mix(botColor, midColor, t1);',
    '  col = mix(col, topColor, t2);',
    '  // halo du soleil : une nappe large et chaude, puis un coeur brillant',
    '  float sd = max(dot(d, sunDir), 0.0);',
    '  col += sunColor * pow(sd, 5.0) * 0.14;',
    '  col += sunColor * pow(sd, 80.0) * 0.55;',
    '  // disque solaire (rayon apparent ~1.3 degre), bord legerement adouci',
    '  float disk = smoothstep(0.99955, 0.99982, sd);',
    '  col = mix(col, sunColor * 1.30 + vec3(0.10), disk);',
    '  vec3 outc = toSRGB(col);',
    '  float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  outc += (dith - 0.5) / 255.0;',
    '  gl_FragColor = vec4(outc, 1.0);',
    '}',
  ].join('\n');

  function buildDome() {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    const matSky = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#4aa8e8') },
        midColor: { value: new THREE.Color('#8fd3f4') },
        botColor: { value: new THREE.Color('#c8e9f7') },
        sunColor: { value: new THREE.Color('#fff3d6') },
        sunDir: { value: SUN_DIR.clone() },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,   // le dôme est peint en premier, tout se dessine par-dessus
      fog: false,
    });

    const dome = new THREE.Mesh(geo, matSky);
    dome.renderOrder = -10000;
    dome.frustumCulled = false;
    dome.castShadow = false;
    dome.receiveShadow = false;
    dome.matrixAutoUpdate = true;

    // Le dôme se recale sur la caméra juste avant d'être rendu : il ne peut donc
    // jamais être coupé par le plan lointain, quelle que soit la caméra utilisée.
    dome.onBeforeRender = function (renderer, scene, camera) {
      camera.getWorldPosition(_v1);
      dome.position.copy(_v1);
      const far = (camera.far && isFinite(camera.far)) ? camera.far : 500;
      const r = Math.max(20, far * 0.45);
      dome.scale.set(r, r, r);
      dome.updateMatrixWorld(true);
    };
    return dome;
  }

  // ---------------------------------------------------------------------------
  //  NUAGES — un seul InstancedMesh (1 draw call) : des boules très aplaties
  //  groupées en amas, qui dérivent avec le vent et bouclent autour du joueur.
  // ---------------------------------------------------------------------------

  function buildClouds() {
    // Matériau partagé : on passe par R3.mat() (cache global) avec une signature
    // d'options unique, puis on coupe le brouillard — sinon les nuages, très
    // lointains, seraient noyés dans la brume et invisibles.
    const m = R3.mat('#ffffff', {
      transparent: true, opacity: 0.88, rough: 1, metal: 0,
      depthWrite: false, emissive: '#cfe6ff', emissiveIntensity: 0.30,
      skyTag: 'cloud',
    });
    m.fog = false;

    const count = CLOUD_CLUSTERS * CLOUD_PUFFS;
    const im = new THREE.InstancedMesh(R3.geo.sphere(1, 12), m, count);
    im.frustumCulled = false;
    im.castShadow = false;
    im.receiveShadow = false;
    im.renderOrder = -100;   // juste après le ciel, avant le monde

    const rnd = R3.rng(20260728);
    S.cloudData.length = 0;
    for (let i = 0; i < CLOUD_CLUSTERS; i++) {
      const puffs = [];
      const n = 3 + Math.floor(rnd() * (CLOUD_PUFFS - 2));   // 3 à 6 boules
      const big = 5 + rnd() * 7;
      for (let p = 0; p < n; p++) {
        const s = big * (0.55 + rnd() * 0.65);
        puffs.push({
          dx: (rnd() - 0.5) * big * 2.1,
          dy: (rnd() - 0.5) * big * 0.35,
          dz: (rnd() - 0.5) * big * 1.5,
          sx: s, sy: s * (0.30 + rnd() * 0.16), sz: s * (0.72 + rnd() * 0.30),
          ry: rnd() * Math.PI,
        });
      }
      // Les amas non utilisés sont « rangés » hors champ (échelle nulle).
      while (puffs.length < CLOUD_PUFFS) puffs.push(null);
      S.cloudData.push({
        x: (rnd() - 0.5) * CLOUD_FIELD,
        z: (rnd() - 0.5) * CLOUD_FIELD,
        y: 30 + rnd() * 20,
        puffs: puffs,
      });
    }
    return im;
  }

  function updateClouds(dt, px, pz) {
    if (!S.clouds) return;
    const half = CLOUD_FIELD * 0.5;
    let k = 0;
    for (let i = 0; i < S.cloudData.length; i++) {
      const c = S.cloudData[i];
      c.x += CLOUD_WIND.x * dt;
      c.z += CLOUD_WIND.z * dt;
      // Bouclage autour du joueur : le ciel paraît infini.
      let rx = c.x - px, rz = c.z - pz;
      if (rx > half) { c.x -= CLOUD_FIELD; rx -= CLOUD_FIELD; }
      else if (rx < -half) { c.x += CLOUD_FIELD; rx += CLOUD_FIELD; }
      if (rz > half) { c.z -= CLOUD_FIELD; rz -= CLOUD_FIELD; }
      else if (rz < -half) { c.z += CLOUD_FIELD; rz += CLOUD_FIELD; }

      for (let p = 0; p < CLOUD_PUFFS; p++) {
        const f = c.puffs[p];
        if (!f) {
          _dummy.position.set(0, -9999, 0);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(0.0001, 0.0001, 0.0001);
        } else {
          _dummy.position.set(px + rx + f.dx, c.y + f.dy, pz + rz + f.dz);
          _dummy.rotation.set(0, f.ry, 0);
          _dummy.scale.set(f.sx, f.sy, f.sz);
        }
        _dummy.updateMatrix();
        S.clouds.setMatrixAt(k++, _dummy.matrix);
      }
    }
    S.clouds.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  //  PARTICULES D'AMBIANCE
  // ---------------------------------------------------------------------------

  // Petite pastille douce dessinée dans un canvas : ni fichier, ni fetch.
  function makeDotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0.00, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.70, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1.00, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Réglages par type de particule.
  const PART_STYLE = {
    pollen: {
      size: 0.20, count: 1.0, additive: true,
      colors: ['#ffe08a', '#fff3c0', '#ffd15c'],
      yMin: 0.2, yMax: 11, vy: [0.10, 0.34], drift: 0.22, sway: 0.30, twinkle: 1.4, base: 0.55,
    },
    sparkle: {
      size: 0.24, count: 0.85, additive: true,
      colors: ['#ffffff', '#c8f0ff', '#fff6cc'],
      yMin: 0.1, yMax: 8, vy: [-0.06, 0.14], drift: 0.10, sway: 0.18, twinkle: 3.2, base: 0.0,
    },
    snow: {
      size: 0.30, count: 1.0, additive: false,
      colors: ['#ffffff', '#eaf5ff', '#d9ecff'],
      yMin: 0.0, yMax: 14, vy: [-1.15, -0.45], drift: 0.30, sway: 0.55, twinkle: 0.7, base: 0.85,
    },
    spray: {
      size: 0.22, count: 0.9, additive: false,
      colors: ['#ffffff', '#dff1ff', '#bfe4f7'],
      yMin: 0.0, yMax: 3.2, vy: [0.15, 0.55], drift: 0.9, sway: 0.7, twinkle: 1.9, base: 0.35,
    },
  };

  function buildParticles() {
    const pos = new Float32Array(PART_MAX * 3);
    const col = new Float32Array(PART_MAX * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));   // itemSize 4 = alpha par point
    g.setDrawRange(0, 0);

    const m = new THREE.PointsMaterial({
      size: 0.22,
      map: makeDotTexture(),
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.castShadow = false;
    pts.receiveShadow = false;
    pts.visible = false;

    S.part = {
      pos: pos, col: col, n: 0,
      vx: new Float32Array(PART_MAX),
      vy: new Float32Array(PART_MAX),
      vz: new Float32Array(PART_MAX),
      ph: new Float32Array(PART_MAX),
      style: null,
      lx: 0, lz: 0,                 // dernière position connue du joueur
      rnd: R3.rng(913377),
    };
    return pts;
  }

  function particleCount() {
    if (!R3.quality.particles) return 0;
    const lvl = R3.quality.level;
    if (lvl === 'low') return 0;
    if (lvl === 'medium') return 150;
    return 260;
  }

  function seedParticle(i, st, full) {
    const P = S.part, r = P.rnd;
    const b3 = i * 3, b4 = i * 4;
    P.pos[b3] = (r() - 0.5) * 2 * PART_HALF;
    P.pos[b3 + 2] = (r() - 0.5) * 2 * PART_HALF;
    // À l'apparition on répartit sur toute la hauteur ; ensuite on ré-injecte
    // par le bas (ou par le haut pour la neige).
    P.pos[b3 + 1] = full ? st.yMin + r() * (st.yMax - st.yMin)
                         : (st.vy[1] > 0 ? st.yMin : st.yMax);
    P.vx[i] = (r() - 0.5) * 2 * st.drift;
    P.vz[i] = (r() - 0.5) * 2 * st.drift;
    P.vy[i] = st.vy[0] + r() * (st.vy[1] - st.vy[0]);
    P.ph[i] = r() * Math.PI * 2;
    const c = _c[6].set(st.colors[Math.floor(r() * st.colors.length) % st.colors.length]);
    P.col[b4] = c.r; P.col[b4 + 1] = c.g; P.col[b4 + 2] = c.b; P.col[b4 + 3] = 0;
  }

  function setParticleType(type) {
    S.pType = type || null;
    if (!S.points) return;
    const st = PART_STYLE[S.pType];
    const n = st ? Math.round(particleCount() * st.count) : 0;
    S.part.style = st || null;
    S.part.n = Math.min(n, PART_MAX);
    S.points.visible = S.part.n > 0;
    if (!st || S.part.n === 0) {
      S.points.geometry.setDrawRange(0, 0);
      return;
    }
    S.points.material.size = st.size;
    S.points.material.blending = st.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    S.points.material.needsUpdate = true;
    S.part.lx = S.px; S.part.lz = S.pz;
    for (let i = 0; i < S.part.n; i++) seedParticle(i, st, true);
    S.points.geometry.setDrawRange(0, S.part.n);
    S.points.geometry.attributes.position.needsUpdate = true;
    S.points.geometry.attributes.color.needsUpdate = true;
  }

  function updateParticles(t, dt, px, pz) {
    if (!S.points || !S.points.visible) return;
    const P = S.part, st = P.style;
    if (!st || P.n === 0) return;

    // La boîte suit le joueur, MAIS les particules doivent rester dans le monde :
    // on retranche donc aux coordonnées locales le déplacement du joueur, sinon
    // le pollen collerait à lui comme un essaim de mouches.
    S.points.position.set(px, 0, pz);
    const shx = px - P.lx, shz = pz - P.lz;
    P.lx = px; P.lz = pz;

    const H = PART_HALF, span = H * 2;

    for (let i = 0; i < P.n; i++) {
      const b3 = i * 3, b4 = i * 4;
      const ph = P.ph[i];
      const sway = Math.sin(t * 0.9 + ph) * st.sway;
      let x = P.pos[b3] - shx + (P.vx[i] + sway) * dt;
      let y = P.pos[b3 + 1] + P.vy[i] * dt;
      let z = P.pos[b3 + 2] - shz + (P.vz[i] + Math.cos(t * 0.7 + ph * 1.7) * st.sway * 0.6) * dt;

      // Bouclage horizontal (modulo exact : résiste même à une téléportation).
      if (x > H || x < -H) x = ((((x + H) % span) + span) % span) - H;
      if (z > H || z < -H) z = ((((z + H) % span) + span) % span) - H;
      // Recyclage vertical.
      if (y > st.yMax) { y = st.yMin; }
      else if (y < st.yMin) { y = st.yMax; }

      P.pos[b3] = x; P.pos[b3 + 1] = y; P.pos[b3 + 2] = z;

      // Scintillement : le pollen respire doucement, les « sparkle » clignotent.
      const s = Math.sin(t * st.twinkle + ph) * 0.5 + 0.5;
      let a = st.base + (1 - st.base) * (st.twinkle > 2.5 ? s * s * s : s);
      // Fondu près du plafond et du plancher, pour que rien n'apparaisse d'un coup.
      const fh = Math.min(1, (y - st.yMin) / 1.2) * Math.min(1, (st.yMax - y) / 1.6);
      a *= Math.max(0, fh) * S.pFade;
      P.col[b4 + 3] = a;
    }
    S.points.geometry.attributes.position.needsUpdate = true;
    S.points.geometry.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  //  APPLICATION DE L'AMBIANCE (mélange linéaire entre deux ambiances)
  // ---------------------------------------------------------------------------

  function applyBlend(a, b, k) {
    const u = S.dome ? S.dome.material.uniforms : null;
    if (u) {
      u.topColor.value.copy(a.top).lerp(b.top, k);
      u.midColor.value.copy(a.mid).lerp(b.mid, k);
      u.botColor.value.copy(a.bot).lerp(b.bot, k);
      u.sunColor.value.copy(a.sun).lerp(b.sun, k);
    }
    sun.color.copy(a.sun).lerp(b.sun, k);
    hemi.color.copy(a.hemiSky).lerp(b.hemiSky, k);
    hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, k);
    hemi.intensity = R3.lerp(a.hemiI, b.hemiI, k);
    ambient.intensity = R3.lerp(a.ambI, b.ambI, k);

    if (S.scene && S.scene.fog) {
      S.scene.fog.color.copy(a.fog).lerp(b.fog, k);
      S.scene.fog.density = R3.quality.fogDensity * R3.lerp(a.fogMul, b.fogMul, k);
    }
    // Le voile de brume teinte aussi les nuages : ils restent dans le ton du ciel.
    if (S.clouds) S.clouds.material.color.copy(_c[0].copy(a.bot).lerp(b.bot, k)).lerp(WHITE, 0.55);
  }

  // ---------------------------------------------------------------------------
  //  OMBRES — le frustum orthographique suit le joueur, quantifié sur la grille
  //  de texels pour que les ombres ne « grouillent » pas quand on marche.
  // ---------------------------------------------------------------------------

  function updateShadow(px, pz) {
    // Hauteur du terrain sous le joueur, si world3d est déjà là.
    let py = 0;
    const w = R3.get('world');
    if (w && typeof w.heightAt === 'function') {
      try { const h = w.heightAt(px, pz); if (isFinite(h)) py = h; } catch (e) { py = 0; }
    }

    // Base du repère de la lumière : f (axe de visée), r (droite), u (haut).
    _v1.set(0, 0, 0).copy(SUN_DIR).multiplyScalar(-1);            // f = du soleil vers le sol
    _v2.set(0, 1, 0).cross(_v1);                                   // r = up × f
    if (_v2.lengthSq() < 1e-6) _v2.set(1, 0, 0);
    _v2.normalize();
    _v3.copy(_v1).cross(_v2).normalize();                          // u = f × r

    const texel = (SHADOW_HALF * 2) / Math.max(64, sun.shadow.mapSize.x);
    const tx = px, ty = py, tz = pz;
    const a = tx * _v2.x + ty * _v2.y + tz * _v2.z;
    const b = tx * _v3.x + ty * _v3.y + tz * _v3.z;
    const da = Math.round(a / texel) * texel - a;
    const db = Math.round(b / texel) * texel - b;

    const cx = tx + _v2.x * da + _v3.x * db;
    const cy = ty + _v2.y * da + _v3.y * db;
    const cz = tz + _v2.z * da + _v3.z * db;

    sun.target.position.set(cx, cy, cz);
    sun.target.updateMatrixWorld();
    sun.position.set(
      cx + SUN_DIR.x * SHADOW_DIST,
      cy + SUN_DIR.y * SHADOW_DIST,
      cz + SUN_DIR.z * SHADOW_DIST
    );
  }

  // ---------------------------------------------------------------------------
  //  RENDERER — on n'y touche QUE pour les ombres (le reste appartient à game3d).
  // ---------------------------------------------------------------------------

  function findRenderer(explicit) {
    if (explicit && explicit.shadowMap) return explicit;
    const cands = [
      R3.renderer,
      (typeof window !== 'undefined' ? window.RENDERER : null),
      (typeof window !== 'undefined' && window.GAME3D ? window.GAME3D.renderer : null),
    ];
    for (let i = 0; i < cands.length; i++) {
      if (cands[i] && cands[i].shadowMap) return cands[i];
    }
    return null;
  }

  function configureRenderer(r) {
    if (!r) return;
    S.renderer = r;
    r.shadowMap.enabled = !!R3.quality.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // ---------------------------------------------------------------------------
  //  QUALITÉ — on se réadapte à chaud.
  // ---------------------------------------------------------------------------

  R3.onQualityChange(function (q) {
    sun.castShadow = !!q.shadows;
    if (sun.shadow.mapSize.x !== q.shadowSize) {
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (S.renderer) S.renderer.shadowMap.enabled = !!q.shadows;
    if (S.scene && S.scene.fog && S.to) {
      S.scene.fog.density = q.fogDensity * S.to.fogMul;
    }
    if (S.built) setParticleType(q.particles ? (S.to ? S.to.particles : null) : null);
  });

  // ---------------------------------------------------------------------------
  //  API PUBLIQUE
  // ---------------------------------------------------------------------------

  const api = {
    sun: sun,
    hemi: hemi,
    ambient: ambient,
    root: S.root,
    sunDir: SUN_DIR,

    /** Construit le ciel, les lumières, les nuages et les particules. */
    build: function (scene, renderer) {
      if (!scene) return;
      S.scene = scene;
      if (S.built) { scene.add(S.root); return; }

      configureRenderer(findRenderer(renderer));

      S.dome = buildDome();
      S.clouds = buildClouds();
      S.points = buildParticles();

      S.root.add(S.dome, S.clouds, S.points, sun, sun.target, hemi, ambient);
      scene.add(S.root);

      // Brouillard : la couleur exacte sera posée par applyBlend().
      const start = makeMood(S.pending || S.biome);
      scene.fog = new THREE.FogExp2(start.fog.getHex(), R3.quality.fogDensity * start.fogMul);
      scene.background = null;   // c'est le dôme qui fait le fond

      sun.castShadow = !!R3.quality.shadows;
      sun.shadow.mapSize.set(R3.quality.shadowSize, R3.quality.shadowSize);

      S.built = true;
      S.from = start;
      S.to = start;
      S.mix = 1;
      S.biome = start.biome;
      applyBlend(start, start, 1);
      setParticleType(R3.quality.particles ? start.particles : null);
      S.pending = null;

      // Une première mise en place pour que rien ne clignote à la première frame.
      updateClouds(0, 0, 0);
      updateShadow(0, 0);
    },

    /**
     * Change l'ambiance de biome.
     * @param {string} biome    clé de R3.BIOME_MOOD
     * @param {boolean} instant true = pas de transition (chargement, combat…)
     */
    setBiome: function (biome, instant) {
      if (!biome) return;
      if (!S.built) { S.pending = biome; S.biome = biome; return; }
      if (biome === S.biome && S.mix >= 1) return;

      // On repart de l'ambiance RÉELLEMENT affichée (transition interrompue).
      const cur = makeMood(S.biome);
      if (S.mix < 1 && S.from && S.to) {
        const k = R3.easeInOut(S.mix);
        cur.top.copy(S.from.top).lerp(S.to.top, k);
        cur.mid.copy(S.from.mid).lerp(S.to.mid, k);
        cur.bot.copy(S.from.bot).lerp(S.to.bot, k);
        cur.fog.copy(S.from.fog).lerp(S.to.fog, k);
        cur.sun.copy(S.from.sun).lerp(S.to.sun, k);
        cur.hemiSky.copy(S.from.hemiSky).lerp(S.to.hemiSky, k);
        cur.hemiGround.copy(S.from.hemiGround).lerp(S.to.hemiGround, k);
        cur.ambI = R3.lerp(S.from.ambI, S.to.ambI, k);
        cur.hemiI = R3.lerp(S.from.hemiI, S.to.hemiI, k);
        cur.fogMul = R3.lerp(S.from.fogMul, S.to.fogMul, k);
        cur.particles = S.pType;
      }

      S.from = cur;
      S.to = makeMood(biome);
      S.biome = biome;

      const wanted = R3.quality.particles ? S.to.particles : null;
      if (instant) {
        S.mix = 1;
        S.from = S.to;
        S.pFade = 1;
        S.pSwap = false;
        applyBlend(S.to, S.to, 1);
        if (S.pType !== wanted) setParticleType(wanted);
      } else {
        S.mix = 0;
        S.pSwap = (S.pType !== wanted);   // faut-il croiser les particules ?
      }
    },

    /** Appelé chaque frame : suivi du joueur, ombres, nuages, particules. */
    update: function (t, px, pz) {
      if (!S.built) return;
      px = px || 0; pz = pz || 0;
      const dt = Math.min(0.05, R3.clock.dt || 0.016);

      // Le renderer peut n'exister qu'après build() : on retente tant qu'il manque.
      if (!S.renderer) configureRenderer(findRenderer(null));

      // Transition d'ambiance
      if (S.mix < 1) {
        S.mix = Math.min(1, S.mix + dt / TRANSITION_DUR);
        const k = R3.easeInOut(S.mix);
        applyBlend(S.from, S.to, k);

        const wanted = R3.quality.particles ? S.to.particles : null;
        if (S.pSwap) {
          // Les particules disparaissent (k: 0 -> 0.5), changent de nature au
          // milieu de la transition, puis réapparaissent (k: 0.5 -> 1).
          S.pFade = Math.abs(k * 2 - 1);
          if (k >= 0.5 && S.pType !== wanted) setParticleType(wanted);
        } else {
          S.pFade = 1;
        }
        if (S.mix >= 1) {
          S.pFade = 1;
          S.pSwap = false;
          if (S.pType !== wanted) setParticleType(wanted);
        }
      }

      // Le dôme suit la caméra dans onBeforeRender ; on le garde tout de même
      // près du joueur pour les rendus qui n'appelleraient pas ce callback.
      if (S.dome) S.dome.position.set(px, 0, pz);

      updateShadow(px, pz);
      updateClouds(dt, px, pz);
      updateParticles(t, dt, px, pz);

      S.px = px; S.pz = pz;
    },

    /** Permet à game3d de fournir son renderer après coup. */
    setRenderer: function (r) { configureRenderer(findRenderer(r)); },

    /** Biome courant (pratique pour le débogage). */
    currentBiome: function () { return S.biome; },
  };

  R3.register('sky', api);
})();
