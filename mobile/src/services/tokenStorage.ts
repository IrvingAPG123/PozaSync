import { Platform } from 'react-native';

const CLAVE_TOKEN = 'pozasync_token';

// La importación diferida evita cargar código nativo en la versión web.
export async function guardarToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('Almacenamiento web no disponible.');
    window.sessionStorage.setItem(CLAVE_TOKEN, token);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function obtenerToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(CLAVE_TOKEN);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function borrarToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(CLAVE_TOKEN);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
