import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts,
} from '@expo-google-fonts/inter';
// Inter has no Devanagari glyphs — without this, Hindi renders as tofu boxes.
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GameProvider } from '@/context/GameContext';
import { ThemeProvider } from '@/theme/useTheme';
import { installScriptAwareText } from '@/components/ScriptAwareText';

// Substitute Noto Sans Devanagari wherever Hindi text appears, since Inter has
// no Devanagari glyphs. Installed before first render.
installScriptAwareText();
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="board-select" />
      <Stack.Screen name="class-select" />
      <Stack.Screen name="category-select" />
      <Stack.Screen name="difficulty-select" />
      <Stack.Screen name="game" />
      <Stack.Screen name="results" />
      <Stack.Screen name="mistake-review" />
      <Stack.Screen name="tables-mode" />
      <Stack.Screen name="progress" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    NotoSansDevanagari_400Regular, NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold, NotoSansDevanagari_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <GameProvider>
                <StatusBar style="auto" />
                <RootLayoutNav />
              </GameProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
