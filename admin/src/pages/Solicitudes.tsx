import { useEffect, useState } from 'react'
import {
  Search,
  ClipboardList,
  FileCheck,
  FileX,
  ShieldAlert,
  ShieldCheck,
  Eye,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Image as ImageIcon,
  History,
} from 'lucide-react'
import axios from 'axios'
import api from '../services/api'
import './Solicitudes.css'

interface Imagen {
  url?: string
  secure_url?: string
  public_id?: string
}

interface Historial {
  accion: string
  motivo: string
  administrador_id?: string
  fecha?: string
}

interface Solicitud {
  id: string
  cliente_id: string | null
  titulo: string
  descripcion: string
  categoria: string
  categoria_id: string
  colonia: string
  ciudad: string
  estado: string
  bloqueada: boolean
  imagenes: (Imagen | string)[]
  fecha_creacion?: string
  fecha_publicacion?: string
  cliente: {
    id: string | null
    nombre: string
    correo: string
    activo: boolean
    existe: boolean
  }
}

interface DetalleSolicitud extends Solicitud {
  conversaciones: {
    total: number
  }
  cotizaciones: {
    total: number
  }
  servicios: {
    total: number
    pendientes: number
    acordados: number
    finalizados: number
    rechazados: number
  }
  detalle_servicios: {
    id: string
    tecnico: string
    estado: string
    fecha_creacion?: string
  }[]
  historial_administrativo: Historial[]
}

interface Resumen {
  registradas: number
  publicadas: number
  borradores: number
  retiradas: number
  bloqueadas: number
}

interface RespuestaSolicitudes {
  total: number
  pagina: number
  limite: number
  resumen: Resumen
  solicitudes: Solicitud[]
}

const resumenInicial: Resumen = {
  registradas: 0,
  publicadas: 0,
  borradores: 0,
  retiradas: 0,
  bloqueadas: 0,
}

const categorias = [
  ['todas', 'Todas las categorías'],
  ['electricidad', 'Electricidad'],
  ['plomeria', 'Plomería'],
  ['climatizacion', 'Climatización'],
  ['pintura', 'Pintura'],
  ['reparaciones', 'Reparaciones'],
  ['limpieza', 'Limpieza'],
]

function formatearFecha(fecha?: string) {
  if (!fecha) return 'Sin fecha'

  const valor = new Date(fecha)

  if (Number.isNaN(valor.getTime())) {
    return 'Sin fecha'
  }

  return valor.toLocaleString('es-MX', {
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

function imagenUrl(imagen: Imagen | string) {
  const url =
    typeof imagen === 'string'
      ? imagen
      : imagen.secure_url || imagen.url || ''

  try {
    const direccion = new URL(url)

    return direccion.protocol === 'https:'
      ? direccion.href
      : ''
  } catch {
    return ''
  }
}

function Estado({ solicitud }: { solicitud: Solicitud }) {
  return (
    <div className="sol-estados">
      <span className={`sol-badge sol-${solicitud.estado}`}>
        {solicitud.estado}
      </span>

      {solicitud.bloqueada && (
        <span className="sol-badge sol-bloqueada">
          Bloqueada
        </span>
      )}
    </div>
  )
}

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] =
    useState<Solicitud[]>([])

  const [resumen, setResumen] =
    useState<Resumen>(resumenInicial)

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [categoria, setCategoria] = useState('todas')
  const [moderacion, setModeracion] = useState('todas')

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [revision, setRevision] = useState(0)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const [detalle, setDetalle] =
    useState<DetalleSolicitud | null>(null)

  const [cargandoDetalle, setCargandoDetalle] =
    useState(false)

  const [seleccionada, setSeleccionada] =
    useState<Solicitud | null>(null)

  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorModeracion, setErrorModeracion] =
    useState('')

  const limite = 10
  const paginas = Math.max(1, Math.ceil(total / limite))

  useEffect(() => {
    const controlador = new AbortController()

    setCargando(true)

    const temporizador = window.setTimeout(async () => {
      try {
        setError('')

        const respuesta = await api.get<RespuestaSolicitudes>(
          '/admin/solicitudes',
          {
            params: {
              pagina,
              limite,
              busqueda,
              estado,
              categoria,
              moderacion,
            },
            signal: controlador.signal,
          },
        )

        if (controlador.signal.aborted) return

        setSolicitudes(respuesta.data.solicitudes)
        setResumen(respuesta.data.resumen)
        setTotal(respuesta.data.total)

        const ultimaPagina = Math.max(
          1,
          Math.ceil(respuesta.data.total / limite),
        )

        if (pagina > ultimaPagina) {
          setPagina(ultimaPagina)
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
  }, [
    pagina,
    busqueda,
    estado,
    categoria,
    moderacion,
    revision,
  ])

  async function abrirDetalle(id: string) {
    setCargandoDetalle(true)
    setError('')

    try {
      const respuesta = await api.get<DetalleSolicitud>(
        `/admin/solicitudes/${id}`,
      )

      setDetalle(respuesta.data)
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setCargandoDetalle(false)
    }
  }

  function abrirModeracion(solicitud: Solicitud) {
    setSeleccionada(solicitud)
    setMotivo('')
    setErrorModeracion('')
    setExito('')
  }

  async function confirmarModeracion() {
    if (!seleccionada || procesando) return

    if (motivo.trim().length < 5) {
      setErrorModeracion(
        'Escribe un motivo de al menos cinco caracteres.',
      )
      return
    }

    setProcesando(true)
    setErrorModeracion('')

    try {
      const respuesta = await api.patch(
        `/admin/solicitudes/${seleccionada.id}/moderacion`,
        {
          bloqueada: !seleccionada.bloqueada,
          motivo: motivo.trim(),
        },
      )

      setExito(respuesta.data.mensaje)
      setSeleccionada(null)
      setDetalle(null)
      setMotivo('')
      setRevision(valor => valor + 1)
    } catch (error) {
      setErrorModeracion(mensajeError(error))
    } finally {
      setProcesando(false)
    }
  }

  function limpiarFiltros() {
    setBusqueda('')
    setEstado('todos')
    setCategoria('todas')
    setModeracion('todas')
    setPagina(1)
  }

  const tarjetas = [
    {
      titulo: 'Solicitudes registradas',
      cantidad: resumen.registradas,
      icono: ClipboardList,
      color: 'azul',
    },
    {
      titulo: 'Publicadas',
      cantidad: resumen.publicadas,
      icono: FileCheck,
      color: 'verde',
    },
    {
      titulo: 'Borradores',
      cantidad: resumen.borradores,
      icono: ClipboardList,
      color: 'amarillo',
    },
    {
      titulo: 'Retiradas',
      cantidad: resumen.retiradas,
      icono: FileX,
      color: 'gris',
    },
    {
      titulo: 'Bloqueadas',
      cantidad: resumen.bloqueadas,
      icono: ShieldAlert,
      color: 'rojo',
    },
  ]

  return (
    <section className="sol-page">
      <header className="sol-header">
        <div>
          <h1>Gestión de solicitudes</h1>
          <p>
            Consulta y modera las publicaciones de PozaSync.
          </p>
        </div>

        <button
          className="sol-button"
          disabled={cargando}
          onClick={() => setRevision(valor => valor + 1)}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>

      <div className="sol-stats">
        {tarjetas.map(tarjeta => (
          <article
            className="sol-stat"
            key={tarjeta.titulo}
          >
            <div className={`sol-icon ${tarjeta.color}`}>
              <tarjeta.icono size={22} />
            </div>

            <span>{tarjeta.titulo}</span>
            <strong>{tarjeta.cantidad}</strong>
          </article>
        ))}
      </div>

      <p className="sol-note">
        Las solicitudes bloqueadas pueden pertenecer
        también a otros estados.
      </p>

      {error && (
        <div className="sol-alert sol-error">
          {error}
        </div>
      )}

      {exito && (
        <div className="sol-alert sol-success">
          {exito}
        </div>
      )}

      <div className="sol-filters">
        <div className="sol-search">
          <Search size={19} />

          <input
            placeholder="Buscar solicitudes o clientes..."
            value={busqueda}
            maxLength={100}
            onChange={evento => {
              setBusqueda(evento.target.value)
              setPagina(1)
            }}
          />
        </div>

        <select
          aria-label="Estado"
          value={estado}
          onChange={evento => {
            setEstado(evento.target.value)
            setPagina(1)
          }}
        >
          <option value="todos">
            Todos los estados
          </option>
          <option value="publicada">Publicadas</option>
          <option value="borrador">Borradores</option>
          <option value="retirada">Retiradas</option>
        </select>

        <select
          aria-label="Categoría"
          value={categoria}
          onChange={evento => {
            setCategoria(evento.target.value)
            setPagina(1)
          }}
        >
          {categorias.map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>

        <select
          aria-label="Moderación"
          value={moderacion}
          onChange={evento => {
            setModeracion(evento.target.value)
            setPagina(1)
          }}
        >
          <option value="todas">
            Toda moderación
          </option>
          <option value="bloqueadas">Bloqueadas</option>
          <option value="sin_bloqueo">Sin bloqueo</option>
        </select>

        <button
          className="sol-button"
          onClick={limpiarFiltros}
        >
          Limpiar
        </button>
      </div>

      <div className="sol-table-card">
        <div className="sol-table-heading">
          <h2>Solicitudes de la plataforma</h2>
          <span>{total} resultados</span>
        </div>

        {cargando ? (
          <div className="sol-empty">
            Cargando solicitudes...
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="sol-empty">
            <ClipboardList size={38} />
            No se encontraron solicitudes.
          </div>
        ) : (
          <div className="sol-table-scroll">
            <table className="sol-table">
              <thead>
                <tr>
                  <th>Solicitud</th>
                  <th>Cliente</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {solicitudes.map(solicitud => (
                  <tr key={solicitud.id}>
                    <td>
                      <strong>{solicitud.titulo}</strong>
                      <small>
                        {solicitud.colonia}, {solicitud.ciudad}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {solicitud.cliente.nombre}
                      </strong>
                      <small>
                        {solicitud.cliente.correo ||
                          'Sin correo asociado'}
                      </small>
                    </td>

                    <td>{solicitud.categoria}</td>

                    <td>
                      <Estado solicitud={solicitud} />
                    </td>

                    <td>
                      {formatearFecha(
                        solicitud.fecha_creacion,
                      )}
                    </td>

                    <td>
                      <div className="sol-actions">
                        <button
                          className="sol-button sol-view"
                          disabled={cargandoDetalle}
                          onClick={() =>
                            abrirDetalle(solicitud.id)
                          }
                        >
                          <Eye size={16} />
                          Ver
                        </button>

                        <button
                          className={
                            solicitud.bloqueada
                              ? 'sol-button sol-unlock'
                              : 'sol-button sol-block'
                          }
                          disabled={
                            solicitud.bloqueada &&
                            (!solicitud.cliente.existe ||
                              !solicitud.cliente.activo)
                          }
                          onClick={() =>
                            abrirModeracion(solicitud)
                          }
                        >
                          {solicitud.bloqueada ? (
                            <ShieldCheck size={16} />
                          ) : (
                            <ShieldAlert size={16} />
                          )}

                          {solicitud.bloqueada
                            ? 'Desbloquear'
                            : 'Bloquear'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="sol-pagination">
          <span>
            Página {pagina} de {paginas}
          </span>

          <div>
            <button
              className="sol-button"
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina(valor => valor - 1)}
            >
              <ChevronLeft size={17} />
              Anterior
            </button>

            <button
              className="sol-button"
              disabled={pagina >= paginas || cargando}
              onClick={() => setPagina(valor => valor + 1)}
            >
              Siguiente
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </div>

      {detalle && (
        <div className="sol-overlay">
          <div
            className="sol-modal sol-detail"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de solicitud"
          >
            <header className="sol-modal-header">
              <div>
                <h2>Detalle de solicitud</h2>
                <p>{detalle.id}</p>
              </div>

              <button
                className="sol-close"
                aria-label="Cerrar"
                onClick={() => setDetalle(null)}
              >
                <X size={22} />
              </button>
            </header>

            <Estado solicitud={detalle} />

            <h2>{detalle.titulo}</h2>

            <p className="sol-description">
              {detalle.descripcion}
            </p>

            <div className="sol-detail-grid">
              <div>
                <span>Cliente</span>
                <strong>{detalle.cliente.nombre}</strong>
              </div>

              <div>
                <span>Correo</span>
                <strong>
                  {detalle.cliente.correo || 'Sin correo'}
                </strong>
              </div>

              <div>
                <span>Categoría</span>
                <strong>{detalle.categoria}</strong>
              </div>

              <div>
                <span>Ubicación</span>
                <strong>
                  {detalle.colonia}, {detalle.ciudad}
                </strong>
              </div>

              <div>
                <span>Fecha de creación</span>
                <strong>
                  {formatearFecha(detalle.fecha_creacion)}
                </strong>
              </div>

              <div>
                <span>Fecha de publicación</span>
                <strong>
                  {formatearFecha(detalle.fecha_publicacion)}
                </strong>
              </div>
            </div>

            <h3 className="sol-section-title">
              <ImageIcon size={19} />
              Fotografías
            </h3>

            <div className="sol-gallery">
              {(detalle.imagenes || []).length === 0 && (
                <p>Sin fotografías registradas.</p>
              )}

              {(detalle.imagenes || []).map((imagen, indice) => {
                const url = imagenUrl(imagen)

                return url ? (
                  <a
                    key={indice}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={url}
                      alt={`Fotografía ${indice + 1}`}
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <span key={indice}>
                    Imagen no disponible
                  </span>
                )
              })}
            </div>

            <h3 className="sol-section-title">
              <Briefcase size={19} />
              Actividad relacionada
            </h3>

            <div className="sol-related">
              {[
                ['Conversaciones', detalle.conversaciones?.total ?? 0],
                ['Cotizaciones', detalle.cotizaciones?.total ?? 0],
                ['Servicios', detalle.servicios?.total ?? 0],
                ['Pendientes', detalle.servicios?.pendientes ?? 0],
                ['Acordados', detalle.servicios?.acordados ?? 0],
                ['Finalizados', detalle.servicios?.finalizados ?? 0],
                ['Rechazados', detalle.servicios?.rechazados ?? 0],
              ].map(([nombre, cantidad]) => (
                <div key={nombre}>
                  <span>{nombre}</span>
                  <strong>{cantidad}</strong>
                </div>
              ))}
            </div>

            {(detalle.detalle_servicios || []).map(servicio => (
              <div
                className="sol-history-item"
                key={servicio.id}
              >
                <strong>{servicio.tecnico}</strong>
                <span>{servicio.estado}</span>
                <small>
                  {formatearFecha(servicio.fecha_creacion)}
                </small>
              </div>
            ))}

            <h3 className="sol-section-title">
              <History size={19} />
              Historial administrativo
            </h3>

            {(detalle.historial_administrativo || []).length === 0 ? (
              <p>No existen acciones administrativas.</p>
            ) : (
              [...(detalle.historial_administrativo || [])]
                .reverse()
                .map((registro, indice) => (
                  <article
                    className="sol-history-item"
                    key={indice}
                  >
                    <strong>
                      {registro.accion.replace(/_/g, ' ')}
                    </strong>

                    <p>{registro.motivo}</p>

                    <small>
                      {formatearFecha(registro.fecha)}
                    </small>

                    <small>
                      Administrador:{' '}
                      {registro.administrador_id ||
                        'Mantenimiento del sistema'}
                    </small>
                  </article>
                ))
            )}

            <footer className="sol-modal-footer">
              <button
                className="sol-button"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>

              <button
                className={
                  detalle.bloqueada
                    ? 'sol-button sol-unlock'
                    : 'sol-button sol-block'
                }
                disabled={
                  detalle.bloqueada &&
                  (!detalle.cliente.existe ||
                    !detalle.cliente.activo)
                }
                onClick={() => {
                  abrirModeracion(detalle)
                  setDetalle(null)
                }}
              >
                {detalle.bloqueada
                  ? 'Desbloquear solicitud'
                  : 'Bloquear solicitud'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {seleccionada && (
        <div className="sol-overlay">
          <div
            className="sol-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Moderación de solicitud"
          >
            <header className="sol-modal-header">
              <h2>
                {seleccionada.bloqueada
                  ? 'Desbloquear solicitud'
                  : 'Bloquear solicitud'}
              </h2>

              <button
                className="sol-close"
                disabled={procesando}
                aria-label="Cerrar"
                onClick={() => setSeleccionada(null)}
              >
                <X size={22} />
              </button>
            </header>

            <strong>{seleccionada.titulo}</strong>

            <div className="sol-warning">
              <ShieldAlert size={20} />

              <p>
                {seleccionada.bloqueada
                  ? 'Se retirará el bloqueo administrativo. Las solicitudes retiradas no se publicarán automáticamente.'
                  : 'La publicación dejará de estar disponible para nuevos contactos. El bloqueo no elimina las conversaciones ni los servicios existentes.'}
              </p>
            </div>

            <label htmlFor="motivo-moderacion">
              Motivo de la acción
            </label>

            <textarea
              id="motivo-moderacion"
              value={motivo}
              maxLength={300}
              rows={5}
              disabled={procesando}
              placeholder="Describe el motivo de esta decisión..."
              onChange={evento =>
                setMotivo(evento.target.value)
              }
            />

            <small className="sol-counter">
              {motivo.length}/300 caracteres
            </small>

            {errorModeracion && (
              <div className="sol-alert sol-error">
                {errorModeracion}
              </div>
            )}

            <footer className="sol-modal-footer">
              <button
                className="sol-button"
                disabled={procesando}
                onClick={() => setSeleccionada(null)}
              >
                Cancelar
              </button>

              <button
                className={
                  seleccionada.bloqueada
                    ? 'sol-button sol-unlock'
                    : 'sol-button sol-block'
                }
                disabled={
                  procesando || motivo.trim().length < 5
                }
                onClick={confirmarModeracion}
              >
                {procesando
                  ? 'Procesando...'
                  : 'Confirmar acción'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}