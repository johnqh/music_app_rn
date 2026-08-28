/**
 * The property sheet, mirroring the web app's.
 *
 * Four tabs in the web app's own order — Track first, then Note, Measure,
 * Score. Track is first because it is the only one that always has something
 * to show: there is always an active track, where the note and measure tabs
 * are an empty state until something is selected.
 *
 * Reflects and invokes only. Every edit is a `music_editing` action, because
 * the rules those enforce are rules about a score.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, Text } from '@sudobility/components-rn';
import { TrackTab } from './TrackTab';
import { NoteTab } from './NoteTab';
import { MeasureTab } from './MeasureTab';
import { ScoreTab } from './ScoreTab';
import type { MusicDocument } from '@/documents/document';

const TABS = ['track', 'note', 'measure', 'score'] as const;
export type InspectorTab = (typeof TABS)[number];

export function InspectorPanel({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<InspectorTab>('track');

  return (
    <View className="flex-1" accessibilityLabel={t('editor.inspector')}>
      <Tabs value={tab} onValueChange={value => setTab(value as InspectorTab)}>
        <TabsList>
          {TABS.map(value => (
            <TabsTrigger key={value} value={value}>
              <Text
                className={
                  tab === value ? 'text-foreground' : 'text-muted-foreground'
                }
              >
                {t(`inspector.${value}`)}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ScrollView className="flex-1" contentContainerClassName="p-3 gap-3">
        {tab === 'track' ? <TrackTab document={document} /> : null}
        {tab === 'note' ? <NoteTab document={document} /> : null}
        {tab === 'measure' ? <MeasureTab document={document} /> : null}
        {tab === 'score' ? <ScoreTab document={document} /> : null}
      </ScrollView>
    </View>
  );
}
