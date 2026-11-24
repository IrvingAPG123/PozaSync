import { useEffect, useState } from 'react'

import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from 'react-router-dom'

import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Wrench,
  ClipboardList,
  BriefcaseBusiness,
  Star,
  ChartNoAxesCombined,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Construction,
} from 'lucide-react'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Tecnicos from './pages/Tecnicos'
import Solicitudes from './pages/Solicitudes'
import Servicios from './pages/Servicios'
import Resenas from './pages/Resenas'
import Estadisticas from './pages/Estadisticas'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'

import {
  eliminarToken,
} from './services/api'

import type {
  Administrador,
} from './types/admin'

const navegacion = [
  {
    ruta: '/',
    nombre: 'Dashboard',
    icono: LayoutDashboard,
  },
  {
    ruta: '/usuarios',
    nombre: 'Usuarios',
    icono: Users,
  },
  {
    ruta: '/tecnicos',
    nombre: 'Técnicos',
    icono: Wrench,
  },
  {
    ruta: '/solicitudes',
    nombre: 'Solicitudes',
    icono: ClipboardList,
  },
  {
    ruta: '/servicios',
    nombre: 'Servicios',
    icono: BriefcaseBusiness,
  },
  {
    ruta: '/resenas',
    nombre: 'Reseñas',
    icono: Star,
  },
  {
    ruta: '/estadisticas',
    nombre: 'Estadísticas',
    icono: ChartNoAxesCombined,
  },
  {
    ruta: '/reportes',
    nombre: 'Reportes',
    icono: FileText,
  },
  {
    ruta: '/configuracion',
    nombre: 'Configuración',
    icono: Settings,
  },
]

function ModuloPendiente({
  titulo,
}: {
  titulo: string
}) {
  return (
    <div className="page-content">

      <div className="page-heading">
        <h1>{titulo}</h1>
      </div>

      <article className="panel loading-state">
        <Construction size={42} />

        <h2>Módulo en desarrollo</h2>

        <p className="muted">
          Esta sección se habilitará en una
          próxima etapa del proyecto.
        </p>
      </article>

    </div>
  )
}

function App() {
  const [administrador, setAdministrador] =
    useState<Administrador | null>(null)

  const [menuAbierto, setMenuAbierto] =
    useState(false)

  useEffect(() => {
    function cerrarSesionExpirada() {
      eliminarToken()
      setAdministrador(null)
    }

    window.addEventListener(
      'sesion-expirada',
      cerrarSesionExpirada,
    )

    return () => {
      window.removeEventListener(
        'sesion-expirada',
        cerrarSesionExpirada,
      )
    }
  }, [])

  function cerrarSesion() {
    eliminarToken()
    setAdministrador(null)
    setMenuAbierto(false)
  }

  if (!administrador) {
    return (
      <Login
        alIniciarSesion={setAdministrador}
      />
    )
  }

  return (
    <BrowserRouter>

      <div className="admin-layout">

        {menuAbierto && (
          <button
            className="mobile-overlay"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <aside className={
          `sidebar ${menuAbierto ? 'open' : ''}`
        }>

          <div className="brand">

            <div className="brand-icon">
              <ShieldCheck size={27} />
            </div>

            <div>
              <strong>PozaSync</strong>
              <span>ADMIN PANEL</span>
            </div>

          </div>

          <div className="navigation-label">
            GENERAL
          </div>

          <nav className="navigation">

            {navegacion.map((item) => {
              const Icono = item.icono

              return (
                <NavLink
                  key={item.ruta}
                  to={item.ruta}
                  end={item.ruta === '/'}
                  onClick={() =>
                    setMenuAbierto(false)
                  }
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'selected' : ''}`
                  }
                >
                  <Icono size={19} />
                  {item.nombre}
                </NavLink>
              )
            })}

          </nav>

          <div className="sidebar-footer">

            <button
              className="logout-button"
              onClick={cerrarSesion}
            >
              <LogOut size={19} />
              Cerrar sesión
            </button>

            <small>PozaSync Admin · v1.0</small>

          </div>

        </aside>

        <main className="main-area">

          <header className="topbar">

            <div className="topbar-title">

              <button
                className="icon-button mobile-menu"
                aria-label="Abrir o cerrar menú"
                onClick={() =>
                  setMenuAbierto(!menuAbierto)
                }
              >
                {menuAbierto ? <X /> : <Menu />}
              </button>

              <span>Panel administrativo</span>

            </div>

            <div className="admin-profile">

              <div className="profile-text">
                <strong>
                  {administrador.nombre}
                </strong>

                <small>Administrador</small>
              </div>

              <div className="avatar admin-avatar">
                <ShieldCheck size={22} />
              </div>

            </div>

          </header>

          <Routes>

            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/usuarios"
              element={<Usuarios />}
            />

            <Route
              path="/tecnicos"
              element={<Tecnicos />}
            />

            <Route
              path="/solicitudes"
              element={
                <div className="page-content">
                  <Solicitudes />
                </div>
              }
            />

            <Route
              path="/servicios"
              element={
                <div className="page-content">
                  <Servicios />
                </div>
              }
            />

            <Route
                path="/resenas"
                element={
                  <div className="page-content">
                    <Resenas />
                  </div>
                }
              />

              <Route
              path="/estadisticas"
              element={
                <div className="page-content">
                  <Estadisticas />
                </div>
              }
            />

            <Route
                  path="/reportes"
                  element={
                    <div className="page-content">
                      <Reportes />
                    </div>
                  }
                />

                <Route
                path="/configuracion"
                element={
                  <div className="page-content">
                    <Configuracion />
                  </div>
                }
              />

              {navegacion.slice(9).map((item) => (
              <Route
                key={item.ruta}
                path={item.ruta}
                element={
                  <ModuloPendiente
                    titulo={item.nombre}
                  />
                }
              />
            ))}

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  )
}

export default App