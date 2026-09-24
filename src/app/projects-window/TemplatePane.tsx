/**
 * The desktop Projects window's Template pane — new here; neither phone/
 * tablet nor the macOS File menu has offered a template picker before now.
 * Over `music_lib`'s `projectTemplates`, the same catalogue and the same
 * per-template `build()` the web dashboard's "New from Template" uses, so a
 * template is the same starting score wherever it is chosen.
 */
import { FlatList, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { projectTemplates } from '@sudobility/music_lib';
import type { ProjectTemplate } from '@sudobility/music_lib';
import { libraryCopy } from '@/config/initialize';

export type TemplatePaneProps = {
  onChoose: (template: ProjectTemplate) => void;
};

export function TemplatePane({ onChoose }: TemplatePaneProps) {
  const { t } = useTranslation();
  const templates = projectTemplates(libraryCopy.templates());

  return (
    <FlatList
      data={templates}
      keyExtractor={(template: ProjectTemplate) => template.id}
      accessibilityLabel={t('dashboard.newFromTemplateAction')}
      contentContainerClassName="gap-2 p-4"
      renderItem={({ item }: { item: ProjectTemplate }) => {
        const choose = () => onChoose(item);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={choose}
            // macOS has no synthesized-touch fallback for an assistive press,
            // so a VoiceOver activation reaches a Pressable only through
            // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
            onAccessibilityTap={choose}
            className="border-border bg-card rounded-lg border p-3"
            style={{ minHeight: MIN_TOUCH_TARGET }}
          >
            <Text className="text-foreground font-medium">{item.name}</Text>
            <Text className="text-muted-foreground text-sm">
              {item.description}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
