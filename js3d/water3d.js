// =============================================================================
//  water3d.js — LES SURFACES D'EAU du « Jeu de Robin » en 3D
// =============================================================================
//  Transpose en volume les 8 animations d'eau du jeu 2D (js/world.js) :
//    drawWater / drawPond  -> 'lake' et 'pond'   (vaguelettes lentes, eau profonde)
//    drawSea               -> 'sea'              (grandes houles, bleu nuit)
//    drawWaves             -> 'waves'            (rouleaux clairs, écume blanche)
//    drawShallow           -> 'shallow'          (bas-fonds turquoise)
//    drawFountain          -> material('fountain') pour le jet des fontaines
//
//  Principe : un MeshStandardMaterial (donc éclairé « pour de vrai » par le soleil
//  de sky3d.js) auquel on greffe, via onBeforeCompile, un petit shader de vagues :
//    - 3 trains sinusoïdaux croisés qui déplacent les sommets ET recalculent
//      analytiquement la normale (d'où le scintillement du soleil sur l'eau) ;
//    - une couleur qui passe du bleu clair des berges au bleu profond du large ;
//    - une ligne d'écume qui lape le rivage, calculée à partir d'un attribut
//      « distance au bord » mesuré une fois pour toutes à la construction ;
//    - une transparence plus forte près des berges (on devine le fond).
//
//  API — voir CONTRACT.md :
//    R3.register('water', { makeSurface(tiles, kind), update(t), material(kind) })
//
//  Repère : les sommets sont en coordonnées MONDE ABSOLUES (x = tuile.x,
//  z = tuile.y) et le mesh reste à l'origine. Les vagues sont donc continues
//  d'une surface à l'autre : deux morceaux de mer voisins ne « cassent » pas.
// =============================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  RÉGLAGES PAR TYPE D'EAU
  //  Couleurs reprises de la palette 2D (#29366f, #3b5dc9, #41a6f6, #73eff7,
  //  #f4f4f4), assombries d'un cran : l'éclairage 3D les réveille.
  //    amp        : hauteur des vagues (unités monde)
  //    freq       : serrement des vagues
  //    speed      : vitesse (calquée sur les cadences du jeu 2D : waves > sea > lac)
  //    deepRange  : distance au bord (en tuiles) au bout de laquelle l'eau est
  //                 « au large »
  //    foamW      : largeur de la frange d'écume, en tuiles
  //    crestFoam  : quantité d'écume sur la crête des vagues
  //    surf       : hauteur préférée de la surface (y monde)
  // ---------------------------------------------------------------------------
  const KINDS = {
    lake: {
      deep: '#23459f', shallow: '#4a9fe8', crest: '#79e8f7', foam: '#dff8fd',
      amp: 0.030, freq: 1.50, speed: 1.00, rough: 0.12, nBoost: 1.7,
      aDeep: 0.90, aEdge: 0.62, deepRange: 1.8, foamW: 0.38, crestFoam: 0.10,
      surf: -0.06,
    },
    sea: {
      deep: '#1c2a63', shallow: '#3b74d0', crest: '#73eff7', foam: '#f4f4f4',
      amp: 0.080, freq: 0.85, speed: 0.95, rough: 0.10, nBoost: 1.4,
      aDeep: 0.95, aEdge: 0.70, deepRange: 2.6, foamW: 0.70, crestFoam: 0.45,
      surf: -0.05,
    },
    waves: {
      deep: '#3fa8e8', shallow: '#79f0f7', crest: '#bff6fb', foam: '#ffffff',
      amp: 0.034, freq: 2.10, speed: 1.70, rough: 0.18, nBoost: 1.8,
      aDeep: 0.72, aEdge: 0.45, deepRange: 1.1, foamW: 0.55, crestFoam: 0.35,
      surf: -0.03,
    },
    shallow: {
      deep: '#2f7fb8', shallow: '#5fc8f0', crest: '#96f2f7', foam: '#e8fbff',
      amp: 0.022, freq: 2.40, speed: 1.25, rough: 0.14, nBoost: 1.8,
      aDeep: 0.74, aEdge: 0.48, deepRange: 1.2, foamW: 0.42, crestFoam: 0.18,
      surf: -0.05,
    },
    pond: {
      deep: '#2a4bb0', shallow: '#4fb2e6', crest: '#86e9f5', foam: '#d8f4fa',
      amp: 0.016, freq: 2.70, speed: 0.75, rough: 0.12, nBoost: 1.9,
      aDeep: 0.90, aEdge: 0.60, deepRange: 1.4, foamW: 0.30, crestFoam: 0.08,
      surf: -0.06,
    },
  };

  // Couleurs THREE pré-calculées (utilisées par le repli « plat »).
  Object.keys(KINDS).forEach(function (k) {
    const P = KINDS[k];
    P._deep = new THREE.Color(P.deep);
    P._shallow = new THREE.Color(P.shallow);
  });

  function params(kind) { return KINDS[kind] || KINDS.lake; }

  // ---------------------------------------------------------------------------
  //  TEMPS PARTAGÉ — un seul uniform pour tous les shaders d'eau : une écriture
  //  par frame suffit à animer la carte entière.
  // ---------------------------------------------------------------------------
  const uTime = { value: 0 };

  // ---------------------------------------------------------------------------
  //  MORCEAUX DE SHADER
  // ---------------------------------------------------------------------------

  // Le train de vagues : renvoie la hauteur et remplit le gradient (pour la normale).
  // `edge` = distance au rivage en tuiles : les vagues s'aplatissent près du bord,
  // sinon elles transperceraient le sable.
  const GLSL_WAVE = [
    'uniform float uTime;',
    'uniform float uAmp;',
    'uniform float uFreq;',
    'uniform float uSpeed;',
    'uniform float uNBoost;',
    'attribute float aEdge;',
    'varying float vEdge;',
    'varying float vWaveH;',
    'varying vec2  vXZ;',
    'float waterWave(vec2 p, float edge, out vec2 grad) {',
    '  float att = smoothstep(0.0, 0.85, edge);',
    '  float a   = uAmp * att;',
    '  vec2  d1  = vec2( 0.94,  0.34);',
    '  vec2  d2  = vec2(-0.38,  0.92);',
    '  vec2  d3  = vec2( 0.72, -0.69);',
    '  float k1 = uFreq, k2 = uFreq * 1.63, k3 = uFreq * 2.71;',
    '  float a1 = a, a2 = a * 0.55, a3 = a * 0.26;',
    '  float s1 = dot(d1, p) * k1 + uTime * uSpeed * 1.10;',
    '  float s2 = dot(d2, p) * k2 - uTime * uSpeed * 1.47;',
    '  float s3 = dot(d3, p) * k3 + uTime * uSpeed * 2.30;',
    '  grad = a1 * k1 * cos(s1) * d1 + a2 * k2 * cos(s2) * d2 + a3 * k3 * cos(s3) * d3;',
    '  return a1 * sin(s1) + a2 * sin(s2) + a3 * sin(s3);',
    '}',
  ].join('\n');

  const GLSL_FRAG_HEAD = [
    'uniform float uTime;',
    'uniform float uAmp;',
    'uniform float uSpeed;',
    'uniform float uDeepRange;',
    'uniform float uFoamW;',
    'uniform float uCrestFoam;',
    'uniform float uADeep;',
    'uniform float uAEdge;',
    'uniform vec3  uDeep;',
    'uniform vec3  uShallow;',
    'uniform vec3  uCrest;',
    'uniform vec3  uFoam;',
    'varying float vEdge;',
    'varying float vWaveH;',
    'varying vec2  vXZ;',
  ].join('\n');

  const GLSL_FRAG_BODY = [
    '{',
    // Du bleu clair des berges au bleu profond du large.
    '  float deepF = smoothstep(0.10, uDeepRange, vEdge);',
    '  vec3  col   = mix(uShallow, uDeep, deepF);',
    // Crêtes plus claires (les pixels #73eff7 du jeu 2D).
    '  float crest = clamp(vWaveH / max(uAmp, 0.0005) * 0.6 + 0.5, 0.0, 1.0);',
    '  col = mix(col, uCrest, smoothstep(0.55, 1.0, crest) * 0.45);',
    // Écume qui lape le rivage : la frange respire, comme un ressac.
    '  float breath = 0.72 + 0.28 * sin(uTime * uSpeed * 1.6 + vXZ.x * 1.3 + vXZ.y * 0.9);',
    '  float fw     = uFoamW * breath;',
    '  float foam   = 1.0 - smoothstep(fw * 0.35, fw, vEdge);',
    // ... plus quelques moutons sur la crête des grosses vagues.
    '  foam = max(foam, smoothstep(0.80, 1.0, crest) * uCrestFoam);',
    '  foam = clamp(foam, 0.0, 1.0);',
    // Paillettes de soleil : petits éclats hautes fréquences sur les pentes.
    '  float glint = sin(vXZ.x * 11.0 + uTime * 1.7) * sin(vXZ.y * 9.0 - uTime * 1.3);',
    '  col += vec3(0.10, 0.14, 0.16) * pow(max(glint, 0.0), 8.0) * (1.0 - foam);',
    '  col = mix(col, uFoam, foam);',
    '  diffuseColor.rgb = col;',
    '  diffuseColor.a   = mix(uAEdge, uADeep, deepF) * (1.0 - foam) + foam * 0.96;',
    '  vFoamOut = foam;',
    '}',
  ].join('\n');

  // ---------------------------------------------------------------------------
  //  MATÉRIAUX
  // ---------------------------------------------------------------------------
  const shaderMats = Object.create(null);   // kind -> matériau à vagues
  const flatMats = Object.create(null);     // kind -> repli plat (waterDetail 0)
  let fountainMat = null;

  // Fabrique commune : une SEULE fonction source pour tous les types d'eau,
  // afin que Three.js réutilise le même programme GPU (customProgramCacheKey
  // repose sur le texte de onBeforeCompile).
  function waterOnBeforeCompile(shader) {
    const P = this.userData.waterParams;

    shader.uniforms.uTime = uTime;                       // uniform PARTAGÉ
    shader.uniforms.uAmp = { value: P.amp };
    shader.uniforms.uFreq = { value: P.freq };
    shader.uniforms.uSpeed = { value: P.speed };
    shader.uniforms.uNBoost = { value: P.nBoost };
    shader.uniforms.uDeepRange = { value: P.deepRange };
    shader.uniforms.uFoamW = { value: P.foamW };
    shader.uniforms.uCrestFoam = { value: P.crestFoam };
    shader.uniforms.uADeep = { value: P.aDeep };
    shader.uniforms.uAEdge = { value: P.aEdge };
    shader.uniforms.uDeep = { value: new THREE.Color(P.deep) };
    shader.uniforms.uShallow = { value: new THREE.Color(P.shallow) };
    shader.uniforms.uCrest = { value: new THREE.Color(P.crest) };
    shader.uniforms.uFoam = { value: new THREE.Color(P.foam) };

    // --- sommet : déplacement + normale analytique -----------------------------
    shader.vertexShader = GLSL_WAVE + '\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      [
        '#include <beginnormal_vertex>',
        'vec2  wGrad;',
        'float wH = waterWave(position.xz, aEdge, wGrad);',
        'objectNormal = normalize(vec3(-wGrad.x * uNBoost, 1.0, -wGrad.y * uNBoost));',
        'vEdge  = aEdge;',
        'vWaveH = wH;',
        'vXZ    = position.xz;',
      ].join('\n')
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.y += wH;'
    );

    // --- fragment : couleur, écume, transparence -------------------------------
    shader.fragmentShader = GLSL_FRAG_HEAD + '\nfloat vFoamOut;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' + GLSL_FRAG_BODY
    );
    // L'écume est mate : elle ne doit pas briller comme le reste de l'eau.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, vFoamOut);'
    );
  }

  /** Matériau « vagues » d'un type d'eau (créé une fois, partagé). */
  function shaderMaterial(kind) {
    if (shaderMats[kind]) return shaderMats[kind];
    const P = params(kind);
    // On part d'un matériau du socle puis on le clone : on ne touche jamais
    // à l'instance mise en cache par R3.mat().
    const m = R3.mat(P.shallow, {
      rough: P.rough, metal: 0.02, transparent: true,
      opacity: P.aDeep, depthWrite: true,
    }).clone();
    m.name = 'water_' + kind;
    m.userData.waterParams = P;
    m.onBeforeCompile = waterOnBeforeCompile;
    m.needsUpdate = true;
    shaderMats[kind] = m;
    return m;
  }

  /** Repli sans shader (R3.quality.waterDetail === 0) : couleur animée seulement. */
  function flatMaterial(kind) {
    if (flatMats[kind]) return flatMats[kind];
    const P = params(kind);
    const m = R3.mat(P.shallow, {
      rough: 0.35, metal: 0.0, transparent: true,
      opacity: (P.aDeep + P.aEdge) * 0.5, depthWrite: true,
    }).clone();
    m.name = 'water_flat_' + kind;
    m.userData.waterKind = kind;
    flatMats[kind] = m;
    return m;
  }

  function currentMaterial(kind) {
    return (R3.quality.waterDetail === 0) ? flatMaterial(kind) : shaderMaterial(kind);
  }

  // ---------------------------------------------------------------------------
  //  MATÉRIAU DE FONTAINE — pour le jet et la vasque (drawFountain du jeu 2D :
  //  jet #73eff7, gouttes #a7d8f0, reflet blanc). Bandes claires qui montent le
  //  long de l'objet : on « voit » l'eau jaillir.
  // ---------------------------------------------------------------------------
  function fountainOnBeforeCompile(shader) {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'varying vec3 vJetPos;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvJetPos = position;'
    );
    shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vJetPos;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      [
        '#include <color_fragment>',
        '{',
        '  float band = 0.5 + 0.5 * sin(vJetPos.y * 24.0 - uTime * 8.0);',
        '  float swirl = 0.5 + 0.5 * sin((vJetPos.x + vJetPos.z) * 30.0 + uTime * 5.0);',
        '  float f = band * 0.75 + swirl * 0.25;',
        '  diffuseColor.rgb = mix(vec3(0.36, 0.78, 0.92), vec3(0.92, 1.00, 1.00), f);',
        '  diffuseColor.a  *= 0.70 + 0.30 * f;',
        '}',
      ].join('\n')
    );
  }

  function fountainMaterial() {
    if (fountainMat) return fountainMat;
    const m = R3.mat('#73eff7', {
      rough: 0.10, metal: 0.0, transparent: true, opacity: 0.68,
      emissive: '#2b8fb8', emissiveIntensity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    }).clone();
    m.name = 'water_fountain';
    if (R3.quality.waterDetail !== 0) {
      m.onBeforeCompile = fountainOnBeforeCompile;
      m.needsUpdate = true;
    }
    fountainMat = m;
    return m;
  }

  // ---------------------------------------------------------------------------
  //  CONSTRUCTION DE LA GÉOMÉTRIE
  // ---------------------------------------------------------------------------
  const surfaces = [];        // toutes les surfaces créées (pour update / qualité)
  const EMPTY_GEO = new THREE.BufferGeometry();

  /**
   * Hauteur de la nappe d'eau : au-dessus du lit (h des tuiles) mais toujours
   * sous le niveau des berges, sinon l'eau déborderait sur le sable.
   */
  function levelFor(kind, maxH) {
    const P = params(kind);
    if (!isFinite(maxH)) return P.surf;
    return Math.min(-0.02, Math.max(maxH + 0.04, P.surf));
  }

  /**
   * makeSurface(tiles, kind)
   * @param {Array<{x:number,y:number,h:number}>} tiles  tuiles d'eau (coordonnées de tuiles)
   * @param {string} kind  'lake' | 'sea' | 'waves' | 'shallow' | 'pond'
   * @returns {THREE.Mesh}  prêt à être ajouté à la scène (jamais null)
   */
  function makeSurface(tiles, kind) {
    if (!KINDS[kind]) kind = 'lake';
    if (!tiles || !tiles.length) {
      const empty = new THREE.Mesh(EMPTY_GEO, currentMaterial(kind));
      empty.userData.waterKind = kind;
      empty.visible = false;
      return empty;
    }

    // --- bornes de la zone ----------------------------------------------------
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxH = -Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const tx = t.x | 0, ty = t.y | 0;
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
      const h = (typeof t.h === 'number' && isFinite(t.h)) ? t.h : -0.5;
      if (h > maxH) maxH = h;
    }
    const W = maxX - minX + 1, H = maxY - minY + 1;
    const level = levelFor(kind, maxH);

    // Carte d'occupation des tuiles.
    const occ = new Uint8Array(W * H);
    for (let i = 0; i < tiles.length; i++) {
      occ[((tiles[i].y | 0) - minY) * W + ((tiles[i].x | 0) - minX)] = 1;
    }

    // --- treillis : SUB sous-cases par tuile ---------------------------------
    // 4 sous-cases -> 5x5 sommets par tuile : largement de quoi voir les vagues.
    const SUB = (R3.quality.waterDetail === 0) ? 2 : 4;
    const cw = W * SUB, ch = H * SUB;          // sous-cases
    const gw = cw + 1, gh = ch + 1;            // sommets

    function cellIn(ci, cj) {
      if (ci < 0 || cj < 0 || ci >= cw || cj >= ch) return false;
      return occ[((cj / SUB) | 0) * W + ((ci / SUB) | 0)] === 1;
    }

    // --- distance au bord, en sous-cases (transformée de distance de chanfrein) --
    const INF = 1e9;
    const dist = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        // Un sommet est « sur le rivage » dès qu'une des 4 sous-cases qui le
        // touchent n'est pas de l'eau.
        const full = cellIn(i - 1, j - 1) && cellIn(i, j - 1) && cellIn(i - 1, j) && cellIn(i, j);
        dist[j * gw + i] = full ? INF : 0;
      }
    }
    const D1 = 1.0, D2 = 1.41421356;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const o = j * gw + i;
        let d = dist[o];
        if (i > 0) d = Math.min(d, dist[o - 1] + D1);
        if (j > 0) d = Math.min(d, dist[o - gw] + D1);
        if (i > 0 && j > 0) d = Math.min(d, dist[o - gw - 1] + D2);
        if (i < gw - 1 && j > 0) d = Math.min(d, dist[o - gw + 1] + D2);
        dist[o] = d;
      }
    }
    for (let j = gh - 1; j >= 0; j--) {
      for (let i = gw - 1; i >= 0; i--) {
        const o = j * gw + i;
        let d = dist[o];
        if (i < gw - 1) d = Math.min(d, dist[o + 1] + D1);
        if (j < gh - 1) d = Math.min(d, dist[o + gw] + D1);
        if (i < gw - 1 && j < gh - 1) d = Math.min(d, dist[o + gw + 1] + D2);
        if (i > 0 && j < gh - 1) d = Math.min(d, dist[o + gw - 1] + D2);
        dist[o] = d;
      }
    }

    // --- compactage : on ne garde que les sommets réellement utilisés ---------
    const idx = new Int32Array(gw * gh).fill(-1);
    let nQuads = 0;
    for (let cj = 0; cj < ch; cj++) {
      for (let ci = 0; ci < cw; ci++) {
        if (!cellIn(ci, cj)) continue;
        nQuads++;
        idx[cj * gw + ci] = 0;
        idx[cj * gw + ci + 1] = 0;
        idx[(cj + 1) * gw + ci] = 0;
        idx[(cj + 1) * gw + ci + 1] = 0;
      }
    }

    const positions = [];
    const normals = [];
    const edges = [];
    let n = 0;
    const ox = minX - 0.5, oz = minY - 0.5;   // la tuile (x,y) couvre [x-0.5, x+0.5]
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const o = j * gw + i;
        if (idx[o] !== 0) continue;
        idx[o] = n++;
        positions.push(ox + i / SUB, level, oz + j / SUB);
        normals.push(0, 1, 0);
        // Distance au rivage exprimée en TUILES, plafonnée (au-delà, c'est le large).
        edges.push(Math.min(dist[o] / SUB, 4.0));
      }
    }

    const indices = [];
    for (let cj = 0; cj < ch; cj++) {
      for (let ci = 0; ci < cw; ci++) {
        if (!cellIn(ci, cj)) continue;
        const v00 = idx[cj * gw + ci];
        const v10 = idx[cj * gw + ci + 1];
        const v01 = idx[(cj + 1) * gw + ci];
        const v11 = idx[(cj + 1) * gw + ci + 1];
        // Enroulement anti-horaire vu de dessus -> normale vers +y.
        indices.push(v00, v01, v10, v10, v01, v11);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
    g.setIndex(n > 65535
      ? new THREE.Uint32BufferAttribute(indices, 1)
      : new THREE.Uint16BufferAttribute(indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();

    const mesh = new THREE.Mesh(g, currentMaterial(kind));
    mesh.name = 'water:' + kind;
    mesh.castShadow = false;
    mesh.receiveShadow = true;     // les arbres se reflètent en ombre sur l'eau
    mesh.renderOrder = 2;          // après le terrain opaque
    mesh.userData.waterKind = kind;
    mesh.userData.level = level;
    mesh.userData.tileCount = nQuads / (SUB * SUB);

    surfaces.push(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------------------
  //  ANIMATION
  // ---------------------------------------------------------------------------
  function update(t) {
    uTime.value = (typeof t === 'number') ? t : R3.clock.t;

    // Repli sans shader : on fait respirer la couleur, comme les vaguelettes
    // qui défilaient dans le jeu 2D.
    if (R3.quality.waterDetail === 0) {
      for (const kind in flatMats) {
        const P = params(kind);
        const k = 0.5 + 0.5 * Math.sin(uTime.value * P.speed * 0.9);
        flatMats[kind].color.copy(P._deep).lerp(P._shallow, 0.30 + 0.30 * k);
      }
    }
  }

  // Changement de qualité : on échange simplement les matériaux des surfaces
  // déjà construites (la géométrie, elle, reste valable).
  R3.onQualityChange(function () {
    for (let i = 0; i < surfaces.length; i++) {
      const m = surfaces[i];
      m.material = currentMaterial(m.userData.waterKind || 'lake');
    }
    // Le jet de fontaine garde son petit shader : il est minuscule et ne coûte rien.
  });

  /**
   * material(kind) — pour un usage ponctuel (fontaine, gouttes, éclaboussures).
   * 'fountain' renvoie le matériau du jet ; les autres types renvoient le
   * matériau de nappe correspondant.
   */
  function material(kind) {
    if (kind === 'fountain' || kind === 'jet') return fountainMaterial();
    return currentMaterial(KINDS[kind] ? kind : 'lake');
  }

  R3.register('water', {
    makeSurface: makeSurface,
    update: update,
    material: material,
    // Extras utiles à world3d.js (facultatifs, hors contrat) :
    levelFor: levelFor,
    surfaces: surfaces,
    KINDS: KINDS,
  });
})();
