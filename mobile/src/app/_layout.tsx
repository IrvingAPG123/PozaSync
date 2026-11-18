
import {
  Stack,
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <AnimatedSplashOverlay />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {/* Autenticación */}
        <Stack.Screen name="index" />

        <Stack.Screen name="registro" />

        <Stack.Screen name="verificar-correo" />

        {/* Panel del cliente */}
        <Stack.Screen name="panel-cliente" />

        {/* Panel del técnico */}
        <Stack.Screen name="panel-tecnico" />
      </Stack>
    </ThemeProvider>
  );
}
