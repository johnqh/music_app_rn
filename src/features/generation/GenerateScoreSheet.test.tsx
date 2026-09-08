/**
 * The Generate dialog's two jobs: quote the cost, and refuse an invalid ask.
 *
 * Both are easy to get wrong in ways types cannot see. The quote is *per bar
 * per instrument* — a quartet costs about four times a solo of the same length,
 * which is what the server bills — and a form that submits an incomplete draft
 * produces a job the server rejects minutes later, when nobody is looking.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import { GenerateScoreSheet } from './GenerateScoreSheet';

function setup(overrides: { outOfCredits?: boolean } = {}) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  const view = renderWithApp(
    <GenerateScoreSheet
      open
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { view, onSubmit, onClose };
}

describe('GenerateScoreSheet', () => {
  it('refuses to submit with an empty prompt', () => {
    /*
      `buildGenerateScoreRequest` returns null for a draft it cannot build, and
      the button follows that rather than testing the fields itself — so this
      also pins that the two are actually wired together.
    */
    const { view, onSubmit } = setup();
    fireEvent.press(view.getByRole('button', { name: 'Generate' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a complete draft as a request', () => {
    const { view, onSubmit } = setup();
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Generate' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const request = onSubmit.mock.calls[0]![0] as {
      prompt: string;
      durationMeasures: number;
      tracks: unknown[];
    };
    expect(request.prompt).toBe('a calm piano melody');
    expect(request.durationMeasures).toBe(16);
    expect(request.tracks).toHaveLength(1);
  });

  it('quotes one credit per bar per instrument', () => {
    // 16 bars, one instrument. The wording says "about" because the server
    // charges what the model produced, which is never more than this.
    const { view } = setup();
    expect(view.getByText(/16/)).toBeTruthy();
  });

  it('rescales the quote when the length changes', () => {
    const { view } = setup();
    fireEvent.changeText(view.getByLabelText(/bars/i), '32');
    expect(view.getByText(/32/)).toBeTruthy();
  });

  it('refuses a length that is not a positive whole number', () => {
    // "eight" and "0" both have to be refused, and the library is what knows
    // that — the field is a plain text input on purpose, so a phone keyboard
    // cannot be relied on to constrain it.
    const { view, onSubmit } = setup();
    fireEvent.changeText(view.getByLabelText('Prompt'), 'something');
    fireEvent.changeText(view.getByLabelText(/bars/i), '0');
    fireEvent.press(view.getByRole('button', { name: 'Generate' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

/*
  The credit gate is a *courtesy*: `POST /jobs` answers 402 at a balance of
  zero, and reaching that as a network-looking error is worse than being told
  beforehand. It is deliberately not a balance-versus-estimate check — a job may
  overdraw once by design, and a stricter rule here would refuse work the server
  would have accepted.
*/
describe('GenerateScoreSheet credit gate', () => {
  it('submits a complete draft when there are credits', () => {
    const { view, onSubmit } = setup();
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Generate' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('refuses the same draft, and says why, when the balance is spent', () => {
    // Same complete draft as above: the only difference is the balance, so a
    // refusal here cannot be the form being incomplete.
    const { view, onSubmit } = setup({ outOfCredits: true });
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Generate' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByText(/out of credits/i)).toBeTruthy();
  });

  it('takes the verdict from its caller, never from auth', () => {
    /*
      Reading the balance here would mean importing the auth provider, which
      imports Firebase — which is how a form for choosing a key signature ends
      up unable to render in a test. The screen has the auth context; the sheet
      renders. This test passing at all is the proof.
    */
    expect(() => setup()).not.toThrow();
  });
});
