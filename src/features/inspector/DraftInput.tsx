/**
 * A text field that commits on blur.
 *
 * Every text property in the inspector wants this: dispatching per keystroke
 * makes each letter its own undo entry, so a typed chord symbol would take
 * eight presses of undo to remove. The draft is re-seeded when `value` changes
 * so switching selection does not carry a half-typed entry across.
 */
import { useEffect, useState } from 'react';
import { Input } from '@sudobility/components-rn';

export type DraftInputProps = {
  value: string;
  onCommit: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  accessibilityLabel?: string;
};

export function DraftInput({
  value,
  onCommit,
  placeholder,
  editable = true,
  accessibilityLabel,
}: DraftInputProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <Input
      value={draft}
      onChangeText={setDraft}
      onBlur={() => {
        // Nothing to dispatch when it has not changed — an unchanged commit
        // would still push an undo entry.
        if (draft !== value) onCommit(draft);
      }}
      editable={editable}
      {...(placeholder ? { placeholder } : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    />
  );
}
