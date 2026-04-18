// Admin/ManageUsers.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';

const ManageUsers = () => {
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [detail, setDetail]   = useState(null);
  const [quota, setQuota]     = useState(null);
  const [quotaAction, setQuotaAction] = useState('');
  const [quotaAmount, setQuotaAmount] = useState('');
  const [savingQuota, setSavingQuota] = useState(false);
  const [showMahasiswaMenu, setShowMahasiswaMenu] = useState(false);
  const [error, setError] = useState(null);
  const mahasiswaMenuRef = useRef(null);

  // Handle click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mahasiswaMenuRef.current && !mahasiswaMenuRef.current.contains(e.target)) {
        setShowMahasiswaMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ 
        page: page, 
        limit: 25 
      });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      
      const response = await api.get(`/api/admin/users?${params.toString()}`);
      
      // Handle response dengan aman
      if (response.data && response.data.success !== false) {
        setUsers(response.data.users || []);
        setTotal(response.data.total || 0);
      } else {
        throw new Error(response.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memuat pasien';
      setError(errorMsg);
      toast.error(errorMsg);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openDetail = async (user) => {
    const userId = user.id || user._id;
    if (!userId) {
      toast.error('ID user tidak valid');
      return;
    }
    
    try {
      const response = await api.get(`/api/admin/users/${userId}`);
      if (response.data && response.data.success !== false) {
        setDetail(response.data);
        
        // Fetch quota only for mahasiswa
        if (response.data.user?.role === 'mahasiswa') {
          try {
            const quotaRes = await api.get(`/api/admin/users/${userId}/quota`);
            setQuota(quotaRes.data);
          } catch (quotaErr) {
            console.error('Quota fetch error:', quotaErr);
            setQuota(null);
          }
        } else {
          setQuota(null);
        }
        
        setQuotaAction('');
        setQuotaAmount('');
      } else {
        throw new Error(response.data?.message || 'Gagal memuat detail');
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
      toast.error(err.response?.data?.message || 'Gagal memuat detail pasien');
    }
  };

  const handleToggle = async (user) => {
    const userId = user.id || user._id;
    if (!userId) {
      toast.error('ID user tidak valid');
      return;
    }
    
    try {
      const response = await api.put(`/api/admin/users/${userId}/toggle-status`);
      if (response.data && response.data.success !== false) {
        toast.success(user.isActive !== false ? 'User dinonaktifkan' : 'User diaktifkan');
        fetchUsers();
      } else {
        throw new Error(response.data?.message || 'Gagal mengubah status');
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error(err.response?.data?.message || 'Gagal mengubah status user');
    }
  };

  const handleQuota = async () => {
    if (!quotaAction) {
      toast.error('Pilih aksi kuota');
      return;
    }
    if (quotaAction === 'add' && (!quotaAmount || quotaAmount <= 0)) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    
    setSavingQuota(true);
    try {
      const uid = detail?.user?.id || detail?.user?._id;
      if (!uid) throw new Error('User ID tidak ditemukan');
      
      const response = await api.put(`/api/admin/users/${uid}/quota`, { 
        action: quotaAction, 
        amount: quotaAction === 'add' ? Number(quotaAmount) : 0 
      });
      
      if (response.data && response.data.success !== false) {
        toast.success('Kuota diperbarui');
        // Refresh quota data
        const quotaRes = await api.get(`/api/admin/users/${uid}/quota`);
        setQuota(quotaRes.data);
        setQuotaAction('');
        setQuotaAmount('');
      } else {
        throw new Error(response.data?.message || 'Gagal memperbarui kuota');
      }
    } catch (err) {
      console.error('Quota update error:', err);
      toast.error(err.response?.data?.message || 'Gagal memperbarui kuota');
    } finally {
      setSavingQuota(false);
    }
  };

  const handleUpgradeMahasiswa = async () => {
    if (!window.confirm('Upgrade semua akun dengan email @apps.ipb.ac.id ke role mahasiswa?\n\nTindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    
    try {
      const response = await api.post('/api/admin/users/upgrade-mahasiswa');
      if (response.data && response.data.success !== false) {
        toast.success(response.data.message || 'Berhasil upgrade role mahasiswa');
        fetchUsers();
      } else {
        throw new Error(response.data?.message || 'Gagal upgrade role');
      }
    } catch (err) {
      console.error('Upgrade mahasiswa error:', err);
      toast.error(err.response?.data?.message || 'Gagal upgrade role mahasiswa');
    }
    setShowMahasiswaMenu(false);
  };

  const handleResetQuotaBonus = async () => {
    if (!window.confirm('Reset bonus kuota semua mahasiswa ke 0?\n\nKuota bulanan otomatis tidak akan berubah.')) {
      return;
    }
    
    try {
      const response = await api.post('/api/admin/users/reset-quota-bonus');
      if (response.data && response.data.success !== false) {
        toast.success(response.data.message || 'Berhasil reset kuota bonus');
        fetchUsers();
      } else {
        throw new Error(response.data?.message || 'Gagal reset kuota');
      }
    } catch (err) {
      console.error('Reset quota error:', err);
      toast.error(err.response?.data?.message || 'Gagal reset kuota bonus');
    }
    setShowMahasiswaMenu(false);
  };

  const pages = Math.max(1, Math.ceil(total / 25));

  const S = {
    toolbar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 200 },
    select: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', fontSize: 13 },
    th: { padding: '10px 14px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, textAlign: 'left' },
    td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' },
    btn: (c) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', background: c, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
    btnOutline: (c) => ({ padding: '5px 12px', borderRadius: 6, border: `1px solid ${c}`, background: '#fff', color: c, fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 24 },
    badge: (active) => ({ 
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, 
      background: active !== false ? '#dcfce7' : '#fee2e2', 
      color: active !== false ? '#166534' : '#991b1b' 
    }),
    roleBadge: (role) => ({ 
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, 
      background: role === 'mahasiswa' ? '#ede9fe' : '#dbeafe', 
      color: role === 'mahasiswa' ? '#5b21b6' : '#1d4ed8' 
    }),
    errorBox: {
      background: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      color: '#991b1b',
      fontSize: 13,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10
    }
  };

  return (
    <div>
      <div style={S.toolbar}>
        <input 
          style={S.input} 
          placeholder="🔍 Cari nama / email / HP..." 
          value={search} 
          onChange={e => { setSearch(e.target.value); setPage(1); }} 
        />
        <select 
          style={S.select} 
          value={roleFilter} 
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">Semua Role</option>
          <option value="user">User</option>
          <option value="mahasiswa">Mahasiswa</option>
        </select>
        
        <div style={{ position: 'relative' }} ref={mahasiswaMenuRef}>
          <button style={{ ...S.btn('#7c3aed'), display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowMahasiswaMenu(v => !v)}>
            ⚙️ Manajemen Mahasiswa ▾
          </button>
          {showMahasiswaMenu && (
            <div style={{ 
              position: 'absolute', top: '110%', right: 0, background: '#fff', 
              border: '1px solid #e2e8f0', borderRadius: 10, 
              boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 100, 
              minWidth: 260, overflow: 'hidden' 
            }}>
              <button 
                style={{ 
                  display: 'block', width: '100%', padding: '10px 16px', 
                  background: 'none', border: 'none', textAlign: 'left', 
                  fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9'
                }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} 
                onMouseLeave={e => e.currentTarget.style.background='none'}
                onClick={handleUpgradeMahasiswa}
              >
                🎓 Upgrade Role ke Mahasiswa
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Untuk semua email @apps.ipb.ac.id
                </div>
              </button>
              <button 
                style={{ 
                  display: 'block', width: '100%', padding: '10px 16px', 
                  background: 'none', border: 'none', textAlign: 'left', 
                  fontSize: 13, cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} 
                onMouseLeave={e => e.currentTarget.style.background='none'}
                onClick={handleResetQuotaBonus}
              >
                🔄 Reset Kuota Bonus Semua Mahasiswa
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Reset quotaBonus ke 0 untuk semua
                </div>
              </button>
            </div>
          )}
        </div>
        
        <button style={S.btn('#2563eb')} onClick={() => fetchUsers()}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Total: {total} pasien
      </div>

      {/* Error display */}
      {error && (
        <div style={S.errorBox}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => fetchUsers()} 
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748b' }}>⏳ Memuat data pasien...</p>
      ) : users.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <p>Tidak ada data pasien</p>
          {search && <p style={{ fontSize: 12 }}>Coba hapus filter pencarian</p>}
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Nama', 'Email', 'HP', 'Role', 'Status', 'Aksi'].map(h => 
                <th key={h} style={S.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const userId = u.id || u._id;
              const isActive = u.isActive !== false;
              const role = u.role || 'user';
              
              return (
                <tr key={userId}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{u.name || '-'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}
                    </div>
                  </td>
                  <td style={S.td}>{u.email || '-'}</td>
                  <td style={S.td}>{u.phone || '-'}</td>
                  <td style={S.td}>
                    <span style={S.roleBadge(role)}>
                      {role === 'mahasiswa' ? '🎓 Mahasiswa' : role === 'user' ? '👤 User' : role}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(isActive)}>
                      {isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ ...S.td, display: 'flex', gap: 6 }}>
                    <button style={S.btn('#2563eb')} onClick={() => openDetail(u)}>Detail</button>
                    <button 
                      style={S.btnOutline(isActive ? '#ef4444' : '#16a34a')} 
                      onClick={() => handleToggle(u)}
                    >
                      {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pages > 1 && !loading && users.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setPage(1)} 
            disabled={page === 1}
            style={{ 
              padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', 
              background: page === 1 ? '#f1f5f9' : '#fff', 
              color: page === 1 ? '#94a3b8' : '#475569', 
              fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer' 
            }}
          >
            «
          </button>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
            let p;
            if (pages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= pages - 2) {
              p = pages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <button 
                key={p} 
                onClick={() => setPage(p)} 
                style={{ 
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', 
                  background: p === page ? '#2563eb' : '#fff', 
                  color: p === page ? '#fff' : '#475569', 
                  fontSize: 12, cursor: 'pointer' 
                }}
              >
                {p}
              </button>
            );
          })}
          <button 
            onClick={() => setPage(pages)} 
            disabled={page === pages}
            style={{ 
              padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', 
              background: page === pages ? '#f1f5f9' : '#fff', 
              color: page === pages ? '#94a3b8' : '#475569', 
              fontSize: 12, cursor: page === pages ? 'not-allowed' : 'pointer' 
            }}
          >
            »
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                👤 {detail.user?.name || 'User'}
              </h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {/* User Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
              {[
                ['Email', detail.user?.email || '-'],
                ['HP', detail.user?.phone || '-'],
                ['Role', detail.user?.role === 'mahasiswa' ? '🎓 Mahasiswa' : detail.user?.role === 'user' ? '👤 User' : detail.user?.role],
                ['Jenis Kelamin', detail.user?.gender === 'laki-laki' ? '👨 Laki-laki' : detail.user?.gender === 'perempuan' ? '👩 Perempuan' : '-'],
                ['Status', detail.user?.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'],
                ['Bergabung', detail.user?.createdAt ? new Date(detail.user.createdAt).toLocaleDateString('id-ID') : '-']
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Quota for mahasiswa */}
            {quota && detail.user?.role === 'mahasiswa' && (
              <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#5b21b6', marginBottom: 8 }}>
                  🎓 Kuota Obat Gratis Bulan Ini
                </p>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div><span style={{ color: '#7c3aed' }}>Digunakan:</span> <strong>{quota.used || 0}</strong></div>
                  <div><span style={{ color: '#7c3aed' }}>Maks:</span> <strong>{quota.max || 8}</strong></div>
                  <div>
                    <span style={{ color: '#7c3aed' }}>Sisa:</span> 
                    <strong style={{ color: (quota.remaining || 0) > 0 ? '#16a34a' : '#ef4444' }}>
                      {quota.remaining || 0}
                    </strong>
                  </div>
                  {(quota.manualExtra || 0) > 0 && (
                    <div><span style={{ color: '#7c3aed' }}>Bonus Admin:</span> <strong>+{quota.manualExtra}</strong></div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select 
                    value={quotaAction} 
                    onChange={e => setQuotaAction(e.target.value)} 
                    style={{ padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 12 }}
                  >
                    <option value="">Pilih aksi...</option>
                    <option value="add">Tambah kuota</option>
                    <option value="reset">Reset bonus ke 0</option>
                  </select>
                  {quotaAction === 'add' && (
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={quotaAmount} 
                      onChange={e => setQuotaAmount(e.target.value)} 
                      placeholder="Jumlah" 
                      style={{ width: 80, padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 12 }} 
                    />
                  )}
                  <button 
                    style={S.btn('#7c3aed')} 
                    disabled={savingQuota} 
                    onClick={handleQuota}
                  >
                    {savingQuota ? '...' : 'Terapkan'}
                  </button>
                </div>
              </div>
            )}

            {/* History sections */}
            {[
              { type: 'consultations', label: '💬 Konsultasi', key: 'consultations' },
              { type: 'appointments', label: '📅 Janji Temu', key: 'appointments' },
              { type: 'orders', label: '📦 Pesanan', key: 'orders' }
            ].map(section => {
              const items = detail[section.key] || [];
              if (items.length === 0) return null;
              
              return (
                <div key={section.type} style={{ marginBottom: 14 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    {section.label} ({items.length})
                  </p>
                  <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.slice(0, 10).map((item, idx) => (
                      <div key={item._id || idx} style={{ 
                        background: '#f8fafc', borderRadius: 8, padding: '8px 12px', 
                        fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span>
                          {section.type === 'orders' 
                            ? (item.orderNumber || '-') 
                            : (item.doctorId?.name ? fmtDoctorName(item.doctorId) : '-')
                          }
                        </span>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                          background: item.status === 'completed' || item.status === 'selesai' ? '#dcfce7' : '#fef3c7',
                          color: item.status === 'completed' || item.status === 'selesai' ? '#166534' : '#92400e'
                        }}>
                          {item.status || '-'}
                        </span>
                      </div>
                    ))}
                    {items.length > 10 && (
                      <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                        +{items.length - 10} item lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {(!detail.consultations || detail.consultations.length === 0) &&
             (!detail.appointments || detail.appointments.length === 0) &&
             (!detail.orders || detail.orders.length === 0) && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
                Belum ada riwayat konsultasi, janji temu, atau pesanan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;