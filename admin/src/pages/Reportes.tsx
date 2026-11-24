import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  FileText,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
  ClipboardList,
  LoaderCircle,
  Eye,
} from 'lucide-react'

import api from '../services/api'
import './Reportes.css'

type TipoReporte =
  | 'general'
  | 'usuarios'
  | 'solicitudes'
  | 'servicios'
  | 'reputacion'

type Agrupacion = 'dia' | 'semana' | 'mes'

type Formato = 'pdf' | 'excel'

type Valor = string | number | boolean | null

interface Indicador {
  nombre: string
  valor: Valor
  descripcion: string
}

interface TablaReporte {
  titulo: string
  columnas: string[]
  filas: Valor[][]
}

interface SeccionReporte {
  titulo: string
  descripcion: string
  indicadores: Indicador[]
  tablas: TablaReporte[]
  observaciones: string[]
}

interface Filtros {
  tipo: TipoReporte
  dias: number
  agrupacion: Agrupacion
}

interface Reporte {
  plataforma: string
  tipo: TipoReporte
  titulo: string
  fecha_generacion: string
  fecha_generacion_local: string
  periodo: {
    dias: number
    agrupacion: Agrupacion
    inicio: string
    fin: string
    zona_horaria: string
  }
  secciones: SeccionReporte[]
  confidencialidad: string
  fuente: string
}

interface CatalogoReportes {
  reportes: {
    tipo: TipoReporte
    titulo: string
  }[]
  periodos: number[]
  agrupaciones: Agrupacion[]
  formatos_disponibles: string[]
}

const AGRUPACIONES: Record<Agrupacion, string> = {
  dia: 'Diaria',
  semana: 'Semanal',
  mes: 'Mensual',
}

const FILTROS_INICIALES: Filtros = {
  tipo: 'general',
  dias: 30,
  agrupacion: 'dia',
}

function mostrarValor(valor: Valor): string {
  if (valor === null) {
    return 'No disponible'
  }

  if (typeof valor === 'number') {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
    }).format(valor)
  }

  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No'
  }

  return String(valor)
}

function mostrarFecha(fecha: string): string {
  const valor = new Date(fecha)

  if (Number.isNaN(valor.getTime())) {
    return fecha
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(valor)
}

async function obtenerMensajeError(
  error: unknown,
): Promise<string> {
  if (axios.isAxiosError(error)) {
    let datos = error.response?.data

    if (datos instanceof Blob) {
      try {
        datos = JSON.parse(await datos.text())
      } catch {
        datos = null
      }
    }

    if (typeof datos?.detail === 'string') {
      return datos.detail
    }

    if (error.response?.status === 401) {
      return 'Tu sesión ha expirado.'
    }

    if (error.response?.status === 403) {
      return 'No tienes permisos para realizar esta operación.'
    }

    if (error.response?.status === 422) {
      return 'Los filtros seleccionados no son válidos.'
    }

    if (error.code === 'ECONNABORTED') {
      return 'La operación tardó demasiado. Intenta nuevamente.'
    }
  }

  return 'No fue posible completar la operación. Intenta nuevamente.'
}

function IndicadorReporte({
  indicador,
}: {
  indicador: Indicador
}) {
  return (
    <article className="rep-indicador">
      <span className="rep-indicador-nombre">
        {indicador.nombre}
      </span>

      <strong className="rep-indicador-valor">
        {mostrarValor(indicador.valor)}
      </strong>

      {indicador.descripcion && (
        <p>{indicador.descripcion}</p>
      )}
    </article>
  )
}

function TablaVistaPrevia({
  tabla,
}: {
  tabla: TablaReporte
}) {
  return (
    <div className="rep-tabla-bloque">
      <h4>{tabla.titulo}</h4>

      {tabla.filas.length === 0 ? (
        <div className="rep-sin-datos">
          No existen registros para el periodo seleccionado.
        </div>
      ) : (
        <div className="rep-tabla-scroll">
          <table className="rep-tabla">
            <thead>
              <tr>
                {tabla.columnas.map((columna, indice) => (
                  <th key={indice} scope="col">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tabla.filas.map((fila, indice) => (
                <tr key={indice}>
                  {fila.map((valor, posicion) => (
                    <td
                      key={posicion}
                      className={
                        typeof valor === 'number'
                          ? 'rep-numero'
                          : undefined
                      }
                    >
                      {mostrarValor(valor)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SeccionVistaPrevia({
  seccion,
  numero,
}: {
  seccion: SeccionReporte
  numero: number
}) {
  return (
    <section className="rep-seccion">
      <div className="rep-seccion-titulo">
        <span>{numero}</span>
        <h3>{seccion.titulo}</h3>
      </div>

      <p className="rep-descripcion">
        {seccion.descripcion}
      </p>

      {seccion.indicadores.length > 0 && (
        <div className="rep-indicadores">
          {seccion.indicadores.map((indicador, indice) => (
            <IndicadorReporte
              key={indice}
              indicador={indicador}
            />
          ))}
        </div>
      )}

      {seccion.tablas.map((tabla, indice) => (
        <TablaVistaPrevia
          key={indice}
          tabla={tabla}
        />
      ))}

      {seccion.observaciones.length > 0 && (
        <div className="rep-observaciones">
          <h4>
            <AlertCircle size={17} />
            Observaciones
          </h4>

          <ul>
            {seccion.observaciones.map((texto, indice) => (
              <li key={indice}>{texto}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function Reportes() {
  const [catalogo, setCatalogo] =
    useState<CatalogoReportes | null>(null)

  const [filtros, setFiltros] =
    useState<Filtros>(FILTROS_INICIALES)

  const [filtrosAplicados, setFiltrosAplicados] =
    useState<Filtros | null>(null)

  const [reporte, setReporte] =
    useState<Reporte | null>(null)

  const [cargandoCatalogo, setCargandoCatalogo] =
    useState(true)

  const [cargando, setCargando] =
    useState(false)

  const [descargando, setDescargando] =
    useState<Formato | null>(null)

  const [error, setError] =
    useState('')

  const [errorCatalogo, setErrorCatalogo] =
    useState('')

  const [mensaje, setMensaje] =
    useState('')

  const [reintento, setReintento] =
    useState(0)

  const consultaRef =
    useRef<AbortController | null>(null)

  const descargaRef =
    useRef<AbortController | null>(null)

  const ocupadoRef = useRef(false)

  useEffect(() => {
    const controlador = new AbortController()

    setCargandoCatalogo(true)
    setErrorCatalogo('')

    api
      .get<CatalogoReportes>(
        '/admin/reportes/tipos',
        {
          signal: controlador.signal,
        },
      )
      .then(({ data }) => {
        if (!controlador.signal.aborted) {
          setCatalogo(data)
        }
      })
      .catch(async (err: unknown) => {
        if (controlador.signal.aborted) return

        const texto = await obtenerMensajeError(err)

        if (!controlador.signal.aborted) {
          setErrorCatalogo(texto)
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setCargandoCatalogo(false)
        }
      })

    return () => controlador.abort()
  }, [reintento])

  useEffect(() => {
    return () => {
      consultaRef.current?.abort()
      descargaRef.current?.abort()
    }
  }, [])

  const filtrosCambiaron =
    filtrosAplicados !== null &&
    (
      filtros.tipo !== filtrosAplicados.tipo ||
      filtros.dias !== filtrosAplicados.dias ||
      filtros.agrupacion !== filtrosAplicados.agrupacion
    )

  const ocupado = cargando || descargando !== null

  const puedeDescargar =
    reporte !== null &&
    filtrosAplicados !== null &&
    !filtrosCambiaron &&
    !ocupado

  async function generarVistaPrevia() {
    if (ocupadoRef.current || !catalogo) return

    ocupadoRef.current = true

    consultaRef.current?.abort()

    const controlador = new AbortController()
    consultaRef.current = controlador

    const seleccion = { ...filtros }

    setCargando(true)
    setError('')
    setMensaje('')
    setReporte(null)
    setFiltrosAplicados(null)

    try {
      const { data } = await api.get<Reporte>(
        '/admin/reportes/vista-previa',
        {
          params: seleccion,
          signal: controlador.signal,
          timeout: 90000,
        },
      )

      if (controlador.signal.aborted) return

      setReporte(data)
      setFiltrosAplicados(seleccion)

    } catch (err: unknown) {
      if (!controlador.signal.aborted) {
        const texto = await obtenerMensajeError(err)

        if (!controlador.signal.aborted) {
          setError(texto)
        }
      }

    } finally {
      if (!controlador.signal.aborted) {
        setCargando(false)
        ocupadoRef.current = false
      }
    }
  }

  async function descargarReporte(formato: Formato) {
    if (
      !puedeDescargar ||
      !filtrosAplicados ||
      ocupadoRef.current
    ) {
      return
    }

    ocupadoRef.current = true

    const controlador = new AbortController()
    descargaRef.current = controlador

    setDescargando(formato)
    setError('')
    setMensaje('')

    try {
      const respuesta = await api.get<Blob>(
        `/admin/reportes/${formato}`,
        {
          params: filtrosAplicados,
          responseType: 'blob',
          signal: controlador.signal,
          timeout: 90000,
        },
      )

      if (controlador.signal.aborted) return

      const extension =
        formato === 'pdf' ? 'pdf' : 'xlsx'

      const mimeEsperado =
        formato === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      if (
        respuesta.data.size === 0 ||
        respuesta.data.type.split(';')[0] !== mimeEsperado
      ) {
        throw new Error('Formato de descarga incorrecto')
      }

      const disposicion = String(
        respuesta.headers['content-disposition'] ?? '',
      )

      const coincidencia =
        disposicion.match(/filename="([^"]+)"/i)

      const nombreRecibido = coincidencia?.[1]

      const nombreSeguro =
        nombreRecibido &&
        /^[a-zA-Z0-9_.-]+$/.test(nombreRecibido) &&
        nombreRecibido.endsWith(`.${extension}`)
          ? nombreRecibido
          : `PozaSync_${filtrosAplicados.tipo}_${filtrosAplicados.dias}dias.${extension}`

      const url = URL.createObjectURL(respuesta.data)

      const enlace = document.createElement('a')

      enlace.href = url
      enlace.download = nombreSeguro

      document.body.appendChild(enlace)

      try {
        enlace.click()
      } finally {
        enlace.remove()

        window.setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 1000)
      }

      setMensaje(
        `Reporte ${formato === 'pdf' ? 'PDF' : 'Excel'} generado. Descarga iniciada.`,
      )

    } catch (err: unknown) {
      if (!controlador.signal.aborted) {
        const texto = await obtenerMensajeError(err)

        if (!controlador.signal.aborted) {
          setError(texto)
        }
      }

    } finally {
      if (!controlador.signal.aborted) {
        setDescargando(null)
        ocupadoRef.current = false
      }
    }
  }

  return (
    <div className="rep-pagina">
      <header className="rep-encabezado">
        <div>
          <h1>Reportes</h1>

          <p>
            Genera y exporta informes administrativos
            de la plataforma PozaSync.
          </p>
        </div>

        <div className="rep-confidencial">
          <ShieldCheck size={18} />
          Uso administrativo interno
        </div>
      </header>

      <section className="rep-panel">
        <div className="rep-panel-titulo">
          <ClipboardList size={21} />
          <h2>Configurar reporte</h2>
        </div>

        {cargandoCatalogo ? (
          <div className="rep-cargando">
            <LoaderCircle className="rep-girar" size={24} />
            Cargando opciones de reportes...
          </div>
        ) : errorCatalogo ? (
          <div className="rep-error" role="alert">
            <AlertCircle size={20} />
            <span>{errorCatalogo}</span>

            <button
              className="rep-boton rep-boton-secundario"
              onClick={() => setReintento(v => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : catalogo && (
          <>
            <div className="rep-filtros">
              <label>
                <span>Tipo de reporte</span>

                <select
                  value={filtros.tipo}
                  disabled={ocupado}
                  onChange={e => {
                    setFiltros(actual => ({
                      ...actual,
                      tipo: e.target.value as TipoReporte,
                    }))
                    setMensaje('')
                  }}
                >
                  {catalogo.reportes.map(item => (
                    <option
                      key={item.tipo}
                      value={item.tipo}
                    >
                      {item.titulo}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Periodo</span>

                <select
                  value={filtros.dias}
                  disabled={ocupado}
                  onChange={e => {
                    setFiltros(actual => ({
                      ...actual,
                      dias: Number(e.target.value),
                    }))
                    setMensaje('')
                  }}
                >
                  {catalogo.periodos.map(dias => (
                    <option key={dias} value={dias}>
                      Últimos {dias} días
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Agrupación</span>

                <select
                  value={filtros.agrupacion}
                  disabled={ocupado}
                  onChange={e => {
                    setFiltros(actual => ({
                      ...actual,
                      agrupacion: e.target.value as Agrupacion,
                    }))
                    setMensaje('')
                  }}
                >
                  {catalogo.agrupaciones.map(item => (
                    <option key={item} value={item}>
                      {AGRUPACIONES[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rep-acciones">
              <button
                className="rep-boton rep-boton-primario"
                disabled={ocupado}
                onClick={generarVistaPrevia}
              >
                {cargando ? (
                  <LoaderCircle
                    size={18}
                    className="rep-girar"
                  />
                ) : (
                  <Eye size={18} />
                )}

                {cargando
                  ? 'Generando...'
                  : 'Generar vista previa'}
              </button>

              <button
                className="rep-boton rep-boton-secundario"
                disabled={ocupado}
                onClick={() => {
                  setFiltros({ ...FILTROS_INICIALES })
                  setMensaje('')
                  setError('')
                }}
              >
                <RefreshCw size={17} />
                Restablecer filtros
              </button>
            </div>
          </>
        )}
      </section>

      <section className="rep-panel rep-exportacion">
        <div>
          <div className="rep-panel-titulo">
            <Download size={21} />
            <h2>Exportar reporte</h2>
          </div>

          <p>
            Descarga el informe con los filtros aplicados.
          </p>
        </div>

        <div className="rep-acciones">
          <button
            className="rep-boton rep-boton-pdf"
            disabled={
              !puedeDescargar ||
              !catalogo?.formatos_disponibles.includes('pdf')
            }
            onClick={() => descargarReporte('pdf')}
          >
            {descargando === 'pdf' ? (
              <LoaderCircle
                size={18}
                className="rep-girar"
              />
            ) : (
              <FileText size={18} />
            )}

            {descargando === 'pdf'
              ? 'Generando PDF...'
              : 'Descargar PDF'}
          </button>

          <button
            className="rep-boton rep-boton-excel"
            disabled={
              !puedeDescargar ||
              !catalogo?.formatos_disponibles.includes('excel')
            }
            onClick={() => descargarReporte('excel')}
          >
            {descargando === 'excel' ? (
              <LoaderCircle
                size={18}
                className="rep-girar"
              />
            ) : (
              <FileSpreadsheet size={18} />
            )}

            {descargando === 'excel'
              ? 'Generando Excel...'
              : 'Descargar Excel'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rep-error" role="alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {mensaje && (
        <div className="rep-exito" role="status">
          <ShieldCheck size={20} />
          <span>{mensaje}</span>
        </div>
      )}

      {filtrosCambiaron && (
        <div className="rep-aviso" role="status">
          <AlertCircle size={20} />

          Los filtros cambiaron. Genera una nueva vista
          previa antes de descargar el reporte.
        </div>
      )}

      <section
        className="rep-panel rep-vista"
        aria-busy={cargando}
      >
        {cargando ? (
          <div className="rep-estado-vacio">
            <LoaderCircle
              size={42}
              className="rep-girar"
            />

            <h3>Generando reporte</h3>

            <p>
              Consultando y organizando las estadísticas.
            </p>
          </div>
        ) : !reporte ? (
          <div className="rep-estado-vacio">
            <ClipboardList size={48} />

            <h3>Vista previa del reporte</h3>

            <p>
              Selecciona los filtros y presiona
              Generar vista previa para consultar
              los indicadores y las tablas.
            </p>
          </div>
        ) : (
          <>
            <div className="rep-documento">
              <div className="rep-documento-marca">
                <strong>PozaSync</strong>
                <span>Reporte administrativo</span>
              </div>

              <h2>{reporte.titulo}</h2>

              <div className="rep-metadatos">
                <div>
                  <CalendarDays size={17} />

                  <span>
                    Periodo: {reporte.periodo.dias} días
                  </span>
                </div>

                <div>
                  Agrupación:{' '}
                  {AGRUPACIONES[reporte.periodo.agrupacion]}
                </div>

                <div>
                  Desde: {mostrarFecha(reporte.periodo.inicio)}
                </div>

                <div>
                  Hasta: {mostrarFecha(reporte.periodo.fin)}
                </div>

                <div>
                  Generado: {reporte.fecha_generacion_local}
                </div>

                <div>
                  Zona horaria: {reporte.periodo.zona_horaria}
                </div>
              </div>
            </div>

            {reporte.secciones.map((seccion, indice) => (
              <SeccionVistaPrevia
                key={indice}
                seccion={seccion}
                numero={indice + 1}
              />
            ))}

            <footer className="rep-pie">
              <p>Fuente: {reporte.fuente}</p>

              <p>
                <ShieldCheck size={16} />
                {reporte.confidencialidad}
              </p>

              <p>
                Las descargas se generan con los datos
                disponibles al momento de solicitarlas.
              </p>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}