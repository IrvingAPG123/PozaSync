import { useState } from 'react'
import type { FormEvent } from 'react'

import {
  ShieldCheck,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
  Users,
  ChartNoAxesCombined,
  Settings,
} from 'lucide-react'

import axios from 'axios'

import api, {
  guardarToken,
  eliminarToken,
} from '../services/api'

import type {
  Administrador,
} from '../types/admin'

interface Props {
  alIniciarSesion: (
    administrador: Administrador
  ) => void
}

export default function Login({
  alIniciarSesion,
}: Props) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function iniciarSesion(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault()

    setError('')
    setCargando(true)

    try {
      const respuesta = await api.post(
        '/admin/login',
        {
          correo: correo.trim().toLowerCase(),
          contrasena,
        },
      )

      guardarToken(
        respuesta.data.access_token,
      )

      const perfil = await api.get<Administrador>(
        '/admin/yo',
      )

      if (
        perfil.data.rol !== 'administrador' ||
        !perfil.data.activo
      ) {
        throw new Error('Acceso no autorizado.')
      }

      setContrasena('')
      alIniciarSesion(perfil.data)

    } catch (error) {
      eliminarToken()

      if (axios.isAxiosError(error)) {
        const detalle = error.response?.data?.detail

        setError(
          typeof detalle === 'string'
            ? detalle
            : 'No fue posible conectar con el servidor.',
        )
      } else {
        setError('No fue posible iniciar sesión.')
      }

    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-page">

      <section className="login-presentation">

        <div className="brand brand-light">
          <ShieldCheck size={36} />

          <div>
            <strong>PozaSync</strong>
            <span>ADMINISTRACIÓN</span>
          </div>
        </div>

        <div className="presentation-content">

          <span className="presentation-tag">
            CENTRO DE CONTROL
          </span>

          <h1>
            Toda tu plataforma.
            <br />
            Un solo lugar.
          </h1>

          <p>
            Supervisa la actividad, consulta usuarios
            y administra el crecimiento de PozaSync.
          </p>

          <div className="presentation-feature">
            <Users />
            Gestión de clientes y técnicos
          </div>

          <div className="presentation-feature">
            <ChartNoAxesCombined />
            Estadísticas de la plataforma
          </div>

          <div className="presentation-feature">
            <Settings />
            Control administrativo centralizado
          </div>

        </div>

        <footer>
          PozaSync · Plataforma de servicios
        </footer>

      </section>

      <section className="login-form-section">

        <form
          className="login-form"
          onSubmit={iniciarSesion}
        >

          <div className="login-shield">
            <ShieldCheck size={32} />
          </div>

          <h2>Bienvenido</h2>

          <p className="muted">
            Inicia sesión en el panel administrativo.
          </p>

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          <label htmlFor="correo">
            Correo electrónico
          </label>

          <div className="input-group">
            <Mail size={19} />

            <input
              id="correo"
              type="email"
              placeholder="correo@ejemplo.com"
              value={correo}
              onChange={(e) =>
                setCorreo(e.target.value)
              }
              autoComplete="username"
              required
            />
          </div>

          <label htmlFor="contrasena">
            Contraseña
          </label>

          <div className="input-group">
            <LockKeyhole size={19} />

            <input
              id="contrasena"
              type={mostrar ? 'text' : 'password'}
              placeholder="Introduce tu contraseña"
              value={contrasena}
              onChange={(e) =>
                setContrasena(e.target.value)
              }
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="icon-button"
              aria-label={
                mostrar
                  ? 'Ocultar contraseña'
                  : 'Mostrar contraseña'
              }
              onClick={() => setMostrar(!mostrar)}
            >
              {mostrar
                ? <EyeOff size={19} />
                : <Eye size={19} />}
            </button>
          </div>

          <button
            className="primary-button login-button"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <LoaderCircle
                  size={20}
                  className="spin"
                />
                Iniciando sesión...
              </>
            ) : (
              <>
                Iniciar sesión
                <ArrowRight size={20} />
              </>
            )}
          </button>

          <div className="security-note">
            <LockKeyhole size={15} />
            Acceso exclusivo para administradores
          </div>

        </form>

      </section>

    </div>
  )
}