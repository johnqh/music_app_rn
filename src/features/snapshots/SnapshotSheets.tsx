/**
 * The two snapshot sheets.
 *
 * Creating is cheap and safe. Opening is destructive to the live project, so it
 * carries a warning *and* a one-tap way to keep the work first — the
 * destructive path always has a non-destructive escape.
 *
 * **History is a tree, not a list.** Every snapshot has a `parentId` and the
 * live project carries a `parentSnapshotId`, so opening v1 while v2 exists
 * branches: v2 survives, and the next snapshot is v1's child. The web app draws
 * that as a flowchart; here it is an indented list, because a phone has no room
 * for lanes — the *shape* is the same, and `snapshotTree` in music_types is what
 * computes it for both.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FormModal,
  Input,
  MIN_TOUCH_TARGET,
  Switch,
  Text,
} from '@sudobility/components-rn';
import { Pressable, View } from 'react-native';
import { LIVE_NODE_ID } from '@sudobility/music_types';
import type { TreeNode } from '@sudobility/music_types';

export type CreateSnapshotSheetProps = {
  open: boolean;
  /** How many snapshots the project already has, for the default name. */
  snapshotCount: number;
  /** Half of the suggested public title; the snapshot name is the other half. */
  projectName: string;
  /** The name this user last published under, pre-filled when publishing. */
  defaultPublisherName?: string;
  onCreate: (name: string, publisherName?: string, publicName?: string) => void;
  onClose: () => void;
};

export function CreateSnapshotSheet({
  open,
  snapshotCount,
  projectName,
  defaultPublisherName,
  onCreate,
  onClose,
}: CreateSnapshotSheetProps) {
  const { t } = useTranslation();
  // Global creation order, not per-branch: "Version 4" off "Version 2" reads
  // better than "Version 2.1.1".
  const suggested = `Version ${snapshotCount + 1}`;
  const [name, setName] = useState(suggested);
  const [publish, setPublish] = useState(false);
  const [publisherName, setPublisherName] = useState(
    defaultPublisherName ?? '',
  );
  const [publicNameOverride, setPublicNameOverride] = useState<string | null>(
    null,
  );
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(suggested);
    setPublish(false);
    setPublicNameOverride(null);
    setCopyrightConfirmed(false);
    setPublisherName(defaultPublisherName ?? '');
  }, [open, suggested, defaultPublisherName]);

  // Suggested rather than stored, so editing the snapshot name keeps moving it
  // until the reader types a public title of their own.
  const publicName = publicNameOverride ?? `${projectName} — ${name}`;
  const canCreate =
    name.trim() !== '' &&
    (!publish || (copyrightConfirmed && publisherName.trim() !== ''));

  return (
    <FormModal
      visible={open}
      title={t('snapshot.createTitle')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('snapshot.createTitle'),
          disabled: !canCreate,
          onPress: () =>
            onCreate(
              name.trim(),
              publish ? publisherName.trim() : undefined,
              publish ? publicName.trim() : undefined,
            ),
        },
      ]}
    >
      <View className="gap-3">
        <Field label={t('snapshot.name')}>
          <Input
            value={name}
            onChangeText={setName}
            accessibilityLabel={t('snapshot.name')}
          />
        </Field>

        <Toggle
          label={t('snapshot.publish')}
          hint={t('snapshot.publishHint')}
          checked={publish}
          onChange={setPublish}
        />

        {publish ? (
          <>
            <Field
              label={t('snapshot.publicName')}
              hint={t('snapshot.publicNameHint')}
            >
              <Input
                value={publicName}
                onChangeText={setPublicNameOverride}
                accessibilityLabel={t('snapshot.publicName')}
              />
            </Field>
            <Field
              label={t('snapshot.publisherName')}
              hint={t('snapshot.publisherHint')}
            >
              <Input
                value={publisherName}
                onChangeText={setPublisherName}
                accessibilityLabel={t('snapshot.publisherName')}
              />
            </Field>
            {/*
              Publishing puts the music in front of strangers, so the warning is
              shown before the tick rather than after it — and Create stays
              disabled until it is ticked.
            */}
            <Text className="text-base text-amber-700">
              {t('snapshot.copyrightWarning')}
            </Text>
            <Toggle
              label={t('snapshot.copyrightConfirm')}
              checked={copyrightConfirmed}
              onChange={setCopyrightConfirmed}
            />
          </>
        ) : null}
      </View>
    </FormModal>
  );
}

export type OpenSnapshotSheetProps = {
  open: boolean;
  nodes: readonly TreeNode[];
  onOpen: (snapshotId: string) => void;
  onSnapshotFirst: () => void;
  onClose: () => void;
};

/** How far each generation is indented. */
const DEPTH_INDENT = 16;

export function OpenSnapshotSheet({
  open,
  nodes,
  onOpen,
  onSnapshotFirst,
  onClose,
}: OpenSnapshotSheetProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <FormModal
      visible={open}
      title={t('snapshot.openTitle')}
      onClose={onClose}
      size="large"
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        {
          label: t('snapshot.snapshotFirst'),
          onPress: onSnapshotFirst,
          variant: 'ghost',
        },
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('snapshot.open'),
          // The live project is in the tree so the branch point is visible;
          // it is not something you can "open", since you are already in it.
          disabled: selected === null || selected === LIVE_NODE_ID,
          onPress: () => {
            if (selected && selected !== LIVE_NODE_ID) onOpen(selected);
          },
        },
      ]}
    >
      <View className="gap-1">
        <Text className="text-muted-foreground pb-2 text-base">
          {t('snapshot.openWarning')}
        </Text>
        {nodes.map(node => (
          <Pressable
            key={node.id}
            accessibilityRole="button"
            accessibilityLabel={node.name}
            accessibilityState={{ selected: selected === node.id }}
            onPress={() => setSelected(node.id)}
            style={{
              marginLeft: node.depth * DEPTH_INDENT,
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
            }}
            className={
              selected === node.id ? 'bg-accent rounded p-2' : 'rounded p-2'
            }
          >
            <Text className="text-foreground text-base">
              {/* The live project is in the tree so the branch point is
                  visible, and it says so rather than showing a name. */}
              {node.isLive ? t('snapshot.currentWork') : node.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </FormModal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      {children}
      {hint ? (
        <Text className="text-muted-foreground text-sm">{hint}</Text>
      ) : null}
    </View>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Text className="text-foreground text-base">{label}</Text>
        {hint ? (
          <Text className="text-muted-foreground text-sm">{hint}</Text>
        ) : null}
      </View>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}
