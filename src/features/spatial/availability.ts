import { Platform } from 'react-native';

// SpatialView renders through Skia, which has no native Windows target here.
export const supportsSpatialView = Platform.OS !== 'windows';
