import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isAuthCall = error?.config?.url?.includes('/auth/login');
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('hms_token');
      window.dispatchEvent(new CustomEvent('hms:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.error?.details?.length) {
    return data.error.details.map((item) => item.message).join(', ');
  }
  return data?.error?.message || error?.message || 'Something went wrong';
}

export default api;
