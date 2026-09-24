/**
 * The desktop Projects window's left sidebar.
 *
 * Connect and My Projects are the same slot, not two items: signed out, the
 * slot says Connect and opens the sign-in pane; signed in, it says My
 * Projects and opens the list — `ProjectsSplitView` decides which by
 * `signedIn` alone, so the two can never both be selectable, and a reader
 * who was looking at Connect the moment they finished signing in lands on
 * My Projects rather than a pane that no longer applies to them.
 */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Text, cn } from '@sudobility/components-rn';
import type { PaneKey } from './paneKey';

export type ProjectsSidebarProps = {
  selected: PaneKey;
  signedIn: boolean;
  onSelect: (pane: PaneKey) => void;
};

export function ProjectsSidebar({
  selected,
  signedIn,
  onSelect,
}: ProjectsSidebarProps) {
  const { t } = useTranslation();

  return (
    <View
      className="border-border bg-card w-52 border-r py-2"
      accessibilityRole="menu"
      accessibilityLabel={t('nav.projects')}
    >
      <SidebarItem
        label={signedIn ? t('dashboard.myProjects') : t('dashboard.connect')}
        selected={selected === (signedIn ? 'myProjects' : 'connect')}
        onPress={() => onSelect(signedIn ? 'myProjects' : 'connect')}
      />
      <SidebarItem
        label={t('newProject.title')}
        selected={selected === 'new'}
        onPress={() => onSelect('new')}
      />
      <SidebarItem
        label={t('dashboard.newFromTemplateAction')}
        selected={selected === 'template'}
        onPress={() => onSelect('template')}
      />
      <SidebarItem
        label={t('dashboard.import')}
        selected={selected === 'import'}
        onPress={() => onSelect('import')}
      />
    </View>
  );
}

function SidebarItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      // macOS has no synthesized-touch fallback for an assistive press, so a
      // VoiceOver activation reaches a Pressable only through
      // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
      onAccessibilityTap={onPress}
      className={cn('flex-row items-center px-4', selected && 'bg-primary/10')}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <Text
        className={cn(
          'text-base',
          selected ? 'text-primary font-medium' : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
