/**
 * The desktop Projects window's New pane — the same form `NewProjectSheet`
 * shows as a modal (phone/tablet, and the macOS File menu's New), inline
 * instead, over the same `useNewProjectForm`. A blank project stays local
 * with nothing connected; a generated one needs the server and an account,
 * which is why `generationAvailable` disables the toggle exactly where
 * `NewProjectSheet`'s does — see that component's own comment on why it is
 * disabled rather than hidden.
 */
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text } from '@sudobility/components-rn';
import { ScoreSetupFields } from '@/features/generation/ScoreSetupFields';
import {
  useNewProjectForm,
  type NewProjectSubmission,
} from '@/features/projects/useNewProjectForm';

export type NewPaneProps = {
  generationAvailable: boolean;
  outOfCredits: boolean;
  submitting: boolean;
  onSubmit: (submission: NewProjectSubmission) => void;
};

export function NewPane({
  generationAvailable,
  outOfCredits,
  submitting,
  onSubmit,
}: NewPaneProps) {
  const { t } = useTranslation();
  const {
    form,
    dispatch,
    generating,
    setGenerating,
    credits,
    canCreate,
    handleCreate,
  } = useNewProjectForm({
    submitting,
    outOfCredits,
    generationAvailable,
    onSubmit,
  });

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-6"
        accessibilityLabel={t('newProject.title')}
      >
        <ScoreSetupFields
          draft={form}
          dispatch={dispatch}
          generateToggle={
            <View className="flex-row items-center gap-3 pb-3">
              <Switch
                checked={generating}
                onCheckedChange={setGenerating}
                disabled={!generationAvailable}
                accessibilityLabel={t('newProject.generateForMe')}
              />
              <View className="flex-1">
                <Text className="text-foreground text-base">
                  {t('newProject.generateForMe')}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {generationAvailable
                    ? t('newProject.generateForMeHint')
                    : t('newProject.generationNeedsServer')}
                </Text>
              </View>
            </View>
          }
        />

        {generating ? (
          <Text className="text-muted-foreground text-sm">
            {t('generate.estimate', { count: credits })}
          </Text>
        ) : null}
        {generating && outOfCredits ? (
          <Text className="text-destructive text-sm">
            {t('credits.outOfCreditsTitle')}
          </Text>
        ) : null}
      </ScrollView>

      {/*
        Sticky footer, outside the ScrollView — the same shape `FormModal`'s
        own `actions` footer gives every sheet-based form (Create pinned below
        scrollable content, never scrolling away with it). This inline pane
        has no `FormModal` to borrow that from, so it repeats the shape here.
      */}
      <View className="border-border border-t px-6 py-4">
        <Button
          onPress={handleCreate}
          disabled={!canCreate}
          loading={submitting}
        >
          {t('dashboard.create')}
        </Button>
      </View>
    </View>
  );
}
