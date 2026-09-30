/**
 * The site icons the Resources screen draws, by link key.
 *
 * **Vendored, as the web app's are** — the same thirty-eight files, copied
 * from `music_app/src/assets/resource-icons`, the six that are SVG there drawn
 * to PNG so that every one is an `<Image>`. Bundled rather than fetched:
 * forty-two images pointed at forty-two other people's servers would tell
 * each of them who is reading this screen.
 *
 * A table of `require`s because Metro resolves an asset only from a literal
 * path; there is no glob to read a folder with, as Vite has on the web.
 */
import type { ImageSourcePropType } from 'react-native';

const ICONS: Record<string, ImageSourcePropType> = {
  adlPiano: require('../../assets/resource-icons/adlPiano.png'),
  amp: require('../../assets/resource-icons/amp.png'),
  archiveAudio: require('../../assets/resource-icons/archiveAudio.png'),
  archiveTrackers: require('../../assets/resource-icons/archiveTrackers.png'),
  bitmidi: require('../../assets/resource-icons/bitmidi.png'),
  classicalArchives: require('../../assets/resource-icons/classicalArchives.png'),
  freeMusicArchive: require('../../assets/resource-icons/freeMusicArchive.png'),
  freepats: require('../../assets/resource-icons/freepats.png'),
  freesound: require('../../assets/resource-icons/freesound.png'),
  generalMidi: require('../../assets/resource-icons/generalMidi.png'),
  generalUser: require('../../assets/resource-icons/generalUser.png'),
  hymnary: require('../../assets/resource-icons/hymnary.png'),
  imslp: require('../../assets/resource-icons/imslp.png'),
  kunstderfuge: require('../../assets/resource-icons/kunstderfuge.png'),
  maestro: require('../../assets/resource-icons/maestro.png'),
  mfiles: require('../../assets/resource-icons/mfiles.png'),
  midkar: require('../../assets/resource-icons/midkar.png'),
  modarchive: require('../../assets/resource-icons/modarchive.png'),
  museTrainer: require('../../assets/resource-icons/museTrainer.png'),
  musescore: require('../../assets/resource-icons/musescore.png'),
  musicXmlSpec: require('../../assets/resource-icons/musicXmlSpec.png'),
  musicxmlDirectory: require('../../assets/resource-icons/musicxmlDirectory.png'),
  musopenAudio: require('../../assets/resource-icons/musopenAudio.png'),
  musopenScores: require('../../assets/resource-icons/musopenScores.png'),
  mutopia: require('../../assets/resource-icons/mutopia.png'),
  openGoldberg: require('../../assets/resource-icons/openGoldberg.png'),
  openMpt: require('../../assets/resource-icons/openMpt.png'),
  openscore: require('../../assets/resource-icons/openscore.png'),
  pdmx: require('../../assets/resource-icons/pdmx.png'),
  philharmonia: require('../../assets/resource-icons/philharmonia.png'),
  polyphone: require('../../assets/resource-icons/polyphone.png'),
  sceneOrg: require('../../assets/resource-icons/sceneOrg.png'),
  standardMidiFile: require('../../assets/resource-icons/standardMidiFile.png'),
  theSession: require('../../assets/resource-icons/theSession.png'),
  verovio: require('../../assets/resource-icons/verovio.png'),
  vgmusic: require('../../assets/resource-icons/vgmusic.png'),
  womenComposers: require('../../assets/resource-icons/womenComposers.png'),
  woolyss: require('../../assets/resource-icons/woolyss.png'),
};

/** The site's own icon, or `undefined` when it publishes none. */
export function iconFor(key: string): ImageSourcePropType | undefined {
  return ICONS[key];
}
