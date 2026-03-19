import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const r = await api.get(`/api/admin/users?${params}`);
      setUsers(r.data.users || []);
      setTotal(r.data.total || 0);
    } catch { toast.error('Gagal memuat pasien'); }
    finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openDetail = async (user) => {
    try {
      const r = await api.get(`/api/admin/users/${user._id}`);
      setDetail(r.data);
      if (user.role === 'mahasiswa') {
        const qr = await api.get(`/api/admin/users/${user._id}/quota`);
        setQuota(qr.data);
      } else setQuota(null);
      setQuotaAction(''); setQuotaAmount('');
    } catch { toast.error('Gagal memuat detail'); }
  };

  const handleToggle = async (user) => {
    try {
      await api.put(`/api/admin/users/${user._id}/toggle-status`);
      toast.success(user.isActive ? 'User dinonaktifkan' : 'User diaktifkan');
      fetchUsers();
    } catch { toast.error('Gagal mengubah status'); }
  };

  const handleQuota = async () => {
    if (!quotaAction) { toast.error('Pilih aksi kuota'); return; }
    if (quotaAction === 'add' && !quotaAmount) { toast.error('Masukkan jumlah'); return; }
    setSavingQuota(true);
    try {
      await api.put(`/api/admin/users/${detail.user._id}/quota`, { action: quotaAction, amount: Number(quotaAmount) });
      toast.success('Kuota diperbarui');
      const qr = await api.get(`/api/admin/users/${detail.user._id}/quota`);
      setQuota(qr.data);
      setQuotaAction(''); setQuotaAmount('');
    } catch { toast.error('Gagal memperbarui kuota'); }
    finally { setSavingQuota(false); }
  };

  const pages = Math.ceil(total / 25);

  const S = {
    toolbar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 200 },
    select: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', fontSize: 13 },
    th: { padding: '10px 14px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, textAlign: 'left' },
    td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' },
    btn: (c) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', background: c, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
    btnOutline: (c) => ({ padding: '5px 12px', borderRadius: 6, border: `1px solid ${c}`, background: '#fff', color: c, fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 24 },
    badge: (active) => ({ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#166534' : '#991b1b' }),
    roleBadge: (role) => ({ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: role === 'mahasiswa' ? '#ede9fe' : '#dbeafe', color: role === 'mahasiswa' ? '#5b21b6' : '#1d4ed8' }),
  };

  return (
    <div>
      <div style={S.toolbar}>
        <input style={S.input} placeholder="🔍 Cari nama / email / HP..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select style={S.select} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">Semua Role</option>
          <option value="user">User</option>
          <option value="mahasiswa">Mahasiswa</option>
        </select>
        <div style={{ position: 'relative' }}>
          <button style={{ ...S.btn('#7c3aed'), gap: 6 }}
            onClick={() => setShowMahasiswaMenu(v => !v)}>
            ⚙️ Manajemen Mahasiswa ▾
          </button>
          {showMahasiswaMenu && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 100, minWidth: 240, overflow: 'hidden' }}>
              <button style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='none'}
                onClick={async () => {
                  setShowMahasiswaMenu(false);
                  if (!window.confirm('Upgrade semua akun @apps.ipb.ac.id ke role mahasiswa?')) return;
                  try {
                    const r = await api.post('/api/admin/users/upgrade-mahasiswa');
                    toast.success(r.data.message); fetchUsers();
                  } catch { toast.error('Gagal upgrade role'); }
                }}>
                🎓 Upgrade Role ke Mahasiswa
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Untuk semua email @apps.ipb.ac.id</div>
              </button>
              <button style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='none'}
                onClick={async () => {
                  setShowMahasiswaMenu(false);
                  if (!window.confirm('Reset bonus kuota semua mahasiswa ke 0? Kuota bulanan otomatis tidak berubah.')) return;
                  try {
                    const r = await api.post('/api/admin/users/reset-quota-bonus');
                    toast.success(r.data.message); fetchUsers();
                  } catch { toast.error('Gagal reset kuota'); }
                }}>
                🔄 Reset Kuota Bonus Semua Mahasiswa
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Reset quotaBonus ke 0 untuk semua</div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Total: {total} pasien</div>

      {loading ? <p style={{ color: '#64748b' }}>Memuat...</p> : (
        <table style={S.table}>
          <thead><tr>{['Nama','Email','HP','Role','Status','Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={S.td}><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString('id-ID')}</div></td>
                <td style={S.td}>{u.email}</td>
                <td style={S.td}>{u.phone}</td>
                <td style={S.td}><span style={S.roleBadge(u.role)}>{u.role}</span></td>
                <td style={S.td}><span style={S.badge(u.isActive !== false)}>{u.isActive !== false ? 'Aktif' : 'Nonaktif'}</span></td>
                <td style={{ ...S.td, display: 'flex', gap: 6 }}>
                  <button style={S.btn('#2563eb')} onClick={() => openDetail(u)}>Detail</button>
                  <button style={S.btnOutline(u.isActive !== false ? '#ef4444' : '#16a34a')} onClick={() => handleToggle(u)}>
                    {u.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page-3), page+2).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#475569', fontSize: 12, cursor: 'pointer' }}>{p}</button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>👤 {detail.user.name}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {/* Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
              {[['Email', detail.user.email], ['HP', detail.user.phone], ['Role', detail.user.role], ['Jenis Kelamin', detail.user.gender === 'laki-laki' ? '👨 Laki-laki' : detail.user.gender === 'perempuan' ? '👩 Perempuan' : '-'], ['Status', detail.user.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'], ['Bergabung', new Date(detail.user.createdAt).toLocaleDateString('id-ID')]].map(([k,v]) => (
                <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Kuota mahasiswa */}
            {quota && (
              <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#5b21b6', marginBottom: 8 }}>🎓 Kuota Obat Gratis Bulan Ini</p>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 10 }}>
                  <div><span style={{ color: '#7c3aed' }}>Digunakan:</span> <strong>{quota.used}</strong></div>
                  <div><span style={{ color: '#7c3aed' }}>Maks:</span> <strong>{quota.max}</strong></div>
                  <div><span style={{ color: '#7c3aed' }}>Sisa:</span> <strong style={{ color: quota.remaining > 0 ? '#16a34a' : '#ef4444' }}>{quota.remaining}</strong></div>
                  {quota.manualExtra > 0 && <div><span style={{ color: '#7c3aed' }}>Bonus Admin:</span> <strong>+{quota.manualExtra}</strong></div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={quotaAction} onChange={e => setQuotaAction(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 12 }}>
                    <option value="">Pilih aksi...</option>
                    <option value="add">Tambah kuota</option>
                    <option value="reset">Reset bonus ke 0</option>
                  </select>
                  {quotaAction === 'add' && <input type="number" min="1" max="20" value={quotaAmount} onChange={e => setQuotaAmount(e.target.value)} placeholder="Jumlah" style={{ width: 80, padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 8, fontSize: 12 }} />}
                  <button style={S.btn('#7c3aed')} disabled={savingQuota} onClick={handleQuota}>{savingQuota ? '...' : 'Terapkan'}</button>
                </div>
              </div>
            )}

            {/* History tabs */}
            {['consultations','appointments','orders'].map(type => {
              const items = detail[type] || [];
              if (!items.length) return null;
              const labels = { consultations: '💬 Konsultasi', appointments: '📅 Janji Temu', orders: '📦 Pesanan' };
              return (
                <div key={type} style={{ marginBottom: 14 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{labels[type]} ({items.length})</p>
                  <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map(item => (
                      <div key={item._id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{type === 'orders' ? item.orderNumber : (item.doctorId?.name ? `dr. ${item.doctorId.name}` : '-')}</span>
                        <span style={{ color: '#64748b' }}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;