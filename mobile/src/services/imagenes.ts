
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

const MAX_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export async function adjuntarImagen(
  formulario: FormData,
  uri: string,
  nombre: string,
  tipo: string
): Promise<void> {
  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    throw new Error(
      'Formato de fotografía no permitido.'
    );
  }

  if (Platform.OS === 'web') {
    const respuesta = await fetch(uri);

    if (!respuesta.ok) {
      throw new Error(
        'No se pudo leer la fotografía.'
      );
    }

    const archivo = await respuesta.blob();

    if (archivo.size > MAX_BYTES) {
      throw new Error(
        'La fotografía no puede superar los 5 MB.'
      );
    }

    const blob = new Blob([archivo], {
      type: tipo,
    });

    formulario.append('archivo', blob, nombre);
    return;
  }

  const archivo = new File(uri);

  if (!archivo.exists) {
    throw new Error(
      'No se encontró la fotografía seleccionada.'
    );
  }

  if (archivo.size <= 0) {
    throw new Error(
      'La fotografía está vacía.'
    );
  }

  if (archivo.size > MAX_BYTES) {
    throw new Error(
      'La fotografía no puede superar los 5 MB.'
    );
  }

  formulario.append(
    'archivo',
    archivo,
    nombre
  );
}

export async function enviarFormularioImagen(
  url: string,
  formulario: FormData,
  token: string
) {
  const opciones = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formulario,
  };

  if (Platform.OS === 'web') {
    return fetch(url, opciones);
  }

  return expoFetch(url, opciones);
}
