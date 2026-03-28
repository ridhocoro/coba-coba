import axios from 'axios';

// ============================================================
// SATU TEMPAT untuk base URL — ubah di .env saja
// REACT_APP_API_URL=http://localhost:5000 (development)
// REACT_APP_API_URL=https://api.yourdomain.com (production)
// ============================================================
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Instance axios dengan base URL & token otomatis
const api = axios.create({
    baseURL: API_URL,
});

// Interceptor: selalu sertakan token dari localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor: handle 401 global (token expired)
// ONLY redirect to /login if the request had a token (real session expiry).
// If no token was sent, the user is a guest — do NOT force redirect.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const hadToken = !!error.config?.headers?.Authorization;
            if (hadToken) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
