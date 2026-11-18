
import React, { useCallback, useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

const COLORES = {
  fondo: '#F5F7FB',
  blanco: '#FFFFFF',
  azul: '#1765D1',
  azulClaro: '#EFF6FF',
  oscuro: '#172B4D',
  gris: '#64748B',
  borde: '#E2E8F0',
  amarillo: '#F5B301',
  verde: '#16805D',
  rojo: '#C62828',
};

type PerfilPublico = {
  id: string;
  usuario_id: string;
  nombre: string;
  ciudad: string;
  especialidades: string[];
  descripcion: string;
  experiencia_anios: number;
  colonias_cobertura: string[];
  disponible: boolean;
  portafolio: string[];
  calificacion_promedio: number;
  total_resenas: number;
};

type Resena = {
  id: string;
  servicio_id: string;
  cliente_id: string;
  tecnico_id: string;
  calificacion: number;
  comentario: string;
  fecha_creacion: string | null;
};

type RespuestaResenas = {
  tecnico_id: string;
  nombre: string;
  calificacion_promedio: number;
  total_resenas: number;
  resenas: Resena[];
};

const NOMBRES_CATEGORIAS: Record<string, string> = {
  electricidad: 'Electricidad',
  plomeria: 'Plomería',
  climatizacion: 'Climatización',
  pintura: 'Pintura',
  reparaciones: 'Reparaciones',
  limpieza: 'Limpieza',
};

function nombreCategoria(valor: string): string {
  return NOMBRES_CATEGORIAS[valor] || valor;
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Fecha no disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const datos = await respuesta.json();

    if (typeof datos.detail === 'string') {
      return datos.detail;
    }
  } catch {
    // Se muestra un mensaje genérico.
  }

  return `Error al consultar la información (${respuesta.status}).`;
}

function Estrellas({
  calificacion,
  tamano = 20,
}: {
  calificacion: number;
  tamano?: number;
}) {
  const valor = Number.isFinite(calificacion)
    ? Math.max(0, Math.min(5, calificacion))
    : 0;

  return (
    <View style={styles.estrellas}>
      {[1, 2, 3, 4, 5].map((numero) => (
        <Ionicons
          key={numero}
          name={
            valor >= numero
              ? 'star'
              : valor >= numero - 0.5
                ? 'star-half'
                : 'star-outline'
          }
          size={tamano}
          color={COLORES.amarillo}
        />
      ))}
    </View>
  );
}

export default function VerTecnico() {
  const parametros = useLocalSearchParams<{
    tecnicoId?: string | string[];
  }>();

  const tecnicoId = Array.isArray(parametros.tecnicoId)
    ? parametros.tecnicoId[0]
    : parametros.tecnicoId;

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [datosResenas, setDatosResenas] =
    useState<RespuestaResenas | null>(null);

  const cargarInformacion = useCallback(async () => {
    setCargando(true);
    setError('');
    setPerfil(null);
    setDatosResenas(null);

    if (!tecnicoId) {
      setError('No se proporcionó el identificador del técnico.');
      setCargando(false);
      return;
    }

    try {
      const [respuestaPerfiles, respuestaResenas] =
        await Promise.all([
          fetch(`${API_URL}/perfiles-tecnicos/`),
          fetch(
            `${API_URL}/resenas/tecnico/${encodeURIComponent(
              tecnicoId
            )}`
          ),
        ]);

      if (!respuestaPerfiles.ok) {
        throw new Error(await leerError(respuestaPerfiles));
      }

      if (!respuestaResenas.ok) {
        throw new Error(await leerError(respuestaResenas));
      }

      const perfiles: PerfilPublico[] =
        await respuestaPerfiles.json();

      const resenas: RespuestaResenas =
        await respuestaResenas.json();

      const perfilEncontrado = perfiles.find(
        (item) => item.usuario_id === tecnicoId
      );

      if (!perfilEncontrado) {
        throw new Error(
          'No se encontró el perfil público de este técnico.'
        );
      }

      setPerfil(perfilEncontrado);
      setDatosResenas(resenas);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar la información del técnico.'
      );
    } finally {
      setCargando(false);
    }
  }, [tecnicoId]);

  useEffect(() => {
    void cargarInformacion();
  }, [cargarInformacion]);

  function volver() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color={COLORES.azul}
        />
        <Text style={styles.secundario}>
          Cargando perfil del técnico...
        </Text>
      </View>
    );
  }

  if (error || !perfil || !datosResenas) {
    return (
      <View style={styles.centrado}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORES.rojo}
        />

        <Text style={styles.textoError}>
          {error || 'No se encontró el perfil.'}
        </Text>

        <Pressable
          style={styles.boton}
          onPress={() => void cargarInformacion()}
        >
          <Text style={styles.textoBoton}>
            Reintentar
          </Text>
        </Pressable>

        <Pressable onPress={volver}>
          <Text style={styles.enlace}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const promedio = Number(
    datosResenas.calificacion_promedio || 0
  );

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
    >
      <View style={styles.encabezado}>
        <Pressable
          onPress={volver}
          style={styles.volver}
        >
          <Ionicons
            name="arrow-back-outline"
            size={21}
            color={COLORES.azul}
          />
          <Text style={styles.enlace}>Volver</Text>
        </Pressable>

        <Text style={styles.marca}>PozaSync</Text>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.presentacion}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={42}
              color={COLORES.azul}
            />
          </View>

          <View style={styles.informacionPrincipal}>
            <Text style={styles.nombre}>
              {perfil.nombre}
            </Text>

            <View style={styles.fila}>
              <Ionicons
                name="location-outline"
                size={17}
                color={COLORES.gris}
              />
              <Text style={styles.secundario}>
                {perfil.ciudad}
              </Text>
            </View>

            <View style={styles.fila}>
              <Ionicons
                name="briefcase-outline"
                size={17}
                color={COLORES.gris}
              />
              <Text style={styles.secundario}>
                {perfil.experiencia_anios} año(s) de experiencia
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.estado,
            {
              backgroundColor: perfil.disponible
                ? '#E7F7EF'
                : '#F1F5F9',
            },
          ]}
        >
          <Ionicons
            name={
              perfil.disponible
                ? 'checkmark-circle'
                : 'time-outline'
            }
            size={18}
            color={
              perfil.disponible
                ? COLORES.verde
                : COLORES.gris
            }
          />

          <Text
            style={{
              color: perfil.disponible
                ? COLORES.verde
                : COLORES.gris,
              fontWeight: '700',
            }}
          >
            {perfil.disponible
              ? 'Disponible para trabajar'
              : 'No disponible actualmente'}
          </Text>
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Calificaciones de clientes
        </Text>

        <View style={styles.resumenCalificacion}>
          <Text style={styles.numeroPromedio}>
            {promedio.toFixed(1)}
          </Text>

          <View style={styles.detalleCalificacion}>
            <Estrellas
              calificacion={promedio}
              tamano={25}
            />

            <Text style={styles.secundario}>
              {datosResenas.total_resenas}{' '}
              {datosResenas.total_resenas === 1
                ? 'reseña recibida'
                : 'reseñas recibidas'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Acerca del técnico
        </Text>

        <Text style={styles.descripcion}>
          {perfil.descripcion ||
            'Este técnico todavía no ha agregado una descripción.'}
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Especialidades
        </Text>

        <View style={styles.etiquetas}>
          {perfil.especialidades.map((especialidad) => (
            <View
              key={especialidad}
              style={styles.etiqueta}
            >
              <Text style={styles.textoEtiqueta}>
                {nombreCategoria(especialidad)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Zonas de cobertura
        </Text>

        {perfil.colonias_cobertura.length > 0 ? (
          perfil.colonias_cobertura.map((colonia, indice) => (
            <View
              key={`${colonia}-${indice}`}
              style={styles.fila}
            >
              <Ionicons
                name="location-outline"
                size={17}
                color={COLORES.azul}
              />

              <Text style={styles.descripcion}>
                {colonia}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.secundario}>
            No hay zonas de cobertura registradas.
          </Text>
        )}
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Opiniones de clientes
        </Text>

        {datosResenas.resenas.length === 0 ? (
          <View style={styles.sinResenas}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={35}
              color={COLORES.gris}
            />

            <Text style={styles.secundario}>
              Este técnico todavía no tiene reseñas.
            </Text>
          </View>
        ) : (
          datosResenas.resenas.map((resena) => (
            <View
              key={resena.id}
              style={styles.tarjetaResena}
            >
              <View style={styles.encabezadoResena}>
                <Estrellas
                  calificacion={resena.calificacion}
                  tamano={19}
                />

                <Text style={styles.fecha}>
                  {formatearFecha(resena.fecha_creacion)}
                </Text>
              </View>

              <Text style={styles.descripcion}>
                {resena.comentario?.trim() ||
                  'El cliente no agregó un comentario.'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenido: {
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
    gap: 18,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: COLORES.fondo,
  },
  encabezado: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  enlace: {
    color: COLORES.azul,
    fontWeight: '700',
    fontSize: 15,
  },
  marca: {
    color: COLORES.azul,
    fontSize: 22,
    fontWeight: '800',
  },
  tarjeta: {
    backgroundColor: COLORES.blanco,
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    gap: 15,
  },
  presentacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 85,
    height: 85,
    borderRadius: 43,
    backgroundColor: COLORES.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  informacionPrincipal: {
    flex: 1,
    minWidth: 180,
    gap: 9,
  },
  nombre: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORES.oscuro,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  secundario: {
    color: COLORES.gris,
    fontSize: 14,
    lineHeight: 21,
  },
  subtitulo: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORES.oscuro,
  },
  estado: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 7,
  },
  resumenCalificacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  numeroPromedio: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORES.oscuro,
  },
  detalleCalificacion: {
    gap: 8,
  },
  estrellas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  descripcion: {
    color: COLORES.oscuro,
    fontSize: 15,
    lineHeight: 23,
    flexShrink: 1,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  etiqueta: {
    backgroundColor: COLORES.azulClaro,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  textoEtiqueta: {
    color: COLORES.azul,
    fontWeight: '700',
    fontSize: 13,
  },
  sinResenas: {
    alignItems: 'center',
    paddingVertical: 25,
    gap: 12,
  },
  tarjetaResena: {
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    paddingTop: 17,
    gap: 12,
  },
  encabezadoResena: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  fecha: {
    color: COLORES.gris,
    fontSize: 12,
  },
  textoError: {
    color: COLORES.rojo,
    textAlign: 'center',
    fontSize: 15,
  },
  boton: {
    backgroundColor: COLORES.azul,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
  },
  textoBoton: {
    color: COLORES.blanco,
    fontWeight: '700',
  },
});
