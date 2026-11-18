
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

// ==========================================
// CONFIGURACION DE LA API
// ==========================================

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

const MAX_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

// ==========================================
// TIPOS
// ==========================================

type ImagenMensaje = {
  public_id?: string;
  url?: string;
  secure_url?: string;
};

type Mensaje = {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  imagen?: ImagenMensaje | null;
  fecha_envio: string | null;
  leido?: boolean;
};

type Conversacion = {
  id: string;
  solicitud_id: string;
  cliente_id: string;
  tecnico_id: string;
  titulo_solicitud: string;
  categoria_solicitud: string;
  otro_participante: {
    nombre: string;
    foto_perfil: string | null;
  };
};

type Usuario = {
  id: string;
  nombre: string;
  rol: string;
};

type RespuestaMensajes = {
  total: number;
  mensajes: Mensaje[];
};

type RespuestaEnviarMensaje = {
  mensaje: string;
  datos: Mensaje;
};

type EstadoServicio =
  | 'pendiente'
  | 'acordado'
  | 'rechazado'
  | 'finalizado';

type Servicio = {
  id: string;
  conversacion_id: string;
  solicitud_id: string;
  cliente_id: string;
  tecnico_id: string;
  estado: EstadoServicio;
  fecha_creacion: string | null;
  fecha_aceptacion: string | null;
  fecha_rechazo: string | null;
  fecha_finalizacion: string | null;
  puede_calificar: boolean;
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
  total: number;
  resenas: Resena[];
};

// ==========================================
// COLORES
// ==========================================

const C = {
  azul: '#1765D1',
  azulClaro: '#EFF6FF',
  fondo: '#F5F7FB',
  blanco: '#FFFFFF',
  oscuro: '#172B4D',
  gris: '#64748B',
  borde: '#E2E8F0',
  rojo: '#C62828',
  verde: '#15803D',
  verdeClaro: '#F0FDF4',
  amarillo: '#F59E0B',
  amarilloClaro: '#FFFBEB',
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

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

    if (Array.isArray(datos.detail)) {
      return datos.detail
        .map((item: { msg?: string }) => item.msg || '')
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    // Mostrar mensaje general.
  }

  return `Error del servidor (${respuesta.status}).`;
}

function horaMensaje(fecha: string | null): string {
  if (!fecha) return '';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return '';

  return valor.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function obtenerTipoImagen(
  archivo: ImagePicker.ImagePickerAsset
): string {
  const mime = archivo.mimeType?.toLowerCase();

  if (mime && TIPOS_PERMITIDOS.includes(mime)) {
    return mime;
  }

  const nombre = (
    archivo.fileName || archivo.uri
  ).toLowerCase();

  if (/\.jpe?g(?:\?|$)/.test(nombre)) {
    return 'image/jpeg';
  }

  if (/\.png(?:\?|$)/.test(nombre)) {
    return 'image/png';
  }

  if (/\.webp(?:\?|$)/.test(nombre)) {
    return 'image/webp';
  }

  return '';
}

function obtenerNombreImagen(
  archivo: ImagePicker.ImagePickerAsset,
  tipo: string
): string {
  if (archivo.fileName) {
    return archivo.fileName;
  }

  const extension =
    tipo === 'image/png'
      ? 'png'
      : tipo === 'image/webp'
        ? 'webp'
        : 'jpg';

  return `fotografia.${extension}`;
}

function obtenerUrlImagen(
  imagen?: ImagenMensaje | null
): string | null {
  return imagen?.secure_url || imagen?.url || null;
}

function nombreEstado(
  estado: EstadoServicio
): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente de aceptación';
    case 'acordado':
      return 'Servicio acordado';
    case 'rechazado':
      return 'Propuesta rechazada';
    case 'finalizado':
      return 'Servicio finalizado';
  }
}

// ==========================================
// PANTALLA PRINCIPAL
// ==========================================

export default function Chat() {
  const parametros = useLocalSearchParams<{
    conversacionId?: string;
  }>();

  const conversacionId =
    typeof parametros.conversacionId === 'string'
      ? parametros.conversacionId
      : '';

  const { width: anchoPantalla } =
    useWindowDimensions();

  // ========================================
  // ESTADOS DEL CHAT
  // ========================================

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [conversacion, setConversacion] =
    useState<Conversacion | null>(null);

  const [mensajes, setMensajes] =
    useState<Mensaje[]>([]);

  const [texto, setTexto] = useState('');

  const [
    imagenSeleccionada,
    setImagenSeleccionada,
  ] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );

  const [imagenAmpliada, setImagenAmpliada] =
    useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [
    seleccionandoImagen,
    setSeleccionandoImagen,
  ] = useState(false);

  const [actualizando, setActualizando] =
    useState(false);

  const [error, setError] = useState('');

  const scrollRef =
    useRef<ScrollViewInstance>(null);

  // ========================================
  // ESTADOS DE SERVICIOS Y RESEÑAS
  // ========================================

  const [servicio, setServicio] =
    useState<Servicio | null>(null);

  const [resena, setResena] =
    useState<Resena | null>(null);

  const [cargandoServicio, setCargandoServicio] =
    useState(false);

  const [procesandoServicio, setProcesandoServicio] =
    useState(false);

  const [mostrarResena, setMostrarResena] =
    useState(false);

  const [calificacion, setCalificacion] =
    useState(0);

  const [comentario, setComentario] =
    useState('');

  // ========================================
  // PERMISOS
  // ========================================

  const esCliente =
    usuario?.rol === 'cliente' &&
    usuario.id === conversacion?.cliente_id;

  const esTecnico =
    usuario?.rol === 'tecnico' &&
    usuario.id === conversacion?.tecnico_id;

  // ========================================
  // PETICIONES AUTENTICADAS
  // ========================================

  const peticionAutenticada = useCallback(
    async (
      ruta: string,
      opciones: RequestInit = {}
    ): Promise<Response> => {
      const token = obtenerToken();

      if (!token) {
        router.replace('/');
        throw new Error(
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        );
      }

      const respuesta = await fetch(
        `${API_URL}${ruta}`,
        {
          ...opciones,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(opciones.body
              ? {
                  'Content-Type': 'application/json',
                }
              : {}),
            ...(opciones.headers || {}),
          },
        }
      );

      if (respuesta.status === 401) {
        throw new Error(
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        );
      }

      return respuesta;
    },
    []
  );

  // ========================================
  // MARCAR MENSAJES COMO LEIDOS
  // ========================================

  const marcarComoLeidos = useCallback(
    async (token: string) => {
      if (!conversacionId) return;

      const ruta =
        `${API_URL}/conversaciones/` +
        encodeURIComponent(conversacionId) +
        '/leer';

      const respuesta = await fetch(ruta, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!respuesta.ok) {
        throw new Error(
          await leerError(respuesta)
        );
      }
    },
    [conversacionId]
  );

  // ========================================
  // CONSULTAR SERVICIO Y RESEÑA
  // ========================================

  const cargarServicio = useCallback(
    async () => {
      if (!conversacionId) return;

      setCargandoServicio(true);

      try {
        const ruta =
          '/servicios/' +
          encodeURIComponent(conversacionId);

        const respuesta =
          await peticionAutenticada(ruta);

        if (respuesta.status === 404) {
          setServicio(null);
          setResena(null);
          return;
        }

        if (!respuesta.ok) {
          throw new Error(
            await leerError(respuesta)
          );
        }

        const datos: Servicio =
          await respuesta.json();

        setServicio(datos);

        if (datos.estado !== 'finalizado') {
          setResena(null);
          return;
        }

        const respuestaResenas =
          await peticionAutenticada(
            '/resenas/mis-resenas'
          );

        if (!respuestaResenas.ok) {
          throw new Error(
            await leerError(respuestaResenas)
          );
        }

        const datosResenas: RespuestaResenas =
          await respuestaResenas.json();

        const encontrada =
          datosResenas.resenas?.find(
            (item) =>
              item.servicio_id === datos.id
          ) || null;

        setResena(encontrada);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo consultar el servicio.'
        );
      } finally {
        setCargandoServicio(false);
      }
    },
    [conversacionId, peticionAutenticada]
  );

  // ========================================
  // CARGAR CHAT
  // ========================================

  const cargarChat = useCallback(
    async (mostrarCarga = true) => {
      const token = obtenerToken();

      if (!token) {
        router.replace('/');
        return;
      }

      if (!conversacionId) {
        setError(
          'No se indicó una conversación.'
        );
        setCargando(false);
        setActualizando(false);
        return;
      }

      if (mostrarCarga) {
        setCargando(true);
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const rutaConversacion =
          `${API_URL}/conversaciones/` +
          encodeURIComponent(conversacionId);

        const [
          respuestaUsuario,
          respuestaConversacion,
          respuestaMensajes,
        ] = await Promise.all([
          fetch(`${API_URL}/auth/yo`, {
            headers,
          }),
          fetch(rutaConversacion, {
            headers,
          }),
          fetch(
            `${rutaConversacion}/mensajes`,
            { headers }
          ),
        ]);

        if (
          respuestaUsuario.status === 401 ||
          respuestaConversacion.status === 401 ||
          respuestaMensajes.status === 401
        ) {
          throw new Error(
            'Tu sesión ha expirado. Inicia sesión nuevamente.'
          );
        }

        if (!respuestaUsuario.ok) {
          throw new Error(
            await leerError(respuestaUsuario)
          );
        }

        if (!respuestaConversacion.ok) {
          throw new Error(
            await leerError(respuestaConversacion)
          );
        }

        if (!respuestaMensajes.ok) {
          throw new Error(
            await leerError(respuestaMensajes)
          );
        }

        const datosUsuario: Usuario =
          await respuestaUsuario.json();

        const datosConversacion: Conversacion =
          await respuestaConversacion.json();

        const datosMensajes: RespuestaMensajes =
          await respuestaMensajes.json();

        if (
          !Array.isArray(
            datosMensajes.mensajes
          )
        ) {
          throw new Error(
            'El servidor devolvió mensajes inválidos.'
          );
        }

        setUsuario(datosUsuario);
        setConversacion(datosConversacion);
        setMensajes(datosMensajes.mensajes);
        setError('');

        try {
          await marcarComoLeidos(token);

          setMensajes((anteriores) =>
            anteriores.map((mensaje) => ({
              ...mensaje,
              leido:
                mensaje.remitente_id ===
                datosUsuario.id
                  ? mensaje.leido
                  : true,
            }))
          );
        } catch (errorLectura) {
          console.warn(
            'No se pudo confirmar la lectura:',
            errorLectura
          );
        }

        await cargarServicio();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo cargar el chat.'
        );
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [
      conversacionId,
      marcarComoLeidos,
      cargarServicio,
    ]
  );

  useEffect(() => {
    void cargarChat();
  }, [cargarChat]);

  // ========================================
  // ACCIONES DEL SERVICIO
  // ========================================

  async function ejecutarAccionServicio(
    accion:
      | 'crear'
      | 'aceptar'
      | 'rechazar'
      | 'finalizar'
  ) {
    if (
      procesandoServicio ||
      !conversacionId
    ) {
      return;
    }

    setProcesandoServicio(true);
    setError('');

    try {
      let ruta = '/servicios';
      let metodo = 'POST';
      let cuerpo: string | undefined;

      if (accion === 'crear') {
        cuerpo = JSON.stringify({
          conversacion_id: conversacionId,
        });
      } else {
        if (!servicio) {
          throw new Error(
            'No se encontró el servicio.'
          );
        }

        ruta =
          '/servicios/' +
          encodeURIComponent(servicio.id) +
          '/' +
          accion;

        metodo = 'PATCH';
      }

      const respuesta =
        await peticionAutenticada(ruta, {
          method: metodo,
          ...(cuerpo
            ? { body: cuerpo }
            : {}),
        });

      if (!respuesta.ok) {
        throw new Error(
          await leerError(respuesta)
        );
      }

      await cargarServicio();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo actualizar el servicio.'
      );
    } finally {
      setProcesandoServicio(false);
    }
  }

  function confirmarAccion(
    accion:
      | 'crear'
      | 'aceptar'
      | 'rechazar'
      | 'finalizar'
  ) {
    const textos = {
      crear: {
        titulo: 'Proponer servicio',
        mensaje:
          '¿Deseas enviar una propuesta de servicio al técnico?',
      },
      aceptar: {
        titulo: 'Aceptar servicio',
        mensaje:
          '¿Confirmas que aceptas realizar este servicio?',
      },
      rechazar: {
        titulo: 'Rechazar propuesta',
        mensaje:
          '¿Seguro que deseas rechazar esta propuesta? No podrás aceptar la misma propuesta después.',
      },
      finalizar: {
        titulo: 'Finalizar servicio',
        mensaje:
          '¿Confirmas que el servicio ya fue realizado y deseas finalizarlo?',
      },
    };

    const ejecutar = () => {
      void ejecutarAccionServicio(accion);
    };

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined'
    ) {
      if (
        window.confirm(
          textos[accion].mensaje
        )
      ) {
        ejecutar();
      }

      return;
    }

    Alert.alert(
      textos[accion].titulo,
      textos[accion].mensaje,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: ejecutar,
        },
      ]
    );
  }

  // ========================================
  // PUBLICAR RESEÑA
  // ========================================

  async function publicarResena() {
    if (
      !servicio ||
      servicio.estado !== 'finalizado' ||
      !esCliente ||
      resena ||
      procesandoServicio
    ) {
      return;
    }

    if (
      calificacion < 1 ||
      calificacion > 5
    ) {
      setError(
        'Selecciona una calificación de 1 a 5 estrellas.'
      );
      return;
    }

    setProcesandoServicio(true);
    setError('');

    try {
      const respuesta =
        await peticionAutenticada(
          '/resenas',
          {
            method: 'POST',
            body: JSON.stringify({
              servicio_id: servicio.id,
              calificacion,
              comentario: comentario.trim(),
            }),
          }
        );

      if (!respuesta.ok) {
        throw new Error(
          await leerError(respuesta)
        );
      }

      const datos: {
        mensaje: string;
        resena: Resena;
      } = await respuesta.json();

      setResena(datos.resena);
      setMostrarResena(false);
      setComentario('');
      setCalificacion(0);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo publicar la reseña.'
      );

      await cargarServicio();
    } finally {
      setProcesandoServicio(false);
    }
  }

  // ========================================
  // SELECCIONAR FOTOGRAFIA
  // ========================================

  async function seleccionarFotografia() {
    if (
      enviando ||
      seleccionandoImagen ||
      !conversacionId
    ) {
      return;
    }

    setSeleccionandoImagen(true);
    setError('');

    try {
      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          allowsEditing: false,
          quality: 1,
        });

      if (
        resultado.canceled ||
        resultado.assets.length === 0
      ) {
        return;
      }

      const archivo = resultado.assets[0];
      const tipo = obtenerTipoImagen(archivo);

      if (!tipo) {
        throw new Error(
          'Selecciona una fotografía JPG, PNG o WebP.'
        );
      }

      if (
        typeof archivo.fileSize === 'number' &&
        archivo.fileSize > MAX_BYTES
      ) {
        throw new Error(
          'La fotografía no puede superar los 5 MB.'
        );
      }

      setImagenSeleccionada(archivo);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo seleccionar la fotografía.'
      );
    } finally {
      setSeleccionandoImagen(false);
    }
  }

  // ========================================
  // MENSAJERIA
  // ========================================

  function agregarMensaje(
    mensajeNuevo: Mensaje
  ) {
    setMensajes((anteriores) => {
      const existe = anteriores.some(
        (mensaje) =>
          mensaje.id === mensajeNuevo.id
      );

      if (existe) {
        return anteriores;
      }

      return [
        ...anteriores,
        mensajeNuevo,
      ];
    });
  }

  async function enviarMensajeTexto(
    contenido: string,
    token: string
  ) {
    const rutaMensajes =
      `${API_URL}/conversaciones/` +
      encodeURIComponent(conversacionId) +
      '/mensajes';

    const respuesta = await fetch(
      rutaMensajes,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contenido,
        }),
      }
    );

    if (!respuesta.ok) {
      throw new Error(
        await leerError(respuesta)
      );
    }

    const datos: RespuestaEnviarMensaje =
      await respuesta.json();

    agregarMensaje(datos.datos);
  }

  async function enviarFotografia(
    archivo: ImagePicker.ImagePickerAsset,
    contenido: string,
    token: string
  ) {
    const tipo = obtenerTipoImagen(archivo);

    if (!tipo) {
      throw new Error(
        'Formato de fotografía no permitido.'
      );
    }

    const formulario = new FormData();

    if (Platform.OS === 'web') {
      const respuestaArchivo = await fetch(
        archivo.uri
      );

      if (!respuestaArchivo.ok) {
        throw new Error(
          'No se pudo leer la fotografía seleccionada.'
        );
      }

      const blob =
        await respuestaArchivo.blob();

      if (blob.size > MAX_BYTES) {
        throw new Error(
          'La fotografía no puede superar los 5 MB.'
        );
      }

      formulario.append(
        'archivo',
        blob,
        obtenerNombreImagen(archivo, tipo)
      );
    } else {
      formulario.append(
        'archivo',
        {
          uri: archivo.uri,
          name: obtenerNombreImagen(
            archivo,
            tipo
          ),
          type: tipo,
        } as any
      );
    }

    formulario.append(
      'contenido',
      contenido
    );

    const rutaImagenes =
      `${API_URL}/conversaciones/` +
      encodeURIComponent(conversacionId) +
      '/imagenes';

    const respuesta = await fetch(
      rutaImagenes,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formulario,
      }
    );

    if (!respuesta.ok) {
      throw new Error(
        await leerError(respuesta)
      );
    }

    const datos: RespuestaEnviarMensaje =
      await respuesta.json();

    agregarMensaje(datos.datos);
  }

  async function enviarMensaje() {
    const contenido = texto.trim();

    if (
      enviando ||
      !conversacionId ||
      (!contenido && !imagenSeleccionada)
    ) {
      return;
    }

    const token = obtenerToken();

    if (!token) {
      router.replace('/');
      return;
    }

    setEnviando(true);
    setError('');

    try {
      if (imagenSeleccionada) {
        await enviarFotografia(
          imagenSeleccionada,
          contenido,
          token
        );
      } else {
        await enviarMensajeTexto(
          contenido,
          token
        );
      }

      setTexto('');
      setImagenSeleccionada(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo enviar el mensaje.'
      );
    } finally {
      setEnviando(false);
    }
  }

  async function actualizar() {
    if (actualizando) return;

    setActualizando(true);
    await cargarChat(false);
  }

  // ========================================
  // REFERENCIA DE PUBLICACION
  // ========================================

  const primerMensajeTecnico =
    conversacion
      ? mensajes.find(
          (mensaje) =>
            mensaje.remitente_id ===
            conversacion.tecnico_id
        )
      : undefined;

  function renderizarPublicacion(
    esMio: boolean
  ) {
    if (!conversacion) return null;

    return (
      <View
        style={[
          styles.referenciaPublicacion,
          esMio
            ? styles.referenciaMia
            : styles.referenciaOtra,
        ]}
      >
        <View style={styles.filaReferencia}>
          <Ionicons
            name="return-down-forward-outline"
            size={15}
            color={
              esMio ? '#DCEAFF' : C.azul
            }
          />

          <Text
            style={[
              styles.etiquetaReferencia,
              esMio
                ? styles.etiquetaMia
                : styles.etiquetaOtra,
            ]}
          >
            RESPUESTA A TU PUBLICACIÓN
          </Text>
        </View>

        <View style={styles.contenidoReferencia}>
          <View
            style={[
              styles.iconoReferencia,
              esMio
                ? styles.iconoReferenciaMio
                : styles.iconoReferenciaOtro,
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={25}
              color={
                esMio ? C.blanco : C.azul
              }
            />
          </View>

          <View style={styles.datosReferencia}>
            <Text
              style={[
                styles.tituloReferencia,
                esMio
                  ? styles.textoReferenciaMio
                  : styles.textoReferenciaOtro,
              ]}
              numberOfLines={3}
            >
              {conversacion.titulo_solicitud ||
                'Solicitud de servicio'}
            </Text>

            <Text
              style={[
                styles.categoriaReferencia,
                esMio
                  ? styles.categoriaReferenciaMia
                  : styles.categoriaReferenciaOtra,
              ]}
              numberOfLines={1}
            >
              {conversacion.categoria_solicitud ||
                'Servicio solicitado'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ========================================
  // BOTON DE SERVICIO
  // ========================================

  function botonServicio(
    titulo: string,
    accion: () => void,
    variante:
      | 'azul'
      | 'verde'
      | 'rojo' = 'azul'
  ) {
    return (
      <Pressable
        onPress={accion}
        disabled={procesandoServicio}
        style={[
          styles.botonServicio,
          variante === 'verde' &&
            styles.botonVerde,
          variante === 'rojo' &&
            styles.botonRojo,
          procesandoServicio &&
            styles.botonDeshabilitado,
        ]}
      >
        {procesandoServicio ? (
          <ActivityIndicator
            size="small"
            color={C.blanco}
          />
        ) : (
          <Text style={styles.textoBotonServicio}>
            {titulo}
          </Text>
        )}
      </Pressable>
    );
  }

  // ========================================
  // TARJETA DE SERVICIO
  // ========================================

  function renderizarServicio() {
    if (!conversacion || !usuario) {
      return null;
    }

    return (
      <View style={styles.tarjetaServicio}>
        <View style={styles.cabeceraServicio}>
          <Ionicons
            name="construct-outline"
            size={21}
            color={C.azul}
          />

          <Text style={styles.tituloServicio}>
            Acuerdo de servicio
          </Text>

          <Pressable
            onPress={() =>
              void cargarServicio()
            }
            disabled={
              cargandoServicio ||
              procesandoServicio
            }
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={C.azul}
            />
          </Pressable>
        </View>

        {cargandoServicio ? (
          <ActivityIndicator
            size="small"
            color={C.azul}
          />
        ) : !servicio ? (
          <>
            <Text style={styles.descripcionServicio}>
              Cuando lleguen a un acuerdo,
              el cliente puede enviar una
              propuesta al técnico desde
              esta conversación.
            </Text>

            {esCliente
              ? botonServicio(
                  'Proponer servicio',
                  () => confirmarAccion('crear')
                )
              : null}

            {esTecnico ? (
              <Text style={styles.descripcionServicio}>
                Esperando una propuesta
                del cliente.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <View
              style={[
                styles.estadoServicio,
                servicio.estado === 'acordado' &&
                  styles.estadoVerde,
                servicio.estado === 'finalizado' &&
                  styles.estadoVerde,
                servicio.estado === 'rechazado' &&
                  styles.estadoRojo,
              ]}
            >
              <Text
                style={styles.textoEstadoServicio}
              >
                {nombreEstado(servicio.estado)}
              </Text>
            </View>

            {servicio.estado === 'pendiente' ? (
              <>
                <Text
                  style={styles.descripcionServicio}
                >
                  El cliente ha propuesto
                  formalizar el servicio.
                </Text>

                {esTecnico ? (
                  <View style={styles.filaBotones}>
                    {botonServicio(
                      'Aceptar',
                      () =>
                        confirmarAccion(
                          'aceptar'
                        ),
                      'verde'
                    )}

                    {botonServicio(
                      'Rechazar',
                      () =>
                        confirmarAccion(
                          'rechazar'
                        ),
                      'rojo'
                    )}
                  </View>
                ) : (
                  <Text
                    style={styles.descripcionServicio}
                  >
                    Esperando la respuesta
                    del técnico.
                  </Text>
                )}
              </>
            ) : null}

            {servicio.estado === 'acordado' ? (
              <>
                <Text
                  style={styles.descripcionServicio}
                >
                  El técnico aceptó el servicio.
                  Pueden continuar coordinando
                  los detalles por este chat.
                </Text>

                {esCliente
                  ? botonServicio(
                      'Marcar servicio como finalizado',
                      () =>
                        confirmarAccion(
                          'finalizar'
                        ),
                      'verde'
                    )
                  : null}
              </>
            ) : null}

            {servicio.estado === 'rechazado' ? (
              <Text
                style={styles.descripcionServicio}
              >
                El técnico rechazó esta
                propuesta. El acuerdo no
                puede volver a proponerse
                en esta conversación.
              </Text>
            ) : null}

            {servicio.estado === 'finalizado' ? (
              <>
                <Text
                  style={styles.descripcionServicio}
                >
                  El servicio fue marcado
                  como finalizado.
                </Text>

                {esCliente && !resena ? (
                  <>
                    {!mostrarResena
                      ? botonServicio(
                          'Calificar servicio',
                          () =>
                            setMostrarResena(
                              true
                            )
                        )
                      : null}

                    {mostrarResena ? (
                      <View
                        style={styles.formularioResena}
                      >
                        <Text
                          style={styles.tituloResena}
                        >
                          ¿Cómo fue tu experiencia?
                        </Text>

                        <View
                          style={styles.filaEstrellas}
                        >
                          {[1, 2, 3, 4, 5].map(
                            (estrella) => (
                              <Pressable
                                key={estrella}
                                onPress={() =>
                                  setCalificacion(
                                    estrella
                                  )
                                }
                                disabled={
                                  procesandoServicio
                                }
                                accessibilityLabel={
                                  `${estrella} estrellas`
                                }
                              >
                                <Ionicons
                                  name={
                                    estrella <=
                                    calificacion
                                      ? 'star'
                                      : 'star-outline'
                                  }
                                  size={32}
                                  color={
                                    C.amarillo
                                  }
                                />
                              </Pressable>
                            )
                          )}
                        </View>

                        <TextInput
                          value={comentario}
                          onChangeText={
                            setComentario
                          }
                          placeholder="Escribe tu opinión (opcional)"
                          placeholderTextColor={
                            C.gris
                          }
                          multiline
                          maxLength={1000}
                          style={
                            styles.entradaResena
                          }
                          editable={
                            !procesandoServicio
                          }
                        />

                        {botonServicio(
                          'Publicar reseña',
                          () =>
                            void publicarResena()
                        )}

                        <Pressable
                          onPress={() =>
                            setMostrarResena(
                              false
                            )
                          }
                          disabled={
                            procesandoServicio
                          }
                        >
                          <Text
                            style={
                              styles.textoCancelar
                            }
                          >
                            Cancelar
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {resena ? (
                  <View
                    style={styles.resenaPublicada}
                  >
                    <Text
                      style={styles.tituloResena}
                    >
                      Tu calificación
                    </Text>

                    <Text
                      style={styles.estrellasTexto}
                    >
                      {'★'.repeat(
                        resena.calificacion
                      )}
                      {'☆'.repeat(
                        5 -
                          resena.calificacion
                      )}
                    </Text>

                    {resena.comentario ? (
                      <Text
                        style={
                          styles.descripcionServicio
                        }
                      >
                        {resena.comentario}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </View>
    );
  }

  // ========================================
  // CARGANDO
  // ========================================

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color={C.azul}
        />

        <Text style={styles.secundario}>
          Cargando conversación...
        </Text>
      </View>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <View style={styles.pantalla}>
      <View style={styles.contenedor}>

        {/* ENCABEZADO */}

        <View style={styles.encabezado}>
          <Pressable
            onPress={() => router.back()}
            style={styles.botonIcono}
            accessibilityLabel="Regresar"
          >
            <Ionicons
              name="arrow-back-outline"
              size={24}
              color={C.azul}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (
                esCliente &&
                conversacion?.tecnico_id
              ) {
                router.push({
                  pathname: '/ver-tecnico',
                  params: {
                    tecnicoId: conversacion.tecnico_id,
                  },
                });
              }
            }}
            disabled={
              !esCliente ||
              !conversacion?.tecnico_id
            }
            accessibilityRole="button"
            accessibilityLabel="Ver perfil y reseñas del técnico"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={styles.avatar}>
              {conversacion?.otro_participante
                ?.foto_perfil ? (
                <Image
                  source={{
                    uri: conversacion
                      .otro_participante
                      .foto_perfil,
                  }}
                  style={styles.fotoAvatar}
                />
              ) : (
                <Ionicons
                  name="person-outline"
                  size={23}
                  color={C.azul}
                />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>
                {conversacion
                  ?.otro_participante
                  ?.nombre || 'Conversación'}
              </Text>

              <Text style={styles.secundario}>
                {esCliente
                  ? 'Ver perfil y reseñas del técnico'
                  : 'Chat privado de PozaSync'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => void actualizar()}
            disabled={actualizando}
            style={styles.botonIcono}
            accessibilityLabel="Actualizar mensajes"
          >
            {actualizando ? (
              <ActivityIndicator
                size="small"
                color={C.azul}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={23}
                color={C.azul}
              />
            )}
          </Pressable>
        </View>

        {/* ACUERDO DE SERVICIO */}

        {renderizarServicio()}

        {/* MENSAJES */}

        <ScrollView
          ref={scrollRef}
          style={styles.listaMensajes}
          contentContainerStyle={
            styles.contenidoMensajes
          }
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({
              animated: false,
            });
          }}
        >
          {mensajes.length === 0 ? (
            <View style={styles.sinMensajes}>
              <Ionicons
                name="chatbubbles-outline"
                size={45}
                color={C.gris}
              />

              <Text style={styles.tituloVacio}>
                Inicia la conversación
              </Text>

              <Text
                style={styles.secundarioCentrado}
              >
                Escribe un mensaje o envía
                una fotografía para hablar
                sobre esta solicitud de
                servicio.
              </Text>
            </View>
          ) : (
            mensajes.map((mensaje) => {
              const esMio =
                mensaje.remitente_id ===
                usuario?.id;

              const mostrarPublicacion =
                primerMensajeTecnico?.id ===
                mensaje.id;

              const urlImagen =
                obtenerUrlImagen(
                  mensaje.imagen
                );

              const anchoImagen = Math.min(
                250,
                Math.max(
                  150,
                  anchoPantalla * 0.55
                )
              );

              return (
                <View
                  key={mensaje.id}
                  style={[
                    styles.burbuja,
                    esMio
                      ? styles.burbujaMia
                      : styles.burbujaOtra,
                  ]}
                >
                  {mostrarPublicacion
                    ? renderizarPublicacion(
                        esMio
                      )
                    : null}

                  {urlImagen ? (
                    <Pressable
                      onPress={() =>
                        setImagenAmpliada(
                          urlImagen
                        )
                      }
                      accessibilityLabel="Ampliar fotografía"
                    >
                      <Image
                        source={{
                          uri: urlImagen,
                        }}
                        style={[
                          styles.imagenMensaje,
                          {
                            width:
                              anchoImagen,
                            height:
                              anchoImagen,
                          },
                        ]}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ) : null}

                  {mensaje.contenido ? (
                    <Text
                      style={[
                        styles.textoMensaje,
                        esMio &&
                          styles.textoMensajeMio,
                      ]}
                    >
                      {mensaje.contenido}
                    </Text>
                  ) : null}

                  <Text
                    style={[
                      styles.hora,
                      esMio &&
                        styles.horaMia,
                    ]}
                  >
                    {horaMensaje(
                      mensaje.fecha_envio
                    )}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ERRORES */}

        {error ? (
          <View style={styles.avisoError}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={C.rojo}
            />

            <Text style={styles.textoError}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* VISTA PREVIA */}

        {imagenSeleccionada ? (
          <View style={styles.vistaPrevia}>
            <Image
              source={{
                uri: imagenSeleccionada.uri,
              }}
              style={styles.imagenPrevia}
              resizeMode="cover"
            />

            <View style={styles.datosPrevia}>
              <Text
                style={styles.nombreArchivo}
                numberOfLines={1}
              >
                {imagenSeleccionada.fileName ||
                  'Fotografía seleccionada'}
              </Text>

              <Text style={styles.secundario}>
                Lista para enviar
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setImagenSeleccionada(null)
              }
              disabled={enviando}
              style={styles.botonQuitar}
              accessibilityLabel="Quitar fotografía"
            >
              <Ionicons
                name="close-circle"
                size={26}
                color={C.rojo}
              />
            </Pressable>
          </View>
        ) : null}

        {/* AREA DE ESCRITURA */}

        {conversacion ? (
          <View style={styles.areaEscritura}>
            <Pressable
              onPress={() =>
                void seleccionarFotografia()
              }
              disabled={
                enviando ||
                seleccionandoImagen
              }
              style={[
                styles.botonAdjuntar,
                (enviando ||
                  seleccionandoImagen) &&
                  styles.botonDeshabilitado,
              ]}
              accessibilityLabel="Adjuntar fotografía"
            >
              {seleccionandoImagen ? (
                <ActivityIndicator
                  size="small"
                  color={C.azul}
                />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={C.azul}
                />
              )}
            </Pressable>

            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder={
                imagenSeleccionada
                  ? 'Añade un mensaje (opcional)...'
                  : 'Escribe un mensaje...'
              }
              placeholderTextColor={C.gris}
              multiline
              maxLength={2000}
              style={styles.entrada}
              editable={!enviando}
            />

            <Pressable
              onPress={() =>
                void enviarMensaje()
              }
              disabled={
                (!texto.trim() &&
                  !imagenSeleccionada) ||
                enviando
              }
              style={[
                styles.botonEnviar,
                ((!texto.trim() &&
                  !imagenSeleccionada) ||
                  enviando) &&
                  styles.botonDeshabilitado,
              ]}
              accessibilityLabel="Enviar mensaje"
            >
              {enviando ? (
                <ActivityIndicator
                  size="small"
                  color={C.blanco}
                />
              ) : (
                <Ionicons
                  name="send"
                  size={21}
                  color={C.blanco}
                />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.botonReintentar}
            onPress={() =>
              void cargarChat()
            }
          >
            <Text
              style={styles.textoReintentar}
            >
              Reintentar
            </Text>
          </Pressable>
        )}
      </View>

      {/* VISOR DE FOTOGRAFIAS */}

      <Modal
        visible={Boolean(imagenAmpliada)}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setImagenAmpliada(null)
        }
      >
        <View style={styles.fondoModal}>
          <Pressable
            style={styles.cerrarModal}
            onPress={() =>
              setImagenAmpliada(null)
            }
            accessibilityLabel="Cerrar fotografía"
          >
            <Ionicons
              name="close"
              size={30}
              color={C.blanco}
            />
          </Pressable>

          {imagenAmpliada ? (
            <Image
              source={{
                uri: imagenAmpliada,
              }}
              style={styles.imagenAmpliada}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// ESTILOS
// ==========================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: C.fondo,
    padding: 12,
  },

  contenedor: {
    flex: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    backgroundColor: C.blanco,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borde,
  },

  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
  },

  botonIcono: {
    padding: 8,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  fotoAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  nombre: {
    color: C.oscuro,
    fontSize: 17,
    fontWeight: '800',
  },

  secundario: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 19,
  },

  secundarioCentrado: {
    color: C.gris,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  listaMensajes: {
    flex: 1,
  },

  contenidoMensajes: {
    padding: 18,
    gap: 12,
    flexGrow: 1,
  },

  burbuja: {
    padding: 13,
    borderRadius: 14,
    maxWidth: '82%',
    gap: 9,
  },

  burbujaMia: {
    backgroundColor: C.azul,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },

  burbujaOtra: {
    backgroundColor: C.fondo,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },

  textoMensaje: {
    color: C.oscuro,
    fontSize: 15,
    lineHeight: 22,
  },

  textoMensajeMio: {
    color: C.blanco,
  },

  imagenMensaje: {
    borderRadius: 10,
    backgroundColor: C.borde,
  },

  hora: {
    fontSize: 11,
    color: C.gris,
    textAlign: 'right',
  },

  horaMia: {
    color: '#DCEAFF',
  },

  referenciaPublicacion: {
    borderRadius: 10,
    padding: 11,
    gap: 9,
    borderLeftWidth: 3,
  },

  referenciaMia: {
    backgroundColor:
      'rgba(255,255,255,0.15)',
    borderLeftColor: C.blanco,
  },

  referenciaOtra: {
    backgroundColor: C.blanco,
    borderLeftColor: C.azul,
  },

  filaReferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  etiquetaReferencia: {
    fontSize: 10,
    fontWeight: '800',
    flexShrink: 1,
  },

  etiquetaMia: {
    color: '#DCEAFF',
  },

  etiquetaOtra: {
    color: C.azul,
  },

  contenidoReferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  iconoReferencia: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconoReferenciaMio: {
    backgroundColor:
      'rgba(255,255,255,0.16)',
  },

  iconoReferenciaOtro: {
    backgroundColor: C.azulClaro,
  },

  datosReferencia: {
    flex: 1,
    gap: 5,
  },

  tituloReferencia: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },

  textoReferenciaMio: {
    color: C.blanco,
  },

  textoReferenciaOtro: {
    color: C.oscuro,
  },

  categoriaReferencia: {
    fontSize: 11,
    fontWeight: '600',
  },

  categoriaReferenciaMia: {
    color: '#DCEAFF',
  },

  categoriaReferenciaOtra: {
    color: C.gris,
  },

  sinMensajes: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 25,
  },

  tituloVacio: {
    color: C.oscuro,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  vistaPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: C.azulClaro,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },

  imagenPrevia: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: C.borde,
  },

  datosPrevia: {
    flex: 1,
    gap: 5,
  },

  nombreArchivo: {
    color: C.oscuro,
    fontWeight: '700',
    fontSize: 13,
  },

  botonQuitar: {
    padding: 5,
  },

  areaEscritura: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },

  botonAdjuntar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borde,
  },

  entrada: {
    flex: 1,
    minHeight: 45,
    maxHeight: 130,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borde,
    color: C.oscuro,
    fontSize: 15,
    textAlignVertical: 'top',
  },

  botonEnviar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },

  botonDeshabilitado: {
    opacity: 0.5,
  },

  fondoModal: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cerrarModal: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 10,
    padding: 10,
  },

  imagenAmpliada: {
    width: '95%',
    height: '85%',
  },

  avisoError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FDECEC',
  },

  textoError: {
    flex: 1,
    color: C.rojo,
    fontSize: 13,
  },

  botonReintentar: {
    padding: 15,
    alignItems: 'center',
  },

  textoReintentar: {
    color: C.azul,
    fontWeight: '700',
  },

  // ========================================
  // ESTILOS DE SERVICIOS
  // ========================================

  tarjetaServicio: {
    padding: 14,
    margin: 12,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.azulClaro,
    gap: 10,
  },

  cabeceraServicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  tituloServicio: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: C.oscuro,
  },

  descripcionServicio: {
    fontSize: 13,
    lineHeight: 19,
    color: C.gris,
  },

  estadoServicio: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.amarilloClaro,
  },

  estadoVerde: {
    backgroundColor: C.verdeClaro,
  },

  estadoRojo: {
    backgroundColor: '#FDECEC',
  },

  textoEstadoServicio: {
    fontSize: 12,
    fontWeight: '800',
    color: C.oscuro,
  },

  filaBotones: {
    flexDirection: 'row',
    gap: 10,
  },

  botonServicio: {
    flex: 1,
    backgroundColor: C.azul,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  botonVerde: {
    backgroundColor: C.verde,
  },

  botonRojo: {
    backgroundColor: C.rojo,
  },

  textoBotonServicio: {
    color: C.blanco,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ========================================
  // ESTILOS DE RESEÑAS
  // ========================================

  formularioResena: {
    backgroundColor: C.blanco,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },

  tituloResena: {
    fontSize: 15,
    fontWeight: '800',
    color: C.oscuro,
  },

  filaEstrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },

  entradaResena: {
    minHeight: 90,
    maxHeight: 150,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 10,
    fontSize: 14,
    color: C.oscuro,
    textAlignVertical: 'top',
  },

  textoCancelar: {
    textAlign: 'center',
    color: C.gris,
    fontSize: 13,
    fontWeight: '700',
    padding: 8,
  },

  resenaPublicada: {
    backgroundColor: C.blanco,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },

  estrellasTexto: {
    fontSize: 26,
    color: C.amarillo,
    letterSpacing: 3,
  },
});
