/**
 * Turning the open local document into a project.
 *
 * A project and a file are two origins for the same document, so this changes
 * where the bytes go and nothing else: the identity, the undo history and the
 * tab all survive. That is why it swaps the origin rather than creating a
 * second document — the alternative leaves two copies of one score, and the
 * next edit picks one of them at random.
 *
 * Offered only for a document that is not already a project, and only when
 * there is a server and an account to put it on. A control that is present and
 * refuses is worse than one that is absent.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@sudobility/components-rn';
import { View } from 'react-native';
import { syncDocumentToServer } from '@/documents/project-sync';
import { getMusicClient } from '@/config/server';
import { useAuth } from '@/auth/AuthContext';
import { useActiveDocument } from '@/documents/DocumentsContext';

export function SyncToServerButton() {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const document = useActiveDocument();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = getMusicClient();
  if (!client || !user || !document) return null;
  if (document.origin.kind === 'project') return null;

  return (
    <View className="gap-1">
      <Button
        variant="secondary"
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void syncDocumentToServer(document, client, getToken)
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
        }}
      >
        {t('dashboard.syncToServer')}
      </Button>
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
    </View>
  );
}
