import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

let redirectingToLogin = false;

export const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth:cleared'));
};

// Attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const requestUrl = err.config?.url || '';
      const isLoginRequest = requestUrl.includes('/auth/login');
      const skipRedirect = err.config?.skipAuthRedirect;

      clearStoredAuth();

      if (!isLoginRequest && !skipRedirect && window.location.pathname !== '/login' && !redirectingToLogin) {
        redirectingToLogin = true;
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
