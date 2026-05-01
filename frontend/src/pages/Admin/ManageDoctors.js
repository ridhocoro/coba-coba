// Admin/ManageDoctors.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { fmtDoctorName } from '../../utils/format';

const ManageDoctors = () => {
  const [doctors, setDoctors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [spec, setSpec]           = useState('');
  const [selected, setSelected]   = useState(null);
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideDates, setOverrideDates] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrides, setOverrides] = useState([]);
  // Tambah Dokter
  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState({ 
    name: '', email: '', password: '', specialization: '', 
    gender: '', consultationFee: '', bio: '', experience: '',
    titlePrefix: '', titleSuffix: '', strNumber: '', alumnus: '', practiceLocation: '' 
  });
  const [addSaving, setAddSaving] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/admin/doctors${spec ? `?specialization=${spec}` : ''}`);
      setDoctors(r.data.doctors || []);
    } catch { 
      toast.error('Gagal memuat dokter'); 
    } finally { 
      setLoading(false); 
    }
  }, [spec]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const openDetail = async (doc) => {
    try {
      const r = await api.get(`/api/admin/doctors/${doc._id}`);
      setSelected(r.data);
      setEditForm({
        titlePrefix: r.data.doctor.titlePrefix || '',
        name: r.data.doctor.name,
        titleSuffix: r.data.doctor.titleSuffix || '',
        specialization: r.data.doctor.specialization,
        consultationFee: r.data.doctor.consultationFee || '',
        bio: r.data.doctor.bio || '',
        gender: r.data.doctor.gender || '',
        experience: r.data.doctor.experience || '',
        strNumber: r.data.doctor.strNumber || '',
        alumnus: r.data.doctor.alumnus || '',
        practiceLocation: r.data.doctor.practiceLocation || '',
      });
      setEditMode(false);
    } catch { 
      toast.error('Gagal memuat detail dokter'); 
    }
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
    } catch { 
      toast.error('Gagal menyimpan'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleToggle = async (doc, closeModal = false) => {
    try {
      const r = await api.put(`/api/admin/doctors/${doc.id || doc._id}/toggle-status`);
      const nowActive = r.data?.doctor?.isActive ?? !doc.isActive;
      toast.success(nowActive ? 'Dokter diaktifkan' : 'Dokter dinonaktifkan');
      fetchDoctors();
      if (!closeModal && selected?.doctor?._id === doc._id) openDetail(doc);
    } catch { 
      toast.error('Gagal mengubah status'); 
    }
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
    if (!dates.length) { 
      toast.error('Masukkan minimal 1 tanggal'); 
      return; 
    }
    try {
      const r = await api.put(`/api/admin/doctors/${overrideModal._id}/schedule/override`, { 
        dates, 
        reason: overrideReason 
      });
      toast.success(`${r.data.blockedDates.length} tanggal diblokir. ${r.data.cancelledAppointments || 0} janji dibatalkan.`);
      const r2 = await api.get(`/api/admin/doctors/${overrideModal._id}/schedule`);
      setOverrides(r2.data.overrides || []);
      setOverrideDates(''); 
      setOverrideReason('');
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Gagal memblokir jadwal'); 
    }
  };

  const handleDeleteOverride = async (date) => {
    try {
      await api.delete(`/api/admin/doctors/${overrideModal._id}/schedule/override/${date}`);
      setOverrides(prev => prev.filter(o => o.date !== date));
      toast.success('Blokiran dihapus');
    } catch { 
      toast.error('Gagal menghapus blokiran'); 
    }
  };

  const handleAddDoctor = async () => {
    if (!addForm.name.trim()) { toast.error('Nama wajib diisi'); return; }
    if (!addForm.email.trim()) { toast.error('Email wajib diisi'); return; }
    if (!addForm.password || addForm.password.length < 6) { 
      toast.error('Password minimal 6 karakter'); 
      return; 
    }
    if (!addForm.specialization.trim()) { 
      toast.error('Spesialisasi wajib diisi'); 
      return; 
    }
    setAddSaving(true);
    try {
      await api.post('/api/admin/doctors', addForm);
      toast.success('Dokter berhasil ditambahkan ✅');
      setAddModal(false);
      setAddForm({ 
        name: '', email: '', password: '', specialization: '', 
        gender: '', consultationFee: '', bio: '', experience: '',
        titlePrefix: '', titleSuffix: '', strNumber: '', alumnus: '', practiceLocation: '' 
      });
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan dokter');
    } finally {
      setAddSaving(false);
    }
  };

  const filtered = doctors.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || 
    d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const specs = [...new Set(doctors.map(d => d.specialization).filter(Boolean))];

  // Format fee tanpa .00
  const formatFee = (fee) => {
    if (!fee) return 'Rp 0';
    const num = Number(fee);
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

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
        <input 
          style={S.input} 
          placeholder="🔍 Cari nama / spesialisasi..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <select style={S.select} value={spec} onChange={e => setSpec(e.target.value)}>
          <option value="">Semua Spesialisasi</option>
          {specs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={S.btn('#2563eb')} onClick={fetchDoctors}>🔄 Refresh</button>
        <button style={S.btn('#16a34a')} onClick={() => setAddModal(true)}>➕ Tambah Dokter</button>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Memuat...</p>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Dokter', 'Spesialisasi', 'Fee', 'Rating', 'Status', 'Aksi'].map(h => 
                <th key={h} style={S.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => (
              <tr key={doc._id}>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>{fmtDoctorName(doc)}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{doc.userId?.email}</div>
                </td>
                <td style={S.td}>{doc.specialization}</td>
                <td style={S.td}>{formatFee(doc.consultationFee)}</td>
                <td style={S.td}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{doc.rating || 0}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}> / 5</span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>({doc.totalReviews || 0})</span>
                </td>
                <td style={S.td}>
                  <span style={{ 
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, 
                    background: doc.isActive ? '#dcfce7' : '#fee2e2', 
                    color: doc.isActive ? '#166534' : '#991b1b' 
                  }}>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                  Tidak ada dokter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* ── Detail / Edit Modal ── */}
      {selected && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editMode ? '✏️ Edit Dokter' : `👨‍⚕️ ${fmtDoctorName(selected.doctor)}`}
              </h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {!editMode ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 16 }}>
                  {[
                    ['Spesialisasi', selected.doctor.specialization],
                    ['Fee Konsultasi', formatFee(selected.doctor.consultationFee)],
                    ['Rating', `${selected.doctor.rating || 0} ⭐ (${selected.doctor.totalReviews || 0} ulasan)`],
                    ['Status', selected.doctor.isActive ? '✅ Aktif' : '❌ Nonaktif']
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{k}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Distribusi Rating - Perbaikan */}
                {selected.ratingDist && Object.values(selected.ratingDist).some(v => v > 0) && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📊 Distribusi Rating</p>
                    {[5, 4, 3, 2, 1].map(r => {
                      const count = selected.ratingDist[r] || 0;
                      const total = Object.values(selected.ratingDist).reduce((a, b) => a + b, 0);
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                          <span style={{ width: 24, fontWeight: 600 }}>{r} ⭐</span>
                          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                            <div style={{ 
                              width: `${pct}%`, 
                              background: r >= 4 ? '#16a34a' : r === 3 ? '#f59e0b' : '#ef4444', 
                              height: 8, 
                              borderRadius: 4, 
                              transition: 'width .3s' 
                            }} />
                          </div>
                          <span style={{ color: '#64748b', minWidth: 45, textAlign: 'right' }}>{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent reviews */}
                {selected.reviews?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>💬 Ulasan Terbaru</p>
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.reviews.map(rv => (
                        <div key={rv._id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{rv.userId?.name || 'Anonim'}</span>
                            <span style={{ color: '#f59e0b' }}>{'⭐'.repeat(rv.rating)}</span>
                          </div>
                          {rv.ratingComment && <p style={{ margin: 0, color: '#475569' }}>{rv.ratingComment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.btn('#2563eb')} onClick={() => setEditMode(true)}>✏️ Edit Profil</button>
                  <button style={S.btnOutline(selected.doctor.isActive ? '#ef4444' : '#16a34a')} onClick={() => { handleToggle(selected.doctor, true); setSelected(null); }}>
                    {selected.doctor.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Form Edit - Minimalis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Gelar Depan</label>
                    <input style={S.field} placeholder="dr." value={editForm.titlePrefix || ''} onChange={e => setEditForm(f => ({ ...f, titlePrefix: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>Nama Lengkap <span style={{ color: '#ef4444' }}>*</span></label>
                    <input style={S.field} value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>Gelar Belakang</label>
                    <input style={S.field} placeholder="Sp.PD" value={editForm.titleSuffix || ''} onChange={e => setEditForm(f => ({ ...f, titleSuffix: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Spesialisasi <span style={{ color: '#ef4444' }}>*</span></label>
                    <input style={S.field} value={editForm.specialization || ''} onChange={e => setEditForm(f => ({ ...f, specialization: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>Biaya Konsultasi (Rp)</label>
                    <input type="number" style={S.field} value={editForm.consultationFee || ''} onChange={e => setEditForm(f => ({ ...f, consultationFee: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Jenis Kelamin</label>
                    <select style={S.field} value={editForm.gender || ''} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">— Pilih —</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Pengalaman (tahun)</label>
                    <input type="number" style={S.field} placeholder="mis. 5" value={editForm.experience || ''} onChange={e => setEditForm(f => ({ ...f, experience: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={S.label}>Bio / Deskripsi</label>
                  <textarea rows={2} style={{ ...S.field, resize: 'vertical' }} value={editForm.bio || ''} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={S.btnOutline('#64748b')} onClick={() => setEditMode(false)}>Batal</button>
                  <button style={S.btn('#16a34a')} disabled={saving} onClick={handleSave}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
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
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📅 Override Jadwal — {fmtDoctorName(overrideModal)}</h3>
              <button onClick={() => setOverrideModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
              ⚠️ Tanggal yang diblokir akan membatalkan semua janji temu yang sudah ada.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Tanggal (pisah koma, format YYYY-MM-DD)</label>
              <input style={S.field} placeholder="2025-04-07, 2025-04-08" value={overrideDates} onChange={e => setOverrideDates(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Alasan (opsional)</label>
              <input style={S.field} placeholder="Cuti, sakit, acara, dll." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
            </div>
            <button style={{ ...S.btn('#ef4444'), width: '100%', padding: '10px', marginBottom: 16 }} onClick={handleAddOverride}>
              🚫 Blokir Tanggal
            </button>

            {overrides.length > 0 && (
              <>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📅 Blokiran Aktif</p>
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

      {/* ── Tambah Dokter Modal (Minimalis) ── */}
      {addModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>➕ Tambah Dokter Baru</h3>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {/* Nama dengan gelar */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Nama Lengkap <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8 }}>
                <input style={S.field} placeholder="Gelar Depan" value={addForm.titlePrefix} onChange={e => setAddForm(f => ({ ...f, titlePrefix: e.target.value }))} />
                <input style={S.field} placeholder="Nama Lengkap" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                <input style={S.field} placeholder="Gelar Belakang" value={addForm.titleSuffix} onChange={e => setAddForm(f => ({ ...f, titleSuffix: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" style={S.field} placeholder="email@klinik.com" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="password" style={S.field} placeholder="Min. 6 karakter" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Spesialisasi <span style={{ color: '#ef4444' }}>*</span></label>
                <input style={S.field} placeholder="Umum, Penyakit Dalam" value={addForm.specialization} onChange={e => setAddForm(f => ({ ...f, specialization: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Biaya Konsultasi (Rp)</label>
                <input type="number" style={S.field} placeholder="50000" value={addForm.consultationFee} onChange={e => setAddForm(f => ({ ...f, consultationFee: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Jenis Kelamin</label>
                <select style={S.field} value={addForm.gender} onChange={e => setAddForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">— Pilih —</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Pengalaman (tahun)</label>
                <input type="number" style={S.field} placeholder="5" value={addForm.experience} onChange={e => setAddForm(f => ({ ...f, experience: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Bio / Deskripsi</label>
              <textarea rows={2} style={{ ...S.field, resize: 'vertical' }} placeholder="Deskripsi singkat dokter..." value={addForm.bio} onChange={e => setAddForm(f => ({ ...f, bio: e.target.value }))} />
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#166534', margin: '14px 0' }}>
              ℹ️ Akun akan langsung aktif dan terverifikasi. Dokter dapat login menggunakan email dan password yang diisi.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btnOutline('#64748b')} onClick={() => setAddModal(false)}>Batal</button>
              <button style={S.btn('#16a34a')} disabled={addSaving} onClick={handleAddDoctor}>
                {addSaving ? 'Menyimpan...' : '✅ Tambah Dokter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDoctors;