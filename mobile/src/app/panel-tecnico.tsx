import { obtenerToken, borrarToken } from '../services/tokenStorage';

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';


type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: 'cliente' | 'tecnico' | 'admin';
};

type ClientePublico = {
  nombre: string;
  foto_perfil: string | null;
};

type ImagenSolicitud = {
  url?: string;
  secure_url?: string;
};

type Solicitud = {
  id: string;
  categoria: string;
  categoria_id?: string | null;
  titulo: string;
  descripcion: string;
  colonia: string;
  ciudad: string;
  estado: string;
  imagenes: ImagenSolicitud[];
  fecha_publicacion: string | null;
  cliente?: ClientePublico;
};

type RespuestaSolicitudes = {
  total: number;
  solicitudes: Solicitud[];
};

type PerfilProfesional = {
  id: string;
  especialidades: string[];
  disponible: boolean;
};

type RespuestaConversacion = {
  mensaje: string;
  conversacion: {
    id: string;
    solicitud_id: string;
    cliente_id: string;
    tecnico_id: string;
  };
};

type RespuestaNotificaciones = {
  mensajes_sin_leer: number;
  conversaciones_con_pendientes: number;
};

type FiltroTrabajos = 'recomendados' | 'todos';

const NOMBRES_CATEGORIAS: Record<string, string> = {
  electricidad: 'Electricidad',
  plomeria: 'Plomería',
  climatizacion: 'Climatización',
  pintura: 'Pintura',
  reparaciones: 'Reparaciones',
  limpieza: 'Limpieza',
};

const C = {
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

function obtenerMensajeError(datos: unknown): string {
  if (
    datos &&
    typeof datos === 'object' &&
    'detail' in datos
  ) {
    const detalle = (datos as { detail?: unknown }).detail;

    if (typeof detalle === 'string') {
      return detalle;
    }
  }

  return 'No se pudo completar la solicitud.';
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    return obtenerMensajeError(await respuesta.json());
  } catch {
    return `Error del servidor (${respuesta.status}).`;
  }
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Fecha no disponible';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function normalizarCategoria(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obtenerCategoriaSolicitud(
  solicitud: Solicitud
): string {
  return normalizarCategoria(
    solicitud.categoria_id || solicitud.categoria
  );
}

export default function PanelTecnico() {
  const { width } = useWindowDimensions();
  const pantallaPequena = width < 650;

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [tienePerfil, setTienePerfil] = useState(false);
  const [perfilDisponible, setPerfilDisponible] = useState(true);
  const [filtro, setFiltro] = useState<FiltroTrabajos>(
    'recomendados'
  );

  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);
  const [error, setError] = useState('');
  const [detalleId, setDetalleId] = useState<string | null>(
    null
  );

  const [contactandoId, setContactandoId] = useState<
    string | null
  >(null);

  const [errorContacto, setErrorContacto] = useState<{
    solicitudId: string;
    mensaje: string;
  } | null>(null);

  // ========================================
  // NOTIFICACIONES DE MENSAJES
  // ========================================

  const cargarNotificaciones = useCallback(async () => {
    const token = await obtenerToken();

    if (!token) {
      return;
    }

    try {
      const respuesta = await fetch(
        `${API_URL}/conversaciones/notificaciones`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!respuesta.ok) {
        return;
      }

      const datos: RespuestaNotificaciones =
        await respuesta.json();

      if (
        typeof datos.mensajes_sin_leer === 'number'
      ) {
        setMensajesSinLeer(
          Math.max(0, datos.mensajes_sin_leer)
        );
      }
    } catch (e) {
      console.warn(
        'No se pudieron actualizar las notificaciones:',
        e
      );
    }
  }, []);

  // ========================================
  // CARGAR DATOS DEL PANEL
  // ========================================

  const cargarDatos = useCallback(
    async (recarga = false) => {
      const token = await obtenerToken();

      if (!token) {
        router.replace('/');
        return;
      }

      if (recarga) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      setError('');

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const respuestaUsuario = await fetch(
          `${API_URL}/auth/yo`,
          { headers }
        );

        if (
          respuestaUsuario.status === 401 ||
          respuestaUsuario.status === 403
        ) {
          await borrarToken();

          router.replace('/');
          return;
        }

        if (!respuestaUsuario.ok) {
          throw new Error(
            'No se pudo consultar tu cuenta.'
          );
        }

        const datosUsuario: Usuario =
          await respuestaUsuario.json();

        if (datosUsuario.rol !== 'tecnico') {
          setError(
            'Esta pantalla es exclusiva para técnicos.'
          );
          return;
        }

        setUsuario(datosUsuario);

        const respuestaPerfil = await fetch(
          `${API_URL}/perfiles-tecnicos/yo`,
          { headers }
        );

        if (respuestaPerfil.status === 404) {
          setTienePerfil(false);
          setEspecialidades([]);
          setPerfilDisponible(true);
        } else if (respuestaPerfil.ok) {
          const perfil: PerfilProfesional =
            await respuestaPerfil.json();

          if (!Array.isArray(perfil.especialidades)) {
            throw new Error(
              'El perfil profesional contiene datos inválidos.'
            );
          }

          setTienePerfil(true);
          setEspecialidades(
            perfil.especialidades.map(
              normalizarCategoria
            )
          );
          setPerfilDisponible(
            perfil.disponible ?? true
          );
        } else {
          throw new Error(
            await leerError(respuestaPerfil)
          );
        }

        const respuestaSolicitudes = await fetch(
          `${API_URL}/solicitudes/disponibles`,
          { headers }
        );

        if (!respuestaSolicitudes.ok) {
          throw new Error(
            await leerError(respuestaSolicitudes)
          );
        }

        const datos: RespuestaSolicitudes =
          await respuestaSolicitudes.json();

        if (!Array.isArray(datos.solicitudes)) {
          throw new Error(
            'El servidor devolvió datos inválidos.'
          );
        }

        setSolicitudes(datos.solicitudes);
        void cargarNotificaciones();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Ocurrió un error inesperado.'
        );
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [cargarNotificaciones]
  );

  // ========================================
  // ACTUALIZAR AL ENTRAR Y CADA 15 SEGUNDOS
  // ========================================

  useFocusEffect(
    useCallback(() => {
      void cargarDatos();
      void cargarNotificaciones();

      const intervalo = setInterval(() => {
        void cargarNotificaciones();
      }, 15000);

      return () => {
        clearInterval(intervalo);
      };
    }, [cargarDatos, cargarNotificaciones])
  );

  // ========================================
  // CERRAR SESION
  // ========================================

  async function cerrarSesion() {
    await borrarToken();

    setUsuario(null);
    setSolicitudes([]);
    setEspecialidades([]);
    setMensajesSinLeer(0);
    router.replace('/');
  }

  // ========================================
  // CONTACTAR CLIENTE
  // ========================================

  async function contactarCliente(solicitud: Solicitud) {
    if (contactandoId) {
      return;
    }

    setErrorContacto(null);

    const token = await obtenerToken();

    if (!token) {
      router.replace('/');
      return;
    }

    if (!tienePerfil) {
      setErrorContacto({
        solicitudId: solicitud.id,
        mensaje:
          'Primero debes crear tu perfil profesional.',
      });
      return;
    }

    if (!perfilDisponible) {
      setErrorContacto({
        solicitudId: solicitud.id,
        mensaje:
          'Activa tu disponibilidad en Mi perfil para contactar clientes.',
      });
      return;
    }

    setContactandoId(solicitud.id);

    try {
      const respuesta = await fetch(
        `${API_URL}/conversaciones`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            solicitud_id: solicitud.id,
          }),
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          await leerError(respuesta)
        );
      }

      const datos: RespuestaConversacion =
        await respuesta.json();

      const conversacionId =
        datos.conversacion?.id;

      if (!conversacionId) {
        throw new Error(
          'El servidor no devolvió el ID de la conversación.'
        );
      }

      router.push({
        pathname: '/chat',
        params: {
          conversacionId,
        },
      });
    } catch (e) {
      setErrorContacto({
        solicitudId: solicitud.id,
        mensaje:
          e instanceof Error
            ? e.message
            : 'No se pudo contactar al cliente.',
      });
    } finally {
      setContactandoId(null);
    }
  }

  // ========================================
  // FILTRAR SOLICITUDES
  // ========================================

  const solicitudesRecomendadas = solicitudes.filter(
    (solicitud) =>
      especialidades.includes(
        obtenerCategoriaSolicitud(solicitud)
      )
  );

  const solicitudesVisibles =
    filtro === 'recomendados'
      ? solicitudesRecomendadas
      : solicitudes;

  const especialidadesMostradas =
    especialidades.map(
      (especialidad) =>
        NOMBRES_CATEGORIAS[especialidad] ||
        especialidad
    );

  // ========================================
  // PANTALLA DE CARGA
  // ========================================

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color={C.azul}
        />
        <Text style={styles.secundario}>
          Cargando panel del técnico...
        </Text>
      </View>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={[
        styles.contenido,
        pantallaPequena && styles.contenidoMovil,
      ]}
    >
      {/* ENCABEZADO */}

      <View style={[
        styles.encabezado,
        pantallaPequena && styles.encabezadoMovil,
      ]}>
        <View style={
          pantallaPequena
            ? styles.marcaContenedorMovil
            : styles.marcaContenedor
        }>
          <Text style={styles.marca}>
            PozaSync
          </Text>
          <Text style={styles.secundario}>
            Panel del técnico
          </Text>
        </View>

        <View style={[
          styles.fila,
          pantallaPequena && styles.navegacionMovil,
        ]}>
          {/* MENSAJES CON CONTADOR NUMERICO */}

          <Pressable
            style={[
              styles.botonTexto,
              pantallaPequena && styles.botonNavegacionMovil,
            ]}
            onPress={() =>
              router.push('/conversaciones')
            }
          >
            <View
              style={styles.contenedorIconoMensajes}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={20}
                color={C.azul}
              />

              {mensajesSinLeer > 0 ? (
                <View
                  style={styles.contadorNotificacion}
                >
                  <Text
                    style={styles.numeroNotificacion}
                  >
                    {mensajesSinLeer > 99
                      ? '99+'
                      : mensajesSinLeer}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.textoAzul}>
              Mensajes
            </Text>
          </Pressable>

          {/* MI PERFIL */}

          <Pressable
            style={[
              styles.botonTexto,
              pantallaPequena && styles.botonNavegacionMovil,
            ]}
            onPress={() =>
              router.push('/perfil-tecnico')
            }
          >
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={C.azul}
            />
            <Text style={styles.textoAzul}>
              Mi perfil
            </Text>
          </Pressable>

          {/* SALIR */}

          <Pressable
            style={[
              styles.botonTexto,
              pantallaPequena && styles.botonNavegacionMovil,
            ]}
            onPress={cerrarSesion}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color={C.rojo}
            />
            <Text
              style={{
                color: C.rojo,
                fontWeight: '700',
              }}
            >
              Salir
            </Text>
          </Pressable>
        </View>
      </View>

      {/* BIENVENIDA */}

      <View style={styles.bienvenida}>
        <Text style={styles.saludo}>
          ¡Hola, {usuario?.nombre || 'técnico'}!
        </Text>
        <Text style={styles.descripcion}>
          Encuentra solicitudes relacionadas con tus
          especialidades y nuevas oportunidades de trabajo.
        </Text>
      </View>

      {/* RESUMEN */}

      <View style={[
        styles.resumen,
        pantallaPequena && styles.resumenMovil,
      ]}>
        <View style={styles.estadistica}>
          <Ionicons
            name="briefcase-outline"
            size={24}
            color={C.azul}
          />

          <Text style={styles.numero}>
            {solicitudesRecomendadas.length}
          </Text>

          <Text style={styles.secundario}>
            Trabajos para mí
          </Text>
        </View>

        <View style={styles.separadorVertical} />

        <View style={styles.estadistica}>
          <Ionicons
            name="clipboard-outline"
            size={24}
            color={C.azul}
          />

          <Text style={styles.numero}>
            {solicitudes.length}
          </Text>

          <Text style={styles.secundario}>
            Publicaciones disponibles
          </Text>
        </View>
      </View>

      {/* ESPECIALIDADES */}

      <View style={[
          styles.tarjeta,
          pantallaPequena && styles.tarjetaMovil,
        ]}>
        <View style={styles.fila}>
          <Ionicons
            name="construct-outline"
            size={23}
            color={C.azul}
          />
          <Text style={styles.tituloMediano}>
            Mis especialidades
          </Text>
        </View>

        {tienePerfil &&
        especialidades.length > 0 ? (
          <>
            <View style={styles.fila}>
              {especialidadesMostradas.map(
                (nombre) => (
                  <View
                    key={nombre}
                    style={styles.etiqueta}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={C.azul}
                    />
                    <Text style={styles.textoAzul}>
                      {nombre}
                    </Text>
                  </View>
                )
              )}
            </View>

            {!perfilDisponible ? (
              <Text style={styles.errorTexto}>
                Tu perfil indica que no estás disponible
                para nuevos trabajos.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.secundario}>
              {tienePerfil
                ? 'Actualiza tus especialidades para recibir recomendaciones.'
                : 'Todavía no tienes un perfil profesional. Registra tus especialidades.'}
            </Text>

            <Pressable
              style={styles.botonPrimarioPequeno}
              onPress={() =>
                router.push('/perfil-tecnico')
              }
            >
              <Text style={styles.textoBlanco}>
                {tienePerfil
                  ? 'Actualizar mi perfil'
                  : 'Crear mi perfil'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* TRABAJOS DISPONIBLES */}

      <View style={[
        styles.encabezadoSeccion,
        pantallaPequena && styles.encabezadoSeccionMovil,
      ]}>
        <View>
          <Text style={styles.titulo}>
            Trabajos disponibles
          </Text>
          <Text style={styles.secundario}>
            Publicaciones activas de los clientes
          </Text>
        </View>

        <Pressable
          style={styles.botonTexto}
          disabled={actualizando}
          onPress={() => {
            void cargarDatos(true);
            void cargarNotificaciones();
          }}
        >
          {actualizando ? (
            <ActivityIndicator
              size="small"
              color={C.azul}
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={20}
              color={C.azul}
            />
          )}

          <Text style={styles.textoAzul}>
            Actualizar
          </Text>
        </Pressable>
      </View>

      {/* FILTROS */}

      <View style={[
        styles.fila,
        pantallaPequena && styles.filtrosMovil,
      ]}>
        <Pressable
          style={[
            styles.botonFiltro,
            pantallaPequena && styles.botonFiltroMovil,
            filtro === 'recomendados' &&
              styles.filtroActivo,
          ]}
          onPress={() => {
            setFiltro('recomendados');
            setDetalleId(null);
          }}
        >
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={
              filtro === 'recomendados'
                ? C.blanco
                : C.azul
            }
          />
          <Text
            style={[
              styles.textoAzul,
              filtro === 'recomendados' &&
                styles.textoBlanco,
            ]}
          >
            Trabajos para mí (
            {solicitudesRecomendadas.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.botonFiltro,
            pantallaPequena && styles.botonFiltroMovil,
            filtro === 'todos' &&
              styles.filtroActivo,
          ]}
          onPress={() => {
            setFiltro('todos');
            setDetalleId(null);
          }}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              filtro === 'todos'
                ? C.blanco
                : C.azul
            }
          />
          <Text
            style={[
              styles.textoAzul,
              filtro === 'todos' &&
                styles.textoBlanco,
            ]}
          >
            Explorar todos (
            {solicitudes.length})
          </Text>
        </Pressable>
      </View>

      {/* ERRORES */}

      {error ? (
        <View style={styles.avisoError}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={C.rojo}
          />
          <Text style={styles.errorTexto}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* SIN PUBLICACIONES */}

      {!error && solicitudes.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons
            name="file-tray-outline"
            size={42}
            color={C.gris}
          />
          <Text style={styles.tituloMediano}>
            No hay trabajos disponibles
          </Text>
          <Text style={styles.secundario}>
            Cuando un cliente publique una solicitud,
            aparecerá aquí.
          </Text>
        </View>
      ) : null}

      {/* SIN RECOMENDACIONES */}

      {!error &&
      solicitudes.length > 0 &&
      filtro === 'recomendados' &&
      solicitudesRecomendadas.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons
            name="search-outline"
            size={42}
            color={C.gris}
          />
          <Text style={styles.tituloMediano}>
            No hay trabajos para tus especialidades
          </Text>
          <Text style={styles.secundario}>
            Puedes explorar todas las publicaciones o
            actualizar tu perfil profesional.
          </Text>

          <Pressable
            style={styles.botonPrimarioPequeno}
            onPress={() =>
              setFiltro('todos')
            }
          >
            <Text style={styles.textoBlanco}>
              Explorar todos los trabajos
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* PUBLICACIONES */}

      {!error &&
        solicitudesVisibles.map((solicitud) => {
          const expandida =
            detalleId === solicitud.id;

          const nombreCliente =
            solicitud.cliente?.nombre ||
            'Cliente de PozaSync';

          const fotoCliente =
            solicitud.cliente?.foto_perfil;

          const coincide =
            especialidades.includes(
              obtenerCategoriaSolicitud(solicitud)
            );

          const imagenesValidas = (
            solicitud.imagenes || []
          )
            .map(
              (imagen) =>
                imagen.secure_url ||
                imagen.url
            )
            .filter(
              (url): url is string =>
                Boolean(url)
            );

          const contactando =
            contactandoId === solicitud.id;

          return (
            <View
              key={solicitud.id}
              style={[
          styles.tarjeta,
          pantallaPequena && styles.tarjetaMovil,
        ]}
            >
              {/* CLIENTE */}

              <View
                style={styles.encabezadoPublicacion}
              >
                {fotoCliente ? (
                  <Image
                    source={{
                      uri: fotoCliente,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarVacio}>
                    <Ionicons
                      name="person-outline"
                      size={25}
                      color={C.azul}
                    />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.nombreCliente}>
                    {nombreCliente}
                  </Text>
                  <Text style={styles.secundario}>
                    {formatearFecha(
                      solicitud.fecha_publicacion
                    )}
                  </Text>
                </View>

                {coincide ? (
                  <View style={styles.insignia}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={C.verde}
                    />
                    <Text style={styles.textoVerde}>
                      Para ti
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.separador} />

              <View style={styles.filaSuperior}>
                <Text style={styles.categoria}>
                  {solicitud.categoria}
                </Text>
                <Text style={styles.textoVerde}>
                  Disponible
                </Text>
              </View>

              <Text style={styles.tituloTrabajo}>
                {solicitud.titulo}
              </Text>

              <View style={styles.fila}>
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={C.gris}
                />
                <Text style={styles.secundario}>
                  {solicitud.colonia},{' '}
                  {solicitud.ciudad}
                </Text>
              </View>

              {!expandida ? (
                <Text
                  style={styles.descripcionTrabajo}
                  numberOfLines={2}
                >
                  {solicitud.descripcion}
                </Text>
              ) : (
                <View style={styles.detalles}>
                  <View style={styles.fila}>
                    <Ionicons
                      name="document-text-outline"
                      size={21}
                      color={C.azul}
                    />
                    <Text
                      style={styles.tituloMediano}
                    >
                      Detalles de la solicitud
                    </Text>
                  </View>

                  <Text
                    style={styles.etiquetaDetalle}
                  >
                    Descripción del problema
                  </Text>
                  <Text
                    style={styles.descripcionTrabajo}
                  >
                    {solicitud.descripcion}
                  </Text>

                  <Text
                    style={styles.etiquetaDetalle}
                  >
                    Ubicación del servicio
                  </Text>
                  <Text
                    style={styles.descripcionTrabajo}
                  >
                    {solicitud.colonia},{' '}
                    {solicitud.ciudad}
                  </Text>

                  <Text
                    style={styles.etiquetaDetalle}
                  >
                    Publicado por
                  </Text>
                  <Text
                    style={styles.descripcionTrabajo}
                  >
                    {nombreCliente}
                  </Text>

                  <Text
                    style={styles.etiquetaDetalle}
                  >
                    Fecha de publicación
                  </Text>
                  <Text
                    style={styles.descripcionTrabajo}
                  >
                    {formatearFecha(
                      solicitud.fecha_publicacion
                    )}
                  </Text>

                  <Text
                    style={styles.etiquetaDetalle}
                  >
                    Fotografías del problema
                  </Text>

                  {imagenesValidas.length > 0 ? (
                    <View style={styles.fila}>
                      {imagenesValidas.map(
                        (url, indice) => (
                          <Image
                            key={
                              `${solicitud.id}-` +
                              indice
                            }
                            source={{ uri: url }}
                            style={styles.imagen}
                            resizeMode="cover"
                          />
                        )
                      )}
                    </View>
                  ) : (
                    <View style={styles.sinFotos}>
                      <Ionicons
                        name="images-outline"
                        size={22}
                        color={C.gris}
                      />
                      <Text
                        style={styles.secundario}
                      >
                        Esta solicitud no tiene
                        fotografías adjuntas.
                      </Text>
                    </View>
                  )}

                  {/* CONTACTO */}

                  <View style={styles.contacto}>
                    <View style={styles.fila}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={23}
                        color={C.azul}
                      />
                      <Text
                        style={styles.tituloMediano}
                      >
                        ¿Te interesa este trabajo?
                      </Text>
                    </View>

                    <Text style={styles.secundario}>
                      Contacta al cliente para
                      hablar sobre el servicio y
                      acordar los detalles.
                    </Text>

                    <Pressable
                      style={[
                        styles.botonContacto,
                        (contactando ||
                          !tienePerfil ||
                          !perfilDisponible) &&
                          styles.botonDeshabilitado,
                      ]}
                      disabled={
                        Boolean(contactandoId) ||
                        !tienePerfil ||
                        !perfilDisponible
                      }
                      onPress={() =>
                        void contactarCliente(
                          solicitud
                        )
                      }
                    >
                      {contactando ? (
                        <ActivityIndicator
                          size="small"
                          color={C.blanco}
                        />
                      ) : (
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={20}
                          color={C.blanco}
                        />
                      )}

                      <Text
                        style={styles.textoBlanco}
                      >
                        {contactando
                          ? 'Abriendo conversación...'
                          : 'Contactar al cliente'}
                      </Text>
                    </Pressable>

                    {!tienePerfil ? (
                      <Text
                        style={styles.errorTexto}
                      >
                        Crea tu perfil profesional
                        para contactar clientes.
                      </Text>
                    ) : null}

                    {tienePerfil &&
                    !perfilDisponible ? (
                      <Text
                        style={styles.errorTexto}
                      >
                        Activa tu disponibilidad
                        en Mi perfil.
                      </Text>
                    ) : null}

                    {errorContacto?.solicitudId ===
                    solicitud.id ? (
                      <Text
                        style={styles.errorTexto}
                      >
                        {errorContacto.mensaje}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* MOSTRAR DETALLES */}

              <Pressable
                style={styles.botonDetalles}
                onPress={() =>
                  setDetalleId(
                    expandida
                      ? null
                      : solicitud.id
                  )
                }
              >
                <Text style={styles.textoBlanco}>
                  {expandida
                    ? 'Ocultar detalles'
                    : 'Ver detalles'}
                </Text>

                <Ionicons
                  name={
                    expandida
                      ? 'chevron-up-outline'
                      : 'chevron-down-outline'
                  }
                  size={18}
                  color={C.blanco}
                />
              </Pressable>
            </View>
          );
        })}
    </ScrollView>
  );
}

// ==========================================
// ESTILOS
// ==========================================

const styles = StyleSheet.create({

  contenidoMovil: {
    padding: 12,
    paddingBottom: 45,
    gap: 14,
  },

  encabezadoMovil: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 14,
    gap: 14,
  },

  marcaContenedor: {
    flex: 1,
    minWidth: 150,
  },

  marcaContenedorMovil: {
    width: '100%',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
  },

  navegacionMovil: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 4,
  },

  botonNavegacionMovil: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 10,
    gap: 7,
    borderRadius: 10,
    backgroundColor: C.azulClaro,
  },

  resumenMovil: {
    padding: 14,
    gap: 12,
    flexWrap: 'nowrap',
    alignItems: 'stretch',
  },

  estadistica: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    alignItems: 'flex-start',
  },

  tarjetaMovil: {
    padding: 14,
    gap: 12,
  },

  encabezadoSeccionMovil: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },

  filtrosMovil: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 9,
  },

  botonFiltroMovil: {
    width: '100%',
    minHeight: 48,
  },

  pantalla: {
    flex: 1,
    backgroundColor: C.fondo,
  },

  contenido: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
    gap: 18,
  },

  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    backgroundColor: C.fondo,
  },

  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: C.blanco,
    padding: 18,
    borderRadius: 14,
  },

  marca: {
    color: C.azul,
    fontSize: 25,
    fontWeight: '800',
  },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },

  botonTexto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },

  // ========================================
  // CONTADOR NUMERICO DE MENSAJES
  // ========================================

  contenedorIconoMensajes: {
    position: 'relative',
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contadorNotificacion: {
    position: 'absolute',
    top: -9,
    right: -12,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.rojo,
    borderWidth: 1.5,
    borderColor: C.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  numeroNotificacion: {
    color: C.blanco,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },

  textoAzul: {
    color: C.azul,
    fontWeight: '700',
    fontSize: 13,
  },

  textoBlanco: {
    flexShrink: 1,
    textAlign: 'center',
    color: C.blanco,
    fontWeight: '700',
  },

  textoVerde: {
    color: C.verde,
    fontWeight: '800',
    fontSize: 12,
  },

  secundario: {
    flexShrink: 1,
    color: C.gris,
    fontSize: 13,
    lineHeight: 20,
  },

  bienvenida: {
    paddingVertical: 10,
    gap: 7,
  },

  saludo: {
    color: C.oscuro,
    fontSize: 27,
    fontWeight: '800',
  },

  descripcion: {
    color: C.gris,
    fontSize: 15,
    lineHeight: 23,
  },

  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 18,
    backgroundColor: C.blanco,
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
  },

  numero: {
    color: C.oscuro,
    fontSize: 28,
    fontWeight: '800',
  },

  separadorVertical: {
    height: 45,
    width: 1,
    backgroundColor: C.borde,
  },

  tarjeta: {
    backgroundColor: C.blanco,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
    gap: 13,
  },

  tituloMediano: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '800',
    color: C.oscuro,
  },

  titulo: {
    color: C.oscuro,
    fontSize: 21,
    fontWeight: '800',
  },

  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: C.azulClaro,
    borderRadius: 20,
  },

  botonPrimarioPequeno: {
    backgroundColor: C.azul,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  encabezadoSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },

  botonFiltro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.azul,
    backgroundColor: C.blanco,
  },

  filtroActivo: {
    backgroundColor: C.azul,
  },

  avisoError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
  },

  errorTexto: {
    flexShrink: 1,
    color: C.rojo,
    fontSize: 13,
    lineHeight: 20,
  },

  vacio: {
    alignItems: 'center',
    padding: 35,
    backgroundColor: C.blanco,
    borderRadius: 14,
    gap: 12,
  },

  encabezadoPublicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  avatarVacio: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nombreCliente: {
    color: C.oscuro,
    fontSize: 16,
    fontWeight: '800',
  },

  insignia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E9F8F0',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
  },

  separador: {
    height: 1,
    backgroundColor: C.borde,
  },

  filaSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  categoria: {
    flexShrink: 1,
    color: C.azul,
    fontWeight: '700',
  },

  tituloTrabajo: {
    color: C.oscuro,
    fontSize: 19,
    fontWeight: '800',
  },

  descripcionTrabajo: {
    color: C.oscuro,
    lineHeight: 22,
    fontSize: 14,
  },

  detalles: {
    backgroundColor: C.azulClaro,
    borderRadius: 12,
    padding: 17,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D6E7FF',
  },

  etiquetaDetalle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.azul,
    marginTop: 7,
  },

  imagen: {
    width: 130,
    height: 110,
    borderRadius: 10,
  },

  sinFotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: C.blanco,
    borderRadius: 10,
  },

  contacto: {
    backgroundColor: C.blanco,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.borde,
  },

  botonContacto: {
    backgroundColor: C.azul,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  botonDetalles: {
    backgroundColor: C.azul,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  nota: {
    color: C.gris,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
