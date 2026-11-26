import { Platform } from 'react-native';

// ==========================================
// DIRECCIONES DE DESARROLLO
// ==========================================

const API_LOCAL = 'http://127.0.0.1:8001';

const ADMIN_LOCAL = 'http://localhost:5173';

// ==========================================
// DIRECCIONES DE PRODUCCION
// ==========================================

const API_PRODUCCION =
  'https://pozasync-api.onrender.com';

const ADMIN_PRODUCCION =
  'https://pozasync-admin.onrender.com';

// ==========================================
// CONFIGURACION DEL BACKEND
// ==========================================

export const API_URL = (
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_WEB_API_URL ||
      (__DEV__ ? API_LOCAL : API_PRODUCCION)
    : process.env.EXPO_PUBLIC_API_URL ||
      API_PRODUCCION
).replace(/\/+$/, '');

// ==========================================
// CONFIGURACION ADMINISTRATIVA
// ==========================================

export const ADMIN_URL = (
  process.env.EXPO_PUBLIC_ADMIN_URL ||
  (__DEV__ ? ADMIN_LOCAL : ADMIN_PRODUCCION)
).replace(/\/+$/, '');