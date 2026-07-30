// =============================================================================
//  cities3d.js — LES SIX VILLES MAJESTUEUSES  (contrat v2, §10)
// =============================================================================
//  Ce module ne dessine RIEN en 3D : il produit le PLAN EN TUILES des six villes.
//  C'est `regions3d.js` qui appelle `stamp(regionId, put)` après avoir généré le
//  terrain, et `citybuild3d.js` qui construit les monuments correspondants.
//
//  Pourquoi un module à part ? Parce qu'une ville « majestueuse » n'est pas une
//  simple règle de génération (`si x%4==0 alors une rue`) comme dans le jeu 2D :
//  c'est un plan d'urbanisme — un rempart fermé, des portes, une avenue qui mène
//  à la grande place, un château qui domine, des îlots de maisons qui donnent sur
//  la rue. Tout cela se compose, se vérifie, et doit rester JOUABLE.
//
//  LA RÈGLE D'OR : un enfant coincé, c'est un jeu cassé.
//  Toutes les entrées (portes du rempart, arène, centre de soins, boutique,
//  château, église) sont reliées entre elles par un « squelette » de rues
//  protégées, construit AVANT les bâtiments et jamais recouvert ensuite.
//  Une passe finale supprime les impasses et neutralise les poches inaccessibles.
//
//  DÉTERMINISME : aucune utilisation de Math.random(). Tout part de R3.rng(graine)
//  (ou d'un repli local identique si core3d.js manquait) — même graine, même ville.
// =============================================================================

(function () {
  'use strict';

  const HAS_R3 = (typeof R3 !== 'undefined' && R3);

  // ---------------------------------------------------------------------------
  //  Aléatoire déterministe
  // ---------------------------------------------------------------------------

  // Graine stable dérivée d'une chaîne (le nom de la ville) : deux exécutions,
  // deux machines, deux navigateurs -> exactement la même ville.
  function seedOf(str) {
    let s = 2166136261;
    for (let i = 0; i < str.length; i++) {
      s ^= str.charCodeAt(i);
      s = (s * 16777619) | 0;
    }
    return (s >>> 0) % 2147483647 || 1;
  }

  function makeRng(seed) {
    if (HAS_R3 && typeof R3.rng === 'function') return R3.rng(seed);
    // Repli : xorshift32, strictement identique à celui de core3d.js.
    let s = (seed | 0) || 1;
    return function () {
      s = (s ^ (s << 13)) | 0;
      s = (s ^ (s >>> 17)) | 0;
      s = (s ^ (s << 5)) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  // Tirage pondéré déterministe dans un tableau.
  function pick(rnd, arr) { return arr[Math.min(arr.length - 1, (rnd() * arr.length) | 0)]; }

  // ---------------------------------------------------------------------------
  //  Marchabilité — table LOCALE
  //  tiles3d.js n'est peut-être pas chargé quand on construit les plans (et de
  //  toute façon ce module doit pouvoir se vérifier tout seul). Les noms sont
  //  figés par le §5 du contrat : on peut se permettre de les connaître.
  // ---------------------------------------------------------------------------
  const WALKABLE = new Set([
    // circulations de ville
    'GATE_ARCH', 'CASTLE_GATE', 'ARENA_DOOR', 'HEAL_DOOR', 'SHOP_DOOR',
    'PLAZA', 'PLAZA_GRAND', 'PAVED_ROAD', 'BRIDGE', 'PORTAL', 'DOCK', 'STAR_PATH',
    'OBSERVATORY_FLOOR',
    // sols naturels que les villes posent dans leurs cours et jardins
    'GRASS', 'TALL_GRASS', 'FLOWERS', 'PATH', 'PLAIN', 'TALL_PLAIN', 'SAND',
    'PARK_GRASS', 'PARK_PATH', 'PARK_FLOWER', 'SNOW', 'DEEP_SNOW',
    'JUNGLE_GRASS', 'EMBER_GRASS', 'PLATEAU_GRASS', 'PLATEAU_TALL',
    'CRACKED_EARTH', 'BASALT', 'ASH', 'CORAL_SAND', 'RUIN_MOSS', 'RUIN_STONE',
    'MUD', 'LILY_PAD', 'ICE', 'DESERT_SAND',
  ]);
  function walkable(t) { return t != null && WALKABLE.has(t); }

  // Les tuiles de circulation à proprement parler (ce qui peut devenir une rue,
  // porter un lampadaire, ou être élagué si ça finit en impasse).
  const STREETY = new Set(['PAVED_ROAD', 'BRIDGE', 'PLAZA', 'PLAZA_GRAND', 'STAR_PATH', 'DOCK']);

  // ---------------------------------------------------------------------------
  //  Styles — c'est ce qui rend les six villes reconnaissables au premier regard
  // ---------------------------------------------------------------------------
  const STYLES = {
    emeraude: {
      soil: 'PARK_GRASS', road: 'PAVED_ROAD', outRoad: 'PATH',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_A', 'TOWNHOUSE_B', 'TOWNHOUSE_C', 'TOWNHOUSE_A', 'TOWNHOUSE_B'],
      manor: 'MANOR',
      garden: ['HEDGE', 'ROSE_BED', 'PARK_FLOWER', 'TREE', 'HEDGE'],
      tree: 'TREE',
    },
    ambrelune: {
      soil: 'SWAMP_WATER', road: 'BRIDGE', outRoad: 'PAVED_ROAD',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_C', 'TOWNHOUSE_A', 'TOWNHOUSE_C', 'TOWNHOUSE_B'],
      manor: 'MANOR',
      garden: ['LILY_PAD', 'MANGROVE', 'FERN', 'LILY_PAD', 'VINE_TREE'],
      tree: 'JUNGLE_TREE',
    },
    saphir: {
      soil: 'CORAL_SAND', road: 'PAVED_ROAD', outRoad: 'SAND',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_B', 'TOWNHOUSE_A', 'TOWNHOUSE_B', 'TOWNHOUSE_C'],
      manor: 'MANOR',
      garden: ['HEDGE', 'ROSE_BED', 'PALM', 'HEDGE', 'PALM'],
      tree: 'PALM',
    },
    cimefroide: {
      soil: 'DEEP_SNOW', road: 'PAVED_ROAD', outRoad: 'PAVED_ROAD',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_C', 'TOWNHOUSE_B', 'TOWNHOUSE_C', 'TOWNHOUSE_A'],
      manor: 'MANOR',
      garden: ['HEDGE', 'PINE_SNOW', 'ROSE_BED', 'PINE_SNOW'],
      tree: 'PINE_SNOW',
    },
    fournaise: {
      soil: 'BASALT', road: 'PAVED_ROAD', outRoad: 'ASH',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_A', 'TOWNHOUSE_C', 'TOWNHOUSE_A', 'TOWNHOUSE_B'],
      manor: 'MANOR',
      garden: ['OBSIDIAN', 'EMBER_GRASS', 'HEDGE', 'OBSIDIAN'],
      tree: 'OBSIDIAN',
    },
    aurore: {
      soil: 'PLATEAU_GRASS', road: 'PAVED_ROAD', outRoad: 'STAR_PATH',
      plaza: 'PLAZA', plazaGrand: 'PLAZA_GRAND',
      houses: ['TOWNHOUSE_B', 'TOWNHOUSE_A', 'MANOR', 'TOWNHOUSE_B', 'TOWNHOUSE_C'],
      manor: 'MANOR',
      garden: ['HEDGE', 'ROSE_BED', 'HEDGE', 'ROSE_BED', 'CRYSTAL_SPIRE'],
      tree: 'CRYSTAL_SPIRE',
    },
  };

  // ===========================================================================
  //  LA TOILE — une grille locale w×h et ses primitives de dessin
  // ===========================================================================
  //  `g` vaut `null` là où il ne faut PAS toucher au terrain de la région : hors
  //  du rempart, la campagne reste celle de regions3d.js (sauf les routes d'accès).
  //
  //  Trois masques, qui portent toute la sûreté du module :
  //    hard[i]   : mur, tour, porte, monument, fontaine — jamais recouvert
  //    prot[i]   : squelette de rues — doit rester marchable, jamais décoré
  //    taken[i]  : déjà attribué — les maisons et jardins n'y vont pas
  // ===========================================================================

  function Canvas(w, h, style, rnd) {
    const n = w * h;
    this.w = w; this.h = h;
    this.st = style;
    this.rnd = rnd;
    this.g = new Array(n).fill(null);
    this.hard = new Uint8Array(n);
    this.prot = new Uint8Array(n);
    this.taken = new Uint8Array(n);
    this.inside = new Uint8Array(n);   // intérieur du rempart (mur inclus)
    this.isWall = new Uint8Array(n);
    this.dist = new Int16Array(n);     // distance au premier « dehors »
    this.houses = 0;
  }

  function inb(C, x, y) { return x >= 0 && y >= 0 && x < C.w && y < C.h; }
  function I(C, x, y) { return y * C.w + x; }
  function gt(C, x, y) { return inb(C, x, y) ? C.g[I(C, x, y)] : null; }

  // Écriture « douce » : respecte hard/taken (sol, jardins, décors).
  function soft(C, x, y, t) {
    if (!inb(C, x, y)) return;
    const i = I(C, x, y);
    if (C.hard[i] || C.taken[i]) return;
    C.g[i] = t;
  }
  // Écriture de monument : pose et verrouille.
  function hard(C, x, y, t) {
    if (!inb(C, x, y)) return;
    const i = I(C, x, y);
    C.g[i] = t; C.hard[i] = 1; C.taken[i] = 1;
  }
  // Écriture de rue protégée (le squelette). Si la case est déjà une circulation
  // (place, quai…), on ne change pas la tuile : on se contente de la protéger.
  function paintRoad(C, x, y, t) {
    if (!inb(C, x, y)) return;
    const i = I(C, x, y);
    if (C.hard[i]) return;
    if (!STREETY.has(C.g[i])) C.g[i] = t;
    C.prot[i] = 1; C.taken[i] = 1;
  }
  // Rue « ordinaire » : marchable mais pas protégée (peut porter un lampadaire,
  // peut être élaguée si elle finit en impasse).
  function paintLane(C, x, y, t) {
    if (!inb(C, x, y)) return;
    const i = I(C, x, y);
    if (C.hard[i] || C.prot[i]) return;
    if (!STREETY.has(C.g[i])) C.g[i] = t;
    C.taken[i] = 1;
  }

  function rectFill(C, x, y, w, h, t, fn) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) (fn || soft)(C, i, j, t);
  }

  // ---------------------------------------------------------------------------
  //  Rempart : on part d'un prédicat de forme et on en déduit le mur.
  //
  //  PIÈGE (et raison du choix) : on marque comme mur toute case intérieure
  //  ayant un voisin EXTÉRIEUR parmi ses 8 voisins. C'est ce qui garantit
  //  l'étanchéité : un déplacement à 4 directions qui sortirait de la ville
  //  devrait forcément passer par une de ces cases. Avec un test à 4 voisins,
  //  les coins en diagonale fuiraient.
  // ---------------------------------------------------------------------------
  function buildWall(C, insideFn, wallTile) {
    for (let y = 0; y < C.h; y++) {
      for (let x = 0; x < C.w; x++) {
        C.inside[I(C, x, y)] = insideFn(x, y) ? 1 : 0;
      }
    }
    const isIn = (x, y) => (inb(C, x, y) && C.inside[I(C, x, y)] === 1);
    for (let y = 0; y < C.h; y++) {
      for (let x = 0; x < C.w; x++) {
        if (!isIn(x, y)) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (!isIn(x + dx, y + dy)) { edge = true; break; }
          }
        }
        if (edge) { C.isWall[I(C, x, y)] = 1; hard(C, x, y, wallTile); }
      }
    }
    // Champ de distance au dehors : sert à tracer le chemin de ronde (la rue
    // qui longe le rempart) quelle que soit la forme de la ville.
    C.dist.fill(-1);
    const q = [];
    for (let y = 0; y < C.h; y++) {
      for (let x = 0; x < C.w; x++) {
        if (!C.inside[I(C, x, y)]) { C.dist[I(C, x, y)] = 0; q.push(I(C, x, y)); }
      }
    }
    for (let k = 0; k < q.length; k++) {
      const c = q[k], cx = c % C.w, cy = (c / C.w) | 0, d = C.dist[c];
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (let m = 0; m < 4; m++) {
        const nx = nb[m][0], ny = nb[m][1];
        if (!inb(C, nx, ny)) continue;
        const ni = I(C, nx, ny);
        if (C.dist[ni] >= 0) continue;
        C.dist[ni] = d + 1; q.push(ni);
      }
    }
  }

  // Sol de base à l'intérieur du rempart.
  function fillInterior(C, tile) {
    for (let i = 0; i < C.g.length; i++) {
      if (C.inside[i] && !C.hard[i]) C.g[i] = tile;
    }
  }

  // Marche depuis le centre le long d'un rayon jusqu'à toucher le rempart.
  // C'est ce qui permet de poser tours et portes sur n'importe quelle forme.
  function rayToWall(C, cx, cy, dx, dy) {
    let x = cx + 0.5, y = cy + 0.5;
    const len = Math.hypot(dx, dy) || 1;
    const sx = dx / len * 0.5, sy = dy / len * 0.5;
    for (let s = 0; s < 400; s++) {
      x += sx; y += sy;
      const tx = Math.floor(x), ty = Math.floor(y);
      if (!inb(C, tx, ty)) return null;
      if (C.isWall[I(C, tx, ty)]) return { x: tx, y: ty };
    }
    return null;
  }

  // Tours d'angle : réparties en éventail autour du centre. Robuste sur toutes
  // les formes (rectangle, octogone, ellipse) sans avoir à parcourir le contour.
  function placeTowers(C, cx, cy, count, tile) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + 0.19;
      const p = rayToWall(C, cx, cy, Math.cos(a), Math.sin(a));
      if (!p) continue;
      // une tour épaisse : la case du rayon plus ses voisines de mur
      hard(C, p.x, p.y, tile);
    }
  }

  // Porte : trois arches côte à côte, orientées selon le segment de mur.
  function placeGate(C, cx, cy, dx, dy, label) {
    const p = rayToWall(C, cx, cy, dx, dy);
    if (!p) return null;
    const i = I(C, p.x, p.y);
    C.hard[i] = 0;                       // on rouvre la case pour y mettre l'arche
    hard(C, p.x, p.y, 'GATE_ARCH');
    // élargissement le long du mur (un mur horizontal se prolonge en x, etc.)
    const horiz = (C.isWall[I(C, p.x - 1, p.y)] || 0) + (C.isWall[I(C, p.x + 1, p.y)] || 0);
    const vert = (inb(C, p.x, p.y - 1) ? C.isWall[I(C, p.x, p.y - 1)] : 0)
      + (inb(C, p.x, p.y + 1) ? C.isWall[I(C, p.x, p.y + 1)] : 0);
    const ax = horiz >= vert ? 1 : 0, ay = horiz >= vert ? 0 : 1;
    for (const s of [-1, 1]) {
      const nx = p.x + ax * s, ny = p.y + ay * s;
      if (inb(C, nx, ny) && C.isWall[I(C, nx, ny)]) { C.hard[I(C, nx, ny)] = 0; hard(C, nx, ny, 'GATE_ARCH'); }
    }
    // Direction « vers l'intérieur » : c'est ce que game3d.js lira pour orienter
    // l'arche et pour savoir de quel côté on entre.
    let dir = 'down';
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'left' : 'right';
    else dir = dy > 0 ? 'up' : 'down';
    return { x: p.x, y: p.y, dir, label, ax, ay };
  }

  // Route d'accès : de la porte vers l'extérieur, jusqu'au bord de l'emprise.
  // Sans elle, une porte pourrait donner sur une falaise générée par regions3d.
  function approachRoad(C, gate, dx, dy, tile) {
    let x = gate.x, y = gate.y;
    const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    const sy = Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy);
    for (let k = 0; k < 40; k++) {
      x -= sx; y -= sy;                        // dx/dy pointent vers la porte
      if (!inb(C, x, y)) return;
      if (C.inside[I(C, x, y)]) continue;
      for (let o = -1; o <= 1; o++) {
        const px = x + (sx ? 0 : o), py = y + (sx ? o : 0);
        if (inb(C, px, py) && !C.hard[I(C, px, py)] && !C.inside[I(C, px, py)]) {
          C.g[I(C, px, py)] = tile; C.taken[I(C, px, py)] = 1;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Tracé de rue : marche d'un point à l'autre en peignant un carré à chaque pas.
  //  Peindre un CARRÉ (et pas une simple case) est ce qui garantit qu'un tracé
  //  en escalier reste franchissable en 4 directions.
  //    mode 'L'    : on épuise l'axe dominant, puis l'autre — avenues droites
  //    mode 'diag' : on alterne — avenues rayonnantes, plus organiques
  // ---------------------------------------------------------------------------
  function walkTo(C, x0, y0, x1, y1, halfW, tile, mode, painter) {
    const paint = painter || paintRoad;
    let x = x0, y = y0, guard = 0;
    const stamp = () => {
      for (let j = -halfW; j <= halfW; j++) {
        for (let i = -halfW; i <= halfW; i++) paint(C, x + i, y + j, tile);
      }
    };
    stamp();
    while ((x !== x1 || y !== y1) && guard++ < 600) {
      const dx = x1 - x, dy = y1 - y;
      let stepX;
      if (mode === 'diag') stepX = (dx !== 0) && (guard % 2 === 1 || dy === 0);
      else stepX = Math.abs(dx) >= Math.abs(dy) ? dx !== 0 : false;
      if (stepX) x += Math.sign(dx); else if (dy !== 0) y += Math.sign(dy); else x += Math.sign(dx);
      stamp();
    }
  }

  // Chemin de ronde : la rue qui fait le tour de la ville en longeant le rempart.
  // C'est LUI qui supprime la plupart des impasses : tout îlot y donne.
  function ringRoad(C, dA, dB, tile) {
    for (let y = 0; y < C.h; y++) {
      for (let x = 0; x < C.w; x++) {
        const i = I(C, x, y);
        if (!C.inside[i] || C.hard[i]) continue;
        const d = C.dist[i];
        if (d >= dA && d <= dB) paintRoad(C, x, y, tile);
      }
    }
  }

  // Grande place : disque ou rectangle, avec un cœur d'apparat.
  function plazaDisk(C, cx, cy, r, coreR, st) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.35) continue;
        if (!inb(C, x, y) || !C.inside[I(C, x, y)] || C.hard[I(C, x, y)]) continue;
        paintRoad(C, x, y, d <= coreR + 0.35 ? st.plazaGrand : st.plaza);
      }
    }
    return { x: cx - r, y: cy - r, w: r * 2 + 1, h: r * 2 + 1 };
  }

  function plazaRect(C, x0, y0, w, h, st, coreInset) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (!inb(C, x, y) || !C.inside[I(C, x, y)] || C.hard[I(C, x, y)]) continue;
        const core = (x >= x0 + coreInset && x < x0 + w - coreInset &&
          y >= y0 + coreInset && y < y0 + h - coreInset);
        paintRoad(C, x, y, core ? st.plazaGrand : st.plaza);
      }
    }
    return { x: x0, y: y0, w, h };
  }

  // ---------------------------------------------------------------------------
  //  Bâtiments à porte — arène, centre de soins, boutique, château
  //  `side` = côté de la façade ('S','N','E','W'). La case DEVANT la porte est
  //  reliée au squelette : c'est la garantie d'accessibilité.
  // ---------------------------------------------------------------------------
  function building(C, x, y, w, h, body, opts) {
    opts = opts || {};
    // On photographie d'abord ce qui est déjà réservé (mur, tour, porte, avenue
    // protégée...) AVANT de rien poser : le bâtiment ne doit JAMAIS l'écraser,
    // quitte à laisser un accroc dans sa silhouette. C'est ce qui empêche un
    // bâtiment tardif de couper une rue ou d'avaler une porte du rempart —
    // l'ORDRE DE POSE (terrain -> rempart et portes -> avenues -> bâtiments ->
    // décors) devient une garantie, pas juste une convention.
    const reserved = new Set();
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const idx = I(C, i, j);
      if (C.hard[idx] || C.prot[idx]) reserved.add(idx);
    }
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!reserved.has(I(C, i, j))) hard(C, i, j, body);
    }
    if (opts.corner) {
      for (const p of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) {
        if (!reserved.has(I(C, p[0], p[1]))) hard(C, p[0], p[1], opts.corner);
      }
    }
    if (!opts.door) return null;
    const side = opts.side || 'S';
    const off = (opts.off == null) ? 0 : opts.off;
    let dx, dy, fx, fy;
    if (side === 'S') { dx = x + ((w / 2) | 0) + off; dy = y + h - 1; fx = dx; fy = dy + 1; }
    else if (side === 'N') { dx = x + ((w / 2) | 0) + off; dy = y; fx = dx; fy = dy - 1; }
    else if (side === 'E') { dx = x + w - 1; dy = y + ((h / 2) | 0) + off; fx = dx + 1; fy = dy; }
    else { dx = x; dy = y + ((h / 2) | 0) + off; fx = dx - 1; fy = dy; }
    // La porte, elle, est toujours forcée : un bâtiment sans porte n'a aucun sens.
    C.hard[I(C, dx, dy)] = 0;
    hard(C, dx, dy, opts.door);
    connectSpine(C, fx, fy, opts.roadTile || C.st.road);
    return { x: dx, y: dy, fx, fy };
  }

  // ---------------------------------------------------------------------------
  //  connectSpine — LA sécurité du module.
  //  Rend la case (sx,sy) marchable et la relie au squelette protégé le plus
  //  proche, en creusant s'il le faut. Appelée pour chaque porte de bâtiment et
  //  chaque porte de rempart : après ça, tout se rejoint, par construction.
  // ---------------------------------------------------------------------------
  function connectSpine(C, sx, sy, tile) {
    if (!inb(C, sx, sy)) return;
    const n = C.w * C.h;
    const start = I(C, sx, sy);
    if (C.hard[start]) return;               // porte bouchée : rien à faire
    if (C.prot[start]) { paintRoad(C, sx, sy, tile); return; }
    const prev = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n);
    const q = [start]; seen[start] = 1;
    let goal = -1;
    for (let k = 0; k < q.length && goal < 0; k++) {
      const c = q[k], cx = c % C.w, cy = (c / C.w) | 0;
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (let m = 0; m < 4; m++) {
        const nx = nb[m][0], ny = nb[m][1];
        if (!inb(C, nx, ny)) continue;
        const ni = I(C, nx, ny);
        if (seen[ni] || C.hard[ni] || !C.inside[ni]) continue;
        seen[ni] = 1; prev[ni] = c;
        if (C.prot[ni]) { goal = ni; break; }
        q.push(ni);
      }
    }
    if (goal < 0) { paintRoad(C, sx, sy, tile); return; }
    let c = goal;
    while (c !== -1) { paintRoad(C, c % C.w, (c / C.w) | 0, tile); c = prev[c]; }
  }

  // ---------------------------------------------------------------------------
  //  Îlots : maisons qui donnent sur la rue, puis jardins dans les cœurs d'îlot.
  //  On parcourt en lignes pour que les maisons forment des rangées mitoyennes,
  //  comme dans une vraie vieille ville — pas des cubes éparpillés.
  // ---------------------------------------------------------------------------
  function freeCell(C, x, y) {
    if (!inb(C, x, y)) return false;
    const i = I(C, x, y);
    return C.inside[i] === 1 && !C.hard[i] && !C.taken[i] && C.dist[i] >= 2;
  }
  function touchesStreet(C, x, y, w, h) {
    for (let j = y - 1; j <= y + h; j++) {
      for (let i = x - 1; i <= x + w; i++) {
        if ((i >= x && i < x + w && j >= y && j < y + h)) continue;
        if ((i < x || i >= x + w) && (j < y || j >= y + h)) continue;   // pas les diagonales
        if (inb(C, i, j) && STREETY.has(C.g[I(C, i, j)])) return true;
      }
    }
    return false;
  }
  function blockFree(C, x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!freeCell(C, i, j)) return false;
    return true;
  }
  function putHouse(C, x, y, w, h, tile) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) hard(C, i, j, tile);
    C.houses++;
  }

  function fillBlocks(C, opts) {
    opts = opts || {};
    const st = C.st, rnd = C.rnd;
    const manorRate = opts.manorRate == null ? 0.12 : opts.manorRate;
    const sizes = opts.sizes || [[2, 2], [2, 1], [1, 2], [1, 1], [2, 2], [3, 2]];
    for (let y = 1; y < C.h - 1; y++) {
      for (let x = 1; x < C.w - 1; x++) {
        if (!freeCell(C, x, y)) continue;
        if (!touchesStreet(C, x, y, 1, 1)) continue;
        // On essaie du plus grand au plus petit : les grandes bâtisses d'abord.
        let placed = false;
        const order = [];
        for (let k = 0; k < sizes.length; k++) order.push(sizes[(k + ((rnd() * sizes.length) | 0)) % sizes.length]);
        order.sort((a, b) => (b[0] * b[1]) - (a[0] * a[1]));
        for (let k = 0; k < order.length && !placed; k++) {
          const bw = order[k][0], bh = order[k][1];
          if (!blockFree(C, x, y, bw, bh)) continue;
          if (!touchesStreet(C, x, y, bw, bh)) continue;
          const big = bw * bh >= 4 && rnd() < manorRate;
          putHouse(C, x, y, bw, bh, big ? st.manor : pick(rnd, st.houses));
          placed = true;
        }
      }
    }
    // Cœurs d'îlot : jardins, haies, rosiers, arbres. Ce qui reste devient sol.
    for (let y = 0; y < C.h; y++) {
      for (let x = 0; x < C.w; x++) {
        if (!freeCell(C, x, y)) continue;
        const i = I(C, x, y);
        if (rnd() < (opts.gardenRate == null ? 0.55 : opts.gardenRate)) {
          C.g[i] = pick(rnd, st.garden); C.taken[i] = 1;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Parure : lampadaires et bannières le long des avenues.
  //  On ne pose JAMAIS sur une case protégée : le squelette reste intact, donc
  //  la ville reste traversable quoi qu'il arrive.
  // ---------------------------------------------------------------------------
  function dressStreets(C, opts) {
    opts = opts || {};
    const every = opts.every || 6;
    for (let y = 1; y < C.h - 1; y++) {
      for (let x = 1; x < C.w - 1; x++) {
        const i = I(C, x, y);
        if (!C.inside[i] || C.hard[i] || C.prot[i]) continue;
        if (!STREETY.has(C.g[i])) continue;
        // Bord de chaussée : une case de rue qui touche un bâtiment ou un jardin.
        let border = false;
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (let m = 0; m < 4; m++) {
          const t = gt(C, nb[m][0], nb[m][1]);
          if (t == null || !walkable(t)) { border = true; break; }
        }
        if (!border) continue;
        const k = (x * 3 + y * 5) % every;
        if (k === 0) hard(C, x, y, 'LAMP_POST');
        else if (k === 3 && C.dist[i] > 6 && C.rnd() < 0.35) hard(C, x, y, 'BANNER_POLE');
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  Passes finales de sûreté
  // ---------------------------------------------------------------------------

  // 1) Élagage des impasses : une case de rue qui n'a qu'un seul voisin
  //    marchable et qui ne dessert aucune porte n'a pas de raison d'exister.
  function pruneDeadEnds(C) {
    let changed = true, guard = 0;
    const doorish = new Set(['GATE_ARCH', 'CASTLE_GATE', 'ARENA_DOOR', 'HEAL_DOOR', 'SHOP_DOOR', 'PORTAL']);
    while (changed && guard++ < 40) {
      changed = false;
      for (let y = 0; y < C.h; y++) {
        for (let x = 0; x < C.w; x++) {
          const i = I(C, x, y);
          if (!C.inside[i] || C.prot[i] || C.hard[i]) continue;
          if (!STREETY.has(C.g[i])) continue;
          let deg = 0, serves = false;
          const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
          for (let m = 0; m < 4; m++) {
            const t = gt(C, nb[m][0], nb[m][1]);
            if (t && doorish.has(t)) serves = true;
            if (walkable(t)) deg++;
          }
          if (serves || deg > 1) continue;
          C.g[i] = pick(C.rnd, C.st.garden); C.taken[i] = 1; changed = true;
        }
      }
    }
  }

  // 2) Poches inaccessibles : tout ce qui est marchable dans le rempart mais
  //    injoignable depuis la grande place devient jardin. Ainsi aucune case du
  //    plan ne ment au joueur.
  function sealPockets(C, sx, sy) {
    const n = C.w * C.h;
    const seen = new Uint8Array(n);
    if (!inb(C, sx, sy)) return;
    const q = [I(C, sx, sy)]; seen[q[0]] = 1;
    for (let k = 0; k < q.length; k++) {
      const c = q[k], cx = c % C.w, cy = (c / C.w) | 0;
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (let m = 0; m < 4; m++) {
        const nx = nb[m][0], ny = nb[m][1];
        if (!inb(C, nx, ny)) continue;
        const ni = I(C, nx, ny);
        if (seen[ni] || !walkable(C.g[ni])) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    for (let i = 0; i < n; i++) {
      if (!C.inside[i] || seen[i] || !walkable(C.g[i])) continue;
      // Le squelette protégé n'est JAMAIS sacrifié, même s'il semble injoignable
      // d'ici : le détruire garantirait la coupure qu'on essaie d'éviter. C'est
      // guaranteeConnectivity(), juste après, qui tranche pour de bon.
      if (C.hard[i] || C.prot[i]) continue;
      C.g[i] = pick(C.rnd, C.st.garden); C.taken[i] = 1;
    }
  }

  // ---------------------------------------------------------------------------
  //  3) LA PASSE DE GARANTIE — le vrai filet de sécurité.
  //  Après tout le reste (bâtiments, jardins, élagage, poches), on vérifie
  //  qu'on peut effectivement MARCHER depuis la place jusqu'à chaque entrée
  //  obligatoire (portes du rempart, arène, soins, boutique, port aérien). Si
  //  ce n'est pas le cas — un bâtiment tardif qui a coupé une avenue, une porte
  //  recouverte, une poche imprévue — on creuse une rue jusqu'à elle. Après
  //  cette passe, le défaut « porte qui ne mène nulle part » est structurellement
  //  impossible : on ne le détecte plus, on l'interdit.
  // ---------------------------------------------------------------------------

  // Creuse, à travers tout ce qui n'est pas verrouillé (hard), le plus court
  // chemin entre (sx,sy) et la composante déjà atteinte (`reached`). Peint le
  // chemin trouvé et met à jour `reached`. Renvoie false seulement si (sx,sy)
  // est totalement encerclé de cases verrouillées (ne devrait jamais arriver).
  function carveToReached(C, sx, sy, reached, tile) {
    if (!inb(C, sx, sy)) return false;
    const start = I(C, sx, sy);
    if (reached[start]) return true;
    const n = C.w * C.h;
    const prev = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n);
    seen[start] = 1;
    const q = [start];
    let goal = -1;
    for (let k = 0; k < q.length && goal < 0; k++) {
      const c = q[k], cx = c % C.w, cy = (c / C.w) | 0;
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (let m = 0; m < 4; m++) {
        const nx = nb[m][0], ny = nb[m][1];
        if (!inb(C, nx, ny)) continue;
        const ni = I(C, nx, ny);
        if (seen[ni] || !C.inside[ni]) continue;
        // Toucher une case déjà atteinte gagne toujours, même si elle est hard
        // (une autre porte, un autre quai) : c'est notre point d'arrivée.
        if (reached[ni]) { seen[ni] = 1; prev[ni] = c; goal = ni; break; }
        if (C.hard[ni]) continue;             // infranchissable pour creuser
        seen[ni] = 1; prev[ni] = c;
        q.push(ni);
      }
    }
    if (!C.hard[start]) paintRoad(C, sx, sy, tile);
    reached[start] = 1;
    if (goal < 0) return false;
    let c = prev[goal];
    while (c !== -1 && c !== start) {
      const cx = c % C.w, cy = (c / C.w) | 0;
      if (!C.hard[c]) paintRoad(C, cx, cy, tile);
      reached[c] = 1;
      c = prev[c];
    }
    reached[goal] = 1;
    return true;
  }

  function guaranteeConnectivity(C, def, centre) {
    // a) Une porte doit toujours rester une porte : si un bâtiment l'a malgré
    //    tout recouverte, on la rouvre avant même de tester quoi que ce soit.
    for (const g of def.gates) {
      if (!inb(C, g.x, g.y)) continue;
      const i = I(C, g.x, g.y);
      if (C.g[i] !== 'GATE_ARCH') { C.hard[i] = 0; hard(C, g.x, g.y, 'GATE_ARCH'); }
    }

    // b) Composante marchable atteinte depuis la place (voisinage 3x3 du centre :
    //    le centre exact porte souvent la fontaine, qui n'est pas marchable).
    const n = C.w * C.h;
    const reached = new Uint8Array(n);
    const q = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = centre.cx + dx, y = centre.cy + dy;
      if (!inb(C, x, y)) continue;
      const i = I(C, x, y);
      if (walkable(C.g[i]) && !reached[i]) { reached[i] = 1; q.push(i); }
    }
    for (let k = 0; k < q.length; k++) {
      const c = q[k], cx = c % C.w, cy = (c / C.w) | 0;
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (let m = 0; m < 4; m++) {
        const nx = nb[m][0], ny = nb[m][1];
        if (!inb(C, nx, ny)) continue;
        const ni = I(C, nx, ny);
        if (reached[ni] || !walkable(C.g[ni])) continue;
        reached[ni] = 1; q.push(ni);
      }
    }

    // c) Chaque entrée obligatoire non atteinte se voit creuser une rue jusqu'à elle.
    const targets = [].concat(def.gates || []);
    if (def.arena) targets.push(def.arena);
    if (def.heal) targets.push(def.heal);
    if (def.shop) targets.push(def.shop);
    if (def.airship) targets.push(def.airship);
    for (const t of targets) {
      if (!t || !inb(C, t.x, t.y)) continue;
      if (reached[I(C, t.x, t.y)]) continue;
      carveToReached(C, t.x, t.y, reached, C.st.road);
    }
  }

  // ===========================================================================
  //  LES SIX PLANS
  // ===========================================================================
  //  Chacun a sa forme de rempart, sa trame de rues et sa position de château :
  //  ce sont ces trois choix, plus la palette de tuiles, qui font qu'on ne
  //  confond jamais deux villes.
  // ===========================================================================

  // --- Outils communs aux six -------------------------------------------------

  function addSign(C, def, x, y, label, text) {
    if (!inb(C, x, y) || C.prot[I(C, x, y)]) return;
    hard(C, x, y, 'SIGN');
    def.landmarks.push({ kind: 'sign', x, y, label, text });
  }

  // Quatre statues aux angles de la place, plus quelques mâts de bannière.
  function dressPlaza(C, def, cx, cy, r) {
    const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const p of pts) {
      const x = cx + p[0] * (r - 1), y = cy + p[1] * (r - 1);
      if (!inb(C, x, y) || !C.inside[I(C, x, y)]) continue;
      C.prot[I(C, x, y)] = 0;
      hard(C, x, y, 'STATUE');
      def.landmarks.push({ kind: 'statue', x, y, label: 'Statue' });
    }
    for (const p of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = cx + p[0] * r, y = cy + p[1] * r;
      if (!inb(C, x, y) || C.prot[I(C, x, y)] || !C.inside[I(C, x, y)]) continue;
      hard(C, x, y, 'BANNER_POLE');
    }
  }

  // ---------------------------------------------------------------------------
  //  Port aérien (§17 bis) : une plateforme d'au moins 5×5, un mât d'amarrage
  //  au centre (non marchable, c'est le repère qu'on voit de loin) et une case
  //  d'embarquement (AIRSHIP_DOCK) en bordure, reliée à la rue comme une porte
  //  de bâtiment. `edge` = côté par lequel on y accède ('S','N','E','W').
  //  Comme pour `building()`, on ne recouvre jamais une case déjà réservée.
  // ---------------------------------------------------------------------------
  function airshipPort(C, def, x, y, w, h, edge, name, linkTile) {
    w = Math.max(5, w); h = Math.max(5, h);
    const reserved = new Set();
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const idx = I(C, i, j);
      if (C.hard[idx] || C.prot[idx]) reserved.add(idx);
    }
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (!reserved.has(I(C, i, j))) hard(C, i, j, 'AIRSHIP_PLATFORM');
    }
    const mx = x + ((w / 2) | 0), my = y + ((h / 2) | 0);
    if (!reserved.has(I(C, mx, my))) { C.hard[I(C, mx, my)] = 0; hard(C, mx, my, 'AIRSHIP_MAST'); }

    let dx, dy, fx, fy;
    if (edge === 'S') { dx = mx; dy = y + h - 1; fx = dx; fy = dy + 1; }
    else if (edge === 'N') { dx = mx; dy = y; fx = dx; fy = dy - 1; }
    else if (edge === 'E') { dx = x + w - 1; dy = my; fx = dx + 1; fy = dy; }
    else { dx = x; dy = my; fx = dx - 1; fy = dy; }
    // La case d'embarquement, comme une porte, est toujours forcée.
    C.hard[I(C, dx, dy)] = 0;
    hard(C, dx, dy, 'AIRSHIP_DOCK');
    connectSpine(C, fx, fy, linkTile || C.st.road);

    def.airship = { x: dx, y: dy, name };
    def.landmarks.push({ kind: 'airship', x: dx, y: dy, label: name });
    return { x: dx, y: dy, mx, my };
  }

  // Halles de marché : des rangées d'étals séparées par des allées couvertes.
  function marketHall(C, x, y, cols, rows, aisleTile) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + c, py = y + r;
        if (!inb(C, px, py) || !C.inside[I(C, px, py)] || C.hard[I(C, px, py)]) continue;
        if (r % 2 === 1) paintLane(C, px, py, aisleTile);
        else hard(C, px, py, 'MARKET_STALL');
      }
    }
  }

  // --------------------------------------------------------------------------
  //  1. BOURG-ÉMERAUDE (val) — 48 × 38
  //  Parti pris : un octogone de pierre claire posé dans la forêt. Deux
  //  chemins de ronde concentriques et des avenues qui rayonnent : un plan
  //  ORGANIQUE, arrondi, très vert. Le château est adossé au rempart nord.
  //  Le joueur démarre en (24,30) dans la région : la porte ouest lui fait face.
  // --------------------------------------------------------------------------
  function planEmeraude(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const x0 = 2, y0 = 2, x1 = W - 3, y1 = H - 3, cut = 8;
    buildWall(C, (x, y) => (
      x >= x0 && x <= x1 && y >= y0 && y <= y1 &&
      (x - x0) + (y - y0) >= cut && (x1 - x) + (y - y0) >= cut &&
      (x - x0) + (y1 - y) >= cut && (x1 - x) + (y1 - y) >= cut
    ), 'WALL');
    fillInterior(C, st.soil);

    const cx = 23, cy = 21;
    placeTowers(C, cx, cy, 10, 'WALL_TOWER');

    // Portes : ouest (celle qui regarde le point de départ), sud, est.
    const gW = placeGate(C, cx, 16 - 21 + cy, -1, 0, 'Porte des Bois');
    const gS = placeGate(C, cx, cy, 0.15, 1, 'Porte du Ruisseau');
    const gE = placeGate(C, cx, cy, 1, 0.35, 'Porte du Levant');
    for (const g of [gW, gS, gE]) if (g) def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
    if (gW) approachRoad(C, gW, -1, 0, st.outRoad);
    if (gS) approachRoad(C, gS, 0, 1, st.outRoad);
    if (gE) approachRoad(C, gE, 1, 0, st.outRoad);

    // Grande place ronde au cœur, puis les deux chemins de ronde.
    def.plaza = plazaDisk(C, cx, cy, 6, 3, st);
    ringRoad(C, 3, 4, st.road);          // chemin de ronde le long du rempart
    ringRoad(C, 10, 11, st.road);        // boulevard intérieur

    // Avenues : des portes vers la place, en tracé légèrement biscornu.
    for (const g of [gW, gS, gE]) if (g) walkTo(C, g.x, g.y, cx, cy, 1, st.road, 'diag');

    // Château adossé au rempart nord, herse tournée vers la place.
    const cast = { x: 16, y: 6, w: 12, h: 7 };
    building(C, cast.x, cast.y, cast.w, cast.h, 'CASTLE',
      { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'S', off: -1 });
    def.castle = { x: cast.x + 5, y: cast.y + cast.h - 1 };

    // Église à clocher, à l'est de la place, avec son parvis.
    building(C, 31, 17, 5, 8, 'CHURCH', {});
    hard(C, 33, 17, 'CHURCH_TOWER');
    const parvis = { x: 30, y: 20 };
    connectSpine(C, parvis.x, parvis.y, st.road);
    def.church = parvis;

    // Arène (le stade des dresseurs), au sud-ouest.
    const ar = building(C, 9, 24, 9, 7, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'N' });
    def.arena = { x: ar.x, y: ar.y };

    // Centre de soins et boutique, de part et d'autre de l'avenue sud.
    const hc = building(C, 26, 27, 4, 3, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'W' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 17, 15, 3, 3, 'SHOP', { door: 'SHOP_DOOR', side: 'S' });
    def.shop = { x: sh.x, y: sh.y };

    // Halles de marché sur le flanc ouest de la place.
    marketHall(C, 14, 18, 4, 5, st.plaza);
    def.landmarks.push({ kind: 'market', x: 15, y: 20, label: 'Halles de Bourg-Émeraude' });

    // Fontaine et parure de la place.
    hard(C, cx, cy, 'GRAND_FOUNTAIN');
    def.fountain = { x: cx, y: cy };
    dressPlaza(C, def, cx, cy, 5);

    // Un grand parc arboré au sud-est : Bourg-Émeraude vit au milieu des arbres.
    for (let y = 24; y < 32; y++) {
      for (let x = 28; x < 40; x++) {
        if (!freeCell(C, x, y)) continue;
        const i = I(C, x, y);
        C.g[i] = (C.rnd() < 0.42) ? st.tree : 'PARK_GRASS';
        if (C.rnd() < 0.25) C.g[i] = 'PARK_FLOWER';
        C.taken[i] = 1;
      }
    }
    def.landmarks.push({ kind: 'park', x: 33, y: 27, label: 'Jardin des Émeraudes' });

    // Escale d'Émeraude : une terrasse de bois au nord-est, à l'écart du
    // château, des halles et du parc.
    airshipPort(C, def, 30, 7, 6, 6, 'S', 'Escale d\'Émeraude');

    fillBlocks(C, { gardenRate: 0.6, manorRate: 0.12 });
    dressStreets(C, { every: 7 });
    if (gW) addSign(C, def, gW.x + 2, gW.y - 2, 'Panneau', 'Bourg-Émeraude — Arène de type Plante');
    return { cx, cy };
  }

  // --------------------------------------------------------------------------
  //  2. AMBRELUNE (sylve) — 46 × 36
  //  Parti pris : la ville est BÂTIE SUR L'EAU. Le sol du rempart est un marais ;
  //  tout ce qui se marche est une passerelle de bois. Le plan est une trame de
  //  pontons en arêtes de poisson, la « place » est un grand ponton circulaire,
  //  et le « château » est un grand kiosque sur pilotis au nord.
  // --------------------------------------------------------------------------
  function planAmbrelune(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const cx = 22, cy = 18;
    // Rempart de bois aux angles très arrondis (une palissade de mangrove).
    buildWall(C, (x, y) => {
      const dx = (x - cx) / 21.0, dy = (y - cy) / 16.0;
      return Math.pow(Math.abs(dx), 3.2) + Math.pow(Math.abs(dy), 3.2) <= 1;
    }, 'WALL');
    fillInterior(C, st.soil);
    placeTowers(C, cx, cy, 8, 'WALL_TOWER');

    const gN = placeGate(C, cx, cy, -0.25, -1, 'Porte des Lianes');
    const gS = placeGate(C, cx, cy, 0.2, 1, 'Porte du Marais');
    const gE = placeGate(C, cx, cy, 1, -0.15, 'Porte des Lanternes');
    for (const g of [gN, gS, gE]) if (g) def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
    if (gN) approachRoad(C, gN, 0, -1, st.outRoad);
    if (gS) approachRoad(C, gS, 0, 1, st.outRoad);
    if (gE) approachRoad(C, gE, 1, 0, st.outRoad);

    // Le grand ponton central.
    def.plaza = plazaDisk(C, cx, cy, 5, 2, st);
    // Trame en arêtes de poisson : une longue passerelle est-ouest, et des
    // pontons perpendiculaires tous les 4 pas. Rien d'orthogonal ailleurs.
    walkTo(C, 3, cy, W - 4, cy, 1, st.road, 'L');
    for (let x = 6; x < W - 5; x += 4) {
      walkTo(C, x, cy, x, 5, 0, st.road, 'L');
      walkTo(C, x + 2, cy, x + 2, H - 6, 0, st.road, 'L');
    }
    // Deux passerelles longitudinales pour boucler le réseau (sinon : impasses).
    walkTo(C, 6, 7, W - 8, 7, 0, st.road, 'L');
    walkTo(C, 8, H - 8, W - 6, H - 8, 0, st.road, 'L');
    for (const g of [gN, gS, gE]) if (g) walkTo(C, g.x, g.y, cx, cy, 1, st.road, 'L');

    // Le Grand Kiosque (le « château » d'Ambrelune) au nord de la place.
    building(C, 17, 4, 11, 6, 'CASTLE', { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'S' });
    def.castle = { x: 22, y: 9 };

    // Le Temple de la Lune : une nef de feuilles à l'ouest.
    building(C, 6, 13, 5, 7, 'CHURCH', {});
    hard(C, 8, 13, 'CHURCH_TOWER');
    connectSpine(C, 11, 16, st.road);
    def.church = { x: 11, y: 16 };

    const ar = building(C, 30, 20, 9, 7, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'N' });
    def.arena = { x: ar.x, y: ar.y };
    const hc = building(C, 13, 22, 4, 3, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'N' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 29, 12, 3, 3, 'SHOP', { door: 'SHOP_DOOR', side: 'S' });
    def.shop = { x: sh.x, y: sh.y };

    marketHall(C, 16, 24, 6, 5, st.plaza);
    def.landmarks.push({ kind: 'market', x: 18, y: 26, label: 'Marché flottant d\'Ambrelune' });

    hard(C, cx, cy, 'GRAND_FOUNTAIN');
    def.fountain = { x: cx, y: cy };
    dressPlaza(C, def, cx, cy, 4);

    // Ponton d'Ambrelune : une plateforme surélevée dans la canopée, au nord-est
    // du kiosque, loin des pilotis serrés.
    airshipPort(C, def, 30, 5, 6, 6, 'S', 'Ponton d\'Ambrelune');

    // Les maisons sont des cabanes sur pilotis : petites, jamais mitoyennes en 3×2.
    fillBlocks(C, { sizes: [[2, 2], [2, 1], [1, 2], [1, 1], [1, 1]], gardenRate: 0.75, manorRate: 0.08 });
    dressStreets(C, { every: 5 });
    if (gS) addSign(C, def, gS.x + 2, gS.y - 2, 'Panneau', 'Ambrelune, la cité des lanternes');
    return { cx, cy };
  }

  // --------------------------------------------------------------------------
  //  3. PORT-SAPHIR (saphir) — 52 × 38
  //  Parti pris : un PORT. Le tiers sud de la ville est un bassin fermé par une
  //  digue percée d'une passe ; les quais descendent vers l'eau, le phare veille
  //  sur le môle. Le rempart plonge littéralement dans la mer. Trame en damier
  //  parallèle au rivage, château sur le promontoire ouest.
  // --------------------------------------------------------------------------
  function planSaphir(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const x0 = 2, y0 = 2, x1 = W - 3, y1 = H - 3;
    buildWall(C, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 &&
      !((x - x0) + (y - y0) < 5) && !((x1 - x) + (y - y0) < 5)), 'WALL');
    fillInterior(C, st.soil);
    const cx = 25, cy = 15;
    placeTowers(C, cx, cy, 11, 'WALL_TOWER');

    const gN = placeGate(C, cx, cy, -0.1, -1, 'Porte du Large');
    const gW = placeGate(C, cx, cy, -1, -0.1, 'Porte des Falaises');
    const gE = placeGate(C, cx, cy, 1, 0.05, 'Porte de Cendre');
    for (const g of [gN, gW, gE]) if (g) def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
    if (gN) approachRoad(C, gN, 0, -1, st.outRoad);
    if (gW) approachRoad(C, gW, -1, 0, st.outRoad);
    if (gE) approachRoad(C, gE, 1, 0, st.outRoad);

    // --- Le bassin du port : de y=26 à la digue sud ------------------------
    for (let y = 26; y <= y1 - 1; y++) {
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        const i = I(C, x, y);
        if (!C.inside[i] || C.hard[i]) continue;
        C.g[i] = 'SEA'; C.taken[i] = 1;
      }
    }
    // Quais : une bande de DOCK tout autour du bassin, plus deux môles.
    for (let x = 6; x <= W - 7; x++) { hard(C, x, 25, 'DOCK'); C.prot[I(C, x, 25)] = 1; }
    for (let y = 25; y <= 31; y++) { hard(C, 7, y, 'DOCK'); C.prot[I(C, 7, y)] = 1; hard(C, W - 8, y, 'DOCK'); C.prot[I(C, W - 8, y)] = 1; }
    for (let y = 26; y <= 32; y++) { hard(C, 20, y, 'DOCK'); C.prot[I(C, 20, y)] = 1; hard(C, 33, y, 'DOCK'); C.prot[I(C, 33, y)] = 1; }
    // Quelques barques amarrées le long des môles.
    for (const b of [[18, 28], [22, 30], [31, 27], [35, 31], [10, 29], [26, 33]]) {
      if (inb(C, b[0], b[1]) && C.g[I(C, b[0], b[1])] === 'SEA') hard(C, b[0], b[1], 'BOAT');
    }
    // Récifs à l'extérieur de la digue sud : la mer continue au-delà.
    for (let x = 6; x <= W - 7; x++) {
      for (let y = y1 + 1; y < H; y++) if (C.rnd() < 0.5) { C.g[I(C, x, y)] = C.rnd() < 0.3 ? 'REEF' : 'SEA'; C.taken[I(C, x, y)] = 1; }
    }
    // Le phare, au bout du môle est.
    hard(C, 33, 33, 'LIGHTHOUSE_BASE');
    def.landmarks.push({ kind: 'lighthouse', x: 33, y: 33, label: 'Phare de Port-Saphir' });

    // Amarre du Phare : le môle du port, juste à l'est du phare.
    airshipPort(C, def, 36, 29, 5, 5, 'N', 'Amarre du Phare', 'DOCK');

    // --- La ville haute : damier parallèle au rivage -----------------------
    def.plaza = plazaRect(C, 18, 11, 15, 9, st, 3);
    ringRoad(C, 3, 4, st.road);
    for (let x = 6; x < W - 5; x += 6) walkTo(C, x, 5, x, 24, 0, st.road, 'L');
    for (let y = 6; y < 25; y += 5) walkTo(C, 5, y, W - 6, y, 0, st.road, 'L');
    walkTo(C, 6, 22, W - 7, 22, 1, st.road, 'L');   // le grand quai haut
    for (const g of [gN, gW, gE]) if (g) walkTo(C, g.x, g.y, cx, cy, 1, st.road, 'L');
    // Descente aux quais : deux rampes larges depuis le grand quai haut.
    walkTo(C, 12, 22, 12, 25, 1, st.road, 'L');
    walkTo(C, 38, 22, 38, 25, 1, st.road, 'L');

    // Château-amirauté sur le promontoire ouest, dominant le bassin.
    building(C, 4, 12, 9, 8, 'CASTLE', { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'E' });
    def.castle = { x: 12, y: 16 };

    // Église des marins, au nord de la place.
    building(C, 22, 4, 5, 6, 'CHURCH', {});
    hard(C, 24, 4, 'CHURCH_TOWER');
    connectSpine(C, 24, 10, st.road);
    def.church = { x: 24, y: 10 };

    const ar = building(C, 38, 12, 9, 8, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'W' });
    def.arena = { x: ar.x, y: ar.y };
    const hc = building(C, 14, 22, 4, 3, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'N' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 34, 22, 3, 3, 'SHOP', { door: 'SHOP_DOOR', side: 'N' });
    def.shop = { x: sh.x, y: sh.y };

    marketHall(C, 8, 7, 8, 5, st.plaza);
    def.landmarks.push({ kind: 'market', x: 11, y: 9, label: 'Criée de Port-Saphir' });

    const fx = 25, fy = 15;
    hard(C, fx, fy, 'GRAND_FOUNTAIN');
    def.fountain = { x: fx, y: fy };
    dressPlaza(C, def, fx, fy, 5);

    fillBlocks(C, { gardenRate: 0.45, manorRate: 0.14 });
    dressStreets(C, { every: 6 });
    if (gN) addSign(C, def, gN.x + 2, gN.y + 2, 'Panneau', 'Port-Saphir — Arène de type Eau');
    return { cx: fx, cy: fy };
  }

  // --------------------------------------------------------------------------
  //  4. CIMEFROIDE (givre) — 46 × 36
  //  Parti pris : une ville FORTERESSE d'hiver. Rectangle strict, rues étroites
  //  en damier serré, deux portes seulement (on se protège du froid), grandes
  //  halles couvertes au centre, château massif adossé au rempart nord sur sa
  //  terrasse, église trapue au sud. Pierre sombre et neige partout.
  // --------------------------------------------------------------------------
  function planCimefroide(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const x0 = 2, y0 = 2, x1 = W - 3, y1 = H - 3;
    buildWall(C, (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1), 'WALL');
    fillInterior(C, st.soil);
    const cx = 22, cy = 19;
    // Tours régulières le long des courtines : c'est une place forte.
    for (let x = x0; x <= x1; x += 7) { hard(C, x, y0, 'WALL_TOWER'); hard(C, x, y1, 'WALL_TOWER'); }
    for (let y = y0; y <= y1; y += 7) { hard(C, x0, y, 'WALL_TOWER'); hard(C, x1, y, 'WALL_TOWER'); }
    hard(C, x0, y0, 'WALL_TOWER'); hard(C, x1, y0, 'WALL_TOWER');
    hard(C, x0, y1, 'WALL_TOWER'); hard(C, x1, y1, 'WALL_TOWER');

    const gS = placeGate(C, cx, cy, -0.05, 1, 'Porte de la Combe');
    const gE = placeGate(C, cx, cy, 1, 0.1, 'Porte de l\'Arête');
    for (const g of [gS, gE]) if (g) def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
    if (gS) approachRoad(C, gS, 0, 1, st.outRoad);
    if (gE) approachRoad(C, gE, 1, 0, st.outRoad);

    // Damier serré : ruelles tous les 4, deux grandes avenues croisées.
    def.plaza = plazaRect(C, 16, 15, 13, 9, st, 3);
    ringRoad(C, 2, 3, st.road);
    walkTo(C, 4, cy, W - 5, cy, 1, st.road, 'L');
    walkTo(C, cx, 4, cx, H - 5, 1, st.road, 'L');
    for (let x = 6; x < W - 5; x += 4) walkTo(C, x, 5, x, H - 6, 0, st.road, 'L');
    for (let y = 6; y < H - 5; y += 4) walkTo(C, 5, y, W - 6, y, 0, st.road, 'L');
    for (const g of [gS, gE]) if (g) walkTo(C, g.x, g.y, cx, cy, 1, st.road, 'L');

    // Château massif adossé au rempart nord, sur sa terrasse.
    building(C, 15, 5, 14, 7, 'CASTLE', { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'S' });
    def.castle = { x: 22, y: 11 };
    def.landmarks.push({ kind: 'castle', x: 22, y: 8, label: 'Donjon de Cimefroide' });

    // Église trapue au sud-ouest, contreforts et clocher pointu.
    building(C, 7, 24, 5, 7, 'CHURCH', {});
    hard(C, 9, 30, 'CHURCH_TOWER');
    connectSpine(C, 9, 23, st.road);
    def.church = { x: 9, y: 23 };

    const ar = building(C, 31, 24, 9, 7, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'N' });
    def.arena = { x: ar.x, y: ar.y };
    const hc = building(C, 31, 8, 4, 3, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'S' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 10, 8, 3, 3, 'SHOP', { door: 'SHOP_DOOR', side: 'S' });
    def.shop = { x: sh.x, y: sh.y };

    // LES HALLES : deux grandes nefs couvertes, la fierté de Cimefroide.
    marketHall(C, 14, 26, 12, 5, st.plaza);
    def.landmarks.push({ kind: 'market', x: 19, y: 28, label: 'Halles couvertes de Cimefroide' });

    hard(C, cx, cy, 'GRAND_FOUNTAIN');
    def.fountain = { x: cx, y: cy };
    dressPlaza(C, def, cx, cy, 5);

    // Mât de Cimefroide : le promontoire rocheux à l'est de la ville, au-dessus
    // des toits, entre les halles et l'arène.
    airshipPort(C, def, 34, 14, 6, 6, 'W', 'Mât de Cimefroide');

    fillBlocks(C, { sizes: [[2, 2], [2, 1], [1, 2], [1, 1], [3, 2], [2, 3]], gardenRate: 0.35, manorRate: 0.15 });
    dressStreets(C, { every: 5 });
    if (gS) addSign(C, def, gS.x + 2, gS.y - 2, 'Panneau', 'Cimefroide — couvre-toi bien !');
    return { cx, cy };
  }

  // --------------------------------------------------------------------------
  //  5. FOURNAISE (braise) — 46 × 36
  //  Parti pris : un plan RADIAL autour d'un cratère. La grande fontaine est une
  //  fontaine de feu au centre ; quatre coulées de lave canalisées rayonnent
  //  vers les quatre quartiers de forges, franchies par des ponts. Le rempart
  //  est un octogone de basalte, la forteresse est plantée au sud-est.
  //
  //  ATTENTION (piège de génération) : les coulées s'arrêtent AVANT le chemin de
  //  ronde. Si elles le coupaient, chaque quartier deviendrait un cul-de-sac.
  // --------------------------------------------------------------------------
  function planFournaise(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const cx = 22, cy = 18;
    const x0 = 2, y0 = 2, x1 = W - 3, y1 = H - 3, cut = 10;
    buildWall(C, (x, y) => (
      x >= x0 && x <= x1 && y >= y0 && y <= y1 &&
      (x - x0) + (y - y0) >= cut && (x1 - x) + (y - y0) >= cut &&
      (x - x0) + (y1 - y) >= cut && (x1 - x) + (y1 - y) >= cut
    ), 'WALL');
    fillInterior(C, st.soil);
    placeTowers(C, cx, cy, 8, 'WALL_TOWER');

    // Quatre portes, sur les pans coupés : elles ne tombent jamais sur une coulée.
    const gs = [
      placeGate(C, cx, cy, -1, -1, 'Porte des Cendres'),
      placeGate(C, cx, cy, 1, -1, 'Porte des Forges'),
      placeGate(C, cx, cy, -1, 1, 'Porte du Soufre'),
      placeGate(C, cx, cy, 1, 1, 'Porte de la Caldeira'),
    ];
    const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    gs.forEach((g, k) => {
      if (!g) return;
      def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
      approachRoad(C, g, dirs[k][0], dirs[k][1], st.outRoad);
    });

    // Place annulaire autour du cratère.
    def.plaza = plazaDisk(C, cx, cy, 7, 4, st);
    ringRoad(C, 3, 4, st.road);
    ringRoad(C, 9, 10, st.road);
    gs.forEach((g) => { if (g) walkTo(C, g.x, g.y, cx, cy, 1, st.road, 'diag'); });

    // Les quatre coulées de lave : du bord de la place jusqu'à la 2e ceinture.
    // Elles sont larges de 2 et franchies chacune par un pont.
    const chans = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const c of chans) {
      for (let d = 8; d <= 13; d++) {
        for (let o = 0; o <= 1; o++) {
          const x = cx + c[0] * d + (c[0] ? 0 : o), y = cy + c[1] * d + (c[1] ? 0 : o);
          if (!inb(C, x, y) || !C.inside[I(C, x, y)] || C.hard[I(C, x, y)]) continue;
          if (C.dist[I(C, x, y)] < 6) continue;      // jamais sur le chemin de ronde
          C.g[I(C, x, y)] = 'LAVA'; C.taken[I(C, x, y)] = 1; C.prot[I(C, x, y)] = 0;
        }
      }
      // Le pont, au milieu de la coulée.
      const bd = 11;
      for (let o = -1; o <= 2; o++) {
        const x = cx + c[0] * bd + (c[0] ? 0 : o), y = cy + c[1] * bd + (c[1] ? 0 : o);
        if (!inb(C, x, y) || !C.inside[I(C, x, y)]) continue;
        C.hard[I(C, x, y)] = 0;
        paintRoad(C, x, y, 'BRIDGE');
      }
      // et une amorce de rue de chaque côté du pont, pour qu'il mène quelque part
      const px = cx + c[0] * bd, py = cy + c[1] * bd;
      walkTo(C, px - c[1] * 3, py - c[0] * 3, px + c[1] * 3, py + c[0] * 3, 0, st.road, 'L');
    }

    // La Forteresse de Fournaise, au sud-est, sur son promontoire d'obsidienne.
    building(C, 30, 22, 11, 8, 'CASTLE', { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'N' });
    def.castle = { x: 35, y: 22 };
    def.landmarks.push({ kind: 'castle', x: 35, y: 26, label: 'Forteresse de Fournaise' });

    // Le Sanctuaire des Braises, au nord-ouest.
    building(C, 8, 6, 5, 7, 'CHURCH', {});
    hard(C, 10, 6, 'CHURCH_TOWER');
    connectSpine(C, 13, 9, st.road);
    def.church = { x: 13, y: 9 };

    const ar = building(C, 6, 22, 9, 7, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'N' });
    def.arena = { x: ar.x, y: ar.y };
    const hc = building(C, 28, 8, 4, 3, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'S' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 17, 6, 3, 3, 'SHOP', { door: 'SHOP_DOOR', side: 'S' });
    def.shop = { x: sh.x, y: sh.y };

    // Les forges : des étals-enclumes en rangées, et des tours à braseros.
    marketHall(C, 24, 12, 6, 5, st.plaza);
    def.landmarks.push({ kind: 'market', x: 26, y: 14, label: 'Forges de Fournaise' });
    for (const t of [[14, 12], [30, 20], [14, 24], [30, 12]]) {
      if (inb(C, t[0], t[1]) && !C.hard[I(C, t[0], t[1])] && !C.prot[I(C, t[0], t[1])]) {
        hard(C, t[0], t[1], 'BANNER_POLE');
      }
    }

    hard(C, cx, cy, 'GRAND_FOUNTAIN');
    def.fountain = { x: cx, y: cy };
    dressPlaza(C, def, cx, cy, 6);

    // Pont de Fournaise : une passerelle de basalte au nord-est, entre les
    // forges et la forteresse, à l'écart des coulées de lave.
    airshipPort(C, def, 35, 14, 6, 6, 'W', 'Pont de Fournaise');

    fillBlocks(C, { sizes: [[2, 2], [3, 2], [2, 1], [1, 2], [1, 1]], gardenRate: 0.3, manorRate: 0.1 });
    dressStreets(C, { every: 6 });
    const g0 = gs.find(Boolean);
    if (g0) addSign(C, def, g0.x + 2, g0.y + 2, 'Panneau', 'Fournaise — ne touche pas la lave !');
    return { cx, cy };
  }

  // --------------------------------------------------------------------------
  //  6. AURORE-CITÉ (aurore) — 64 × 48, la plus grande
  //  Parti pris : le MARBRE ET L'OR. Une avenue triomphale nord-sud de 7 tuiles,
  //  une avenue est-ouest, une place d'apparat immense, un grand escalier qui
  //  monte à l'acropole du nord où siègent le palais et l'observatoire.
  //  Trame en damier monumental, îlots larges, jardins réguliers.
  // --------------------------------------------------------------------------
  function planAurore(C, def) {
    const W = C.w, H = C.h, st = C.st;
    const x0 = 2, y0 = 2, x1 = W - 3, y1 = H - 3, cut = 9;
    buildWall(C, (x, y) => (
      x >= x0 && x <= x1 && y >= y0 && y <= y1 &&
      (x - x0) + (y - y0) >= cut && (x1 - x) + (y - y0) >= cut &&
      (x - x0) + (y1 - y) >= cut && (x1 - x) + (y1 - y) >= cut
    ), 'WALL');
    fillInterior(C, st.soil);
    const cx = 31, cy = 29;
    placeTowers(C, cx, cy, 14, 'WALL_TOWER');

    const gS = placeGate(C, cx, cy, 0, 1, 'Porte du Couchant');
    const gW = placeGate(C, cx, cy, -1, 0.1, 'Porte des Anciens');
    const gE = placeGate(C, cx, cy, 1, 0.1, 'Porte de l\'Arête');
    const gN = placeGate(C, cx, cy, 0.08, -1, 'Porte des Étoiles');
    const gates = [gS, gW, gE, gN];
    const gdirs = [[0, 1], [-1, 0], [1, 0], [0, -1]];
    gates.forEach((g, k) => {
      if (!g) return;
      def.gates.push({ x: g.x, y: g.y, dir: g.dir, label: g.label });
      approachRoad(C, g, gdirs[k][0], gdirs[k][1], st.outRoad);
    });

    // La place d'apparat : 19 × 13, cœur de marbre.
    def.plaza = plazaRect(C, cx - 9, cy - 6, 19, 13, st, 4);
    ringRoad(C, 3, 5, st.road);                   // boulevard des remparts, large
    // L'avenue triomphale (7 de large) et l'avenue est-ouest (5 de large).
    walkTo(C, cx, 6, cx, H - 6, 3, 'STAR_PATH', 'L');
    walkTo(C, 6, cy, W - 7, cy, 2, st.road, 'L');
    // Damier monumental : îlots de 7.
    for (let x = cx - 21; x <= cx + 21; x += 7) if (Math.abs(x - cx) > 3) walkTo(C, x, 7, x, H - 8, 0, st.road, 'L');
    for (let y = cy - 21; y <= cy + 21; y += 7) if (Math.abs(y - cy) > 3) walkTo(C, 7, y, W - 8, y, 0, st.road, 'L');
    gates.forEach((g) => { if (g) walkTo(C, g.x, g.y, cx, cy, 2, st.road, 'L'); });

    // --- L'acropole du nord : grands escaliers, palais, observatoire --------
    // Les gradins : trois paliers de marbre qui montent vers le palais.
    for (let k = 0; k < 3; k++) {
      const yy = 16 - k * 2;
      for (let x = cx - 8 + k; x <= cx + 8 - k; x++) {
        if (!inb(C, x, yy) || !C.inside[I(C, x, yy)] || C.hard[I(C, x, yy)]) continue;
        paintRoad(C, x, yy, 'PLAZA_GRAND');
        paintRoad(C, x, yy - 1, 'PLAZA_GRAND');
      }
    }
    def.landmarks.push({ kind: 'stairs', x: cx, y: 14, label: 'Grands Escaliers d\'Aurore' });

    building(C, cx - 8, 4, 17, 8, 'CASTLE', { corner: 'CASTLE_TOWER', door: 'CASTLE_GATE', side: 'S' });
    def.castle = { x: cx, y: 11 };
    def.landmarks.push({ kind: 'castle', x: cx, y: 7, label: 'Palais d\'Aurore' });

    // L'observatoire, à l'est de l'acropole, sur son parvis d'étoiles.
    for (let y = 9; y <= 15; y++) for (let x = 46; x <= 52; x++) {
      if (inb(C, x, y) && C.inside[I(C, x, y)] && !C.hard[I(C, x, y)]) { C.g[I(C, x, y)] = 'OBSERVATORY_FLOOR'; C.taken[I(C, x, y)] = 1; }
    }
    hard(C, 49, 12, 'CRYSTAL_SPIRE');
    connectSpine(C, 49, 16, st.road);
    def.landmarks.push({ kind: 'observatory', x: 49, y: 12, label: 'Observatoire d\'Astréa' });

    // Quai des Nuées : la terrasse haute juste à l'est de l'observatoire.
    airshipPort(C, def, 53, 9, 6, 7, 'W', 'Quai des Nuées');

    // La cathédrale, au sud de la place, face à l'avenue triomphale.
    building(C, cx - 4, 40, 9, 6, 'CHURCH', {});
    hard(C, cx, 40, 'CHURCH_TOWER');
    hard(C, cx - 3, 40, 'CHURCH_TOWER');
    hard(C, cx + 3, 40, 'CHURCH_TOWER');
    connectSpine(C, cx, 39, st.road);
    def.church = { x: cx, y: 39 };
    def.landmarks.push({ kind: 'church', x: cx, y: 43, label: 'Cathédrale de la Lumière' });

    const ar = building(C, 10, 33, 11, 8, 'ARENA_WALL', { door: 'ARENA_DOOR', side: 'N' });
    def.arena = { x: ar.x, y: ar.y };
    const hc = building(C, 44, 33, 5, 4, 'HEAL_CENTER', { door: 'HEAL_DOOR', side: 'N' });
    def.heal = { x: hc.x, y: hc.y };
    const sh = building(C, 12, 20, 4, 4, 'SHOP', { door: 'SHOP_DOOR', side: 'E' });
    def.shop = { x: sh.x, y: sh.y };

    marketHall(C, 42, 20, 10, 7, st.plaza);
    def.landmarks.push({ kind: 'market', x: 46, y: 23, label: 'Grand Marché d\'Aurore' });

    hard(C, cx, cy, 'GRAND_FOUNTAIN');
    def.fountain = { x: cx, y: cy };
    dressPlaza(C, def, cx, cy, 7);
    // Jardins suspendus en quinconce le long de l'avenue triomphale.
    for (let y = 20; y < 40; y += 4) {
      for (const x of [cx - 6, cx + 6]) {
        for (let j = 0; j < 2; j++) for (let i = -1; i <= 1; i++) {
          if (freeCell(C, x + i, y + j)) { C.g[I(C, x + i, y + j)] = (i === 0 ? 'ROSE_BED' : 'HEDGE'); C.taken[I(C, x + i, y + j)] = 1; }
        }
      }
    }

    fillBlocks(C, { sizes: [[3, 3], [3, 2], [2, 3], [2, 2], [2, 1], [1, 2]], gardenRate: 0.4, manorRate: 0.3 });
    dressStreets(C, { every: 5 });
    if (gS) addSign(C, def, gS.x + 3, gS.y - 2, 'Panneau', 'Aurore-Cité, la cité de marbre et d\'or');
    return { cx, cy };
  }

  // ===========================================================================
  //  CATALOGUE DES SIX VILLES
  // ===========================================================================
  const SPECS = [
    { id: 'bourg-emeraude', regionId: 'val', name: 'Bourg-Émeraude', style: 'emeraude', x: 26, y: 14, w: 48, h: 38, arenaType: 'plante', plan: planEmeraude },
    { id: 'ambrelune', regionId: 'sylve', name: 'Ambrelune', style: 'ambrelune', x: 150, y: 64, w: 46, h: 36, arenaType: 'foudre', plan: planAmbrelune },
    { id: 'port-saphir', regionId: 'saphir', name: 'Port-Saphir', style: 'saphir', x: 62, y: 132, w: 52, h: 38, arenaType: 'eau', plan: planSaphir },
    { id: 'cimefroide', regionId: 'givre', name: 'Cimefroide', style: 'cimefroide', x: 210, y: 48, w: 46, h: 36, arenaType: 'glace', plan: planCimefroide },
    { id: 'fournaise', regionId: 'braise', name: 'Fournaise', style: 'fournaise', x: 104, y: 150, w: 46, h: 36, arenaType: 'feu', plan: planFournaise },
    { id: 'aurore-cite', regionId: 'aurore', name: 'Aurore-Cité', style: 'aurore', x: 152, y: 86, w: 64, h: 48, arenaType: 'lumiere', plan: planAurore },
  ];

  // ===========================================================================
  //  Construction d'une ville
  // ===========================================================================
  function makeCity(spec) {
    const st = STYLES[spec.style];
    const rnd = makeRng(seedOf(spec.id));
    const C = new Canvas(spec.w, spec.h, st, rnd);

    const def = {
      id: spec.id, regionId: spec.regionId, name: spec.name, style: spec.style,
      x: spec.x, y: spec.y, w: spec.w, h: spec.h,
      arenaType: spec.arenaType,
      gates: [], plaza: null,
      castle: null, church: null, arena: null, heal: null, shop: null, fountain: null,
      airship: null,
      landmarks: [],
      houses: 0,
    };

    const centre = spec.plan(C, def);

    // --- Passes finales : c'est ici qu'on garantit qu'on peut jouer ---------
    pruneDeadEnds(C);
    sealPockets(C, centre.cx, centre.cy);
    guaranteeConnectivity(C, def, centre);
    def.houses = C.houses;

    // Coordonnées locales -> absolues dans la carte de la région.
    const abs = (p) => (p ? { x: p.x + spec.x, y: p.y + spec.y } : null);
    def.gates = def.gates.map((g) => ({ x: g.x + spec.x, y: g.y + spec.y, dir: g.dir, label: g.label }));
    if (def.plaza) def.plaza = { x: def.plaza.x + spec.x, y: def.plaza.y + spec.y, w: def.plaza.w, h: def.plaza.h };
    def.castle = abs(def.castle); def.church = abs(def.church); def.arena = abs(def.arena);
    def.heal = abs(def.heal); def.shop = abs(def.shop); def.fountain = abs(def.fountain);
    def.airship = def.airship ? { x: def.airship.x + spec.x, y: def.airship.y + spec.y, name: def.airship.name } : null;
    def.landmarks = def.landmarks.map((l) => Object.assign({}, l, { x: l.x + spec.x, y: l.y + spec.y }));

    // La grille reste en local : `stamp` fait la translation au moment de poser.
    return { def, grid: C.g, w: C.w, h: C.h, ox: spec.x, oy: spec.y };
  }

  // ===========================================================================
  //  Points d'intérêt : ce que le joueur déclenche en marchant sur une tuile
  // ===========================================================================
  const POI_OF_TILE = {
    ARENA_DOOR: { kind: 'arena', data: { entry: 'arena' } },
    HEAL_DOOR: { kind: 'heal', data: { entry: 'heal' } },
    SHOP_DOOR: { kind: 'shop', data: { entry: 'shop' } },
    CASTLE_GATE: { kind: 'landmark', data: { entry: 'castle' } },
    GATE_ARCH: { kind: 'landmark', data: { entry: 'citygate' } },
    PORTAL: { kind: 'portal', data: { entry: 'portal' } },
    SIGN: { kind: 'sign', data: { entry: 'sign' } },
    AIRSHIP_DOCK: { kind: 'airship', data: { entry: 'airship' } },
  };

  function buildPoiIndex(city) {
    const map = new Map();
    const def = city.def;
    const add = (x, y, poi) => { map.set(x + ',' + y, poi); };
    for (let y = 0; y < city.h; y++) {
      for (let x = 0; x < city.w; x++) {
        const t = city.grid[y * city.w + x];
        if (!t) continue;
        const p = POI_OF_TILE[t];
        if (!p) continue;
        const ax = x + city.ox, ay = y + city.oy;
        let label = def.name;
        const data = Object.assign({ tile: t, cityId: def.id, city: def.name }, p.data);
        if (t === 'ARENA_DOOR') { label = 'Arène de ' + def.name; data.arenaType = def.arenaType; data.regionId = def.regionId; }
        else if (t === 'HEAL_DOOR') label = 'Centre de soins';
        else if (t === 'SHOP_DOOR') label = 'Boutique de ' + def.name;
        else if (t === 'CASTLE_GATE') label = 'Château de ' + def.name;
        else if (t === 'GATE_ARCH') {
          const g = def.gates.find((gg) => Math.abs(gg.x - ax) + Math.abs(gg.y - ay) <= 1);
          label = (g && g.label) || 'Porte de ' + def.name;
        }
        else if (t === 'AIRSHIP_DOCK') label = (def.airship && def.airship.name) || ('Port aérien de ' + def.name);
        add(ax, ay, { kind: p.kind, label, x: ax, y: ay, regionId: def.regionId, data });
      }
    }
    // L'église et les curiosités n'ont pas de tuile « porte » : on accroche le
    // POI à la case du parvis, que le joueur foule forcément en s'approchant.
    if (def.church) {
      add(def.church.x, def.church.y, {
        kind: 'landmark', label: (def.style === 'aurore' ? 'Cathédrale de ' : 'Église de ') + def.name,
        x: def.church.x, y: def.church.y, regionId: def.regionId,
        data: { entry: 'church', cityId: def.id, city: def.name },
      });
    }
    for (const l of def.landmarks) {
      if (l.kind === 'sign') {
        add(l.x, l.y, { kind: 'sign', label: l.label, x: l.x, y: l.y, regionId: def.regionId, data: { text: l.text, cityId: def.id } });
      }
    }
    return map;
  }

  // ===========================================================================
  //  API PUBLIQUE
  // ===========================================================================
  const CITIES = {};
  const BY_REGION = {};
  const POIS = {};

  try {
    for (const spec of SPECS) {
      const city = makeCity(spec);
      BY_REGION[spec.regionId] = city;
      CITIES[spec.regionId] = city.def;
      POIS[spec.regionId] = buildPoiIndex(city);
    }
  } catch (e) {
    // Règle n°7 du contrat : jamais d'exception au chargement.
    if (typeof console !== 'undefined') console.warn('cities3d : plan non généré —', e);
  }

  function get(regionId) { return CITIES[regionId] || null; }
  function plan(regionId) { return CITIES[regionId] || null; }

  // Estampe la ville dans la carte de la région. `put(x, y, type)` est fourni
  // par regions3d.js. Les cases laissées à `null` (la campagne autour du
  // rempart) ne sont volontairement PAS touchées : le terrain de la région y
  // reste tel quel, seules les routes d'accès sont posées.
  function stamp(regionId, put) {
    const city = BY_REGION[regionId];
    if (!city || typeof put !== 'function') return null;
    for (let y = 0; y < city.h; y++) {
      for (let x = 0; x < city.w; x++) {
        const t = city.grid[y * city.w + x];
        if (t == null) continue;
        put(x + city.ox, y + city.oy, t);
      }
    }
    return city.def;
  }

  function poiAt(regionId, x, y) {
    const m = POIS[regionId];
    if (!m) return null;
    return m.get(x + ',' + y) || null;
  }

  const API = { CITIES, get, stamp, poiAt, plan };

  // Petit extra utile aux tests et à regions3d : la liste brute des tuiles.
  API.tilesOf = function (regionId) {
    const c = BY_REGION[regionId];
    return c ? { grid: c.grid, w: c.w, h: c.h, ox: c.ox, oy: c.oy } : null;
  };

  if (HAS_R3 && typeof R3.register === 'function') R3.register('cities', API);
  if (typeof window !== 'undefined') window.CITIES3D = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;   // tests hors navigateur
})();
