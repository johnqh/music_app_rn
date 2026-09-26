/**
 * The score's own metadata — the web inspector's Score tab.
 *
 * **The title here is the score's, not the document's.** `metadata.title` names
 * every exported file and fills MusicXML's work title; the document's title
 * names the file it is stored in. Renaming one deliberately does not rename the
 * other — before the web app had this tab, a project renamed after creation
 * kept exporting under whatever its template was called.
 *
 * Both fields are drafts committed on blur, so a title is one undo entry rather
 * than one per letter.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Input } from '@sudobility/components-rn';
import { selectEditLocked } from '@sudobility/music_editing';
import { Field } from './Field';
import type { MusicDocument } from '@/documents/document';
import { GenerationChoices } from '@/features/generation/GenerationChoices';
import type { GenerationChoicesProps } from '@/features/generation/GenerationChoices';
import { ProjectOriginPanel } from '@/features/generation/ProjectOriginPanel';
import type { ProjectOriginProps } from '@/features/generation/ProjectOriginPanel';

export function ScoreTab({
  document,
  generation,
  origin,
}: {
  document: MusicDocument;
  /**
   * Generate Again, when the score came from a generation. Below the fields,
   * where the web inspector puts it: how the piece was made is a fact about the
   * score, like its title.
   */
  generation?: GenerationChoicesProps;
  /** Where the project came from, above Generate Again, as on the web. */
  origin?: ProjectOriginProps;
}) {
  const { t } = useTranslation();
  const store = document.store;
  const metadata = useStore(store, s => s.score?.metadata);
  // Content, so locked while the transport plays — the web's rule.
  const locked = useStore(store, selectEditLocked);
  const [title, setTitle] = useState(metadata?.title ?? '');
  const [composer, setComposer] = useState(metadata?.composer ?? '');

  useEffect(() => {
    setTitle(metadata?.title ?? '');
    setComposer(metadata?.composer ?? '');
  }, [metadata?.title, metadata?.composer]);

  /*
    Through the store's own action, not by dispatching the command.

    `setScoreMetadata` trims each field, **refuses an empty title** — a score
    with no name exports as one — skips a field that has not changed, and picks
    its own undo label; it answers whether it wrote. Whatever it declines, the
    draft goes back to what the score holds, as the web's tab does — the field
    used to keep showing a blank title the score did not have.
  */
  const commitTitle = useCallback(() => {
    if (!store.getState().setScoreMetadata({ title }))
      setTitle(metadata?.title ?? '');
  }, [store, title, metadata?.title]);
  const commitComposer = useCallback(() => {
    if (!store.getState().setScoreMetadata({ composer }))
      setComposer(metadata?.composer ?? '');
  }, [store, composer, metadata?.composer]);

  return (
    <View className="gap-3">
      <Field
        label={t('inspector.scoreTitle')}
        hint={t('inspector.scoreTitleHint')}
      >
        <Input
          value={title}
          onChangeText={setTitle}
          onBlur={commitTitle}
          editable={!locked}
          accessibilityLabel={t('inspector.scoreTitle')}
        />
      </Field>
      <Field label={t('inspector.composer')}>
        <Input
          value={composer}
          onChangeText={setComposer}
          onBlur={commitComposer}
          editable={!locked}
          accessibilityLabel={t('inspector.composer')}
        />
      </Field>
      {origin ? <ProjectOriginPanel {...origin} /> : null}
      {generation ? <GenerationChoices {...generation} /> : null}
    </View>
  );
}
