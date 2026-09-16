/**
 * Android's Back button, guarded.
 *
 * Four rules, and each of the four shipped broken (there was no handler at
 * all): a clean document leaves without a word, a dirty one asks first and
 * **swallows the press** while it asks, answering the question quits, and
 * cancelling stays. The last two are what "a second Back must still work"
 * comes down to — a guard that consumes Back and then forgets to act is an app
 * that cannot be left.
 *
 * `BackHandler` and `useFocusEffect` are both stubbed, because what is being
 * pinned is the decision and not React Navigation: the stub keeps the
 * registered listener so a test can press Back by calling it, and reports
 * whether the press was consumed — which is the return value Android reads and
 * the one thing a rendered tree cannot show.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { createDocumentStore } from '@sudobility/music_lib';
import {
  changeMetadataCommand,
  createEmptyScore,
  MusicPosition,
} from '@sudobility/music_types';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';

/** The listener the guard registered, and whether it was ever unregistered. */
const back: {
  listener?: () => boolean;
  removed: boolean;
  exited: number;
} = { removed: false, exited: 0 };

jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: (_event: string, listener: () => boolean) => {
      back.listener = listener;
      back.removed = false;
      return {
        remove: () => {
          back.removed = true;
        },
      };
    },
    exitApp: () => {
      back.exited += 1;
    },
  },
}));

/*
  `useFocusEffect` is `useEffect` here: a focused screen is what a rendered
  component test is. What focus buys in the app — the listener going away while
  Settings is on top — is asserted through the cleanup the stub records.
*/
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => (() => void) | void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react') as typeof import('react');
    useEffect(effect, [effect]);
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { UnsavedQuitGuard } =
  require('./UnsavedQuitGuard') as typeof import('./UnsavedQuitGuard');

function doc(id: string, title: string, dirty: boolean) {
  const store = createDocumentStore({
    title,
    score: createEmptyScore({ title }),
  });
  // An edit through a command is what marks a document dirty, which is the
  // same route the editor takes — setting the flag by hand would test nothing.
  if (dirty) {
    store
      .getState()
      .dispatchCommand(changeMetadataCommand({ composer: 'X' }, 'Composer'));
  }
  return asDocument(store, id);
}

function setup(documents: Array<{ title: string; dirty: boolean }>) {
  back.listener = undefined as never;
  back.removed = false;
  back.exited = 0;
  const position = new MusicPosition();
  const list = new DocumentList({ position: () => position });
  documents.forEach((d, index) =>
    list.open(doc(`d${index}`, d.title, d.dirty)),
  );
  const view = renderWithApp(
    <DocumentsProvider list={list}>
      <UnsavedQuitGuard />
    </DocumentsProvider>,
  );
  return { view, list };
}

/**
 * Presses Back; answers whether the guard consumed the press.
 *
 * Inside `act` because Android calls the listener from outside React and the
 * listener opens the prompt with `setState` — without it the state lands but no
 * render follows, so the dialog is in the tree and not on screen.
 */
function pressBack(): boolean {
  let consumed = false;
  act(() => {
    consumed = back.listener!();
  });
  return consumed;
}

describe('UnsavedQuitGuard', () => {
  it('lets Back through when nothing would be lost', () => {
    const { view } = setup([{ title: 'Clean', dirty: false }]);
    // `false` is what tells Android to finish the activity as it always did.
    expect(pressBack()).toBe(false);
    expect(view.queryByText('Unsaved changes')).toBeNull();
  });

  it('swallows Back and asks when a document is dirty', () => {
    const { view } = setup([{ title: 'Sketch', dirty: true }]);
    expect(pressBack()).toBe(true);
    expect(view.getByText('Unsaved changes')).toBeTruthy();
    // Named, because a prompt that does not say what is at stake is a prompt
    // nobody can answer.
    expect(
      view.getByText('"Sketch" has changes that have not been saved.'),
    ).toBeTruthy();
    expect(back.exited).toBe(0);
  });

  it('asks about every unsaved document at once, not one prompt each', () => {
    // `decideQuit`'s reason for existing: three dialogs in a row is how
    // somebody discards the one they meant to keep.
    const { view } = setup([
      { title: 'A', dirty: true },
      { title: 'B', dirty: false },
      { title: 'C', dirty: true },
    ]);
    expect(pressBack()).toBe(true);
    expect(
      view.getByText('2 open documents have changes that have not been saved.'),
    ).toBeTruthy();
  });

  it('quits when the reader answers it', () => {
    const { view } = setup([{ title: 'Sketch', dirty: true }]);
    pressBack();
    fireEvent.press(view.getByText('Quit without saving'));
    expect(back.exited).toBe(1);
  });

  it('stays put when the reader cancels, and asks again on the next Back', () => {
    const { view } = setup([{ title: 'Sketch', dirty: true }]);
    pressBack();
    fireEvent.press(view.getByText('Cancel'));
    expect(back.exited).toBe(0);
    expect(view.queryByText('Unsaved changes')).toBeNull();
    // The guard must re-arm: a prompt answered "no" is not a prompt disabled.
    expect(pressBack()).toBe(true);
    expect(view.getByText('Unsaved changes')).toBeTruthy();
  });

  it('gives the listener up when the screen goes away', () => {
    // This is what keeps Back working on Settings and Docs: the subscription
    // is global and runs newest first, so one left behind swallows their pop.
    const { view } = setup([{ title: 'Sketch', dirty: true }]);
    expect(back.removed).toBe(false);
    view.unmount();
    expect(back.removed).toBe(true);
  });
});
