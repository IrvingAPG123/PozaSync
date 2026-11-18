
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

type Rol = 'cliente' | 'tecnico';

type DireccionMapa = {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  residential?: string;
  city_district?: string;
  borough?: string;
  city?: string;
  town?: string;
  municipality?: string;
};

// Lista inicial orientativa de colonias.
// No es un catálogo oficial ni exhaustivo.
// Se puede ampliar sin cambiar el formulario.
const COLONIAS_SUGERIDAS = [
  '27 de Septiembre',
  'Anáhuac',
  'Cazones',
  'Centro',
  'Chapultepec',
  'Las Gaviotas',
  'Laredo',
  'Palma Sola',
  'Petromex',
  'Santa Emilia',
  'Tajín',
];

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function obtenerMensajeError(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((error: any) => {
        const campo = Array.isArray(error?.loc)
          ? String(error.loc[error.loc.length - 1])
          : '';

        const traducciones: Record<string, string> = {
          nombre: 'Nombre',
          correo: 'Correo electrónico',
          contrasena: 'Contraseña',
          ciudad: 'Ciudad',
          colonia: 'Colonia',
          rol: 'Tipo de cuenta',
        };

        const etiqueta = traducciones[campo] || campo;

        const descripcion =
          typeof error?.msg === 'string'
            ? error.msg
            : 'Dato inválido';

        return etiqueta
          ? `${etiqueta}: ${descripcion}`
          : descripcion;
      })
      .filter(Boolean)
      .join('\n');
  }

  return 'No se pudo crear la cuenta. Inténtalo nuevamente.';
}

export default function RegistroScreen() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] =
    useState('');

  const [ciudad, setCiudad] = useState('Poza Rica');
  const [colonia, setColonia] = useState('');
  const [rol, setRol] = useState<Rol>('cliente');

  const [mostrarSugerencias, setMostrarSugerencias] =
    useState(false);

  const [mostrarClave, setMostrarClave] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] =
    useState(false);

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [correoExistente, setCorreoExistente] =
    useState(false);

  const [buscandoUbicacion, setBuscandoUbicacion] =
    useState(false);
  const [mensajeUbicacion, setMensajeUbicacion] =
    useState('');
  const [ubicacionDetectada, setUbicacionDetectada] =
    useState(false);

  // =========================================
  // BUSCADOR DE COLONIAS
  // =========================================

  const busquedaColonia = normalizarBusqueda(colonia);

  const coloniasFiltradas =
    busquedaColonia.length > 0
      ? COLONIAS_SUGERIDAS.filter((nombreColonia) =>
          normalizarBusqueda(nombreColonia).includes(
            busquedaColonia
          )
        ).slice(0, 6)
      : [];

  function seleccionarColonia(nombreColonia: string) {
    setColonia(nombreColonia);
    setMostrarSugerencias(false);
    setUbicacionDetectada(false);
    setMensajeUbicacion('');
    limpiarMensaje();
  }

  // =========================================
  // VALIDACIÓN DE CONTRASEÑA
  // =========================================

  const requisitosClave = [
    {
      texto: 'Al menos 8 caracteres',
      valido: contrasena.length >= 8,
    },
    {
      texto: 'Una letra mayúscula',
      valido: /[A-Z]/.test(contrasena),
    },
    {
      texto: 'Una letra minúscula',
      valido: /[a-z]/.test(contrasena),
    },
    {
      texto: 'Un número',
      valido: /\d/.test(contrasena),
    },
  ];

  const claveSegura = requisitosClave.every(
    (requisito) => requisito.valido
  );

  function limpiarMensaje() {
    setMensaje('');
    setCorreoExistente(false);
  }

  function mostrarError(texto: string) {
    setMensaje(texto);
  }

  // =========================================
  // VERIFICACIÓN DE CORREO
  // =========================================

  function abrirVerificacion(email?: string) {
    const correoNormalizado = (
      email ?? correo
    ).trim().toLowerCase();

    router.replace({
      pathname: '/verificar-correo',
      params: {
        correo: correoNormalizado,
      },
    });
  }

  // =========================================
  // DETECCIÓN DE UBICACIÓN PARA WEB
  // =========================================

  async function detectarColonia() {
    if (buscandoUbicacion || cargando) {
      return;
    }

    setMensajeUbicacion('');
    setUbicacionDetectada(false);
    setMostrarSugerencias(false);

    if (Platform.OS !== 'web') {
      setMensajeUbicacion(
        'La ubicación automática estará disponible en la versión móvil próximamente. Por ahora, escribe tu colonia.'
      );
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setMensajeUbicacion(
        'Tu navegador no permite obtener la ubicación. Escribe tu colonia manualmente.'
      );
      return;
    }

    setBuscandoUbicacion(true);

    try {
      const posicion = await new Promise<GeolocationPosition>(
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

      const latitud = posicion.coords.latitude;
      const longitud = posicion.coords.longitude;
      const precision = posicion.coords.accuracy;

      const parametros = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitud),
        lon: String(longitud),
        zoom: '18',
        addressdetails: '1',
        'accept-language': 'es',
      });

      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${parametros.toString()}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo consultar el mapa. Escribe tu colonia manualmente.'
        );
      }

      const datos: {
        address?: DireccionMapa;
      } = await respuesta.json();

      const direccion = datos.address || {};

      // Nunca usamos el nombre de la ciudad
      // como si fuera el de la colonia.
      const coloniaEncontrada = [
        direccion.neighbourhood,
        direccion.suburb,
        direccion.quarter,
        direccion.residential,
        direccion.city_district,
        direccion.borough,
      ].find(
        (valor) =>
          typeof valor === 'string' &&
          valor.trim().length > 0
      );

      if (!coloniaEncontrada) {
        setMensajeUbicacion(
          'Encontramos tu ubicación, pero el mapa no identifica la colonia. Búscala en las sugerencias o escríbela manualmente.'
        );
        return;
      }

      // En computadoras la ubicación puede ser
      // demasiado imprecisa para identificar colonia.
      if (precision > 1000) {
        setMensajeUbicacion(
          `El navegador estima tu ubicación con una precisión aproximada de ${Math.round(
            precision
          )} metros. El mapa sugiere "${coloniaEncontrada}", pero no la completamos porque podría ser incorrecta. Confirma tu colonia manualmente.`
        );
        return;
      }

      setColonia(coloniaEncontrada.slice(0, 100));
      setUbicacionDetectada(true);
      setMostrarSugerencias(false);

      setMensajeUbicacion(
        `Colonia aproximada detectada. Precisión estimada: ${Math.round(
          precision
        )} metros. Comprueba que sea correcta antes de registrarte.`
      );

      limpiarMensaje();
    } catch (error) {
      const codigo =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? Number(error.code)
          : null;

      if (codigo === 1) {
        setMensajeUbicacion(
          'No concediste permiso de ubicación. Puedes escribir tu colonia manualmente.'
        );
      } else if (codigo === 2) {
        setMensajeUbicacion(
          'No se pudo determinar tu ubicación. Comprueba los permisos del navegador o escribe tu colonia.'
        );
      } else if (codigo === 3) {
        setMensajeUbicacion(
          'La ubicación tardó demasiado. Inténtalo de nuevo o escribe tu colonia.'
        );
      } else {
        setMensajeUbicacion(
          error instanceof Error
            ? error.message
            : 'No se pudo detectar la colonia. Escríbela manualmente.'
        );
      }
    } finally {
      setBuscandoUbicacion(false);
    }
  }

  // =========================================
  // REGISTRO DE USUARIOS
  // =========================================

  async function registrar() {
    if (cargando || buscandoUbicacion) {
      return;
    }

    limpiarMensaje();

    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    const email = correo.trim().toLowerCase();
    const ciudadLimpia = ciudad.trim();
    const coloniaLimpia = colonia.trim();

    if (nombreLimpio.length < 3) {
      mostrarError(
        'Escribe tu nombre completo (mínimo 3 caracteres).'
      );
      return;
    }

    if (nombreLimpio.length > 100) {
      mostrarError('El nombre es demasiado largo.');
      return;
    }

    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      mostrarError(
        'Ingresa una dirección de correo electrónico válida.'
      );
      return;
    }

    if (!claveSegura) {
      mostrarError(
        'Tu contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
      );
      return;
    }

    if (contrasena !== confirmarContrasena) {
      mostrarError('Las contraseñas no coinciden.');
      return;
    }

    if (ciudadLimpia.length < 2) {
      mostrarError('Escribe una ciudad válida.');
      return;
    }

    if (ciudadLimpia.length > 100) {
      mostrarError(
        'El nombre de la ciudad es demasiado largo.'
      );
      return;
    }

    if (coloniaLimpia.length > 100) {
      mostrarError(
        'El nombre de la colonia es demasiado largo.'
      );
      return;
    }

    setCargando(true);

    try {
      const respuesta = await fetch(
        `${API_URL}/auth/registro`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nombre: nombreLimpio,
            correo: email,
            contrasena,
            rol,
            ciudad: ciudadLimpia,
            colonia: coloniaLimpia,
          }),
        }
      );

      let datos: any = null;

      try {
        datos = await respuesta.json();
      } catch {
        if (!respuesta.ok) {
          throw new Error(
            `El servidor respondió con el error ${respuesta.status}.`
          );
        }
      }

      if (respuesta.status === 409) {
        setCorreoExistente(true);
        mostrarError(
          'Este correo ya está registrado. Si todavía no verificaste tu cuenta, presiona "Verificar mi correo". Si ya la verificaste, inicia sesión.'
        );
        return;
      }

      if (respuesta.status === 503) {
        mostrarError(
          'Tu cuenta podría haberse creado, pero hubo un problema al enviar el correo. Puedes continuar a la verificación y solicitar un código nuevo.'
        );
        setCorreoExistente(true);
        return;
      }

      if (!respuesta.ok) {
        if (
          respuesta.status === 400 ||
          respuesta.status === 422
        ) {
          throw new Error(
            obtenerMensajeError(datos?.detail)
          );
        }

        throw new Error(
          datos?.detail
            ? obtenerMensajeError(datos.detail)
            : `No se pudo crear la cuenta (error ${respuesta.status}).`
        );
      }

      setContrasena('');
      setConfirmarContrasena('');

      abrirVerificacion(email);
    } catch (error) {
      if (error instanceof TypeError) {
        mostrarError(
          'No se pudo conectar con FastAPI. Verifica que esté funcionando en el puerto 8001.'
        );
      } else {
        mostrarError(
          error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado.'
        );
      }
    } finally {
      setCargando(false);
    }
  }

  // =========================================
  // INTERFAZ DEL REGISTRO
  // =========================================

  return (
    <KeyboardAvoidingView
      style={styles.pagina}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.contenedor}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tarjeta}>
          {/* MARCA */}

          <View style={styles.marca}>
            <View style={styles.iconoMarca}>
              <Ionicons
                name="construct-outline"
                size={22}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.nombreMarca}>
              PozaSync
            </Text>
          </View>

          <Text style={styles.titulo}>
            Crea tu cuenta
          </Text>

          <Text style={styles.descripcion}>
            Únete a PozaSync para solicitar servicios
            o trabajar como profesional.
          </Text>

          {/* AVISO DE VERIFICACIÓN */}

          <View style={styles.avisoVerificacion}>
            <Ionicons
              name="mail-unread-outline"
              size={22}
              color="#1D4ED8"
            />

            <View style={styles.avisoVerificacionContenido}>
              <Text style={styles.avisoVerificacionTitulo}>
                Verificación por correo
              </Text>

              <Text style={styles.avisoVerificacionTexto}>
                Después de registrarte, recibirás un PIN
                de 6 dígitos para activar tu cuenta.
              </Text>
            </View>
          </View>

          <View style={styles.formulario}>
            {/* NOMBRE */}

            <Text style={styles.etiqueta}>
              Nombre completo{' '}
              <Text style={styles.requerido}>*</Text>
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="person-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Nombre y apellidos"
                placeholderTextColor="#98A2B3"
                value={nombre}
                onChangeText={(valor) => {
                  setNombre(valor);
                  limpiarMensaje();
                }}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={100}
                editable={!cargando}
              />
            </View>

            {/* CORREO */}

            <Text style={styles.etiqueta}>
              Correo electrónico{' '}
              <Text style={styles.requerido}>*</Text>
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="mail-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="nombre@correo.com"
                placeholderTextColor="#98A2B3"
                value={correo}
                onChangeText={(valor) => {
                  setCorreo(valor);
                  limpiarMensaje();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={254}
                editable={!cargando}
              />
            </View>

            {/* CONTRASEÑA */}

            <Text style={styles.etiqueta}>
              Contraseña{' '}
              <Text style={styles.requerido}>*</Text>
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Crea una contraseña"
                placeholderTextColor="#98A2B3"
                value={contrasena}
                onChangeText={(valor) => {
                  setContrasena(valor);
                  limpiarMensaje();
                }}
                secureTextEntry={!mostrarClave}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!cargando}
              />

              <Pressable
                onPress={() =>
                  setMostrarClave(!mostrarClave)
                }
                accessibilityLabel={
                  mostrarClave
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                <Ionicons
                  name={
                    mostrarClave
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color="#66758A"
                />
              </Pressable>
            </View>

            {/* REQUISITOS DE CONTRASEÑA */}

            <View style={styles.requisitos}>
              {requisitosClave.map((requisito) => (
                <View
                  key={requisito.texto}
                  style={styles.filaRequisito}
                >
                  <Ionicons
                    name={
                      requisito.valido
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={15}
                    color={
                      requisito.valido
                        ? '#047857'
                        : '#98A2B3'
                    }
                  />

                  <Text
                    style={[
                      styles.textoRequisito,
                      requisito.valido &&
                        styles.textoRequisitoValido,
                    ]}
                  >
                    {requisito.texto}
                  </Text>
                </View>
              ))}
            </View>

            {/* CONFIRMAR CONTRASEÑA */}

            <Text style={styles.etiqueta}>
              Confirmar contraseña{' '}
              <Text style={styles.requerido}>*</Text>
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Repite tu contraseña"
                placeholderTextColor="#98A2B3"
                value={confirmarContrasena}
                onChangeText={(valor) => {
                  setConfirmarContrasena(valor);
                  limpiarMensaje();
                }}
                secureTextEntry={!mostrarConfirmacion}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!cargando}
              />

              <Pressable
                onPress={() =>
                  setMostrarConfirmacion(
                    !mostrarConfirmacion
                  )
                }
                accessibilityLabel="Mostrar u ocultar confirmación"
              >
                <Ionicons
                  name={
                    mostrarConfirmacion
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color="#66758A"
                />
              </Pressable>
            </View>

            {/* COINCIDENCIA DE CONTRASEÑAS */}

            {confirmarContrasena.length > 0 && (
              <View style={styles.coincidencia}>
                <Ionicons
                  name={
                    contrasena === confirmarContrasena
                      ? 'checkmark-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={16}
                  color={
                    contrasena === confirmarContrasena
                      ? '#047857'
                      : '#B42318'
                  }
                />

                <Text
                  style={[
                    styles.textoCoincidencia,
                    {
                      color:
                        contrasena === confirmarContrasena
                          ? '#047857'
                          : '#B42318',
                    },
                  ]}
                >
                  {contrasena === confirmarContrasena
                    ? 'Las contraseñas coinciden'
                    : 'Las contraseñas no coinciden'}
                </Text>
              </View>
            )}

            {/* CIUDAD */}

            <Text style={styles.etiqueta}>
              Ciudad{' '}
              <Text style={styles.requerido}>*</Text>
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="location-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Ciudad"
                placeholderTextColor="#98A2B3"
                value={ciudad}
                onChangeText={(valor) => {
                  setCiudad(valor);
                  limpiarMensaje();
                }}
                autoCapitalize="words"
                maxLength={100}
                editable={!cargando}
              />
            </View>

            {/* ================================= */}
            {/* BUSCADOR DE COLONIAS */}
            {/* ================================= */}

            <Text style={styles.etiqueta}>
              Colonia
            </Text>

            <View style={styles.campoColonia}>
              <Ionicons
                name="search-outline"
                size={19}
                color="#66758A"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Buscar colonia o escribirla"
                placeholderTextColor="#98A2B3"
                value={colonia}
                onFocus={() => {
                  setMostrarSugerencias(true);
                }}
                onChangeText={(valor) => {
                  setColonia(valor);
                  setMostrarSugerencias(true);
                  setUbicacionDetectada(false);
                  setMensajeUbicacion('');
                  limpiarMensaje();
                }}
                autoCapitalize="words"
                maxLength={100}
                editable={!cargando && !buscandoUbicacion}
              />

              {colonia.length > 0 && !ubicacionDetectada && (
                <Pressable
                  onPress={() => {
                    setColonia('');
                    setMostrarSugerencias(false);
                    setMensajeUbicacion('');
                  }}
                  disabled={cargando || buscandoUbicacion}
                  accessibilityLabel="Borrar colonia"
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#98A2B3"
                  />
                </Pressable>
              )}

              {ubicacionDetectada && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#047857"
                />
              )}
            </View>

            {/* SUGERENCIAS */}

            {mostrarSugerencias &&
              coloniasFiltradas.length > 0 && (
                <View style={styles.listaSugerencias}>
                  {coloniasFiltradas.map(
                    (nombreColonia) => (
                      <Pressable
                        key={nombreColonia}
                        style={styles.opcionSugerencia}
                        onPress={() =>
                          seleccionarColonia(nombreColonia)
                        }
                        disabled={
                          cargando || buscandoUbicacion
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                          `Seleccionar colonia ${nombreColonia}`
                        }
                      >
                        <Ionicons
                          name="location-outline"
                          size={17}
                          color="#66758A"
                        />

                        <Text style={styles.textoSugerencia}>
                          {nombreColonia}
                        </Text>

                        <Ionicons
                          name="chevron-forward-outline"
                          size={16}
                          color="#98A2B3"
                        />
                      </Pressable>
                    )
                  )}
                </View>
              )}

            {/* SI NO HAY SUGERENCIAS */}

            {mostrarSugerencias &&
              busquedaColonia.length >= 2 &&
              coloniasFiltradas.length === 0 && (
                <View style={styles.sinSugerencias}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#66758A"
                  />

                  <Text style={styles.textoSinSugerencias}>
                    No está en la lista inicial. Puedes
                    escribir tu colonia manualmente.
                  </Text>
                </View>
              )}

            {/* BOTÓN DE UBICACIÓN */}

            <Pressable
              style={[
                styles.botonUbicacion,
                (buscandoUbicacion || cargando) &&
                  styles.botonUbicacionDeshabilitado,
              ]}
              onPress={detectarColonia}
              disabled={buscandoUbicacion || cargando}
              accessibilityRole="button"
              accessibilityLabel="Usar mi ubicación actual"
            >
              {buscandoUbicacion ? (
                <ActivityIndicator
                  size="small"
                  color="#1D4ED8"
                />
              ) : (
                <Ionicons
                  name="locate-outline"
                  size={19}
                  color="#1D4ED8"
                />
              )}

              <Text style={styles.textoBotonUbicacion}>
                {buscandoUbicacion
                  ? 'Detectando tu ubicación...'
                  : 'Usar mi ubicación actual'}
              </Text>
            </Pressable>

            {/* MENSAJE DE UBICACIÓN */}

            {mensajeUbicacion ? (
              <View style={styles.mensajeUbicacion}>
                <Ionicons
                  name={
                    ubicacionDetectada
                      ? 'checkmark-circle-outline'
                      : 'information-circle-outline'
                  }
                  size={17}
                  color={
                    ubicacionDetectada
                      ? '#047857'
                      : '#66758A'
                  }
                />

                <Text
                  style={[
                    styles.textoMensajeUbicacion,
                    ubicacionDetectada &&
                      styles.textoUbicacionCorrecta,
                  ]}
                >
                  {mensajeUbicacion}
                </Text>
              </View>
            ) : null}

            <Text style={styles.ayudaColonia}>
              Las sugerencias son una lista inicial,
              no un catálogo completo. Puedes escribir
              cualquier colonia manualmente. No guardamos
              tus coordenadas GPS en el registro.
            </Text>

            {/* ================================= */}
            {/* TIPO DE CUENTA */}
            {/* ================================= */}

            <Text style={styles.etiqueta}>
              ¿Cómo utilizarás PozaSync?
            </Text>

            <View style={styles.roles}>
              {/* CLIENTE */}

              <Pressable
                style={[
                  styles.opcionRol,
                  rol === 'cliente' && styles.rolActivo,
                ]}
                onPress={() => setRol('cliente')}
                disabled={cargando}
              >
                <Ionicons
                  name="person-outline"
                  size={23}
                  color={
                    rol === 'cliente'
                      ? '#1D4ED8'
                      : '#66758A'
                  }
                />

                <Text
                  style={[
                    styles.textoRol,
                    rol === 'cliente' &&
                      styles.textoRolActivo,
                  ]}
                >
                  Cliente
                </Text>

                <Text style={styles.descripcionRol}>
                  Buscar servicios
                </Text>
              </Pressable>

              {/* TÉCNICO */}

              <Pressable
                style={[
                  styles.opcionRol,
                  rol === 'tecnico' && styles.rolActivo,
                ]}
                onPress={() => setRol('tecnico')}
                disabled={cargando}
              >
                <Ionicons
                  name="build-outline"
                  size={23}
                  color={
                    rol === 'tecnico'
                      ? '#1D4ED8'
                      : '#66758A'
                  }
                />

                <Text
                  style={[
                    styles.textoRol,
                    rol === 'tecnico' &&
                      styles.textoRolActivo,
                  ]}
                >
                  Técnico
                </Text>

                <Text style={styles.descripcionRol}>
                  Ofrecer servicios
                </Text>
              </Pressable>
            </View>

            {/* ERROR DEL REGISTRO */}

            {mensaje ? (
              <View style={styles.mensajeError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color="#B42318"
                />

                <Text style={styles.textoMensaje}>
                  {mensaje}
                </Text>
              </View>
            ) : null}

            {/* CORREO EXISTENTE */}

            {correoExistente ? (
              <Pressable
                style={styles.botonSecundario}
                onPress={() => abrirVerificacion()}
                disabled={cargando}
              >
                <Ionicons
                  name="mail-unread-outline"
                  size={20}
                  color="#1D4ED8"
                />

                <Text style={styles.textoBotonSecundario}>
                  Verificar mi correo
                </Text>
              </Pressable>
            ) : null}

            {/* CREAR CUENTA */}

            <Pressable
              style={[
                styles.boton,
                (cargando || buscandoUbicacion) &&
                  styles.botonDeshabilitado,
              ]}
              onPress={registrar}
              disabled={cargando || buscandoUbicacion}
              accessibilityRole="button"
              accessibilityLabel="Crear cuenta"
            >
              {cargando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.textoBoton}>
                    Crear cuenta
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color="#FFFFFF"
                  />
                </>
              )}
            </Pressable>

            <Text style={styles.avisoPrivacidad}>
              Al crear una cuenta, aceptas utilizar PozaSync
              de acuerdo con sus condiciones de servicio.
            </Text>
          </View>

          {/* PIE DE PÁGINA */}

          <View style={styles.pie}>
            <Text style={styles.textoPie}>
              ¿Ya tienes una cuenta?
            </Text>

            <Pressable
              onPress={() => router.replace('/')}
              accessibilityRole="link"
            >
              <Text style={styles.enlace}>
                Iniciar sesión
              </Text>
            </Pressable>
          </View>

          <View style={styles.pieVerificacion}>
            <Text style={styles.textoPie}>
              ¿Ya te registraste y te falta verificar?
            </Text>

            <Pressable
              onPress={() => abrirVerificacion()}
              accessibilityRole="link"
            >
              <Text style={styles.enlace}>
                Introducir mi PIN
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =========================================
// ESTILOS
// =========================================

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },

  contenedor: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },

  tarjeta: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E8ECF1',
  },

  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 30,
  },

  iconoMarca: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nombreMarca: {
    fontSize: 23,
    fontWeight: '800',
    color: '#14213D',
    letterSpacing: -0.5,
  },

  titulo: {
    fontSize: 25,
    fontWeight: '700',
    color: '#152238',
    marginBottom: 9,
  },

  descripcion: {
    fontSize: 14,
    color: '#66758A',
    lineHeight: 22,
  },

  avisoVerificacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    marginTop: 22,
  },

  avisoVerificacionContenido: {
    flex: 1,
  },

  avisoVerificacionTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 4,
  },

  avisoVerificacionTexto: {
    fontSize: 12,
    color: '#475467',
    lineHeight: 19,
  },

  formulario: {
    marginTop: 27,
  },

  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 8,
  },

  requerido: {
    color: '#B42318',
  },

  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    paddingHorizontal: 13,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },

  entrada: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#152238',
    paddingVertical: 12,
    marginLeft: 10,
  },

  requisitos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: -8,
    marginBottom: 22,
  },

  filaRequisito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: '45%',
  },

  textoRequisito: {
    fontSize: 11,
    color: '#98A2B3',
  },

  textoRequisitoValido: {
    color: '#047857',
  },

  coincidencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -10,
    marginBottom: 18,
  },

  textoCoincidencia: {
    fontSize: 12,
  },

  // =====================================
  // COLONIA Y AUTOCOMPLETADO
  // =====================================

  campoColonia: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
  },

  listaSugerencias: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  opcionSugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF1',
  },

  textoSugerencia: {
    flex: 1,
    fontSize: 13,
    color: '#344054',
  },

  sinSugerencias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 6,
    borderRadius: 9,
    backgroundColor: '#F4F6F9',
  },

  textoSinSugerencias: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#66758A',
  },

  botonUbicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 43,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C7D7FF',
    borderRadius: 9,
    backgroundColor: '#F4F7FF',
  },

  botonUbicacionDeshabilitado: {
    opacity: 0.6,
  },

  textoBotonUbicacion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  mensajeUbicacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },

  textoMensajeUbicacion: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#66758A',
  },

  textoUbicacionCorrecta: {
    color: '#047857',
  },

  ayudaColonia: {
    fontSize: 11,
    lineHeight: 17,
    color: '#98A2B3',
    marginTop: 9,
    marginBottom: 22,
  },

  // =====================================
  // ROLES
  // =====================================

  roles: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 3,
  },

  opcionRol: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 7,
  },

  rolActivo: {
    borderWidth: 2,
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },

  textoRol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },

  textoRolActivo: {
    color: '#1D4ED8',
  },

  descripcionRol: {
    fontSize: 11,
    color: '#66758A',
    textAlign: 'center',
  },

  // =====================================
  // MENSAJES Y BOTONES
  // =====================================

  mensajeError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 9,
    marginTop: 22,
    backgroundColor: '#FEF3F2',
  },

  textoMensaje: {
    flex: 1,
    fontSize: 13,
    color: '#B42318',
    lineHeight: 20,
  },

  boton: {
    height: 52,
    backgroundColor: '#1D4ED8',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },

  botonDeshabilitado: {
    opacity: 0.65,
  },

  textoBoton: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  botonSecundario: {
    height: 48,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 15,
    backgroundColor: '#EFF6FF',
  },

  textoBotonSecundario: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  avisoPrivacidad: {
    fontSize: 11,
    color: '#98A2B3',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 17,
  },

  // =====================================
  // PIE DE PÁGINA
  // =====================================

  pie: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F4',
    marginTop: 29,
    paddingTop: 23,
  },

  pieVerificacion: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },

  textoPie: {
    fontSize: 13,
    color: '#66758A',
  },

  enlace: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
