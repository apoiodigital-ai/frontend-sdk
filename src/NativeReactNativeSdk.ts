import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface CapturedElementNative {
  viewId: string;
  className: string;
  text: string;
  isSecure: boolean;
  isInteractive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Spec extends TurboModule {
  captureViewHierarchy(): Promise<CapturedElementNative[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeSdk');
