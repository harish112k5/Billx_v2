import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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
