// Admin/index.js — Layout utama dashboard admin
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import AdminDashboard    from './Dashboard';
import ManageDoctors     from './ManageDoctors';
import ManageUsers       from './ManageUsers';
import ManageConsultations from './ManageConsultations';
import ManageAppointments  from './ManageAppointments';
import ManagePharmacy    from './ManagePharmacy';
import Reports           from './Reports';
import SickLetters       from './SickLetters';
import AdminChat         from './AdminChat';
import ClinicSettings    from './ClinicSettings';

const TABS = [
  { key: 'dashboard',     label: 'Dashboard',     icon: '📊' },
  { key: 'doctors',       label: 'Dokter',         icon: '👨‍⚕️' },
  { key: 'users',         label: 'Pasien',          icon: '👥' },
  { key: 'consultations', label: 'Konsultasi',      icon: '💬' },
  { key: 'appointments',  label: 'Janji Temu',      icon: '📅' },
  { key: 'pharmacy',      label: 'Farmasi',         icon: '💊' },
  { key: 'reports',       label: 'Laporan',         icon: '📈' },
  { key: 'sick-letters',  label: 'Surat Sakit',     icon: '📄' },
  { key: 'chat',          label: 'Chat',             icon: '💭' },
  { key: 'clinic-settings', label: 'Pengaturan',    icon: '⚙️' },
];

const AdminIndex = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadChat, setUnreadChat] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') { 
      navigate('/login'); 
      return; 
    }
  }, [user, navigate]);

  // Poll unread chat
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await api.get('/api/admin/chat/threads');
        const total = (r.data.threads || []).reduce((s, t) => s + (t.unreadAdmin || 0), 0);
        setUnreadChat(total);
      } catch (err) {
        console.error('Fetch unread chat error:', err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch admin notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const r = await api.get('/api/notifications?limit=30');
      const notifs = r.data.notifications || [];
      setNotifications(notifs);
      setUnreadNotif(notifs.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setUnreadNotif(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const styles = {
    wrap: { 
      display: 'flex', 
      minHeight: '100vh', 
      background: '#f1f5f9', 
      fontFamily: "'Inter', -apple-system, sans-serif" 
    },
    // SIDEBAR - FIXED POSITION
    sidebar: { 
      width: 230, 
      background: '#0f172a', 
      display: 'flex', 
      flexDirection: 'column', 
      flexShrink: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      overflowY: 'auto',
      zIndex: 100
    },
    logo: { 
      padding: '20px 16px', 
      borderBottom: '1px solid #1e293b',
      position: 'sticky',
      top: 0,
      background: '#0f172a',
      zIndex: 10
    },
    logoTitle: { 
      color: '#f8fafc', 
      fontWeight: 700, 
      fontSize: 15, 
      margin: 0 
    },
    logoSub: { 
      color: '#64748b', 
      fontSize: 11, 
      margin: '2px 0 0' 
    },
    nav: { 
      padding: '12px 0', 
      flex: 1 
    },
    tabBtn: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      padding: '10px 16px',
      background: active ? '#1e40af' : 'transparent',
      color: active ? '#fff' : '#94a3b8',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      transition: 'all .15s',
      borderRadius: 0
    }),
    sidebarFooter: { 
      padding: '12px 16px', 
      borderTop: '1px solid #1e293b',
      marginTop: 'auto'
    },
    // MAIN CONTENT - dengan margin left untuk mengakomodasi sidebar fixed
    main: { 
      flex: 1, 
      marginLeft: 260,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    },
    header: { 
      background: '#fff', 
      borderBottom: '1px solid #e2e8f0', 
      padding: '14px 28px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 50
    },
    headerTitle: { 
      fontWeight: 700, 
      fontSize: 17, 
      color: '#0f172a' 
    },
    content: { 
      padding: 28,
      flex: 1
    },
    bellBtn: { 
      position: 'relative', 
      background: 'none', 
      border: '1px solid #e2e8f0', 
      borderRadius: 8, 
      width: 36, 
      height: 36, 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontSize: 17 
    },
    notifDrop: { 
      position: 'absolute', 
      top: 48, 
      right: 0, 
      width: 320, 
      background: '#fff', 
      border: '1px solid #e2e8f0', 
      borderRadius: 12, 
      boxShadow: '0 8px 24px rgba(0,0,0,.12)', 
      zIndex: 1000, 
      overflow: 'hidden' 
    },
    notifHeader: {
      padding: '12px 16px',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    notifItem: (isRead) => ({
      padding: '10px 16px',
      borderBottom: '1px solid #f8fafc',
      background: isRead ? '#fff' : '#eff6ff',
      cursor: 'default'
    }),
    notifTitle: (isRead) => ({
      fontWeight: isRead ? 400 : 700,
      fontSize: 13,
      color: '#0f172a'
    }),
    notifMessage: {
      fontSize: 12,
      color: '#475569',
      marginTop: 2
    },
    notifTime: {
      fontSize: 10,
      color: '#94a3b8',
      marginTop: 4
    }
  };

  const activeLabel = TABS.find(t => t.key === activeTab)?.label || '';

  return (
    <div style={styles.wrap}>
      {/* Sidebar - FIXED POSITION */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <p style={styles.logoTitle}>🏥 Klinik Pratama IPB</p>
          <p style={styles.logoSub}>Admin Dashboard</p>
        </div>
        
        <nav style={styles.nav}>
          {TABS.map(t => (
            <button 
              key={t.key} 
              style={styles.tabBtn(activeTab === t.key)} 
              onClick={() => setActiveTab(t.key)}
              onMouseEnter={e => {
                if (activeTab !== t.key) {
                  e.currentTarget.style.background = '#1e293b';
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== t.key) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === 'chat' && unreadChat > 0 && (
                <span style={{ 
                  marginLeft: 'auto', 
                  background: '#ef4444', 
                  color: '#fff', 
                  borderRadius: 20, 
                  padding: '1px 7px', 
                  fontSize: 10, 
                  fontWeight: 700 
                }}>
                  {unreadChat > 99 ? '99+' : unreadChat}
                </span>
              )}
            </button>
          ))}
        </nav>
        
        <div style={styles.sidebarFooter}>
          <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>Masuk sebagai</p>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 8px', fontWeight: 600 }}>
            {user?.name || 'Admin'}
          </p>
          <button 
            onClick={handleLogout} 
            style={{ 
              width: '100%', 
              padding: '8px 0', 
              background: '#1e293b', 
              color: '#94a3b8', 
              border: '1px solid #334155', 
              borderRadius: 6, 
              fontSize: 12, 
              cursor: 'pointer', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 6 
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.borderColor = '#334155';
            }}
          >
            🚪 Keluar
          </button>
        </div>
      </aside>

      {/* Main content - dengan margin left */}
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>{activeLabel}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </span>

            {/* Bell Notifikasi */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { 
                  setShowNotif(v => !v); 
                  if (!showNotif) markAllRead(); 
                }}
                style={styles.bellBtn}
              >
                🔔
                {unreadNotif > 0 && (
                  <span style={{ 
                    position: 'absolute', 
                    top: -4, 
                    right: -4, 
                    background: '#ef4444', 
                    color: '#fff', 
                    borderRadius: 20, 
                    fontSize: 9, 
                    fontWeight: 700, 
                    padding: '1px 5px', 
                    minWidth: 16, 
                    textAlign: 'center' 
                  }}>
                    {unreadNotif > 9 ? '9+' : unreadNotif}
                  </span>
                )}
              </button>

              {showNotif && (
                <div style={styles.notifDrop}>
                  <div style={styles.notifHeader}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      Notifikasi Admin
                    </span>
                    <button 
                      onClick={markAllRead} 
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        fontSize: 11, 
                        color: '#2563eb', 
                        cursor: 'pointer', 
                        fontWeight: 600 
                      }}
                    >
                      Tandai semua dibaca
                    </button>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 && (
                      <p style={{ padding: 16, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                        Tidak ada notifikasi
                      </p>
                    )}
                    {notifications.map(n => (
                      <div key={n._id} style={styles.notifItem(n.isRead)}>
                        <div style={styles.notifTitle(n.isRead)}>{n.title}</div>
                        <div style={styles.notifMessage}>{n.message}</div>
                        <div style={styles.notifTime}>
                          {new Date(n.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={styles.content}>
          {activeTab === 'dashboard'      && <AdminDashboard    onNavigate={setActiveTab} />}
          {activeTab === 'doctors'        && <ManageDoctors />}
          {activeTab === 'users'          && <ManageUsers />}
          {activeTab === 'consultations'  && <ManageConsultations />}
          {activeTab === 'appointments'   && <ManageAppointments />}
          {activeTab === 'pharmacy'       && <ManagePharmacy />}
          {activeTab === 'reports'        && <Reports />}
          {activeTab === 'sick-letters'   && <SickLetters />}
          {activeTab === 'chat'           && <AdminChat />}
          {activeTab === 'clinic-settings' && <ClinicSettings />}
        </div>
      </main>
    </div>
  );
};

export default AdminIndex;