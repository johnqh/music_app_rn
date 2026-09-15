/**
 * Starting a new score, with or without a model writing it.
 *
 * The twin of the web's `NewProjectDialog`, over the same draft reducer and the
 * same two music_lib builders — so the toggle decides only which builder runs,
 * and the two apps cannot disagree about what a new project is.
 *
 * It emits a *decision*, not a project. Where that lands is the caller's: the
 * dashboard makes a project on the server, and the macOS File menu makes a
 * local document — which is why generation can be switched off entirely.
 */
import { useReducer } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Switch, Text } from '@sudobility/components-rn';
import {
  canCreateNewProject,
  initialNewProjectDraft,
  newProjectCreditEstimate,
  newProjectDefaultTitleKey,
  newProjectSubmission,
  reduceNewProjectDraft,
} from '@sudobility/music_lib';
import type {
  NewProjectDraftAction,
  NewProjectFormDraft,
  NewProjectSubmission,
} from '@sudobility/music_lib';
import { ScoreSetupFields } from '@/features/generation/ScoreSetupFields';

/*
  `reduceNewProjectDraft` takes an optional random source as its third
  argument, which `useReducer` would fill with nothing useful — so it is
  wrapped, and the draw is `Math.random` exactly as the web dialog's is.
*/
const reducer = (
  draft: NewProjectFormDraft,
  action: NewProjectDraftAction,
): NewProjectFormDraft => reduceNewProjectDraft(draft, action);

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
  /*
    The form's rules are music_lib's reducer, shared with the web dialog: the
    style presets, the locks, the singer the toggle adds and takes back, and
    the bars and duration following each other. Nothing here decides any of
    it.
  */
  const [draft, dispatch] = useReducer(
    reducer,
    undefined,
    initialNewProjectDraft,
  );
  /*
    The draft's own `generating` is only ever set true through the toggle's
    handler below, which refuses it with no server — so a disabled switch that
    is somehow toggled anyway still cannot produce a request there is nowhere
    to send. Read again here as a belt to that brace.
  */
  const generating = draft.generating && generationAvailable;
  const form: NewProjectFormDraft = generating
    ? draft
    : { ...draft, generating: false };

  const credits = newProjectCreditEstimate(form);
  /*
    One rule per mode, both from music_lib, so the sheet cannot offer a Create
    the builder would then refuse — and `outOfCredits` gates generation only.
  */
  const canCreate = canCreateNewProject(form, { submitting, outOfCredits });

  const handleCreate = (): void => {
    if (!canCreate) return;
    /*
      The default title names the *project*: it rides on a generation request,
      and is a blank project's title while the score itself still says
      "Untitled" — the score's title and the project's name are different
      things. The variant the draft opens on (`DEFAULT_GENERATION_VARIANT`) is
      tagged on here too, which is the web's backend choice.
    */
    const submission = newProjectSubmission(
      form,
      t(newProjectDefaultTitleKey(form)),
    );
    if (submission) onSubmit(submission);
  };

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
          onPress: handleCreate,
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
              onCheckedChange={next =>
                // The roster and the style that overwrites it both live in the
                // draft, so the singer is added and taken back there.
                dispatch({
                  type: 'setGenerating',
                  generating: next && generationAvailable,
                })
              }
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
