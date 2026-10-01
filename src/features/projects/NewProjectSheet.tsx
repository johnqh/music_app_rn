/**
 * Starting a new score, with or without a model writing it.
 *
 * The twin of the web's `NewProjectDialog`, over the same draft reducer and the
 * same two music_lib builders — so the toggle decides only which builder runs,
 * and the two apps cannot disagree about what a new project is. The state and
 * the rules live in `useNewProjectForm`, shared with the desktop Projects
 * window's inline `NewPane.tsx`; this is the modal shell around it.
 *
 * It emits a *decision*, not a project. Where that lands is the caller's: the
 * dashboard makes a project on the server, and the macOS File menu makes a
 * local document — which is why generation can be switched off entirely.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Switch, Text } from '@sudobility/components-rn';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import { ScoreSetupFields } from '@/features/generation/ScoreSetupFields';
import { trackButtonClick } from '@/analytics';
import { useNewProjectForm } from './useNewProjectForm';

export type NewProjectSheetProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (submission: NewProjectSubmission) => void;
  submitting?: boolean;
  /**
   * Whether the balance is spent, decided by the caller.
   *
   * Passed in rather than looked up here: reading it would drag the auth
   * provider, and Firebase with it, into a form for choosing a key signature,
   * and a form that cannot render in a test is a form nobody tests.
   *
   * It gates **generation only**. A blank project costs nothing, and refusing
   * one would refuse work the server never charges for.
   */
  outOfCredits?: boolean;
  /**
   * Whether a model can write this one.
   *
   * False from the macOS File menu, where the result is a local document: a job
   * writes its result back to a project row on the server, and a local file has
   * none. The toggle is disabled and says so rather than vanishing — a control
   * that comes and goes teaches the reader nothing about where to find it.
   */
  generationAvailable?: boolean;
};

export function NewProjectSheet({
  open,
  onClose,
  onSubmit,
  submitting = false,
  outOfCredits = false,
  generationAvailable = true,
}: NewProjectSheetProps) {
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
    <FormModal
      visible={open}
      title={t('newProject.title')}
      onClose={onClose}
      size="large"
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('dashboard.create'),
          onPress: () => {
            trackButtonClick('create_project', { generate: generating });
            handleCreate();
          },
          disabled: !canCreate,
          loading: submitting,
        },
      ]}
    >
      {/* No ScrollView of its own: FormModal's body already scrolls, and a
          second one nested inside it grew to its content and never scrolled. */}
      <ScoreSetupFields
        draft={form}
        dispatch={dispatch}
        generateToggle={
          <View className="flex-row items-center gap-3 pb-3">
            <Switch
              checked={generating}
              // The roster and the style that overwrites it both live in the
              // draft, so the singer is added and taken back there.
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
      {/*
        A courtesy gate, and only at zero. Deliberately not disabled when the
        estimate merely exceeds the balance: a job may overdraw once by design,
        and a stricter rule here would refuse work `POST /jobs` would have
        accepted.
      */}
      {generating && outOfCredits ? (
        <Text className="text-destructive text-sm">
          {t('credits.outOfCreditsTitle')}
        </Text>
      ) : null}
    </FormModal>
  );
}
