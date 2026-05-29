// ============================================================
//  Audio : sons et musique d'ambiance.
//  Tout est synthétisé via Web Audio API — aucun fichier externe.
// ============================================================

const Audio_ = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let currentBiome = null;
  let musicNodes = [];
  let musicTimer = null;

  function ensure() {
    if (ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      ctx = new Ctx();
    } catch (e) { return false; }
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.7;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1.0;
    sfxGain.connect(masterGain);
    return true;
  }

  function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.value = m ? 0 : 0.7;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() { return muted; }

  // === Sons (SFX) ===

  function blip(freq, dur = 0.05, type = 'square', vol = 0.15) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function sweep(fromHz, toHz, dur, type = 'sawtooth', vol = 0.1) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function sequence(notes, type = 'square', vol = 0.15) {
    if (!ensure()) return;
    let t = ctx.currentTime;
    for (const note of notes) {
      if (note.freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
        osc.connect(gain).connect(sfxGain);
        osc.start(t);
        osc.stop(t + note.dur + 0.02);
      }
      t += note.dur;
    }
  }

  const SFX = {
    footstep: () => blip(70 + Math.random() * 30, 0.035, 'triangle', 0.05),
    encounter: () => sequence([
      { freq: 523, dur: 0.08 },
      { freq: 659, dur: 0.08 },
      { freq: 783, dur: 0.08 },
      { freq: 1046, dur: 0.2 },
    ], 'square', 0.12),
    throwBall: () => sweep(300, 80, 0.3, 'sawtooth', 0.08),
    hit: () => blip(180, 0.06, 'triangle', 0.18),
    shake: () => blip(330, 0.04, 'square', 0.08),
    catch: () => sequence([
      { freq: 523, dur: 0.1 },
      { freq: 659, dur: 0.1 },
      { freq: 783, dur: 0.1 },
      { freq: 1046, dur: 0.15 },
      { freq: 1318, dur: 0.3 },
    ], 'triangle', 0.14),
    escape: () => sequence([
      { freq: 523, dur: 0.15 },
      { freq: 392, dur: 0.15 },
      { freq: 311, dur: 0.3 },
    ], 'sawtooth', 0.12),
    menu: () => blip(660, 0.04, 'square', 0.08),
    rare: () => sequence([
      { freq: 880, dur: 0.07 },
      { freq: 1108, dur: 0.07 },
      { freq: 1318, dur: 0.07 },
      { freq: 1760, dur: 0.07 },
      { freq: 2093, dur: 0.2 },
    ], 'triangle', 0.12),
  };

  // === Musique d'ambiance par biome ===
  // Chaque piste est une liste de notes {freq, dur} qui se rejoue en boucle.

  const MUSIC_TRACKS = {
    forest: [
      { freq: 523, dur: 0.3 }, { freq: 659, dur: 0.3 }, { freq: 783, dur: 0.3 }, { freq: 659, dur: 0.3 },
      { freq: 523, dur: 0.6 }, { freq: 587, dur: 0.3 }, { freq: 698, dur: 0.6 },
      { freq: 0, dur: 0.3 },
      { freq: 659, dur: 0.3 }, { freq: 783, dur: 0.3 }, { freq: 1046, dur: 0.6 },
      { freq: 783, dur: 0.3 }, { freq: 659, dur: 0.3 }, { freq: 523, dur: 0.6 },
      { freq: 0, dur: 0.3 },
    ],
    lake: [
      { freq: 440, dur: 0.4 }, { freq: 523, dur: 0.4 }, { freq: 659, dur: 0.8 },
      { freq: 0, dur: 0.4 },
      { freq: 392, dur: 0.4 }, { freq: 494, dur: 0.4 }, { freq: 587, dur: 0.8 },
      { freq: 0, dur: 0.4 },
      { freq: 349, dur: 0.4 }, { freq: 440, dur: 0.4 }, { freq: 523, dur: 0.8 },
      { freq: 0, dur: 0.4 },
      { freq: 330, dur: 0.4 }, { freq: 392, dur: 0.4 }, { freq: 494, dur: 0.8 },
      { freq: 0, dur: 0.4 },
    ],
    plain: [
      { freq: 349, dur: 0.3 }, { freq: 440, dur: 0.3 }, { freq: 523, dur: 0.3 }, { freq: 698, dur: 0.5 },
      { freq: 523, dur: 0.3 }, { freq: 440, dur: 0.3 }, { freq: 349, dur: 0.6 },
      { freq: 0, dur: 0.3 },
      { freq: 392, dur: 0.3 }, { freq: 466, dur: 0.3 }, { freq: 587, dur: 0.3 }, { freq: 783, dur: 0.5 },
      { freq: 587, dur: 0.3 }, { freq: 466, dur: 0.3 }, { freq: 392, dur: 0.6 },
      { freq: 0, dur: 0.3 },
    ],
    beach: [
      { freq: 392, dur: 0.35 }, { freq: 494, dur: 0.35 }, { freq: 587, dur: 0.7 },
      { freq: 783, dur: 0.7 },
      { freq: 587, dur: 0.35 }, { freq: 494, dur: 0.35 }, { freq: 392, dur: 0.7 },
      { freq: 0, dur: 0.35 },
      { freq: 440, dur: 0.35 }, { freq: 523, dur: 0.35 }, { freq: 659, dur: 0.7 },
      { freq: 880, dur: 0.7 },
      { freq: 659, dur: 0.35 }, { freq: 523, dur: 0.35 }, { freq: 440, dur: 0.7 },
      { freq: 0, dur: 0.35 },
    ],
    sea: [
      { freq: 294, dur: 0.5 }, { freq: 392, dur: 0.5 }, { freq: 523, dur: 1.0 },
      { freq: 392, dur: 0.5 }, { freq: 294, dur: 1.0 },
      { freq: 0, dur: 0.5 },
      { freq: 330, dur: 0.5 }, { freq: 440, dur: 0.5 }, { freq: 587, dur: 1.0 },
      { freq: 440, dur: 0.5 }, { freq: 330, dur: 1.0 },
      { freq: 0, dur: 0.5 },
    ],
    park: [
      // Joyeux et fleuri, valse douce
      { freq: 523, dur: 0.25 }, { freq: 587, dur: 0.25 }, { freq: 659, dur: 0.25 }, { freq: 783, dur: 0.5 },
      { freq: 659, dur: 0.25 }, { freq: 587, dur: 0.25 }, { freq: 523, dur: 0.5 },
      { freq: 0, dur: 0.25 },
      { freq: 698, dur: 0.25 }, { freq: 783, dur: 0.25 }, { freq: 880, dur: 0.5 },
      { freq: 783, dur: 0.25 }, { freq: 698, dur: 0.25 }, { freq: 587, dur: 0.5 },
      { freq: 523, dur: 0.5 },
      { freq: 0, dur: 0.25 },
    ],
    city: [
      // Plus animé, rythmé
      { freq: 392, dur: 0.2 }, { freq: 392, dur: 0.2 }, { freq: 466, dur: 0.4 },
      { freq: 392, dur: 0.2 }, { freq: 523, dur: 0.4 },
      { freq: 466, dur: 0.2 }, { freq: 587, dur: 0.4 },
      { freq: 698, dur: 0.4 }, { freq: 587, dur: 0.2 }, { freq: 466, dur: 0.2 },
      { freq: 523, dur: 0.4 }, { freq: 392, dur: 0.6 },
      { freq: 0, dur: 0.2 },
    ],
  };

  function playMusic(biome) {
    if (!ensure()) return;
    if (currentBiome === biome) return;
    stopMusic();
    currentBiome = biome;
    scheduleLoop();
  }

  function scheduleLoop() {
    const track = MUSIC_TRACKS[currentBiome];
    if (!track || !ctx) return;
    const startTime = ctx.currentTime + 0.05;
    let time = startTime;
    let totalDur = 0;
    for (const note of track) {
      if (note.freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.02);
        const sustainEnd = time + Math.max(0.04, note.dur - 0.05);
        gain.gain.setValueAtTime(0.06, sustainEnd);
        gain.gain.exponentialRampToValueAtTime(0.001, time + note.dur);
        osc.connect(gain).connect(musicGain);
        osc.start(time);
        osc.stop(time + note.dur + 0.01);
        musicNodes.push(osc);
      }
      time += note.dur;
      totalDur += note.dur;
    }
    musicTimer = setTimeout(() => {
      musicNodes = [];
      if (currentBiome) scheduleLoop();
    }, Math.max(100, totalDur * 1000 - 50));
  }

  function stopMusic() {
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
    for (const node of musicNodes) {
      try { node.stop(); } catch (e) {}
    }
    musicNodes = [];
    currentBiome = null;
  }

  return {
    init: ensure,
    setMuted, toggleMute, isMuted,
    sfx: SFX,
    playMusic, stopMusic,
  };
})();
