/**
 * The words the libraries no longer carry.
 *
 * music_editing and music_lib hold no strings in any language: a command's
 * label, a validation complaint and an autosave failure all come from whoever
 * is driving them. Gathered here rather than rebuilt at each call site.
 *
 * Every entry is read at the moment it is needed, not captured when this object
 * is built — a captured string strands whatever language was loaded at
 * start-up, so a reader who switches goes on seeing the old one.
 */
import i18next from 'i18next';
import type { CommandLabelKey, EditingCopy } from '@sudobility/music_editing';
import type { LibraryMessages, MusicXmlWarnings } from '@sudobility/music_lib';

export function commandLabel(key: CommandLabelKey): string {
  return i18next.t(`command.${key}`);
}

export function buildEditingCopy(): EditingCopy {
  return {
    commandLabel,
    validationProblem: (detail: string) =>
      i18next.t('editor.validationProblem', { detail }),
    lastMeasureKept: i18next.t('editor.lastMeasureKept'),
  };
}

/**
 * Every warning the MusicXML importer can raise.
 *
 * One entry per case the importer knows about; the library supplies the
 * *situation* and this supplies the sentence, so a new warning upstream shows
 * up here as a type error rather than as an untranslated string. That contract
 * is the whole reason `MusicXmlWarnings` exists — a warning written as a
 * hardcoded English string inside the library defeats it, and a Chinese reader
 * then gets English.
 */
export function musicXmlWarningCopy(): MusicXmlWarnings {
  const t = i18next.t.bind(i18next);
  return {
    unsupportedClef: (sign, line) =>
      t('musicXmlWarn.unsupportedClef', { sign, line }),
    unsupportedKeyMode: mode => t('musicXmlWarn.unsupportedKeyMode', { mode }),
    unsupportedTime: measureNumber =>
      t('musicXmlWarn.unsupportedTime', { measureNumber }),
    complexTimeSignature: t('musicXmlWarn.complexTimeSignature'),
    unsupportedPitchStep: step =>
      t('musicXmlWarn.unsupportedPitchStep', { step }),
    alterRounded: (alter, clamped) =>
      t('musicXmlWarn.alterRounded', { alter, clamped }),
    unsupportedNotation: tag => t('musicXmlWarn.unsupportedNotation', { tag }),
    unsupportedNoteElement: tag =>
      t('musicXmlWarn.unsupportedNoteElement', { tag }),
    unsupportedArticulation: tag =>
      t('musicXmlWarn.unsupportedArticulation', { tag }),
    multipleArticulations: t('musicXmlWarn.multipleArticulations'),
    unpitched: t('musicXmlWarn.unpitched'),
    noPitchOrRest: t('musicXmlWarn.noPitchOrRest'),
    noDuration: t('musicXmlWarn.noDuration'),
    nonPositiveDuration: t('musicXmlWarn.nonPositiveDuration'),
    noteTrimmed: t('musicXmlWarn.noteTrimmed'),
    unsupportedMeasureElement: tag =>
      t('musicXmlWarn.unsupportedMeasureElement', { tag }),
    noTempo: defaultBpm => t('musicXmlWarn.noTempo', { defaultBpm }),
    tempoClamped: (bpm, min, max, clamped) =>
      t('musicXmlWarn.tempoClamped', { bpm, min, max, clamped }),
  };
}

export function libraryMessages(): LibraryMessages {
  return {
    retry: () => i18next.t('library.retry'),
    saveFailed: () => i18next.t('library.saveFailed'),
    playbackFailed: () => i18next.t('library.playbackFailed'),
    scoreLoadFailed: () => i18next.t('library.scoreLoadFailed'),
    authRequired: () => i18next.t('library.authRequired'),
    serverUnavailable: () => i18next.t('library.serverUnavailable'),
  };
}
