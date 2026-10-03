/**
 * The desktop Projects window's New pane — the same form `NewProjectSheet`
 * shows as a modal (phone/tablet, and the macOS File menu's New), inline
 * instead, over the same `useNewProjectForm`. A blank project stays local
 * with nothing connected; a generated one needs the server and an account,
 * and the credit rules are music_lib's, so the toggle and Create are refused
 * exactly where `NewProjectSheet`'s are, with the same explanation under the
 * switch (`GenerateToggle`).
 */
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@sudobility/components-rn';
import { ScoreSetupFields } from '@/features/generation/ScoreSetupFields';
import { GenerateToggle } from '@/features/projects/GenerateToggle';
import {
  useNewProjectForm,
  type NewProjectAccount,
  type NewProjectSubmission,
} from '@/features/projects/useNewProjectForm';

export type NewPaneProps = {
  account: NewProjectAccount;
  submitting: boolean;
  /** Opens Credits; offered beside a refusal for want of credits. */
  onOpenCredits?: () => void;
  onSubmit: (submission: NewProjectSubmission) => void;
};

export function NewPane({
  account,
  submitting,
  onOpenCredits,
  onSubmit,
}: NewPaneProps) {
  const { t } = useTranslation();
  const newProject = useNewProjectForm({ submitting, account, onSubmit });
  const { form, dispatch, canCreate, handleCreate } = newProject;

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
            <GenerateToggle
              form={newProject}
              {...(onOpenCredits ? { onOpenCredits } : {})}
            />
          }
        />
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
