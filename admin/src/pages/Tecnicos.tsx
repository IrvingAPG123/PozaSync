import { useEffect, useState } from 'react'

import {
  Wrench,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  UserCheck,
  ShieldOff,
  ShieldCheck,
  Star,
  Eye,
  RefreshCw,
  X,
  BriefcaseBusiness,
  Power,
} from 'lucide-react'

import axios from 'axios'

import api from '../services/api'

import type {
  Tecnico,
  DetalleTecnico,
  RespuestaTecnicos,
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


function formatoFecha(fecha?: string | null) {
  if (!fecha) {
    return 'Sin registrar'
  }

  return new Date(fecha).toLocaleString('es-MX')
}


function especialidades(tecnico: Tecnico) {
  return tecnico.especialidades?.join(', ') ||
    tecnico.especialidad ||
    'Sin especialidades'
}


type AccionTecnico = {
  tecnico: Tecnico
  tipo: 'estado' | 'disponibilidad'
}


export default function Tecnicos() {
  const [datos, setDatos] =
    useState<RespuestaTecnicos | null>(null)

  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')

  const [disponibilidad, setDisponibilidad] =
    useState('todos')

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [actualizacion, setActualizacion] = useState(0)

  const [detalle, setDetalle] =
    useState<DetalleTecnico | null>(null)

  const [consultando, setConsultando] = useState(false)

  const [accion, setAccion] =
    useState<AccionTecnico | null>(null)

  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')


  // ==========================================
  // CONSULTAR TECNICOS
  // ==========================================

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)
    setError('')

    const temporizador = window.setTimeout(async () => {
      try {
        const respuesta =
          await api.get<RespuestaTecnicos>(
            '/admin/tecnicos',
            {
              params: {
                pagina,
                limite: 20,
                busqueda,
                estado,
                disponibilidad,
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
    }, 300)

    return () => {
      window.clearTimeout(temporizador)
      controlador.abort()
    }

  }, [
    pagina,
    busqueda,
    estado,
    disponibilidad,
    actualizacion,
  ])


  // ==========================================
  // CONSULTAR PERFIL COMPLETO
  // ==========================================

  async function consultarTecnico(tecnico: Tecnico) {
    setConsultando(true)
    setError('')

    try {
      const respuesta =
        await api.get<DetalleTecnico>(
          `/admin/tecnicos/${tecnico.id}`,
        )

      setDetalle(respuesta.data)

    } catch (error) {
      setError(obtenerError(error))

    } finally {
      setConsultando(false)
    }
  }


  // ==========================================
  // PREPARAR ACCION ADMINISTRATIVA
  // ==========================================

  function prepararAccion(
    tecnico: Tecnico,
    tipo: AccionTecnico['tipo'],
  ) {
    setDetalle(null)
    setMotivo('')
    setErrorAccion('')
    setMensaje('')

    setAccion({
      tecnico,
      tipo,
    })
  }


  // ==========================================
  // EJECUTAR ACCION ADMINISTRATIVA
  // ==========================================

  async function ejecutarAccion() {
    if (!accion || motivo.trim().length < 5) {
      setErrorAccion(
        'Escribe un motivo de al menos 5 caracteres.',
      )
      return
    }

    setProcesando(true)
    setErrorAccion('')

    try {
      const tecnico = accion.tecnico

      if (accion.tipo === 'estado') {
        await api.patch(
          `/admin/usuarios/${tecnico.usuario_id}/estado`,
          {
            activo: !tecnico.activo,
            motivo: motivo.trim(),
          },
        )

        setMensaje(
          tecnico.activo
            ? 'Cuenta suspendida correctamente.'
            : 'Cuenta reactivada correctamente.',
        )

      } else {
        await api.patch(
          `/admin/tecnicos/${tecnico.id}/disponibilidad`,
          {
            disponible: !tecnico.disponible,
            motivo: motivo.trim(),
          },
        )

        setMensaje(
          'Disponibilidad actualizada correctamente.',
        )
      }

      setAccion(null)
      setMotivo('')
      setPagina(1)
      setActualizacion((valor) => valor + 1)

    } catch (error) {
      setErrorAccion(obtenerError(error))

    } finally {
      setProcesando(false)
    }
  }


  return (
    <div className="page-content">

      {/* ENCABEZADO */}

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            ADMINISTRACIÓN
          </span>

          <h1>Gestión de técnicos</h1>

          <p className="muted">
            Administra los perfiles profesionales
            registrados en PozaSync.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            setActualizacion((valor) => valor + 1)
          }
          disabled={cargando}
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>


      {/* ESTADISTICAS */}

      <div className="stats-grid">

        <article className="stat-card">
          <div className="stat-icon blue">
            <Users size={24} />
          </div>

          <p className="muted">
            Perfiles registrados
          </p>

          <strong className="stat-value">
            {datos?.resumen?.registrados ?? '—'}
          </strong>
        </article>

        <article className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={24} />
          </div>

          <p className="muted">
            Disponibles
          </p>

          <strong className="stat-value">
            {datos?.resumen?.disponibles ?? '—'}
          </strong>
        </article>

        <article className="stat-card">
          <div className="stat-icon orange">
            <ShieldOff size={24} />
          </div>

          <p className="muted">
            Suspendidos
          </p>

          <strong className="stat-value">
            {datos?.resumen?.suspendidos ?? '—'}
          </strong>
        </article>

      </div>


      {/* BUSQUEDA Y FILTROS */}

      <div className="panel tecnico-filtros">

        <div className="tecnico-busqueda">
          <Search size={19} />

          <input
            type="search"
            aria-label="Buscar técnicos"
            placeholder="Buscar nombre, correo o especialidad..."
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value)
              setPagina(1)
            }}
          />
        </div>

        <select
          aria-label="Estado de cuenta"
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value)
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

        <select
          aria-label="Disponibilidad"
          value={disponibilidad}
          onChange={(evento) => {
            setDisponibilidad(evento.target.value)
            setPagina(1)
          }}
        >
          <option value="todos">
            Toda disponibilidad
          </option>

          <option value="disponible">
            Disponibles
          </option>

          <option value="no_disponible">
            No disponibles
          </option>
        </select>

      </div>


      {/* MENSAJES */}

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="admin-success">
          {mensaje}
        </div>
      )}


      {/* LISTADO DE TECNICOS */}

      {cargando ? (
        <div className="loading-state">
          Consultando técnicos...
        </div>
      ) : !error && (
        <div className="technicians-grid">

          {datos?.tecnicos.map((tecnico) => (
            <article
              className="panel technician-card"
              key={tecnico.id}
            >

              <div className="technician-heading">

                {tecnico.foto_perfil ? (
                  <img
                    className="tecnico-avatar"
                    src={tecnico.foto_perfil}
                    alt={tecnico.nombre}
                    loading="lazy"
                  />
                ) : (
                  <div className="stat-icon blue">
                    <Wrench size={24} />
                  </div>
                )}

                <span className={
                  tecnico.activo
                    ? 'status active'
                    : 'status inactive'
                }>
                  {tecnico.activo
                    ? 'Cuenta activa'
                    : 'Suspendido'}
                </span>

              </div>

              <h2>{tecnico.nombre}</h2>

              <p className="muted tecnico-correo">
                {tecnico.correo}
              </p>

              <strong>
                {especialidades(tecnico)}
              </strong>

              <p className="tecnico-descripcion muted">
                {tecnico.descripcion ||
                  'Sin descripción registrada.'}
              </p>

              <div className="tecnico-calificacion">
                <Star size={18} />

                <strong>
                  {tecnico.total_resenas > 0
                    ? tecnico.calificacion_promedio.toFixed(1)
                    : 'Sin calificar'}
                </strong>

                <span className="muted">
                  ({tecnico.total_resenas} reseñas)
                </span>
              </div>

              <p>
                Experiencia: {tecnico.experiencia_anios} años
              </p>

              <div className="coverage">
                <MapPin size={17} />

                <span>
                  {tecnico.colonias_cobertura?.join(', ') ||
                    'Sin cobertura especificada'}
                </span>
              </div>

              <span className={
                tecnico.activo && tecnico.disponible
                  ? 'status active'
                  : 'status inactive'
              }>
                {tecnico.activo && tecnico.disponible
                  ? 'Disponible'
                  : 'No disponible'}
              </span>

              <div className="tecnico-acciones">

                <button
                  className="secondary-button"
                  disabled={consultando}
                  onClick={() => consultarTecnico(tecnico)}
                >
                  <Eye size={17} />
                  Ver perfil
                </button>

                <button
                  className="secondary-button"
                  disabled={!tecnico.activo}
                  onClick={() =>
                    prepararAccion(
                      tecnico,
                      'disponibilidad',
                    )
                  }
                >
                  <Power size={17} />

                  {tecnico.disponible
                    ? 'Desactivar disponibilidad'
                    : 'Activar disponibilidad'}
                </button>

                <button
                  className={
                    tecnico.activo
                      ? 'admin-danger-button'
                      : 'admin-green-button'
                  }
                  onClick={() =>
                    prepararAccion(tecnico, 'estado')
                  }
                >
                  {tecnico.activo ? (
                    <ShieldOff size={17} />
                  ) : (
                    <ShieldCheck size={17} />
                  )}

                  {tecnico.activo
                    ? 'Suspender cuenta'
                    : 'Reactivar cuenta'}
                </button>

              </div>

            </article>
          ))}

        </div>
      )}

      {!cargando && !error && datos?.total === 0 && (
        <div className="panel loading-state">
          No se encontraron técnicos con estos filtros.
        </div>
      )}


      {/* PAGINACION */}

      <div className="pagination">

        <span className="muted">
          {datos?.total ?? '—'} perfiles encontrados
        </span>

        <div className="pagination-buttons">

          <button
            className="secondary-button"
            disabled={pagina === 1 || cargando}
            onClick={() =>
              setPagina((valor) => valor - 1)
            }
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
            onClick={() =>
              setPagina((valor) => valor + 1)
            }
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} />
          </button>

        </div>

      </div>


      {/* MODAL DE INFORMACION */}

      {detalle && (
        <div className="admin-modal-overlay">

          <section
            className="admin-modal tecnico-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Perfil del técnico"
          >

            <div className="admin-modal-heading">

              <div>
                <h2>{detalle.nombre}</h2>

                <p className="muted">
                  Perfil profesional
                </p>
              </div>

              <button
                className="icon-button"
                aria-label="Cerrar"
                onClick={() => setDetalle(null)}
              >
                <X size={22} />
              </button>

            </div>

            <h3>Información personal</h3>

            <div className="admin-detail-grid">

              <div>
                <span className="muted">Correo</span>
                <p>{detalle.correo}</p>
              </div>

              <div>
                <span className="muted">Ciudad</span>
                <p>{detalle.ciudad}</p>
              </div>

              <div>
                <span className="muted">Colonia</span>
                <p>{detalle.colonia || 'Sin registrar'}</p>
              </div>

              <div>
                <span className="muted">Estado</span>
                <p>
                  {detalle.activo
                    ? 'Activo'
                    : 'Suspendido'}
                </p>
              </div>

              <div>
                <span className="muted">
                  Correo verificado
                </span>

                <p>
                  {detalle.correo_verificado ? 'Sí' : 'No'}
                </p>
              </div>

              <div>
                <span className="muted">Registro</span>

                <p>
                  {formatoFecha(detalle.fecha_registro)}
                </p>
              </div>

            </div>

            <h3>Información profesional</h3>

            <p>
              <strong>Especialidades: </strong>
              {especialidades(detalle)}
            </p>

            <p>
              <strong>Experiencia: </strong>
              {detalle.experiencia_anios} años
            </p>

            <p>
              <strong>Cobertura: </strong>
              {detalle.colonias_cobertura?.join(', ') ||
                'Sin cobertura'}
            </p>

            <p>{detalle.descripcion}</p>

            <h3>Portafolio</h3>

            {detalle.portafolio?.length > 0 ? (
              <div className="tecnico-portafolio">
                {detalle.portafolio.map((foto, indice) => (
                  <img
                    key={`${foto}-${indice}`}
                    src={foto}
                    alt={`Trabajo ${indice + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <p className="muted">
                No tiene fotografías en su portafolio.
              </p>
            )}

            <h3>Estadísticas de servicios</h3>

            <div className="tecnico-servicios-grid">

              {[
                ['Total', detalle.servicios.total],
                ['Pendientes', detalle.servicios.pendientes],
                ['Acordados', detalle.servicios.acordados],
                ['Finalizados', detalle.servicios.finalizados],
                ['Rechazados', detalle.servicios.rechazados],
              ].map(([titulo, valor]) => (
                <div
                  className="tecnico-servicio-stat"
                  key={titulo}
                >
                  <BriefcaseBusiness size={19} />
                  <strong>{valor}</strong>
                  <span>{titulo}</span>
                </div>
              ))}

            </div>

            <h3>Calificaciones y reseñas</h3>

            <div className="tecnico-calificacion">
              <Star size={22} />

              <strong>
                {detalle.total_resenas > 0
                  ? detalle.calificacion_promedio.toFixed(2)
                  : 'Sin calificar'}
              </strong>

              <span className="muted">
                {detalle.total_resenas} reseñas
              </span>
            </div>

            {detalle.resenas.length === 0 ? (
              <p className="muted">
                Todavía no tiene reseñas.
              </p>
            ) : (
              detalle.resenas.map((resena) => (
                <article
                  className="tecnico-resena"
                  key={resena.id}
                >
                  <div className="tecnico-calificacion">
                    <Star size={16} />

                    <strong>
                      {resena.calificacion}/5
                    </strong>
                  </div>

                  <p>
                    {resena.comentario || 'Sin comentario'}
                  </p>

                  <small className="muted">
                    {formatoFecha(resena.fecha_creacion)}
                  </small>
                </article>
              ))
            )}

            <div className="admin-modal-footer">

              <button
                className="secondary-button"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>

            </div>

          </section>

        </div>
      )}


      {/* MODAL DE CONFIRMACION */}

      {accion && (
        <div className="admin-modal-overlay">

          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar acción administrativa"
          >

            <div className="admin-modal-heading">

              <h2>Confirmar acción</h2>

              <button
                className="icon-button"
                aria-label="Cerrar"
                disabled={procesando}
                onClick={() => setAccion(null)}
              >
                <X size={22} />
              </button>

            </div>

            <p>
              Técnico: <strong>{accion.tecnico.nombre}</strong>
            </p>

            <p className="muted">
              {accion.tipo === 'estado'
                ? accion.tecnico.activo
                  ? 'La cuenta será suspendida y sus sesiones anteriores quedarán revocadas.'
                  : 'La cuenta recuperará el acceso mediante un nuevo inicio de sesión.'
                : accion.tecnico.disponible
                  ? 'El perfil quedará marcado como no disponible.'
                  : 'El perfil quedará marcado como disponible.'}
            </p>

            <label htmlFor="motivo-tecnico">
              Motivo de la acción
            </label>

            <textarea
              id="motivo-tecnico"
              className="admin-textarea"
              placeholder="Escribe el motivo..."
              value={motivo}
              maxLength={300}
              disabled={procesando}
              onChange={(evento) =>
                setMotivo(evento.target.value)
              }
            />

            <small className="muted">
              {motivo.length}/300 caracteres
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
                onClick={() => setAccion(null)}
              >
                Cancelar
              </button>

              <button
                className={
                  accion.tipo === 'estado' &&
                  accion.tecnico.activo
                    ? 'admin-danger-button'
                    : 'primary-button'
                }
                disabled={
                  procesando ||
                  motivo.trim().length < 5
                }
                onClick={ejecutarAccion}
              >
                {procesando
                  ? 'Procesando...'
                  : 'Confirmar'}
              </button>

            </div>

          </section>

        </div>
      )}

    </div>
  )
}