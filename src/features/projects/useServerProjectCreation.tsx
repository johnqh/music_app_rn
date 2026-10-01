/**
 * New Project against the server, with its two refusals handled.
 *
 * Shared by the dashboard and the macOS File menu, which both submit the same
 * sheet. Before this each awaited the create with no `catch`, so a
 * refused job — out of credits, typically — was an unhandled rejection: the
 * sheet stopped spinning and nothing said why, where the editor's own Generate
 * has always raised the paywall.
 *
 * The server half is music_client's `createGeneratedProject` — create the row,
 * start the job, delete the row again if the job is refused — and where a
 * refusal goes is its `classifyGenerationError`. Both used to be written here
 * (`create-server-project.ts`) and on the web dashboard separately, and a copy
 * of "delete the project a refused job was made to hold" is exactly the rule
 * that drifts: without it a user with no credits collects an empty "Generated
 * score" row on every attempt.
 *
 * Two things mirror the web dashboard exactly. **The courtesy gate** is
 * music_lib's `isOutOfCredits`: an administrator generates free and sits at
 * zero forever, and an unknown balance is not an empty one.
 * And **the sheet closes on a failure as well as on success** — behind the
 * paywall an open form is one more thing in the way, and a failure dialog over
 * a sheet is two stacked modals.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import {
  classifyGenerationError,
  createGeneratedProject,
} from '@sudobility/music_client';
import { isOutOfCredits } from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import { useAuth } from '@/auth/AuthContext';
import { useSiteAdmin } from '@/auth/useSiteAdmin';
import { getMusicClient } from '@/config/server';
import { CreditPaywallSheet } from '@/features/credits/CreditPaywallSheet';
import { useCreditBalance } from '@/features/credits/useCreditBalance';

export type ServerProjectCreation = {
  /**
   * Creates the project and resolves once it is settled either way. Never
   * throws; resolves `null` when nothing was created (no server, no session, or
   * a refusal — which is then already on screen).
   */
  create: (submission: NewProjectSubmission) => Promise<string | null>;
  creating: boolean;
  /** For `NewProjectSheet`'s `outOfCredits`. */
  outOfCredits: boolean;
  paywallOpen: boolean;
  closePaywall: () => void;
  failure: string | null;
  clearFailure: () => void;
};

export function useServerProjectCreation(): ServerProjectCreation {
  const { user, getToken } = useAuth();
  const siteAdmin = useSiteAdmin();
  const { balance, refresh } = useCreditBalance(getToken, user !== null);
  const outOfCredits = isOutOfCredits(balance, siteAdmin);
  const [creating, setCreating] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const create = useCallback(
    async (submission: NewProjectSubmission): Promise<string | null> => {
      const client = getMusicClient();
      setCreating(true);
      try {
        // Read per request: a token captured at render expires within the hour.
        const token = await getToken();
        if (!client || !token) return null;
        const project = await createGeneratedProject(client, token, submission);
        return project.id;
      } catch (error) {
        /*
          A 402 is the one refusal with an obvious remedy, so it opens the
          paywall — the rule `useDocumentGeneration` applies in the editor.
          `classifyGenerationError` decides it, and checks by name as well as
          by class, so a second copy of music_client in the bundle cannot turn
          the paywall back into an error message.
        */
        if (classifyGenerationError(error) === 'paywall') {
          setPaywallOpen(true);
          // The server has just said the balance is spent; let the gate agree.
          refresh();
        } else {
          setFailure(error instanceof Error ? error.message : String(error));
        }
        return null;
      } finally {
        setCreating(false);
      }
    },
    [getToken, refresh],
  );

  return {
    create,
    creating,
    outOfCredits,
    paywallOpen,
    closePaywall: useCallback(() => setPaywallOpen(false), []),
    failure,
    clearFailure: useCallback(() => setFailure(null), []),
  };
}

/** The paywall and the failure dialog a creation can raise. */
export function ServerProjectCreationFeedback({
  creation,
  onOpenCredits,
}: {
  creation: ServerProjectCreation;
  onOpenCredits?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CreditPaywallSheet
        open={creation.paywallOpen}
        onClose={creation.closePaywall}
        {...(onOpenCredits ? { onOpenCredits } : {})}
      />
      <FormModal
        visible={creation.failure !== null}
        title={t('errors.createProject')}
        onClose={creation.clearFailure}
        onSave={creation.clearFailure}
        saveLabel={t('common.ok')}
        closeAriaLabel={t('common.closeDialog')}
      >
        <Text className="text-foreground text-base">{creation.failure}</Text>
      </FormModal>
    </>
  );
}
