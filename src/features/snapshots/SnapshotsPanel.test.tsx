/**
 * The two snapshot rules that fail silently.
 *
 * **Creating one must flush the live score first.** The server copies the
 * *projects row*, and saving is debounced — so a snapshot taken moments after
 * an edit pins the score as it was before it, and right after a generation it
 * can pin the placeholder rather than the result. Nothing about that is visible
 * until somebody opens the snapshot much later.
 *
 * **Publishing happens in the same step as creating**, because that is how the
 * sheet asks it. A create that quietly skipped the publish would leave the
 * reader believing their music was public when it was not.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { createEmptyScore } from '@sudobility/music_types';
import { createDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { SnapshotsPanel } from './SnapshotsPanel';
import type { SnapshotGateway } from './SnapshotsPanel';

function projectDocument() {
  return createDocument({
    id: 'd',
    title: 'Quartet',
    score: createEmptyScore({ title: 'Quartet' }),
    origin: { kind: 'project', projectId: 'p1' },
  });
}

function gateway(): SnapshotGateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    listSnapshots: jest.fn(async () => {
      calls.push('list');
      return [];
    }),
    getProjectStatus: jest.fn(async () => ({
      status: 'ready',
      updatedAt: '2026-01-01T00:00:00.000Z',
      parentSnapshotId: null,
    })),
    createSnapshot: jest.fn(async () => {
      calls.push('create');
      return { id: 's1', name: 'Version 1' };
    }),
    openSnapshot: jest.fn(async () => {
      calls.push('open');
      return undefined;
    }),
    publishSnapshot: jest.fn(async () => {
      calls.push('publish');
      return undefined;
    }),
  } as unknown as SnapshotGateway & { calls: string[] };
}

async function setup() {
  const document = projectDocument();
  const g = gateway();
  const flush = jest.fn(async () => void g.calls.push('flush'));
  const reload = jest.fn(async () => {});
  const view = renderWithApp(
    <SnapshotsPanel
      document={document}
      gateway={g}
      getToken={async () => 'tok'}
      flush={flush}
      reload={reload}
    />,
  );
  /*
    Flushes the effect's promises. `waitFor` polls with timers, and this
    component settles in microtasks — an empty async `act` is the shorter and
    more reliable way to let them run.
  */
  await act(async () => {});
  return { view, g, flush, reload };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('SnapshotsPanel', () => {
  it('flushes the live score before asking for a snapshot', async () => {
    const { view, g } = await setup();
    fireEvent.press(view.getByText('New snapshot'));
    await act(async () => {
      // By role: the sheet's title says the same words as its confirm button.
      fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    });
    /*
      Presence *and* order. `indexOf` alone is a trap: with no flush at all it
      answers -1, which is less than every real index, so the ordering
      assertion passes while the rule is broken. Asserting the sequence
      directly cannot do that.
    */
    expect(g.calls).toEqual(['list', 'flush', 'create', 'list']);
  });

  it('does not publish a snapshot that was not asked to be published', async () => {
    const { view, g } = await setup();
    fireEvent.press(view.getByText('New snapshot'));
    await act(async () => {
      // By role: the sheet's title says the same words as its confirm button.
      fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    });
    expect(g.createSnapshot).toHaveBeenCalled();
    expect(g.publishSnapshot).not.toHaveBeenCalled();
  });

  it('re-reads the project after creating one, since that re-parents it', async () => {
    // Creating a snapshot changes the project row, and it is *this* client
    // that changed it — so it must re-read rather than leave it to the poll,
    // which would see its own write as somebody else's change.
    const { view, g, reload } = await setup();
    fireEvent.press(view.getByText('New snapshot'));
    await act(async () => {
      // By role: the sheet's title says the same words as its confirm button.
      fireEvent.press(view.getByRole('button', { name: 'Create snapshot' }));
    });
    expect(reload).toHaveBeenCalled();
    expect(g.createSnapshot).toHaveBeenCalled();
  });
});
