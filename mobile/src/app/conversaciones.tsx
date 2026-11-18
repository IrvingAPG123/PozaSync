
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useFocusEffect,
} from 'expo-router';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

type Conversacion = {
  id: string;
  titulo_solicitud: string;
  categoria_solicitud: string;
  ultimo_mensaje: string | null;
  fecha_actualizacion: string | null;
  mensajes_sin_leer?: number;
  otro_participante: {
    nombre: string;
    foto_perfil: string | null;
  };
};

type RespuestaConversaciones = {
  total: number;
  conversaciones: Conversacion[];
};

const C = {
  azul: '#1765D1',
  fondo: '#F5F7FB',
  blanco: '#FFFFFF',
  oscuro: '#172B4D',
  gris: '#64748B',
  borde: '#E2E8F0',
  rojo: '#C62828',
};

function obtenerToken(): string | null {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined'
  ) {
    return null;
  }

  return window.sessionStorage.getItem(
    'pozasync_token'
  );
}

async function leerError(
  respuesta: Response
): Promise<string> {
  try {
    const datos = await respuesta.json();

    if (typeof datos.detail === 'string') {
      return datos.detail;
    }
  } catch {
    // Mostrar error general.
  }

  return `Error del servidor (${respuesta.status}).`;
}

function formatearFecha(
  fecha: string | null
): string {
  if (!fecha) {
    return '';
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return '';
  }

  return valor.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
}

export default function Conversaciones() {
  const [
    conversaciones,
    setConversaciones,
  ] = useState<Conversacion[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [actualizando, setActualizando] =
    useState(false);

  const [error, setError] =
    useState('');

  const cargarConversaciones = useCallback(
    async (recarga = false) => {
      const token = obtenerToken();

      if (!token) {
        router.replace('/');
        return;
      }

      if (recarga) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      try {
        const respuesta = await fetch(
          `${API_URL}/conversaciones`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!respuesta.ok) {
          throw new Error(
            await leerError(respuesta)
          );
        }

        const datos: RespuestaConversaciones =
          await respuesta.json();

        if (
          !Array.isArray(
            datos.conversaciones
          )
        ) {
          throw new Error(
            'El servidor devolvió datos inválidos.'
          );
        }

        setConversaciones(
          datos.conversaciones
        );

        setError('');
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar las conversaciones.'
        );
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void cargarConversaciones();

      return () => {
        // Limpieza al salir de la pantalla.
      };
    }, [cargarConversaciones])
  );

  const totalPendientes =
    conversaciones.reduce(
      (total, conversacion) =>
        total +
        Math.max(
          0,
          conversacion.mensajes_sin_leer ?? 0
        ),
      0
    );

  function abrirConversacion(
    conversacionId: string
  ) {
    router.push({
      pathname: '/chat',
      params: {
        conversacionId,
      },
    });
  }

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={
        styles.contenido
      }
    >
      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <Pressable
          style={styles.botonIcono}
          onPress={() => router.back()}
          accessibilityLabel="Regresar"
        >
          <Ionicons
            name="arrow-back-outline"
            size={23}
            color={C.azul}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>
            Mis conversaciones
          </Text>

          <Text style={styles.secundario}>
            Mensajes privados de PozaSync
          </Text>

          {totalPendientes > 0 && (
            <Text style={styles.resumenPendientes}>
              {totalPendientes}{' '}
              {totalPendientes === 1
                ? 'mensaje pendiente'
                : 'mensajes pendientes'}
            </Text>
          )}
        </View>

        <Pressable
          style={styles.botonIcono}
          disabled={actualizando}
          onPress={() =>
            void cargarConversaciones(true)
          }
          accessibilityLabel="Actualizar conversaciones"
        >
          {actualizando ? (
            <ActivityIndicator
              size="small"
              color={C.azul}
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={22}
              color={C.azul}
            />
          )}
        </Pressable>
      </View>

      {/* CARGANDO */}

      {cargando && (
        <View style={styles.vacio}>
          <ActivityIndicator
            size="large"
            color={C.azul}
          />

          <Text style={styles.secundario}>
            Cargando conversaciones...
          </Text>
        </View>
      )}

      {/* ERROR */}

      {!cargando && !!error && (
        <View style={styles.avisoError}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={C.rojo}
          />

          <Text style={styles.textoError}>
            {error}
          </Text>
        </View>
      )}

      {/* SIN CONVERSACIONES */}

      {!cargando &&
        !error &&
        conversaciones.length === 0 && (
          <View style={styles.vacio}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={C.gris}
            />

            <Text style={styles.tituloVacio}>
              Aún no tienes conversaciones
            </Text>

            <Text
              style={styles.secundarioCentrado}
            >
              Cuando un técnico contacte al
              cliente desde una solicitud,
              la conversación aparecerá aquí.
            </Text>
          </View>
        )}

      {/* LISTA DE CONVERSACIONES */}

      {!cargando &&
        !error &&
        conversaciones.map(
          (conversacion) => {
            const pendientes = Math.max(
              0,
              conversacion.mensajes_sin_leer ?? 0
            );

            const tienePendientes =
              pendientes > 0;

            return (
              <Pressable
                key={conversacion.id}
                style={[
                  styles.tarjeta,
                  tienePendientes &&
                    styles.tarjetaPendiente,
                ]}
                onPress={() =>
                  abrirConversacion(
                    conversacion.id
                  )
                }
                accessibilityRole="button"
              >
                {/* AVATAR */}

                <View style={styles.avatar}>
                  <Ionicons
                    name="person-outline"
                    size={26}
                    color={C.azul}
                  />
                </View>

                {/* INFORMACION */}

                <View style={styles.datos}>
                  <View
                    style={styles.filaSuperior}
                  >
                    <Text
                      style={[
                        styles.nombre,
                        tienePendientes &&
                          styles.nombrePendiente,
                      ]}
                      numberOfLines={1}
                    >
                      {conversacion
                        .otro_participante
                        ?.nombre ||
                        'Usuario de PozaSync'}
                    </Text>

                    <Text
                      style={styles.fecha}
                    >
                      {formatearFecha(
                        conversacion
                          .fecha_actualizacion
                      )}
                    </Text>
                  </View>

                  <Text
                    style={styles.solicitud}
                    numberOfLines={1}
                  >
                    {
                      conversacion
                        .titulo_solicitud
                    }
                  </Text>

                  <Text
                    style={[
                      styles.secundario,
                      tienePendientes &&
                        styles.mensajePendiente,
                    ]}
                    numberOfLines={2}
                  >
                    {conversacion
                      .ultimo_mensaje ||
                      'Conversación iniciada. Envía un mensaje.'}
                  </Text>
                </View>

                {/* CONTADOR */}

                {tienePendientes ? (
                  <View
                    style={styles.contador}
                  >
                    <Text
                      style={
                        styles.textoContador
                      }
                    >
                      {pendientes > 99
                        ? '99+'
                        : pendientes}
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward-outline"
                    size={20}
                    color={C.gris}
                  />
                )}
              </Pressable>
            );
          }
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: C.fondo,
  },

  contenido: {
    width: '100%',
    maxWidth: 950,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 50,
    gap: 15,
  },

  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    backgroundColor: C.blanco,
    borderRadius: 14,
    marginBottom: 8,
  },

  botonIcono: {
    padding: 8,
  },

  titulo: {
    color: C.oscuro,
    fontSize: 23,
    fontWeight: '800',
  },

  secundario: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 20,
  },

  secundarioCentrado: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  resumenPendientes: {
    color: C.rojo,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },

  vacio: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    padding: 45,
    backgroundColor: C.blanco,
    borderRadius: 14,
  },

  tituloVacio: {
    color: C.oscuro,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
    padding: 17,
  },

  tarjetaPendiente: {
    borderColor: '#B9D2FF',
    backgroundColor: '#F8FBFF',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  datos: {
    flex: 1,
    gap: 5,
  },

  filaSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  nombre: {
    flex: 1,
    color: C.oscuro,
    fontSize: 16,
    fontWeight: '800',
  },

  nombrePendiente: {
    color: C.azul,
  },

  fecha: {
    color: C.gris,
    fontSize: 12,
  },

  solicitud: {
    color: C.azul,
    fontSize: 13,
    fontWeight: '700',
  },

  mensajePendiente: {
    color: C.oscuro,
    fontWeight: '700',
  },

  contador: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.rojo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  textoContador: {
    color: C.blanco,
    fontSize: 11,
    fontWeight: '800',
  },

  avisoError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    padding: 15,
  },

  textoError: {
    color: C.rojo,
    flex: 1,
  },
});
