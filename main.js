
/* -------------------- Constants -------------------- */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const C_MAJOR_SCALE_ROOTS = [
  {name: "C", type: "major", notes: [0, 4, 7]},
  {name: "D", type: "minor", notes: [2, 5, 9]},
  {name: "E", type: "minor", notes: [4, 7, 11]},
  {name: "F", type: "major", notes: [5, 9, 0]},
  {name: "G", type: "major", notes: [7, 11, 2]},
  {name: "A", type: "minor", notes: [9, 0, 4]},
  {name: "B", type: "dim", notes: [11, 2, 5]}
];

/* -------------------- State -------------------- */
let targetChord = [];
let pressedNotes = new Set();
let audioCtx = null;
let metronomeInterval = null;
let chordCompleted = false;

/* -------------------- MIDI & Audio Initialization -------------------- */
function initApp() {
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === "suspended") audioCtx.resume();

  navigator.requestMIDIAccess().then(midi => {
    document.getElementById("status").textContent = "MIDI Ready!";
    for(const input of midi.inputs.values()) input.onmidimessage = handleMidiMessage;
  }).catch(()=>document.getElementById("status").textContent="MIDI access denied");

  startMetronome(parseInt(document.getElementById("bpmInput").value));
  newChord();
}

/* -------------------- Utility Functions -------------------- */
function midiToName(n) {
  return NOTE_NAMES[n%12] + (Math.floor(n/12)-1);
}

function getRandomChord() {
  const choice = C_MAJOR_SCALE_ROOTS[Math.floor(Math.random() * C_MAJOR_SCALE_ROOTS.length)];
  const baseOctave = 60; // C4
  return choice.notes.map(n => n + baseOctave);
}

function getChordName(chord) {
  for(const c of C_MAJOR_SCALE_ROOTS) {
    const baseOctave = 60;
    const expected = c.notes.map(n => n + baseOctave);
    if(JSON.stringify(chord) === JSON.stringify(expected)) return c.name + " " + (c.type==="dim"?"dim":c.type);
  }
  return "Unknown";
}

/* -------------------- Drawing Chord Sheet -------------------- */
function drawChordSheet(chord, highlight=[]) {
  const container = document.getElementById("targetSheet");
  container.innerHTML = "";
  const VF = Vex.Flow;
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(300,180);
  const ctx = renderer.getContext();

  const stave = new VF.Stave(10,40,280);
  stave.addClef("treble").setContext(ctx).draw();

  const keys = chord.map(n=>{
    const name = NOTE_NAMES[n%12].toLowerCase();
    const octave = Math.floor(n/12)-1;
    return `${name}/${octave}`;
  });

  const note = new VF.StaveNote({clef:"treble", keys, duration:"q"});
  keys.forEach((k,i)=>{
    if(k.includes("#")) note.addAccidental(i,new VF.Accidental("#"));
    if(highlight.includes(chord[i])) note.setKeyStyle(i,{fillStyle:"green", strokeStyle:"green"});
  });

  const voice = new VF.Voice({num_beats:1, beat_value:4});
  voice.addTickables([note]);
  new VF.Formatter().joinVoices([voice]).format([voice],250);
  voice.draw(ctx, stave);
}

/* -------------------- Game Logic -------------------- */
function newChord() {
  pressedNotes.clear();
  targetChord = getRandomChord();
  document.getElementById("chordName").textContent = getChordName(targetChord);
  drawChordSheet(targetChord, []);
}

function checkChord() {
  const allPressed = targetChord.every(n => pressedNotes.has(n));
  if(allPressed && pressedNotes.size === 3) {
    chordCompleted = true; // wait for next metronome click
  }
}

/* -------------------- MIDI Handling -------------------- */
function handleMidiMessage(msg) {
  const [type, note, velocity] = msg.data;
  if(type===144 && velocity>0) pressedNotes.add(note);  // note-on
  else if(type===128 || (type===144 && velocity===0)) pressedNotes.delete(note); // note-off

  drawChordSheet(targetChord, Array.from(pressedNotes));
  checkChord();
}

/* -------------------- Metronome -------------------- */
function playClick() {
  if(!audioCtx) return;

  // Play click sound
  const bufferSize = audioCtx.sampleRate*0.02;
  const buffer = audioCtx.createBuffer(1,bufferSize,audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3,audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.02);
  noise.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
  noise.stop(audioCtx.currentTime+0.02);

  // Generate new chord if previous was completed
  if(chordCompleted) {
    chordCompleted = false;
    newChord();
  }
}

function startMetronome(bpm) {
  if(metronomeInterval) clearInterval(metronomeInterval);
  metronomeInterval = setInterval(playClick, (60/bpm)*1000);
}

document.getElementById("bpmInput").addEventListener("change", e=>{
  startMetronome(parseInt(e.target.value));
});

// Resume Audio + MIDI on gesture
document.body.addEventListener("click", initApp, {once:true});
document.body.addEventListener("touchstart", initApp, {once:true});