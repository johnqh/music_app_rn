/**
 * Text fields that commit on blur.
 *
 * Every text property in the inspector wants this: dispatching per keystroke
 * makes each letter its own undo entry, so a typed chord symbol would take
 * eight presses of undo to remove. The draft is re-seeded when `value` changes
 * so switching selection does not carry a half-typed entry across.
 */
import { useEffect, useState } from 'react';
import { Input } from '@sudobility/components-rn';
import { parseNumericDraft } from '@sudobility/music_types';
import type { NumericDraftOptions } from '@sudobility/music_types';

/**
 * A commit that answers `false` wrote nothing — a refusal, or text the store
 * trimmed to what it already held — and the field goes back to `value`.
 * Answering nothing (`void`) keeps the draft, for callers with no answer.
 */
export type DraftCommit<T> = (value: T) => boolean | void;

export type DraftInputProps = {
  value: string;
  onCommit: DraftCommit<string>;
  placeholder?: string;
  editable?: boolean;
  accessibilityLabel?: string;
  /** For a caller that states the field's height; see `FieldSlot`. */
  className?: string;
};

export function DraftInput({
  value,
  onCommit,
  placeholder,
  editable = true,
  accessibilityLabel,
  className,
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
        if (draft !== value && onCommit(draft) === false) setDraft(value);
      }}
      editable={editable}
      {...(placeholder ? { placeholder } : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(className ? { className } : {})}
    />
  );
}

export type NumberDraftInputProps = NumericDraftOptions & {
  /**
   * The value every selected object agrees on, or `null` where they disagree —
   * which shows an empty field with `mixedPlaceholder` rather than the first
   * object's value presented as everyone's.
   */
  value: number | null;
  onCommit: DraftCommit<number>;
  mixedPlaceholder?: string;
  editable?: boolean;
  accessibilityLabel?: string;
  /** For a row that states its height: see `FieldSlot`. */
  className?: string;
};

/**
 * A number field that commits on blur — the web's `MixedNumberField`.
 *
 * It replaced the library `NumberInput`, which is the wrong control here for
 * two reasons the web had already found. Its value is a real `number`, so it
 * has no way to say "these notes disagree": a Mixed selection read as whatever
 * the fallback happened to be, and nudging it applied that to every note. And
 * it commits on every change, so typing `100` into velocity wrote 1, then 10,
 * then 100 — three undo entries, and two velocities nobody asked for.
 *
 * The text goes through music_types' `parseNumericDraft`, never `Number()`.
 * Blank is "no change" rather than 0 — an emptied velocity field once wrote
 * silence that way — and out-of-range text is clamped to the bounds given
 * here. Whatever does not commit (blank, nonsense, the value already held, or
 * a commit the store refused) puts the field back to what the store holds, so
 * it never shows a number the score does not have.
 */
export function NumberDraftInput({
  value,
  onCommit,
  mixedPlaceholder,
  editable = true,
  accessibilityLabel,
  min,
  max,
  integer,
  className,
}: NumberDraftInputProps) {
  const shown = value === null ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const parsed = parseNumericDraft(draft, {
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(integer === undefined ? {} : { integer }),
    });
    if (parsed === null || parsed === value) {
      setDraft(shown);
      return;
    }
    if (onCommit(parsed) === false) setDraft(shown);
  };

  return (
    <Input
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="numeric"
      editable={editable}
      {...(value === null && mixedPlaceholder
        ? { placeholder: mixedPlaceholder }
        : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(className ? { className } : {})}
    />
  );
}
