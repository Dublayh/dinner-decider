import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import React from 'react';
import { useFonts } from 'expo-font';
import { ThemeProvider } from '@/context/ThemeContext';

// Deep requires (not the package barrel) so only the weights we actually use
// are bundled into the web export — the barrel pulls in all ~36 TTFs.
const FONTS = {
  Fraunces_400Regular: require('@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf'),
  Fraunces_400Regular_Italic: require('@expo-google-fonts/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf'),
  Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
  Fraunces_600SemiBold_Italic: require('@expo-google-fonts/fraunces/600SemiBold_Italic/Fraunces_600SemiBold_Italic.ttf'),
  Fraunces_700Bold: require('@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf'),
  Fraunces_900Black: require('@expo-google-fonts/fraunces/900Black/Fraunces_900Black.ttf'),
  Fraunces_900Black_Italic: require('@expo-google-fonts/fraunces/900Black_Italic/Fraunces_900Black_Italic.ttf'),
  SpaceMono_400Regular: require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf'),
  SpaceMono_700Bold: require('@expo-google-fonts/space-mono/700Bold/SpaceMono_700Bold.ttf'),
};

// Remove browser focus outlines on web + selection colour to match the ink
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Read the saved theme synchronously so the page background is painted in the
  // right paper colour before first render — no flash of light before a saved
  // dark theme loads. (Kept in sync with ThemeContext / constants/theme.ts.)
  let initialBg = '#F4ECDD';
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme') === 'dark') {
      initialBg = '#171009';
    }
  } catch {}

  const style = document.createElement('style');
  style.textContent = `
    input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }
    ::selection { background: #BC5B27; color: #F9F2E2; }
    html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    /* Paper background behind the app + no rubber-band chaining, so overscroll
       on the PWA never flashes white. ThemeContext recolors this on toggle. */
    html, body { background-color: ${initialBg}; overscroll-behavior: none; }
  `;
  document.head.appendChild(style);
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#12100D' }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#E05252', marginBottom: 12 }}>
            Crash caught
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'monospace', color: '#F5EDD8' }}>
            {(this.state.error as Error).message}
          </Text>
          <Text style={{ fontSize: 11, color: '#888', marginTop: 12 }}>
            {(this.state.error as Error).stack}
          </Text>
          <Pressable
            style={{ marginTop: 24, padding: 12, backgroundColor: '#D4822F', borderRadius: 8 }}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  // Hold the (blank) frame until type is ready; if loading fails, ship system fonts.
  if (!fontsLoaded && !fontError) {
    return <View style={[styles.root, { backgroundColor: '#F4ECDD' }]} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
