/**
 * The two snapshot sheets.
 *
 * Creating is cheap and safe; publishing is not, so the create form gates on a
 * copyright acknowledgement and a publisher name. Opening is destructive to the
 * live project, so it carries a one-tap escape that keeps the current work
 * first — the destructive path always has a non-destructive way out.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { LIVE_NODE_ID } from '@sudobility/music_types';
import type { TreeNode } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { CreateSnapshotSheet, OpenSnapshotSheet } from './SnapshotSheets';

describe('CreateSnapshotSheet', () => {
  function setup(snapshotCount = 2) {
    const onCreate = jest.fn();
    const view = renderWithApp(
      <CreateSnapshotSheet
        open
        snapshotCount={snapshotCount}
        projectName="Quartet"
        onCreate={onCreate}
        onClose={jest.fn()}
      />,
    );
    return { view, onCreate };
  }

  it('suggests the next version by global creation order', () => {
    // "Version 4" off "Version 2" reads better than "Version 2.1.1".
    expect(setup(3).view.getByLabelText('Snapshot name').props.value).toBe(
      'Version 4',
    );
  });

  it('creates without publishing by default', () => {
    const { view, onCreate } = setup();
    fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    expect(onCreate).toHaveBeenCalledWith('Version 3', undefined, undefined);
  });

  it('will not publish until the copyright box is ticked', () => {
    /*
      Publishing puts the music in front of strangers. The warning is shown
      before the tick, and Create stays disabled until it is given — somebody
      who published by mistake cannot take back who saw it.
    */
    const { view, onCreate } = setup();
    fireEvent.press(view.getByLabelText('Publish'));
    fireEvent.changeText(view.getByLabelText('Publisher name'), 'A Composer');
    fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('will not publish anonymously', () => {
    const { view, onCreate } = setup();
    fireEvent.press(view.getByLabelText('Publish'));
    fireEvent.press(view.getByLabelText(/full copyright/i));
    fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('passes the publisher and the public title once both are given', () => {
    const { view, onCreate } = setup();
    fireEvent.press(view.getByLabelText('Publish'));
    fireEvent.changeText(view.getByLabelText('Publisher name'), 'A Composer');
    fireEvent.press(view.getByLabelText(/full copyright/i));
    fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    expect(onCreate).toHaveBeenCalledWith(
      'Version 3',
      'A Composer',
      'Quartet — Version 3',
    );
  });
});

describe('OpenSnapshotSheet', () => {
  const nodes: TreeNode[] = [
    {
      id: 's1',
      parentId: null,
      name: 'Version 1',
      createdAt: '2026-01-01',
      depth: 0,
      lane: 0,
      isLive: false,
    },
    {
      id: LIVE_NODE_ID,
      parentId: 's1',
      name: 'live',
      createdAt: '2026-01-02',
      depth: 1,
      lane: 0,
      isLive: true,
    },
  ];

  function setup() {
    const onOpen = jest.fn();
    const onSnapshotFirst = jest.fn();
    const view = renderWithApp(
      <OpenSnapshotSheet
        open
        nodes={nodes}
        onOpen={onOpen}
        onSnapshotFirst={onSnapshotFirst}
        onClose={jest.fn()}
      />,
    );
    return { view, onOpen, onSnapshotFirst };
  }

  it('shows the live project as itself, not by name', () => {
    // It is in the tree so the branch point is visible.
    expect(setup().view.getByText('Current work')).toBeTruthy();
  });

  it('will not open the live project, since you are already in it', () => {
    const { view, onOpen } = setup();
    fireEvent.press(view.getByLabelText('live'));
    fireEvent.press(view.getByRole('button', { name: 'Open' }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens the snapshot that was chosen', () => {
    const { view, onOpen } = setup();
    fireEvent.press(view.getByLabelText('Version 1'));
    fireEvent.press(view.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledWith('s1');
  });

  it('offers keeping the current work first', () => {
    // The non-destructive escape from a destructive action.
    const { view, onSnapshotFirst } = setup();
    fireEvent.press(
      view.getByRole('button', { name: 'Snapshot current work first' }),
    );
    expect(onSnapshotFirst).toHaveBeenCalled();
  });
});
