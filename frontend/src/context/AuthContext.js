import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// Waktu inaktivitas maksimal sebelum auto-logout (30 menit)
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

// Event yang dianggap sebagai "aktivitas" user — tanpa mousemove (terlalu agresif)
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Ref untuk menyimpan timer inaktivitas
  const inactivityTimer = useRef(null);
  // Ref untuk fungsi logout agar bisa dipakai di event listener tanpa stale closure
  const logoutRef = useRef(null);

  // ─── Fetch user dari server ─────────────────────────────────────────────────
  const fetchUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
    clearTimeout(inactivityTimer.current);

    if (reason === 'inactivity') {
      toast('Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit.', {
        icon: '⏰',
        duration: 6000,
        style: { background: '#1e293b', color: '#fff' },
      });
    } else {
      toast.success('Logout berhasil!');
    }
  }, []);

  // Simpan referensi logout terbaru agar bisa dipakai di event listener
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // ─── Reset timer setiap ada aktivitas ──────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    localStorage.setItem('lastActivity', Date.now().toString());

    inactivityTimer.current = setTimeout(() => {
      // Hanya logout jika masih ada user yang login
      if (logoutRef.current && localStorage.getItem('token')) {
        logoutRef.current('inactivity');
      }
    }, INACTIVITY_LIMIT_MS);
  }, []);

  // ─── Pasang / lepas event listener aktivitas ────────────────────────────────
  useEffect(() => {
    if (!user) {
      // Tidak ada user login — bersihkan semua
      clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
      return;
    }

    // Cek apakah sesi sudah expired sejak terakhir kali halaman ditutup
    // Hanya cek jika lastActivity pernah di-set (bukan 0 / fresh login)
    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    if (lastActivity > 0 && Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
      logout('inactivity');
      return;
    }

    // Mulai memantau aktivitas
    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetInactivityTimer));

    return () => {
      clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [user, resetInactivityTimer, logout]);

  // ─── Login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('lastActivity', Date.now().toString());
      setToken(newToken);
      setUser(newUser);
      toast.success('Login berhasil!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login gagal');
      return false;
    }
  };

  // ─── Register ───────────────────────────────────────────────────────────────
  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('lastActivity', Date.now().toString());
      setToken(newToken);
      setUser(newUser);
      toast.success('Registrasi berhasil!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registrasi gagal');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
