import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';
import type { HostComponent, ViewProps } from 'react-native';

export interface NativeProps extends ViewProps {
  times?: ReadonlyArray<Double>;
  positions?: ReadonlyArray<Double>;
  sentAt?: Double;
  lineTop?: Double;
  lineHeight?: Double;
  lineColor?: Double;
  scrollLeft?: Double;
  scrollTop?: Double;
  clipLeft?: Double;
}

export default codegenNativeComponent<NativeProps>(
  'MoosiacWindowsPlayhead',
) as HostComponent<NativeProps>;
