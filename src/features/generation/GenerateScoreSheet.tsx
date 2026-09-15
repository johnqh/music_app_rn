/**
 * Asking for a whole score, inside the project already open.
 *
 * The form itself is `ScoreSetupFields`, shared with `NewProjectSheet` — they
 * differ in their title, their action and whether the AI half is on screen, and
 * in nothing else, so a second copy would be a second place for the style
 * presets, the credit estimate and the instrument list to drift out of step.
 *
 * Everything about *what* to ask for lives in `music_lib` — the vocabularies,
 * the lists, the credit estimate, and `buildGenerateScoreRequest`, which is the
 * single place that decides whether a draft is a valid request.
 *
 * The credit line says "about", and means it: the server charges what the model
 * actually produced, which agrees whenever generation returns the requested
 * length and is otherwise smaller — so the quote is never exceeded. One credit
 * per bar **per instrument**, because a quartet costs about four times a solo
 * of the same length to produce.
 */
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import {
  buildGenerateScoreRequest,
  estimateGenerateScoreCredits,
} from '@sudobility/music_lib';
import type { GenerateScoreRequest } from '@sudobility/music_types';
import { ScoreSetupFields, useScoreSetupDraft } from './ScoreSetupFields';

export type GenerateScoreSheetProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: GenerateScoreRequest) => void;
  submitting?: boolean;
  /**
   * Whether the balance is spent, decided by the caller.
   *
   * Passed in rather than looked up here, and that is a layering decision with
   * teeth: reading it would mean importing the auth provider, which imports
   * Firebase, which is how a form for choosing a key signature ends up unable
   * to render in a test without a Firebase transform. The screen has the auth
   * context already; the sheet renders.
   *
   * A **courtesy** gate, and only at zero — never when the estimate merely
   * exceeds the balance. A job may overdraw once by design, and a stricter rule
   * here would refuse work `POST /jobs` would have accepted. The 402 still has
   * to be handled: somebody whose credits ran out in another session gets here.
   */
  outOfCredits?: boolean;
};

export function GenerateScoreSheet({
  open,
  onClose,
  onSubmit,
  submitting = false,
  outOfCredits = false,
}: GenerateScoreSheetProps) {
  const { t } = useTranslation();
  const setup = useScoreSetupDraft();
  const request = buildGenerateScoreRequest(setup.draft);
  const credits = estimateGenerateScoreCredits(
    setup.draft.durationMeasures,
    setup.instruments.length,
  );

  return (
    <FormModal
      visible={open}
      title={t('generateScore.title')}
      onClose={onClose}
      size="large"
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('generate.action'),
          onPress: () => {
            if (request) onSubmit(request);
          },
          disabled: request === null || outOfCredits,
          loading: submitting,
        },
      ]}
    >
      {/*
        Scrolls inside the sheet: on a phone in landscape this is taller than
        the screen, and a form whose Generate button is off the bottom is a
        form nobody can submit.
      */}
      <>
        <ScoreSetupFields draft={setup} showAi />

        <Text className="text-muted-foreground text-sm">
          {t('generate.estimate', { count: credits })}
        </Text>
        {/*
          A courtesy gate, and only at zero. Deliberately *not* disabled when
          the estimate exceeds the balance: a job may overdraw once by design,
          and a stricter rule here would refuse work `POST /jobs` would have
          accepted. The 402 still has to be handled — this is a courtesy, and
          somebody whose credits ran out in another session reaches it.
        */}
        {outOfCredits ? (
          <Text className="text-destructive text-sm">
            {t('credits.outOfCreditsTitle')}
          </Text>
        ) : null}
      </>
    </FormModal>
  );
}
