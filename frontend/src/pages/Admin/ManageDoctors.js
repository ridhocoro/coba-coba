import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const ManageDoctors = () => {
  const [doctors, setDoctors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [spec, setSpec]           = useState('');
  const [selected, setSelected]   = useState(null); // detail modal
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideDates, setOverrideDates] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrides, setOverrides] = useState([]);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/admin/doctors${spec ? `?specialization=${spec}` : ''}`);
      setDoctors(r.data.doctors || []);
    } catch { toast.error('Gagal memuat dokter'); }
    finally { setLoading(false); }
  }, [spec]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const openDetail = async (doc) => {
    try {
      const r = await api.get(`/api/admin/doctors/${doc._id}`);
      setSelected(r.data);
      setEditForm({
        name: r.data.doctor.name,
        specialization: r.data.doctor.specialization,
        consultationFee: r.data.doctor.consultationFee,
        bio: r.data.doctor.bio || '',
      });
      setEditMode(false);
    } catch { toast.error('Gagal memuat detail dokter'); }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/doctors/${selected.doctor._id}`, editForm);
      toast.success('Profil dokter diperbarui');
      setEditMode(false);
      fetchDoctors();
      openDetail(selected.doctor);
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (doc) => {
    try {
      await api.put(`/api/admin/doctors/${doc._id}/toggle-status`);
      toast.success(doc.isActive ? 'Dokter dinonaktifkan' : 'Dokter diaktifkan');
      fetchDoctors();
      if (selected?.doctor?._id === doc._id) openDetail(doc);
    } catch { toast.error('Gagal mengubah status'); }
  };

  const openOverride = async (doc) => {
    setOverrideModal(doc);
    setOverrideDates('');
    setOverrideReason('');
    try {
      const r = await api.get(`/api/admin/doctors/${doc._id}/schedule`);
      setOverrides(r.data.overrides || []);
    } catch {}
  };

  const handleAddOverride = async () => {
    const dates = overrideDates.split(',').map(s => s.trim()).filter(Boolean);
    if (!dates.length) { toast.error('Masukkan minimal 1 tanggal'); return; }
    try {
      const r = await api.put(`/api/admin/doctors/${overrideModal._id}/schedule/override`, { dates, reason: overrideReason });
      toast.success(`${r.data.blockedDates.length} tanggal diblokir. ${r.data.cancelledAppointments || 0} janji dibatalkan.`);
      const r2 = await api.get(`/api/admin/doctors/${overrideModal._id}/schedule`);
      setOverrides(r2.data.overrides || []);
      setOverrideDates(''); setOverrideReason('');
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal memblokir jadwal'); }
  };

  const handleDeleteOverride = async (date) => {
    try {
      await api.delete(`/api/admin/doctors/${overrideModal._id}/schedule/override/${date}`);
      setOverrides(prev => prev.filter(o => o.date !== date));
      toast.success('Blokiran dihapus');
    } catch { toast.error('Gagal menghapus blokiran'); }
  };

  const filtered = doctors.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const specs = [...new Set(doctors.map(d => d.specialization).filter(Boolean))];

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
    modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24 },
    label: { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 },
    field: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  };

  return (
    <div>
      <div style={S.toolbar}>
        <input style={S.input} placeholder="🔍 Cari nama / spesialisasi..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={spec} onChange={e => setSpec(e.target.value)}>
          <option value="">Semua Spesialisasi</option>
          {specs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={S.btn('#2563eb')} onClick={fetchDoctors}>🔄 Refresh</button>
      </div>

      {loading ? <p style={{ color: '#64748b' }}>Memuat...</p> : (
        <table style={S.table}>
          <thead>
            <tr>{['Dokter','Spesialisasi','Fee','Rating','Status','Aksi'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(doc => (
              <tr key={doc._id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>dr. {doc.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{doc.userId?.email}</div>
                </td>
                <td style={S.td}>{doc.specialization}</td>
                <td style={S.td}>Rp {(doc.consultationFee||0).toLocaleString('id-ID')}</td>
                <td style={S.td}>{doc.rating || 0} ⭐ ({doc.totalReviews || 0})</td>
                <td style={S.td}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: doc.isActive ? '#dcfce7' : '#fee2e2', color: doc.isActive ? '#166534' : '#991b1b' }}>
                    {doc.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td style={{ ...S.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={S.btn('#2563eb')} onClick={() => openDetail(doc)}>Detail</button>
                  <button style={S.btnOutline('#f59e0b')} onClick={() => openOverride(doc)}>📅 Override</button>
                  <button style={S.btnOutline(doc.isActive ? '#ef4444' : '#16a34a')} onClick={() => handleToggle(doc)}>
                    {doc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>Tidak ada dokter</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── Detail / Edit Modal ── */}
      {selected && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editMode ? '✏️ Edit Dokter' : `👨‍⚕️ dr. ${selected.doctor.name}`}
              </h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {!editMode ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 16 }}>
                  {[['Spesialisasi', selected.doctor.specialization], ['Fee Konsultasi', `Rp ${(selected.doctor.consultationFee||0).toLocaleString('id-ID')}`], ['Rating', `${selected.doctor.rating||0} ⭐ (${selected.doctor.totalReviews||0} ulasan)`], ['Status', selected.doctor.isActive ? '✅ Aktif' : '❌ Nonaktif']].map(([k,v]) => (
                    <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Rating distribution */}
                {selected.ratingDist && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Distribusi Rating</p>
                    {[5,4,3,2,1].map(r => {
                      const count = selected.ratingDist[r] || 0;
                      const total = Object.values(selected.ratingDist).reduce((a,b) => a+b, 0);
                      const pct   = total ? Math.round(count/total*100) : 0;
                      return (
                        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ width: 16 }}>{r}⭐</span>
                          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                            <div style={{ width: `${pct}%`, background: '#f59e0b', height: 8, borderRadius: 4, transition: 'width .3s' }} />
                          </div>
                          <span style={{ color: '#64748b', width: 32 }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent reviews */}
                {selected.reviews?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ulasan Terbaru</p>
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.reviews.map(rv => (
                        <div key={rv._id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>{rv.userId?.name || 'Anonim'}</span>
                            <span style={{ color: '#f59e0b' }}>{'⭐'.repeat(rv.rating)}</span>
                          </div>
                          {rv.ratingComment && <p style={{ margin: '4px 0 0', color: '#475569' }}>{rv.ratingComment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.btn('#2563eb')} onClick={() => setEditMode(true)}>✏️ Edit Profil & Fee</button>
                  <button style={S.btnOutline(selected.doctor.isActive ? '#ef4444' : '#16a34a')} onClick={() => { handleToggle(selected.doctor); setSelected(null); }}>
                    {selected.doctor.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {[['Nama', 'name', 'text'], ['Spesialisasi', 'specialization', 'text'], ['Biaya Konsultasi (Rp)', 'consultationFee', 'number']].map(([lbl, key, type]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <label style={S.label}>{lbl}</label>
                    <input type={type} style={S.field} value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <label style={S.label}>Bio / Deskripsi</label>
                  <textarea rows={3} style={{ ...S.field, resize: 'vertical' }} value={editForm.bio || ''} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.btnOutline('#64748b')} onClick={() => setEditMode(false)}>Batal</button>
                  <button style={S.btn('#16a34a')} disabled={saving} onClick={handleSave}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Override Modal ── */}
      {overrideModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📅 Override Jadwal — dr. {overrideModal.name}</h3>
              <button onClick={() => setOverrideModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
              ⚠️ Tanggal yang diblokir akan membatalkan semua janji temu yang sudah ada dan memblokir slot konsultasi online.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Tanggal (pisah koma, format YYYY-MM-DD)</label>
              <input style={S.field} placeholder="2025-04-07, 2025-04-08" value={overrideDates} onChange={e => setOverrideDates(e.target.value)} />
              <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Contoh: 2025-04-07, 2025-04-08</p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Alasan (opsional)</label>
              <input style={S.field} placeholder="Cuti, sakit, acara, dll." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
            </div>
            <button style={{ ...S.btn('#ef4444'), width: '100%', padding: '10px', marginBottom: 16 }} onClick={handleAddOverride}>🚫 Blokir Tanggal</button>

            {overrides.length > 0 && (
              <>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Blokiran Aktif</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {overrides.map(o => (
                    <div key={o._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fee2e2', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#991b1b' }}>{o.date}</span>
                        {o.reason && <span style={{ color: '#b91c1c', marginLeft: 8 }}>— {o.reason}</span>}
                      </div>
                      <button onClick={() => handleDeleteOverride(o.date)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDoctors;