import { useEffect, useState } from 'react'

import {
  Search,
  Users,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldOff,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react'

import axios from 'axios'
import api from '../services/api'

import type {
  Usuario,
  RespuestaUsuarios,
  RespuestaCambioEstado,
} from '../types/admin'

function obtenerError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detalle = error.response?.data?.detail

    if (typeof detalle === 'string') {
      return detalle
    }
  }

  return 'No fue posible completar la operación.'
}

function formatoFecha(fecha?: string) {
  if (!fecha) return 'Sin información'

  const valor = new Date(fecha)

  if (Number.isNaN(valor.getTime())) {
    return 'Sin información'
  }

  return valor.toLocaleString('es-MX')
}

export default function Usuarios() {
  const [datos, setDatos] =
    useState<RespuestaUsuarios | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(true)

  const [actualizacion, setActualizacion] =
    useState(0)

  const [seleccionado, setSeleccionado] =
    useState<Usuario | null>(null)

  const [confirmacion, setConfirmacion] =
    useState<Usuario | null>(null)

  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  useEffect(() => {
    const controlador = new AbortController()

    const temporizador = window.setTimeout(
      async () => {
        setCargando(true)
        setError('')

        try {
          const respuesta =
            await api.get<RespuestaUsuarios>(
              '/admin/usuarios',
              {
                params: {
                  pagina,
                  limite: 20,
                  busqueda,
                  rol,
                  estado,
                },
                signal: controlador.signal,
              },
            )

          if (!controlador.signal.aborted) {
            setDatos(respuesta.data)
          }

        } catch (error) {
          if (!controlador.signal.aborted) {
            setError(obtenerError(error))
          }

        } finally {
          if (!controlador.signal.aborted) {
            setCargando(false)
          }
        }
      },
      300,
    )

    return () => {
      window.clearTimeout(temporizador)
      controlador.abort()
    }

  }, [
    pagina,
    busqueda,
    rol,
    estado,
    actualizacion,
  ])

  async function consultarUsuario(usuario: Usuario) {
    setError('')

    try {
      const respuesta = await api.get<Usuario>(
        `/admin/usuarios/${usuario.id}`,
      )

      setSeleccionado(respuesta.data)

    } catch (error) {
      setError(obtenerError(error))
    }
  }

  function prepararCambio(usuario: Usuario) {
    setConfirmacion(usuario)
    setMotivo('')
    setErrorAccion('')
    setMensaje('')
  }

  async function cambiarEstado() {
    if (
      !confirmacion ||
      motivo.trim().length < 5 ||
      procesando
    ) {
      return
    }

    setProcesando(true)
    setErrorAccion('')

    try {
      const respuesta =
        await api.patch<RespuestaCambioEstado>(
          `/admin/usuarios/${confirmacion.id}/estado`,
          {
            activo: !confirmacion.activo,
            motivo: motivo.trim(),
          },
        )

      setMensaje(respuesta.data.mensaje)
      setConfirmacion(null)
      setSeleccionado(null)
      setMotivo('')
      setPagina(1)

      setActualizacion(
        (anterior) => anterior + 1,
      )

    } catch (error) {
      setErrorAccion(obtenerError(error))

    } finally {
      setProcesando(false)
    }
  }

  const usuarios = datos?.usuarios ?? []

  return (
    <div className="page-content">

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            ADMINISTRACIÓN
          </span>

          <h1>Gestión de usuarios</h1>

          <p className="muted">
            Consulta y administra las cuentas de
            clientes y técnicos de PozaSync.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            setActualizacion((valor) => valor + 1)
          }
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </div>

      <div className="stats-grid">

        <article className="stat-card">
          <div className="stat-icon blue">
            <Users size={23} />
          </div>

          <p className="muted">
            Usuarios registrados
          </p>

          <strong className="stat-value">
            {datos?.resumen.registrados ?? '—'}
          </strong>
        </article>

        <article className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={23} />
          </div>

          <p className="muted">
            Cuentas activas
          </p>

          <strong className="stat-value">
            {datos?.resumen.activos ?? '—'}
          </strong>
        </article>

        <article className="stat-card">
          <div className="stat-icon orange">
            <UserX size={23} />
          </div>

          <p className="muted">
            Cuentas suspendidas
          </p>

          <strong className="stat-value">
            {datos?.resumen.suspendidos ?? '—'}
          </strong>
        </article>

      </div>

      {mensaje && (
        <div
          role="status"
          className="admin-success"
        >
          <ShieldCheck size={20} />
          {mensaje}

          <button
            className="icon-button"
            onClick={() => setMensaje('')}
            aria-label="Cerrar notificación"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <article className="panel">

        <div className="table-toolbar">

          <div className="input-group">
            <Search size={18} />

            <input
              aria-label="Buscar usuarios"
              placeholder="Nombre, correo o ubicación..."
              value={busqueda}
              maxLength={100}
              onChange={(e) => {
                setCargando(true)
                setBusqueda(e.target.value)
                setPagina(1)
              }}
            />
          </div>

          <select
            aria-label="Filtrar por rol"
            value={rol}
            onChange={(e) => {
              setCargando(true)
              setRol(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">
              Todos los roles
            </option>

            <option value="cliente">
              Clientes
            </option>

            <option value="tecnico">
              Técnicos
            </option>
          </select>

          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => {
              setCargando(true)
              setEstado(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">
              Todos los estados
            </option>

            <option value="activo">
              Activos
            </option>

            <option value="suspendido">
              Suspendidos
            </option>
          </select>

        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="loading-state">
            Cargando usuarios...
          </div>
        ) : error ? (
          <div className="loading-state">
            No se pudieron cargar los resultados.
          </div>
        ) : (
          <div className="table-scroll">

            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Verificación</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>

                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>

                    <td>
                      <div className="user-cell">

                        <div className="avatar">
                          {usuario.nombre
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {usuario.nombre}
                          </strong>

                          <small>
                            {usuario.correo}
                          </small>
                        </div>

                      </div>
                    </td>

                    <td>
                      <span className="role-badge">
                        {usuario.rol === 'tecnico'
                          ? 'Técnico'
                          : 'Cliente'}
                      </span>
                    </td>

                    <td>
                      {usuario.ciudad}

                      <small>
                        {usuario.colonia}
                      </small>
                    </td>

                    <td>
                      <span className={
                        usuario.activo
                          ? 'status active'
                          : 'status inactive'
                      }>
                        {usuario.activo
                          ? 'Activo'
                          : 'Suspendido'}
                      </span>
                    </td>

                    <td>
                      {usuario.correo_verificado === true
                        ? 'Verificado'
                        : usuario.correo_verificado === false
                          ? 'Pendiente'
                          : 'Sin información'}
                    </td>

                    <td>
                      <div className="admin-actions">

                        <button
                          className="secondary-button"
                          title="Consultar usuario"
                          aria-label="Consultar usuario"
                          onClick={() =>
                            void consultarUsuario(usuario)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          className={
                            usuario.activo
                              ? 'admin-danger-button'
                              : 'admin-green-button'
                          }
                          onClick={() =>
                            prepararCambio(usuario)
                          }
                        >
                          {usuario.activo
                            ? <ShieldOff size={16} />
                            : <ShieldCheck size={16} />}

                          {usuario.activo
                            ? 'Suspender'
                            : 'Reactivar'}
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}

              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div className="loading-state">
                <Users size={32} />
                No se encontraron usuarios.
              </div>
            )}

          </div>
        )}

        <div className="pagination">

          <span className="muted">
            {datos?.total ?? '—'} resultados
          </span>

          <div className="pagination-buttons">

            <button
              className="secondary-button"
              disabled={pagina === 1 || cargando}
              onClick={() => {
                setCargando(true)
                setPagina(pagina - 1)
              }}
              aria-label="Página anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <span>Página {pagina}</span>

            <button
              className="secondary-button"
              disabled={
                cargando ||
                !datos ||
                pagina * datos.limite >= datos.total
              }
              onClick={() => {
                setCargando(true)
                setPagina(pagina + 1)
              }}
              aria-label="Página siguiente"
            >
              <ChevronRight size={18} />
            </button>

          </div>

        </div>

      </article>

      {seleccionado && (
        <div className="admin-modal-overlay">

          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-usuario"
          >

            <div className="admin-modal-heading">
              <h2 id="titulo-usuario">
                Información del usuario
              </h2>

              <button
                className="icon-button"
                aria-label="Cerrar"
                onClick={() => setSeleccionado(null)}
              >
                <X size={22} />
              </button>
            </div>

            <div className="admin-detail-grid">

              <div>
                <small>Nombre</small>
                <strong>{seleccionado.nombre}</strong>
              </div>

              <div>
                <small>Correo electrónico</small>
                <strong>{seleccionado.correo}</strong>
              </div>

              <div>
                <small>Tipo de cuenta</small>
                <strong>{seleccionado.rol}</strong>
              </div>

              <div>
                <small>Ciudad</small>
                <strong>{seleccionado.ciudad}</strong>
              </div>

              <div>
                <small>Colonia</small>
                <strong>
                  {seleccionado.colonia || 'Sin información'}
                </strong>
              </div>

              <div>
                <small>Estado</small>
                <strong>
                  {seleccionado.activo
                    ? 'Activo'
                    : 'Suspendido'}
                </strong>
              </div>

              <div>
                <small>Fecha de registro</small>
                <strong>
                  {formatoFecha(
                    seleccionado.fecha_registro,
                  )}
                </strong>
              </div>

              <div>
                <small>Último cambio de estado</small>
                <strong>
                  {formatoFecha(
                    seleccionado.fecha_cambio_estado,
                  )}
                </strong>
              </div>

            </div>

            <div className="admin-modal-footer">
              <button
                className="secondary-button"
                onClick={() => setSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>

          </section>

        </div>
      )}

      {confirmacion && (
        <div className="admin-modal-overlay">

          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacion"
          >

            <div className="admin-modal-heading">

              <h2 id="titulo-confirmacion">
                {confirmacion.activo
                  ? 'Suspender cuenta'
                  : 'Reactivar cuenta'}
              </h2>

              <button
                className="icon-button"
                disabled={procesando}
                aria-label="Cerrar"
                onClick={() => setConfirmacion(null)}
              >
                <X size={22} />
              </button>

            </div>

            <p>
              Usuario: <strong>
                {confirmacion.nombre}
              </strong>
            </p>

            <p className="muted">
              {confirmacion.activo
                ? 'El usuario perderá el acceso a las funciones protegidas de PozaSync. Sus datos e historial se conservarán.'
                : 'El usuario podrá volver a utilizar PozaSync si cumple los requisitos de acceso.'}
            </p>

            <label htmlFor="motivo">
              Motivo de la acción
            </label>

            <textarea
              id="motivo"
              className="admin-textarea"
              value={motivo}
              maxLength={300}
              rows={4}
              disabled={procesando}
              placeholder="Escribe el motivo..."
              onChange={(e) =>
                setMotivo(e.target.value)
              }
            />

            <small className="muted">
              {motivo.length}/300 caracteres.
              Mínimo 5.
            </small>

            {errorAccion && (
              <div className="error-box">
                {errorAccion}
              </div>
            )}

            <div className="admin-modal-footer">

              <button
                className="secondary-button"
                disabled={procesando}
                onClick={() => setConfirmacion(null)}
              >
                Cancelar
              </button>

              <button
                className={
                  confirmacion.activo
                    ? 'admin-danger-button'
                    : 'admin-green-button'
                }
                disabled={
                  procesando ||
                  motivo.trim().length < 5
                }
                onClick={() => void cambiarEstado()}
              >
                {procesando
                  ? 'Procesando...'
                  : confirmacion.activo
                    ? 'Confirmar suspensión'
                    : 'Confirmar reactivación'}
              </button>

            </div>

          </section>

        </div>
      )}

    </div>
  )
}