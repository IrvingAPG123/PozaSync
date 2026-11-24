import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Settings,
  UserRound,
  ShieldCheck,
  Server,
  ClipboardList,
  Save,
  RefreshCw,
  LogOut,
  LockKeyhole,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import api, { eliminarToken } from '../services/api'
import './Configuracion.css'

type Pestana = 'general' | 'cuenta' | 'seguridad' | 'sistema' | 'auditoria'

interface General {
  nombre_plataforma: string
  descripcion: string
  correo_contacto: string | null
  correo_soporte: string | null
  telefono_soporte: string
  ciudad: string
  estado: string
  pais: string
  zona_horaria: string
  mensaje_informativo: string
  version: number
  fecha_creacion: string | null
  fecha_actualizacion: string | null
}

interface Cuenta {
  id: string
  nombre: string
  correo: string
  rol: string
  activo: boolean
  correo_verificado: boolean
  fecha_registro: string | null
  fecha_actualizacion_perfil: string | null
  fecha_cambio_contrasena: string | null
}

interface Sistema {
  estado_general: string
  fecha_consulta: string
  api: {
    estado: string
    version: string
    tecnologia: string
    inicio: string
    segundos_activo: number
  }
  base_datos: {
    estado: string
    tecnologia: string
    latencia_ms: number | null
  }
  almacenamiento: {
    disponible: boolean
    colecciones_monitoreadas: number
    total_registros: number | null
    registros: Record<string, number>
  }
}

interface Evento {
  id: string
  origen: string
  modulo: string
  registro_id: string
  accion: string
  administrador_id: string | null
  fecha: string | null
  motivo: string | null
}

interface Auditoria {
  pagina: number
  limite: number
  total: number
  total_paginas: number
  eventos: Evento[]
  alcance: string
  origenes: {
    valor: string
    nombre: string
  }[]
}

const BASE = '/admin/configuracion'

const pestanas = [
  { id: 'general', nombre: 'General', icono: Settings },
  { id: 'cuenta', nombre: 'Mi cuenta', icono: UserRound },
  { id: 'seguridad', nombre: 'Seguridad', icono: ShieldCheck },
  { id: 'sistema', nombre: 'Sistema', icono: Server },
  { id: 'auditoria', nombre: 'Auditoría', icono: ClipboardList },
] as const

const acciones: Record<string, string> = {
  actualizacion_configuracion: 'Actualización de configuración',
  actualizacion_perfil_administrativo: 'Actualización de perfil',
  cambio_contrasena_administrativa: 'Cambio de contraseña',
  revocacion_sesiones_administrativas: 'Revocación de sesiones',
  cambio_disponibilidad: 'Cambio de disponibilidad',
  cambio_estado: 'Cambio de estado',
  ocultacion: 'Ocultación de reseña',
  restauracion: 'Restauración de reseña',
}

function fecha(valor: string | null | undefined) {
  if (!valor) return 'Sin registro'

  const normalizada = /(?:Z|[+-]\d{2}:\d{2})$/.test(valor)
    ? valor
    : `${valor}Z`

  const dato = new Date(normalizada)

  if (Number.isNaN(dato.getTime())) return 'No disponible'

  return dato.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function mensajeError(error: unknown) {
  const respuesta = error as {
    response?: {
      status?: number
      data?: { detail?: unknown }
    }
  }

  if (respuesta.response?.status === 409) {
    return 'Los datos cambiaron durante la operación. Actualiza la información.'
  }

  const detalle = respuesta.response?.data?.detail

  return typeof detalle === 'string'
    ? detalle
    : 'No fue posible completar la operación.'
}

export default function Configuracion() {
  const [pestana, setPestana] = useState<Pestana>('general')
  const [general, setGeneral] = useState<General | null>(null)
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [sistema, setSistema] = useState<Sistema | null>(null)
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null)

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [motivo, setMotivo] = useState('')
  const [nombre, setNombre] = useState('')

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [claveRevocacion, setClaveRevocacion] = useState('')

  const [pagina, setPagina] = useState(1)
  const [origen, setOrigen] = useState('todos')

  useEffect(() => {
    const controlador = new AbortController()

    async function cargar() {
      setCargando(true)
      setError('')
      setExito('')

      try {
        const opciones = {
          signal: controlador.signal,
          timeout: 30000,
        }

        if (pestana === 'general') {
          const { data } = await api.get<General>(
            `${BASE}/general`,
            opciones,
          )

          if (!controlador.signal.aborted) {
            setGeneral(data)
            setMotivo('')
          }
        }

        if (pestana === 'cuenta') {
          const { data } = await api.get<Cuenta>(
            `${BASE}/cuenta`,
            opciones,
          )

          if (!controlador.signal.aborted) {
            setCuenta(data)
            setNombre(data.nombre)
          }
        }

        if (pestana === 'sistema') {
          const { data } = await api.get<Sistema>(
            `${BASE}/sistema`,
            opciones,
          )

          if (!controlador.signal.aborted) {
            setSistema(data)
          }
        }

        if (pestana === 'auditoria') {
          const { data } = await api.get<Auditoria>(
            `${BASE}/auditoria`,
            {
              ...opciones,
              params: {
                pagina,
                limite: 10,
                origen,
              },
            },
          )

          if (!controlador.signal.aborted) {
            setAuditoria(data)
          }
        }
      } catch (e) {
        if (!controlador.signal.aborted) {
          setError(mensajeError(e))
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      }
    }

    void cargar()

    return () => controlador.abort()
  }, [pestana, recarga, pagina, origen])

  function cambiarPestana(valor: Pestana) {
    setActual('')
    setNueva('')
    setConfirmar('')
    setClaveRevocacion('')
    setPestana(valor)
  }

  function editarGeneral(
    campo: keyof General,
    valor: string,
  ) {
    setGeneral(anterior =>
      anterior
        ? { ...anterior, [campo]: valor }
        : anterior,
    )
  }

  async function ejecutar(
    operacion: () => Promise<void>,
  ) {
    if (guardando) return

    setGuardando(true)
    setError('')
    setExito('')

    try {
      await operacion()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function guardarGeneral(e: FormEvent) {
    e.preventDefault()

    if (!general) return

    await ejecutar(async () => {
      const { data } = await api.put<General>(
        `${BASE}/general`,
        {
          nombre_plataforma: general.nombre_plataforma,
          descripcion: general.descripcion,
          correo_contacto: general.correo_contacto || null,
          correo_soporte: general.correo_soporte || null,
          telefono_soporte: general.telefono_soporte,
          ciudad: general.ciudad,
          estado: general.estado,
          pais: general.pais,
          zona_horaria: general.zona_horaria,
          mensaje_informativo: general.mensaje_informativo,
          version: general.version,
          motivo: motivo.trim(),
        },
      )

      setGeneral(data)
      setMotivo('')
      setExito('Configuración guardada correctamente.')
    })
  }

  async function guardarCuenta(e: FormEvent) {
    e.preventDefault()

    await ejecutar(async () => {
      const { data } = await api.patch<Cuenta>(
        `${BASE}/cuenta`,
        { nombre: nombre.trim() },
      )

      setCuenta(data)
      setNombre(data.nombre)
      setExito('Perfil actualizado correctamente.')
    })
  }

  function cerrarSesion() {
    eliminarToken()
    window.dispatchEvent(new Event('sesion-expirada'))
  }

  async function cambiarContrasena(e: FormEvent) {
    e.preventDefault()

    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (
      nueva.length < 12 ||
      !/[A-Z]/.test(nueva) ||
      !/[a-z]/.test(nueva) ||
      !/\d/.test(nueva)
    ) {
      setError('Utiliza al menos 12 caracteres, mayúsculas, minúsculas y números.')
      return
    }

    if (!window.confirm(
      'Se cambiará tu contraseña y se cerrarán todas tus sesiones. ¿Continuar?',
    )) return

    await ejecutar(async () => {
      await api.post(`${BASE}/cuenta/contrasena`, {
        contrasena_actual: actual,
        contrasena_nueva: nueva,
        confirmar_contrasena: confirmar,
      })

      setActual('')
      setNueva('')
      setConfirmar('')

      window.alert('Contraseña actualizada. Inicia sesión nuevamente.')
      cerrarSesion()
    })
  }

  async function revocarSesiones(e: FormEvent) {
    e.preventDefault()

    if (!window.confirm(
      'Se cerrarán todas las sesiones de tu cuenta administrativa, incluida esta. ¿Continuar?',
    )) return

    await ejecutar(async () => {
      await api.post(`${BASE}/seguridad/revocar-sesiones`, {
        contrasena_actual: claveRevocacion,
      })

      setClaveRevocacion('')
      window.alert('Sesiones revocadas correctamente.')
      cerrarSesion()
    })
  }

  return (
    <div className="cfg-page">
      <header className="cfg-header">
        <div>
          <h1>Configuración</h1>
          <p>
            Administra las preferencias, seguridad y estado de PozaSync.
          </p>
        </div>

        <button
          className="cfg-btn cfg-secondary"
          disabled={cargando || guardando}
          onClick={() => setRecarga(v => v + 1)}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>

      <nav className="cfg-tabs" aria-label="Configuración">
        {pestanas.map(item => (
          <button
            key={item.id}
            disabled={guardando}
            aria-pressed={pestana === item.id}
            className={pestana === item.id ? 'active' : ''}
            onClick={() => cambiarPestana(item.id)}
          >
            <item.icono size={19} />
            {item.nombre}
          </button>
        ))}
      </nav>

      {error && (
        <div className="cfg-alert cfg-error" role="alert">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {exito && (
        <div className="cfg-alert cfg-success" role="status">
          <CheckCircle2 size={20} />
          {exito}
        </div>
      )}

      {cargando ? (
        <div className="cfg-loading">
          <RefreshCw size={25} className="cfg-spin" />
          Cargando información...
        </div>
      ) : (
        <>
          {pestana === 'general' && general && (
            <section className="cfg-card">
              <div className="cfg-card-heading">
                <Settings size={24} />
                <div>
                  <h2>Configuración general</h2>
                  <p>Información institucional de la plataforma.</p>
                </div>
              </div>

              <form onSubmit={guardarGeneral}>
                <fieldset disabled={guardando}>
                  <div className="cfg-grid">
                    <label>
                      Nombre de la plataforma
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={general.nombre_plataforma}
                        onChange={e => editarGeneral(
                          'nombre_plataforma', e.target.value,
                        )}
                      />
                    </label>

                    <label>
                      Ciudad
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={general.ciudad}
                        onChange={e => editarGeneral(
                          'ciudad', e.target.value,
                        )}
                      />
                    </label>

                    <label>
                      Estado
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={general.estado}
                        onChange={e => editarGeneral(
                          'estado', e.target.value,
                        )}
                      />
                    </label>

                    <label>
                      País
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={general.pais}
                        onChange={e => editarGeneral(
                          'pais', e.target.value,
                        )}
                      />
                    </label>

                    <label>
                      Correo de contacto
                      <input
                        type="email"
                        value={general.correo_contacto || ''}
                        onChange={e => editarGeneral(
                          'correo_contacto', e.target.value,
                        )}
                        placeholder="contacto@ejemplo.com"
                      />
                    </label>

                    <label>
                      Correo de soporte
                      <input
                        type="email"
                        value={general.correo_soporte || ''}
                        onChange={e => editarGeneral(
                          'correo_soporte', e.target.value,
                        )}
                        placeholder="soporte@ejemplo.com"
                      />
                    </label>

                    <label>
                      Teléfono de soporte
                      <input
                        type="tel"
                        maxLength={25}
                        value={general.telefono_soporte}
                        onChange={e => editarGeneral(
                          'telefono_soporte', e.target.value,
                        )}
                      />
                    </label>

                    <label>
                      Zona horaria
                      <input
                        readOnly
                        value={general.zona_horaria}
                      />
                    </label>

                    <label className="cfg-full">
                      Descripción
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={general.descripcion}
                        onChange={e => editarGeneral(
                          'descripcion', e.target.value,
                        )}
                      />
                    </label>

                    <label className="cfg-full">
                      Mensaje informativo
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={general.mensaje_informativo}
                        onChange={e => editarGeneral(
                          'mensaje_informativo', e.target.value,
                        )}
                      />
                    </label>

                    <label className="cfg-full">
                      Motivo de la modificación
                      <textarea
                        required
                        minLength={5}
                        maxLength={300}
                        rows={2}
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Describe el motivo de los cambios"
                      />
                    </label>
                  </div>

                  <div className="cfg-note">
                    Estos datos son preferencias administrativas.
                    No modifican automáticamente la identidad visual
                    ni las restricciones geográficas de la aplicación.
                  </div>

                  <div className="cfg-footer">
                    <small>
                      Versión {general.version} · Última actualización:
                      {' '}{fecha(general.fecha_actualizacion)}
                    </small>

                    <button
                      className="cfg-btn cfg-primary"
                      type="submit"
                      disabled={guardando || motivo.trim().length < 5}
                    >
                      <Save size={18} />
                      {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
          )}

          {pestana === 'cuenta' && cuenta && (
            <section className="cfg-card">
              <div className="cfg-card-heading">
                <UserRound size={24} />
                <div>
                  <h2>Mi cuenta administrativa</h2>
                  <p>Consulta y actualiza tu información personal.</p>
                </div>
              </div>

              <div className="cfg-profile">
                <div className="cfg-avatar">
                  <UserRound size={34} />
                </div>
                <div>
                  <h3>{cuenta.nombre}</h3>
                  <p>{cuenta.correo}</p>
                  <span className="cfg-status cfg-green">
                    Administrador
                  </span>
                </div>
              </div>

              <form onSubmit={guardarCuenta}>
                <fieldset disabled={guardando}>
                  <div className="cfg-grid">
                    <label>
                      Nombre completo
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                      />
                    </label>

                    <label>
                      Correo electrónico
                      <input readOnly value={cuenta.correo} />
                    </label>

                    <label>
                      Estado de la cuenta
                      <input
                        readOnly
                        value={cuenta.activo ? 'Activa' : 'Inactiva'}
                      />
                    </label>

                    <label>
                      Verificación de correo
                      <input
                        readOnly
                        value={cuenta.correo_verificado
                          ? 'Verificado'
                          : 'Pendiente'}
                      />
                    </label>

                    <label>
                      Fecha de registro
                      <input
                        readOnly
                        value={fecha(cuenta.fecha_registro)}
                      />
                    </label>

                    <label>
                      Último cambio de contraseña
                      <input
                        readOnly
                        value={fecha(cuenta.fecha_cambio_contrasena)}
                      />
                    </label>
                  </div>

                  <div className="cfg-footer">
                    <small>
                      Perfil actualizado:
                      {' '}{fecha(cuenta.fecha_actualizacion_perfil)}
                    </small>

                    <button
                      className="cfg-btn cfg-primary"
                      type="submit"
                      disabled={
                        guardando ||
                        nombre.trim().length < 2 ||
                        nombre.trim() === cuenta.nombre
                      }
                    >
                      <Save size={18} />
                      Guardar perfil
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
          )}

          {pestana === 'seguridad' && (
            <div className="cfg-stack">
              <section className="cfg-card">
                <div className="cfg-card-heading">
                  <LockKeyhole size={24} />
                  <div>
                    <h2>Cambiar contraseña</h2>
                    <p>Protege el acceso a tu cuenta administrativa.</p>
                  </div>
                </div>

                <form onSubmit={cambiarContrasena}>
                  <fieldset disabled={guardando}>
                    <div className="cfg-grid">
                      <label className="cfg-full">
                        Contraseña actual
                        <input
                          type="password"
                          required
                          maxLength={128}
                          autoComplete="current-password"
                          value={actual}
                          onChange={e => setActual(e.target.value)}
                        />
                      </label>

                      <label>
                        Nueva contraseña
                        <input
                          type="password"
                          required
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          value={nueva}
                          onChange={e => setNueva(e.target.value)}
                        />
                      </label>

                      <label>
                        Confirmar contraseña
                        <input
                          type="password"
                          required
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          value={confirmar}
                          onChange={e => setConfirmar(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="cfg-note">
                      La contraseña debe contener al menos 12 caracteres,
                      mayúsculas, minúsculas y números. Al cambiarla
                      se cerrarán todas tus sesiones administrativas.
                    </div>

                    <div className="cfg-footer">
                      <button
                        className="cfg-btn cfg-primary"
                        type="submit"
                        disabled={guardando}
                      >
                        <LockKeyhole size={18} />
                        Cambiar contraseña
                      </button>
                    </div>
                  </fieldset>
                </form>
              </section>

              <section className="cfg-card cfg-danger-card">
                <div className="cfg-card-heading">
                  <LogOut size={24} />
                  <div>
                    <h2>Cerrar todas las sesiones</h2>
                    <p>
                      Invalida los accesos existentes de tu cuenta
                      en todos los dispositivos.
                    </p>
                  </div>
                </div>

                <form onSubmit={revocarSesiones}>
                  <fieldset disabled={guardando}>
                    <label>
                      Confirma tu contraseña actual
                      <input
                        type="password"
                        required
                        maxLength={128}
                        autoComplete="current-password"
                        value={claveRevocacion}
                        onChange={e => setClaveRevocacion(e.target.value)}
                      />
                    </label>

                    <div className="cfg-footer">
                      <button
                        className="cfg-btn cfg-danger"
                        type="submit"
                        disabled={guardando}
                      >
                        <LogOut size={18} />
                        Revocar sesiones
                      </button>
                    </div>
                  </fieldset>
                </form>
              </section>
            </div>
          )}

          {pestana === 'sistema' && sistema && (
            <div className="cfg-stack">
              <div className="cfg-system-grid">
                <article className="cfg-card cfg-metric">
                  <Server size={25} />
                  <span>Estado de la API</span>
                  <strong>{sistema.api.estado}</strong>
                  <small>Versión {sistema.api.version}</small>
                </article>

                <article className="cfg-card cfg-metric">
                  <Database size={25} />
                  <span>Base de datos</span>
                  <strong>{sistema.base_datos.estado.replaceAll('_', ' ')}</strong>
                  <small>{sistema.base_datos.tecnologia}</small>
                </article>

                <article className="cfg-card cfg-metric">
                  <RefreshCw size={25} />
                  <span>Latencia de MongoDB</span>
                  <strong>
                    {sistema.base_datos.latencia_ms === null
                      ? 'N/D'
                      : `${sistema.base_datos.latencia_ms} ms`}
                  </strong>
                  <small>Tiempo de respuesta del ping</small>
                </article>

                <article className="cfg-card cfg-metric">
                  <ClipboardList size={25} />
                  <span>Registros almacenados</span>
                  <strong>
                    {sistema.almacenamiento.total_registros
                      ?.toLocaleString('es-MX') ?? 'N/D'}
                  </strong>
                  <small>Conteo estimado</small>
                </article>
              </div>

              <section className="cfg-card">
                <div className="cfg-card-heading">
                  <Database size={24} />
                  <div>
                    <h2>Almacenamiento de registros</h2>
                    <p>Distribución por colección de MongoDB.</p>
                  </div>
                </div>

                {!sistema.almacenamiento.disponible ? (
                  <p>No fue posible obtener los conteos.</p>
                ) : (
                  <div className="cfg-storage">
                    {Object.entries(
                      sistema.almacenamiento.registros,
                    ).map(([clave, cantidad]) => (
                      <div className="cfg-storage-row" key={clave}>
                        <div>
                          <span>{clave.replaceAll('_', ' ')}</span>
                          <strong>{cantidad.toLocaleString('es-MX')}</strong>
                        </div>

                        <div className="cfg-track">
                          <div
                            style={{
                              width: `${
                                cantidad /
                                Math.max(
                                  1,
                                  ...Object.values(
                                    sistema.almacenamiento.registros,
                                  ),
                                ) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="cfg-note">
                  Los conteos representan documentos almacenados,
                  no espacio ocupado en disco.
                </div>
              </section>

              <section className="cfg-card">
                <h2>Información del sistema</h2>

                <div className="cfg-grid cfg-system-details">
                  <label>
                    Estado general
                    <span className={`cfg-status ${
                      sistema.estado_general === 'operativo'
                        ? 'cfg-green'
                        : 'cfg-orange'
                    }`}>
                      {sistema.estado_general}
                    </span>
                  </label>

                  <label>
                    Tecnología del backend
                    <input readOnly value={sistema.api.tecnologia} />
                  </label>

                  <label>
                    Inicio del proceso
                    <input readOnly value={fecha(sistema.api.inicio)} />
                  </label>

                  <label>
                    Última consulta
                    <input readOnly value={fecha(sistema.fecha_consulta)} />
                  </label>
                </div>
              </section>
            </div>
          )}

          {pestana === 'auditoria' && auditoria && (
            <section className="cfg-card">
              <div className="cfg-card-heading">
                <ClipboardList size={24} />
                <div>
                  <h2>Auditoría administrativa</h2>
                  <p>Historial de operaciones administrativas registradas.</p>
                </div>
              </div>

              <div className="cfg-audit-toolbar">
                <label>
                  Filtrar por módulo
                  <select
                    value={origen}
                    onChange={e => {
                      setPagina(1)
                      setOrigen(e.target.value)
                    }}
                  >
                    <option value="todos">Todos los módulos</option>
                    {auditoria.origenes.map(item => (
                      <option key={item.valor} value={item.valor}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cfg-audit-count">
                  <strong>{auditoria.total}</strong>
                  <span>Eventos registrados</span>
                </div>
              </div>

              <div className="cfg-table-wrap">
                <table className="cfg-table">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Módulo</th>
                      <th>Acción</th>
                      <th>Motivo</th>
                      <th>Administrador</th>
                    </tr>
                  </thead>

                  <tbody>
                    {auditoria.eventos.map(evento => (
                      <tr key={evento.id}>
                        <td>{fecha(evento.fecha)}</td>
                        <td>
                          <span className="cfg-module">
                            {evento.modulo}
                          </span>
                        </td>
                        <td>
                          {acciones[evento.accion] ||
                            evento.accion.replaceAll('_', ' ')}
                        </td>
                        <td>{evento.motivo || 'Sin motivo registrado'}</td>
                        <td>
                          <span title={evento.administrador_id || ''}>
                            {evento.administrador_id
                              ? `${evento.administrador_id.slice(0, 8)}...`
                              : 'Sin identificar'}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {auditoria.eventos.length === 0 && (
                      <tr>
                        <td colSpan={5} className="cfg-empty">
                          No hay eventos registrados para este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="cfg-footer">
                <small>
                  Página {pagina} de {Math.max(1, auditoria.total_paginas)}
                </small>

                <div className="cfg-pagination">
                  <button
                    className="cfg-btn cfg-secondary"
                    disabled={pagina <= 1}
                    onClick={() => setPagina(p => p - 1)}
                  >
                    Anterior
                  </button>

                  <button
                    className="cfg-btn cfg-secondary"
                    disabled={pagina >= auditoria.total_paginas}
                    onClick={() => setPagina(p => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>

              <div className="cfg-note">
                {auditoria.alcance}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}