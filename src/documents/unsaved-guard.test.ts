import { describe, expect, it } from 'vitest';
import { decideClose, decideQuit, hasUnwrittenWork } from './unsaved-guard.js';
import { createDocument, markSaved } from './document.js';
import {
  changeMetadataCommand,
  createEmptyScore,
} from '@sudobility/music_types';

let n = 0;
function doc(edit = false) {
  n += 1;
  const d = createDocument({
    id: `d${n}`,
    title: `T${n}`,
    score: createEmptyScore({ title: 'T' }),
  });
  if (edit) {
    d.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'x' }, 'edit'));
  }
  return d;
}

describe('closing a document', () => {
  it('closes a clean one without asking', () => {
    expect(decideClose(doc())).toEqual({ kind: 'close' });
  });

  it('asks about an edited one', () => {
    const d = doc(true);
    expect(decideClose(d)).toEqual({ kind: 'confirm', documents: [d] });
  });

  it('stops asking once it has been written', () => {
    const d = doc(true);
    markSaved(d, { kind: 'file', uri: '/x.moosiac' });
    expect(hasUnwrittenWork(d)).toBe(false);
    expect(decideClose(d)).toEqual({ kind: 'close' });
  });
});

describe('quitting', () => {
  it('says nothing when everything is written', () => {
    expect(decideQuit([doc(), doc()])).toEqual({ kind: 'close' });
  });

  it('names every unwritten document in one question', () => {
    const clean = doc();
    const a = doc(true);
    const b = doc(true);
    const decision = decideQuit([clean, a, b]);
    expect(decision.kind).toBe('confirm');
    // One prompt listing both — three dialogs in a row is how somebody
    // discards the one they meant to keep.
    expect(decision.kind === 'confirm' && decision.documents).toEqual([a, b]);
  });

  it('is safe with nothing open', () => {
    expect(decideQuit([])).toEqual({ kind: 'close' });
  });
});
