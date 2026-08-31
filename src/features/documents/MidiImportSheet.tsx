/**
 * What to bring in from a MIDI file, and how to read its timing.
 *
 * **MIDI is the one format that cannot be imported without deciding things.** A
 * performance has no bar lines, no clefs and no key: every one of those is a
 * guess, and a guess nobody was shown is a guess nobody can correct. The web
 * app has asked since it had an importer at all; native imported blind, so a
 * file whose left hand belonged on a bass stave arrived with both hands in
 * treble and no way to say otherwise.
 *
 * **It opens pre-filled and answerable in one tap.**
 * `defaultMidiImportOptions` turns the file's own analysis into a complete
 * answer — every non-empty track included, a clef guessed per track from its
 * note centroid, and the grid the file is *already written on* rather than a
 * straight one imposed on it. So somebody who does not want to think about
 * quantization presses Import and is done; the controls are for the person who
 * does.
 *
 * The track list is a list of rows rather than the web's table: a table with
 * six columns does not fit a phone, and the columns that matter for a decision
 * are which track, how many notes, and what clef. Channel and program ride
 * along on the same row as secondary text rather than as columns of their own.
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FormModal,
  NumberInput,
  Select,
  Switch,
  Text,
} from '@sudobility/components-rn';
import { defaultMidiImportOptions } from '@sudobility/music_lib';
import type { MidiImportOptions, MidiSummary } from '@sudobility/music_lib';
import type { Clef, DurationName } from '@sudobility/music_types';
import { CLEFS, MIDI_GRID_OPTIONS, NO_MARK } from '@sudobility/music_types';

export type MidiImportSheetProps = {
  open: boolean;
  /** The file's own analysis; `null` before one has been read. */
  summary: MidiSummary | null;
  onCancel: () => void;
  onImport: (options: MidiImportOptions) => void;
};

export function MidiImportSheet({
  open,
  summary,
  onCancel,
  onImport,
}: MidiImportSheetProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<MidiImportOptions | null>(null);

  /*
    Re-seeded from each file's analysis rather than carried across: the grid,
    the clefs and the track list are all answers *about this file*, and keeping
    the last file's would silently apply them to the next one.
  */
  useEffect(() => {
    setOptions(summary ? defaultMidiImportOptions(summary) : null);
  }, [summary]);

  if (!summary || !options) return null;

  const patch = (next: Partial<MidiImportOptions>): void =>
    setOptions(current => (current ? { ...current, ...next } : current));

  const setTrack = (
    sourceIndex: number,
    next: Partial<{ include: boolean; clef: Clef }>,
  ): void =>
    patch({
      trackSelections: options.trackSelections.map(selection =>
        selection.sourceIndex === sourceIndex
          ? { ...selection, ...next }
          : selection,
      ),
    });

  const includedCount = options.trackSelections.filter(s => s.include).length;

  return (
    <FormModal
      visible={open}
      title={t('importMidi.fileKind')}
      onClose={onCancel}
      actions={[
        { label: t('common.cancel'), onPress: onCancel, variant: 'ghost' },
        {
          label: t('dashboard.importMidi'),
          onPress: () => onImport(options),
          variant: 'primary',
          // Importing nothing produces an empty score, which is not what
          // anybody means by it.
          ...(includedCount === 0 ? { disabled: true } : {}),
        },
      ]}
      closeAriaLabel={t('common.closeDialog')}
      size="large"
    >
      <ScrollView>
        <View className="gap-4 p-1">
          <Text className="text-muted-foreground text-sm">
            {t('importMidi.description')}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {t('importMidi.summaryLine', {
              count: summary.tracks.length,
              seconds: Math.round(summary.durationSeconds),
              ppq: summary.ppq,
            })}
          </Text>

          {/* Which tracks to bring, and what stave each lands on. */}
          <View
            className="gap-2"
            accessibilityLabel={t('importMidi.trackSummary')}
          >
            {summary.tracks.map(track => {
              const selection = options.trackSelections.find(
                s => s.sourceIndex === track.index,
              );
              if (!selection) return null;
              return (
                <View
                  key={track.index}
                  className="border-border gap-2 rounded border p-2"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1">
                      <Text
                        className="text-foreground text-sm"
                        numberOfLines={1}
                      >
                        {track.name || track.instrumentName}
                      </Text>
                      {/* Channel, program and note count as one secondary
                          line: they inform the decision without each needing a
                          column of its own on a phone. */}
                      <Text className="text-muted-foreground text-xs">
                        {`${t('importMidi.colChannel')} ${
                          track.channel + 1
                        } · ${t('importMidi.colProgram')} ${track.program} · ${
                          track.noteCount
                        } ${t('importMidi.colNotes')}`}
                      </Text>
                    </View>
                    <Switch
                      checked={selection.include}
                      onCheckedChange={(checked: boolean) =>
                        setTrack(track.index, { include: checked })
                      }
                      accessibilityLabel={t('importMidi.includeTrack', {
                        name: track.name || track.instrumentName,
                      })}
                    />
                  </View>
                  {selection.include ? (
                    <Select
                      accessibilityLabel={`${t('importMidi.colClef')}: ${
                        track.name || track.instrumentName
                      }`}
                      value={selection.clef}
                      options={CLEFS.map((c: Clef) => ({
                        value: c,
                        label: c,
                      }))}
                      onValueChange={(value: string) =>
                        setTrack(track.index, { clef: value as Clef })
                      }
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          <View className="gap-1">
            <Text className="text-muted-foreground text-xs">
              {t('importMidi.quantizeGrid')}
            </Text>
            <Select
              accessibilityLabel={t('importMidi.quantizeGrid')}
              value={options.quantizeGrid ?? NO_MARK}
              options={MIDI_GRID_OPTIONS.map(option => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onValueChange={(value: string) =>
                patch({
                  quantizeGrid:
                    value === NO_MARK ? null : (value as DurationName),
                })
              }
            />
          </View>

          <Toggle
            label={t('importMidi.tripletDetection')}
            checked={options.tripletDetection}
            onChange={value => patch({ tripletDetection: value })}
          />

          <View className="gap-1">
            <Text className="text-muted-foreground text-xs">
              {t('importMidi.minDurationShort')}
            </Text>
            <View accessibilityLabel={t('importMidi.minDuration')}>
              <NumberInput
                value={options.minDurationTicks}
                min={1}
                max={480}
                onChange={(value: number) =>
                  patch({ minDurationTicks: Math.max(1, Math.round(value)) })
                }
              />
            </View>
          </View>

          <Toggle
            label={t('importMidi.mergeDuplicates')}
            checked={options.mergeNearDuplicates}
            onChange={value => patch({ mergeNearDuplicates: value })}
          />

          <View className="gap-1">
            <Text className="text-muted-foreground text-xs">
              {t('importMidi.sustain')}
            </Text>
            <Select
              accessibilityLabel={t('importMidi.sustain')}
              value={options.sustainPedal}
              options={[
                { value: 'extend', label: t('importMidi.sustainExtend') },
                { value: 'ignore', label: t('importMidi.sustainIgnore') },
              ]}
              onValueChange={(value: string) =>
                patch({ sustainPedal: value as 'extend' | 'ignore' })
              }
            />
          </View>

          <Toggle
            label={t('importMidi.pianoSplit')}
            checked={options.pianoStaffSplit}
            onChange={value => patch({ pianoStaffSplit: value })}
          />
          {/* Only meaningful with the split on, so it appears with it rather
              than sitting inert underneath. */}
          {options.pianoStaffSplit ? (
            <View className="gap-1">
              <Text className="text-muted-foreground text-xs">
                {t('importMidi.splitPoint')}
              </Text>
              <View accessibilityLabel={t('importMidi.splitPointLabel')}>
                <NumberInput
                  value={options.splitPointMidi}
                  min={0}
                  max={127}
                  onChange={(value: number) =>
                    patch({ splitPointMidi: Math.round(value) })
                  }
                />
              </View>
            </View>
          ) : null}

          <Toggle
            label={t('importMidi.detectKey')}
            checked={options.detectKey}
            onChange={value => patch({ detectKey: value })}
          />
        </View>
      </ScrollView>
    </FormModal>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-foreground flex-1 text-sm">{label}</Text>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}
