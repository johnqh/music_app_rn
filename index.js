// Configure the Firebase China proxy before anything initializes Firebase.
// Blank/unset means standard Firebase (the library holds no default).
// NOTE: covers the Firebase JS SDK only — @react-native-firebase native
// modules still reach Google directly.
import { setFirebaseProxy } from '@sudobility/di';
setFirebaseProxy(process.env.EXPO_PUBLIC_FIREBASE_PROXY);

import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
