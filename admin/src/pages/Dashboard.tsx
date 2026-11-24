import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Users,
  Wrench,
  ClipboardList,
  BriefcaseBusiness,
  MessageSquare,
  Star,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

import api from '../services/api'
import type { Estadisticas } from '../types/admin'

export default function Dashboard() {
  const [datos, setDatos] =
    useState<Estadisticas | null>(null)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const respuesta = await api.get<Estadisticas>(
        '/admin/estadisticas',
      )

      setDatos(respuesta.data)

    } catch {
      setError(
        'No fue posible consultar las estadísticas.',
      )

    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarDatos()
  }, [cargarDatos])

  const tarjetas = datos ? [
    {
      titulo: 'Usuarios registrados',
      valor: datos.usuarios.total,
      icono: Users,
      color: 'blue',
    },
    {
      titulo: 'Técnicos disponibles',
      valor: datos.tecnicos.disponibles,
      icono: Wrench,
      color: 'green',
    },
    {
      titulo: 'Solicitudes',
      valor: datos.actividad.solicitudes,
      icono: ClipboardList,
      color: 'orange',
    },
    {
      titulo: 'Servicios',
      valor: datos.actividad.servicios,
      icono: BriefcaseBusiness,
      color: 'purple',
    },
    {
      titulo: 'Mensajes',
      valor: datos.actividad.mensajes,
      icono: MessageSquare,
      color: 'cyan',
    },
    {
      titulo: 'Reseñas',
      valor: datos.actividad.resenas,
      icono: Star,
      color: 'yellow',
    },
  ] : []

  const distribucion = datos ? [
    {
      nombre: 'Clientes',
      valor: datos.usuarios.clientes,
    },
    {
      nombre: 'Técnicos',
      valor: datos.usuarios.tecnicos,
    },
  ] : []

  const actividad = datos ? [
    {
      nombre: 'Solicitudes',
      total: datos.actividad.solicitudes,
    },
    {
      nombre: 'Servicios',
      total: datos.actividad.servicios,
    },
    {
      nombre: 'Cotizaciones',
      total: datos.actividad.cotizaciones,
    },
    {
      nombre: 'Chats',
      total: datos.actividad.conversaciones,
    },
    {
      nombre: 'Reseñas',
      total: datos.actividad.resenas,
    },
  ] : []

  return (
    <div className="page-content">

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            VISTA GENERAL
          </span>

          <h1>Dashboard</h1>

          <p className="muted">
            Consulta la actividad general de PozaSync.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={cargarDatos}
          disabled={cargando}
        >
          <RefreshCw
            size={17}
            className={cargando ? 'spin' : ''}
          />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {cargando && !datos && (
        <div className="loading-state">
          <LoaderCircle
            size={30}
            className="spin"
          />
          Consultando estadísticas...
        </div>
      )}

      {datos && (
        <>
          <div className="stats-grid">

            {tarjetas.map((tarjeta) => {
              const Icono = tarjeta.icono

              return (
                <article
                  className="stat-card"
                  key={tarjeta.titulo}
                >
                  <div
                    className={
                      `stat-icon ${tarjeta.color}`
                    }
                  >
                    <Icono size={23} />
                  </div>

                  <span className="muted">
                    {tarjeta.titulo}
                  </span>

                  <strong className="stat-value">
                    {tarjeta.valor.toLocaleString('es-MX')}
                  </strong>
                </article>
              )
            })}

          </div>

          <div className="charts-grid">

            <article className="panel">

              <h2>Actividad de la plataforma</h2>

              <p className="muted">
                Total acumulado por categoría
              </p>

              <div className="chart-container">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart data={actividad}>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="nombre"
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis allowDecimals={false} />

                    <Tooltip />

                    <Bar
                      dataKey="total"
                      name="Total"
                      fill="#208aef"
                      radius={[6, 6, 0, 0]}
                    />

                  </BarChart>
                </ResponsiveContainer>

              </div>

            </article>

            <article className="panel">

              <h2>Distribución de usuarios</h2>

              <p className="muted">
                Clientes y técnicos registrados
              </p>

              <div className="chart-container">

                {datos.usuarios.total === 0 ? (
                  <div className="loading-state">
                    Sin usuarios registrados
                  </div>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>

                      <Pie
                        data={distribucion}
                        dataKey="valor"
                        nameKey="nombre"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                      >
                        <Cell fill="#208aef" />
                        <Cell fill="#14b8a6" />
                      </Pie>

                      <Tooltip />
                      <Legend />

                    </PieChart>
                  </ResponsiveContainer>
                )}

              </div>

            </article>

          </div>

          <article className="panel">

            <h2>Resumen operativo</h2>

            <div className="operational-grid">

              <div>
                <span>Usuarios activos</span>
                <strong>
                  {datos.usuarios.activos}
                </strong>
              </div>

              <div>
                <span>Usuarios inactivos</span>
                <strong>
                  {datos.usuarios.inactivos}
                </strong>
              </div>

              <div>
                <span>Perfiles técnicos</span>
                <strong>
                  {datos.tecnicos.perfiles}
                </strong>
              </div>

              <div>
                <span>Conversaciones</span>
                <strong>
                  {datos.actividad.conversaciones}
                </strong>
              </div>

              <div>
                <span>Cotizaciones</span>
                <strong>
                  {datos.actividad.cotizaciones}
                </strong>
              </div>

            </div>

          </article>

        </>
      )}

    </div>
  )
}