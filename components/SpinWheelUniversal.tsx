import { Platform } from 'react-native';
import type { WheelItem } from '@/types';

// Use Canvas2D on web, Skia on native
const SpinWheel = Platform.OS === 'web'
  ? require('./SpinWheelWeb').default
  : require('./SpinWheel').default;

export default SpinWheel;
