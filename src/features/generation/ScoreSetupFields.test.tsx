/**
 * The lists the score-setup pickers are handed.
 *
 * Asserted directly rather than through the controls: a native `Select` opens a
 * modal, which a test environment does not mount, so reaching for the options
 * on screen would assert nothing at all. What can go wrong here is the order
 * and the labels, and both are in the list.
 */
import {
  GENERATION_INSTRUMENT_OPTIONS,
  moodSelectOptions,
  styleSelectOptions,
} from './ScoreSetupFields';

/** Enough of `t` to tell a key from a label: the real one is i18next's. */
const t = (key: string): string =>
  key.startsWith('generateScore.styleName.') ||
  key.startsWith('generateScore.moodName.')
    ? key
        .split('.')
        .pop()!
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, c => c.toUpperCase())
    : {
        'generateScore.noStyle': 'No style',
        'generateScore.noMood': 'No mood',
      }[key] ?? key;

describe('the instrument picker', () => {
  it('offers the voices ahead of the kits and the families', () => {
    // GM files them under Ensemble, between String Ensemble and Orchestra Hit,
    // which is where nobody setting out to write a song looks for a singer.
    expect(GENERATION_INSTRUMENT_OPTIONS.slice(0, 3).map(o => o.label)).toEqual(
      ['Voice Oohs', 'Choir Aahs', 'Synth Voice'],
    );
  });

  it('puts the kits next, ahead of the melodic programs', () => {
    const kit = GENERATION_INSTRUMENT_OPTIONS.findIndex(o =>
      o.value.startsWith('kit:'),
    );
    const melodic = GENERATION_INSTRUMENT_OPTIONS.findIndex(o =>
      o.label.includes(' · '),
    );
    expect(kit).toBeLessThan(melodic);
  });

  it('lists each voice once, not again under the family GM filed it in', () => {
    expect(
      GENERATION_INSTRUMENT_OPTIONS.filter(o => o.value === '53'),
    ).toHaveLength(1);
  });

  it('offers the same catalogue the web picker does', () => {
    // 128 melodic programs and eight kits, with the three voices lifted out of
    // the families rather than removed from the app.
    expect(GENERATION_INSTRUMENT_OPTIONS).toHaveLength(136);
  });
});

describe('the style and mood pickers', () => {
  it('lists the styles alphabetically, with No style pinned above them', () => {
    const [first, ...styles] = styleSelectOptions(t).map(o => o.label);
    expect(first).toBe('No style');
    expect(styles).toEqual([...styles].sort((a, b) => a.localeCompare(b)));
    expect(styles[0]).toBe('Ambient');
  });

  it('lists the moods alphabetically, with No mood pinned above them', () => {
    const [first, ...moods] = moodSelectOptions(t).map(o => o.label);
    expect(first).toBe('No mood');
    expect(moods).toEqual([...moods].sort((a, b) => a.localeCompare(b)));
  });

  it('labels a mood rather than showing its value', () => {
    // They rendered as their own raw values, so a Chinese reader chose a mood
    // in English from a list with no key to be missing from — the one gap
    // `locale-parity` cannot see.
    const labels = moodSelectOptions(t).map(o => o.label);
    expect(labels).toContain('Upbeat');
    expect(labels).not.toContain('upbeat');
  });

  it('keeps every value it offers a label for', () => {
    for (const option of [...styleSelectOptions(t), ...moodSelectOptions(t)]) {
      expect(option.value).not.toBe('');
      expect(option.label).not.toBe('');
    }
  });
});
