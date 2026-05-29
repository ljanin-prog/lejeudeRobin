// Le monde du jeu : carte, biomes, tuiles, et dessin des tuiles.

const MAP_W = 120;
const MAP_H = 70;
const TILE = 16; // taille d'une tuile en pixels

const TILE_TYPES = {
  GRASS:        { walkable: true,  encounter: false, biome: 'forest' },
  TALL_GRASS:   { walkable: true,  encounter: true,  biome: 'forest' },
  FLOWERS:      { walkable: true,  encounter: false, biome: 'forest' },
  TREE:         { walkable: false, encounter: false, biome: 'forest' },
  WATER:        { walkable: false, encounter: false, biome: 'lake' },
  SHALLOW:      { walkable: true,  encounter: true,  biome: 'lake' },
  SAND:         { walkable: true,  encounter: false, biome: 'beach' },
  SEA:          { walkable: false, encounter: false, biome: 'sea' },
  WAVES:        { walkable: true,  encounter: true,  biome: 'sea' },
  PATH:         { walkable: true,  encounter: false, biome: 'plain' },
  PLAIN:        { walkable: true,  encounter: false, biome: 'plain' },
  TALL_PLAIN:   { walkable: true,  encounter: true,  biome: 'plain' },
  ROCK:         { walkable: false, encounter: false, biome: 'plain' },
  // --- Ville ---
  HOUSE_RED:    { walkable: false, encounter: false, biome: 'city' },
  HOUSE_BLUE:   { walkable: false, encounter: false, biome: 'city' },
  HOUSE_YELLOW: { walkable: false, encounter: false, biome: 'city' },
  CITY_PATH:    { walkable: true,  encounter: false, biome: 'city' },
  CITY_GROUND:  { walkable: true,  encounter: false, biome: 'city' },
  FOUNTAIN:     { walkable: false, encounter: false, biome: 'city' },
  // --- Parc ---
  PARK_GRASS:   { walkable: true,  encounter: false, biome: 'park' },
  PARK_TALL:    { walkable: true,  encounter: true,  biome: 'park' },
  PARK_FLOWER:  { walkable: true,  encounter: false, biome: 'park' },
  PARK_PATH:    { walkable: true,  encounter: false, biome: 'park' },
  PARK_TREE:    { walkable: false, encounter: false, biome: 'park' },
  POND:         { walkable: false, encounter: false, biome: 'park' },
  POND_EDGE:    { walkable: true,  encounter: true,  biome: 'lake' },
  BENCH:        { walkable: false, encounter: false, biome: 'park' },
  // --- Montagnes ---
  MOUNTAIN:     { walkable: false, encounter: false, biome: 'mountain' },
  MTN_PATH:     { walkable: true,  encounter: false, biome: 'mountain' },
  MTN_GRASS:    { walkable: true,  encounter: true,  biome: 'mountain' },
  SNOW:         { walkable: true,  encounter: true,  biome: 'mountain' },
  // --- Village ---
  VLG_HOUSE:    { walkable: false, encounter: false, biome: 'village' },
  VLG_PATH:     { walkable: true,  encounter: false, biome: 'village' },
  VLG_TALL:     { walkable: true,  encounter: true,  biome: 'village' },
  // --- Grande ville ---
  CITY2_PATH:   { walkable: true,  encounter: false, biome: 'city2' },
  CITY2_GROUND: { walkable: true,  encounter: false, biome: 'city2' },
  HOUSE2_RED:   { walkable: false, encounter: false, biome: 'city2' },
  HOUSE2_BLUE:  { walkable: false, encounter: false, biome: 'city2' },
  HOUSE2_YELLOW:{ walkable: false, encounter: false, biome: 'city2' },
  FOUNTAIN2:    { walkable: false, encounter: false, biome: 'city2' },
};

const BIOME_LABEL = {
  forest: 'Forêt magique',
  lake: 'Lac scintillant',
  plain: 'Plaine fleurie',
  beach: 'Plage dorée',
  sea: 'Bord de mer',
  park: 'Grand parc',
  city: 'Petite ville',
  mountain: 'Montagnes majestueuses',
  village: 'Petit village douillet',
  city2: 'Grande cité marchande',
};

// Pseudo-aléatoire déterministe basé sur la position
function hashPos(x, y) {
  let n = ((x | 0) * 374761393 + (y | 0) * 668265263) | 0;
  n = ((n ^ (n >>> 13)) * 1274126177) | 0;
  return ((n >>> 0) / 4294967296);
}

function getBiomeQuadrant(x, y) {
  // Sud : plage puis mer
  if (y >= 63) return 'sea';
  if (y >= 56) return 'beach';

  // Grande cité à l'est (x>=82, y>=38)
  if (x >= 82 && y >= 38) return 'city2';

  // Montagnes (est, x>=70, hors grande cité)
  if (x >= 70) return 'mountain';

  // Village (poche dans la plaine ouest)
  if (x >= 4 && x <= 20 && y >= 40 && y <= 54) return 'village';

  // Forêt (nord-ouest)
  if (x < 22 && y < 35) return 'forest';

  // Lac (nord-centre)
  if (x >= 22 && x < 45 && y < 15) return 'lake';

  // Ville 1 (nord, droite du lac)
  if (x >= 45 && x < 70 && y < 15) return 'city';

  // Parc (centre)
  if (x >= 22 && x < 46 && y >= 15 && y < 40) return 'park';

  // Plaine (tout le reste)
  return 'plain';
}

function generateTile(x, y) {
  // ----- Bordures du monde -----
  if (y === 0 || x === 0 || x === MAP_W - 1 || y === MAP_H - 1) {
    if (y === MAP_H - 1) return 'SEA';
    if (x === 0) return 'TREE';
    if (y === 0) {
      if (x >= 70) return 'MOUNTAIN';
      if (x >= 45) return 'HOUSE_RED';
      return 'TREE';
    }
    if (x === MAP_W - 1) {
      if (y >= 56) return 'SEA';
      return 'MOUNTAIN';
    }
    return 'TREE';
  }

  const biome = getBiomeQuadrant(x, y);
  const r = hashPos(x, y);

  // ----- Forêt -----
  if (biome === 'forest') {
    if (y >= 32 && r < 0.4) return 'GRASS';
    if (r < 0.18) return 'TREE';
    if (r < 0.34) return 'TALL_GRASS';
    if (r < 0.40) return 'FLOWERS';
    return 'GRASS';
  }

  // ----- Lac -----
  if (biome === 'lake') {
    if (x <= 22) return r < 0.5 ? 'GRASS' : 'SAND';
    if (y <= 2)  return r < 0.5 ? 'GRASS' : 'SAND';
    if (x === 23 || y === 3 || y === 13 || x === 44) return 'SAND';
    const distFromShore = Math.min(x - 23, 44 - x, y - 3, 13 - y);
    if (distFromShore <= 1) return 'SHALLOW';
    return 'WATER';
  }

  // ----- Plaine -----
  if (biome === 'plain') {
    if (y === 38 && x < 45) return 'PATH';
    if (x === 15 && y > 38 && y < 55) return 'PATH';
    if (r < 0.04) return 'ROCK';
    if (r < 0.20) return 'TALL_PLAIN';
    if (r < 0.26) return 'FLOWERS';
    return 'PLAIN';
  }

  // ----- Parc -----
  if (biome === 'park') {
    const lx = x - 22;
    const ly = y - 15;
    if (lx >= 7 && lx <= 11 && ly >= 10 && ly <= 12) {
      if (lx >= 8 && lx <= 10 && ly === 11) return 'POND';
      return 'POND_EDGE';
    }
    if (lx === 10 || ly === 11) return 'PARK_PATH';
    if ((lx === 5 && ly === 11) || (lx === 14 && ly === 11)) return 'BENCH';
    if ((lx === 10 && ly === 7) || (lx === 10 && ly === 15)) return 'BENCH';
    if ((lx <= 1 || lx >= 20) && r < 0.55) return 'PARK_TREE';
    if ((ly <= 1 || ly >= 22) && r < 0.5) return 'PARK_TREE';
    if (r < 0.10) return 'PARK_FLOWER';
    if (r < 0.20) return 'PARK_TALL';
    return 'PARK_GRASS';
  }

  // ----- Ville 1 -----
  if (biome === 'city') {
    const lx = x - 45;
    const ly = y;
    // Place de la fontaine : 2×2 au centre
    if ((lx === 9 || lx === 10) && (ly === 13 || ly === 14)) {
      if (lx === 10 && ly === 14) return 'FOUNTAIN';
      return 'CITY_GROUND';
    }
    // Grille de chemins tous les 4 tiles
    if (lx % 4 === 1 || ly % 4 === 1) return 'CITY_PATH';
    // Maisons (3 couleurs, hash pour répartir)
    const ht = Math.floor(hashPos(x * 7, y * 11) * 3);
    if (ht === 0) return 'HOUSE_RED';
    if (ht === 1) return 'HOUSE_BLUE';
    return 'HOUSE_YELLOW';
  }

  // ----- Plage / mer -----
  if (biome === 'beach') {
    const localY = y - 56;
    if (localY <= 1) return 'SAND';
    if (localY <= 3) return r < 0.5 ? 'SAND' : 'WAVES';
    if (localY <= 5) return 'WAVES';
    return 'SEA';
  }
  if (biome === 'sea') {
    const localY = y - 56;
    if (localY <= 1) return r < 0.35 ? 'SAND' : 'WAVES';
    if (localY <= 3) return 'WAVES';
    return 'SEA';
  }

  // ----- Montagnes -----
  if (biome === 'mountain') {
    // Neige au sommet (y < 10)
    if (y < 10) return r < 0.4 ? 'SNOW' : 'MOUNTAIN';
    // Chemin en zigzag principal (x autour de 80 + 88)
    const onPath = (Math.abs(x - 80) <= 1) || (Math.abs(x - 88) <= 1 && y >= 25)
      || (y % 14 >= 6 && y % 14 <= 7 && x >= 72 && x < 90);
    if (onPath) return 'MTN_PATH';
    if (r < 0.48) return 'MOUNTAIN';
    if (r < 0.68) return 'MTN_GRASS';
    return 'MTN_PATH';
  }

  // ----- Village -----
  if (biome === 'village') {
    const lx = x - 4;
    const ly = y - 40;
    // Fontaine centrale
    if (lx === 8 && ly === 7) return 'FOUNTAIN';
    // Chemin en croix
    if (lx === 7 || lx === 8 || ly === 6 || ly === 7) return 'VLG_PATH';
    // Maisons (petites, dispersées)
    if (lx % 5 === 0 && ly % 4 === 0 && lx > 0 && ly > 0) return 'VLG_HOUSE';
    if (r < 0.15) return 'VLG_HOUSE';
    if (r < 0.30) return 'VLG_TALL';
    return 'PLAIN';
  }

  // ----- Grande cité -----
  if (biome === 'city2') {
    const lx = x - 82;
    const ly = y - 38;
    // Grande fontaine centrale
    if (lx === 14 && ly === 10) return 'FOUNTAIN2';
    if ((lx === 13 || lx === 15) && ly === 10) return 'CITY2_GROUND';
    if (lx === 14 && (ly === 9 || ly === 11)) return 'CITY2_GROUND';
    // Grille de rues
    if (lx % 5 === 2 || ly % 5 === 2) return 'CITY2_PATH';
    // Grandes maisons (3 couleurs)
    const ht = Math.floor(hashPos(x * 11, y * 7) * 3);
    if (ht === 0) return 'HOUSE2_RED';
    if (ht === 1) return 'HOUSE2_BLUE';
    return 'HOUSE2_YELLOW';
  }

  return 'GRASS';
}

// Construit la carte une fois pour toutes
const MAP = (function build() {
  const m = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      row.push(generateTile(x, y));
    }
    m.push(row);
  }
  // Clairière de départ autour du spawn (5, 5) pour éviter de naître dans un arbre
  const SX = 5, SY = 5;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = SX + dx, y = SY + dy;
      if (y < 1 || y >= MAP_H - 1 || x < 1 || x >= MAP_W - 1) continue;
      // Garde des hautes herbes accessibles juste à côté du spawn
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        m[y][x] = 'GRASS';
      } else if (m[y][x] === 'TREE') {
        m[y][x] = 'GRASS';
      }
    }
  }
  // Quelques hautes herbes garanties juste à droite du spawn pour les premières rencontres
  m[SY][SX + 2] = 'TALL_GRASS';
  m[SY + 1][SX + 2] = 'TALL_GRASS';
  m[SY - 1][SX + 2] = 'TALL_GRASS';
  return m;
})();

function getTile(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return 'TREE';
  return MAP[y][x];
}

function isWalkable(x, y) {
  const info = TILE_TYPES[getTile(x, y)];
  return info ? info.walkable : false;
}

function isEncounterTile(x, y) {
  const info = TILE_TYPES[getTile(x, y)];
  return info ? info.encounter : false;
}

function getBiomeAt(x, y) {
  const info = TILE_TYPES[getTile(x, y)];
  return info ? info.biome : null;
}

// ====== Dessin des tuiles (procédural) ======

function drawTile(ctx, tileType, x, y, animTick = 0) {
  switch (tileType) {
    case 'GRASS':        return drawGrass(ctx, x, y, '#a7f070', '#38b764');
    case 'PLAIN':        return drawGrass(ctx, x, y, '#bce884', '#27ae60');
    case 'TALL_GRASS':   return drawTallGrass(ctx, x, y, '#38b764', '#1e8449');
    case 'TALL_PLAIN':   return drawTallGrass(ctx, x, y, '#27ae60', '#1e8449');
    case 'FLOWERS':      return drawFlowers(ctx, x, y);
    case 'TREE':         return drawTree(ctx, x, y);
    case 'WATER':        return drawWater(ctx, x, y, animTick);
    case 'SHALLOW':      return drawShallow(ctx, x, y, animTick);
    case 'SAND':         return drawSand(ctx, x, y);
    case 'SEA':          return drawSea(ctx, x, y, animTick);
    case 'WAVES':        return drawWaves(ctx, x, y, animTick);
    case 'PATH':         return drawPath(ctx, x, y);
    case 'ROCK':         return drawRock(ctx, x, y);
    // Ville
    case 'HOUSE_RED':    return drawHouse(ctx, x, y, '#e74c3c', '#b13e53');
    case 'HOUSE_BLUE':   return drawHouse(ctx, x, y, '#3b5dc9', '#29366f');
    case 'HOUSE_YELLOW': return drawHouse(ctx, x, y, '#f1c40f', '#d35400');
    case 'CITY_PATH':    return drawCityPath(ctx, x, y);
    case 'CITY_GROUND':  return drawCityGround(ctx, x, y);
    case 'FOUNTAIN':     return drawFountain(ctx, x, y, animTick);
    // Parc
    case 'PARK_GRASS':   return drawParkGrass(ctx, x, y);
    case 'PARK_TALL':    return drawTallGrass(ctx, x, y, '#5cb85c', '#27ae60');
    case 'PARK_FLOWER':  return drawParkFlower(ctx, x, y);
    case 'PARK_PATH':    return drawParkPath(ctx, x, y);
    case 'PARK_TREE':    return drawParkTree(ctx, x, y);
    case 'POND':         return drawPond(ctx, x, y, animTick);
    case 'POND_EDGE':    return drawPondEdge(ctx, x, y, animTick);
    case 'BENCH':        return drawBench(ctx, x, y);
    // Montagnes
    case 'MOUNTAIN':     return drawMountain(ctx, x, y);
    case 'MTN_PATH':     return drawMtnPath(ctx, x, y);
    case 'MTN_GRASS':    return drawMtnGrass(ctx, x, y);
    case 'SNOW':         return drawSnow(ctx, x, y, animTick);
    // Village
    case 'VLG_HOUSE':    return drawVlgHouse(ctx, x, y);
    case 'VLG_PATH':     return drawVlgPath(ctx, x, y);
    case 'VLG_TALL':     return drawTallGrass(ctx, x, y, '#5cb85c', '#27ae60');
    // Grande cité
    case 'CITY2_PATH':   return drawCity2Path(ctx, x, y);
    case 'CITY2_GROUND': return drawCity2Ground(ctx, x, y);
    case 'HOUSE2_RED':   return drawHouse2(ctx, x, y, '#e74c3c', '#b13e53');
    case 'HOUSE2_BLUE':  return drawHouse2(ctx, x, y, '#3b5dc9', '#29366f');
    case 'HOUSE2_YELLOW':return drawHouse2(ctx, x, y, '#f1c40f', '#d35400');
    case 'FOUNTAIN2':    return drawFountain(ctx, x, y, animTick);
  }
}

function drawGrass(ctx, x, y, base, dark) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = dark;
  // Touffes déterministes
  const r1 = hashPos(x, y);
  const r2 = hashPos(x + 7, y + 13);
  const tx = Math.floor(r1 * 11) + 2;
  const ty = Math.floor(r1 * 137 % 11) + 2;
  ctx.fillRect(x + tx, y + ty, 1, 1);
  ctx.fillRect(x + tx + 1, y + ty, 1, 1);
  ctx.fillRect(x + tx + 2, y + ty, 1, 1);
  ctx.fillRect(x + tx + 1, y + ty - 1, 1, 1);

  const tx2 = Math.floor(r2 * 11) + 2;
  const ty2 = Math.floor(r2 * 71 % 11) + 2;
  ctx.fillRect(x + tx2, y + ty2 + 6, 1, 1);
  ctx.fillRect(x + tx2 + 1, y + ty2 + 6, 1, 1);
}

function drawTallGrass(ctx, x, y, base, dark) {
  // Fond herbe
  ctx.fillStyle = base;
  ctx.fillRect(x, y, 16, 16);
  // Brins d'herbe verticaux
  ctx.fillStyle = dark;
  const positions = [1, 4, 7, 10, 13];
  for (const px of positions) {
    ctx.fillRect(x + px, y + 4, 1, 8);
    ctx.fillRect(x + px - 1, y + 8, 1, 4);
    ctx.fillRect(x + px + 1, y + 8, 1, 4);
  }
  // Petite ligne plus claire pour différencier du fond
  ctx.fillStyle = '#27ae60';
  for (const px of positions) {
    ctx.fillRect(x + px, y + 12, 1, 2);
  }
}

function drawFlowers(ctx, x, y) {
  // Fond herbe
  drawGrass(ctx, x, y, '#a7f070', '#38b764');
  // Quelques fleurs colorées
  const r = hashPos(x + 17, y + 23);
  const colors = ['#ffaad8', '#f1c40f', '#d896ff', '#fc7460', '#73eff7'];
  const color = colors[Math.floor(r * colors.length)];
  // Fleur 1
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + 5, 2, 2);
  ctx.fillRect(x + 3, y + 6, 1, 1);
  ctx.fillRect(x + 6, y + 6, 1, 1);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(x + 4, y + 6, 1, 1);
  // Fleur 2
  const color2 = colors[(Math.floor(r * 137) + 2) % colors.length];
  ctx.fillStyle = color2;
  ctx.fillRect(x + 10, y + 10, 2, 2);
  ctx.fillRect(x + 9, y + 11, 1, 1);
  ctx.fillRect(x + 12, y + 11, 1, 1);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(x + 10, y + 11, 1, 1);
}

function drawTree(ctx, x, y) {
  // Sol herbeux
  ctx.fillStyle = '#a7f070';
  ctx.fillRect(x, y, 16, 16);
  // Tronc
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + 7, y + 11, 2, 5);
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 6, y + 11, 1, 5);
  // Feuillage (cercle de feuilles)
  ctx.fillStyle = '#1e8449';
  ctx.fillRect(x + 3, y + 2, 10, 9);
  ctx.fillRect(x + 2, y + 4, 12, 5);
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 4, y + 3, 8, 7);
  ctx.fillStyle = '#38b764';
  ctx.fillRect(x + 5, y + 4, 4, 3);
  ctx.fillRect(x + 9, y + 6, 2, 2);
  // Détails sombres en bas
  ctx.fillStyle = '#1e8449';
  ctx.fillRect(x + 3, y + 9, 1, 1);
  ctx.fillRect(x + 12, y + 9, 1, 1);
}

function drawWater(ctx, x, y, t) {
  ctx.fillStyle = '#3b5dc9';
  ctx.fillRect(x, y, 16, 16);
  // Vaguelettes animées
  ctx.fillStyle = '#41a6f6';
  const offset = Math.floor(t / 30) % 4;
  ctx.fillRect(x + ((1 + offset) % 16), y + 3, 3, 1);
  ctx.fillRect(x + ((8 + offset) % 16), y + 7, 3, 1);
  ctx.fillRect(x + ((4 + offset) % 16), y + 12, 3, 1);
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + ((10 + offset) % 16), y + 10, 2, 1);
}

function drawShallow(ctx, x, y, t) {
  ctx.fillStyle = '#41a6f6';
  ctx.fillRect(x, y, 16, 16);
  // Quelques cailloux/algues visibles
  ctx.fillStyle = '#73eff7';
  const offset = Math.floor(t / 30) % 4;
  ctx.fillRect(x + ((2 + offset) % 16), y + 5, 2, 1);
  ctx.fillRect(x + ((9 + offset) % 16), y + 11, 2, 1);
  // Touffes d'algues
  ctx.fillStyle = '#16a085';
  ctx.fillRect(x + 5, y + 9, 1, 3);
  ctx.fillRect(x + 11, y + 4, 1, 2);
}

function drawSea(ctx, x, y, t) {
  ctx.fillStyle = '#29366f';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#3b5dc9';
  const offset = Math.floor(t / 25) % 6;
  ctx.fillRect(x + ((1 + offset) % 16), y + 2, 4, 1);
  ctx.fillRect(x + ((8 + offset) % 16), y + 6, 4, 1);
  ctx.fillRect(x + ((3 + offset) % 16), y + 10, 4, 1);
  ctx.fillRect(x + ((11 + offset) % 16), y + 14, 3, 1);
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + ((6 + offset) % 16), y + 4, 2, 1);
  ctx.fillRect(x + ((12 + offset) % 16), y + 12, 2, 1);
}

function drawWaves(ctx, x, y, t) {
  // Eau peu profonde où l'on peut marcher
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#41a6f6';
  const offset = Math.floor(t / 20) % 4;
  ctx.fillRect(x + ((0 + offset) % 16), y + 4, 5, 1);
  ctx.fillRect(x + ((7 + offset) % 16), y + 9, 5, 1);
  ctx.fillRect(x + ((3 + offset) % 16), y + 13, 4, 1);
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(x + ((6 + offset) % 16), y + 2, 2, 1);
  ctx.fillRect(x + ((11 + offset) % 16), y + 11, 2, 1);
}

function drawSand(ctx, x, y) {
  ctx.fillStyle = '#fcd8a0';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#d4a373';
  const r = hashPos(x, y);
  const sx = Math.floor(r * 14);
  const sy = Math.floor(r * 209 % 14);
  ctx.fillRect(x + sx, y + sy, 1, 1);
  ctx.fillRect(x + sx + 1, y + sy + 1, 1, 1);
  const sx2 = Math.floor(r * 73 % 14);
  const sy2 = Math.floor(r * 311 % 14);
  ctx.fillRect(x + sx2, y + sy2, 1, 1);
  // Petits coquillages parfois
  if (r < 0.05) {
    ctx.fillStyle = '#ffaad8';
    ctx.fillRect(x + 7, y + 8, 2, 1);
    ctx.fillRect(x + 6, y + 9, 4, 1);
    ctx.fillRect(x + 7, y + 10, 2, 1);
  }
}

function drawPath(ctx, x, y) {
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#8b5a2b';
  const r = hashPos(x, y);
  const sx = Math.floor(r * 14);
  ctx.fillRect(x + sx, y + 3, 1, 1);
  ctx.fillRect(x + (sx + 7) % 14, y + 11, 1, 1);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + Math.floor(r * 13), y + Math.floor(r * 13), 1, 1);
}

function drawRock(ctx, x, y) {
  // Sol herbeux dessous
  ctx.fillStyle = '#a7f070';
  ctx.fillRect(x, y, 16, 16);
  // Rocher
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(x + 3, y + 4, 10, 8);
  ctx.fillRect(x + 4, y + 3, 8, 1);
  ctx.fillRect(x + 4, y + 12, 8, 1);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 5, y + 5, 4, 3);
  ctx.fillRect(x + 6, y + 6, 2, 1);
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x + 9, y + 8, 3, 3);
  ctx.fillRect(x + 11, y + 10, 1, 1);
}

// ============================================================
//  Tuiles de la ville
// ============================================================

function drawHouse(ctx, x, y, roofLight, roofDark) {
  // Trottoir gris autour
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x, y, 16, 16);
  // Murs (clair)
  ctx.fillStyle = '#fcd8a0';
  ctx.fillRect(x + 2, y + 6, 12, 9);
  // Ombre des murs
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(x + 2, y + 14, 12, 1);
  ctx.fillRect(x + 13, y + 6, 1, 9);
  // Toit (clair)
  ctx.fillStyle = roofLight;
  ctx.fillRect(x + 1, y + 4, 14, 3);
  ctx.fillRect(x + 3, y + 2, 10, 2);
  ctx.fillRect(x + 5, y + 1, 6, 1);
  // Ombre toit
  ctx.fillStyle = roofDark;
  ctx.fillRect(x + 1, y + 6, 14, 1);
  ctx.fillRect(x + 13, y + 4, 1, 2);
  // Cheminée
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 11, y + 1, 2, 3);
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(x + 11, y + 1, 2, 1);
  // Porte
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 7, y + 10, 3, 5);
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(x + 7, y + 10, 3, 1);
  // Poignée
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(x + 9, y + 12, 1, 1);
  // Fenêtre
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + 3, y + 8, 3, 3);
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(x + 3, y + 8, 1, 1);
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 4, y + 8, 1, 3);  // croisillon vertical
  ctx.fillRect(x + 3, y + 9, 3, 1);  // croisillon horizontal
}

function drawCityPath(ctx, x, y) {
  // Pavés gris
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(x, y, 16, 16);
  // Joints sombres
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x, y + 4, 16, 1);
  ctx.fillRect(x, y + 9, 16, 1);
  ctx.fillRect(x, y + 14, 16, 1);
  // Joints verticaux alternés
  ctx.fillRect(x + 4, y, 1, 4);
  ctx.fillRect(x + 11, y + 5, 1, 4);
  ctx.fillRect(x + 6, y + 10, 1, 4);
  ctx.fillRect(x + 13, y + 15, 1, 1);
  // Petits éclats clairs (texture)
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 2, y + 2, 2, 1);
  ctx.fillRect(x + 9, y + 7, 2, 1);
  ctx.fillRect(x + 5, y + 12, 2, 1);
}

function drawCityGround(ctx, x, y) {
  // Pavé clair pour les places
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(x, y + 7, 16, 1);
  ctx.fillRect(x + 7, y, 1, 16);
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(x + 3, y + 3, 1, 1);
  ctx.fillRect(x + 12, y + 12, 1, 1);
  ctx.fillRect(x + 12, y + 3, 1, 1);
  ctx.fillRect(x + 3, y + 12, 1, 1);
}

function drawFountain(ctx, x, y, t) {
  // Base trottoir
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x, y, 16, 16);
  // Base en pierre (cercle)
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(x + 1, y + 6, 14, 9);
  ctx.fillRect(x + 0, y + 8, 16, 5);
  // Bord supérieur
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 1, y + 6, 14, 1);
  // Eau
  ctx.fillStyle = '#3b5dc9';
  ctx.fillRect(x + 2, y + 9, 12, 4);
  ctx.fillStyle = '#41a6f6';
  ctx.fillRect(x + 3, y + 9, 10, 1);
  const wobble = Math.floor(t / 20) % 3;
  ctx.fillRect(x + 4 + wobble, y + 11, 2, 1);
  ctx.fillRect(x + 9 - wobble, y + 11, 2, 1);
  // Jet d'eau
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + 7, y + 2, 2, 7);
  ctx.fillRect(x + 6, y + 4, 1, 2);
  ctx.fillRect(x + 9, y + 4, 1, 2);
  ctx.fillRect(x + 5, y + 6, 1, 1);
  ctx.fillRect(x + 10, y + 6, 1, 1);
  // Gouttes qui tombent (animées)
  ctx.fillStyle = '#a7d8f0';
  const drop = (t / 8) % 5;
  ctx.fillRect(x + 4, y + 3 + Math.floor(drop), 1, 1);
  ctx.fillRect(x + 11, y + 5 + Math.floor(drop), 1, 1);
  // Reflet
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(x + 7, y + 2, 1, 1);
}

// ============================================================
//  Tuiles du parc
// ============================================================

function drawParkGrass(ctx, x, y) {
  // Gazon bien tondu, vert tendre
  ctx.fillStyle = '#a7f070';
  ctx.fillRect(x, y, 16, 16);
  // Lignes de tonte alternées (effet "stade")
  ctx.fillStyle = '#bce884';
  ctx.fillRect(x, y + 3, 16, 2);
  ctx.fillRect(x, y + 10, 16, 2);
}

function drawParkFlower(ctx, x, y) {
  // Fond gazon
  drawParkGrass(ctx, x, y);
  const r = hashPos(x + 31, y + 41);
  const colors = ['#ff6b9d', '#f1c40f', '#d896ff', '#fc7460', '#73eff7', '#ffaad8'];
  const c1 = colors[Math.floor(r * 6) % 6];
  const c2 = colors[Math.floor(r * 13) % 6];
  const c3 = colors[Math.floor(r * 23) % 6];
  // Trois petites fleurs réparties
  ctx.fillStyle = c1;
  ctx.fillRect(x + 4, y + 5, 2, 2);
  ctx.fillRect(x + 3, y + 6, 1, 1);
  ctx.fillRect(x + 6, y + 6, 1, 1);
  ctx.fillStyle = c2;
  ctx.fillRect(x + 10, y + 8, 2, 2);
  ctx.fillRect(x + 9, y + 9, 1, 1);
  ctx.fillRect(x + 12, y + 9, 1, 1);
  ctx.fillStyle = c3;
  ctx.fillRect(x + 6, y + 11, 2, 2);
  ctx.fillRect(x + 5, y + 12, 1, 1);
  // Cœurs jaunes
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(x + 4, y + 6, 1, 1);
  ctx.fillRect(x + 10, y + 9, 1, 1);
  ctx.fillRect(x + 6, y + 12, 1, 1);
}

function drawParkPath(ctx, x, y) {
  // Gravier beige
  ctx.fillStyle = '#fcd8a0';
  ctx.fillRect(x, y, 16, 16);
  // Petits cailloux
  ctx.fillStyle = '#d4a373';
  const r = hashPos(x, y);
  ctx.fillRect(x + Math.floor(r * 14), y + 3, 1, 1);
  ctx.fillRect(x + Math.floor(r * 17) % 14, y + 8, 1, 1);
  ctx.fillRect(x + Math.floor(r * 23) % 14, y + 12, 1, 1);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + Math.floor(r * 11) % 14, y + 6, 1, 1);
  ctx.fillRect(x + Math.floor(r * 7) % 14, y + 14, 1, 1);
  // Liseré herbe
  ctx.fillStyle = '#a7f070';
  ctx.fillRect(x, y, 16, 1);
  ctx.fillRect(x, y + 15, 16, 1);
}

function drawParkTree(ctx, x, y) {
  // Sol parc
  ctx.fillStyle = '#a7f070';
  ctx.fillRect(x, y, 16, 16);
  // Tronc
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + 7, y + 11, 2, 5);
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 6, y + 13, 1, 3);
  // Feuillage rond
  ctx.fillStyle = '#1e8449';
  ctx.fillRect(x + 4, y + 2, 8, 9);
  ctx.fillRect(x + 3, y + 4, 10, 5);
  ctx.fillRect(x + 5, y + 1, 6, 1);
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 4, y + 3, 7, 6);
  ctx.fillStyle = '#38b764';
  ctx.fillRect(x + 5, y + 4, 4, 3);
  ctx.fillRect(x + 8, y + 6, 2, 2);
}

function drawPond(ctx, x, y, t) {
  // Eau profonde
  ctx.fillStyle = '#3b5dc9';
  ctx.fillRect(x, y, 16, 16);
  // Vaguelettes animées
  ctx.fillStyle = '#41a6f6';
  const offset = Math.floor(t / 30) % 3;
  ctx.fillRect(x + ((2 + offset) % 14), y + 4, 4, 1);
  ctx.fillRect(x + ((9 + offset) % 14), y + 8, 3, 1);
  ctx.fillRect(x + ((5 + offset) % 14), y + 12, 4, 1);
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + ((6 + offset) % 14), y + 6, 2, 1);
}

function drawPondEdge(ctx, x, y, t) {
  // Mi-herbe mi-eau avec roseaux
  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#3b5dc9';
  ctx.fillRect(x + 2, y + 6, 12, 6);
  ctx.fillStyle = '#41a6f6';
  const offset = Math.floor(t / 25) % 3;
  ctx.fillRect(x + 3 + offset, y + 7, 3, 1);
  ctx.fillRect(x + 9 - offset, y + 10, 3, 1);
  // Roseaux verts
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 3, y + 3, 1, 4);
  ctx.fillRect(x + 4, y + 2, 1, 5);
  ctx.fillRect(x + 11, y + 3, 1, 4);
  ctx.fillRect(x + 12, y + 2, 1, 5);
  // Quenouilles brunes
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + 4, y + 1, 1, 2);
  ctx.fillRect(x + 12, y + 1, 1, 2);
  // Nénuphar avec fleur
  ctx.fillStyle = '#1e8449';
  ctx.fillRect(x + 7, y + 9, 4, 1);
  ctx.fillRect(x + 6, y + 10, 6, 1);
  ctx.fillStyle = '#ffaad8';
  ctx.fillRect(x + 8, y + 9, 2, 1);
}

function drawBench(ctx, x, y) {
  // Sol parc
  drawParkGrass(ctx, x, y);
  // Dossier
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + 2, y + 3, 12, 1);
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 3, y + 4, 1, 3);
  ctx.fillRect(x + 12, y + 4, 1, 3);
  // Assise
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + 2, y + 7, 12, 2);
  ctx.fillStyle = '#5c2e0d';
  ctx.fillRect(x + 2, y + 8, 12, 1);
  // Pieds
  ctx.fillRect(x + 3, y + 9, 2, 4);
  ctx.fillRect(x + 11, y + 9, 2, 4);
  // Ombre au sol
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(x + 2, y + 13, 12, 1);
}

// ============================================================
//  Tuiles de montagne
// ============================================================

function drawMountain(ctx, x, y) {
  // Fond gris
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x, y, 16, 16);
  // Pic rocheux
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(x + 4, y + 2, 8, 10);
  ctx.fillRect(x + 3, y + 4, 10, 6);
  ctx.fillRect(x + 6, y + 1, 4, 2);
  ctx.fillRect(x + 7, y, 2, 1);
  // Reflet clair sur le pic
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(x + 5, y + 3, 3, 4);
  ctx.fillRect(x + 6, y + 2, 2, 1);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 6, y + 3, 1, 2);
  // Ombre foncée
  ctx.fillStyle = '#3d4e62';
  ctx.fillRect(x + 10, y + 4, 3, 7);
  ctx.fillRect(x + 11, y + 3, 1, 1);
}

function drawMtnPath(ctx, x, y) {
  // Chemin de montagne (graviers gris-bruns)
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#94b0c2';
  const r = hashPos(x, y);
  ctx.fillRect(x + Math.floor(r * 14), y + 3, 2, 1);
  ctx.fillRect(x + Math.floor(r * 97 % 14), y + 9, 2, 1);
  ctx.fillRect(x + Math.floor(r * 53 % 14), y + 13, 1, 1);
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x + Math.floor(r * 71 % 14), y + 6, 1, 1);
}

function drawMtnGrass(ctx, x, y) {
  // Herbe de montagne (vert-gris)
  ctx.fillStyle = '#5d7a5d';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#3d5e3d';
  const r = hashPos(x, y);
  const tx = Math.floor(r * 11) + 2;
  const ty = Math.floor(r * 137 % 11) + 2;
  ctx.fillRect(x + tx, y + ty, 1, 2);
  ctx.fillRect(x + tx + 3, y + ty + 4, 1, 2);
  ctx.fillRect(x + tx + 7, y + ty + 2, 1, 2);
  ctx.fillStyle = '#7a9a6a';
  ctx.fillRect(x + tx + 1, y + ty, 1, 1);
}

function drawSnow(ctx, x, y, t) {
  // Neige blanche scintillante
  ctx.fillStyle = '#e8f4f8';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 3, y + 5, 4, 1);
  ctx.fillRect(x + 10, y + 10, 3, 1);
  ctx.fillRect(x + 2, y + 12, 3, 1);
  ctx.fillRect(x + 11, y + 3, 2, 1);
  // Petits flocons scintillants
  ctx.fillStyle = '#f4f4f4';
  const blink = Math.floor(t / 25) % 4;
  ctx.fillRect(x + (blink * 3) % 12 + 2, y + 7, 1, 1);
  ctx.fillRect(x + (blink * 5 + 7) % 12 + 2, y + 2, 1, 1);
}

// ============================================================
//  Tuiles du village
// ============================================================

function drawVlgHouse(ctx, x, y) {
  // Maison de village (chaume brun, murs blanchis)
  ctx.fillStyle = '#a7f070'; ctx.fillRect(x, y, 16, 16);
  // Murs blancs
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x + 2, y + 7, 12, 8);
  ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x + 2, y + 14, 12, 1);
  ctx.fillStyle = '#94b0c2'; ctx.fillRect(x + 13, y + 7, 1, 8);
  // Toit en chaume (brun doré)
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 1, y + 4, 14, 4);
  ctx.fillRect(x + 3, y + 2, 10, 2); ctx.fillRect(x + 5, y + 1, 6, 1);
  ctx.fillStyle = '#5c2e0d'; ctx.fillRect(x + 1, y + 7, 14, 1);
  ctx.fillStyle = '#d4a373'; ctx.fillRect(x + 3, y + 3, 5, 2);
  // Porte en bois
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 7, y + 11, 3, 4);
  ctx.fillStyle = '#5c2e0d'; ctx.fillRect(x + 7, y + 11, 3, 1);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(x + 9, y + 13, 1, 1);
  // Fenêtre
  ctx.fillStyle = '#73eff7'; ctx.fillRect(x + 3, y + 8, 3, 3);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x + 3, y + 8, 1, 1);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 4, y + 8, 1, 3); ctx.fillRect(x + 3, y + 9, 3, 1);
}

function drawVlgPath(ctx, x, y) {
  // Chemin de terre battue
  ctx.fillStyle = '#c8956a'; ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#8b5a2b';
  const r = hashPos(x, y);
  ctx.fillRect(x + Math.floor(r * 14), y + 4, 1, 1);
  ctx.fillRect(x + Math.floor(r * 71 % 14), y + 10, 1, 1);
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(x + Math.floor(r * 37 % 14), y + 7, 2, 1);
}

// ============================================================
//  Tuiles de la grande cité
// ============================================================

function drawCity2Path(ctx, x, y) {
  // Pavés larges (grande ville)
  ctx.fillStyle = '#94b0c2'; ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x, y + 5, 16, 1); ctx.fillRect(x, y + 11, 16, 1);
  ctx.fillRect(x + 5, y, 1, 5);  ctx.fillRect(x + 11, y + 6, 1, 5);
  ctx.fillRect(x + 5, y + 12, 1, 4);
  ctx.fillStyle = '#bdc3c7';
  ctx.fillRect(x + 2, y + 2, 3, 2); ctx.fillRect(x + 8, y + 7, 3, 2);
}

function drawCity2Ground(ctx, x, y) {
  ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(x, y + 8, 16, 1); ctx.fillRect(x + 8, y, 1, 16);
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(x + 4, y + 4, 1, 1); ctx.fillRect(x + 12, y + 12, 1, 1);
}

function drawHouse2(ctx, x, y, roofLight, roofDark) {
  // Maison plus grande (2 étages visuels)
  ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x + 2, y + 5, 12, 10);
  ctx.fillStyle = '#d4a373'; ctx.fillRect(x + 2, y + 14, 12, 1);
  ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x + 13, y + 5, 1, 10);
  // Toit
  ctx.fillStyle = roofLight;
  ctx.fillRect(x + 1, y + 3, 14, 3); ctx.fillRect(x + 2, y + 1, 12, 2); ctx.fillRect(x + 4, y, 8, 1);
  ctx.fillStyle = roofDark; ctx.fillRect(x + 1, y + 5, 14, 1); ctx.fillRect(x + 13, y + 3, 1, 2);
  // 2 fenêtres + porte
  ctx.fillStyle = '#73eff7';
  ctx.fillRect(x + 3, y + 7, 3, 3); ctx.fillRect(x + 10, y + 7, 3, 3);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 6, y + 10, 4, 5);
  ctx.fillStyle = '#f1c40f'; ctx.fillRect(x + 9, y + 12, 1, 1);
  ctx.fillStyle = '#5c2e0d'; ctx.fillRect(x + 6, y + 10, 4, 1);
  // Cheminée
  ctx.fillStyle = '#5c2e0d'; ctx.fillRect(x + 12, y, 2, 3);
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + 12, y, 2, 1);
}
