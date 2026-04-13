import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';

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
