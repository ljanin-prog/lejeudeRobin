// =============================================================================
//  types3d.js — LES 12 TYPES ÉLÉMENTAIRES du « monde légendaire »
// =============================================================================
//  Table figée par le CONTRAT2 §2 : douze types, leur couleur, leur icône et
//  leurs relations de force. C'est le seul endroit du jeu où ces relations sont
//  écrites ; tout le reste (moves3d, dex3d, hud3d, battle3d) passe par ici.
//
//  Multiplicateurs :  fort ×1.6   ·   faible ×0.6   ·   sinon ×1.0
//  Contre une créature à deux types, les multiplicateurs se MULTIPLIENT
//  (2.56 au maximum, 0.36 au minimum) — c'est ce qui rend les duos intéressants.
//
//  Aucune dépendance : ce module doit pouvoir se charger seul, même sans DOM
//  (on s'en sert aussi depuis un script de vérification sous Node).
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // La table. L'ordre est celui du tableau du contrat : il sert d'ordre
  // d'affichage partout (filtre du Pokédex, légende de la carte, etc.).
  // ---------------------------------------------------------------------------
  const TYPES = {
    feu:     { id: 'feu',     label: 'Feu',     color: '#ff6b3d', icon: '🔥',
               fort: ['plante', 'glace'],   faible: ['eau', 'roche'] },
    eau:     { id: 'eau',     label: 'Eau',     color: '#41a6f6', icon: '💧',
               fort: ['feu', 'roche'],      faible: ['plante', 'foudre'] },
    plante:  { id: 'plante',  label: 'Plante',  color: '#38b764', icon: '🌿',
               fort: ['eau', 'terre'],      faible: ['feu', 'glace'] },
    foudre:  { id: 'foudre',  label: 'Foudre',  color: '#f1c40f', icon: '⚡',
               fort: ['eau', 'air'],        faible: ['terre', 'roche'] },
    glace:   { id: 'glace',   label: 'Glace',   color: '#a8e6ff', icon: '❄️',
               fort: ['plante', 'air'],     faible: ['feu', 'roche'] },
    air:     { id: 'air',     label: 'Air',     color: '#bfe3f2', icon: '💨',
               fort: ['plante', 'terre'],   faible: ['foudre', 'glace'] },
    terre:   { id: 'terre',   label: 'Terre',   color: '#c08c4a', icon: '🍂',
               fort: ['foudre', 'roche'],   faible: ['plante', 'air'] },
    roche:   { id: 'roche',   label: 'Roche',   color: '#9aa0a6', icon: '🪨',
               fort: ['feu', 'glace'],      faible: ['eau', 'terre'] },
    lumiere: { id: 'lumiere', label: 'Lumière', color: '#ffe066', icon: '✨',
               fort: ['ombre', 'roche'],    faible: ['espace', 'terre'] },
    ombre:   { id: 'ombre',   label: 'Ombre',   color: '#7a5cbf', icon: '🌑',
               fort: ['temps', 'air'],      faible: ['lumiere', 'feu'] },
    temps:   { id: 'temps',   label: 'Temps',   color: '#d896ff', icon: '⏳',
               fort: ['espace', 'foudre'],  faible: ['ombre', 'roche'] },
    espace:  { id: 'espace',  label: 'Espace',  color: '#4b62d9', icon: '🌌',
               fort: ['lumiere', 'terre'],  faible: ['temps', 'eau'] },
  };

  const ORDER = ['feu', 'eau', 'plante', 'foudre', 'glace', 'air',
                 'terre', 'roche', 'lumiere', 'ombre', 'temps', 'espace'];

  const FORT   = 1.6;
  const FAIBLE = 0.6;

  // Type de repli pour tout ce qui n'a pas de type (capacités « neutres » comme
  // Charge, et créatures mal renseignées). Il n'entre pas dans la table :
  // il ne donne ni bonus ni malus, jamais.
  const NEUTRE = { id: null, label: 'Normal', color: '#94b0c2', icon: '◇',
                   fort: [], faible: [] };

  // ---------------------------------------------------------------------------
  // Accès
  // ---------------------------------------------------------------------------
  function get(id) { return TYPES[id]; }

  /**
   * Multiplicateur de dégâts d'un type d'attaque contre 1 ou 2 types de défense.
   * Tolérant : type inconnu ou absent -> 1 (aucun module ne doit planter parce
   * qu'une créature a été mal renseignée).
   */
  function effectiveness(atkType, defTypes) {
    const a = TYPES[atkType];
    if (!a) return 1;
    if (!defTypes) return 1;
    const list = Array.isArray(defTypes) ? defTypes : [defTypes];
    let mult = 1;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d || !TYPES[d]) continue;
      if (a.fort.indexOf(d) !== -1) mult *= FORT;
      else if (a.faible.indexOf(d) !== -1) mult *= FAIBLE;
    }
    return mult;
  }

  function message(mult) {
    if (typeof mult !== 'number' || !isFinite(mult)) return null;
    if (mult > 1.05) return "C'est super efficace !";
    if (mult < 0.95) return "Ce n'est pas très efficace…";
    return null;
  }

  function color(id) { return (TYPES[id] || NEUTRE).color; }
  function label(id) { return (TYPES[id] || NEUTRE).label; }
  function icon(id)  { return (TYPES[id] || NEUTRE).icon; }

  /**
   * Petite pastille colorée prête à insérer dans le HUD.
   * -> <span class="type-badge type-feu" style="--type-color:#ff6b3d">🔥 Feu</span>
   * Renvoie null s'il n'y a pas de DOM (chargement sous Node).
   */
  function badge(id) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const t = TYPES[id] || NEUTRE;
    const el = document.createElement('span');
    el.className = 'type-badge type-' + (t.id || 'neutre');
    // La couleur est aussi passée en variable CSS : la feuille de style peut
    // s'en servir pour le fond, la bordure et l'ombre sans dupliquer les 12
    // couleurs côté CSS.
    el.style.setProperty('--type-color', t.color);
    el.textContent = t.icon + ' ' + t.label;
    return el;
  }

  // ---------------------------------------------------------------------------
  // Auto-vérification de la table (silencieuse si tout va bien).
  // Une faute de frappe dans un `fort`/`faible` passerait totalement inaperçue
  // en jeu : les dégâts seraient juste « bizarres ». Mieux vaut un warn.
  // ---------------------------------------------------------------------------
  (function selfCheck() {
    try {
      const problems = [];
      if (ORDER.length !== 12) problems.push('ORDER ne contient pas 12 types');
      for (const id of ORDER) {
        if (!TYPES[id]) { problems.push('ORDER cite un type inconnu : ' + id); continue; }
      }
      for (const id of Object.keys(TYPES)) {
        const t = TYPES[id];
        if (t.id !== id) problems.push(id + ' : champ id incohérent (' + t.id + ')');
        if (ORDER.indexOf(id) === -1) problems.push(id + ' est absent de ORDER');
        for (const rel of ['fort', 'faible']) {
          for (const other of t[rel]) {
            if (other === id) problems.push(id + ' se cite lui-même dans ' + rel);
            if (!TYPES[other]) problems.push(id + '.' + rel + ' cite un type inconnu : ' + other);
          }
        }
        // Un type ne peut pas être à la fois fort ET faible contre le même.
        for (const other of t.fort) {
          if (t.faible.indexOf(other) !== -1) {
            problems.push(id + ' est à la fois fort et faible contre ' + other);
          }
        }
      }
      if (problems.length && typeof console !== 'undefined' && console.warn) {
        console.warn('[types3d] table incohérente :\n  - ' + problems.join('\n  - '));
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[types3d] auto-vérification impossible', e);
      }
    }
  })();

  // ---------------------------------------------------------------------------
  const API = {
    TYPES, ORDER,
    get, effectiveness, message,
    color, label, icon, badge,
  };

  if (typeof R3 !== 'undefined' && R3 && R3.register) R3.register('types', API);
  else if (typeof globalThis !== 'undefined') globalThis.TYPES3D = API;  // repli
})();
