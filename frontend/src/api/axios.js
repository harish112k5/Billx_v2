import axios from 'axios';

// ⚠️ PRODUCTION FIX: Runtime hostname detection to route API requests correctly
const _hostname = (typeof window !== 'undefined') ? window.location.hostname : 'localhost';
const _isLocal = _hostname === 'localhost' || _hostname === '127.0.0.1';
const _PROD_API = 'https://billx-v2.onrender.com/api';
const _DEV_API = 'http://localhost:5001/api';
const API_BASE = _isLocal ? _DEV_API : _PROD_API;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT token from localStorage
api.interceptors.request.use(config => {
  const token = localStorage.getItem('billx_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('billx_token');
      localStorage.removeItem('billx_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
