
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

type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: 'cliente' | 'tecnico';
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function obtenerDetalle(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) =>
        typeof item?.msg === 'string'
          ? item.msg
          : 'Dato inválido'
      )
      .join('\n');
  }

  return '';
}

export default function InicioSesion() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');

  const [mostrarContrasena, setMostrarContrasena] =
    useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [necesitaVerificacion, setNecesitaVerificacion] =
    useState(false);

  const [usuario, setUsuario] = useState<Usuario | null>(
    null
  );

  function limpiarError() {
    setError('');
    setNecesitaVerificacion(false);
  }

  function irAVerificarCorreo() {
    router.push({
      pathname: '/verificar-correo',
      params: {
        correo: correo.trim().toLowerCase(),
      },
    });
  }

  async function iniciarSesion() {
    if (cargando) {
      return;
    }

    const email = correo.trim().toLowerCase();

    limpiarError();

    if (!email || !contrasena) {
      setError(
        'Ingresa tu correo electrónico y contraseña.'
      );
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError(
        'Ingresa una dirección de correo válida.'
      );
      return;
    }

    if (contrasena.length < 8) {
      setError(
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    setCargando(true);

    try {
      const respuesta = await fetch(
        `${API_URL}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: email,
            contrasena,
          }),
        }
      );

      let datos: any = null;

      try {
        datos = await respuesta.json();
      } catch {
        throw new Error(
          'El servidor devolvió una respuesta inválida.'
        );
      }

      if (!respuesta.ok) {
        const detalle = obtenerDetalle(datos?.detail);

        if (respuesta.status === 401) {
          throw new Error(
            'Correo o contraseña incorrectos.'
          );
        }

        if (respuesta.status === 403) {
          const mensaje =
            detalle ||
            'No se pudo iniciar sesión con esta cuenta.';

          // Mostrar la opción del PIN únicamente
          // cuando el backend indique que falta
          // verificar el correo electrónico.
          if (/verific|confirm/i.test(mensaje)) {
            setNecesitaVerificacion(true);
          }

          throw new Error(mensaje);
        }

        if (respuesta.status === 422) {
          throw new Error(
            detalle || 'Revisa los datos ingresados.'
          );
        }

        throw new Error(
          detalle ||
            'No se pudo iniciar sesión. Inténtalo nuevamente.'
        );
      }

      if (
        !datos ||
        typeof datos.access_token !== 'string' ||
        !datos.access_token
      ) {
        throw new Error(
          'No se recibió una sesión válida.'
        );
      }

      const respuestaUsuario = await fetch(
        `${API_URL}/auth/yo`,
        {
          headers: {
            Authorization: `Bearer ${datos.access_token}`,
          },
        }
      );

      if (!respuestaUsuario.ok) {
        throw new Error(
          'No se pudo cargar tu perfil.'
        );
      }

      const perfil: Usuario =
        await respuestaUsuario.json();

      if (
        !perfil ||
        typeof perfil.nombre !== 'string' ||
        typeof perfil.correo !== 'string'
      ) {
        throw new Error(
          'El servidor devolvió un perfil inválido.'
        );
      }

      setUsuario(perfil);
      setContrasena('');
      limpiarError();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? 'No hay conexión con el servidor. Comprueba que FastAPI esté encendido.'
          : e instanceof Error
            ? e.message
            : 'Ocurrió un error inesperado.'
      );
    } finally {
      setCargando(false);
    }
  }

  function cerrarSesion() {
    setUsuario(null);
    setCorreo('');
    setContrasena('');
    setMostrarContrasena(false);
    limpiarError();
  }

  // ========================================
  // PANTALLA DESPUÉS DE INICIAR SESIÓN
  // ========================================

  if (usuario) {
    return (
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenedor}
      >
        <StatusBar style="dark" />

        <View style={styles.tarjeta}>
          <View style={styles.marca}>
            <View style={styles.iconoMarca}>
              <Ionicons
                name="construct-outline"
                size={23}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.nombreMarca}>
              PozaSync
            </Text>
          </View>

          <View style={styles.iconoExito}>
            <Ionicons
              name="checkmark"
              size={30}
              color="#047857"
            />
          </View>

          <Text style={styles.titulo}>
            Hola, {usuario.nombre}
          </Text>

          <Text style={styles.descripcion}>
            Has iniciado sesión correctamente.
          </Text>

          <View style={styles.panelPerfil}>
            <Text style={styles.datoEtiqueta}>
              CORREO ELECTRÓNICO
            </Text>

            <Text style={styles.datoValor}>
              {usuario.correo}
            </Text>

            <View style={styles.separador} />

            <Text style={styles.datoEtiqueta}>
              TIPO DE CUENTA
            </Text>

            <Text style={styles.datoValor}>
              {usuario.rol === 'tecnico'
                ? 'Profesional técnico'
                : 'Cliente'}
            </Text>
          </View>

          <Text style={styles.nota}>
            Próximamente tendrás acceso a tu panel
            de servicios personalizado.
          </Text>

          <Pressable
            style={styles.botonSecundario}
            onPress={cerrarSesion}
            accessibilityRole="button"
          >
            <Text style={styles.textoBotonSecundario}>
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ========================================
  // PANTALLA DE INICIO DE SESIÓN
  // ========================================

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.contenedor}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tarjeta}>
          <View style={styles.marca}>
            <View style={styles.iconoMarca}>
              <Ionicons
                name="construct-outline"
                size={23}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.nombreMarca}>
              PozaSync
            </Text>
          </View>

          <Text style={styles.titulo}>
            Bienvenido de nuevo
          </Text>

          <Text style={styles.descripcion}>
            Ingresa a tu cuenta para encontrar
            profesionales o administrar tus servicios.
          </Text>

          <View style={styles.formulario}>
            <Text style={styles.etiqueta}>
              Correo electrónico
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="mail-outline"
                size={19}
                color="#64748B"
              />

              <TextInput
                style={styles.entrada}
                placeholder="nombre@correo.com"
                placeholderTextColor="#94A3B8"
                value={correo}
                onChangeText={(texto) => {
                  setCorreo(texto);
                  limpiarError();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={254}
                editable={!cargando}
                accessibilityLabel="Correo electrónico"
              />
            </View>

            <Text style={styles.etiqueta}>
              Contraseña
            </Text>

            <View style={styles.campo}>
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color="#64748B"
              />

              <TextInput
                style={styles.entrada}
                placeholder="Tu contraseña"
                placeholderTextColor="#94A3B8"
                value={contrasena}
                onChangeText={(texto) => {
                  setContrasena(texto);
                  limpiarError();
                }}
                secureTextEntry={!mostrarContrasena}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                editable={!cargando}
                onSubmitEditing={iniciarSesion}
                accessibilityLabel="Contraseña"
              />

              <Pressable
                onPress={() =>
                  setMostrarContrasena(
                    !mostrarContrasena
                  )
                }
                disabled={cargando}
                accessibilityRole="button"
                accessibilityLabel={
                  mostrarContrasena
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                <Ionicons
                  name={
                    mostrarContrasena
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {/* Mensaje de error del servidor */}
            {error ? (
              <View style={styles.error}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color="#B42318"
                />

                <Text style={styles.textoError}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/*
              Este botón SOLO aparece cuando
              el servidor confirma que la cuenta
              necesita verificar su correo.
            */}
            {necesitaVerificacion ? (
              <Pressable
                style={styles.botonVerificar}
                onPress={irAVerificarCorreo}
                disabled={cargando}
                accessibilityRole="button"
              >
                <Ionicons
                  name="mail-unread-outline"
                  size={20}
                  color="#1D4ED8"
                />

                <Text style={styles.textoBotonVerificar}>
                  Verificar mi correo con PIN
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.boton,
                cargando && styles.botonInactivo,
              ]}
              onPress={iniciarSesion}
              disabled={cargando}
              accessibilityRole="button"
            >
              {cargando ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Text style={styles.textoBoton}>
                    Iniciar sesión
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color="#FFFFFF"
                  />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.registro}>
            <Text style={styles.textoSecundario}>
              ¿Aún no tienes una cuenta?
            </Text>

            <Pressable
              onPress={() =>
                router.push('/registro')
              }
              accessibilityRole="link"
            >
              <Text style={styles.enlace}>
                Crear cuenta
              </Text>
            </Pressable>
          </View>

          {/*
            CORRECCIÓN:
            Se eliminó la leyenda permanente
            "¿Ya te registraste pero falta verificar?
            Introducir mi PIN".

            La verificación ahora se ofrece
            solamente cuando corresponde.
          */}

          <View style={styles.pie}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color="#64748B"
            />

            <Text style={styles.textoPie}>
              Una forma más sencilla de conectar
              con profesionales en Poza Rica.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// ESTILOS DE POZASYNC
// ==========================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },

  contenedor: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 44,
  },

  tarjeta: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    borderWidth: 1,
    borderColor: '#E8ECF1',
  },

  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 38,
  },

  iconoMarca: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  nombreMarca: {
    fontSize: 23,
    fontWeight: '800',
    color: '#14213D',
    letterSpacing: -0.6,
  },

  titulo: {
    fontSize: 25,
    fontWeight: '700',
    color: '#152238',
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  descripcion: {
    fontSize: 14,
    lineHeight: 22,
    color: '#66758A',
  },

  formulario: {
    marginTop: 30,
  },

  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 9,
  },

  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    paddingHorizontal: 14,
    marginBottom: 21,
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

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },

  textoError: {
    flex: 1,
    color: '#B42318',
    fontSize: 13,
    lineHeight: 19,
  },

  boton: {
    height: 52,
    backgroundColor: '#1D4ED8',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 5,
  },

  botonInactivo: {
    opacity: 0.6,
  },

  textoBoton: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  botonVerificar: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginBottom: 18,
  },

  textoBotonVerificar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    textAlign: 'center',
  },

  registro: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 30,
  },

  textoSecundario: {
    color: '#66758A',
    fontSize: 13,
    textAlign: 'center',
  },

  enlace: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },

  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 36,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F4',
  },

  textoPie: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#66758A',
    textAlign: 'center',
  },

  iconoExito: {
    width: 56,
    height: 56,
    backgroundColor: '#ECFDF3',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  panelPerfil: {
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    padding: 18,
    marginTop: 25,
  },

  datoEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#66758A',
    marginBottom: 7,
  },

  datoValor: {
    fontSize: 15,
    color: '#152238',
    fontWeight: '600',
  },

  separador: {
    height: 1,
    backgroundColor: '#E4E9F0',
    marginVertical: 16,
  },

  nota: {
    fontSize: 13,
    lineHeight: 20,
    color: '#66758A',
    textAlign: 'center',
    marginVertical: 25,
  },

  botonSecundario: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoBotonSecundario: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
  },
});
