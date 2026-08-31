/**
 * The documentation, master–detail as on the web.
 *
 * The topic list and its i18n keys come from `DOC_TOPICS` in
 * `@sudobility/music_editing`, so the two apps document the same product from
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Text } from '@sudobility/components-rn';
import type { RootStackParamList } from '@/app/Navigation';
import { DOCS_TOPICS } from '@sudobility/music_editing';

import { InstrumentReference } from '@/features/docs/InstrumentReference';
import { FormatReference } from '@/features/docs/FormatReference';

export function DocsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [topicId, setTopicId] = useState<string>(DOCS_TOPICS[0]?.id ?? '');
  const topic = DOCS_TOPICS.find(d => d.id === topicId);

  return (
    <View className="bg-background flex-1 flex-row">
      <ScrollView className="border-border w-44 border-r">
        {DOCS_TOPICS.map(d => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected: d.id === topicId }}
            onPress={() => setTopicId(d.id)}
            className={d.id === topicId ? 'bg-muted px-3 py-2' : 'px-3 py-2'}
          >
            <Text className="text-foreground text-sm">{t(d.title)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-3">
        {topic ? (
          <>
            <Text className="text-foreground text-lg font-semibold">
              {t(topic.title)}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {t(topic.summary)}
            </Text>
            {topic.sections.map(section => (
              <View key={section.heading} className="gap-1 pt-2">
                <Text className="text-foreground font-medium">
                  {t(section.heading)}
                </Text>
                {section.body.map(key => (
                  <Text key={key} className="text-foreground text-sm">
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
  );
}
