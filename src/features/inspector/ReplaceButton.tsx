/**
 * "Ask the server to rewrite this."
 *
 * One button per tab, and the scope is the tab it sits in — Replace Notes
 * beside the note you selected, Replace Measures beside the bars, Replace Track
 * beside the part. That placement is the whole point: on a toolbar all three
 * are equally far from the thing they act on, and the reader has to work out
 * which region each one means from its name alone.
 *
 * Refused while the transport plays, like every other content control: the
 * result is applied to the score, and the score is immutable mid-playback.
 */
import { Button } from '@sudobility/components-rn';
import type { ReplaceScope } from '@sudobility/music_types';

export function ReplaceButton({
  scope,
  label,
  disabled = false,
  onReplace,
}: {
  scope: ReplaceScope;
  label: string;
  disabled?: boolean;
  onReplace: (scope: ReplaceScope) => void;
}) {
  return (
    <Button
      variant="secondary"
      disabled={disabled}
      onPress={() => onReplace(scope)}
      accessibilityLabel={label}
    >
      {label}
    </Button>
  );
}
