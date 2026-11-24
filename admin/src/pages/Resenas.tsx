import { useEffect, useState } from 'react'
import {
  Star,
  MessageSquare,
  Eye,
  EyeOff,
  Archive,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
  User,
  Wrench,
  ClipboardList,
  History,
} from 'lucide-react'
import axios from 'axios'
import api from '../services/api'
import './Resenas.css'

interface Participante {
  id: string | null
  nombre: string
  correo: string | null
  ciudad: string | null
  activo: boolean
  existe: boolean
}

interface Evento {
  accion: string
  motivo: string
  administrador_id: string | null
  fecha: string
}

interface Resena {
  id: string
  calificacion: number | null
  comentario: string
  estado: 'visible' | 'oculta' | 'archivada'
  archivada: boolean
  oculta: boolean
  integridad: boolean
  registro_legacy: boolean
  cliente: Participante
  tecnico: Participante
  servicio: {
    id: string | null
    estado: string | null
    fecha_finalizacion: string | null
    existe: boolean
  }
  solicitud: {
    id: string | null
    titulo: string
    categoria: string | null
    colonia: string | null
    ciudad: string | null
    existe: boolean
  }
  fecha_creacion: string | null
  fecha_archivado: string | null
  motivo_archivado: string | null
  fecha_moderacion: string | null
  motivo_moderacion: string | null
  historial_administrativo?: Evento[]
}

interface Resumen {
  registradas: number
  operativas: number
  visibles: number
  ocultas: number
  archivadas: number
  calificacion_promedio: number
  distribucion: Record<string, number>
  calificaciones_validas: number
  calificaciones_invalidas: number
}

const resumenInicial: Resumen = {
  registradas: 0,
  operativas: 0,
  visibles: 0,
  ocultas: 0,
  archivadas: 0,
  calificacion_promedio: 0,
  distribucion: {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  },
  calificaciones_validas: 0,
  calificaciones_invalidas: 0,
}

function fecha(valor?: string | null) {
  if (!valor) return 'Sin registro'

  const normalizada = /Z$|[+-]\d{2}:\d{2}$/.test(valor)
    ? valor
    : `${valor}Z`

  const resultado = new Date(normalizada)

  if (Number.isNaN(resultado.getTime())) {
    return 'Fecha no disponible'
  }

  return resultado.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function mensajeError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detalle = error.response?.data?.detail

    if (typeof detalle === 'string') {
      return detalle
    }
  }

  return 'No fue posible completar la operación.'
}

function Estrellas({ valor }: { valor: number | null }) {
  const calificacion = valor ?? 0

  return (
    <span
      className="res-estrellas"
      aria-label={`${calificacion} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((numero) => (
        <Star
          key={numero}
          size={16}
          className={
            numero <= calificacion
              ? 'res-star-activa'
              : 'res-star-inactiva'
          }
        />
      ))}
      <strong>{valor ?? '—'}</strong>
    </span>
  )
}

function Estado({ estado }: { estado: Resena['estado'] }) {
  const etiquetas = {
    visible: 'Visible',
    oculta: 'Oculta',
    archivada: 'Archivada',
  }

  return (
    <span className={`res-estado res-estado-${estado}`}>
      {estado === 'visible' && <Eye size={13} />}
      {estado === 'oculta' && <EyeOff size={13} />}
      {estado === 'archivada' && <Archive size={13} />}
      {etiquetas[estado]}
    </span>
  )
}

export default function Resenas() {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [resumen, setResumen] = useState<Resumen>(resumenInicial)

  const [busqueda, setBusqueda] = useState('')
  const [calificacion, setCalificacion] = useState('0')
  const [estado, setEstado] = useState('operativas')

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [actualizacion, setActualizacion] = useState(0)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [idDetalle, setIdDetalle] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Resena | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')

  const [moderacion, setModeracion] = useState<boolean | null>(null)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const limite = 10
  const paginas = Math.max(1, Math.ceil(total / limite))

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)
    setError('')

    const temporizador = window.setTimeout(async () => {
      try {
        const respuesta = await api.get('/admin/resenas', {
          params: {
            pagina,
            limite,
            busqueda,
            calificacion: Number(calificacion),
            estado,
          },
          signal: controlador.signal,
        })

        if (controlador.signal.aborted) return

        setResenas(respuesta.data.resenas)
        setResumen(respuesta.data.resumen)
        setTotal(respuesta.data.total)

        const maximo = Math.max(
          1,
          Math.ceil(respuesta.data.total / limite),
        )

        if (pagina > maximo) {
          setPagina(maximo)
        }
      } catch (error) {
        if (!controlador.signal.aborted) {
          setError(mensajeError(error))
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      }
    }, 250)

    return () => {
      window.clearTimeout(temporizador)
      controlador.abort()
    }
  }, [pagina, busqueda, calificacion, estado, actualizacion])

  useEffect(() => {
    if (!idDetalle) return

    const controlador = new AbortController()

    setCargandoDetalle(true)
    setErrorDetalle('')
    setDetalle(null)

    api
      .get(`/admin/resenas/${encodeURIComponent(idDetalle)}`, {
        signal: controlador.signal,
      })
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          setDetalle(respuesta.data)
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          setErrorDetalle(mensajeError(error))
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setCargandoDetalle(false)
        }
      })

    return () => controlador.abort()
  }, [idDetalle, actualizacion])

  useEffect(() => {
    function manejarEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !guardando) {
        setModeracion(null)
        setIdDetalle(null)
        setDetalle(null)
        setMotivo('')
      }
    }

    window.addEventListener('keydown', manejarEscape)

    return () => {
      window.removeEventListener('keydown', manejarEscape)
    }
  }, [guardando])

  function abrirDetalle(id: string) {
    setDetalle(null)
    setModeracion(null)
    setMotivo('')
    setErrorDetalle('')
    setIdDetalle(id)
  }

  function cerrarDetalle() {
    if (guardando) return

    setIdDetalle(null)
    setDetalle(null)
    setModeracion(null)
    setMotivo('')
  }

  function iniciarModeracion(oculta: boolean) {
    setModeracion(oculta)
    setMotivo('')
    setErrorDetalle('')
    setAviso('')
  }

  async function guardarModeracion() {
    if (!detalle || moderacion === null || guardando) return

    if (motivo.trim().length < 5) {
      setErrorDetalle('El motivo debe contener al menos 5 caracteres.')
      return
    }

    setGuardando(true)
    setErrorDetalle('')

    try {
      const respuesta = await api.patch(
        `/admin/resenas/${encodeURIComponent(detalle.id)}/moderacion`,
        {
          oculta: moderacion,
          motivo: motivo.trim(),
        },
      )

      setAviso(respuesta.data.mensaje)
      setModeracion(null)
      setMotivo('')
      setActualizacion((valor) => valor + 1)
    } catch (error) {
      setErrorDetalle(mensajeError(error))
    } finally {
      setGuardando(false)
    }
  }

  const tarjetas = [
    {
      titulo: 'Reseñas operativas',
      valor: resumen.operativas,
      icono: MessageSquare,
      color: 'blue',
    },
    {
      titulo: 'Calificación promedio',
      valor: resumen.calificacion_promedio.toFixed(1),
      icono: Star,
      color: 'yellow',
    },
    {
      titulo: 'Visibles',
      valor: resumen.visibles,
      icono: Eye,
      color: 'green',
    },
    {
      titulo: 'Ocultas',
      valor: resumen.ocultas,
      icono: EyeOff,
      color: 'red',
    },
    {
      titulo: 'Archivadas',
      valor: resumen.archivadas,
      icono: Archive,
      color: 'gray',
    },
  ]

  return (
    <div className="res-page">
      <header className="res-header">
        <div>
          <h1>Reseñas y calificaciones</h1>
          <p>
            Supervisa la reputación de los técnicos y modera
            las opiniones de los clientes.
          </p>
        </div>

        <button
          className="res-button res-button-secondary"
          onClick={() => setActualizacion((valor) => valor + 1)}
          disabled={cargando}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>

      {aviso && (
        <div className="res-alert res-alert-success" role="status">
          <ShieldCheck size={19} />
          <span>{aviso}</span>
          <button
            onClick={() => setAviso('')}
            aria-label="Cerrar aviso"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="res-stats">
        {tarjetas.map((tarjeta) => {
          const Icono = tarjeta.icono

          return (
            <article className="res-stat" key={tarjeta.titulo}>
              <div className={`res-stat-icon res-icon-${tarjeta.color}`}>
                <Icono size={22} />
              </div>

              <div>
                <span>{tarjeta.titulo}</span>
                <strong>{tarjeta.valor}</strong>
              </div>
            </article>
          )
        })}
      </div>

      <section className="res-card res-distribution">
        <div className="res-rating-summary">
          <h2>Reputación general</h2>

          <div className="res-rating-number">
            {resumen.calificacion_promedio.toFixed(1)}
            <small> / 5</small>
          </div>

          <Estrellas
            valor={Math.round(resumen.calificacion_promedio)}
          />

          <p>
            {resumen.calificaciones_validas} calificaciones visibles
          </p>
        </div>

        <div className="res-distribution-bars">
          {[5, 4, 3, 2, 1].map((numero) => {
            const cantidad =
              resumen.distribucion[String(numero)] ?? 0

            const porcentaje = resumen.calificaciones_validas
              ? (cantidad / resumen.calificaciones_validas) * 100
              : 0

            return (
              <div className="res-bar-row" key={numero}>
                <span>{numero} <Star size={14} /></span>

                <div className="res-bar-track">
                  <div
                    className="res-bar-fill"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>

                <strong>{cantidad}</strong>
              </div>
            )
          })}
        </div>
      </section>

      {resumen.calificaciones_invalidas > 0 && (
        <div className="res-alert res-alert-error">
          Existen {resumen.calificaciones_invalidas} calificaciones
          visibles que requieren revisión.
        </div>
      )}

      <section className="res-card res-list">
        <div className="res-list-header">
          <div>
            <h2>Registro de reseñas</h2>
            <p>{total} resultados encontrados</p>
          </div>
        </div>

        <div className="res-filters">
          <div className="res-search">
            <Search size={18} />
            <input
              value={busqueda}
              maxLength={100}
              placeholder="Buscar cliente, técnico o comentario..."
              aria-label="Buscar reseñas"
              onChange={(evento) => {
                setBusqueda(evento.target.value)
                setPagina(1)
              }}
            />
          </div>

          <select
            value={calificacion}
            aria-label="Filtrar calificación"
            onChange={(evento) => {
              setCalificacion(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="0">Todas las calificaciones</option>
            {[5, 4, 3, 2, 1].map((numero) => (
              <option key={numero} value={numero}>
                {numero} {numero === 1 ? 'estrella' : 'estrellas'}
              </option>
            ))}
          </select>

          <select
            value={estado}
            aria-label="Filtrar estado"
            onChange={(evento) => {
              setEstado(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="operativas">Operativas</option>
            <option value="visibles">Visibles</option>
            <option value="ocultas">Ocultas</option>
            <option value="archivadas">Archivadas</option>
            <option value="todas">Todos los registros</option>
          </select>
        </div>

        {error ? (
          <div className="res-alert res-alert-error">{error}</div>
        ) : cargando ? (
          <div className="res-empty">Cargando reseñas...</div>
        ) : resenas.length === 0 ? (
          <div className="res-empty">
            <MessageSquare size={36} />
            <h3>No se encontraron reseñas</h3>
            <p>Prueba con otros filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="res-table-wrapper">
            <table className="res-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Técnico</th>
                  <th>Calificación</th>
                  <th>Comentario</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {resenas.map((resena) => (
                  <tr key={resena.id}>
                    <td>
                      <strong>{resena.cliente.nombre}</strong>
                      <small>{resena.cliente.correo || 'Sin correo'}</small>
                    </td>

                    <td>
                      <strong>{resena.tecnico.nombre}</strong>
                      <small>{resena.tecnico.correo || 'Sin correo'}</small>
                    </td>

                    <td>
                      <Estrellas valor={resena.calificacion} />
                    </td>

                    <td>
                      <div className="res-comment-preview">
                        {resena.comentario || 'Sin comentario'}
                      </div>
                    </td>

                    <td>
                      <Estado estado={resena.estado} />
                    </td>

                    <td>{fecha(resena.fecha_creacion)}</td>

                    <td>
                      <button
                        className="res-view-button"
                        onClick={() => abrirDetalle(resena.id)}
                        title="Ver detalle de reseña"
                      >
                        <Eye size={17} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="res-pagination">
          <span>
            Página {pagina} de {paginas} · {total} registros
          </span>

          <div>
            <button
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina((valor) => valor - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              disabled={pagina >= paginas || cargando}
              onClick={() => setPagina((valor) => valor + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </footer>
      </section>

      {idDetalle && (
        <div
          className="res-overlay"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) {
              cerrarDetalle()
            }
          }}
        >
          <section
            className="res-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de reseña"
          >
            <header className="res-modal-header">
              <div>
                <h2>Detalle de reseña</h2>
                <p>Información y moderación administrativa</p>
              </div>

              <button
                className="res-close"
                onClick={cerrarDetalle}
                disabled={guardando}
                aria-label="Cerrar detalle"
              >
                <X size={22} />
              </button>
            </header>

            <div className="res-modal-body">
              {errorDetalle && (
                <div className="res-alert res-alert-error" role="alert">
                  {errorDetalle}
                </div>
              )}

              {cargandoDetalle && (
                <div className="res-empty">Cargando información...</div>
              )}

              {detalle && (
                <>
                  <div className="res-detail-rating">
                    <div>
                      <span>Calificación del servicio</span>
                      <Estrellas valor={detalle.calificacion} />
                    </div>

                    <Estado estado={detalle.estado} />
                  </div>

                  <section className="res-detail-section">
                    <h3><MessageSquare size={18} /> Comentario</h3>
                    <div className="res-comment-full">
                      {detalle.comentario || 'El cliente no dejó comentario.'}
                    </div>
                    <small>{fecha(detalle.fecha_creacion)}</small>
                  </section>

                  <div className="res-participants">
                    <section className="res-detail-section">
                      <h3><User size={18} /> Cliente</h3>
                      <strong>{detalle.cliente.nombre}</strong>
                      <p>{detalle.cliente.correo || 'Sin correo'}</p>
                      <p>{detalle.cliente.ciudad || 'Sin ciudad'}</p>
                    </section>

                    <section className="res-detail-section">
                      <h3><Wrench size={18} /> Técnico</h3>
                      <strong>{detalle.tecnico.nombre}</strong>
                      <p>{detalle.tecnico.correo || 'Sin correo'}</p>
                      <p>{detalle.tecnico.ciudad || 'Sin ciudad'}</p>
                    </section>
                  </div>

                  <section className="res-detail-section">
                    <h3><ClipboardList size={18} /> Servicio relacionado</h3>

                    <strong>{detalle.solicitud.titulo}</strong>

                    <p>
                      Categoría: {detalle.solicitud.categoria || 'No disponible'}
                    </p>

                    <p>
                      Estado: {detalle.servicio.estado || 'No disponible'}
                    </p>

                    <p>
                      Finalización: {fecha(detalle.servicio.fecha_finalizacion)}
                    </p>
                  </section>

                  {!detalle.integridad && (
                    <div className="res-alert res-alert-warning">
                      Este registro contiene referencias incompletas
                      o inconsistentes.
                    </div>
                  )}

                  {detalle.archivada && (
                    <section className="res-detail-section res-archive-info">
                      <h3><Archive size={18} /> Registro histórico</h3>
                      <p>{detalle.motivo_archivado || 'Sin motivo registrado'}</p>
                      <small>{fecha(detalle.fecha_archivado)}</small>
                      <p>Este registro no puede moderarse.</p>
                    </section>
                  )}

                  {detalle.motivo_moderacion && (
                    <section className="res-detail-section">
                      <h3><ShieldCheck size={18} /> Última moderación</h3>
                      <p>{detalle.motivo_moderacion}</p>
                      <small>{fecha(detalle.fecha_moderacion)}</small>
                    </section>
                  )}

                  <section className="res-detail-section">
                    <h3><History size={18} /> Historial administrativo</h3>

                    {!detalle.historial_administrativo?.length ? (
                      <p>No existen acciones administrativas registradas.</p>
                    ) : (
                      <div className="res-history">
                        {[...detalle.historial_administrativo]
                          .reverse()
                          .map((evento, indice) => (
                            <article key={`${evento.fecha}-${indice}`}>
                              <strong>
                                {evento.accion.replaceAll('_', ' ')}
                              </strong>
                              <p>{evento.motivo}</p>
                              <small>{fecha(evento.fecha)}</small>
                              <small>
                                Administrador: {
                                  evento.administrador_id || 'Mantenimiento local'
                                }
                              </small>
                            </article>
                          ))}
                      </div>
                    )}
                  </section>

                  {moderacion !== null && (
                    <section className="res-moderation">
                      <h3>
                        {moderacion ? 'Ocultar reseña' : 'Restaurar reseña'}
                      </h3>

                      <p>
                        {moderacion
                          ? 'La reseña dejará de aparecer públicamente y se excluirá del cálculo de reputación.'
                          : 'La reseña volverá a aparecer públicamente y se incluirá en la reputación del técnico.'}
                      </p>

                      <label htmlFor="res-motivo">
                        Motivo de la acción
                      </label>

                      <textarea
                        id="res-motivo"
                        value={motivo}
                        maxLength={300}
                        disabled={guardando}
                        placeholder="Describe el motivo de la moderación..."
                        onChange={(evento) => setMotivo(evento.target.value)}
                      />

                      <small>{motivo.length}/300 caracteres</small>

                      <div className="res-moderation-actions">
                        <button
                          className="res-button res-button-secondary"
                          disabled={guardando}
                          onClick={() => {
                            setModeracion(null)
                            setMotivo('')
                            setErrorDetalle('')
                          }}
                        >
                          Cancelar
                        </button>

                        <button
                          className={`res-button ${
                            moderacion
                              ? 'res-button-danger'
                              : 'res-button-primary'
                          }`}
                          disabled={guardando || motivo.trim().length < 5}
                          onClick={guardarModeracion}
                        >
                          {guardando ? 'Guardando...' : 'Confirmar acción'}
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="res-id">
                    ID: {detalle.id}
                  </div>
                </>
              )}
            </div>

            <footer className="res-modal-footer">
              <button
                className="res-button res-button-secondary"
                onClick={cerrarDetalle}
                disabled={guardando}
              >
                Cerrar
              </button>

              {detalle &&
                !detalle.archivada &&
                detalle.integridad &&
                moderacion === null && (
                  <button
                    className={`res-button ${
                      detalle.oculta
                        ? 'res-button-primary'
                        : 'res-button-danger'
                    }`}
                    onClick={() => iniciarModeracion(!detalle.oculta)}
                    disabled={guardando}
                  >
                    {detalle.oculta
                      ? <Eye size={17} />
                      : <EyeOff size={17} />}

                    {detalle.oculta
                      ? 'Restaurar reseña'
                      : 'Ocultar reseña'}
                  </button>
                )}
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}