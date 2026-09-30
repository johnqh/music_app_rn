/**
 * A topic's figure: the element the topic is about, and what it is.
 *
 * Drawn at its own size and never larger — a picture of a toolbar stretched
 * to fill the pane is a picture of a toolbar that does not exist — and
 * narrower where the pane is, keeping its shape. The shape comes from
 * `aspectRatio`, so nothing here asks how wide the window is.
 */
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import type { DocsTopicId } from '@sudobility/music_types';
import { DOCS_FIGURES, docsFigureLabelKey } from './figures';
import { DOCS_FIGURE_ASSETS } from './figure-assets';

export function DocsFigure({ topic }: { topic: DocsTopicId }) {
  const { t } = useTranslation();
  const figure = DOCS_FIGURES[topic];
  const source = DOCS_FIGURE_ASSETS[topic];
  if (!figure || !source) return null;
  const label = t(docsFigureLabelKey(topic));

  return (
    // One element to a screen reader, read once: the picture and the words
    // under it say the same thing.
    <View
      className="gap-2 pt-2"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {/*
        The frame has the shape and the image fills it. Sizing the image
        itself did not hold: it drew at the file's own pixel size, twice the
        figure's and wider than the pane.
      */}
      <View
        className="border-border overflow-hidden border"
        style={{
          width: '100%',
          maxWidth: figure.width,
          aspectRatio: figure.width / figure.height,
        }}
      >
        <Image
          source={source}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      <Text className="text-muted-foreground text-sm">{label}</Text>
    </View>
  );
}
