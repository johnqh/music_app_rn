/**
 * The documentation, master–detail as on the web.
 *
 * The topic list and its i18n keys come from `DOCS_TOPICS` in
 * `@sudobility/music_lib`, so the two apps document the same product from
 * one description — the web's own docs page is built the same way, from
 * structure plus copy keys rather than prose in the component.
 *
 * Three of the web's sections are built from live data rather than described in
 * prose — the instrument table reads the GM catalogue, the shortcut table reads
 * `SHORTCUTS`, and the format tables read the format list — because prose about
 * a table is a copy of that table. The instrument and shortcut sections do the
 * same here; the shortcut one is its own screen.
 */
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenBackBar } from '@/components/layout/ScreenBackBar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import type { RootStackParamList } from '@/app/Navigation';

import { InstrumentReference } from '@/features/docs/InstrumentReference';
import { FormatReference } from '@/features/docs/FormatReference';
import { DOCS_GROUPS } from '@sudobility/music_types';
import type { DocsGroup } from '@sudobility/music_types';
import { DOCS_TOPICS, docsGroupLabelKey } from '@sudobility/music_lib';

export function DocsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [topicId, setTopicId] = useState<string>(DOCS_TOPICS[0]?.id ?? '');
  const topic = DOCS_TOPICS.find(d => d.id === topicId);

  return (
    <View className="bg-background flex-1">
      {/* The way back; nothing at all where the stack draws its own header. */}
      <View className="px-4">
        <ScreenBackBar />
      </View>
      <View className="min-h-0 flex-1 flex-row">
        <ScrollView className="border-border w-44 border-r">
          {/*
          Under the web's group headings — Start here, Using the app,
          Reference — through music_lib's `docsGroupLabelKey`. The list was
          one flat run of sixteen topics here, so a reader looking for the
          reference tables had nothing to navigate by.
        */}
          {DOCS_GROUPS.map((group: DocsGroup) => {
            const topics = DOCS_TOPICS.filter(d => d.group === group);
            if (topics.length === 0) return null;
            return (
              <View key={group} className="pb-2">
                <Text className="text-muted-foreground px-3 pt-3 pb-1 text-sm font-semibold uppercase">
                  {t(docsGroupLabelKey(group))}
                </Text>
                {topics.map(d => {
                  const activate = () => setTopicId(d.id);
                  return (
                    <Pressable
                      key={d.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: d.id === topicId }}
                      onPress={activate}
                      // macOS has no synthesized-touch fallback for an assistive
                      // press, so a VoiceOver activation reaches a Pressable only
                      // through `onAccessibilityTap` — `onPress` is a touch/mouse
                      // responder.
                      onAccessibilityTap={activate}
                      className={
                        d.id === topicId ? 'bg-muted px-3 py-2' : 'px-3 py-2'
                      }
                      style={{
                        minHeight: MIN_TOUCH_TARGET,
                        justifyContent: 'center',
                      }}
                    >
                      <Text className="text-foreground text-base">
                        {t(d.title)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <ScrollView className="flex-1" contentContainerClassName="p-4 gap-3">
          {topic ? (
            <>
              <Text className="text-foreground text-lg font-semibold">
                {t(topic.title)}
              </Text>
              <Text className="text-muted-foreground text-base">
                {t(topic.summary)}
              </Text>
              {topic.sections.map(section => (
                <View key={section.heading} className="gap-1 pt-2">
                  <Text className="text-foreground font-medium">
                    {t(section.heading)}
                  </Text>
                  {section.body.map(key => (
                    <Text key={key} className="text-foreground text-base">
                      {t(key)}
                    </Text>
                  ))}
                </View>
              ))}
              {/*
              The live-data sections. Prose about a table is a copy of that
              table, so the instrument list is read from the catalogue and the
              shortcuts from the bindings — neither can go stale.
            */}
              {topic.widget === 'instruments' ? <InstrumentReference /> : null}
              {/*
              The format tables. This branch was missing entirely, so the topic
              that carries `widget: 'formats'` rendered a heading with nothing
              under it — the one place the docs promised a table and showed
              none.
            */}
              {topic.widget === 'formats' ? <FormatReference /> : null}
              {/*
              The shortcut table has a screen of its own, so this points at it
              rather than printing it twice — but it points *actionably*. It
              used to be a sentence naming a screen with no way to reach it,
              which is a dead end dressed as a cross-reference.
            */}
              {topic.widget === 'shortcuts' ? (
                <Button
                  variant="outline"
                  onPress={() => navigation.navigate('Shortcuts')}
                >
                  {t('docs.seeShortcutsScreen')}
                </Button>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}
