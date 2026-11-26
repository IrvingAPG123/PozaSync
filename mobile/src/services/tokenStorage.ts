import { API_URL } from '../config/api';

import { Platform } from 'react-native';

const CLAVE_TOKEN = 'pozasync_token';
const CLAVE_SESION = 'pozasync_sesion_v2';



const DURACION_ACCESO = 55 * 60 * 1000;

type Sesion = {
  access_token: string;
  refresh_token: string;
  renovar_en: number;
};

let cola: Promise<unknown> = Promise.resolve();

function ejecutar<T>(
  operacion: () => Promise<T>
): Promise<T> {
  const resultado = cola.then(operacion);

  cola = resultado.then(
    () => undefined,
    () => undefined
  );

  return resultado;
}

async function guardar(
  clave: string,
  valor: string
): Promise<void> {
  if (Platform.OS === 'web') {
    window.sessionStorage.setItem(clave, valor);
    return;
  }

  const SecureStore = await import('expo-secure-store');

  await SecureStore.setItemAsync(clave, valor);
}

async function leer(
  clave: string
): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.sessionStorage.getItem(clave);
  }

  const SecureStore = await import('expo-secure-store');

  return SecureStore.getItemAsync(clave);
}

async function eliminar(
  clave: string
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(clave);
    }

    return;
  }

  const SecureStore = await import('expo-secure-store');

  await SecureStore.deleteItemAsync(clave);
}

async function leerSesion(): Promise<Sesion | null> {
  const valor = await leer(CLAVE_SESION);

  if (!valor) {
    return null;
  }

  try {
    const sesion = JSON.parse(valor);

    if (
      typeof sesion.access_token !== 'string' ||
      typeof sesion.refresh_token !== 'string' ||
      typeof sesion.renovar_en !== 'number' ||
      !Number.isFinite(sesion.renovar_en)
    ) {
      return null;
    }

    return sesion;
  } catch {
    return null;
  }
}

async function guardarSesion(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  if (!accessToken || !refreshToken) {
    throw new Error('Sesión inválida.');
  }

  const sesion: Sesion = {
    access_token: accessToken,
    refresh_token: refreshToken,
    renovar_en: Date.now() + DURACION_ACCESO,
  };

  await guardar(
    CLAVE_SESION,
    JSON.stringify(sesion)
  );

  await eliminar(CLAVE_TOKEN);
}

async function limpiarSesion(): Promise<void> {
  await eliminar(CLAVE_SESION);
  await eliminar(CLAVE_TOKEN);
}

async function solicitar(
  ruta: string,
  refreshToken: string
): Promise<Response> {
  const controlador = new AbortController();

  const temporizador = setTimeout(
    () => controlador.abort(),
    90000
  );

  try {
    return await fetch(`${API_URL}${ruta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
      signal: controlador.signal,
    });
  } finally {
    clearTimeout(temporizador);
  }
}

export async function guardarToken(
  token: string,
  refreshToken?: string
): Promise<void> {
  return ejecutar(async () => {
    if (refreshToken) {
      await guardarSesion(token, refreshToken);
      return;
    }

    await eliminar(CLAVE_SESION);
    await guardar(CLAVE_TOKEN, token);
  });
}

export async function obtenerToken(
  forzarRenovacion = false
): Promise<string | null> {
  return ejecutar(async () => {
    const sesion = await leerSesion();

    if (!sesion) {
      if (forzarRenovacion) {
        await limpiarSesion();
        return null;
      }

      return leer(CLAVE_TOKEN);
    }

    if (
      !forzarRenovacion &&
      Date.now() < sesion.renovar_en
    ) {
      return sesion.access_token;
    }

    const respuesta = await solicitar(
      '/auth/renovar',
      sesion.refresh_token
    );

    if (
      respuesta.status === 401 ||
      respuesta.status === 403
    ) {
      await limpiarSesion();
      return null;
    }

    if (!respuesta.ok) {
      throw new Error(
        'No fue posible renovar la sesión. Inténtalo nuevamente.'
      );
    }

    const datos = await respuesta.json();

    if (
      typeof datos.access_token !== 'string' ||
      typeof datos.refresh_token !== 'string'
    ) {
      throw new Error(
        'El servidor devolvió una sesión inválida.'
      );
    }

    await guardarSesion(
      datos.access_token,
      datos.refresh_token
    );

    return datos.access_token;
  });
}

export async function borrarToken(): Promise<void> {
  return ejecutar(async () => {
    const sesion = await leerSesion();

    try {
      if (sesion) {
        const respuesta = await solicitar(
          '/auth/logout',
          sesion.refresh_token
        );

        if (
          !respuesta.ok &&
          respuesta.status !== 401 &&
          respuesta.status !== 403
        ) {
          throw new Error(
            'No se pudo revocar la sesión en el servidor.'
          );
        }
      }
    } finally {
      await limpiarSesion();
    }
  });
}
