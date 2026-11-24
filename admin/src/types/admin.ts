export interface Administrador {
  id: string
  nombre: string
  correo: string
  rol: 'administrador'
  activo: boolean
}

export interface Estadisticas {
  usuarios: {
    total: number
    clientes: number
    tecnicos: number
    activos: number
    inactivos: number
  }

  tecnicos: {
    perfiles: number
    disponibles: number
  }

  actividad: {
    solicitudes: number
    servicios: number
    cotizaciones: number
    conversaciones: number
    mensajes: number
    resenas: number
  }
}

export interface Usuario {
  id: string
  nombre: string
  correo: string
  rol: 'cliente' | 'tecnico'
  ciudad: string
  colonia?: string
  activo: boolean
  correo_verificado?: boolean
  fecha_registro?: string
  fecha_cambio_estado?: string
}

export interface ResumenUsuarios {
  registrados: number
  activos: number
  suspendidos: number
}

export interface RespuestaUsuarios {
  total: number
  pagina: number
  limite: number
  usuarios: Usuario[]
  resumen: ResumenUsuarios
}

export interface RespuestaCambioEstado {
  mensaje: string
  usuario: Usuario
}

export interface Tecnico {
  id: string
  usuario_id: string
  nombre: string
  correo: string
  ciudad: string
  colonia?: string
  foto_perfil?: string | null
  activo: boolean
  correo_verificado: boolean
  especialidades: string[]
  especialidad?: string
  descripcion: string
  disponible: boolean
  experiencia_anios: number
  colonias_cobertura: string[]
  portafolio: string[]
  calificacion_promedio: number
  total_resenas: number
  fecha_registro?: string | null
  fecha_creacion?: string | null
}

export interface ResumenTecnicos {
  registrados: number
  disponibles: number
  suspendidos: number
}

export interface RespuestaTecnicos {
  total: number
  pagina: number
  limite: number
  tecnicos: Tecnico[]
  resumen: ResumenTecnicos
}

export interface EstadisticasServiciosTecnico {
  total: number
  pendientes: number
  acordados: number
  finalizados: number
  rechazados: number
}

export interface ResenaTecnico {
  id: string
  calificacion: number
  comentario: string
  fecha_creacion?: string | null
}

export interface DetalleTecnico extends Tecnico {
  servicios: EstadisticasServiciosTecnico
  resenas: ResenaTecnico[]
}

export interface RespuestaDisponibilidad {
  mensaje: string
  perfil_id: string
  disponible: boolean
}