/**
 * Starting a new score, with or without a model writing it.
 *
 * The twin of the web's `NewProjectDialog`, over the same form and the same two
 * music_lib builders — so the toggle decides only which builder runs, and the
 * two apps cannot disagree about what a new project is.
 *
 * It emits a *decision*, not a project. Where that lands is the caller's: the
 * dashboard makes a project on the server, and the macOS File menu makes a
 * local document — which is why generation can be switched off entirely.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Switch, Text } from '@sudobility/components-rn';
import {
  buildGenerateScoreRequest,
  buildNewProjectScore,
  canBuildGenerateScoreRequest,
  canBuildNewProjectScore,
  estimateGenerateScoreCredits,
} from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import {
  ScoreSetupFields,
  useScoreSetupDraft,
} from '@/features/generation/ScoreSetupFields';

export type NewProjectSheetProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (submission: NewProjectSubmission) => void;
  submitting?: boolean;
  /**
   * Whether the balance is spent, decided by the caller.
   *
   * Passed in rather than looked up here, for the reason `GenerateScoreSheet`
   * documents: reading it would drag the auth provider, and Firebase with it,
   * into a form for choosing a key signature.
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
  const setup = useScoreSetupDraft();
  /*
    Off by default: this is New Project, and a blank score with the right
    instruments is the ordinary way to start one. Flipping it never clears
    anything — losing typed text to a toggle is not worth the tidiness.
  */
  const [generateForMe, setGenerateForMe] = useState(false);
  /*
    The switch's own value is a courtesy; `generating` is the fact. Every branch
    below reads this rather than `generateForMe`, so a disabled control that is
    somehow toggled anyway still cannot produce a request there is nowhere to
    send.
  */
  const generating = generateForMe && generationAvailable;

  const credits = estimateGenerateScoreCredits(
    setup.draft.durationMeasures,
    setup.instruments.length,
  );

  /*
    One rule per mode, both from music_lib, so the sheet cannot offer a Create
    the builder would then refuse.
  */
  const canCreate =
    !submitting &&
    (generating
      ? !outOfCredits && canBuildGenerateScoreRequest(setup.draft)
      : canBuildNewProjectScore(setup.draft));

  const handleCreate = (): void => {
    if (!canCreate) return;
    if (generating) {
      const request = buildGenerateScoreRequest(setup.draft);
      if (request) onSubmit({ kind: 'generate', request });
      return;
    }
    const score = buildNewProjectScore(setup.draft);
    if (!score) return;
    // The score's title and the project's name are different things: the score
    // says "Untitled", and a row in a list needs one a reader can pick out.
    onSubmit({
      kind: 'blank',
      title: setup.title.trim() || t('newProject.untitled'),
      score,
    });
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
      {/*
        Scrolls inside the sheet: on a phone in landscape this is taller than
        the screen, and a form whose Create button is off the bottom is a form
        nobody can submit.
      */}
      <ScrollView keyboardShouldPersistTaps="handled">
        {/*
          Above the fields, because it is the first thing you decide: whether
          anything is written for you, or you get the staves and write it.
        */}
        <View className="flex-row items-center gap-3 pb-3">
          <Switch
            checked={generateForMe}
            onCheckedChange={setGenerateForMe}
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

        <ScoreSetupFields draft={setup} showAi={generating} />

        {generating ? (
          <Text className="text-muted-foreground text-sm">
            {t('generate.estimate', { count: credits })}
          </Text>
        ) : null}
        {/*
          A courtesy gate, and only at zero. Deliberately not disabled when the
          estimate merely exceeds the balance: a job may overdraw once by
          design, and a stricter rule here would refuse work `POST /jobs` would
          have accepted.
        */}
        {generating && outOfCredits ? (
          <Text className="text-destructive text-sm">
            {t('credits.outOfCreditsTitle')}
          </Text>
        ) : null}
      </ScrollView>
    </FormModal>
  );
}
