import FormularioDesplazable from '../components/FormularioDesplazable';
import { obtenerToken } from '../services/tokenStorage';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

const CATEGORIAS = [
  { id: 'electricidad', nombre: 'Electricidad' },
  { id: 'plomeria', nombre: 'Plomería' },
  { id: 'climatizacion', nombre: 'Climatización' },
  { id: 'pintura', nombre: 'Pintura' },
  { id: 'reparaciones', nombre: 'Reparaciones' },
  { id: 'limpieza', nombre: 'Limpieza' },
] as const;

type Especialidad = typeof CATEGORIAS[number]['id'];

type Perfil = {
  id: string;
  nombre: string;
  ciudad: string;
  especialidades: Especialidad[];
  descripcion: string;
  experiencia_anios: number;
  colonias_cobertura: string[];
  disponible: boolean;
  portafolio: string[];
};

const COLORES = {
  fondo: '#F5F7FB',
  blanco: '#FFFFFF',
  azul: '#1765D1',
  azulClaro: '#EFF6FF',
  oscuro: '#172B4D',
  gris: '#64748B',
  borde: '#E2E8F0',
  verde: '#16805D',
  rojo: '#C62828',
};

function mostrarAviso(titulo: string, mensaje: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const datos = await respuesta.json();

    if (typeof datos.detail === 'string') {
      return datos.detail;
    }

    if (Array.isArray(datos.detail)) {
      return datos.detail
        .map((error: { msg?: string }) => error.msg || '')
        .filter(Boolean)
        .join('\n');
    }
  } catch {
    // Utilizar mensaje genérico.
  }

  return `No se pudo completar la operación (${respuesta.status}).`;
}

export default function PerfilTecnico() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [existePerfil, setExistePerfil] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([
    'electricidad',
    'plomeria',
    'climatizacion',
  ]);
  const [descripcion, setDescripcion] = useState('');
  const [experiencia, setExperiencia] = useState('0');
  const [colonias, setColonias] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [portafolio, setPortafolio] = useState<string[]>([]);
  const [error, setError] = useState('');

  const cargarPerfil = useCallback(async () => {
    const token = await obtenerToken();

    if (!token) {
      router.replace('/');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const encabezados = {
        Authorization: `Bearer ${token}`,
      };

      const respuestaUsuario = await fetch(
        `${API_URL}/auth/yo`,
        { headers: encabezados }
      );

      if (!respuestaUsuario.ok) {
        throw new Error(await leerError(respuestaUsuario));
      }

      const usuario = await respuestaUsuario.json();

      if (usuario.rol !== 'tecnico') {
        router.replace('/');
        return;
      }

      setNombre(usuario.nombre || '');
      setCiudad(usuario.ciudad || '');

      const respuesta = await fetch(
        `${API_URL}/perfiles-tecnicos/yo`,
        { headers: encabezados }
      );

      if (respuesta.status === 404) {
        setExistePerfil(false);
        return;
      }

      if (!respuesta.ok) {
        throw new Error(await leerError(respuesta));
      }

      const perfil: Perfil = await respuesta.json();

      setExistePerfil(true);
      setEspecialidades(perfil.especialidades || []);
      setDescripcion(perfil.descripcion || '');
      setExperiencia(String(perfil.experiencia_anios ?? 0));
      setColonias((perfil.colonias_cobertura || []).join(', '));
      setDisponible(perfil.disponible ?? true);
      setPortafolio(perfil.portafolio || []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar el perfil.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarPerfil();
  }, [cargarPerfil]);

  function alternarEspecialidad(valor: Especialidad) {
    setEspecialidades((actuales) =>
      actuales.includes(valor)
        ? actuales.filter((item) => item !== valor)
        : [...actuales, valor]
    );
  }

  async function guardarPerfil() {
    const token = await obtenerToken();

    if (!token) {
      router.replace('/');
      return;
    }

    if (especialidades.length === 0) {
      mostrarAviso(
        'Faltan especialidades',
        'Selecciona al menos una especialidad.'
      );
      return;
    }

    if (descripcion.trim().length < 10) {
      mostrarAviso(
        'Descripción incompleta',
        'Escribe una descripción de al menos 10 caracteres.'
      );
      return;
    }

    const anios = Number(experiencia);

    if (
      !Number.isInteger(anios) ||
      anios < 0 ||
      anios > 70
    ) {
      mostrarAviso(
        'Experiencia no válida',
        'Indica un número de años entre 0 y 70.'
      );
      return;
    }

    const listaColonias = colonias
      .split(',')
      .map((colonia) => colonia.trim())
      .filter(Boolean);

    if (
      listaColonias.length === 0 ||
      listaColonias.some((colonia) => colonia.length < 2)
    ) {
      mostrarAviso(
        'Colonias incompletas',
        'Escribe al menos una colonia válida.'
      );
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch(
        existePerfil
          ? `${API_URL}/perfiles-tecnicos/yo`
          : `${API_URL}/perfiles-tecnicos/`,
        {
          method: existePerfil ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            especialidades,
            descripcion: descripcion.trim(),
            experiencia_anios: anios,
            colonias_cobertura: listaColonias,
            disponible,
            portafolio,
          }),
        }
      );

      if (!respuesta.ok) {
        throw new Error(await leerError(respuesta));
      }

      setExistePerfil(true);

      mostrarAviso(
        'Perfil guardado',
        'Tus especialidades y datos profesionales se guardaron correctamente.'
      );

      router.replace('/panel-tecnico');
    } catch (e) {
      mostrarAviso(
        'Error al guardar',
        e instanceof Error
          ? e.message
          : 'Ocurrió un error inesperado.'
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORES.azul} />
        <Text style={styles.secundario}>
          Cargando perfil profesional...
        </Text>
      </View>
    );
  }

  return (
    <FormularioDesplazable
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
    >
      <View style={styles.encabezado}>
        <Pressable
          onPress={() => router.replace('/panel-tecnico')}
          style={styles.volver}
        >
          <Ionicons
            name="arrow-back-outline"
            size={20}
            color={COLORES.azul}
          />
          <Text style={styles.textoVolver}>
            Volver al panel
          </Text>
        </Pressable>

        <Text style={styles.marca}>PozaSync</Text>
      </View>

      <View style={styles.presentacion}>
        <Text style={styles.titulo}>
          Mi perfil profesional
        </Text>
        <Text style={styles.secundario}>
          Registra los servicios que realizas para que los
          clientes conozcan tus especialidades.
        </Text>
      </View>

      {error ? (
        <View style={styles.error}>
          <Text style={styles.textoError}>{error}</Text>
          <Pressable onPress={() => void cargarPerfil()}>
            <Text style={styles.textoVolver}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>Datos del técnico</Text>

        <Text style={styles.etiqueta}>Nombre</Text>
        <Text style={styles.valor}>{nombre}</Text>

        <Text style={styles.etiqueta}>Ciudad</Text>
        <Text style={styles.valor}>{ciudad}</Text>

        <Text style={styles.ayuda}>
          Estos datos provienen de tu cuenta de PozaSync.
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Especialidades
        </Text>

        <Text style={styles.secundario}>
          Selecciona todas las categorías en las que ofreces servicios.
        </Text>

        <View style={styles.categorias}>
          {CATEGORIAS.map((categoria) => {
            const seleccionada = especialidades.includes(
              categoria.id
            );

            return (
              <Pressable
                key={categoria.id}
                onPress={() => alternarEspecialidad(categoria.id)}
                style={[
                  styles.opcion,
                  seleccionada && styles.opcionSeleccionada,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: seleccionada }}
              >
                <Ionicons
                  name={
                    seleccionada
                      ? 'checkbox'
                      : 'square-outline'
                  }
                  size={23}
                  color={
                    seleccionada
                      ? COLORES.azul
                      : COLORES.gris
                  }
                />

                <Text style={styles.textoOpcion}>
                  {categoria.nombre}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.ayuda}>
          {especialidades.length} especialidad(es) seleccionada(s)
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.subtitulo}>
          Experiencia profesional
        </Text>

        <Text style={styles.etiqueta}>
          Describe los trabajos que realizas
        </Text>

        <TextInput
          style={[styles.campo, styles.campoGrande]}
          multiline
          textAlignVertical="top"
          value={descripcion}
          onChangeText={setDescripcion}
          maxLength={1000}
          placeholder="Ejemplo: Realizo instalaciones eléctricas, reparaciones de tuberías y mantenimiento de aires acondicionados."
          placeholderTextColor={COLORES.gris}
        />

        <Text style={styles.etiqueta}>
          Años de experiencia
        </Text>

        <TextInput
          style={styles.campo}
          keyboardType="numeric"
          value={experiencia}
          onChangeText={setExperiencia}
          placeholder="0"
        />

        <Text style={styles.etiqueta}>
          Colonias donde trabajas
        </Text>

        <TextInput
          style={styles.campo}
          value={colonias}
          onChangeText={setColonias}
          placeholder="Centro, Cazones, Chapultepec"
          placeholderTextColor={COLORES.gris}
        />

        <Text style={styles.ayuda}>
          Separa cada colonia con una coma.
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.filaDisponible}>
          <View style={styles.textoDisponible}>
            <Text style={styles.subtitulo}>
              Disponible para trabajar
            </Text>
            <Text style={styles.secundario}>
              Indica si actualmente aceptas nuevos trabajos.
            </Text>
          </View>

          <Switch
            value={disponible}
            onValueChange={setDisponible}
            trackColor={{
              false: COLORES.borde,
              true: '#90C6FF',
            }}
            thumbColor={
              disponible ? COLORES.azul : COLORES.gris
            }
          />
        </View>
      </View>

      <Pressable
        onPress={() => void guardarPerfil()}
        disabled={guardando || Boolean(error)}
        style={[
          styles.botonGuardar,
          (guardando || Boolean(error)) && styles.botonDesactivado,
        ]}
      >
        {guardando ? (
          <ActivityIndicator color={COLORES.blanco} />
        ) : (
          <Ionicons
            name="save-outline"
            size={20}
            color={COLORES.blanco}
          />
        )}

        <Text style={styles.textoGuardar}>
          {guardando
            ? 'Guardando...'
            : existePerfil
              ? 'Guardar cambios'
              : 'Crear perfil profesional'}
        </Text>
      </Pressable>
    </FormularioDesplazable>
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
    gap: 12,
  },
  encabezado: {
    backgroundColor: COLORES.blanco,
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  textoVolver: {
    color: COLORES.azul,
    fontWeight: '700',
  },
  marca: {
    color: COLORES.azul,
    fontSize: 22,
    fontWeight: '800',
  },
  presentacion: {
    gap: 7,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORES.oscuro,
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORES.oscuro,
  },
  secundario: {
    color: COLORES.gris,
    fontSize: 14,
    lineHeight: 21,
  },
  tarjeta: {
    backgroundColor: COLORES.blanco,
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    gap: 13,
  },
  etiqueta: {
    color: COLORES.oscuro,
    fontSize: 14,
    fontWeight: '700',
  },
  valor: {
    color: COLORES.gris,
    fontSize: 15,
  },
  ayuda: {
    color: COLORES.gris,
    fontSize: 12,
  },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORES.borde,
    minWidth: 175,
    flexGrow: 1,
    flexBasis: '40%',
  },
  opcionSeleccionada: {
    backgroundColor: COLORES.azulClaro,
    borderColor: COLORES.azul,
  },
  textoOpcion: {
    color: COLORES.oscuro,
    fontWeight: '600',
  },
  campo: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    padding: 13,
    color: COLORES.oscuro,
    backgroundColor: COLORES.blanco,
    fontSize: 15,
  },
  campoGrande: {
    minHeight: 115,
  },
  filaDisponible: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  textoDisponible: {
    flex: 1,
    gap: 5,
  },
  botonGuardar: {
    backgroundColor: COLORES.azul,
    padding: 17,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  botonDesactivado: {
    opacity: 0.6,
  },
  textoGuardar: {
    color: COLORES.blanco,
    fontWeight: '800',
    fontSize: 16,
  },
  error: {
    backgroundColor: '#FDECEC',
    padding: 15,
    borderRadius: 12,
    gap: 10,
  },
  textoError: {
    color: COLORES.rojo,
  },
});
