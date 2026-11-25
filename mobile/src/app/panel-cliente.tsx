import FormularioDesplazable from '../components/FormularioDesplazable';
import { adjuntarImagen, enviarFormularioImagen } from '../services/imagenes';
import { obtenerToken, borrarToken } from '../services/tokenStorage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

// ==========================================
// CONFIGURACIÓN DE FASTAPI Y SESIÓN
// ==========================================

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';


async function solicitarAPI(
  ruta: string,
  opciones: RequestInit = {}
): Promise<any> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error(
      'No hay una sesión activa. Cierra sesión e inicia nuevamente.'
    );
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...opciones.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      'No se pudo conectar con PozaSync. Comprueba tu conexión a Internet e inténtalo nuevamente.'
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error(
        'Tu sesión ha expirado. Inicia sesión nuevamente.'
      );
    }

    if (respuesta.status === 404) {
      throw new Error(
        'El servicio solicitado no está disponible en este momento.'
      );
    }

    const detalle = datos?.detail;

    if (typeof detalle === 'string') {
      throw new Error(detalle);
    }

    if (Array.isArray(detalle)) {
      throw new Error(
        detalle
          .map((item: any) => item.msg || 'Dato inválido')
          .join('\n')
      );
    }

    throw new Error(
      'No se pudo completar la operación.'
    );
  }

  return datos;
}

// ==========================================
// TIPOS
// ==========================================

type Icono = React.ComponentProps<typeof Ionicons>['name'];

type Seccion =
  | 'inicio'
  | 'explorar'
  | 'solicitudes'
  | 'mensajes'
  | 'perfil'
  | 'nueva-solicitud';

type Categoria = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: Icono;
};

type Solicitud = {
  id: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  colonia: string;
  ciudad: string;
  fecha: string;
  estado: string;
};

type Perfil = {
  id?: string;
  nombre: string;
  correo: string;
  colonia?: string;
  ciudad?: string;
  rol: string;
};

// ==========================================
// COLORES
// ==========================================

const C = {
  fondo: '#F7F8FA',
  blanco: '#FFFFFF',
  marino: '#142238',
  azul: '#2459D3',
  texto: '#172338',
  secundario: '#697586',
  borde: '#E7EBF0',
  azulClaro: '#EDF3FF',
  verde: '#047857',
  rojo: '#B42318',
};

// ==========================================
// CATEGORÍAS
// ==========================================

const CATEGORIAS: Categoria[] = [
  {
    id: 'electricidad',
    nombre: 'Electricidad',
    icono: 'flash-outline',
    descripcion:
      'Instalaciones y reparaciones eléctricas',
  },
  {
    id: 'plomeria',
    nombre: 'Plomería',
    icono: 'water-outline',
    descripcion:
      'Fugas, tuberías y mantenimiento',
  },
  {
    id: 'climatizacion',
    nombre: 'Climatización',
    icono: 'snow-outline',
    descripcion:
      'Aires acondicionados y ventilación',
  },
  {
    id: 'pintura',
    nombre: 'Pintura',
    icono: 'color-palette-outline',
    descripcion:
      'Pintura y acabados',
  },
  {
    id: 'reparaciones',
    nombre: 'Reparaciones',
    icono: 'hammer-outline',
    descripcion:
      'Mantenimiento general',
  },
  {
    id: 'limpieza',
    nombre: 'Limpieza',
    icono: 'sparkles-outline',
    descripcion:
      'Limpieza de espacios',
  },
];

const NAVEGACION: {
  id: Exclude<Seccion, 'nueva-solicitud'>;
  nombre: string;
  icono: Icono;
  iconoActivo: Icono;
}[] = [
  {
    id: 'inicio',
    nombre: 'Inicio',
    icono: 'home-outline',
    iconoActivo: 'home',
  },
  {
    id: 'explorar',
    nombre: 'Explorar',
    icono: 'search-outline',
    iconoActivo: 'search',
  },
  {
    id: 'solicitudes',
    nombre: 'Solicitudes',
    icono: 'receipt-outline',
    iconoActivo: 'receipt',
  },
  {
    id: 'mensajes',
    nombre: 'Mensajes',
    icono: 'chatbubbles-outline',
    iconoActivo: 'chatbubbles',
  },
  {
    id: 'perfil',
    nombre: 'Perfil',
    icono: 'person-outline',
    iconoActivo: 'person',
  },
];

// ==========================================
// CONVERSIÓN DE SOLICITUDES DEL BACKEND
// ==========================================

function convertirSolicitud(datos: any): Solicitud {
  const fechaOriginal = datos?.fecha_creacion;

  const fecha = fechaOriginal
    ? new Date(fechaOriginal)
    : null;

  return {
    id: String(datos.id),
    categoria: String(datos.categoria || ''),
    titulo: String(datos.titulo || ''),
    descripcion: String(datos.descripcion || ''),
    colonia: String(datos.colonia || ''),
    ciudad: String(datos.ciudad || 'Poza Rica'),
    fecha:
      fecha && !Number.isNaN(fecha.getTime())
        ? fecha.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : 'Fecha no disponible',
    estado: String(datos.estado || 'borrador'),
  };
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PanelCliente() {
  const { width } = useWindowDimensions();

  const esEscritorio = width >= 900;
  const columnas = width >= 700 ? 3 : 2;

  const [seccion, setSeccion] =
    useState<Seccion>('inicio');

  // Mensajes sin leer: se obtienen del backend, nunca se inventan.
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);

  const actualizarMensajesSinLeer = useCallback(async () => {
    if (!(await obtenerToken())) return;

    try {
      const datos = await solicitarAPI('/conversaciones');
      const lista = Array.isArray(datos?.conversaciones)
        ? datos.conversaciones
        : [];

      // Compatible con respuestas que exponen el total o el contador
      // por conversación. Si el backend no lo expone, muestra cero.
      const total =
        typeof datos?.total_no_leidos === 'number'
          ? datos.total_no_leidos
          : typeof datos?.mensajes_sin_leer === 'number'
            ? datos.mensajes_sin_leer
            : lista.reduce((suma: number, conversacion: any) => {
                const cantidad =
                  conversacion?.mensajes_sin_leer ??
                  conversacion?.no_leidos ??
                  conversacion?.cantidad_no_leidos ?? 0;
                return suma +
                  (typeof cantidad === 'number' ? cantidad : 0);
              }, 0);

      setMensajesSinLeer(Math.max(0, Math.floor(total)));
    } catch {
      // Un fallo temporal de red no debe afectar el resto del panel.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void actualizarMensajesSinLeer();
      const intervalo = setInterval(() => {
        void actualizarMensajesSinLeer();
      }, 15000);
      return () => clearInterval(intervalo);
    }, [actualizarMensajesSinLeer])
  );

  const [busqueda, setBusqueda] = useState('');

  const [
    categoriaSeleccionada,
    setCategoriaSeleccionada,
  ] = useState<string | null>(null);

  // ========================================
  // ESTADOS DE SOLICITUDES
  // ========================================

  const [solicitudes, setSolicitudes] =
    useState<Solicitud[]>([]);

  const [cargandoSolicitudes, setCargandoSolicitudes] =
    useState(true);

  const [guardandoSolicitud, setGuardandoSolicitud] =
    useState(false);

  const [eliminandoId, setEliminandoId] =
    useState<string | null>(null);

  // NUEVO: controlar la publicación de solicitudes
  const [publicandoId, setPublicandoId] =
    useState<string | null>(null);

  const [errorListado, setErrorListado] = useState('');

  const [mensajeExito, setMensajeExito] = useState('');

  // ========================================
  // ESTADOS DEL FORMULARIO
  // ========================================

  const [tituloSolicitud, setTituloSolicitud] =
    useState('');

  const [
    descripcionSolicitud,
    setDescripcionSolicitud,
  ] = useState('');

  const [coloniaSolicitud, setColoniaSolicitud] =
    useState('');

  const [errorSolicitud, setErrorSolicitud] =
    useState('');

  const [solicitudEditandoId, setSolicitudEditandoId] =
    useState<string | null>(null);

  const [fotosSeleccionadas, setFotosSeleccionadas] =
    useState<ImagePicker.ImagePickerAsset[]>([]);

  const [subiendoFotografias, setSubiendoFotografias] =
    useState(false);

  // ========================================
  // ESTADOS DEL PERFIL
  // ========================================
    const [perfil, setPerfil] =
    useState<Perfil | null>(null);

  const [errorPerfil, setErrorPerfil] =
    useState('');

  // ========================================
  // CARGAR SOLICITUDES DESDE MONGODB
  // ========================================

  async function cargarSolicitudes() {
    setCargandoSolicitudes(true);
    setErrorListado('');

    try {
      const datos = await solicitarAPI('/solicitudes');

      if (!Array.isArray(datos?.solicitudes)) {
        throw new Error(
          'No se pudieron obtener tus solicitudes.'
        );
      }

      const lista = datos.solicitudes.map(
        convertirSolicitud
      );

      setSolicitudes(lista);
    } catch (error) {
      setErrorListado(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las solicitudes.'
      );
    } finally {
      setCargandoSolicitudes(false);
    }
  }

  // ========================================
  // CARGAR PERFIL
  // ========================================

  async function cargarPerfil() {
    try {
      const datos = await solicitarAPI('/auth/yo');

      setPerfil(datos);
      setErrorPerfil('');
    } catch (error) {
      setErrorPerfil(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el perfil.'
      );
    }
  }

  // ========================================
  // CARGA INICIAL
  // ========================================

  useEffect(() => {
    void cargarSolicitudes();
    void cargarPerfil();
  }, []);

  // ========================================
  // CATEGORÍAS Y FILTROS
  // ========================================

  const categoriaActual = CATEGORIAS.find(
    (categoria) =>
      categoria.id === categoriaSeleccionada
  );

  const categoriasFiltradas = useMemo(() => {
    const termino = busqueda
      .trim()
      .toLocaleLowerCase('es');

    return CATEGORIAS.filter((categoria) => {
      const coincideBusqueda =
        !termino ||
        categoria.nombre
          .toLocaleLowerCase('es')
          .includes(termino) ||
        categoria.descripcion
          .toLocaleLowerCase('es')
          .includes(termino);

      const coincideCategoria =
        !categoriaSeleccionada ||
        categoria.id === categoriaSeleccionada;

      return coincideBusqueda && coincideCategoria;
    });
  }, [busqueda, categoriaSeleccionada]);

  // ========================================
  // NAVEGACIÓN
  // ========================================

  function cambiarSeccion(destino: Seccion) {
    setSeccion(destino);
    setMensajeExito('');

    if (destino === 'inicio') {
      setBusqueda('');
      setCategoriaSeleccionada(null);
    }

    if (destino === 'explorar') {
      setCategoriaSeleccionada(null);
    }

    if (destino === 'solicitudes') {
      void cargarSolicitudes();
    }

    if (destino === 'mensajes') {
      router.push('/conversaciones');
      return;
    }

    if (destino === 'perfil') {
      void cargarPerfil();
    }
  }

  function abrirCategoria(id: string) {
    setCategoriaSeleccionada(id);
    setBusqueda('');
    setSeccion('explorar');
  }

  function iniciarSolicitud(id: string) {
    setSolicitudEditandoId(null);
    setFotosSeleccionadas([]);
    setCategoriaSeleccionada(id);
    setTituloSolicitud('');
    setDescripcionSolicitud('');
    setColoniaSolicitud('');
    setErrorSolicitud('');
    setMensajeExito('');
    setSeccion('nueva-solicitud');
  }

  // ========================================
  // GUARDAR BORRADOR EN MONGODB
  // ========================================


  function iniciarEdicionSolicitud(solicitud: Solicitud) {
    if (solicitud.estado !== 'borrador') {
      return;
    }

    setSolicitudEditandoId(solicitud.id);
    setCategoriaSeleccionada(null);
    setTituloSolicitud(solicitud.titulo);
    setDescripcionSolicitud(solicitud.descripcion);
    setColoniaSolicitud(solicitud.colonia);
    setFotosSeleccionadas([]);
    setErrorSolicitud('');
    setMensajeExito('');
    setSeccion('nueva-solicitud');
  }

  async function seleccionarFotografias(
    origen: 'camara' | 'galeria' = 'galeria'
  ) {
    const disponibles = 5 - fotosSeleccionadas.length;

    if (disponibles <= 0) {
      setErrorSolicitud(
        'Puedes agregar un máximo de 5 fotografías.'
      );
      return;
    }

    setErrorSolicitud('');

    try {
      let resultado: ImagePicker.ImagePickerResult;

      if (origen === 'camara') {
        if (Platform.OS === 'web') {
          setErrorSolicitud(
            'Utiliza la galería para agregar fotografías desde el navegador.'
          );
          return;
        }

        const permiso =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permiso.granted) {
          setErrorSolicitud(
            'Permite el acceso a la cámara desde los ajustes de tu dispositivo.'
          );
          return;
        }

        resultado = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.7,
        });

      } else {
        resultado = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: disponibles,
          quality: 0.7,
        });
      }

      if (resultado.canceled) {
        return;
      }

      const permitidos = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      const validas = resultado.assets.filter((foto) => {
        const tipo = foto.mimeType || 'image/jpeg';
        const peso = foto.fileSize || 0;

        return (
          permitidos.includes(tipo) &&
          peso <= 5 * 1024 * 1024
        );
      });

      if (validas.length !== resultado.assets.length) {
        setErrorSolicitud(
          'Solo se permiten fotografías JPG, PNG y WebP de hasta 5 MB.'
        );
      }

      setFotosSeleccionadas((anteriores) =>
        [...anteriores, ...validas].slice(0, 5)
      );

    } catch {
      setErrorSolicitud(
        'No se pudieron obtener las fotografías. Inténtalo nuevamente.'
      );
    }
  }

  async function subirFotografias(
    solicitudId: string
  ): Promise<number> {
    const token = await obtenerToken();

    if (!token) {
      throw new Error('Tu sesión ha expirado.');
    }

    setSubiendoFotografias(true);

    let subidas = 0;

    try {
      for (const foto of fotosSeleccionadas) {
        const formulario = new FormData();

        const nombre =
          foto.fileName ||
          `fotografia-${Date.now()}.jpg`;

        await adjuntarImagen(
          formulario,
          foto.uri,
          nombre,
          foto.mimeType || 'image/jpeg'
        );

        const respuesta = await enviarFormularioImagen(
          `${API_URL}/solicitudes/${solicitudId}/imagenes`,
          formulario,
          token
        );

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(
            error?.detail ||
            'No se pudo subir una fotografía.'
          );
        }

        subidas++;
      }

      return subidas;
    } finally {
      setSubiendoFotografias(false);
    }
  }

  async function guardarSolicitud() {
    if (guardandoSolicitud) {
      return;
    }

    setErrorSolicitud('');

    const titulo = tituloSolicitud.trim();
    const descripcion =
      descripcionSolicitud.trim();
    const colonia = coloniaSolicitud.trim();

    if (!solicitudEditandoId && !categoriaActual) {
      setErrorSolicitud(
        'Selecciona una categoría de servicio.'
      );
      return;
    }

    if (titulo.length < 5) {
      setErrorSolicitud(
        'Escribe un título de al menos 5 caracteres.'
      );
      return;
    }

    if (descripcion.length < 15) {
      setErrorSolicitud(
        'Describe el problema con al menos 15 caracteres.'
      );
      return;
    }

    if (colonia.length < 2) {
      setErrorSolicitud(
        'Escribe la colonia donde necesitas el servicio.'
      );
      return;
    }

    setGuardandoSolicitud(true);

    try {
      const datos = await solicitarAPI(
        solicitudEditandoId
          ? `/solicitudes/${solicitudEditandoId}`
          : '/solicitudes',
        {
          method: solicitudEditandoId ? 'PATCH' : 'POST',
          body: JSON.stringify(
            solicitudEditandoId
              ? { titulo, descripcion, colonia }
              : {
                  categoria: categoriaActual!.id,
                  titulo,
                  descripcion,
                  colonia,
                }
          ),
        }
      );

      if (!datos?.solicitud?.id) {
        throw new Error(
          'No se pudo confirmar que tu solicitud se haya guardado.'
        );
      }

      let avisoFotografias = '';

      if (fotosSeleccionadas.length > 0) {
        try {
          const cantidad = await subirFotografias(
            datos.solicitud.id
          );

          avisoFotografias =
            ` Se subieron ${cantidad} fotografía(s).`;
        } catch (error) {
          avisoFotografias =
            ' La solicitud se guardó, pero algunas fotografías no se pudieron subir.';
        }
      }

      const datosActualizados = await solicitarAPI(
        `/solicitudes/${datos.solicitud.id}`
      );

      const nuevaSolicitud =
        convertirSolicitud(
          datosActualizados?.solicitud ?? datos.solicitud
        );

      setSolicitudes((anteriores) => [
        nuevaSolicitud,
        ...anteriores.filter(
          (solicitud) =>
            solicitud.id !== nuevaSolicitud.id
        ),
      ]);

      setTituloSolicitud('');
      setDescripcionSolicitud('');
      setColoniaSolicitud('');
      setCategoriaSeleccionada(null);
      setFotosSeleccionadas([]);
      setSolicitudEditandoId(null);

      setMensajeExito(
        (solicitudEditandoId
          ? 'Tu borrador se actualizó correctamente.'
          : 'Tu borrador se guardó correctamente.') +
          avisoFotografias
      );

      setSeccion('solicitudes');
    } catch (error) {
      setErrorSolicitud(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el borrador.'
      );
    } finally {
      setGuardandoSolicitud(false);
    }
  }

  // ========================================
  // PUBLICAR SOLICITUD EN MONGODB
  // NUEVA FUNCIÓN
  // ========================================

  function publicarSolicitud(id: string) {
    if (
      publicandoId !== null ||
      eliminandoId !== null
    ) {
      return;
    }

    const publicar = async () => {
      setErrorListado('');
      setMensajeExito('');
      setPublicandoId(id);

      try {
        const datos = await solicitarAPI(
          `/solicitudes/${encodeURIComponent(id)}/publicar`,
          {
            method: 'PATCH',
          }
        );

        if (!datos?.solicitud?.id) {
          throw new Error(
            'No se pudo confirmar la publicación de tu solicitud.'
          );
        }

        const solicitudPublicada =
          convertirSolicitud(datos.solicitud);

        setSolicitudes((anteriores) =>
          anteriores.map((solicitud) =>
            solicitud.id === id
              ? solicitudPublicada
              : solicitud
          )
        );

        setMensajeExito(
          '¡Solicitud publicada correctamente! Ahora está disponible para los técnicos registrados.'
        );
      } catch (error) {
        setErrorListado(
          error instanceof Error
            ? error.message
            : 'No se pudo publicar la solicitud.'
        );
      } finally {
        setPublicandoId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const confirmar = window.confirm(
          '¿Quieres publicar esta solicitud para que los técnicos puedan verla?'
        );

        if (confirmar) {
          void publicar();
        }
      }

      return;
    }

    Alert.alert(
      'Publicar solicitud',
      'Los técnicos registrados podrán consultar esta solicitud.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Publicar',
          onPress: () => {
            void publicar();
          },
        },
      ]
    );
  }

  // ========================================
  // ELIMINAR BORRADOR DE MONGODB
  // ========================================

  function eliminarSolicitud(id: string) {
    if (
      eliminandoId !== null ||
      publicandoId !== null
    ) {
      return;
    }

    const publicada =
      solicitudes.find((solicitud) => solicitud.id === id)
        ?.estado === 'publicada';

    const eliminar = async () => {
      setErrorListado('');
      setEliminandoId(id);

      try {
        await solicitarAPI(
          `/solicitudes/${encodeURIComponent(id)}${
            publicada ? '/retirar' : ''
          }`,
          {
            method: publicada ? 'PATCH' : 'DELETE',
          }
        );

        setSolicitudes((anteriores) =>
          anteriores.filter(
            (solicitud) => solicitud.id !== id
          )
        );

        setMensajeExito(
          publicada
            ? 'Publicación retirada correctamente.'
            : 'Borrador eliminado correctamente.'
        );
      } catch (error) {
        setErrorListado(
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar o retirar la solicitud.'
        );
      } finally {
        setEliminandoId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const confirmar = window.confirm(
          publicada
            ? '¿Quieres retirar esta publicación? Dejará de ser visible para los técnicos.'
            : '¿Quieres eliminar este borrador?'
        );

        if (confirmar) {
          void eliminar();
        }
      }

      return;
    }

    Alert.alert(
      publicada ? 'Retirar publicación' : 'Eliminar borrador',
      publicada
        ? '¿Quieres retirar esta publicación?'
        : '¿Quieres eliminar esta solicitud?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: publicada ? 'Retirar' : 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void eliminar();
          },
        },
      ]
    );
  }

  // ========================================
  // CERRAR SESIÓN
  // ========================================

  function cerrarSesion() {
    const salir = async () => {
      await borrarToken();
      setSolicitudes([]);
      setPerfil(null);
      setMensajesSinLeer(0);
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      void salir();
      return;
    }

    Alert.alert(
      'Cerrar sesión',
      '¿Quieres regresar al inicio de sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => { void salir(); },
        },
      ]
    );
  }

  // ========================================
  // BOTÓN REUTILIZABLE
  // ========================================
    function BotonPrimario({
    texto,
    onPress,
    icono = 'arrow-forward',
    deshabilitado = false,
  }: {
    texto: string;
    onPress: () => void;
    icono?: Icono;
    deshabilitado?: boolean;
  }) {
    return (
      <Pressable
        style={[
          styles.botonPrimario,
          deshabilitado && styles.botonInactivo,
        ]}
        onPress={onPress}
        disabled={deshabilitado}
        accessibilityRole="button"
      >
        <Text style={styles.textoBotonPrimario}>
          {texto}
        </Text>

        <Ionicons
          name={icono}
          size={18}
          color="#FFFFFF"
        />
      </Pressable>
    );
  }

  // ========================================
  // NAVEGACIÓN SUPERIOR E INFERIOR
  // ========================================

  function renderizarNavegacion() {
    return (
      <View
        style={[
          styles.navegacion,
          esEscritorio &&
            styles.navegacionEscritorio,
        ]}
      >
        {NAVEGACION.map((item) => {
          const activo =
            seccion === item.id ||
            (seccion === 'nueva-solicitud' &&
              item.id === 'explorar');

          return (
            <Pressable
              key={item.id}
              onPress={() =>
                cambiarSeccion(item.id)
              }
              style={[
                styles.enlaceNavegacion,
                esEscritorio &&
                  styles.enlaceNavegacionEscritorio,
                activo && styles.enlaceActivo,
              ]}
              accessibilityRole="button"
              accessibilityState={{
                selected: activo,
              }}
            >
              <View style={styles.iconoNavegacionContenedor}>
              <Ionicons
                name={
                  activo
                    ? item.iconoActivo
                    : item.icono
                }
                size={21}
                color={
                  activo
                    ? C.azul
                    : C.secundario
                }
              />
              {item.id === 'mensajes' && mensajesSinLeer > 0 && (
                <View style={styles.insigniaMensajes}>
                  <Text style={styles.textoInsigniaMensajes}>
                    {mensajesSinLeer > 99 ? '99+' : mensajesSinLeer}
                  </Text>
                </View>
              )}
              </View>

              <Text
                style={[
                  styles.textoNavegacion,
                  activo &&
                    styles.textoNavegacionActivo,
                ]}
              >
                {item.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // ========================================
  // CUADRÍCULA DE CATEGORÍAS
  // ========================================

  function renderizarCategorias() {
    return (
      <View style={styles.seccion}>
        <View style={styles.encabezadoSeccion}>
          <View style={styles.textosSeccion}>
            <Text style={styles.tituloSeccion}>
              Explora por categoría
            </Text>

            <Text style={styles.subtituloSeccion}>
              Encuentra el servicio adecuado para ti.
            </Text>
          </View>

          {seccion === 'inicio' && (
            <Pressable
              onPress={() =>
                cambiarSeccion('explorar')
              }
            >
              <Text style={styles.enlaceAzul}>
                Ver todas
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.cuadricula}>
          {categoriasFiltradas.map(
            (categoria) => (
              <Pressable
                key={categoria.id}
                onPress={() =>
                  abrirCategoria(categoria.id)
                }
                style={[
                  styles.categoria,
                  {
                    width:
                      columnas === 3
                        ? '31.8%'
                        : '48.5%',
                  },
                  categoriaSeleccionada ===
                    categoria.id &&
                    styles.categoriaActiva,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.iconoCategoria}>
                  <Ionicons
                    name={categoria.icono}
                    size={25}
                    color={C.azul}
                  />
                </View>

                <Text style={styles.nombreCategoria}>
                  {categoria.nombre}
                </Text>

                <Text
                  style={styles.descripcionCategoria}
                  numberOfLines={2}
                >
                  {categoria.descripcion}
                </Text>

                <Ionicons
                  name="arrow-forward-outline"
                  size={17}
                  color={C.secundario}
                  style={styles.flechaCategoria}
                />
              </Pressable>
            )
          )}
        </View>

        {categoriasFiltradas.length === 0 && (
          <View style={styles.estadoVacio}>
            <Ionicons
              name="search-outline"
              size={30}
              color={C.secundario}
            />

            <Text style={styles.tituloVacio}>
              No encontramos esa categoría
            </Text>

            <Text style={styles.textoVacio}>
              Prueba con otro nombre de servicio.
            </Text>

            <Pressable
              onPress={() => {
                setBusqueda('');
                setCategoriaSeleccionada(null);
              }}
            >
              <Text style={styles.enlaceAzul}>
                Limpiar búsqueda
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ========================================
  // INICIO
  // ========================================

  function renderizarInicio() {
    return (
      <>
        <View style={styles.hero}>
          <View style={styles.heroContenido}>
            <Text style={styles.heroEtiqueta}>
              SERVICIOS EN POZA RICA
            </Text>

            <Text style={styles.heroTitulo}>
              Soluciones para tu día a día.
            </Text>

            <Text style={styles.heroDescripcion}>
              Encuentra profesionales para resolver
              lo que necesitas, desde una reparación
              hasta un proyecto para tu hogar.
            </Text>

            <View style={styles.buscador}>
              <Ionicons
                name="search-outline"
                size={21}
                color={C.secundario}
              />

              <TextInput
                style={styles.entradaBusqueda}
                placeholder="¿Qué servicio necesitas?"
                placeholderTextColor="#8993A2"
                value={busqueda}
                onChangeText={setBusqueda}
                returnKeyType="search"
                onSubmitEditing={() =>
                  setSeccion('explorar')
                }
              />

              {busqueda.length > 0 && (
                <Pressable
                  onPress={() => setBusqueda('')}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={C.secundario}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {esEscritorio && (
            <View style={styles.heroDecoracion}>
              <View style={styles.circuloExterior}>
                <View style={styles.circuloInterior}>
                  <Ionicons
                    name="construct-outline"
                    size={65}
                    color="#FFFFFF"
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {renderizarCategorias()}

        <View style={styles.bloqueInformativo}>
          <View style={styles.iconoInformativo}>
            <Ionicons
              name="shield-checkmark-outline"
              size={26}
              color={C.azul}
            />
          </View>

          <View style={styles.informativoTexto}>
            <Text style={styles.informativoTitulo}>
              Tu próximo servicio empieza aquí
            </Text>

            <Text style={styles.informativoDescripcion}>
              Selecciona una categoría y prepara
              tu solicitud. Puedes publicarla cuando
              esté lista para que los técnicos
              puedan consultarla.
            </Text>
          </View>
        </View>
      </>
    );
  }

  // ========================================
  // EXPLORAR SERVICIOS
  // ========================================

  function renderizarExplorar() {
    return (
      <>
        <View style={styles.encabezadoPagina}>
          <Text style={styles.tituloPagina}>
            Explorar servicios
          </Text>

          <Text style={styles.descripcionPagina}>
            Descubre las categorías disponibles
            en PozaSync.
          </Text>
        </View>

        <View style={styles.buscadorClaro}>
          <Ionicons
            name="search-outline"
            size={21}
            color={C.secundario}
          />

          <TextInput
            style={styles.entradaBusqueda}
            placeholder="Buscar una categoría..."
            placeholderTextColor="#8993A2"
            value={busqueda}
            onChangeText={(texto) => {
              setBusqueda(texto);
              setCategoriaSeleccionada(null);
            }}
          />
        </View>

        {categoriaActual && (
          <View style={styles.filtroSeleccionado}>
            <Text style={styles.textoFiltro}>
              Categoría: {categoriaActual.nombre}
            </Text>

            <Pressable
              onPress={() =>
                setCategoriaSeleccionada(null)
              }
            >
              <Ionicons
                name="close-circle-outline"
                size={22}
                color={C.azul}
              />
            </Pressable>
          </View>
        )}

        {renderizarCategorias()}

        {categoriaActual && (
          <View style={styles.tarjetaAccion}>
            <View style={styles.filaAccion}>
              <View style={styles.iconoAccion}>
                <Ionicons
                  name={categoriaActual.icono}
                  size={26}
                  color={C.azul}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.tituloAccion}>
                  ¿Necesitas un servicio de{' '}
                  {categoriaActual.nombre.toLowerCase()}?
                </Text>

                <Text style={styles.descripcionAccion}>
                  Cuéntanos qué necesitas y prepara
                  tu solicitud.
                </Text>
              </View>
            </View>

            <BotonPrimario
              texto="Crear solicitud"
              icono="add-circle-outline"
              onPress={() =>
                iniciarSolicitud(categoriaActual.id)
              }
            />
          </View>
        )}

        <View style={styles.aviso}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={C.azul}
          />

          <Text style={styles.textoAviso}>
            Prepara tu solicitud y publícala cuando
            esté lista para recibir propuestas
            de los técnicos.
          </Text>
        </View>
      </>
    );
  }

  // ========================================
  // NUEVA SOLICITUD
  // ========================================

  function renderizarNuevaSolicitud() {
    return (
      <>
        <Pressable
          style={styles.regresar}
          onPress={() =>
            setSeccion('explorar')
          }
        >
          <Ionicons
            name="arrow-back-outline"
            size={19}
            color={C.azul}
          />

          <Text style={styles.enlaceAzul}>
            Volver a explorar
          </Text>
        </Pressable>

        <View style={styles.encabezadoPagina}>
          <Text style={styles.tituloPagina}>
            {solicitudEditandoId
              ? 'Editar publicación'
              : 'Nueva solicitud'}
          </Text>

          <Text style={styles.descripcionPagina}>
            Describe el servicio que necesitas
            para preparar tu solicitud.
          </Text>
        </View>

        <View style={styles.formularioSolicitud}>
          <Text style={styles.etiquetaFormulario}>
            Categoría de servicio
          </Text>

          <View style={styles.categoriaFormulario}>
            <Ionicons
              name={
                categoriaActual?.icono ||
                'construct-outline'
              }
              size={23}
              color={C.azul}
            />

            <Text
              style={styles.textoCategoriaFormulario}
            >
              {categoriaActual?.nombre ||
                'Sin categoría seleccionada'}
            </Text>
          </View>

          <Text style={styles.etiquetaFormulario}>
            ¿Qué necesitas? *
          </Text>

          <TextInput
            style={styles.campoFormulario}
            placeholder="Ej. Reparar fuga de agua en el baño"
            placeholderTextColor="#98A2B3"
            value={tituloSolicitud}
            onChangeText={(valor) => {
              setTituloSolicitud(valor);
              setErrorSolicitud('');
            }}
            maxLength={100}
            editable={!guardandoSolicitud}
          />

          <Text style={styles.etiquetaFormulario}>
            Describe el problema *
          </Text>

          <TextInput
            style={[
              styles.campoFormulario,
              styles.campoMultilinea,
            ]}
            placeholder="Explica qué sucede, desde cuándo y qué trabajo necesitas..."
            placeholderTextColor="#98A2B3"
            value={descripcionSolicitud}
            onChangeText={(valor) => {
              setDescripcionSolicitud(valor);
              setErrorSolicitud('');
            }}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            editable={!guardandoSolicitud}
          />

          <Text style={styles.contador}>
            {descripcionSolicitud.length}/1000
          </Text>

          <Text style={styles.etiquetaFormulario}>
            Colonia donde necesitas el servicio *
          </Text>

          <View style={styles.campoConIcono}>
            <Ionicons
              name="location-outline"
              size={20}
              color={C.secundario}
            />

            <TextInput
              style={styles.entradaBusqueda}
              placeholder="Ej. Centro"
              placeholderTextColor="#98A2B3"
              value={coloniaSolicitud}
              onChangeText={(valor) => {
                setColoniaSolicitud(valor);
                setErrorSolicitud('');
              }}
              maxLength={100}
              autoCapitalize="words"
              editable={!guardandoSolicitud}
            />
          </View>


          <View style={{ marginTop: 18, marginBottom: 18 }}>
            <Text style={styles.etiquetaFormulario}>
              Fotografías del problema (opcional)
            </Text>

            <Text style={{ color: '#667085', marginBottom: 12 }}>
              Agrega hasta 5 fotografías JPG, PNG o WebP.
              Máximo 5 MB por imagen.
            </Text>

            <View style={styles.accionesFotografias}>

              {Platform.OS !== 'web' && (
                <Pressable
                  style={[
                    styles.botonFotografia,
                    (guardandoSolicitud ||
                      subiendoFotografias ||
                      fotosSeleccionadas.length >= 5) &&
                      styles.botonInactivo,
                  ]}
                  disabled={
                    guardandoSolicitud ||
                    subiendoFotografias ||
                    fotosSeleccionadas.length >= 5
                  }
                  onPress={() => {
                    void seleccionarFotografias('camara');
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="camera-outline"
                    size={27}
                    color={C.azul}
                  />

                  <Text style={styles.textoBotonFotografia}>
                    Tomar fotografía
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[
                  styles.botonFotografia,
                  (guardandoSolicitud ||
                    subiendoFotografias ||
                    fotosSeleccionadas.length >= 5) &&
                    styles.botonInactivo,
                ]}
                disabled={
                  guardandoSolicitud ||
                  subiendoFotografias ||
                  fotosSeleccionadas.length >= 5
                }
                onPress={() => {
                  void seleccionarFotografias('galeria');
                }}
                accessibilityRole="button"
              >
                <Ionicons
                  name="images-outline"
                  size={27}
                  color={C.azul}
                />

                <Text style={styles.textoBotonFotografia}>
                  Abrir galería
                </Text>
              </Pressable>

            </View>

            <Text style={styles.contadorFotografias}>
              {fotosSeleccionadas.length} de 5 fotografías seleccionadas
            </Text>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              {fotosSeleccionadas.map((foto, indice) => (
                <View
                  key={`${foto.uri}-${indice}`}
                  style={{
                    width: 100,
                    marginRight: 10,
                    marginBottom: 12,
                  }}
                >
                  <Image
                    source={{ uri: foto.uri }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 10,
                      backgroundColor: '#E5E7EB',
                    }}
                    resizeMode="cover"
                  />

                  <Pressable
                    disabled={guardandoSolicitud}
                    onPress={() => {
                      setFotosSeleccionadas((anteriores) =>
                        anteriores.filter((_, i) => i !== indice)
                      );
                    }}
                    style={{
                      paddingVertical: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#DC2626', fontWeight: '600' }}>
                      Quitar
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {subiendoFotografias && (
              <Text style={{ color: '#2563EB', marginTop: 8 }}>
                Subiendo fotografías...
              </Text>
            )}
          </View>

          <View style={styles.aviso}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={C.azul}
            />

            <Text style={styles.textoAviso}>
              Tu solicitud se guardará como borrador.
              Podrás publicarla desde Mis solicitudes
              cuando esté lista.
            </Text>
          </View>

          {errorSolicitud.length > 0 && (
            <View style={styles.mensajeError}>
              <Ionicons
                name="alert-circle-outline"
                size={19}
                color={C.rojo}
              />

              <Text style={styles.textoError}>
                {errorSolicitud}
              </Text>
            </View>
          )}

          {guardandoSolicitud ? (
            <View style={styles.filaCargando}>
              <ActivityIndicator color={C.azul} />
              <Text style={styles.textoCargando}>
                Guardando solicitud...
              </Text>
            </View>
          ) : (
            <BotonPrimario
              texto={
                solicitudEditandoId
                  ? 'Guardar cambios'
                  : 'Guardar borrador'
              }
              icono="save-outline"
              onPress={() => {
                void guardarSolicitud();
              }}
            />
          )}
        </View>
      </>
    );
  }

  // ========================================
  // MIS SOLICITUDES
  // ========================================

  function renderizarSolicitudes() {
    return (
      <>
        <View style={styles.encabezadoPagina}>
          <Text style={styles.tituloPagina}>
            Mis solicitudes
          </Text>

          <Text style={styles.descripcionPagina}>
            Consulta tus borradores y solicitudes
            publicadas en PozaSync.
          </Text>
        </View>

        {mensajeExito.length > 0 && (
          <View style={styles.mensajeExito}>
            <Ionicons
              name="checkmark-circle-outline"
              size={22}
              color={C.verde}
            />

            <Text style={styles.textoExito}>
              {mensajeExito}
            </Text>
          </View>
        )}

        {errorListado.length > 0 && (
          <View style={styles.mensajeError}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={C.rojo}
            />

            <Text style={styles.textoError}>
              {errorListado}
            </Text>
          </View>
        )}

        <View style={styles.resumenSolicitudes}>
          <View>
            <Text style={styles.numeroSolicitudes}>
              {solicitudes.length}
            </Text>

            <Text style={styles.descripcionResumen}>
              Solicitudes guardadas
            </Text>
          </View>

          <Ionicons
            name="documents-outline"
            size={30}
            color={C.azul}
          />
        </View>

        <Pressable
          style={styles.botonActualizar}
          onPress={() => {
            void cargarSolicitudes();
          }}
          disabled={cargandoSolicitudes}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={C.azul}
          />

          <Text style={styles.enlaceAzul}>
            Actualizar solicitudes
          </Text>
        </Pressable>

        {cargandoSolicitudes ? (
          <View style={styles.estadoVacioGrande}>
            <ActivityIndicator
              size="large"
              color={C.azul}
            />

            <Text style={styles.textoVacio}>
              Cargando solicitudes...
            </Text>
          </View>
        ) : errorListado.length > 0 &&
          solicitudes.length === 0 ? (
          <View style={styles.estadoVacioGrande}>
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color={C.rojo}
            />

            <Text style={styles.tituloVacio}>
              No se pudieron cargar las solicitudes
            </Text>

            <BotonPrimario
              texto="Reintentar"
              icono="refresh-outline"
              onPress={() => {
                void cargarSolicitudes();
              }}
            />
          </View>
        ) : solicitudes.length === 0 ? (
          <View style={styles.estadoVacioGrande}>
            <View style={styles.iconoEstadoVacio}>
              <Ionicons
                name="receipt-outline"
                size={36}
                color={C.azul}
              />
            </View>

            <Text style={styles.tituloVacio}>
              Aún no tienes solicitudes
            </Text>

            <Text style={styles.textoVacio}>
              Explora las categorías y prepara
              tu primera solicitud de servicio.
            </Text>

            <BotonPrimario
              texto="Explorar servicios"
              onPress={() =>
                cambiarSeccion('explorar')
              }
            />
          </View>
        ) : (
          <View style={styles.listaSolicitudes}>
            {solicitudes.map((solicitud) => (
              <View
                key={solicitud.id}
                style={styles.tarjetaSolicitud}
              >
                <View
                  style={styles.encabezadoSolicitud}
                >
                  <Text
                    style={styles.categoriaSolicitud}
                  >
                    {solicitud.categoria}
                  </Text>

                  <View
                    style={[
                      styles.estadoBorrador,
                      solicitud.estado === 'publicada' &&
                        styles.estadoPublicado,
                    ]}
                  >
                    <Text
                      style={[
                        styles.textoEstado,
                        solicitud.estado === 'publicada' &&
                          styles.textoEstadoPublicado,
                      ]}
                    >
                      {solicitud.estado === 'borrador'
                        ? 'Borrador'
                        : solicitud.estado === 'publicada'
                          ? 'Publicada'
                          : solicitud.estado}
                    </Text>
                  </View>
                </View>

                <Text style={styles.tituloSolicitud}>
                  {solicitud.titulo}
                </Text>

                <Text
                  style={styles.descripcionSolicitud}
                >
                  {solicitud.descripcion}
                </Text>

                <View style={styles.datosSolicitud}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={C.secundario}
                  />

                  <Text style={styles.textoDato}>
                    {solicitud.colonia},{' '}
                    {solicitud.ciudad}
                  </Text>
                </View>

                <View style={styles.datosSolicitud}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={C.secundario}
                  />

                  <Text style={styles.textoDato}>
                    {solicitud.fecha}
                  </Text>
                </View>

                <View style={styles.pieSolicitud}>
                  <Text
                    style={[
                      styles.avisoBorrador,
                      solicitud.estado === 'publicada' &&
                        styles.avisoPublicado,
                    ]}
                  >
                    {solicitud.estado === 'borrador'
                      ? 'No enviado'
                      : solicitud.estado === 'publicada'
                        ? 'Visible para técnicos'
                        : solicitud.estado}
                  </Text>

                  {(solicitud.estado === 'borrador' ||
                    solicitud.estado === 'publicada') && (
                    <View
                      style={styles.accionesSolicitud}
                    >
                      {solicitud.estado === 'borrador' && (
                        <>
                      <Pressable
                        onPress={() =>
                          iniciarEdicionSolicitud(solicitud)
                        }
                        disabled={
                          publicandoId !== null ||
                          eliminandoId !== null
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Editar borrador"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: C.azul,
                          borderRadius: 8,
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={17}
                          color={C.azul}
                        />
                        <Text
                          style={{
                            color: C.azul,
                            fontWeight: '600',
                          }}
                        >
                          Editar
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          publicarSolicitud(solicitud.id)
                        }
                        disabled={
                          publicandoId !== null ||
                          eliminandoId !== null
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Publicar solicitud"
                        style={[
                          styles.botonPublicar,
                          (publicandoId !== null ||
                            eliminandoId !== null) &&
                            styles.botonInactivo,
                        ]}
                      >
                        {publicandoId === solicitud.id ? (
                          <ActivityIndicator
                            size="small"
                            color="#FFFFFF"
                          />
                        ) : (
                          <Ionicons
                            name="paper-plane-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}

                        <Text
                          style={styles.textoPublicar}
                        >
                          {publicandoId === solicitud.id
                            ? 'Publicando...'
                            : 'Publicar'}
                        </Text>
                      </Pressable>

                        </>
                      )}

                      <Pressable
                        onPress={() =>
                          eliminarSolicitud(solicitud.id)
                        }
                        disabled={
                          eliminandoId !== null ||
                          publicandoId !== null
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                          solicitud.estado === 'publicada'
                            ? 'Retirar publicación'
                            : 'Eliminar borrador'
                        }
                        style={styles.botonEliminar}
                      >
                        {eliminandoId === solicitud.id ? (
                          <ActivityIndicator
                            size="small"
                            color={C.rojo}
                          />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color={C.rojo}
                          />
                        )}

                        <Text
                          style={styles.textoEliminar}
                        >
                          {eliminandoId === solicitud.id
                            ? solicitud.estado === 'publicada'
                              ? 'Retirando...'
                              : 'Eliminando...'
                            : solicitud.estado === 'publicada'
                              ? 'Retirar'
                              : 'Eliminar'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.notaTemporal}>
          Tus borradores son privados hasta
          que decidas publicarlos.
        </Text>
      </>
    );
  }

  // ========================================
  // PERFIL
  // ========================================

  function renderizarPerfil() {
    return (
      <View style={styles.encabezadoPagina}>
        <Text style={styles.tituloPagina}>
          Mi cuenta
        </Text>

        <Text style={styles.descripcionPagina}>
          Administra tu experiencia en PozaSync.
        </Text>

        <View style={styles.tarjetaPerfil}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={30}
              color={C.azul}
            />
          </View>

          <View style={styles.perfilInformacion}>
            <Text style={styles.nombrePerfil}>
              {perfil?.nombre || 'Cuenta de cliente'}
            </Text>

            <Text style={styles.descripcionPerfil}>
              {perfil?.correo ||
                'Cargando información del perfil...'}
            </Text>

            {perfil?.colonia && (
              <Text style={styles.descripcionPerfil}>
                Colonia: {perfil.colonia}
              </Text>
            )}

            {perfil?.ciudad && (
              <Text style={styles.descripcionPerfil}>
                Ciudad: {perfil.ciudad}
              </Text>
            )}
          </View>
        </View>

        {errorPerfil.length > 0 && (
          <View style={styles.mensajeError}>
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={C.rojo}
            />

            <Text style={styles.textoError}>
              {errorPerfil}
            </Text>
          </View>
        )}

        

        <Pressable
          style={styles.cerrarSesion}
          onPress={cerrarSesion}
        >
          <Ionicons
            name="log-out-outline"
            size={21}
            color={C.rojo}
          />

          <Text style={styles.textoCerrarSesion}>
            Cerrar sesión
          </Text>
        </Pressable>
      </View>
    );
  }

  // ========================================
  // PANTALLA PRINCIPAL
  // ========================================

  return (
    <View style={styles.pantalla}>
      <StatusBar style="dark" />

      <View style={styles.encabezado}>
        <View
          style={[
            styles.encabezadoInterior,
            esEscritorio && styles.anchoMaximo,
          ]}
        >
          <View style={styles.marca}>
            <View style={styles.iconoMarca}>
              <Ionicons
                name="construct-outline"
                size={23}
                color="#FFFFFF"
              />
            </View>

            <View>
              <Text style={styles.nombreMarca}>
                PozaSync
              </Text>

              <Text style={styles.ubicacion}>
                Poza Rica, Veracruz
              </Text>
            </View>
          </View>

          {esEscritorio
            ? renderizarNavegacion()
            : null}

          <Pressable
            style={styles.botonCuenta}
            onPress={() =>
              cambiarSeccion('perfil')
            }
            accessibilityLabel="Abrir mi cuenta"
          >
            <Ionicons
              name="person-outline"
              size={21}
              color={C.marino}
            />
          </Pressable>
        </View>
      </View>

      <FormularioDesplazable
        style={styles.contenido}
        contentContainerStyle={[
          styles.contenidoInterior,
          esEscritorio && styles.anchoMaximo,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {seccion === 'inicio' &&
          renderizarInicio()}

        {seccion === 'explorar' &&
          renderizarExplorar()}

        {seccion === 'nueva-solicitud' &&
          renderizarNuevaSolicitud()}

        {seccion === 'solicitudes' &&
          renderizarSolicitudes()}

        {seccion === 'perfil' &&
          renderizarPerfil()}

        <View style={styles.pie}>
          <Text style={styles.textoPie}>
            PozaSync · Servicios locales en Poza Rica
          </Text>
        </View>
      </FormularioDesplazable>

      {!esEscritorio && (
        <View style={styles.navegacionInferior}>
          {renderizarNavegacion()}
        </View>
      )}
    </View>
  );
}

// ==========================================
// ESTILOS
// ==========================================

const styles = StyleSheet.create({

  accionesFotografias: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },

  botonFotografia: {
    flex: 1,
    minWidth: 0,
    minHeight: 100,
    borderWidth: 1,
    borderColor: C.azul,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 15,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  textoBotonFotografia: {
    color: C.azul,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },

  contadorFotografias: {
    fontSize: 12,
    color: C.secundario,
    textAlign: 'center',
    marginTop: 12,
  },

  pantalla: {
    flex: 1,
    backgroundColor: C.fondo,
  },

  anchoMaximo: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
  },

  encabezado: {
    backgroundColor: C.blanco,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
  },

  encabezadoInterior: {
    minHeight: 78,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  iconoMarca: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: C.marino,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nombreMarca: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: C.marino,
  },

  ubicacion: {
    fontSize: 11,
    color: C.secundario,
    marginTop: 2,
  },

  botonCuenta: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borde,
  },

  navegacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  navegacionEscritorio: {
    gap: 6,
  },

  enlaceNavegacion: {
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 5,
    borderRadius: 10,
    flex: 1,
  },

  enlaceNavegacionEscritorio: {
    flex: 0,
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 8,
  },

  enlaceActivo: {
    backgroundColor: C.azulClaro,
  },

  iconoNavegacionContenedor: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  insigniaMensajes: {
    position: 'absolute',
    top: -10,
    right: -14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoInsigniaMensajes: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  textoNavegacion: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: C.secundario,
  },

  textoNavegacionActivo: {
    color: C.azul,
  },

  contenido: {
    flex: 1,
  },

  contenidoInterior: {
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 35,
  },

  hero: {
    backgroundColor: C.marino,
    borderRadius: 20,
    padding: 30,
    minHeight: 300,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 37,
  },

  heroContenido: {
    flex: 1,
    zIndex: 1,
  },

  heroEtiqueta: {
    color: '#AFC7F7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 16,
  },

  heroTitulo: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 39,
    maxWidth: 510,
  },

  heroDescripcion: {
    color: '#C4CDDB',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 470,
    marginTop: 13,
    marginBottom: 23,
  },

  buscador: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 55,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    maxWidth: 550,
  },

  buscadorClaro: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 12,
    minHeight: 55,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 24,
    marginBottom: 20,
  },

  entradaBusqueda: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: C.texto,
    paddingVertical: 12,
  },

  heroDecoracion: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },

  circuloExterior: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#223754',
    alignItems: 'center',
    justifyContent: 'center',
  },

  circuloInterior: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#304C74',
    alignItems: 'center',
    justifyContent: 'center',
  },

  seccion: {
    marginBottom: 34,
  },

  encabezadoSeccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },

  textosSeccion: {
    flex: 1,
  },

  tituloSeccion: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: C.texto,
  },

  subtituloSeccion: {
    fontSize: 13,
    color: C.secundario,
    marginTop: 6,
    lineHeight: 19,
  },

  enlaceAzul: {
    fontSize: 13,
    fontWeight: '700',
    color: C.azul,
    marginTop: 4,
  },

  cuadricula: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 15,
  },

  categoria: {
    minHeight: 180,
    backgroundColor: C.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
    padding: 17,
  },

  categoriaActiva: {
    borderColor: C.azul,
    backgroundColor: '#F8FAFF',
  },

  iconoCategoria: {
    width: 49,
    height: 49,
    borderRadius: 13,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  nombreCategoria: {
    fontSize: 15,
    fontWeight: '700',
    color: C.texto,
  },

  descripcionCategoria: {
    fontSize: 12,
    lineHeight: 18,
    color: C.secundario,
    marginTop: 6,
    paddingRight: 10,
  },

  flechaCategoria: {
    position: 'absolute',
    right: 15,
    top: 19,
  },

  bloqueInformativo: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 15,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },

  iconoInformativo: {
    width: 55,
    height: 55,
    borderRadius: 14,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  informativoTexto: {
    flex: 1,
  },

  informativoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: C.texto,
  },

  informativoDescripcion: {
    fontSize: 13,
    lineHeight: 20,
    color: C.secundario,
    marginTop: 6,
  },

  encabezadoPagina: {
    marginBottom: 22,
  },

  tituloPagina: {
    fontSize: 27,
    fontWeight: '800',
    color: C.texto,
    letterSpacing: -0.7,
  },

  descripcionPagina: {
    fontSize: 14,
    color: C.secundario,
    lineHeight: 21,
    marginTop: 8,
  },

  filtroSeleccionado: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.azulClaro,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginBottom: 20,
  },

  textoFiltro: {
    fontSize: 12,
    color: C.azul,
    fontWeight: '700',
  },

  aviso: {
    backgroundColor: C.azulClaro,
    borderRadius: 12,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginTop: 18,
  },

  textoAviso: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: C.marino,
  },

  estadoVacio: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },

  estadoVacioGrande: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 16,
    alignItems: 'center',
    padding: 35,
    marginTop: 25,
    gap: 12,
  },

  iconoEstadoVacio: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  tituloVacio: {
    fontSize: 17,
    fontWeight: '700',
    color: C.texto,
    textAlign: 'center',
  },

  textoVacio: {
    fontSize: 13,
    color: C.secundario,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 410,
  },

  botonPrimario: {
    backgroundColor: C.azul,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 13,
    alignSelf: 'flex-start',
  },

  botonInactivo: {
    opacity: 0.6,
  },

  textoBotonPrimario: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  tarjetaAccion: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 15,
    padding: 22,
    marginBottom: 20,
  },

  filaAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },

  iconoAccion: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tituloAccion: {
    fontSize: 16,
    fontWeight: '700',
    color: C.texto,
  },

  descripcionAccion: {
    fontSize: 13,
    lineHeight: 20,
    color: C.secundario,
    marginTop: 5,
  },

  regresar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },

  formularioSolicitud: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 16,
    padding: 24,
    maxWidth: 750,
    width: '100%',
  },

  etiquetaFormulario: {
    fontSize: 13,
    fontWeight: '700',
    color: C.texto,
    marginBottom: 9,
    marginTop: 12,
  },

  categoriaFormulario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.azulClaro,
    borderRadius: 10,
    padding: 14,
    marginBottom: 13,
  },

  textoCategoriaFormulario: {
    fontSize: 14,
    fontWeight: '700',
    color: C.azul,
  },

  campoFormulario: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.texto,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },

  campoMultilinea: {
    minHeight: 145,
  },

  contador: {
    fontSize: 11,
    color: C.secundario,
    textAlign: 'right',
    marginTop: -5,
    marginBottom: 12,
  },

  campoConIcono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 52,
  },

  mensajeError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FEF3F2',
    marginTop: 16,
    marginBottom: 12,
  },

  textoError: {
    flex: 1,
    fontSize: 13,
    color: C.rojo,
    lineHeight: 20,
  },

  mensajeExito: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },

  textoExito: {
    flex: 1,
    fontSize: 13,
    color: C.verde,
    lineHeight: 20,
  },

  filaCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
  },

  textoCargando: {
    fontSize: 13,
    color: C.secundario,
  },

  resumenSolicitudes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
  },

  numeroSolicitudes: {
    fontSize: 32,
    fontWeight: '800',
    color: C.marino,
  },

  descripcionResumen: {
    fontSize: 12,
    color: C.secundario,
    marginTop: 5,
  },

  botonActualizar: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 15,
  },

  listaSolicitudes: {
    gap: 16,
  },

  tarjetaSolicitud: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 14,
    padding: 21,
  },

  encabezadoSolicitud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  categoriaSolicitud: {
    fontSize: 12,
    fontWeight: '700',
    color: C.azul,
  },

  estadoBorrador: {
    backgroundColor: '#FFF4E5',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  textoEstado: {
    fontSize: 11,
    fontWeight: '700',
    color: '#975A16',
  },

  // ========================================
  // NUEVOS ESTILOS: ESTADO PUBLICADO
  // ========================================

  estadoPublicado: {
    backgroundColor: '#ECFDF3',
  },

  textoEstadoPublicado: {
    color: C.verde,
  },

  tituloSolicitud: {
    fontSize: 17,
    fontWeight: '800',
    color: C.texto,
    marginBottom: 9,
  },

  descripcionSolicitud: {
    fontSize: 13,
    lineHeight: 21,
    color: C.secundario,
    marginBottom: 15,
  },

  datosSolicitud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },

  textoDato: {
    fontSize: 12,
    color: C.secundario,
  },

  pieSolicitud: {
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.borde,
    marginTop: 13,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  avisoBorrador: {
    fontSize: 12,
    color: C.secundario,
    fontWeight: '600',
  },

  // ========================================
  // NUEVOS ESTILOS: PUBLICAR SOLICITUD
  // ========================================

  avisoPublicado: {
    color: C.verde,
  },

  accionesSolicitud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },

  botonPublicar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: C.verde,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  textoPublicar: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  botonEliminar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },

  textoEliminar: {
    fontSize: 12,
    fontWeight: '700',
    color: C.rojo,
  },
    notaTemporal: {
    fontSize: 12,
    lineHeight: 19,
    color: C.secundario,
    marginTop: 20,
  },

  tarjetaPerfil: {
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 15,
    padding: 22,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },

  perfilInformacion: {
    flex: 1,
  },

  nombrePerfil: {
    fontSize: 17,
    fontWeight: '700',
    color: C.texto,
  },

  descripcionPerfil: {
    fontSize: 12,
    lineHeight: 19,
    color: C.secundario,
    marginTop: 6,
  },

  cerrarSesion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
  },

  textoCerrarSesion: {
    fontSize: 14,
    fontWeight: '700',
    color: C.rojo,
  },

  navegacionInferior: {
    backgroundColor: C.blanco,
    borderTopWidth: 1,
    borderTopColor: C.borde,
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
  },

  pie: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  textoPie: {
    fontSize: 12,
    color: C.secundario,
    textAlign: 'center',
  },
});