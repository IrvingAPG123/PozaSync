import { useEffect, useState, type ReactNode } from 'react'
import axios from 'axios'
import {
  BarChart3,
  Users,
  Wrench,
  ClipboardList,
  CheckCircle2,
  MessageSquare,
  Star,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Activity,
} from 'lucide-react'
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import api from '../services/api'
import './Estadisticas.css'

type Distribucion = {
  nombre: string
  total: number
}

type Serie = {
  fecha: string
  total: number
}

type Crecimiento = Serie & {
  clientes: number
  tecnicos: number
}

type Reputacion = Serie & {
  promedio: number
}

type Agrupacion = 'dia' | 'semana' | 'mes'

interface EstadisticasData {
  periodo: {
    dias: number
    agrupacion: Agrupacion
    inicio: string
    fin: string
    zona_horaria: string
  }
  resumen: {
    nuevos_usuarios: number
    nuevas_solicitudes: number
    nuevos_servicios: number
    servicios_finalizados: number
    nuevas_conversaciones: number
    calificacion_promedio: number
    resenas_visibles: number
  }
  usuarios: {
    registrados: number
    activos: number
    distribucion: Distribucion[]
    crecimiento: Crecimiento[]
  }
  tecnicos: {
    registrados: number
    disponibles: number
    no_disponibles: number
  }
  solicitudes: {
    total: number
    publicaciones: number
    bloqueadas: number
    estados: Distribucion[]
    categorias: Distribucion[]
    colonias: Distribucion[]
    evolucion: Serie[]
  }
  servicios: {
    total: number
    pendientes: number
    acordados: number
    finalizados: number
    rechazados: number
    otros: number
    aceptados: number
    tasa_aceptacion: number
    tasa_finalizacion: number
    distribucion: Distribucion[]
    finalizados_en_periodo: number
    evolucion: Serie[]
    evolucion_finalizaciones: Serie[]
  }
  reputacion: {
    promedio: number
    total: number
    distribucion: Record<string, number>
    evolucion: Reputacion[]
  }
  actividad: {
    conversaciones: number
    evolucion_conversaciones: Serie[]
    mensajes_historicos: number
    cotizaciones_historicas: number
  }
  calidad_datos: {
    servicios_archivados: number
    resenas_archivadas: number
    resenas_ocultas: number
    mensajes_sin_fecha_creacion: number
  }
}

const COLORES = [
  '#208aef',
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#64748b',
]

const ESTADOS: Record<string, string> = {
  cliente: 'Clientes',
  tecnico: 'Técnicos',
  publicada: 'Publicadas',
  retirada: 'Retiradas',
  borrador: 'Borradores',
  pendiente: 'Pendientes',
  acordado: 'Acordados',
  finalizado: 'Finalizados',
  rechazado: 'Rechazados',
}

const COLORES_ESTADOS: Record<string, string> = {
  Pendientes: '#f59e0b',
  Acordados: '#208aef',
  Finalizados: '#16a34a',
  Rechazados: '#ef4444',
  Publicadas: '#16a34a',
  Retiradas: '#64748b',
  Borradores: '#f59e0b',
}

const numero = (valor: number) =>
  valor.toLocaleString('es-MX')

const fechaCorta = (fecha: string) => {
  const partes = fecha.split('-')

  return `${partes[2]}/${partes[1]}/${partes[0].slice(2)}`
}

const fechaLocal = (fecha: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(fecha))

function traducirDistribucion(datos: Distribucion[]) {
  return datos.map((item) => ({
    ...item,
    nombre: ESTADOS[item.nombre] || item.nombre,
  }))
}

function generarPeriodos(
  inicio: string,
  fin: string,
  agrupacion: Agrupacion,
) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Mexico_City',
  })

  const convertir = (valor: string) => {
    const partes = formato.formatToParts(new Date(valor))

    const obtener = (tipo: string) =>
      partes.find((parte) => parte.type === tipo)?.value

    return new Date(
      `${obtener('year')}-${obtener('month')}-${obtener('day')}T00:00:00Z`,
    )
  }

  const actual = convertir(inicio)
  const ultimo = convertir(fin)

  if (agrupacion === 'semana') {
    const desplazamiento = (actual.getUTCDay() + 6) % 7

    actual.setUTCDate(
      actual.getUTCDate() - desplazamiento,
    )
  }

  if (agrupacion === 'mes') {
    actual.setUTCDate(1)
  }

  const periodos: string[] = []

  while (actual <= ultimo && periodos.length < 400) {
    periodos.push(actual.toISOString().slice(0, 10))

    if (agrupacion === 'mes') {
      actual.setUTCMonth(actual.getUTCMonth() + 1)
    } else {
      actual.setUTCDate(
        actual.getUTCDate() +
          (agrupacion === 'semana' ? 7 : 1),
      )
    }
  }

  return periodos
}

function Tarjeta({
  titulo,
  valor,
  detalle,
  icono,
  color = 'azul',
}: {
  titulo: string
  valor: string | number
  detalle: string
  icono: ReactNode
  color?: string
}) {
  return (
    <article className="est-kpi">
      <div className={`est-kpi-icon est-${color}`}>
        {icono}
      </div>

      <div className="est-kpi-info">
        <span>{titulo}</span>
        <strong>{valor}</strong>
        <small>{detalle}</small>
      </div>
    </article>
  )
}

function Panel({
  titulo,
  descripcion,
  icono,
  children,
  amplio = false,
}: {
  titulo: string
  descripcion?: string
  icono?: ReactNode
  children: ReactNode
  amplio?: boolean
}) {
  return (
    <section
      className={`est-panel ${amplio ? 'est-panel-amplio' : ''}`}
    >
      <header className="est-panel-header">
        <div className="est-panel-title">
          {icono}
          <h3>{titulo}</h3>
        </div>

        {descripcion && <p>{descripcion}</p>}
      </header>

      {children}
    </section>
  )
}

function SinDatos() {
  return (
    <div className="est-empty">
      <BarChart3 size={36} />
      <strong>Sin datos disponibles</strong>
      <span>No hay registros para este periodo.</span>
    </div>
  )
}

function GraficaCircular({
  datos,
}: {
  datos: Distribucion[]
}) {
  const total = datos.reduce(
    (acumulado, item) => acumulado + item.total,
    0,
  )

  if (!total) return <SinDatos />

  return (
    <>
      <div className="est-chart est-chart-pie">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="total"
              nameKey="nombre"
              innerRadius={60}
              outerRadius={92}
              paddingAngle={3}
              stroke="none"
            >
              {datos.map((item, index) => (
                <Cell
                  key={`${item.nombre}-${index}`}
                  fill={
                    COLORES_ESTADOS[item.nombre] ||
                    COLORES[index % COLORES.length]
                  }
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>

        <div className="est-pie-center">
          <strong>{numero(total)}</strong>
          <span>Total</span>
        </div>
      </div>

      <div className="est-chart-legend">
        {datos.map((item, index) => (
          <div
            className="est-legend-row"
            key={`${item.nombre}-${index}`}
          >
            <span
              className="est-legend-dot"
              style={{
                background:
                  COLORES_ESTADOS[item.nombre] ||
                  COLORES[index % COLORES.length],
              }}
            />

            <span>{item.nombre}</span>

            <strong>{numero(item.total)}</strong>

            <small>
              {((item.total / total) * 100).toFixed(1)}%
            </small>
          </div>
        ))}
      </div>
    </>
  )
}

function Indicador({
  titulo,
  valor,
  detalle,
  disponible = true,
}: {
  titulo: string
  valor: number
  detalle: string
  disponible?: boolean
}) {
  return (
    <div className="est-rate">
      <div className="est-rate-header">
        <span>{titulo}</span>

        <strong>
          {disponible ? `${valor.toFixed(1)}%` : 'N/D'}
        </strong>
      </div>

      <div className="est-progress">
        <div
          style={{
            width: disponible
              ? `${Math.max(0, Math.min(valor, 100))}%`
              : '0%',
          }}
        />
      </div>

      <small>{detalle}</small>
    </div>
  )
}

export default function Estadisticas() {
  const [datos, setDatos] =
    useState<EstadisticasData | null>(null)

  const [dias, setDias] = useState(30)

  const [agrupacion, setAgrupacion] =
    useState<Agrupacion>('dia')

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [actualizacion, setActualizacion] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()

    async function cargar() {
      setCargando(true)
      setError('')
      setDatos(null)

      try {
        const respuesta = await api.get<EstadisticasData>(
          '/admin/estadisticas/avanzadas',
          {
            params: {
              dias,
              agrupacion,
            },
            signal: controlador.signal,
          },
        )

        if (!controlador.signal.aborted) {
          setDatos(respuesta.data)
        }
      } catch (err) {
        if (controlador.signal.aborted) return

        if (axios.isAxiosError(err)) {
          const detalle = err.response?.data?.detail

          setError(
            typeof detalle === 'string'
              ? detalle
              : 'No fue posible cargar las estadísticas.',
          )
        } else {
          setError('Ocurrió un error inesperado.')
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false)
        }
      }
    }

    void cargar()

    return () => controlador.abort()
  }, [dias, agrupacion, actualizacion])

  const periodos = datos
    ? generarPeriodos(
        datos.periodo.inicio,
        datos.periodo.fin,
        datos.periodo.agrupacion,
      )
    : []

  const crecimiento = periodos.map((fecha) => {
    const registro = datos?.usuarios.crecimiento.find(
      (item) => item.fecha === fecha,
    )

    return {
      fecha,
      clientes: registro?.clientes ?? 0,
      tecnicos: registro?.tecnicos ?? 0,
    }
  })

  const actividad = periodos.map((fecha) => ({
    fecha,
    solicitudes:
      datos?.solicitudes.evolucion.find(
        (item) => item.fecha === fecha,
      )?.total ?? 0,
    servicios:
      datos?.servicios.evolucion.find(
        (item) => item.fecha === fecha,
      )?.total ?? 0,
    finalizaciones:
      datos?.servicios.evolucion_finalizaciones.find(
        (item) => item.fecha === fecha,
      )?.total ?? 0,
    conversaciones:
      datos?.actividad.evolucion_conversaciones.find(
        (item) => item.fecha === fecha,
      )?.total ?? 0,
  }))

  const evolucionReputacion = periodos.map((fecha) => ({
    fecha,
    promedio:
      datos?.reputacion.evolucion.find(
        (item) => item.fecha === fecha,
      )?.promedio ?? null,
  }))

  return (
    <div className="est-page">
      <header className="est-header">
        <div>
          <div className="est-eyebrow">
            <BarChart3 size={16} />
            ANALÍTICA DE LA PLATAFORMA
          </div>

          <h1>Estadísticas</h1>

          <p>
            Analiza el crecimiento, la demanda y el
            rendimiento de PozaSync.
          </p>
        </div>

        <button
          className="est-refresh"
          disabled={cargando}
          onClick={() => setActualizacion((valor) => valor + 1)}
        >
          <RefreshCw
            size={17}
            className={cargando ? 'est-spin' : ''}
          />
          Actualizar
        </button>
      </header>

      <section className="est-filters">
        <div className="est-filter-title">
          <CalendarDays size={22} />

          <div>
            <strong>Periodo de análisis</strong>
            <span>Personaliza la información mostrada</span>
          </div>
        </div>

        <div className="est-filter-controls">
          <label>
            Periodo

            <select
              value={dias}
              onChange={(evento) =>
                setDias(Number(evento.target.value))
              }
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={365}>Últimos 365 días</option>
            </select>
          </label>

          <label>
            Agrupación

            <select
              value={agrupacion}
              onChange={(evento) =>
                setAgrupacion(
                  evento.target.value as Agrupacion,
                )
              }
            >
              <option value="dia">Por día</option>
              <option value="semana">Por semana</option>
              <option value="mes">Por mes</option>
            </select>
          </label>
        </div>
      </section>

      {cargando && (
        <div className="est-loading" role="status">
          <RefreshCw size={30} className="est-spin" />
          <strong>Consultando estadísticas...</strong>
          <span>Procesando información de la plataforma.</span>
        </div>
      )}

      {error && (
        <div className="est-error" role="alert">
          <AlertCircle size={22} />
          <span>{error}</span>

          <button
            onClick={() =>
              setActualizacion((valor) => valor + 1)
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {datos && !cargando && (
        <>
          <div className="est-period-label">
            <CalendarDays size={15} />

            {fechaLocal(datos.periodo.inicio)}
            {' — '}
            {fechaLocal(datos.periodo.fin)}

            <span>Hora de México</span>
          </div>

          <div className="est-kpis">
            <Tarjeta
              titulo="Nuevos usuarios"
              valor={numero(datos.resumen.nuevos_usuarios)}
              detalle="Registros durante el periodo"
              icono={<Users size={23} />}
            />

            <Tarjeta
              titulo="Nuevas solicitudes"
              valor={numero(datos.resumen.nuevas_solicitudes)}
              detalle="Solicitudes operativas creadas"
              icono={<ClipboardList size={23} />}
              color="morado"
            />

            <Tarjeta
              titulo="Nuevos servicios"
              valor={numero(datos.resumen.nuevos_servicios)}
              detalle="Acuerdos registrados"
              icono={<Wrench size={23} />}
              color="naranja"
            />

            <Tarjeta
              titulo="Servicios finalizados"
              valor={numero(datos.resumen.servicios_finalizados)}
              detalle="Finalizaciones durante el periodo"
              icono={<CheckCircle2 size={23} />}
              color="verde"
            />

            <Tarjeta
              titulo="Conversaciones"
              valor={numero(datos.resumen.nuevas_conversaciones)}
              detalle="Conversaciones iniciadas"
              icono={<MessageSquare size={23} />}
              color="turquesa"
            />

            <Tarjeta
              titulo="Reputación promedio"
              valor={
                datos.reputacion.total
                  ? datos.reputacion.promedio.toFixed(1)
                  : 'N/D'
              }
              detalle={`${datos.reputacion.total} reseñas visibles`}
              icono={<Star size={23} />}
              color="amarillo"
            />
          </div>

          <div className="est-section-heading">
            <TrendingUp size={22} />
            <h2>Crecimiento de la plataforma</h2>
          </div>

          <div className="est-grid">
            <Panel
              titulo="Evolución de registros"
              descripcion="Nuevos clientes y técnicos por intervalo."
              icono={<TrendingUp size={19} />}
              amplio
            >
              {datos.resumen.nuevos_usuarios === 0 ? (
                <SinDatos />
              ) : (
                <div className="est-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={crecimiento}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5eaf1"
                      />

                      <XAxis
                        dataKey="fecha"
                        tickFormatter={fechaCorta}
                        minTickGap={25}
                        fontSize={11}
                      />

                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip labelFormatter={(label) =>
                        typeof label === 'string'
                          ? fechaCorta(label)
                          : label
                      } />
                      <Legend />

                      <Line
                        type="monotone"
                        dataKey="clientes"
                        name="Clientes"
                        stroke="#208aef"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />

                      <Line
                        type="monotone"
                        dataKey="tecnicos"
                        name="Técnicos"
                        stroke="#14b8a6"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel
              titulo="Distribución de nuevos usuarios"
              descripcion="Registros dentro del periodo seleccionado."
              icono={<Users size={19} />}
            >
              <GraficaCircular
                datos={traducirDistribucion(
                  datos.usuarios.distribucion,
                )}
              />
            </Panel>

            <Panel
              titulo="Disponibilidad de técnicos"
              descripcion="Estado actual, independiente del periodo."
              icono={<Wrench size={19} />}
            >
              <div className="est-current-summary">
                <strong>{numero(datos.tecnicos.registrados)}</strong>
                <span>Perfiles técnicos válidos</span>
              </div>

              <Indicador
                titulo="Técnicos disponibles"
                valor={
                  datos.tecnicos.registrados
                    ? (datos.tecnicos.disponibles /
                        datos.tecnicos.registrados) *
                      100
                    : 0
                }
                disponible={datos.tecnicos.registrados > 0}
                detalle={`${datos.tecnicos.disponibles} técnicos disponibles`}
              />

              <div className="est-data-row">
                <span>No disponibles</span>
                <strong>{datos.tecnicos.no_disponibles}</strong>
              </div>

              <div className="est-data-row">
                <span>Usuarios públicos registrados</span>
                <strong>{datos.usuarios.registrados}</strong>
              </div>

              <div className="est-data-row">
                <span>Usuarios activos</span>
                <strong>{datos.usuarios.activos}</strong>
              </div>
            </Panel>
          </div>

          <div className="est-section-heading">
            <MapPin size={22} />
            <h2>Demanda de servicios</h2>
          </div>

          <div className="est-grid">
            <Panel
              titulo="Solicitudes por categoría"
              descripcion="Identifica los servicios más solicitados."
              icono={<BarChart3 size={19} />}
            >
              {datos.solicitudes.categorias.length === 0 ? (
                <SinDatos />
              ) : (
                <div className="est-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={datos.solicitudes.categorias}
                      layout="vertical"
                      margin={{ left: 12, right: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis type="number" allowDecimals={false} />

                      <YAxis
                        type="category"
                        dataKey="nombre"
                        width={100}
                        fontSize={12}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="total"
                        name="Solicitudes"
                        fill="#208aef"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={30}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel
              titulo="Demanda por colonia"
              descripcion="Distribución geográfica de las solicitudes."
              icono={<MapPin size={19} />}
            >
              {datos.solicitudes.colonias.length === 0 ? (
                <SinDatos />
              ) : (
                <div className="est-ranking">
                  {datos.solicitudes.colonias.map((item, index) => {
                    const porcentaje =
                      datos.solicitudes.total > 0
                        ? (item.total / datos.solicitudes.total) * 100
                        : 0

                    return (
                      <div
                        className="est-ranking-item"
                        key={item.nombre}
                      >
                        <div className="est-ranking-header">
                          <span className="est-rank-number">
                            {index + 1}
                          </span>

                          <strong>{item.nombre}</strong>

                          <span>{item.total}</span>
                        </div>

                        <div className="est-progress est-progress-blue">
                          <div style={{ width: `${porcentaje}%` }} />
                        </div>

                        <small>
                          {porcentaje.toFixed(1)}% de las solicitudes
                        </small>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            <Panel
              titulo="Estado de solicitudes"
              descripcion="Estado actual de las solicitudes creadas en el periodo."
              icono={<ClipboardList size={19} />}
            >
              <GraficaCircular
                datos={traducirDistribucion(
                  datos.solicitudes.estados,
                )}
              />
            </Panel>

            <Panel
              titulo="Publicación y moderación"
              descripcion="Actividad y estado administrativo."
              icono={<ShieldCheck size={19} />}
            >
              <div className="est-data-row">
                <span>Solicitudes creadas</span>
                <strong>{datos.solicitudes.total}</strong>
              </div>

              <div className="est-data-row">
                <span>Publicadas durante el periodo</span>
                <strong>{datos.solicitudes.publicaciones}</strong>
              </div>

              <div className="est-data-row">
                <span>Solicitudes creadas actualmente bloqueadas</span>
                <strong>{datos.solicitudes.bloqueadas}</strong>
              </div>
            </Panel>
          </div>

          <div className="est-section-heading">
            <Activity size={22} />
            <h2>Rendimiento y actividad</h2>
          </div>

          <div className="est-grid">
            <Panel
              titulo="Evolución de actividad"
              descripcion="Solicitudes, servicios, finalizaciones y conversaciones."
              icono={<Activity size={19} />}
              amplio
            >
              <div className="est-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actividad}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="fecha"
                      tickFormatter={fechaCorta}
                      minTickGap={25}
                      fontSize={11}
                    />

                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(label) =>
                        typeof label === 'string'
                          ? fechaCorta(label)
                          : label
                      } />
                    <Legend />

                    <Bar
                      dataKey="solicitudes"
                      name="Solicitudes"
                      fill="#208aef"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />

                    <Bar
                      dataKey="servicios"
                      name="Servicios"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />

                    <Bar
                      dataKey="finalizaciones"
                      name="Finalizaciones"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />

                    <Bar
                      dataKey="conversaciones"
                      name="Conversaciones"
                      fill="#14b8a6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              titulo="Estado de servicios"
              descripcion="Servicios creados durante el periodo, según su estado actual."
              icono={<Wrench size={19} />}
            >
              <GraficaCircular
                datos={traducirDistribucion(
                  datos.servicios.distribucion,
                )}
              />
            </Panel>

            <Panel
              titulo="Indicadores de rendimiento"
              descripcion="Resultados de los servicios creados durante el periodo."
              icono={<TrendingUp size={19} />}
            >
              <Indicador
                titulo="Tasa de aceptación"
                valor={datos.servicios.tasa_aceptacion}
                disponible={
                  datos.servicios.aceptados +
                    datos.servicios.rechazados >
                  0
                }
                detalle={`${datos.servicios.aceptados} de ${
                  datos.servicios.aceptados +
                  datos.servicios.rechazados
                } servicios decididos`}
              />

              <Indicador
                titulo="Tasa de finalización"
                valor={datos.servicios.tasa_finalizacion}
                disponible={datos.servicios.total > 0}
                detalle={`${datos.servicios.finalizados} de ${datos.servicios.total} servicios creados`}
              />

              <div className="est-data-row">
                <span>Servicios pendientes</span>
                <strong>{datos.servicios.pendientes}</strong>
              </div>

              <div className="est-data-row">
                <span>Servicios rechazados</span>
                <strong>{datos.servicios.rechazados}</strong>
              </div>

              <div className="est-data-row">
                <span>Finalizaciones durante el periodo</span>
                <strong>{datos.servicios.finalizados_en_periodo}</strong>
              </div>

              {datos.servicios.total < 10 && (
                <div className="est-note">
                  <AlertCircle size={17} />
                  Muestra reducida. Interpreta los porcentajes
                  considerando el número de servicios.
                </div>
              )}
            </Panel>
          </div>

          <div className="est-section-heading">
            <Star size={22} />
            <h2>Reputación y satisfacción</h2>
          </div>

          <div className="est-grid">
            <Panel
              titulo="Distribución de calificaciones"
              descripcion="Únicamente reseñas visibles y no archivadas."
              icono={<Star size={19} />}
            >
              <div className="est-rating-summary">
                <strong>
                  {datos.reputacion.total
                    ? datos.reputacion.promedio.toFixed(1)
                    : 'N/D'}
                </strong>

                <div>
                  <div className="est-stars">
                    {[1, 2, 3, 4, 5].map((estrella) => (
                      <Star
                        key={estrella}
                        size={21}
                        fill={
                          estrella <= datos.reputacion.promedio
                            ? '#f59e0b'
                            : 'none'
                        }
                      />
                    ))}
                  </div>

                  <span>
                    {datos.reputacion.total} reseñas visibles
                  </span>
                </div>
              </div>

              {[5, 4, 3, 2, 1].map((estrella) => {
                const cantidad =
                  datos.reputacion.distribucion[String(estrella)] ?? 0

                const porcentaje = datos.reputacion.total
                  ? (cantidad / datos.reputacion.total) * 100
                  : 0

                return (
                  <div className="est-rating-row" key={estrella}>
                    <span>{estrella}</span>
                    <Star size={15} fill="#f59e0b" />

                    <div className="est-progress est-progress-yellow">
                      <div style={{ width: `${porcentaje}%` }} />
                    </div>

                    <strong>{cantidad}</strong>
                  </div>
                )
              })}
            </Panel>

            <Panel
              titulo="Evolución de reputación"
              descripcion="Calificación promedio por intervalo con reseñas."
              icono={<TrendingUp size={19} />}
            >
              {datos.reputacion.total === 0 ? (
                <SinDatos />
              ) : (
                <div className="est-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucionReputacion}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="fecha"
                        tickFormatter={fechaCorta}
                        minTickGap={25}
                        fontSize={11}
                      />

                      <YAxis
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                      />

                      <Tooltip labelFormatter={(label) =>
                        typeof label === 'string'
                          ? fechaCorta(label)
                          : label
                      } />

                      <Line
                        dataKey="promedio"
                        name="Calificación"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className="est-section-heading">
            <ShieldCheck size={22} />
            <h2>Información histórica y calidad de datos</h2>
          </div>

          <div className="est-grid">
            <Panel
              titulo="Actividad histórica"
              descripcion="Totales generales, independientes del periodo."
              icono={<MessageSquare size={19} />}
            >
              <div className="est-data-row">
                <span>Mensajes registrados</span>
                <strong>{datos.actividad.mensajes_historicos}</strong>
              </div>

              <div className="est-data-row">
                <span>Cotizaciones registradas</span>
                <strong>{datos.actividad.cotizaciones_historicas}</strong>
              </div>

              <div className="est-note">
                <AlertCircle size={17} />
                Los registros históricos pueden incluir datos
                antiguos. No representan actividad exclusiva
                del periodo seleccionado.
              </div>
            </Panel>

            <Panel
              titulo="Control de calidad"
              descripcion="Registros excluidos y limitaciones de información."
              icono={<ShieldCheck size={19} />}
            >
              <div className="est-data-row">
                <span>Servicios archivados</span>
                <strong>{datos.calidad_datos.servicios_archivados}</strong>
              </div>

              <div className="est-data-row">
                <span>Reseñas archivadas</span>
                <strong>{datos.calidad_datos.resenas_archivadas}</strong>
              </div>

              <div className="est-data-row">
                <span>Reseñas ocultas</span>
                <strong>{datos.calidad_datos.resenas_ocultas}</strong>
              </div>

              <div className="est-data-row">
                <span>Mensajes sin fecha de creación válida</span>
                <strong>
                  {datos.calidad_datos.mensajes_sin_fecha_creacion}
                </strong>
              </div>
            </Panel>
          </div>

          <footer className="est-footer">
            <ShieldCheck size={16} />
            Información consultada desde MongoDB.
            Este módulo no modifica los registros.
          </footer>
        </>
      )}
    </div>
  )
}