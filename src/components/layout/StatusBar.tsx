/**
 * The bottom status strip, mirroring the web app's.
 *
 * Same content and same order: what is selected on the left, and the
 * validation issues on the right.
 *
 * The issue count is the one control here that does anything, and it is the
 * right place for it: an issue is something the score *has*, so it belongs
 * beside the other things the strip reports rather than among the tools. It
 * says nothing at all when the score is clean, which is almost always — a
 * permanent "0 issues" is a permanent invitation to stop reading the strip.
 */
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import { selectSelectedTrack } from '@sudobility/music_editing';
import { Pressable } from 'react-native';
import { useState } from 'react';
import { IssuesSheet } from '@/features/score-editor/IssuesSheet';
import type { MusicDocument } from '@/documents/document';

export function StatusBar({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const track = useStore(document.store, selectSelectedTrack);
  const measureCount = useStore(
    document.store,
    s => s.score?.tracks[0]?.measures.length ?? 0,
  );
  const trackCount = useStore(document.store, s => s.score?.tracks.length ?? 0);
  const issues = useStore(document.store, s => s.validationIssues);
  const errors = issues.filter(i => i.severity === 'error').length;
  const [issuesOpen, setIssuesOpen] = useState(false);

  return (
    <View className="border-border bg-card flex-row items-center gap-3 border-t px-3 py-1">
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {track ? track.name : t('editor.noTrack')}
      </Text>
      <Text className="text-muted-foreground text-xs">
        {t('editor.barsAndTracks', {
          bars: measureCount,
          tracks: trackCount,
        })}
      </Text>
      <View className="flex-1" />
      {issues.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.validationIssues')}
          onPress={() => setIssuesOpen(true)}
        >
          <Text
            className={
              errors > 0
                ? 'text-destructive text-xs'
                : 'text-muted-foreground text-xs'
            }
          >
            {t('editor.issues', { count: issues.length })}
          </Text>
        </Pressable>
      ) : null}
      <IssuesSheet
        open={issuesOpen}
        document={document}
        onClose={() => setIssuesOpen(false)}
      />
    </View>
  );
}
