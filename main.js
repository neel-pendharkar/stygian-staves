/* ===================== MUSIC THEORY ===================== */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

const CHORD_QUALITIES = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim:   [0, 3, 6],
  maj7:  [0, 4, 7, 11],
  min7:  [0, 3, 7, 10]
};

// Diatonic harmony rules
const DIATONIC_QUALITIES = {
  major: ["major", "minor", "minor", "major", "major", "minor", "dim"],
  minor: ["minor", "dim", "major", "minor", "minor", "major", "major"]
};


/* ===================== APP STATE ===================== */

const musicState = {
  key: 0,              // C
  scale: "major",
  octave: 4,
  allowedChordSizes: [3] // triads for now
};

const gameState = {
  targetChord: null,
  pressedNotes: new Set(),
  chordCompleted: false
};

let audioCtx = null;
let metronomeInterval = null;


/* ===================== UTILITIES ===================== */

function midiToName(n) {
  return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}

function buildChord({ key, scale, degree, quality, octave }) {
  const scaleIntervals = SCALES[scale];
  const root = key + scaleIntervals[degree] + octave * 12;
  const intervals = CHORD_QUALITIES[quality];

  return intervals.map(i => root + i);
}

function generateRandomChord() {
  const degree = Math.floor(Math.random() * 7);
  const quality = DIATONIC_QUALITIES[musicState.scale][degree];

  const notes = buildChord({
    key: musicState.key,
    scale: musicState.scale,
    degree,
    quality,
    octave: musicState.octave
  });

  return {
    degree,
    quality,
    notes
  };
}

function chordDisplayName(chord) {
  const rootName = NOTE_NAMES[
    (musicState.key + SCALES[musicState.scale][chord.degree]) % 12
  ];
  return `${rootName} ${chord.quality}`;
}


/* ===================== VEXFLOW ===================== */

function drawChordSheet(chord, highlight = []) {
  const container = document.getElementById("targetSheet");
  container.innerHTML = "";

  const VF = Vex.Flow;
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(300, 180);
  const ctx = renderer.getContext();

  const stave = new VF.Stave(10, 40, 280);
  stave.addClef("treble").setContext(ctx).draw();

  const keys = chord.notes.map(n => {
    const name = NOTE_NAMES[n % 12].toLowerCase();
    const octave = Math.floor(n / 12) - 1;
    return `${name}/${octave}`;
  });

  const note = new VF.StaveNote({
    clef: "treble",
    keys,
    duration: "q"
  });

  keys.forEach((k, i) => {
    if (k.includes("#")) note.addAccidental(i, new VF.Accidental("#"));
    if (highlight.includes(chord.notes[i])) {
      note.setKeyStyle(i, { fillStyle: "green", strokeStyle: "green" });
    }
  });

  const voice = new VF.Voice({ num_beats: 1, beat_value: 4 });
  voice.addTickables([note]);
  new VF.Formatter().joinVoices([voice]).format([voice], 250);
  voice.draw(ctx, stave);
}


/* ===================== GAME LOGIC ===================== */

function newChord() {
  gameState.pressedNotes.clear();
  gameState.targetChord = generateRandomChord();
  gameState.chordCompleted = false;

  document.getElementById("chordName").textContent =
    chordDisplayName(gameState.targetChord);

  drawChordSheet(gameState.targetChord);
}

function checkChord() {
  const { targetChord, pressedNotes } = gameState;

  const correct =
    targetChord.notes.every(n => pressedNotes.has(n)) &&
    pressedNotes.size === targetChord.notes.length;

  if (correct) gameState.chordCompleted = true;
}


/* ===================== MIDI ===================== */
function handleMidiMessage(msg) {
  if (!gameState.targetChord) return;

  const [type, note, velocity] = msg.data;

  if (type === 144 && velocity > 0) {
    gameState.pressedNotes.add(note);
  } else if (type === 128 || (type === 144 && velocity === 0)) {
    gameState.pressedNotes.delete(note);
  }

  drawChordSheet(
    gameState.targetChord,
    Array.from(gameState.pressedNotes)
  );

  checkChord();
}



/* ===================== METRONOME ===================== */

function playClick() {
  if (!audioCtx) return;

  const bufferSize = audioCtx.sampleRate * 0.02;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();

  noise.buffer = buffer;
  noise.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.01,
    audioCtx.currentTime + 0.02
  );

  noise.start();
  noise.stop(audioCtx.currentTime + 0.02);

  if (gameState.chordCompleted) newChord();
}

function startMetronome(bpm) {
  if (metronomeInterval) clearInterval(metronomeInterval);
  metronomeInterval = setInterval(playClick, (60 / bpm) * 1000);
}


/* ===================== INIT ===================== */

function initApp() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();

  navigator.requestMIDIAccess().then(midi => {
    document.getElementById("status").textContent = "MIDI Ready!";
    for (const input of midi.inputs.values()) {
      input.onmidimessage = handleMidiMessage;
    }
  });

  startMetronome(parseInt(document.getElementById("bpmInput").value));
  newChord();
}

document.getElementById("bpmInput").addEventListener("change", e => {
  startMetronome(parseInt(e.target.value));
});

document.body.addEventListener("click", initApp, { once: true });
document.body.addEventListener("touchstart", initApp, { once: true });

document.getElementById("keySelect").addEventListener("change", e => {
  musicState.key = parseInt(e.target.value);
  newChord();
});

document.getElementById("scaleSelect").addEventListener("change", e => {
  musicState.scale = e.target.value;
  newChord();
});
