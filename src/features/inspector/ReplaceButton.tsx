/**
 * "Ask the server to rewrite this."
 *
 * One button per tab, and the scope is the tab it sits in — Replace Notes
 * beside the note you selected, Replace Measures beside the bars, Replace Track
 * beside the part. That placement is the whole point: on a toolbar all three
 * are equally far from the thing they act on, and the reader has to work out
 * which region each one means from its name alone.
 *
 * **Available when music_editing's `canReplace` says so**, which the web's
 * button asks too: there is a region for this scope (`replacementRegion`, the
 * same region the job will use) and the transport is not playing, since the
 * result is written into the score. Each tab used to pass its own `playing`
 * flag, so a Replace with nothing to replace looked live and opened a sheet
 * over nothing.
 */
import { useStore } from 'zustand';
import { Button } from '@sudobility/components-rn';
import { canReplace } from '@sudobility/music_editing';
import type { ReplaceScope } from '@sudobility/music_types';
import type { MusicDocument } from '@/documents/document';

export function ReplaceButton({
  document,
  scope,
  label,
  onReplace,
}: {
  document: MusicDocument;
  scope: ReplaceScope;
  label: string;
  onReplace: (scope: ReplaceScope) => void;
}) {
  const available = useStore(document.store, s => canReplace(s, scope));
  return (
    <Button
      variant="secondary"
      disabled={!available}
      onPress={() => onReplace(scope)}
      accessibilityLabel={label}
    >
      {label}
    </Button>
  );
}
