import axios from 'axios';

// API URL: always use Render in production, localhost in dev
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://billx-v2.onrender.com/api'
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || API_BASE,
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
