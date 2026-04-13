import { Platform, ScrollView } from 'react-native';
import type { ScrollViewProps } from 'react-native';

// On web the browser natively handles keyboard avoidance
// On native we use the library
let KeyboardScrollViewComponent: React.ComponentType<any>;

if (Platform.OS === 'web') {
  KeyboardScrollViewComponent = ScrollView;
} else {
  KeyboardScrollViewComponent = require('react-native-keyboard-aware-scroll-view').KeyboardAwareScrollView;
}

export default function KeyboardScrollView(props: ScrollViewProps & {
  enableOnAndroid?: boolean;
  enableAutomaticScroll?: boolean;
  extraScrollHeight?: number;
  keyboardOpeningTime?: number;
}) {
  const { enableOnAndroid, enableAutomaticScroll, extraScrollHeight, keyboardOpeningTime, ...rest } = props;
  return <KeyboardScrollViewComponent {...(Platform.OS !== 'web' ? { enableOnAndroid, enableAutomaticScroll, extraScrollHeight, keyboardOpeningTime } : {})} {...rest} />;
}
