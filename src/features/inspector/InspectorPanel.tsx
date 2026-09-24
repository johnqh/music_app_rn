/**
 * The property sheet, mirroring the web app's.
 *
 * music_types' `INSPECTOR_TABS` in its order — Score, Track, Note, Bar —
 * which is the web's, so a reader moving between the apps finds each tab in
 * the same place; plus, on this app only and for now, Unplugged (see
 * `RN_INSPECTOR_TABS`). The tab a selection opens is `defaultInspectorTab`:
 * what the selection is *of*, or Track when nothing is selected, since there
 * is always an active track and the Note and Bar tabs are an empty state until
 * something is. This panel had its own order (Track, Note, Bar, Score) and
 * always opened on Track, so tapping a note left its properties a tab away.
 *
 * Reflects and invokes only. Every edit is a `music_editing` action, because
 * the rules those enforce are rules about a score.
 *
 * The tab strip is `SegmentedTabs`, which is a real `UISegmentedControl` on
 * iOS and iPadOS and a tab row everywhere else — a four-way section picker at
 * the top of a panel is what that control is for, and the drawn strip it
 * replaced read as a web page's rather than as part of the app.
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { defaultInspectorTab } from '@sudobility/music_editing';
import { SegmentedTabs } from '@/components/controls/SegmentedTabs';
import { TrackTab } from './TrackTab';
import { NoteTab } from './NoteTab';
import { MeasureTab } from './MeasureTab';
import { ScoreTab } from './ScoreTab';
import { UnpluggedTab } from './UnpluggedTab';
import type { ReplaceScope } from '@sudobility/music_types';
import type { MusicDocument } from '@/documents/document';
import type { GenerationChoicesProps } from '@/features/generation/GenerationChoices';
import {
  INSPECTOR_TABS,
  INSPECTOR_TAB_LABEL_KEY,
} from '@sudobility/music_types';
import type { InspectorTab } from '@sudobility/music_types';

/**
 * This app's tabs: the shared four, plus Unplugged.
 *
 * music_types dropped `unplugged` from `INSPECTOR_TABS` when the web app moved
 * the stage arrangement out of the inspector and onto the playback bar's
 * Spatial toggle (`@sudobility/music_spatial`, the arrangement drawn as a map
 * inside a first-person 3D view). The native counterpart,
 * `@sudobility/music_spatial_rn`, is not built yet, and until it is this tab
 * is the only way to arrange the stage on a phone — so it is kept here, as a
 * local extension of the shared vocabulary rather than a second copy of it.
 * When `music_spatial_rn` lands, delete this list, `RN_TAB_LABEL_KEY`,
 * `UnpluggedTab` and the `inspector.unplugged*` locale keys, and this panel
 * goes back to reading `INSPECTOR_TABS` directly, as the web does.
 */
const RN_INSPECTOR_TABS = [...INSPECTOR_TABS, 'unplugged'] as const;
type RnInspectorTab = (typeof RN_INSPECTOR_TABS)[number];
const RN_TAB_LABEL_KEY: Record<RnInspectorTab, string> = {
  ...INSPECTOR_TAB_LABEL_KEY,
  unplugged: 'inspector.unplugged',
};

export type InspectorPanelProps = {
  document: MusicDocument;
  /**
   * Asks the server to rewrite part of the score.
   *
   * Threaded to the tabs rather than sitting on the toolbar, because the scope
   * *is* the tab: Replace Notes belongs beside the note you have selected,
   * Replace Measures beside the bars, Replace Track beside the part. On the
   * toolbar all three are equally far from the thing they act on, and a reader
   * has to work out which region each one means.
   *
   * Absent when there is no project behind the document — a local file has no
   * row for a job to write back to.
   */
  onReplace?: (scope: ReplaceScope) => void;
  /** Generate Again, shown under the Score tab's fields, as on the web. */
  generation?: GenerationChoicesProps;
};

export function InspectorPanel({
  document,
  onReplace,
  generation,
}: InspectorPanelProps) {
  const { t } = useTranslation();
  const selection = useStore(document.store, s => s.selection);
  const [tab, setTab] = useState<RnInspectorTab>(
    (): InspectorTab => defaultInspectorTab(selection),
  );
  /*
    Re-derived when the selection changes — a fresh tap on a note, a bar or a
    track — and otherwise left alone, so the reader's own choice of tab between
    selections is not fought. The web panel's effect, on the same three lists.
  */
  useEffect(() => {
    setTab(defaultInspectorTab(selection));
  }, [selection.eventIds, selection.measureIds, selection.trackIds]);

  return (
    <View className="flex-1" accessibilityLabel={t('editor.inspector')}>
      <SegmentedTabs
        label={t('editor.inspector')}
        options={RN_INSPECTOR_TABS.map(value => ({
          value,
          label: t(RN_TAB_LABEL_KEY[value]),
        }))}
        value={tab}
        onChange={value => setTab(value as RnInspectorTab)}
        testID="inspector-tabs"
      />
      {tab === 'unplugged' ? (
        // Its own free-drag 2D surface, not the shared `ScrollView` below —
        // a vertical scroll gesture and a drag in any direction on the same
        // surface would fight over the touch. See `UnpluggedTab`'s own
        // comment.
        <UnpluggedTab document={document} />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-3 gap-3">
          {tab === 'score' ? (
            <ScoreTab
              document={document}
              {...(generation ? { generation } : {})}
            />
          ) : null}
          {tab === 'track' ? (
            <TrackTab
              document={document}
              {...(onReplace ? { onReplace } : {})}
            />
          ) : null}
          {tab === 'note' ? (
            <NoteTab
              document={document}
              {...(onReplace ? { onReplace } : {})}
            />
          ) : null}
          {tab === 'measure' ? (
            <MeasureTab
              document={document}
              {...(onReplace ? { onReplace } : {})}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
