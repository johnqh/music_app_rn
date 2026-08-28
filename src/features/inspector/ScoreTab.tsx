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
import { dispatchTracked } from '@sudobility/music_editing';
import { changeMetadataCommand } from '@sudobility/music_types';
import { Field } from './Field';
import type { MusicDocument } from '@/documents/document';

export function ScoreTab({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const store = document.store;
  const metadata = useStore(store, s => s.score?.metadata);
  const [title, setTitle] = useState(metadata?.title ?? '');
  const [composer, setComposer] = useState(metadata?.composer ?? '');

  useEffect(() => {
    setTitle(metadata?.title ?? '');
    setComposer(metadata?.composer ?? '');
  }, [metadata?.title, metadata?.composer]);

  const commit = useCallback(
    (patch: { title?: string; composer?: string }) => () => {
      dispatchTracked(
        store,
        changeMetadataCommand(patch, t('inspector.setMetadata')),
      );
    },
    [store, t],
  );

  return (
    <View className="gap-3">
      <Field
        label={t('inspector.scoreTitle')}
        hint={t('inspector.scoreTitleHint')}
      >
        <Input
          value={title}
          onChangeText={setTitle}
          onBlur={commit({ title })}
          accessibilityLabel={t('inspector.scoreTitle')}
        />
      </Field>
      <Field label={t('inspector.composer')}>
        <Input
          value={composer}
          onChangeText={setComposer}
          onBlur={commit({ composer })}
          accessibilityLabel={t('inspector.composer')}
        />
      </Field>
    </View>
  );
}
