
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
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const API_URL =
  Platform.OS === 'web'
    ? 'http://127.0.0.1:8001'
    : process.env.EXPO_PUBLIC_API_URL ||
      'http://127.0.0.1:8001';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type TipoMensaje = 'error' | 'exito' | 'informacion';

function obtenerError(detail: unknown): string {
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

  return 'Ocurrió un error. Inténtalo nuevamente.';
}

export default function VerificarCorreoScreen() {
  const parametros = useLocalSearchParams<{
    correo?: string | string[];
  }>();

  const correoInicial =
    typeof parametros.correo === 'string'
      ? parametros.correo
      : Array.isArray(parametros.correo)
        ? parametros.correo[0] || ''
        : '';

  const [correo, setCorreo] = useState(
    correoInicial.trim().toLowerCase()
  );
  const [codigo, setCodigo] = useState('');

  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] =
    useState<TipoMensaje>('informacion');

  const ocupado = verificando || reenviando;

  function mostrarMensaje(
    texto: string,
    tipo: TipoMensaje = 'error'
  ) {
    setMensaje(texto);
    setTipoMensaje(tipo);
  }

  function limpiarMensaje() {
    setMensaje('');
  }

  function correoValido(): boolean {
    const email = correo.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      mostrarMensaje(
        'Escribe un correo electrónico válido.'
      );
      return false;
    }

    return true;
  }

  async function verificarCodigo() {
    if (ocupado || verificado) {
      return;
    }

    limpiarMensaje();

    if (!correoValido()) {
      return;
    }

    if (!/^\d{6}$/.test(codigo)) {
      mostrarMensaje(
        'Introduce los 6 números del código recibido por correo.'
      );
      return;
    }

    setVerificando(true);

    try {
      const respuesta = await fetch(
        `${API_URL}/auth/verificar-correo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: correo.trim().toLowerCase(),
            codigo,
          }),
        }
      );

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        mostrarMensaje(
          obtenerError(datos?.detail)
        );
        return;
      }

      setVerificado(true);
      setCodigo('');

      mostrarMensaje(
        'Tu correo electrónico fue verificado correctamente. Ya puedes iniciar sesión.',
        'exito'
      );
    } catch {
      mostrarMensaje(
        'No se pudo conectar con FastAPI. Comprueba que el backend esté encendido en el puerto 8001.'
      );
    } finally {
      setVerificando(false);
    }
  }

  async function reenviarCodigo() {
    if (ocupado || verificado) {
      return;
    }

    limpiarMensaje();

    if (!correoValido()) {
      return;
    }

    setReenviando(true);

    try {
      const respuesta = await fetch(
        `${API_URL}/auth/reenviar-codigo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: correo.trim().toLowerCase(),
          }),
        }
      );

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        mostrarMensaje(
          obtenerError(datos?.detail)
        );
        return;
      }

      setCodigo('');

      mostrarMensaje(
        'Si existe una cuenta pendiente de verificar con ese correo, recibirás un nuevo PIN. Revisa tu bandeja de entrada y la carpeta de spam.',
        'informacion'
      );
    } catch {
      mostrarMensaje(
        'No se pudo conectar con el servidor. Comprueba que FastAPI esté funcionando.'
      );
    } finally {
      setReenviando(false);
    }
  }

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

          {verificado ? (
            <View style={styles.contenidoExito}>
              <View style={styles.circuloExito}>
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color="#047857"
                />
              </View>

              <Text style={styles.tituloCentrado}>
                ¡Correo verificado!
              </Text>

              <Text style={styles.descripcionCentrada}>
                Tu cuenta de PozaSync ya está activada.
                Ahora puedes iniciar sesión.
              </Text>

              <View style={styles.correoConfirmado}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color="#047857"
                />
                <Text style={styles.textoCorreoConfirmado}>
                  {correo.trim().toLowerCase()}
                </Text>
              </View>

              <Pressable
                style={styles.boton}
                onPress={() => router.replace('/')}
                accessibilityRole="button"
              >
                <Text style={styles.textoBoton}>
                  Ir a iniciar sesión
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.iconoCorreo}>
                <Ionicons
                  name="mail-unread-outline"
                  size={35}
                  color="#1D4ED8"
                />
              </View>

              <Text style={styles.titulo}>
                Verifica tu correo
              </Text>

              <Text style={styles.descripcion}>
                Te enviamos un PIN de 6 dígitos a tu
                correo electrónico. Escríbelo aquí
                para activar tu cuenta.
              </Text>

              <View style={styles.aviso}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color="#1D4ED8"
                />

                <Text style={styles.textoAviso}>
                  El código tiene una duración de
                  10 minutos. Si caduca, solicita
                  uno nuevo.
                </Text>
              </View>

              <Text style={styles.etiqueta}>
                Correo electrónico
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
                  editable={!ocupado}
                />
              </View>

              <Text style={styles.etiqueta}>
                Código de verificación
              </Text>

              <Text style={styles.descripcionCodigo}>
                Introduce los seis números del PIN.
              </Text>

              <View style={styles.contenedorCodigo}>
                <TextInput
                  style={styles.entradaCodigo}
                  value={codigo}
                  onChangeText={(valor) => {
                    setCodigo(
                      valor.replace(/\D/g, '').slice(0, 6)
                    );
                    limpiarMensaje();
                  }}
                  placeholder="000000"
                  placeholderTextColor="#B8C1CC"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  autoCorrect={false}
                  editable={!ocupado}
                  selectTextOnFocus
                  accessibilityLabel="PIN de seis dígitos"
                />
              </View>

              <Text style={styles.contador}>
                {codigo.length} de 6 dígitos
              </Text>

              {mensaje ? (
                <View
                  style={[
                    styles.mensaje,
                    tipoMensaje === 'error'
                      ? styles.mensajeError
                      : tipoMensaje === 'exito'
                        ? styles.mensajeExito
                        : styles.mensajeInformacion,
                  ]}
                >
                  <Ionicons
                    name={
                      tipoMensaje === 'error'
                        ? 'alert-circle-outline'
                        : tipoMensaje === 'exito'
                          ? 'checkmark-circle-outline'
                          : 'information-circle-outline'
                    }
                    size={20}
                    color={
                      tipoMensaje === 'error'
                        ? '#B42318'
                        : tipoMensaje === 'exito'
                          ? '#047857'
                          : '#1D4ED8'
                    }
                  />

                  <Text
                    style={[
                      styles.textoMensaje,
                      {
                        color:
                          tipoMensaje === 'error'
                            ? '#B42318'
                            : tipoMensaje === 'exito'
                              ? '#047857'
                              : '#1D4ED8',
                      },
                    ]}
                  >
                    {mensaje}
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.boton,
                  (ocupado || codigo.length !== 6) &&
                    styles.botonDeshabilitado,
                ]}
                onPress={verificarCodigo}
                disabled={ocupado || codigo.length !== 6}
                accessibilityRole="button"
              >
                {verificando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.textoBoton}>
                      Verificar correo
                    </Text>

                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </Pressable>

              <Text style={styles.preguntaReenvio}>
                ¿No recibiste el código?
              </Text>

              <Pressable
                style={styles.botonReenviar}
                onPress={reenviarCodigo}
                disabled={ocupado}
                accessibilityRole="button"
              >
                {reenviando ? (
                  <ActivityIndicator color="#1D4ED8" />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={19}
                      color="#1D4ED8"
                    />
                    <Text style={styles.textoReenviar}>
                      Reenviar código
                    </Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.notaReenvio}>
                Por seguridad, debes esperar al menos
                60 segundos entre solicitudes de código.
              </Text>

              <Pressable
                style={styles.volver}
                onPress={() => router.replace('/')}
              >
                <Ionicons
                  name="arrow-back-outline"
                  size={18}
                  color="#66758A"
                />

                <Text style={styles.textoVolver}>
                  Volver a iniciar sesión
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  contenedor: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 480,
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
  iconoCorreo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#152238',
    marginBottom: 10,
  },
  descripcion: {
    fontSize: 14,
    color: '#66758A',
    lineHeight: 23,
    marginBottom: 22,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    marginBottom: 26,
  },
  textoAviso: {
    flex: 1,
    fontSize: 12,
    color: '#475467',
    lineHeight: 19,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 8,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D5DCE5',
    borderRadius: 9,
    paddingHorizontal: 13,
    marginBottom: 23,
  },
  entrada: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#152238',
    paddingVertical: 12,
    marginLeft: 10,
  },
  descripcionCodigo: {
    fontSize: 12,
    color: '#66758A',
    marginBottom: 13,
  },
  contenedorCodigo: {
    borderWidth: 1,
    borderColor: '#B7C8F8',
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  entradaCodigo: {
    width: '100%',
    minHeight: 76,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 12,
    color: '#1D4ED8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  contador: {
    fontSize: 12,
    color: '#98A2B3',
    textAlign: 'right',
    marginTop: 9,
  },
  mensaje: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 9,
    marginTop: 22,
  },
  mensajeError: {
    backgroundColor: '#FEF3F2',
  },
  mensajeExito: {
    backgroundColor: '#ECFDF3',
  },
  mensajeInformacion: {
    backgroundColor: '#EFF6FF',
  },
  textoMensaje: {
    flex: 1,
    fontSize: 13,
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
    opacity: 0.55,
  },
  textoBoton: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  preguntaReenvio: {
    fontSize: 13,
    color: '#66758A',
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  botonReenviar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  textoReenviar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  notaReenvio: {
    fontSize: 11,
    color: '#98A2B3',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 5,
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F4',
    paddingTop: 23,
    marginTop: 27,
  },
  textoVolver: {
    fontSize: 13,
    fontWeight: '600',
    color: '#66758A',
  },
  contenidoExito: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  circuloExito: {
    marginBottom: 17,
  },
  tituloCentrado: {
    fontSize: 26,
    fontWeight: '800',
    color: '#152238',
    textAlign: 'center',
    marginBottom: 12,
  },
  descripcionCentrada: {
    fontSize: 14,
    color: '#66758A',
    lineHeight: 23,
    textAlign: 'center',
  },
  correoConfirmado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#ECFDF3',
    borderRadius: 10,
    padding: 14,
    marginTop: 24,
    maxWidth: '100%',
  },
  textoCorreoConfirmado: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    flexShrink: 1,
  },
});
