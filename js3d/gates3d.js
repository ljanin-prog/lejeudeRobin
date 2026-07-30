// =============================================================================
//  gates3d.js — LES REPÈRES VISIBLES DE LOIN : portes, port aérien, ville
// -----------------------------------------------------------------------------
//  Une région fait 384 × 224 tuiles et ses portes de sortie sont posées SUR LE
//  BORD de la carte. Sans repère, un enfant tourne en rond sans jamais trouver
//  le passage vers la région suivante — c'est exactement ce qui se passait.
//
//  Ce module pose donc, pour la région active, un « phare » par lieu important :
//
//    · 🚪 porte de région  — deux obélisques, une arche, un anneau de runes qui
//      tourne, un panneau qui nomme la destination, et surtout une COLONNE DE
//      LUMIÈRE dorée de 60 unités de haut, insensible au brouillard : on la
//      voit de l'autre bout de la carte, comme un phare.
//    · ⚓ port du dirigeable — même principe, en bleu.
//    · 🏰 ville / ⚔️ arène   — colonne plus discrète, blanche et orange.
//
//  Rien ici n'est indispensable au jeu : si THREE, R3 ou regions3d manquent, le
//  module ne s'enregistre pas et tout continue comme avant (règle n°7).
//
//  API — R3.register('gates', { build(scene), setRegion(id), update(t),
//                               list(), nearest(x, z, kind), setVisible(v) })
//
//  Repère : tuile (tx, ty) -> monde (x = tx, z = ty), 1 tuile = 1 unité, le
//  CENTRE de la tuile est en (tx, ty).
// =============================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined' || typeof R3 === 'undefined' || !R3) return;

  // ---------------------------------------------------------------------------
  //  RÉGLAGES
  // ---------------------------------------------------------------------------

  const KINDS = {
    gate: {
      color: '#ffe066', pale: '#fff6bd', beamH: 62, beamR: 1.05,
      beamOpacity: 0.30, arche: true, icon: '🚪',
      panneau: true, panneauY: 9.4,
    },
    port: {
      color: '#41a6f6', pale: '#c4e7ff', beamH: 52, beamR: 0.85,
      beamOpacity: 0.26, arche: false, icon: '⚓',
      panneau: true, panneauY: 6.0,
    },
    // Ville et arène : une simple colonne de lumière. Pas de panneau — on
    // reconnaît un château et une arène à leur silhouette, et de près trois
    // pancartes flottantes mangeaient tout l'écran.
    city: {
      color: '#ffffff', pale: '#ffffff', beamH: 40, beamR: 0.7,
      beamOpacity: 0.16, arche: false, icon: '🏰', panneau: false,
    },
    arena: {
      color: '#ff6b3d', pale: '#ffc3a8', beamH: 44, beamR: 0.75,
      beamOpacity: 0.20, arche: false, icon: '⚔️', panneau: false,
    },
  };

  // Un panneau ne s'affiche qu'à distance utile : trop près il masque le
  // décor, trop loin il n'est plus lisible.
  const PANNEAU_MIN = 16;      // unités monde
  const PANNEAU_MAX = 190;
  const PANNEAU_REF = 46;      // distance à laquelle il a sa taille nominale
  const PANNEAU_W = 9.4;       // largeur nominale : le nom doit se lire de loin

  const S = {
    scene: null,
    root: null,
    beacons: [],          // [{ kind, x, y, label, group, ring, disc, beam, sprite }]
    regionId: null,
    visible: true,
  };

  // ---------------------------------------------------------------------------
  //  ACCÈS AUX VOISINS — toujours à la volée, jamais mis en cache (piège du R3
  //  masqué documenté dans la mémoire du projet).
  // ---------------------------------------------------------------------------
  function regionsApi() { try { return R3.get('regions') || null; } catch (e) { return null; } }
  function citiesApi() { try { return R3.get('cities') || null; } catch (e) { return null; } }

  /** Hauteur du sol sous (x, z) ; 0 si world3d.js n'est pas là. */
  function ground(x, z) {
    const w = (function () { try { return R3.get('world'); } catch (e) { return null; } })();
    if (!w || typeof w.heightAt !== 'function') return 0;
    let h = 0;
    try { h = w.heightAt(x, z); } catch (e) { return 0; }
    return (typeof h === 'number' && isFinite(h)) ? h : 0;
  }

  // ---------------------------------------------------------------------------
  //  PANNEAU DE TEXTE — un sprite dessiné au canvas (aucun fichier sur disque,
  //  le jeu doit rester jouable par simple double-clic).
  // ---------------------------------------------------------------------------

  const _labelCache = Object.create(null);

  function labelSprite(text, kind) {
    const cfg = KINDS[kind] || KINDS.gate;
    const key = kind + '|' + text;
    let tex = _labelCache[key];
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      const c = cv.getContext('2d');
      if (!c) return null;
      const txt = (cfg.icon ? cfg.icon + ' ' : '') + text;

      // Cartouche sombre à coins arrondis : lisible sur ciel comme sur forêt.
      c.fillStyle = 'rgba(10, 12, 24, 0.78)';
      const r = 26;
      c.beginPath();
      c.moveTo(r, 6); c.lineTo(512 - r, 6);
      c.quadraticCurveTo(506, 6, 506, r); c.lineTo(506, 122 - r);
      c.quadraticCurveTo(506, 122, 512 - r, 122); c.lineTo(r, 122);
      c.quadraticCurveTo(6, 122, 6, 122 - r); c.lineTo(6, r);
      c.quadraticCurveTo(6, 6, r, 6);
      c.closePath();
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = cfg.color;
      c.stroke();

      c.font = 'bold 54px system-ui, -apple-system, Segoe UI, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      // Un liseré noir derrière le texte : il reste lisible même à contre-jour.
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(txt, 256, 68, 470);
      c.fillStyle = cfg.pale;
      c.fillText(txt, 256, 68, 470);

      tex = new THREE.CanvasTexture(cv);
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      _labelCache[key] = tex;
    }
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
    }));
    spr.scale.set(7.2, 1.8, 1);
    return spr;
  }

  // ---------------------------------------------------------------------------
  //  CONSTRUCTION D'UN PHARE
  // ---------------------------------------------------------------------------

  /**
   * @param {object} b  { kind, x, y, label, edge? }
   */
  function buildBeacon(b) {
    const cfg = KINDS[b.kind] || KINDS.gate;
    const g = new THREE.Group();
    const sol = ground(b.x, b.y);
    g.position.set(b.x, sol, b.y);
    // Une porte sur un bord nord/sud s'ouvre le long de z : l'arche doit alors
    // barrer l'axe x. Sur un bord est/ouest, c'est l'inverse.
    const traversee = (b.edge === 'W' || b.edge === 'E');
    g.rotation.y = traversee ? Math.PI / 2 : 0;

    const pierre = R3.mat(cfg.color, { emissive: cfg.color, emissiveIntensity: 0.34, rough: 0.55 });
    const clair = R3.mat(cfg.pale, { emissive: cfg.pale, emissiveIntensity: 0.85, rough: 0.4 });

    if (cfg.arche) {
      // Deux obélisques ÉCARTÉS (±1,7) : le petit portail que world3d pose déjà
      // sur la tuile (1,6 de large) se niche entre les deux sans se cogner.
      for (let s = -1; s <= 1; s += 2) {
        const p = new THREE.Mesh(R3.geo.box(0.62, 6.2, 0.62), pierre);
        p.position.set(s * 1.7, 3.1, 0);
        p.castShadow = false;
        g.add(p);
        const t = new THREE.Mesh(R3.geo.cone(0.5, 1.1, 6), clair);
        t.position.set(s * 1.7, 6.75, 0);
        t.castShadow = false;
        g.add(t);
      }
      // Le linteau qui relie les deux obélisques.
      const l = new THREE.Mesh(R3.geo.box(4.0, 0.55, 0.7), pierre);
      l.position.set(0, 6.45, 0);
      l.castShadow = false;
      g.add(l);
    } else {
      // Simple socle lumineux pour le port, la ville et l'arène.
      const socle = new THREE.Mesh(R3.geo.cyl(1.15, 1.45, 0.5, 14), pierre);
      socle.position.set(0, 0.25, 0);
      socle.castShadow = false;
      g.add(socle);
    }

    // --- LA COLONNE DE LUMIÈRE : le vrai repère, visible de tout le plateau ---
    // `fog: false` est essentiel : sans ça, le brouillard de sky3d la mange
    // exactement à la distance où l'on a le plus besoin de la voir.
    const beam = new THREE.Mesh(
      R3.geo.cyl(cfg.beamR * 0.55, cfg.beamR, cfg.beamH, 10),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(cfg.pale),
        transparent: true, opacity: cfg.beamOpacity,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.position.set(0, cfg.beamH / 2, 0);
    beam.castShadow = false;
    beam.receiveShadow = false;
    beam.frustumCulled = false;    // sa base est loin sous le haut de l'écran
    g.add(beam);

    // --- Anneau de runes au sol : il tourne, ça attire l'œil de près ----------
    const ring = new THREE.Group();
    const runeMat = R3.mat(cfg.pale, { emissive: cfg.pale, emissiveIntensity: 1.0, rough: 0.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const q = new THREE.Mesh(R3.geo.box(0.22, 0.22, 0.22), runeMat);
      q.position.set(Math.cos(a) * 1.9, 0.35, Math.sin(a) * 1.9);
      q.castShadow = false;
      ring.add(q);
    }
    g.add(ring);

    // --- Disque au sol (le « tapis » du passage) ------------------------------
    const disc = new THREE.Mesh(
      R3.geo.cyl(2.15, 2.15, 0.06, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(cfg.color), transparent: true, opacity: 0.34,
        depthWrite: false, fog: false,
      })
    );
    disc.position.set(0, 0.08, 0);
    disc.castShadow = false;
    g.add(disc);

    // --- Le panneau ----------------------------------------------------------
    let sprite = null;
    if (b.label && cfg.panneau) {
      sprite = labelSprite(b.label, b.kind);
      if (sprite) {
        sprite.position.set(0, cfg.panneauY || 8.6, 0);
        sprite.visible = false;      // update() décide selon la distance
        g.add(sprite);
      }
    }

    return { group: g, ring: ring, disc: disc, beam: beam, sprite: sprite, cfg: cfg };
  }

  // ---------------------------------------------------------------------------
  //  API
  // ---------------------------------------------------------------------------

  function build(scene) {
    if (!scene) return null;
    S.scene = scene;
    if (S.root) { if (S.root.parent) S.root.parent.remove(S.root); }
    S.root = new THREE.Group();
    S.root.name = 'gates3d';
    scene.add(S.root);
    if (S.regionId) setRegion(S.regionId);
    return S.root;
  }

  function clear() {
    for (let i = 0; i < S.beacons.length; i++) {
      const g = S.beacons[i].group;
      if (!g) continue;
      if (g.parent) g.parent.remove(g);
      try { R3.disposeTree(g); } catch (e) { /* déjà libéré */ }
    }
    S.beacons = [];
  }

  /** Reconstruit tous les phares de la région `id`. */
  function setRegion(id) {
    S.regionId = id || S.regionId;
    if (!S.root) return;
    clear();

    const R = regionsApi();
    const def = (R && typeof R.get === 'function') ? R.get(S.regionId) : null;
    if (!def) return;

    const items = [];

    // 1. Les portes de région — le repère le PLUS important.
    if (Array.isArray(def.gates)) {
      for (let i = 0; i < def.gates.length; i++) {
        const gt = def.gates[i];
        if (!gt || typeof gt.x !== 'number') continue;
        const dest = destName(R, gt.toRegion);
        items.push({
          kind: 'gate', x: gt.x, y: gt.y, edge: gt.edge,
          label: (gt.label || 'Passage') + (dest ? ' → ' + dest : ''),
          toRegion: gt.toRegion,
        });
      }
    }

    // 2. Le port du dirigeable.
    if (def.airship && typeof def.airship.x === 'number') {
      items.push({
        kind: 'port', x: def.airship.x, y: def.airship.y,
        label: def.airship.name || 'Port du dirigeable',
      });
    }

    // 3. La ville et son arène (plan de cities3d, facultatif).
    try {
      const cities = citiesApi();
      const plan = (cities && typeof cities.plan === 'function') ? cities.plan(S.regionId) : null;
      if (plan) {
        if (plan.castle && typeof plan.castle.x === 'number') {
          items.push({ kind: 'city', x: plan.castle.x, y: plan.castle.y, label: plan.name || 'Ville' });
        }
        if (plan.arena && typeof plan.arena.x === 'number') {
          items.push({ kind: 'arena', x: plan.arena.x, y: plan.arena.y, label: 'Arène' });
        }
      }
    } catch (e) { /* cities3d est optionnel */ }

    for (let i = 0; i < items.length; i++) {
      let b = null;
      try { b = buildBeacon(items[i]); } catch (e) {
        if (typeof console !== 'undefined') console.warn('[gates3d] phare non construit :', e);
        continue;
      }
      if (!b) continue;
      b.kind = items[i].kind;
      b.x = items[i].x; b.y = items[i].y;
      b.label = items[i].label;
      b.toRegion = items[i].toRegion || null;
      b.group.visible = S.visible;
      S.root.add(b.group);
      S.beacons.push(b);
    }
  }

  function destName(R, id) {
    if (!id) return '';
    const d = (R && typeof R.get === 'function') ? R.get(id) : null;
    return (d && d.name) || '';
  }

  /**
   * Animation : l'anneau tourne, la colonne respire, et les panneaux gardent
   * une taille à peu près constante à l'écran (échelle proportionnelle à la
   * distance) tout en s'effaçant quand on est dessus.
   * @param {number} t   temps de jeu
   * @param {number} px  position du joueur (facultative — sinon la caméra)
   * @param {number} pz
   */
  function update(t, px, pz) {
    if (!S.beacons.length || !S.visible) return;
    const puls = 0.82 + Math.sin(t * 1.7) * 0.18;

    // D'où regarde-t-on ? De la caméra si on l'a, du joueur sinon.
    let ox = px, oz = pz;
    if (typeof ox !== 'number') {
      const cam = (function () { try { return R3.get('camera'); } catch (e) { return null; } })();
      const c = cam && cam.camera;
      if (c) { ox = c.position.x; oz = c.position.z; }
    }

    for (let i = 0; i < S.beacons.length; i++) {
      const b = S.beacons[i];
      if (b.ring) {
        b.ring.rotation.y = t * 0.55 + i;
        b.ring.position.y = Math.sin(t * 1.5 + i) * 0.12;
      }
      if (b.disc) b.disc.material.opacity = 0.24 + puls * 0.14;
      if (b.beam) b.beam.material.opacity = b.cfg.beamOpacity * puls;

      if (b.sprite) {
        if (typeof ox !== 'number') { b.sprite.visible = true; continue; }
        const d = Math.sqrt((b.x - ox) * (b.x - ox) + (b.y - oz) * (b.y - oz));
        const vu = (d > PANNEAU_MIN && d < PANNEAU_MAX);
        b.sprite.visible = vu;
        if (vu) {
          let k = d / PANNEAU_REF;
          if (k < 0.55) k = 0.55; else if (k > 2.6) k = 2.6;
          b.sprite.scale.set(PANNEAU_W * k, PANNEAU_W * k * 0.25, 1);
        }
      }
    }
  }

  function list() {
    return S.beacons.map(function (b) {
      return { kind: b.kind, x: b.x, y: b.y, label: b.label, toRegion: b.toRegion };
    });
  }

  /** Le phare le plus proche de (x, z), éventuellement filtré par genre. */
  function nearest(x, z, kind) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < S.beacons.length; i++) {
      const b = S.beacons[i];
      if (kind && b.kind !== kind) continue;
      const d = Math.abs(b.x - x) + Math.abs(b.y - z);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) return null;
    return { kind: best.kind, x: best.x, y: best.y, label: best.label, dist: bestD, toRegion: best.toRegion };
  }

  function setVisible(v) {
    S.visible = !!v;
    for (let i = 0; i < S.beacons.length; i++) {
      if (S.beacons[i].group) S.beacons[i].group.visible = S.visible;
    }
  }

  R3.register('gates', {
    build: build,
    setRegion: setRegion,
    update: update,
    list: list,
    nearest: nearest,
    setVisible: setVisible,
  });
})();
