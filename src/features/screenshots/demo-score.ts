/**
 * The score store screenshots are taken of: eight bars in G for flute,
 * violin, piano and cello.
 *
 * Written as MusicXML and read through the app's own importer
 * (`ScreenshotLinks.tsx`), not built as a `Score` here — the model is
 * music_types', and the importer is the one place that already turns notes
 * into it, ids, ticks and all. A blank "New Score" would screenshot as an
 * empty stave.
 *
 * Each bar is a line of `pitch:length` tokens, length in sixteenths (16 a
 * whole note, 6 a dotted quarter), chords joined by `+`. `demo-score.test.ts`
 * holds every bar to four beats.
 */

export const DEMO_TITLE = 'Morning Light';
export const DEMO_TEMPO = 96;

type Part = {
  name: string;
  /** General MIDI, 1-based, as MusicXML counts. */
  program: number;
  clef: 'treble' | 'bass';
  bars: readonly string[];
  /** Dynamics by bar index. */
  dynamics?: Readonly<Record<number, string>>;
};

export const DEMO_PARTS: readonly Part[] = [
  {
    name: 'Flute',
    program: 74,
    clef: 'treble',
    dynamics: { 0: 'mp', 4: 'mf' },
    bars: [
      'D5:4 B4:2 C5:2 D5:4 G5:4',
      'E5:6 D5:2 B4:8',
      'C5:4 E5:4 G5:4 E5:4',
      'F#5:6 E5:2 D5:8',
      'B5:4 A5:2 G5:2 D5:4 B4:4',
      'E5:2 F#5:2 G5:4 B4:8',
      'C5:4 E5:4 D5:4 F#5:4',
      'G5:16',
    ],
  },
  {
    name: 'Violin',
    program: 41,
    clef: 'treble',
    dynamics: { 0: 'p' },
    bars: [
      'B4:8 D5:8',
      'G4:8 B4:8',
      'E4:8 G4:8',
      'A4:8 F#4:8',
      'D5:8 B4:8',
      'B4:8 G4:8',
      'A4:8 A4:8',
      'B4:16',
    ],
  },
  {
    name: 'Piano',
    program: 1,
    clef: 'treble',
    dynamics: { 0: 'mp' },
    bars: [
      'B3+D4+G4:4 B3+D4+G4:4 B3+D4+G4:8',
      'B3+E4+G4:4 B3+E4+G4:4 B3+E4+G4:8',
      'C4+E4+G4:4 C4+E4+G4:4 C4+E4+G4:8',
      'A3+D4+F#4:4 A3+D4+F#4:4 A3+D4+F#4:8',
      'B3+D4+G4:4 B3+D4+G4:4 B3+D4+G4:8',
      'B3+E4+G4:4 B3+E4+G4:4 B3+E4+G4:8',
      'A3+C4+E4:4 A3+C4+E4:4 A3+D4+F#4:8',
      'B3+D4+G4:16',
    ],
  },
  {
    name: 'Cello',
    program: 43,
    clef: 'bass',
    dynamics: { 0: 'mp' },
    bars: [
      'G2:8 D3:8',
      'E2:8 B2:8',
      'C3:8 G2:8',
      'D3:8 A2:8',
      'G2:4 B2:4 D3:8',
      'E3:8 B2:8',
      'A2:8 D3:8',
      'G2:16',
    ],
  },
];

/** A sixteenth is one division. */
const DIVISIONS = 4;
export const BAR_LENGTH = 16;

const TYPES: Record<number, [type: string, dotted: boolean]> = {
  16: ['whole', false],
  12: ['half', true],
  8: ['half', false],
  6: ['quarter', true],
  4: ['quarter', false],
  3: ['eighth', true],
  2: ['eighth', false],
  1: ['16th', false],
};

export type DemoNote = { pitches: string[]; length: number };

/** One bar's tokens as notes. Throws on a token it cannot read. */
export function parseBar(bar: string): DemoNote[] {
  return bar.split(/\s+/).map(token => {
    const [pitches = '', length = ''] = token.split(':');
    const sixteenths = Number(length);
    if (!TYPES[sixteenths]) throw new Error(`Unwritable length in "${token}"`);
    return { pitches: pitches.split('+'), length: sixteenths };
  });
}

function pitchXml(pitch: string): string {
  const match = /^([A-G])(#|b)?(\d)$/.exec(pitch);
  if (!match) throw new Error(`Unreadable pitch "${pitch}"`);
  const [, step, accidental, octave] = match;
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (
    `<pitch><step>${step}</step>` +
    (alter ? `<alter>${alter}</alter>` : '') +
    `<octave>${octave}</octave></pitch>`
  );
}

function noteXml(note: DemoNote): string {
  const [type, dotted] = TYPES[note.length]!;
  return note.pitches
    .map(
      (pitch, index) =>
        '<note>' +
        (index > 0 ? '<chord/>' : '') +
        pitchXml(pitch) +
        `<duration>${(note.length * DIVISIONS) / 4}</duration>` +
        '<voice>1</voice>' +
        `<type>${type}</type>` +
        (dotted ? '<dot/>' : '') +
        '</note>',
    )
    .join('');
}

function attributesXml(clef: Part['clef']): string {
  const [sign, line] = clef === 'bass' ? ['F', 4] : ['G', 2];
  return (
    '<attributes>' +
    `<divisions>${DIVISIONS}</divisions>` +
    '<key><fifths>1</fifths></key>' +
    '<time><beats>4</beats><beat-type>4</beat-type></time>' +
    `<clef><sign>${sign}</sign><line>${line}</line></clef>` +
    '</attributes>'
  );
}

function partXml(part: Part, index: number): string {
  const measures = part.bars.map((bar, barIndex) => {
    const dynamic = part.dynamics?.[barIndex];
    return (
      `<measure number="${barIndex + 1}">` +
      (barIndex === 0 ? attributesXml(part.clef) : '') +
      (barIndex === 0 && index === 0
        ? '<direction placement="above"><direction-type><metronome>' +
          '<beat-unit>quarter</beat-unit>' +
          `<per-minute>${DEMO_TEMPO}</per-minute>` +
          `</metronome></direction-type><sound tempo="${DEMO_TEMPO}"/></direction>`
        : '') +
      (dynamic
        ? '<direction placement="below"><direction-type>' +
          `<dynamics><${dynamic}/></dynamics></direction-type></direction>`
        : '') +
      parseBar(bar).map(noteXml).join('') +
      '</measure>'
    );
  });
  return `<part id="P${index + 1}">${measures.join('')}</part>`;
}

/** The demo score, as a MusicXML 4.0 partwise document. */
export function demoMusicXml(): string {
  const partList = DEMO_PARTS.map(
    (part, index) =>
      `<score-part id="P${index + 1}">` +
      `<part-name>${part.name}</part-name>` +
      `<score-instrument id="P${index + 1}-I1">` +
      `<instrument-name>${part.name}</instrument-name></score-instrument>` +
      `<midi-instrument id="P${index + 1}-I1">` +
      `<midi-channel>${index + 1}</midi-channel>` +
      `<midi-program>${part.program}</midi-program></midi-instrument>` +
      '</score-part>',
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    `<work><work-title>${DEMO_TITLE}</work-title></work>` +
    `<part-list>${partList}</part-list>` +
    DEMO_PARTS.map(partXml).join('') +
    '</score-partwise>'
  );
}
