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
  LoaderCircle,
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

import api, {
  guardarToken,
  eliminarToken,
} from './services/api'

import type {
  Administrador,
} from './types/admin'


// ==========================================
// NAVEGACION ADMINISTRATIVA
// ==========================================

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


// ==========================================
// RECIBIR CODIGO TEMPORAL
// ==========================================

function obtenerCodigoInicial(): string | null {

  const parametros = new URLSearchParams(
    window.location.hash.slice(1),
  )

  const codigo = parametros.get('codigo_acceso')

  if (codigo !== null) {

    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname +
        window.location.search,
    )
  }

  return codigo
}

const codigoInicial = obtenerCodigoInicial()


// ==========================================
// CANJEAR SESION ADMINISTRATIVA
// ==========================================

async function canjearAcceso(
  codigo: string,
): Promise<Administrador> {

  eliminarToken()

  try {

    if (!/^[A-Za-z0-9_-]{32,128}$/.test(codigo)) {
      throw new Error('Código de acceso inválido.')
    }

    const respuesta = await api.post(
      '/admin/canjear-acceso',
      {
        codigo,
      },
    )

    const token = respuesta.data.access_token

    if (
      typeof token !== 'string' ||
      !token
    ) {
      throw new Error('Sesión administrativa inválida.')
    }

    guardarToken(token)

    const perfil = await api.get<Administrador>(
      '/admin/yo',
    )

    if (
      perfil.data.rol !== 'administrador' ||
      perfil.data.activo !== true
    ) {
      throw new Error('Acceso no autorizado.')
    }

    return perfil.data

  } catch (error) {

    eliminarToken()

    throw error
  }
}


// Evita canjear dos veces el mismo código
// durante la ejecución de React StrictMode.

let solicitudAcceso:
  Promise<Administrador> | null = null

function recuperarAcceso(
  codigo: string,
): Promise<Administrador> {

  if (!solicitudAcceso) {

    solicitudAcceso = canjearAcceso(codigo)
  }

  return solicitudAcceso
}


// ==========================================
// APLICACION ADMINISTRATIVA
// ==========================================

function App() {

  const [administrador, setAdministrador] =
    useState<Administrador | null>(null)

  const [menuAbierto, setMenuAbierto] =
    useState(false)

  const [cargandoAcceso, setCargandoAcceso] =
    useState(codigoInicial !== null)

  const [errorAcceso, setErrorAcceso] =
    useState('')


  // ========================================
  // CONTROL DE SESIONES EXPIRADAS
  // ========================================

  useEffect(() => {

    function cerrarSesionExpirada() {

      eliminarToken()

      setAdministrador(null)

      setMenuAbierto(false)
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


  // ========================================
  // RECUPERAR ACCESO DESDE POZASYNC WEB
  // ========================================

  useEffect(() => {

    let activo = true

    async function iniciarAcceso() {

      if (codigoInicial === null) {
        return
      }

      try {

        const perfil = await recuperarAcceso(
          codigoInicial,
        )

        if (activo) {

          setAdministrador(perfil)

          setErrorAcceso('')
        }

      } catch {

        if (activo) {

          setAdministrador(null)

          setErrorAcceso(
            'No fue posible recuperar el acceso. ' +
            'Inicia sesión nuevamente.',
          )
        }

      } finally {

        if (activo) {
          setCargandoAcceso(false)
        }
      }
    }

    void iniciarAcceso()

    return () => {
      activo = false
    }

  }, [])


  // ========================================
  // CERRAR SESION
  // ========================================

  function cerrarSesion() {

    eliminarToken()

    setAdministrador(null)

    setMenuAbierto(false)

    setErrorAcceso('')
  }


  // ========================================
  // PANTALLA DE CARGA
  // ========================================

  if (cargandoAcceso) {

    return (

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          backgroundColor: '#F4F6F9',
          color: '#1D4ED8',
          padding: 24,
          textAlign: 'center',
        }}
      >

        <ShieldCheck size={48} />

        <h2>PozaSync</h2>

        <LoaderCircle
          size={30}
          className="spin"
        />

        <p>
          Verificando acceso administrativo...
        </p>

      </div>
    )
  }


  // ========================================
  // ACCESO NO AUTENTICADO
  // ========================================

  if (!administrador) {

    return (

      <>

        {errorAcceso && (

          <div
            role="alert"
            style={{
              padding: 16,
              textAlign: 'center',
              backgroundColor: '#FEF3F2',
              color: '#B42318',
            }}
          >

            {errorAcceso}

          </div>

        )}

        <Login
          alIniciarSesion={(perfil) => {

            setErrorAcceso('')

            setAdministrador(perfil)
          }}
        />

      </>
    )
  }


  // ========================================
  // PANEL ADMINISTRATIVO
  // ========================================

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

        <aside
          className={
            `sidebar ${menuAbierto ? 'open' : ''}`
          }
        >

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
                    `nav-link ${
                      isActive ? 'selected' : ''
                    }`
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