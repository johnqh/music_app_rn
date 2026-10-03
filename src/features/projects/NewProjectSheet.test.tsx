/**
 * The New Project sheet: what the toggle hides, what Create emits in each mode,
 * and what happens where a model cannot be asked at all.
 *
 * The two modes are easy to confuse in ways types cannot see. Off must submit a
 * *score* and must not need a prompt; on must submit a *request* and must not
 * be reachable when there is no project row for a job to write back to.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import { NewProjectSheet } from './NewProjectSheet';
import type { NewProjectAccount } from './useNewProjectForm';

/** Signed in, a server, the balance not known yet: nothing is refused. */
const SIGNED_IN: NewProjectAccount = {
  signedIn: true,
  serverAvailable: true,
  balance: null,
  siteAdmin: false,
};

function setup(
  account: Partial<NewProjectAccount> = {},
  { withCredits = false }: { withCredits?: boolean } = {},
) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  const onOpenCredits = jest.fn();
  const view = renderWithApp(
    <NewProjectSheet
      open
      onClose={onClose}
      onSubmit={onSubmit}
      account={{ ...SIGNED_IN, ...account }}
      {...(withCredits ? { onOpenCredits } : {})}
    />,
  );
  return { view, onSubmit, onClose, onOpenCredits };
}

function isDisabled(view: ReturnType<typeof renderWithApp>, name: string) {
  return (
    view.getByRole('button', { name }).props.accessibilityState?.disabled ===
    true
  );
}

const NOT_ENOUGH =
  'This needs 16 credits, but your balance is 10 (6 short). Buy credits, use fewer bars or instruments, or turn off “Generate for me”.';

/** The toggle is a platform switch, so it reports a value rather than a press. */
function turnGenerationOn(view: ReturnType<typeof renderWithApp>) {
  fireEvent(view.getByLabelText('Generate for me'), 'valueChange', true);
}

function submitted(onSubmit: jest.Mock): NewProjectSubmission {
  return onSubmit.mock.calls[0]![0] as NewProjectSubmission;
}

describe('NewProjectSheet', () => {
  it('starts with the AI half off and out of sight', () => {
    // Off is the default because this is New Project: a blank score with the
    // right instruments is the ordinary way to start one.
    const { view } = setup();
    expect(view.queryByLabelText('Prompt')).toBeNull();
    expect(view.queryByLabelText('Style')).toBeNull();
  });

  it('shows the AI half once the toggle is on', () => {
    const { view } = setup();
    turnGenerationOn(view);
    expect(view.getByLabelText('Prompt')).toBeTruthy();
    expect(view.getByLabelText('Style')).toBeTruthy();
  });

  it('keeps the instrumentation and the settings in both modes', () => {
    const { view } = setup();
    expect(view.getByLabelText('Bars')).toBeTruthy();
    expect(view.getAllByLabelText('Instrumentation')).toHaveLength(1);
    turnGenerationOn(view);
    expect(view.getByLabelText('Bars')).toBeTruthy();
    // Two now: the toggle gives the roster a singer to go with the piano.
    expect(view.getAllByLabelText('Instrumentation')).toHaveLength(2);
  });

  it('emits a blank score with the chosen instrument, and needs no prompt', () => {
    const { view, onSubmit } = setup();
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    expect(submission.kind).toBe('blank');
    if (submission.kind !== 'blank')
      throw new Error('expected a blank submission');
    expect(submission.score.tracks).toHaveLength(1);
    // The score says "Untitled"; a row in a list of rows needs a name a reader
    // can tell from the others, and it is the one the placeholder showed them.
    expect(submission.title).toBe('New Score');
    expect(submission.score.metadata.title).toBe('Untitled');
  });

  it('emits a request once generation is on', () => {
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    expect(submission.kind).toBe('generate');
    if (submission.kind !== 'generate')
      throw new Error('expected a generate submission');
    expect(submission.request.prompt).toBe('a calm piano melody');
  });

  it("asks the web's default backend for the music", () => {
    // The web dialog has always opened on DeepSeek; the native sheet sent no
    // variant at all, so one brief produced two backends' music depending on
    // the device. Both now open on music_lib's DEFAULT_GENERATION_VARIANT.
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    const submission = submitted(onSubmit);
    if (submission.kind !== 'generate') throw new Error('expected generate');
    expect(submission.request.variant).toBe('deepseek');
  });

  it('does not refuse a blank project to somebody with no credits', () => {
    // A blank project costs nothing. Refusing it would refuse work the server
    // never charges for.
    const { view, onSubmit } = setup({ balance: -5 });
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('still refuses a generation to somebody with too few credits', () => {
    const { view, onSubmit } = setup({ balance: 10 });
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not offer the model when there is nothing for a job to write to', () => {
    // A local document has no project row on the server, so a job would have
    // nowhere to put its result. Offering the toggle would be offering
    // something that cannot work.
    const { view } = setup({ serverAvailable: false });
    expect(
      view.getByText(
        'Generating needs a project on the server. Log-in required.',
      ),
    ).toBeTruthy();
    expect(view.queryByLabelText('Prompt')).toBeNull();
  });

  it('stays blank even if the toggle is forced on with no server', () => {
    // The guard is on `generating`, not on the switch's own value: a disabled
    // control is a courtesy, and the submission must be correct regardless.
    const { view, onSubmit } = setup({ serverAvailable: false });
    turnGenerationOn(view);
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(submitted(onSubmit).kind).toBe('blank');
  });
});

describe('NewProjectSheet: credits', () => {
  // The rules are music_lib's `newProjectCreditState`; these pin that the
  // sheet draws its answer, and says why under the switch.
  it('offers no generation signed out, and says to sign in', () => {
    const { view } = setup({ signedIn: false });
    expect(
      view.getByText('Sign in to have a score generated for you.'),
    ).toBeTruthy();
    turnGenerationOn(view);
    expect(view.queryByLabelText('Prompt')).toBeNull();
  });

  it('offers no generation below zero, says why, and offers credits', () => {
    const { view, onOpenCredits } = setup(
      { balance: -1 },
      { withCredits: true },
    );
    expect(
      view.getByText(
        'Your credit balance is below zero, so generating is unavailable. Buy credits to use it again.',
      ),
    ).toBeTruthy();
    turnGenerationOn(view);
    expect(view.queryByLabelText('Prompt')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Buy credits' }));
    expect(onOpenCredits).toHaveBeenCalledTimes(1);
  });

  it('allows generation at exactly zero', () => {
    const { view } = setup({ balance: 0 });
    turnGenerationOn(view);
    expect(view.getByLabelText('Prompt')).toBeTruthy();
  });

  it('refuses Create when the estimate is more than the balance, and says so', () => {
    // Eight bars, a piano and the singer the switch adds: 16 credits.
    const { view, onOpenCredits } = setup(
      { balance: 10 },
      { withCredits: true },
    );
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    expect(isDisabled(view, 'Create')).toBe(true);
    expect(view.getByText(NOT_ENOUGH)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Buy credits' }));
    expect(onOpenCredits).toHaveBeenCalledTimes(1);
  });

  it('allows Create when the balance covers the estimate', () => {
    const { view, onSubmit } = setup({ balance: 16 });
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    expect(view.queryByText(NOT_ENOUGH)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(submitted(onSubmit).kind).toBe('generate');
  });

  it('never refuses a site administrator', () => {
    const { view, onSubmit } = setup({ balance: -100, siteAdmin: true });
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    expect(view.queryByText(/short\)|below zero/)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(submitted(onSubmit).kind).toBe('generate');
  });

  it('offers no Buy credits link without a way to open Credits', () => {
    const { view } = setup({ balance: -1 });
    expect(view.queryByRole('button', { name: 'Buy credits' })).toBeNull();
  });
});

describe('NewProjectSheet: singers', () => {
  it('adds a singer when the model is asked to write the music', () => {
    // A song needs somebody singing it, and the roster otherwise opens on a
    // piano solo — leaving the reader to know that a voice is filed under
    // Ensemble before they can ask for one.
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a song about the sea');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    if (submission.kind !== 'generate')
      throw new Error('expected a generate submission');
    expect(
      submission.request.tracks.map(track => track.instrumentName),
    ).toEqual(['Voice Oohs', 'Acoustic Grand Piano']);
  });

  it('takes it away again when the model is not writing the music', () => {
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent(view.getByLabelText('Generate for me'), 'valueChange', false);
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    if (submission.kind !== 'blank')
      throw new Error('expected a blank submission');
    expect(submission.score.tracks).toHaveLength(1);
  });

  it('asks the server for words, and stops when the switch is off', () => {
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a song about the sea');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const first = submitted(onSubmit);
    if (first.kind !== 'generate') throw new Error('expected generate');
    expect(first.request.lyrics).toBe(true);

    fireEvent(view.getByLabelText('Write lyrics'), 'valueChange', false);
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    const second = onSubmit.mock.calls[1]![0] as NewProjectSubmission;
    if (second.kind !== 'generate') throw new Error('expected generate');
    expect('lyrics' in second.request).toBe(false);
  });

  it('offers no lyrics switch with nobody in the roster to sing them', () => {
    const { view } = setup();
    expect(view.queryByLabelText('Write lyrics')).toBeNull();
  });
});

describe('NewProjectSheet: preset briefs', () => {
  it('offers no preset picker without a server to ask for the list', () => {
    // Local documents run with no MusicClient at all; the control is meant to
    // be absent rather than opening an empty list.
    const { view } = setup({ serverAvailable: false });
    expect(view.queryByLabelText('Preset prompts')).toBeNull();
  });
});

describe('NewProjectSheet: the default title', () => {
  it('names a blank project New Score', () => {
    const { view, onSubmit } = setup();
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    const submission = submitted(onSubmit);
    if (submission.kind !== 'blank') throw new Error('expected blank');
    expect(submission.title).toBe('New Score');
  });

  it('names a generated project Generated Score', () => {
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a song about the sea');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    const submission = submitted(onSubmit);
    if (submission.kind !== 'generate') throw new Error('expected generate');
    expect(submission.request.title).toBe('Generated Score');
  });

  it('still takes a title that was typed', () => {
    const { view, onSubmit } = setup();
    fireEvent.changeText(view.getByLabelText('Title'), 'Wedding March');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    const submission = submitted(onSubmit);
    if (submission.kind !== 'blank') throw new Error('expected blank');
    expect(submission.title).toBe('Wedding March');
  });
});

describe("NewProjectSheet: the lyric's subject", () => {
  it('takes a subject for the words of their own', () => {
    // "A slow waltz" describes the music; the words over it can be about
    // coming home without the music brief being about coming home.
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a slow waltz');
    fireEvent.changeText(
      view.getByLabelText('What the words are about'),
      'a love song about coming home',
    );
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    if (submission.kind !== 'generate') throw new Error('expected generate');
    expect(submission.request.lyricsTheme).toBe(
      'a love song about coming home',
    );
  });

  it('offers nowhere to describe words it is not writing', () => {
    const { view } = setup();
    turnGenerationOn(view);
    expect(view.getByLabelText('What the words are about')).toBeTruthy();
    fireEvent(view.getByLabelText('Write lyrics'), 'valueChange', false);
    expect(view.queryByLabelText('What the words are about')).toBeNull();
  });

  it('sends no subject when none was typed, so the words follow the piece', () => {
    const { view, onSubmit } = setup();
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a slow waltz');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));

    const submission = submitted(onSubmit);
    if (submission.kind !== 'generate') throw new Error('expected generate');
    expect('lyricsTheme' in submission.request).toBe(false);
  });
});
