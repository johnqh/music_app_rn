/**
 * New Project against the server, with its two refusals handled.
 *
 * Shared by the dashboard and the macOS File menu, which both submit the same
 * sheet. Before this each awaited `createServerProject` with no `catch`, so a
 * refused job — out of credits, typically — was an unhandled rejection: the
 * sheet stopped spinning and nothing said why, where the editor's own Generate
 * has always raised the paywall.
 *
 * Two things mirror the web dashboard exactly. **The courtesy gate** is
 * `!siteAdmin && balance !== null && balance <= 0`: an administrator generates
 * free and sits at zero forever, and an unknown balance is not an empty one.
 * And **the sheet closes on a failure as well as on success** — behind the
 * paywall an open form is one more thing in the way, and a failure dialog over
 * a sheet is two stacked modals.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { InsufficientCreditsError } from '@sudobility/music_client';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import { CreditPaywallSheet } from '@/features/credits/CreditPaywallSheet';
import { useCreditBalance } from '@/features/credits/useCreditBalance';
import { createServerProject } from './create-server-project';

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
  const { user, getToken, siteAdmin } = useAuth();
  const { balance, refresh } = useCreditBalance(getToken, user !== null);
  const outOfCredits = !siteAdmin && balance !== null && balance <= 0;
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
        return await createServerProject(client, token, submission);
      } catch (error) {
        /*
          A 402 is the one refusal with an obvious remedy, so it opens the
          paywall — the rule `useDocumentGeneration` applies in the editor.
          `InsufficientCreditsError` is music_client's, used directly: it
          already maps both the typed body and a bare 402.
        */
        if (error instanceof InsufficientCreditsError) {
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
