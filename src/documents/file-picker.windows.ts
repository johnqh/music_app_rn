/** Windows uses the native Win32 open/save dialogs. */
import { NativeModules } from 'react-native';
import type { FilePicker } from './file-picker';

const { MoosiacFilePicker } = NativeModules;

export function createFilePicker(): FilePicker {
  return {
    isSupported: () => MoosiacFilePicker != null,
    pickFile: extensions => {
      if (!MoosiacFilePicker) return Promise.resolve(null);
      return MoosiacFilePicker.pickFile([...extensions]);
    },
    pickSaveLocation: suggestedName => {
      if (!MoosiacFilePicker) return Promise.resolve(null);
      return MoosiacFilePicker.pickSaveLocation(suggestedName);
    },
  };
}
