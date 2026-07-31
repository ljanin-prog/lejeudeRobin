// =============================================================================
//  types3d.js — LES TYPES ÉLÉMENTAIRES du « monde légendaire »
// =============================================================================
//  Table figée par le CONTRAT3 §2.2 : chaque type, sa couleur, son icône et ses
//  relations de force. C'est le seul endroit du jeu où ces relations sont
//  écrites ; tout le reste (moves3d, dex3d, hud3d, battle3d, tera3d) passe par ici.
//
//  Ce que le CONTRAT3 change par rapport au CONTRAT2 :
//    · la table passe de 12 à 19 entrées (psy, fee, acier, dragon, poison,
//      combat, normal viennent s'ajouter — rien n'est retiré) ;
//    · deux types sont RENOMMÉS : `foudre` -> `electrique`, `ombre` -> `spectre`.
//
//  NOTE — 19 et non 18 : le texte du CONTRAT3 annonce « 18 types », mais son
//  propre tableau du §2.2 en aligne 19 (12 anciens + 7 ajoutés = 19 ; le « 18 »
//  est une erreur d'addition dans la prose). Le TABLEAU fait foi : retirer un
//  type pour tomber à 18 laisserait une créature ou une capacité sans élément,
//  ce qui casserait le jeu. Les 19 lignes du §2.2 sont donc reprises telles quelles.
//
//  Pourquoi une table d'ALIAS plutôt qu'un renommage partout : `dex3d.js`,
//  `moves3d.js`, `legend3d.p*.js` — et surtout les SAUVEGARDES déjà sur le disque
//  de Robin — contiennent encore `foudre` et `ombre`. Ces fichiers ne sont pas
//  modifiés. On normalise donc toute entrée à l'intérieur de ce module : un
//  ancien id se comporte exactement comme le nouveau, partout, sans exception.
//  C'est le point qui casserait tout le jeu s'il était raté.
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
  // Alias des anciens ids. Écrit AVANT la table : tout le reste du fichier
  // s'appuie dessus. La règle est volontairement à sens unique — on ne fabrique
  // jamais l'ancien id à partir du nouveau, sinon on ne saurait plus lequel
  // afficher.
  // ---------------------------------------------------------------------------
  const ALIAS = {
    foudre: 'electrique',
    ombre:  'spectre',
  };

  /**
   * Ramène un id de type à sa forme canonique.
   * Tolérant par construction : ce qui n'est ni un alias ni une chaîne est
   * renvoyé tel quel, et c'est aux appelants de gérer le cas « type inconnu »
   * (ils le font tous en se repliant sur NEUTRE ou sur ×1).
   */
  function normalize(id) {
    if (typeof id !== 'string') return id;
    return Object.prototype.hasOwnProperty.call(ALIAS, id) ? ALIAS[id] : id;
  }

  // ---------------------------------------------------------------------------
  // La table. L'ordre est celui du tableau du CONTRAT3 §2.2 : il sert d'ordre
  // d'affichage partout (filtre du Pokédex, légende de la carte, sélecteur de
  // type Téra).
  //
  // Les listes `fort` / `faible` ne contiennent QUE des ids canoniques : c'est
  // la normalisation à l'entrée qui garantit qu'une comparaison réussit même
  // quand l'appelant nous donne `foudre`.
  // ---------------------------------------------------------------------------
  const TYPES = {
    feu:        { id: 'feu',        label: 'Feu',        color: '#ff6b3d', icon: '🔥',
                  fort: ['plante', 'glace', 'acier'],
                  faible: ['eau', 'roche'] },
    eau:        { id: 'eau',        label: 'Eau',        color: '#41a6f6', icon: '💧',
                  fort: ['feu', 'roche'],
                  faible: ['plante', 'electrique'] },
    plante:     { id: 'plante',     label: 'Plante',     color: '#38b764', icon: '🌿',
                  fort: ['eau', 'terre'],
                  faible: ['feu', 'glace', 'poison'] },
    electrique: { id: 'electrique', label: 'Électrique', color: '#f1c40f', icon: '⚡',
                  fort: ['eau', 'air'],
                  faible: ['terre', 'roche'] },
    glace:      { id: 'glace',      label: 'Glace',      color: '#a8e6ff', icon: '❄️',
                  fort: ['plante', 'air', 'dragon'],
                  faible: ['feu', 'roche', 'acier'] },
    air:        { id: 'air',        label: 'Air',        color: '#bfe3f2', icon: '💨',
                  fort: ['plante', 'terre', 'combat'],
                  faible: ['electrique', 'glace'] },
    terre:      { id: 'terre',      label: 'Terre',      color: '#c08c4a', icon: '🍂',
                  fort: ['electrique', 'roche', 'poison', 'acier'],
                  faible: ['plante', 'air'] },
    roche:      { id: 'roche',      label: 'Roche',      color: '#9aa0a6', icon: '🪨',
                  fort: ['feu', 'glace'],
                  faible: ['eau', 'terre', 'combat', 'acier'] },
    lumiere:    { id: 'lumiere',    label: 'Lumière',    color: '#ffe066', icon: '✨',
                  fort: ['spectre', 'roche'],
                  faible: ['espace', 'terre'] },
    spectre:    { id: 'spectre',    label: 'Spectre',    color: '#7a5cbf', icon: '👻',
                  fort: ['temps', 'air', 'psy'],
                  faible: ['lumiere', 'feu', 'normal'] },
    temps:      { id: 'temps',      label: 'Temps',      color: '#d896ff', icon: '⏳',
                  fort: ['espace', 'electrique'],
                  faible: ['spectre', 'roche'] },
    espace:     { id: 'espace',     label: 'Espace',     color: '#4b62d9', icon: '🌌',
                  fort: ['lumiere', 'terre'],
                  faible: ['temps', 'eau'] },
    psy:        { id: 'psy',        label: 'Psy',        color: '#ff6b9d', icon: '🔮',
                  fort: ['combat', 'poison'],
                  faible: ['spectre', 'acier'] },
    fee:        { id: 'fee',        label: 'Fée',        color: '#ffb3d9', icon: '🧚',
                  fort: ['dragon', 'combat', 'spectre'],
                  faible: ['acier', 'poison', 'feu'] },
    acier:      { id: 'acier',      label: 'Acier',      color: '#b8c4d0', icon: '⚙️',
                  fort: ['glace', 'roche', 'fee'],
                  faible: ['feu', 'eau', 'electrique'] },
    dragon:     { id: 'dragon',     label: 'Dragon',     color: '#6a4fd8', icon: '🐉',
                  fort: ['temps', 'espace'],
                  faible: ['fee', 'glace', 'acier'] },
    poison:     { id: 'poison',     label: 'Poison',     color: '#b45cd8', icon: '☠️',
                  fort: ['plante', 'fee'],
                  faible: ['terre', 'psy', 'acier'] },
    combat:     { id: 'combat',     label: 'Combat',     color: '#e8622c', icon: '🥊',
                  fort: ['normal', 'roche', 'acier', 'glace'],
                  faible: ['air', 'psy', 'fee'] },
    normal:     { id: 'normal',     label: 'Normal',     color: '#d8d0c4', icon: '◻️',
                  fort: [],
                  faible: ['roche', 'acier', 'spectre'] },
  };

  const ORDER = ['feu', 'eau', 'plante', 'electrique', 'glace', 'air',
                 'terre', 'roche', 'lumiere', 'spectre', 'temps', 'espace',
                 'psy', 'fee', 'acier', 'dragon', 'poison', 'combat', 'normal'];

  const FORT   = 1.6;
  const FAIBLE = 0.6;

  // Type de repli pour tout ce qui n'a pas de type (capacités sans élément comme
  // Charge, et créatures mal renseignées). Il n'entre pas dans la table :
  // il ne donne ni bonus ni malus, jamais.
  //
  // Il s'appelait « Normal » en v2. Maintenant qu'un VRAI type `normal` existe
  // (avec ses propres faiblesses), le repli s'appelle « Neutre » : deux choses
  // différentes ne peuvent pas porter le même nom sous les yeux d'un enfant.
  const NEUTRE = { id: null, label: 'Neutre', color: '#94b0c2', icon: '◇',
                   fort: [], faible: [] };

  // ---------------------------------------------------------------------------
  // Accès — TOUTES ces fonctions normalisent leur entrée (CONTRAT3 §2.1).
  // ---------------------------------------------------------------------------
  function get(id) { return TYPES[normalize(id)]; }

  /** Le type demandé, ou NEUTRE — utilisé par color/label/icon/badge. */
  function info(id) { return TYPES[normalize(id)] || NEUTRE; }

  /**
   * Multiplicateur de dégâts d'un type d'attaque contre 1 ou 2 types de défense.
   * Tolérant : type inconnu ou absent -> 1 (aucun module ne doit planter parce
   * qu'une créature a été mal renseignée).
   */
  function effectiveness(atkType, defTypes) {
    const a = TYPES[normalize(atkType)];
    if (!a) return 1;
    if (!defTypes) return 1;
    const list = Array.isArray(defTypes) ? defTypes : [defTypes];
    let mult = 1;
    for (let i = 0; i < list.length; i++) {
      // On normalise CHAQUE type de défense : une créature sauvegardée avec
      // `foudre` doit encaisser exactement comme une créature `electrique`.
      const d = normalize(list[i]);
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

  function color(id) { return info(id).color; }
  function label(id) { return info(id).label; }
  function icon(id)  { return info(id).icon; }

  /**
   * Petite pastille colorée prête à insérer dans le HUD.
   * -> <span class="type-badge type-feu" style="--type-color:#ff6b3d">🔥 Feu</span>
   * Renvoie null s'il n'y a pas de DOM (chargement sous Node).
   */
  function badge(id) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const t = info(id);
    const el = document.createElement('span');
    // La classe porte l'id CANONIQUE : une pastille `foudre` et une pastille
    // `electrique` sont visuellement identiques, sans règle CSS en double.
    el.className = 'type-badge type-' + (t.id || 'neutre');
    // La couleur est aussi passée en variable CSS : la feuille de style peut
    // s'en servir pour le fond, la bordure et l'ombre sans dupliquer toutes les
    // couleurs côté CSS.
    el.style.setProperty('--type-color', t.color);
    el.textContent = t.icon + ' ' + t.label;
    return el;
  }

  // ---------------------------------------------------------------------------
  // Aides de comparaison — pour les appelants qui manipulent des LISTES de types
  // venues du dex ou d'une sauvegarde (donc possiblement en anciens ids).
  // Sans elles, un filtre du Pokédex écrit `sp.types.indexOf('electrique')`
  // raterait toutes les créatures enregistrées en `foudre`. Elles ne sont pas
  // exigées par le contrat, mais elles évitent de réécrire la normalisation
  // dans chaque module appelant.
  // ---------------------------------------------------------------------------
  function normalizeList(list) {
    if (!list) return [];
    const src = Array.isArray(list) ? list : [list];
    const out = [];
    for (let i = 0; i < src.length; i++) out.push(normalize(src[i]));
    return out;
  }

  /** `hasType(sp.types, 'electrique')` -> true même si sp.types vaut ['foudre']. */
  function hasType(list, id) {
    return normalizeList(list).indexOf(normalize(id)) !== -1;
  }

  // ---------------------------------------------------------------------------
  // Auto-vérification de la table (silencieuse si tout va bien).
  // Une faute de frappe dans un `fort`/`faible` passerait totalement inaperçue
  // en jeu : les dégâts seraient juste « bizarres ». Mieux vaut un warn.
  // Elle ne lève JAMAIS : un module qui casse au chargement casse tout le jeu.
  // ---------------------------------------------------------------------------
  (function selfCheck() {
    try {
      const problems = [];
      // 19 = les 19 lignes du tableau du CONTRAT3 §2.2 (voir la note en tête de
      // fichier sur le « 18 » de la prose). Le compte est écrit en dur exprès :
      // le comparer à Object.keys(TYPES).length ne prouverait rien.
      if (ORDER.length !== 19) {
        problems.push('ORDER contient ' + ORDER.length + ' types au lieu de 19');
      }
      if (Object.keys(TYPES).length !== ORDER.length) {
        problems.push('TYPES et ORDER n\'ont pas le même nombre d\'entrées');
      }
      const vus = {};
      for (const id of ORDER) {
        if (!TYPES[id]) { problems.push('ORDER cite un type inconnu : ' + id); continue; }
        if (vus[id]) problems.push(id + ' apparaît deux fois dans ORDER');
        vus[id] = true;
      }
      for (const id of Object.keys(TYPES)) {
        const t = TYPES[id];
        if (t.id !== id) problems.push(id + ' : champ id incohérent (' + t.id + ')');
        if (ORDER.indexOf(id) === -1) problems.push(id + ' est absent de ORDER');
        if (!t.color || !t.label || !t.icon) problems.push(id + ' : couleur, label ou icône manquante');
        for (const rel of ['fort', 'faible']) {
          if (!Array.isArray(t[rel])) { problems.push(id + '.' + rel + " n'est pas une liste"); continue; }
          for (const other of t[rel]) {
            if (other === id) problems.push(id + ' se cite lui-même dans ' + rel);
            if (!TYPES[other]) problems.push(id + '.' + rel + ' cite un type inconnu : ' + other);
            // Une relation écrite avec un ancien id ne serait jamais trouvée par
            // effectiveness(), qui compare à des ids canoniques.
            if (Object.prototype.hasOwnProperty.call(ALIAS, other)) {
              problems.push(id + '.' + rel + ' utilise l\'ancien id ' + other +
                            ' (écrire ' + ALIAS[other] + ')');
            }
          }
        }
        // Un type ne peut pas être à la fois fort ET faible contre le même.
        for (const other of t.fort) {
          if (t.faible.indexOf(other) !== -1) {
            problems.push(id + ' est à la fois fort et faible contre ' + other);
          }
        }
      }
      // Les alias : chacun doit viser un type réel, et ne surtout pas être
      // lui-même un type de la table (sinon `normalize` détournerait un id valide).
      for (const oldId of Object.keys(ALIAS)) {
        const target = ALIAS[oldId];
        if (!TYPES[target]) problems.push('alias ' + oldId + ' -> type inconnu ' + target);
        if (TYPES[oldId]) problems.push('alias ' + oldId + ' masque un type réel de la table');
        if (Object.prototype.hasOwnProperty.call(ALIAS, target)) {
          problems.push('alias ' + oldId + ' -> ' + target + ' qui est lui-même un alias');
        }
      }
      // Le repli NEUTRE ne doit pas ressembler à un type de la table.
      if (NEUTRE.id !== null) problems.push('NEUTRE.id devrait être null');
      // « Normal » est désormais un vrai type : le repli ne doit plus s'appeler
      // comme lui, sinon Robin verrait deux choses différentes sous le même mot.
      if (TYPES[String(NEUTRE.label).toLowerCase()]) {
        problems.push('NEUTRE porte le nom d\'un type réel (' + NEUTRE.label + ')');
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
    TYPES, ORDER, ALIAS, NEUTRE,
    normalize, normalizeList, hasType,
    get, effectiveness, message,
    color, label, icon, badge,
  };

  if (typeof R3 !== 'undefined' && R3 && R3.register) R3.register('types', API);
  else if (typeof globalThis !== 'undefined') globalThis.TYPES3D = API;  // repli
})();
