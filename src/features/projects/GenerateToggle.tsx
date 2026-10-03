/**
 * New Project's "Generate for me" switch, with what it costs and why it, or
 * Create, is refused — drawn by `NewProjectSheet` and the desktop `NewPane`.
 *
 * **The explanation sits under the switch** because that is where the cause
 * is: a refusal of Create comes from generating, and the fixes it names (fewer
 * bars or instruments, the switch itself, buying credits) are all on this part
 * of the form. It used to be a line at the very bottom of a form that scrolls,
 * under a Create button pinned elsewhere, and nobody saw it. Which message,
 * and whether there is one at all, is music_lib's `newProjectCreditState`.
 *
 * The switch is disabled rather than hidden when it may not be used — a
 * control that comes and goes teaches the reader nothing about where to find
 * it — and the line under it says why.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text } from '@sudobility/components-rn';
import type { NewProjectFormState } from './useNewProjectForm';

export type GenerateToggleProps = {
  form: Pick<
    NewProjectFormState,
    'generating' | 'generationAvailable' | 'setGenerating' | 'credit'
  >;
  /** Opens the Credits screen; without it no Buy credits link is offered. */
  onOpenCredits?: () => void;
};

export function GenerateToggle({ form, onOpenCredits }: GenerateToggleProps) {
  const { t } = useTranslation();
  const { generating, generationAvailable, setGenerating, credit } = form;
  const { messageKey, messageValues, generationBlock, createBlock } = credit;
  /*
    A credit refusal is a problem to fix and is drawn as one; a missing
    account or server is a fact about where this form is, and reads as the
    hint it replaces.
  */
  const creditBlocked =
    createBlock === 'insufficientCredits' ||
    generationBlock === 'negativeBalance';

  return (
    <View className="flex-row items-start gap-3 pb-3">
      <Switch
        checked={generating}
        // The roster and the style that overwrites it both live in the
        // draft, so the singer is added and taken back there.
        onCheckedChange={setGenerating}
        disabled={!generationAvailable}
        accessibilityLabel={t('newProject.generateForMe')}
      />
      <View className="flex-1 gap-1">
        <Text className="text-foreground text-base">
          {t('newProject.generateForMe')}
        </Text>
        {messageKey === null ? (
          <Text className="text-muted-foreground text-sm">
            {t('newProject.generateForMeHint')}
          </Text>
        ) : null}
        {messageKey !== null && !creditBlocked ? (
          <Text className="text-muted-foreground text-sm">
            {t(messageKey, messageValues)}
          </Text>
        ) : null}
        {messageKey !== null && creditBlocked ? (
          <Text className="text-destructive text-sm">
            {t(messageKey, messageValues)}
          </Text>
        ) : null}
        {generating && createBlock === null ? (
          <Text className="text-muted-foreground text-sm">
            {t('generate.estimate', { count: credit.estimate })}
          </Text>
        ) : null}
        {creditBlocked && onOpenCredits ? (
          <View className="items-start">
            <Button
              variant="link"
              textClassName="text-sm"
              onPress={onOpenCredits}
            >
              {t('newProject.buyCredits')}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}
