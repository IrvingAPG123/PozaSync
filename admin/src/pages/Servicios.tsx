import { useEffect, useState } from 'react'

import {
  BriefcaseBusiness,
  Archive,
  Clock,
  Handshake,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Wrench,
  CalendarDays,
  ClipboardList,
} from 'lucide-react'

import axios from 'axios'
import api from '../services/api'
import './Servicios.css'

interface Participante {
  id: string | null
  nombre: string
  correo: string
  ciudad: string
  activo: boolean
  existe: boolean
  foto_perfil?: string | null
}

interface Solicitud {
  id: string | null
  titulo: string
  descripcion: string
  categoria: string
  categoria_id: string
  colonia: string
  ciudad: string
  estado: string | null
  bloqueada: boolean
  existe: boolean
}

interface Servicio {
  archivado: boolean
  registro_legacy: boolean
  fecha_archivado?: string | null
  motivo_archivado?: string | null
  id: string
  conversacion_id: string | null
  solicitud_id: string | null
  estado: string
  cliente: Participante
  tecnico: Participante
  solicitud: Solicitud
  fecha_creacion?: string | null
  fecha_actualizacion?: string | null
  fecha_aceptacion?: string | null
  fecha_rechazo?: string | null
  fecha_finalizacion?: string | null
}

interface Resumen {
  archivados: number
  registrados: number
  pendientes: number
  acordados: number
  finalizados: number
  rechazados: number
  otros: number
  tasa_finalizacion: number
}

interface RespuestaServicios {
  total: number
  pagina: number
  limite: number
  resumen: Resumen
  servicios: Servicio[]
}

const resumenInicial: Resumen = {
  archivados: 0,
  registrados: 0,
  pendientes: 0,
  acordados: 0,
  finalizados: 0,
  rechazados: 0,
  otros: 0,
  tasa_finalizacion: 0,
}

const estados: Record<string, string> = {
  pendiente: 'Pendiente',
  acordado: 'Acordado',
  finalizado: 'Finalizado',
  rechazado: 'Rechazado',
}

function fecha(valor?: string | null) {
  if (!valor) return 'Sin registrar'

  const normalizada = /(?:Z|[+-]\d{2}:\d{2})$/.test(valor)
    ? valor
    : `${valor}Z`

  const resultado = new Date(normalizada)

  if (Number.isNaN(resultado.getTime())) {
    return 'Fecha no disponible'
  }

  return resultado.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  })
}

function EstadoServicio({ estado }: { estado: string }) {
  const clase = estados[estado]
    ? estado
    : 'desconocido'

  return (
    <span className={`srv-badge srv-${clase}`}>
      {estados[estado] || 'Desconocido'}
    </span>
  )
}

function DatosParticipante({
  titulo,
  participante,
}: {
  titulo: string
  participante: Participante
}) {
  return (
    <div className="srv-participant">
      <div className="srv-section-heading">
        {titulo === 'Cliente'
          ? <User size={19} />
          : <Wrench size={19} />}

        <h3>{titulo}</h3>
      </div>

      <strong>{participante.nombre}</strong>

      <span>{participante.correo || 'Sin correo'}</span>

      <span>{participante.ciudad || 'Sin ciudad'}</span>

      <span
        className={`srv-badge ${
          !participante.existe
            ? 'srv-desconocido'
            : participante.activo
              ? 'srv-finalizado'
              : 'srv-rechazado'
        }`}
      >
        {!participante.existe
          ? 'Cuenta no encontrada'
          : participante.activo
            ? 'Cuenta activa'
            : 'Cuenta suspendida'}
      </span>
    </div>
  )
}

export default function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [resumen, setResumen] = useState<Resumen>(resumenInicial)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [categoria, setCategoria] = useState('todas')
  const [archivo, setArchivo] = useState('operativos')

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [actualizacion, setActualizacion] = useState(0)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [detalle, setDetalle] = useState<Servicio | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [idDetalle, setIdDetalle] = useState('')

  const limite = 10
  const paginas = Math.max(1, Math.ceil(total / limite))

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)
    setError('')

    const temporizador = window.setTimeout(async () => {
      try {
        const respuesta = await api.get<RespuestaServicios>(
          '/admin/servicios',
          {
            params: {
              pagina,
              limite,
              busqueda,
              estado,
              categoria,
              archivo,
            },
            signal: controlador.signal,
          },
        )

        if (controlador.signal.aborted) return

        setServicios(respuesta.data.servicios)
        setResumen(respuesta.data.resumen)
        setTotal(respuesta.data.total)

        const ultimaPagina = Math.max(
          1,
          Math.ceil(respuesta.data.total / limite),
        )

        if (pagina > ultimaPagina) {
          setPagina(ultimaPagina)
        }
      } catch (err) {
        if (
          axios.isCancel(err) ||
          controlador.signal.aborted
        ) return

        setError(
          'No fue posible consultar los servicios.',
        )
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
  }, [
    pagina,
    busqueda,
    estado,
    categoria,
    archivo,
    actualizacion,
  ])

  useEffect(() => {
    if (!modalAbierto || !idDetalle) return

    const controlador = new AbortController()

    async function consultarDetalle() {
      setCargandoDetalle(true)
      setErrorDetalle('')
      setDetalle(null)

      try {
        const respuesta = await api.get<Servicio>(
          `/admin/servicios/${encodeURIComponent(idDetalle)}`,
          {
            signal: controlador.signal,
          },
        )

        if (!controlador.signal.aborted) {
          setDetalle(respuesta.data)
        }
      } catch (err) {
        if (
          axios.isCancel(err) ||
          controlador.signal.aborted
        ) return

        setErrorDetalle(
          'No fue posible consultar el detalle del servicio.',
        )
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoDetalle(false)
        }
      }
    }

    void consultarDetalle()

    return () => controlador.abort()
  }, [modalAbierto, idDetalle])

  useEffect(() => {
    if (!modalAbierto) return

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setModalAbierto(false)
      }
    }

    window.addEventListener('keydown', cerrarConEscape)

    return () => {
      window.removeEventListener(
        'keydown',
        cerrarConEscape,
      )
    }
  }, [modalAbierto])

  function abrirDetalle(id: string) {
    setDetalle(null)
    setErrorDetalle('')
    setCargandoDetalle(true)
    setIdDetalle(id)
    setModalAbierto(true)
  }

  const tarjetas = [
    {
      titulo: 'Operativos',
      cantidad: resumen.registrados,
      icono: BriefcaseBusiness,
      color: 'blue',
    },
    {
      titulo: 'Pendientes',
      cantidad: resumen.pendientes,
      icono: Clock,
      color: 'orange',
    },
    {
      titulo: 'Acordados',
      cantidad: resumen.acordados,
      icono: Handshake,
      color: 'purple',
    },
    {
      titulo: 'Finalizados',
      cantidad: resumen.finalizados,
      icono: CheckCircle,
      color: 'green',
    },
    {
      titulo: 'Rechazados',
      cantidad: resumen.rechazados,
      icono: XCircle,
      color: 'red',
    },
    {
      titulo: 'Archivados',
      cantidad: resumen.archivados,
      icono: Archive,
      color: 'gray',
    },
  ]

  return (
    <div className="srv-page">

      <div className="srv-heading">
        <div>
          <h1>Gestión de servicios</h1>

          <p>
            Supervisa las contrataciones realizadas
            entre clientes y técnicos de PozaSync.
          </p>
        </div>

        <button
          className="srv-refresh"
          onClick={() => setActualizacion(v => v + 1)}
          disabled={cargando}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </div>

      <div className="srv-stats">

        {tarjetas.map(item => {
          const Icono = item.icono

          return (
            <article
              key={item.titulo}
              className="srv-stat"
            >
              <div className={`srv-stat-icon srv-icon-${item.color}`}>
                <Icono size={23} />
              </div>

              <div>
                <span>{item.titulo}</span>
                <strong>{item.cantidad}</strong>
              </div>
            </article>
          )
        })}

      </div>

      <article className="srv-progress-card">

        <div className="srv-progress-heading">
          <div>
            <h3>Tasa de finalización</h3>

            <p>
              {resumen.finalizados} de {resumen.registrados}
              {' '}servicios operativos han finalizado.
            </p>
          </div>

          <strong>{resumen.tasa_finalizacion}%</strong>
        </div>

        <div
          className="srv-progress-track"
          role="progressbar"
          aria-label="Tasa de finalización"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={resumen.tasa_finalizacion}
        >
          <div
            className="srv-progress-fill"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, resumen.tasa_finalizacion),
              )}%`,
            }}
          />
        </div>

      </article>

      {resumen.otros > 0 && (
        <div className="srv-notice">
          Existen {resumen.otros} servicios con estados
          no reconocidos que requieren revisión.
        </div>
      )}

      <article className="srv-panel">

        <div className="srv-filters">

          <div className="srv-search">
            <Search size={19} />

            <input
              type="search"
              aria-label="Buscar servicios"
              placeholder="Buscar servicio, cliente o técnico..."
              value={busqueda}
              onChange={evento => {
                setBusqueda(evento.target.value)
                setPagina(1)
              }}
            />
          </div>

          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={evento => {
              setEstado(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="acordado">Acordados</option>
            <option value="finalizado">Finalizados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          <select
            aria-label="Filtrar por archivo"
            value={archivo}
            onChange={evento => {
              setArchivo(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="operativos">Servicios operativos</option>
            <option value="archivados">Servicios archivados</option>
            <option value="todos">Todos los registros</option>
          </select>

          <select
            aria-label="Filtrar por categoría"
            value={categoria}
            onChange={evento => {
              setCategoria(evento.target.value)
              setPagina(1)
            }}
          >
            <option value="todas">Todas las categorías</option>
            <option value="electricidad">Electricidad</option>
            <option value="plomeria">Plomería</option>
            <option value="climatizacion">Climatización</option>
            <option value="pintura">Pintura</option>
            <option value="reparaciones">Reparaciones</option>
            <option value="limpieza">Limpieza</option>
          </select>

        </div>

        {error ? (
          <div className="srv-error">
            <p>{error}</p>

            <button
              className="srv-refresh"
              onClick={() => setActualizacion(v => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : cargando ? (
          <div className="srv-empty">
            <RefreshCw
              size={28}
              className="srv-spin"
            />
            <p>Cargando servicios...</p>
          </div>
        ) : servicios.length === 0 ? (
          <div className="srv-empty">
            <BriefcaseBusiness size={42} />
            <h3>No se encontraron servicios</h3>
            <p>Prueba con otros filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="srv-table-scroll">

            <table className="srv-table">

              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>Técnico</th>
                  <th>Estado</th>
                  <th>Fecha de creación</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {servicios.map(servicio => (
                  <tr key={servicio.id}>

                    <td>
                      <div className="srv-table-info">
                        <strong>
                          {servicio.solicitud.titulo}
                        </strong>

                        <small>
                          {servicio.solicitud.categoria || 'Sin categoría'}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="srv-table-info">
                        <strong>{servicio.cliente.nombre}</strong>
                        <small>{servicio.cliente.correo}</small>
                      </div>
                    </td>

                    <td>
                      <div className="srv-table-info">
                        <strong>{servicio.tecnico.nombre}</strong>
                        <small>{servicio.tecnico.correo}</small>
                      </div>
                    </td>

                    <td>
                      {servicio.archivado ? (
                        <span className="srv-badge srv-archivado">
                          Archivado
                        </span>
                      ) : (
                        <EstadoServicio estado={servicio.estado} />
                      )}
                    </td>

                    <td className="srv-date">
                      {fecha(servicio.fecha_creacion)}
                    </td>

                    <td>
                      <button
                        className="srv-view"
                        onClick={() => abrirDetalle(servicio.id)}
                      >
                        <Eye size={16} />
                        Ver detalle
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

        <div className="srv-pagination">

          <span>
            {total === 0
              ? '0 servicios'
              : `Mostrando ${(pagina - 1) * limite + 1}–${Math.min(
                  pagina * limite,
                  total,
                )} de ${total} servicios`}
          </span>

          <div className="srv-pagination-controls">

            <button
              aria-label="Página anterior"
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina(v => v - 1)}
            >
              <ChevronLeft size={18} />
            </button>

            <span>{pagina} / {paginas}</span>

            <button
              aria-label="Página siguiente"
              disabled={pagina >= paginas || cargando}
              onClick={() => setPagina(v => v + 1)}
            >
              <ChevronRight size={18} />
            </button>

          </div>

        </div>

      </article>

      {modalAbierto && (
        <div
          className="srv-modal-overlay"
          onClick={() => setModalAbierto(false)}
        >

          <article
            className="srv-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="srv-modal-title"
            onClick={evento => evento.stopPropagation()}
          >

            <div className="srv-modal-header">

              <div>
                <h2 id="srv-modal-title">
                  Detalle del servicio
                </h2>

                <p>Información de la contratación.</p>
              </div>

              <button
                className="srv-close"
                aria-label="Cerrar detalle"
                onClick={() => setModalAbierto(false)}
              >
                <X size={22} />
              </button>

            </div>

            {cargandoDetalle ? (
              <div className="srv-empty">
                <RefreshCw
                  size={28}
                  className="srv-spin"
                />
                <p>Consultando servicio...</p>
              </div>
            ) : errorDetalle ? (
              <div className="srv-error">
                {errorDetalle}
              </div>
            ) : detalle && (
              <div className="srv-modal-body">

                <div className="srv-detail-title">
                  <h2>{detalle.solicitud.titulo}</h2>
                  {detalle.archivado ? (
                    <span className="srv-badge srv-archivado">
                      Archivado
                    </span>
                  ) : (
                    <EstadoServicio estado={detalle.estado} />
                  )}
                </div>

                {detalle.archivado && (
                  <section className="srv-archive-info">

                    <div className="srv-section-heading">
                      <Archive size={19} />
                      <h3>Registro histórico archivado</h3>
                    </div>

                    <p>
                      Este registro se conserva para fines históricos
                      y no forma parte de las estadísticas operativas.
                    </p>

                    <div className="srv-detail-grid">

                      <div>
                        <small>Estado original</small>
                        <EstadoServicio estado={detalle.estado} />
                      </div>

                      <div>
                        <small>Fecha de archivado</small>
                        <strong>{fecha(detalle.fecha_archivado)}</strong>
                      </div>

                      <div>
                        <small>Motivo del archivado</small>
                        <strong>
                          {detalle.motivo_archivado || 'Sin motivo registrado'}
                        </strong>
                      </div>

                    </div>

                  </section>
                )}

                <div className="srv-participants">

                  <DatosParticipante
                    titulo="Cliente"
                    participante={detalle.cliente}
                  />

                  <DatosParticipante
                    titulo="Técnico"
                    participante={detalle.tecnico}
                  />

                </div>

                <section className="srv-detail-section">

                  <div className="srv-section-heading">
                    <ClipboardList size={19} />
                    <h3>Solicitud relacionada</h3>
                  </div>

                  <p>
                    {detalle.solicitud.descripcion ||
                      'Sin descripción disponible.'}
                  </p>

                  <div className="srv-detail-grid">

                    <div>
                      <small>Categoría</small>
                      <strong>
                        {detalle.solicitud.categoria || 'Sin categoría'}
                      </strong>
                    </div>

                    <div>
                      <small>Ubicación</small>
                      <strong>
                        {[
                          detalle.solicitud.colonia,
                          detalle.solicitud.ciudad,
                        ].filter(Boolean).join(', ') || 'Sin ubicación'}
                      </strong>
                    </div>

                    <div>
                      <small>Estado de solicitud</small>
                      <strong>
                        {detalle.solicitud.estado || 'Desconocido'}
                      </strong>
                    </div>

                    <div>
                      <small>Moderación</small>
                      <strong>
                        {detalle.solicitud.bloqueada
                          ? 'Bloqueada'
                          : 'Sin bloqueo'}
                      </strong>
                    </div>

                  </div>

                  {detalle.solicitud.bloqueada && (
                    <div className="srv-notice">
                      La solicitud está bloqueada administrativamente.
                      El servicio existente conserva su estado.
                    </div>
                  )}

                </section>

                <section className="srv-detail-section">

                  <div className="srv-section-heading">
                    <CalendarDays size={19} />
                    <h3>Historial del servicio</h3>
                  </div>

                  <div className="srv-timeline">

                    {[
                      {
                        titulo: 'Servicio solicitado',
                        valor: detalle.fecha_creacion,
                      },
                      {
                        titulo: 'Servicio aceptado',
                        valor: detalle.fecha_aceptacion,
                      },
                      {
                        titulo: 'Servicio rechazado',
                        valor: detalle.fecha_rechazo,
                      },
                      {
                        titulo: 'Servicio finalizado',
                        valor: detalle.fecha_finalizacion,
                      },
                    ].map(evento => (
                      <div
                        key={evento.titulo}
                        className={`srv-timeline-item ${
                          evento.valor ? 'completed' : ''
                        }`}
                      >
                        <div className="srv-timeline-dot" />

                        <div>
                          <strong>{evento.titulo}</strong>
                          <small>{fecha(evento.valor)}</small>
                        </div>
                      </div>
                    ))}

                  </div>

                </section>

                <section className="srv-detail-section">
                  <h3>Identificador del servicio</h3>
                  <code className="srv-id">{detalle.id}</code>
                </section>

              </div>
            )}

            <div className="srv-modal-footer">
              <button
                className="srv-primary"
                onClick={() => setModalAbierto(false)}
              >
                Cerrar
              </button>
            </div>

          </article>

        </div>
      )}

    </div>
  )
}