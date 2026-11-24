import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type ResultadoUbicacion = {
  colonia: string | null;
  ciudad: string | null;
  precision: number | null;
  sugerencias: string[];
};

function conTiempoLimite<T>(
  promesa: Promise<T>,
  milisegundos: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => {
      reject(
        new Error(
          'No pudimos obtener tu ubicación a tiempo.'
        )
      );
    }, milisegundos);

    promesa.then(
      (resultado) => {
        clearTimeout(temporizador);
        resolve(resultado);
      },
      (error) => {
        clearTimeout(temporizador);
        reject(error);
      }
    );
  });
}

function limpiarNombre(
  valor: string | null | undefined
): string {
  return (valor || '')
    .trim()
    .replace(/^colonia\s+/i, '');
}

export async function obtenerUbicacion():
  Promise<ResultadoUbicacion> {

  if (Platform.OS === 'web') {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      throw new Error(
        'No podemos acceder a tu ubicación.'
      );
    }

    const posicion =
      await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        }
      );

    // La web conserva el GPS, pero requiere un
    // servicio de geocodificación para identificar
    // nombres de colonias.

    return {
      colonia: null,
      ciudad: null,
      precision: posicion.coords.accuracy,
      sugerencias: [],
    };
  }

  const permiso =
    await Location.requestForegroundPermissionsAsync();

  if (permiso.status !== 'granted') {
    throw new Error(
      'No concediste permiso de ubicación.'
    );
  }

  const gpsActivo =
    await Location.hasServicesEnabledAsync();

  if (!gpsActivo) {
    throw new Error(
      'Activa la ubicación de tu dispositivo.'
    );
  }

  const posicion = await conTiempoLimite(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }),
    15000
  );

  const direcciones = await conTiempoLimite(
    Location.reverseGeocodeAsync({
      latitude: posicion.coords.latitude,
      longitude: posicion.coords.longitude,
    }),
    10000
  );

  const sugerencias = Array.from(
    new Set(
      direcciones
        .map((direccion) =>
          limpiarNombre(direccion.district)
        )
        .filter(Boolean)
    )
  );

  const direccion = direcciones[0];

  return {
    colonia: sugerencias[0] || null,
    ciudad: direccion?.city || null,
    precision: posicion.coords.accuracy,
    sugerencias,
  };
}