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
  const [user, setUser]                   = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [token, setToken]                 = useState(localStorage.getItem('token'));

  // Ref untuk menyimpan timer inaktivitas
  const inactivityTimer = useRef(null);
  // Ref untuk fungsi logout agar bisa dipakai di event listener tanpa stale closure
  const logoutRef = useRef(null);

  // ─── Fetch profil dokter (hanya jika role === 'doctor') ─────────────────────
  const fetchDoctorProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/doctors/my/profile');
      setDoctorProfile(res.data.doctor || null);
    } catch {
      setDoctorProfile(null);
    }
  }, []);

  // ─── Fetch user dari server ─────────────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/me');
      const userData = response.data;
      setUser(userData);
      // Jika dokter, langsung fetch profil dokter sekalian
      if (userData?.role === 'doctor') {
        fetchDoctorProfile();
      }
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [fetchDoctorProfile]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
    setDoctorProfile(null);
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
      if (logoutRef.current && localStorage.getItem('token')) {
        logoutRef.current('inactivity');
      }
    }, INACTIVITY_LIMIT_MS);
  }, []);

  // ─── Pasang / lepas event listener aktivitas ────────────────────────────────
  useEffect(() => {
    if (!user) {
      clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
      return;
    }

    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    if (lastActivity > 0 && Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
      logout('inactivity');
      return;
    }

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
      // Fetch profil dokter jika role dokter
      if (newUser?.role === 'doctor') {
        fetchDoctorProfile();
      }
      toast.success('Login berhasil!');
      return true;
    } catch (error) {
      if (error.response?.data?.needsVerification) throw error;
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

  // ─── Refresh doctorProfile (dipanggil setelah dokter simpan profil) ──────────
  const refreshDoctorProfile = useCallback(() => {
    if (user?.role === 'doctor') fetchDoctorProfile();
  }, [user, fetchDoctorProfile]);

  return (
    <AuthContext.Provider value={{
      user, setUser,
      doctorProfile, setDoctorProfile, refreshDoctorProfile,
      login, register, logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
