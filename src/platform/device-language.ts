import * as RNLocalize from 'react-native-localize';

export function getDeviceLanguageTags(): string[] {
  return RNLocalize.getLocales().map(locale => locale.languageTag);
}
