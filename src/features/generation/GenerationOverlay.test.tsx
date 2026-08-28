/**
 * The cover over a score while the server is writing it.
 *
 * A generation is a job, not a request that resolves — so there is nothing to
 * await and no determinate progress to show. What there is is a project that
 * cannot be edited (the server rejects writes with 409) and a reader who needs
 * telling why, plus a way out: cancelling writes `ready`, and the running job
 * discards its result when it next looks.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import { GenerationOverlay } from './GenerationOverlay';

describe('GenerationOverlay', () => {
  it('draws nothing when nothing is generating', () => {
    // It covers the score, so a stray one blocks the whole editor.
    const view = renderWithApp(
      <GenerationOverlay visible={false} error={null} onCancel={jest.fn()} />,
    );
    // The `PortalHost` the harness mounts is always in the tree, so "drew
    // nothing" is a statement about what is inside it.
    expect(view.toJSON()?.children).toBeNull();
  });

  it('says what is happening and that leaving is safe', () => {
    const view = renderWithApp(
      <GenerationOverlay visible error={null} onCancel={jest.fn()} />,
    );
    expect(view.getByText('Writing your music')).toBeTruthy();
    expect(view.getByText(/leave this screen/i)).toBeTruthy();
  });

  it('offers cancel, because a job can be abandoned', () => {
    const onCancel = jest.fn();
    const view = renderWithApp(
      <GenerationOverlay visible error={null} onCancel={onCancel} />,
    );
    fireEvent.press(view.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows a failed job's reason without hiding the way out", () => {
    // The overlay is what unmounts on failure elsewhere; while it is up, the
    // reason belongs on it rather than nowhere.
    const view = renderWithApp(
      <GenerationOverlay
        visible
        error="ran out of credits"
        onCancel={jest.fn()}
      />,
    );
    expect(view.getByText('ran out of credits')).toBeTruthy();
    expect(view.getByText('Cancel')).toBeTruthy();
  });
});
