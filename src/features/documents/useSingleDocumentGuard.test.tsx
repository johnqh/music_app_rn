/**
 * Opening a project where only one may be open.
 *
 * The list closes the document that was open without asking, so the asking
 * is here — and only about work that would actually be lost. A document with
 * somewhere to live is saved first and never asked about.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { changeMetadataCommand, MusicPosition } from '@sudobility/music_types';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { renderWithApp, testDocument } from '@/test/render';
import { useSingleDocumentGuard } from './useSingleDocumentGuard';

function Host({ single, action }: { single: boolean; action: () => void }) {
  const { guard, prompt } = useSingleDocumentGuard(single);
  return (
    <>
      <Pressable
        accessibilityLabel="open another"
        onPress={() => guard(action)}
      >
        <Text>open</Text>
      </Pressable>
      {prompt}
    </>
  );
}

function setup(single: boolean, dirty: boolean) {
  const list = new DocumentList({ position: () => new MusicPosition() });
  const document = list.open(testDocument({ title: 'Sketch' }));
  if (dirty) {
    document.store
      .getState()
      .dispatchCommand(
        changeMetadataCommand({ title: 'Sketch, edited' }, 'Set title'),
      );
  }
  const action = jest.fn();
  const view = renderWithApp(
    <DocumentsProvider list={list}>
      <Host single={single} action={action} />
    </DocumentsProvider>,
  );
  const press = async () => {
    await act(async () => {
      fireEvent.press(view.getByLabelText('open another'));
    });
  };
  return { view, action, press, document };
}

describe('useSingleDocumentGuard', () => {
  it('opens straight away when nothing would be lost', async () => {
    const { view, action, press } = setup(true, false);
    await press();
    expect(action).toHaveBeenCalledTimes(1);
    expect(view.queryByText('Unsaved changes')).toBeNull();
  });

  it('asks before closing work that has nowhere to be saved', async () => {
    const { view, action, press, document } = setup(true, true);
    expect(document.store.getState().dirty).toBe(true);
    await press();
    expect(action).not.toHaveBeenCalled();
    expect(view.getByText('Unsaved changes')).toBeTruthy();
  });

  it('opens once the reader has said to close without saving', async () => {
    const { view, action, press } = setup(true, true);
    await press();
    await act(async () => {
      fireEvent.press(view.getByText('Close without saving'));
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('opens nothing when the reader cancels', async () => {
    const { view, action, press } = setup(true, true);
    await press();
    await act(async () => {
      fireEvent.press(view.getByText('Cancel'));
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('asks nothing where several documents may be open', async () => {
    const { view, action, press } = setup(false, true);
    await press();
    expect(action).toHaveBeenCalledTimes(1);
    expect(view.queryByText('Unsaved changes')).toBeNull();
  });
});
