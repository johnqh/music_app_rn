/**
 * Where credits came from and where they went — the web's credit history.
 *
 * Read straight from `ConsumablesApiClient`, as the balance is: the hooks
 * `consumables_client` offers for this read a store singleton that only a
 * purchase adapter initialises, and this app has none. A page at a time, with
 * more asked for rather than fetched up front.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Text } from '@sudobility/components-rn';
import type {
  ConsumablePurchaseRecord,
  ConsumableUsageRecord,
} from '@sudobility/types';
import { useAuth } from '@/auth/AuthContext';
import { useConsumablesClient } from '@/features/account/useAccountClients';
import { ScreenScaffold, ServerUnavailable } from '../ScreenScaffold';

const PAGE = 20;

/** One list that grows by a page: what both halves of the history are. */
function usePages<T>(
  load: ((limit: number, offset: number) => Promise<T[]>) | null,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);

  const fetchFrom = useCallback(
    (offset: number) => {
      if (!load) return;
      setLoading(true);
      setFailed(false);
      void load(PAGE, offset)
        .then(page => {
          setRows(current => (offset === 0 ? page : [...current, ...page]));
          // A full page is the only sign there may be another.
          setMore(page.length === PAGE);
        })
        .catch(() => setFailed(true))
        .finally(() => setLoading(false));
    },
    [load],
  );

  useEffect(() => fetchFrom(0), [fetchFrom]);
  return { rows, loading, failed, more, fetchFrom };
}

export function CreditHistorySection() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const client = useConsumablesClient(getToken);

  const loadPurchases = useCallback(
    (limit: number, offset: number) =>
      client!.getPurchaseHistory(limit, offset),
    [client],
  );
  const loadUsage = useCallback(
    (limit: number, offset: number) => client!.getUsageHistory(limit, offset),
    [client],
  );
  const purchases = usePages<ConsumablePurchaseRecord>(
    client ? loadPurchases : null,
  );
  const usage = usePages<ConsumableUsageRecord>(client ? loadUsage : null);

  if (!client) {
    return (
      <ScreenScaffold>
        <ServerUnavailable />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <History
        title={t('nav.purchases')}
        empty={t('history.noPurchases')}
        state={purchases}
        render={row => (
          <Row
            key={row.id}
            label={row.product_id ?? row.source}
            date={row.created_at}
            amount={`+${row.credits}`}
          />
        )}
      />
      <History
        title={t('history.usage')}
        empty={t('history.noUsage')}
        state={usage}
        render={row => (
          <Row
            key={row.id}
            label={row.reference ?? row.filename ?? t('history.generation')}
            date={row.created_at}
            // Absent is one credit, not none: rows written before amounts
            // varied carry no number.
            amount={`−${row.credits ?? 1}`}
          />
        )}
      />
    </ScreenScaffold>
  );
}

function History<T>({
  title,
  empty,
  state,
  render,
}: {
  title: string;
  empty: string;
  state: ReturnType<typeof usePages<T>>;
  render: (row: T) => React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-sm font-semibold uppercase">
        {title}
      </Text>
      {state.rows.map(render)}
      {/* The first page has no control to spin; a later one is the Load
          more button's own wait. */}
      {state.loading && state.rows.length === 0 ? (
        <View className="items-center py-3">
          <Spinner />
        </View>
      ) : null}
      {state.failed ? (
        <Text className="text-destructive text-base">
          {t('account.loadFailed')}
        </Text>
      ) : null}
      {!state.loading && !state.failed && state.rows.length === 0 ? (
        <Text className="text-muted-foreground py-2 text-base">{empty}</Text>
      ) : null}
      {state.more ? (
        <Button
          variant="outline"
          loading={state.loading}
          onPress={() => state.fetchFrom(state.rows.length)}
        >
          {t('history.loadMore')}
        </Button>
      ) : null}
    </View>
  );
}

function Row({
  label,
  date,
  amount,
}: {
  label: string;
  date: string;
  amount: string;
}) {
  return (
    <View className="border-border/50 flex-row items-center justify-between gap-3 border-b py-2">
      <View className="flex-1">
        <Text className="text-foreground text-base" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {new Date(date).toLocaleString()}
        </Text>
      </View>
      <Text className="text-foreground text-base tabular-nums">{amount}</Text>
    </View>
  );
}
