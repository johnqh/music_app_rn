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

function setup(
  overrides: { outOfCredits?: boolean; generationAvailable?: boolean } = {},
) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  const view = renderWithApp(
    <NewProjectSheet
      open
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { view, onSubmit, onClose };
}

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
    expect(view.getByLabelText('Instrumentation')).toBeTruthy();
    turnGenerationOn(view);
    expect(view.getByLabelText('Bars')).toBeTruthy();
    expect(view.getByLabelText('Instrumentation')).toBeTruthy();
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
    // can tell from the others.
    expect(submission.title).toBe('Untitled Project');
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

  it('does not refuse a blank project to somebody with no credits', () => {
    // A blank project costs nothing. Refusing it would refuse work the server
    // never charges for.
    const { view, onSubmit } = setup({ outOfCredits: true });
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('still refuses a generation to somebody with no credits', () => {
    const { view, onSubmit } = setup({ outOfCredits: true });
    turnGenerationOn(view);
    fireEvent.changeText(view.getByLabelText('Prompt'), 'a calm piano melody');
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not offer the model when there is nothing for a job to write to', () => {
    // A local document has no project row on the server, so a job would have
    // nowhere to put its result. Offering the toggle would be offering
    // something that cannot work.
    const { view } = setup({ generationAvailable: false });
    expect(
      view.getByText('Generating needs a project on the server.'),
    ).toBeTruthy();
    expect(view.queryByLabelText('Prompt')).toBeNull();
  });

  it('stays blank even if the toggle is forced on with no server', () => {
    // The guard is on `generating`, not on the switch's own value: a disabled
    // control is a courtesy, and the submission must be correct regardless.
    const { view, onSubmit } = setup({ generationAvailable: false });
    turnGenerationOn(view);
    fireEvent.press(view.getByRole('button', { name: 'Create' }));
    expect(submitted(onSubmit).kind).toBe('blank');
  });
});
