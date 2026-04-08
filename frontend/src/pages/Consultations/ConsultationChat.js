import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import api, { API_URL } from '../../utils/api';
import { fmtDoctorName } from '../../utils/format';

// ── Helpers ───────────────────────────────────────────────────────
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDT   = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB' : '—';

const msUntil = (d) => new Date(d) - Date.now();

const StatusBadge = ({ status }) => {
  const cfg = {
    pending_payment:      { color: '#d29922', label: 'Menunggu Pembayaran' },
    waiting_verification: { color: '#d29922', label: 'Verifikasi Pembayaran' },
    confirmed:            { color: '#58a6ff', label: 'Terkonfirmasi' },
    in_progress:          { color: '#3fb950', label: '🟢 Berlangsung' },
    completed:            { color: '#58a6ff', label: 'Selesai' },
    no_show:              { color: '#d29922', label: 'Tidak Hadir' },
    doctor_no_show:       { color: '#f85149', label: 'Dokter Tidak Hadir' },
    cancelled_by_doctor:  { color: '#f85149', label: 'Dibatalkan Dokter' },
    expired:              { color: '#8b949e', label: 'Kadaluarsa' },
    paid: { color: '#58a6ff', label: 'Terkonfirmasi' },
    scheduled: { color: '#a371f7', label: 'Terjadwal' },
    ongoing:   { color: '#3fb950', label: '🟢 Berlangsung' },
    cancelled: { color: '#f85149', label: 'Dibatalkan' },
  };
  const c = cfg[status] || { color: '#8b949e', label: status };
  return (
    <span style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}40`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block', marginRight: 5 }} />
      {c.label}
    </span>
  );
};

// ── Countdown to scheduled time ───────────────────────────────────
const CountdownBanner = ({ scheduledAt }) => {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = msUntil(scheduledAt);
      if (ms <= 0) { setRemaining(''); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(h > 0 ? `${h}j ${m}m` : m > 0 ? `${m}m ${s}d` : `${s}d`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [scheduledAt]);
  if (!remaining) return null;
  return (
    <div style={{ background: '#161b22', border: '1px solid #1f6feb40', borderRadius: 10, padding: '10px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>⏰</span>
      <div>
        <div style={{ color: '#58a6ff', fontSize: 12, fontWeight: 700 }}>Dimulai dalam {remaining}</div>
        <div style={{ color: '#8b949e', fontSize: 11 }}>{fmtDT(scheduledAt)}</div>
      </div>
    </div>
  );
};

// ── Prescription Modal ────────────────────────────────────────────
const EMPTY_MEDICINE = () => ({ name: '', dose: '', form: '', frequency: '', instructions: '', quantity: '' });

const PrescriptionModal = ({ consultation, onClose, onSave, isDoctor }) => {
  const rx = consultation?.prescriptionData;
  const [medicines, setMedicines] = useState(
    rx?.medicines?.length > 0 ? rx.medicines : [EMPTY_MEDICINE()]
  );
  const [patientAge,    setPatientAge]    = useState(rx?.patientAge    || '');
  const [patientGender, setPatientGender] = useState(rx?.patientGender || '');
  const [patientWeight, setPatientWeight] = useState(rx?.patientWeight || '');
  const [doctorNotes,   setDoctorNotes]   = useState(rx?.doctorNotes   || '');
  const [saving, setSaving] = useState(false);

  const addMed    = () => setMedicines(m => [...m, EMPTY_MEDICINE()]);
  const removeMed = (i) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMed = (i, key, val) => setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [key]: val } : med));

  const handleSave = async () => {
    const validMeds = medicines.filter(m => m.name.trim());
    if (!validMeds.length) return;
    setSaving(true);
    await onSave({ medicines: validMeds, patientAge, patientGender, patientWeight, doctorNotes });
    setSaving(false);
  };

  const inp = { width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '7px 10px', color: '#e6edf3', fontSize: 13 };

  if (!isDoctor) {
    // User: tampilkan resep terstruktur
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
        <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1 }}>
            <span style={{ color: '#e6edf3', fontWeight: 700 }}>💊 Resep Digital</span>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: 20 }}>
            {rx ? (
              <>
                <div style={{ background: '#161b22', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                  <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4 }}>Nomor Resep</div>
                  <div style={{ color: '#58a6ff', fontWeight: 700, fontSize: 15 }}>{rx.prescriptionNumber}</div>
                  <div style={{ color: '#8b949e', fontSize: 11, marginTop: 6 }}>
                    Tanggal: {rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} &nbsp;|&nbsp;
                    Berlaku s/d: {rx.validUntil ? new Date(rx.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Identitas Pasien</div>
                  {[['Nama', consultation?.userId?.name || '-'], ['Umur', rx.patientAge || '-'], ['Jenis Kelamin', rx.patientGender || '-'], ['Berat Badan', rx.patientWeight || '-']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3, fontSize: 13 }}>
                      <span style={{ color: '#8b949e', width: 110 }}>{k}</span>
                      <span style={{ color: '#c9d1d9' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>R/ Daftar Obat</div>
                  {rx.medicines?.map((m, i) => (
                    <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ color: '#3fb950', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{i + 1}. {m.name}{m.dose ? ' ' + m.dose : ''}{m.form ? ' ' + m.form : ''}</div>
                      {m.frequency    && <div style={{ color: '#c9d1d9', fontSize: 12 }}>Dosis&nbsp;&nbsp;&nbsp;&nbsp;: {m.frequency}</div>}
                      {m.instructions && <div style={{ color: '#c9d1d9', fontSize: 12 }}>Cara pakai : {m.instructions}</div>}
                      {m.quantity     && <div style={{ color: '#c9d1d9', fontSize: 12 }}>Jumlah&nbsp;&nbsp;: {m.quantity}</div>}
                    </div>
                  ))}
                </div>
                {rx.doctorNotes && (
                  <div style={{ background: '#0a3d1e', border: '1px solid #2ea04330', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                    <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4 }}>Catatan Dokter</div>
                    <div style={{ color: '#c9d1d9', fontSize: 13 }}>{rx.doctorNotes}</div>
                  </div>
                )}
                <div style={{ background: '#161b22', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#8b949e', textAlign: 'center', marginBottom: 14 }}>
                  *Resep berlaku 7 hari dan hanya dapat digunakan 1x pembelian
                </div>
              </>
            ) : (
              <div style={{ color: '#c9d1d9', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, background: '#161b22', borderRadius: 8, padding: 14 }}>
                {consultation?.prescription || 'Belum ada resep'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dokter: form isi resep terstruktur
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1 }}>
          <span style={{ color: '#e6edf3', fontWeight: 700 }}>💊 Tulis Resep Digital</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {/* Identitas pasien */}
          <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Identitas Pasien</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[['Umur', patientAge, setPatientAge, 'Contoh: 25 tahun'], ['Jenis Kelamin', patientGender, setPatientGender, 'Laki-laki / Perempuan'], ['Berat Badan', patientWeight, setPatientWeight, 'Contoh: 60 kg']].map(([label, val, setter, ph]) => (
              <div key={label}>
                <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          {/* Daftar obat */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>R/ Daftar Obat</div>
            <button onClick={addMed} style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: 6, padding: '4px 12px', color: '#58a6ff', fontSize: 12, cursor: 'pointer' }}>+ Tambah Obat</button>
          </div>

          {medicines.map((m, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 14, marginBottom: 10, position: 'relative' }}>
              <div style={{ color: '#58a6ff', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Obat {i + 1}</div>
              {medicines.length > 1 && (
                <button onClick={() => removeMed(i)} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: '#f85149', fontSize: 16, cursor: 'pointer' }}>×</button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Nama Obat *</label>
                  <input value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} placeholder="Contoh: Paracetamol" style={inp} />
                </div>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Dosis</label>
                  <input value={m.dose} onChange={e => updateMed(i, 'dose', e.target.value)} placeholder="Contoh: 500 mg" style={inp} />
                </div>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Bentuk Sediaan</label>
                  <input value={m.form} onChange={e => updateMed(i, 'form', e.target.value)} placeholder="tablet / kapsul / sirup" style={inp} />
                </div>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Aturan Pakai</label>
                  <input value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} placeholder="Contoh: 3×1 sehari" style={inp} />
                </div>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Cara Pakai</label>
                  <input value={m.instructions} onChange={e => updateMed(i, 'instructions', e.target.value)} placeholder="Sesudah / Sebelum makan" style={inp} />
                </div>
                <div>
                  <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 3 }}>Jumlah</label>
                  <input value={m.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)} placeholder="Contoh: 10 tablet" style={inp} />
                </div>
              </div>
            </div>
          ))}

          {/* Catatan dokter */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: '#8b949e', fontSize: 11, display: 'block', marginBottom: 6 }}>Catatan Dokter</label>
            <textarea value={doctorNotes} rows={3} onChange={e => setDoctorNotes(e.target.value)}
              placeholder="Anjuran, larangan, atau catatan tambahan untuk pasien..."
              style={{ ...inp, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSave} disabled={!medicines.some(m => m.name.trim()) || saving}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!medicines.some(m => m.name.trim()) || saving) ? 0.5 : 1 }}>
              {saving ? 'Menyimpan...' : '✓ Kirim Resep ke Pasien'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sick Letter Modal ─────────────────────────────────────────────
const SickLetterModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ diagnosis: '', restDays: 3, notes: '', patientAge: '', patientGender: '', patientWeight: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async (e) => { e.preventDefault(); if (!form.diagnosis || !form.restDays) return; setSaving(true); await onSave(form); setSaving(false); };
  const inp = { width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, boxSizing: 'border-box' };
  const lbl = (t) => <label style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 6 }}>{t}</label>;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1 }}>
          <span style={{ color: '#e6edf3', fontWeight: 700 }}>📋 Buat Surat Keterangan Sakit</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={handleSave} style={{ padding: 20 }}>
          {/* Identitas Pasien */}
          <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Identitas Pasien</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div>
              {lbl('Umur')}
              <input value={form.patientAge} onChange={e => setForm(p => ({ ...p, patientAge: e.target.value }))} placeholder="Contoh: 21 Tahun" style={inp} />
            </div>
            <div>
              {lbl('Jenis Kelamin')}
              <select value={form.patientGender} onChange={e => setForm(p => ({ ...p, patientGender: e.target.value }))} style={{ ...inp, appearance: 'none' }}>
                <option value="">— Pilih —</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              {lbl('Berat Badan')}
              <input value={form.patientWeight} onChange={e => setForm(p => ({ ...p, patientWeight: e.target.value }))} placeholder="Contoh: 60 kg" style={inp} />
            </div>
          </div>

          {/* Data Surat */}
          <div style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Data Surat Sakit</div>
          <div style={{ marginBottom: 14 }}>
            {lbl('Diagnosis / Keterangan Sakit *')}
            <textarea value={form.diagnosis} rows={2} required onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="Contoh: Demam Akut, ISPA, Gastroenteritis..."
              style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            {lbl('Lama Istirahat (hari) *')}
            <input type="number" value={form.restDays} min={1} max={30} required onChange={e => setForm(p => ({ ...p, restDays: e.target.value }))} style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            {lbl('Catatan / Anjuran Tambahan')}
            <textarea value={form.notes} rows={2} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opsional: anjuran minum obat, larangan aktivitas..."
              style={{ ...inp, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Batal</button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#1f6feb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Menyimpan...' : '✓ Buat Surat Sakit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Rating Modal ──────────────────────────────────────────────────
const RatingModal = ({ consultationId, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      await api.post(`/api/consultations/${consultationId}/rating`, { rating, comment });
      toast.success('Rating terkirim!');
      onSuccess();
      onClose();
    } catch { toast.error('Gagal kirim rating'); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 380, textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
        <h5 style={{ color: '#e6edf3', fontWeight: 700, marginBottom: 4 }}>Beri Penilaian</h5>
        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>Bagaimana pengalaman konsultasi Anda?</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)} style={{ fontSize: 36, cursor: 'pointer', transition: 'transform 0.1s', transform: i <= (hovered || rating) ? 'scale(1.2)' : 'scale(1)' }}>
              {i <= (hovered || rating) ? '⭐' : '☆'}
            </span>
          ))}
        </div>
        <textarea value={comment} rows={3} onChange={e => setComment(e.target.value)}
          placeholder="Komentar (opsional)"
          style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, resize: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Lewati</button>
          <button onClick={handleSave} disabled={!rating || saving}
            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#ca8a04', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!rating || saving) ? 0.5 : 1 }}>
            {saving ? 'Mengirim...' : 'Kirim Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── WebRTC Video Call ─────────────────────────────────────────────
// Menggunakan socket signaling (offer/answer/ice-candidate)
// Tidak butuh TURN server untuk jaringan lokal; tambahkan TURN untuk produksi
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoCall = ({ consultationId, socket, isDoctor, onClose }) => {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);

  const [callState, setCallState]   = useState('idle'); // idle | calling | ringing | connected | ended
  const [micOn,  setMicOn]          = useState(true);
  const [camOn,  setCamOn]          = useState(true);
  const [error,  setError]          = useState(null);
  const [remoteJoined, setRemoteJoined] = useState(false);

  // ── Bersihkan semua resource ──────────────────────────────────
  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current       = null;
    localStreamRef.current = null;
  }, []);

  // ── Inisialisasi PeerConnection ───────────────────────────────
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('vc-ice-candidate', { consultationId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (remoteVideoRef.current && streams[0]) {
        remoteVideoRef.current.srcObject = streams[0];
        setCallState('connected');
        setRemoteJoined(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected') {
        // Coba ICE restart setelah 3 detik
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.log('[WebRTC] Attempting ICE restart...');
            socket.emit('vc-ice-restart', { consultationId });
            if (isDoctor) {
              // Dokter: buat offer baru dengan iceRestart
              pcRef.current?.createOffer({ iceRestart: true })
                .then(offer => {
                  pcRef.current?.setLocalDescription(offer);
                  socket.emit('vc-offer', { consultationId, offer });
                }).catch(() => {});
            }
          }
        }, 3000);
      }
      if (['failed', 'closed'].includes(pc.iceConnectionState)) {
        setCallState('ended');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [consultationId, socket, isDoctor]);

  // ── Ambil stream kamera & mic ─────────────────────────────────
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Izin kamera/mikrofon ditolak. Aktifkan di pengaturan browser.'
        : 'Kamera/mikrofon tidak ditemukan atau sedang digunakan aplikasi lain.';
      setError(msg);
      return null;
    }
  }, []);

  // ── Dokter: mulai call (buat offer) ──────────────────────────
  const startCall = useCallback(async () => {
    setCallState('calling');
    setError(null);
    const stream = await getLocalStream();
    if (!stream) { setCallState('idle'); return; }

    const pc = createPC();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('vc-offer', { consultationId, offer });
  }, [consultationId, socket, getLocalStream, createPC]);

  // ── User: terima call (jawab offer) ──────────────────────────
  const answerCall = useCallback(async (offer) => {
    setCallState('ringing');
    const stream = await getLocalStream();
    if (!stream) return;

    const pc = createPC();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('vc-answer', { consultationId, answer });
    setCallState('connected');
  }, [consultationId, socket, getLocalStream, createPC]);

  // ── Akhiri call ────────────────────────────────────────────────
  const endCall = useCallback(() => {
    socket.emit('vc-end', { consultationId });
    cleanup();
    setCallState('ended');
    onClose();
  }, [consultationId, socket, cleanup, onClose]);

  // ── Toggle mic / cam ───────────────────────────────────────────
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(p => !p);
  };
  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(p => !p);
  };

  // ── Socket events ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Dokter terima jawaban dari user
    const onAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('connected');
      setRemoteJoined(true);
    };

    // User terima offer dari dokter
    const onOffer = async ({ offer }) => {
      if (!isDoctor) answerCall(offer);
    };

    const onIce = async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    const onEnd = () => {
      cleanup();
      setCallState('ended');
      toast('Panggilan video diakhiri');
      onClose();
    };

    socket.on('vc-offer',         onOffer);
    socket.on('vc-answer',        onAnswer);
    socket.on('vc-ice-candidate', onIce);
    socket.on('vc-end',           onEnd);
    // Handle ICE restart request from remote peer
    socket.on('vc-ice-restart', async () => {
      if (!isDoctor && pcRef.current) {
        // User side: create answer untuk ICE restart offer
        const offer = await pcRef.current.createOffer({ iceRestart: true }).catch(() => null);
        if (offer) {
          await pcRef.current.setLocalDescription(offer);
          socket.emit('vc-answer', { consultationId, answer: offer });
        }
      }
    });

    return () => {
      socket.off('vc-offer',         onOffer);
      socket.off('vc-answer',        onAnswer);
      socket.off('vc-ice-candidate', onIce);
      socket.off('vc-end',           onEnd);
      socket.off('vc-ice-restart');
    };
  }, [socket, isDoctor, answerCall, cleanup, onClose]);

  // Dokter langsung start call saat komponen mount — useRef agar hanya sekali
  const hasCalledRef = useRef(false);
  useEffect(() => {
    if (isDoctor && !hasCalledRef.current) {
      hasCalledRef.current = true;
      startCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDoctor, startCall, consultationId]);

  // ── UI ──────────────────────────────────────────────────────────
  const stateLabel = {
    idle: '',
    calling: '📞 Menghubungi...',
    ringing: '📲 Menerima panggilan...',
    connected: '🟢 Tersambung',
    ended: '❌ Panggilan berakhir',
  }[callState];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Remote video — full screen */}
      <div style={{ flex: 1, position: 'relative', background: '#0d1117' }}>
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: remoteJoined ? 'block' : 'none' }} />

        {/* Waiting / error state */}
        {!remoteJoined && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e6edf3' }}>
            {error ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                <div style={{ color: '#f85149', fontWeight: 600, marginBottom: 8, textAlign: 'center', maxWidth: 300 }}>{error}</div>
                <button onClick={onClose} style={{ padding: '8px 24px', background: '#21262d', color: '#e6edf3', border: 'none', borderRadius: 8, cursor: 'pointer', marginTop: 8 }}>Tutup</button>
              </>
            ) : (
              <>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 16 }}>
                  {isDoctor ? '👤' : '👨‍⚕️'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{stateLabel}</div>
                <div style={{ color: '#8b949e', fontSize: 13 }}>
                  {isDoctor ? 'Menunggu pasien menerima...' : 'Dokter sedang menghubungi...'}
                </div>
                {/* Animated pulse ring */}
                <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '2px solid #1f6feb', animation: 'vcPulse 2s infinite', opacity: 0.4 }} />
              </>
            )}
          </div>
        )}

        {/* Local video — PiP corner */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, width: 140, height: 100, borderRadius: 12, overflow: 'hidden', border: '2px solid #30363d', background: '#161b22', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          <video ref={localVideoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: camOn ? 'block' : 'none' }} />
          {!camOn && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 24 }}>🚫</div>
          )}
        </div>

        {/* Status badge top */}
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#161b2299', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#e6edf3', fontWeight: 600, border: '1px solid #30363d' }}>
          {stateLabel}
        </div>
      </div>

      {/* Controls bar */}
      <div style={{ background: '#161b22', borderTop: '1px solid #30363d', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={toggleMic}
          style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 20, background: micOn ? '#21262d' : '#c0392b', color: micOn ? '#e6edf3' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {micOn ? '🎙️' : '🔇'}
        </button>
        <button onClick={endCall}
          style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 24, background: '#c0392b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(192,57,43,.5)' }}>
          📵
        </button>
        <button onClick={toggleCam}
          style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 20, background: camOn ? '#21262d' : '#c0392b', color: camOn ? '#e6edf3' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {camOn ? '📹' : '📷'}
        </button>
      </div>

      <style>{`
        @keyframes vcPulse {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ── Medical Record Modal (SOAP) ───────────────────────────────────
const MedicalRecordModal = ({ existing, consultation, onClose, onSave, isEndSession = false, saving: externalSaving }) => {
  const mr = existing;
  const [form, setForm] = useState({
    objectiveFindings: mr?.objectiveFindings || '',
    assessment:        mr?.assessment        || '',
    plan:              mr?.plan              || '',
    doctorNotes:       mr?.doctorNotes       || '',
    markComplete:      mr?.isCompleted       || false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  const inp  = { width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '9px 12px', color: '#e6edf3', fontSize: 13, resize: 'vertical' };
  const lbl  = (t) => <label style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t}</label>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1 }}>
          <span style={{ color: '#e6edf3', fontWeight: 700 }}>{isEndSession ? '■ Akhiri Sesi & Isi Rekam Medis' : '📋 Rekam Medis (SOAP)'}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {/* Info Pasien — read-only */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 6 }}>Identitas Pasien</div>
            <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>{consultation?.userId?.name || '-'}</div>
            <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>ID: {consultation?.userId?._id?.toString().slice(-8).toUpperCase() || '-'}</div>
          </div>

          {/* S - Subjective */}
          <div style={{ marginBottom: 14 }}>
            {lbl('S — Keluhan (Subjective)')}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '9px 12px', color: '#c9d1d9', fontSize: 13 }}>
              {consultation?.symptoms || '-'}
              {consultation?.medicalHistory && <div style={{ marginTop: 6, color: '#8b949e', fontSize: 12 }}>Riwayat: {consultation.medicalHistory}</div>}
            </div>
          </div>

          {/* O - Objective */}
          <div style={{ marginBottom: 14 }}>
            {lbl('O — Pemeriksaan (Objective)')}
            <textarea rows={3} value={form.objectiveFindings} onChange={e => set('objectiveFindings', e.target.value)}
              placeholder="Hasil pemeriksaan, tanda-tanda vital, kondisi umum pasien..."
              style={inp} />
          </div>

          {/* A - Assessment */}
          <div style={{ marginBottom: 14 }}>
            {lbl('A — Diagnosis (Assessment)')}
            <textarea rows={2} value={form.assessment} onChange={e => set('assessment', e.target.value)}
              placeholder="Diagnosis utama, misalnya: ISPA, Demam akut, Gastritis..."
              style={inp} />
          </div>

          {/* P - Plan */}
          <div style={{ marginBottom: 14 }}>
            {lbl('P — Rencana / Terapi (Plan)')}
            <textarea rows={3} value={form.plan} onChange={e => set('plan', e.target.value)}
              placeholder="Rencana terapi: obat, istirahat, kontrol ulang, rujukan..."
              style={inp} />
          </div>

          {/* Catatan */}
          <div style={{ marginBottom: 16 }}>
            {lbl('Catatan Tambahan')}
            <textarea rows={2} value={form.doctorNotes} onChange={e => set('doctorNotes', e.target.value)}
              placeholder="Pesan atau catatan khusus untuk pasien (opsional)"
              style={inp} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.markComplete} onChange={e => set('markComplete', e.target.checked)}
              style={{ width: 16, height: 16 }} />
            <span style={{ color: '#c9d1d9', fontSize: 13 }}>Tandai rekam medis sebagai selesai (pasien dapat mengunduh)</span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSave} disabled={saving || externalSaving}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: isEndSession ? '#c0392b' : '#1f6feb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (saving || externalSaving) ? 0.5 : 1 }}>
              {(saving || externalSaving) ? 'Menyimpan...' : isEndSession ? '■ Akhiri & Simpan' : '✓ Simpan Rekam Medis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Attachment Viewer (lampiran dari pasien) ──────────────────────
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const isImage = (url) => IMAGE_EXTS.some(ext => url.toLowerCase().endsWith(ext));

const AttachmentViewer = ({ attachmentUrls }) => {
  const [lightbox, setLightbox] = useState(null); // url gambar yang dibuka
  return (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #21262d' }}>
        <span style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'block' }}>
          📎 Lampiran Pasien ({attachmentUrls.length})
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachmentUrls.map((url, i) => {
            const filename = url.split('/').pop();
            const img = isImage(url);
            return (
              <div key={i}>
                {img ? (
                  <div
                    onClick={() => setLightbox(`${API_URL}${url}`)}
                    style={{ cursor: 'zoom-in', borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d', position: 'relative' }}
                  >
                    <img
                      src={`${API_URL}${url}`}
                      alt={filename}
                      style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <div style={{ position: 'absolute', bottom: 4, right: 6, background: 'rgba(0,0,0,.55)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#c9d1d9' }}>
                      🔍 Klik untuk perbesar
                    </div>
                  </div>
                ) : (
                  <a
                    href={`${API_URL}${url}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, textDecoration: 'none' }}
                  >
                    <span style={{ fontSize: 18 }}>📄</span>
                    <span style={{ color: '#58a6ff', fontSize: 12, wordBreak: 'break-all' }}>{filename}</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={lightbox} alt="lampiran" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,.8)' }} />
            <button
              onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
            >×</button>
            <a
              href={lightbox}
              download
              onClick={e => e.stopPropagation()}
              style={{ position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)', background: '#1f6feb', color: '#fff', padding: '6px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >⬇ Unduh</a>
          </div>
        </div>
      )}
    </>
  );
};

// ── Session end countdown ─────────────────────────────────────────
const SessionEndCountdown = ({ scheduledEnd }) => {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = msUntil(scheduledEnd);
      if (ms <= 0) { setRemaining('00:00'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(h > 0 ? `${h}j ${m}m` : m > 0 ? `${m}m ${s}d` : `${s}d`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [scheduledEnd]);
  const isUrgent = remaining && parseInt(remaining) <= 5 && remaining.includes('m');
  return <span style={{ color: isUrgent ? '#f85149' : '#3fb950', fontWeight: 700 }}>{remaining}</span>;
};

// ══════════════════════════════════════════════════════════════════
// MAIN CONSULTATION CHAT
// ══════════════════════════════════════════════════════════════════
const ConsultationChat = () => {
  const { id } = useParams();
  const { user, loading: authLoading, doctorProfile } = useAuth();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [newMessage, setNewMessage]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [socket, setSocket]             = useState(null);
  const [typing, setTyping]             = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showSickLetter,   setShowSickLetter]   = useState(false);
  const [showRating,       setShowRating]       = useState(false);
  const [showVideoCall,    setShowVideoCall]     = useState(false);
  const [showMedicalRecord,setShowMedicalRecord] = useState(false);
  const [incomingCall,     setIncomingCall]      = useState(null); // { offer }
  const [uploadingImg, setUploadingImg] = useState(false);
  const [ending,   setEnding]   = useState(false);
  const [starting, setStarting] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sending,  setSending]  = useState(false);

  const msgEndRef     = useRef(null);
  const fileInputRef  = useRef(null);
  const typingTimerRef = useRef(null);

  const isDoctor = user?.role === 'doctor';
  const isUser   = user?.role === 'user';
  const myId     = user?.id || user?._id;

  // ── Access rules ──────────────────────────────────────────────
  // User: chat hanya saat in_progress/ongoing
  // Dokter: bisa lihat semua info kapan saja, chat hanya saat in_progress/ongoing
  const isLive      = ['in_progress', 'ongoing'].includes(consultation?.status);
  const isConfirmed = consultation?.status === 'confirmed';
  const isCompleted = ['completed', 'no_show'].includes(consultation?.status);
  // Status yang memungkinkan user beri rating (feedback)
  const isRatable   = ['completed', 'no_show', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(consultation?.status);

  // Dokter: bisa akses room kecuali saat pending_payment/expired
  // User: bisa akses room saat confirmed/live/completed/cancelled — untuk lihat history
  const DOCTOR_BLOCKED = ['pending_payment', 'expired', 'cancelled'];
  const timeHasArrived = consultation?.scheduledAt
    ? msUntil(consultation.scheduledAt) <= 0
    : true;
  // BUG-09 fix: add doctor_no_show, cancelled_by_doctor, cancelled_by_admin to user access
  // so user can view history, rate, and request refund from these statuses
  const USER_ACCESSIBLE = ['confirmed', 'in_progress', 'ongoing', 'completed', 'no_show',
    'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin', 'paid', 'scheduled'];
  const canAccessRoom = isDoctor
    ? !DOCTOR_BLOCKED.includes(consultation?.status)
    : (USER_ACCESSIBLE.includes(consultation?.status) || isRatable);

  // Bisa chat hanya saat live: dokter kapan saja, user perlu waktu sudah tiba
  // BUG-06 fix: when session is in_progress, user can ALWAYS chat (doctor already started)
  const canChat = isLive && (isDoctor || ['in_progress', 'ongoing'].includes(consultation?.status) || timeHasArrived);

  const isVideoCall = consultation?.consultationType === 'video_call';

  const fetchConsultation = useCallback(async () => {
    try {
      const r = await api.get(`/api/consultations/${id}`);
      setConsultation(r.data);
      setMessages(r.data.messages || []);
    } catch (err) {
      // Hanya navigate away jika benar-benar 403/404, bukan error jaringan sementara
      if (err.response?.status === 403 || err.response?.status === 404) {
        toast.error('Konsultasi tidak ditemukan atau akses ditolak');
        navigate(isDoctor ? '/doctor/consultations' : '/consultations');
      } else {
        toast.error('Gagal memuat konsultasi, mencoba lagi...');
        // Jangan navigate — bisa jadi error jaringan sementara
      }
    } finally { setLoading(false); }
  }, [id, navigate, isDoctor]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchConsultation();
  }, [user, authLoading, fetchConsultation, navigate]);

  // ── Setup Socket ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Re-join rooms setelah reconnect
    sock.on('reconnect', () => {
      console.log('[Socket] Reconnected — rejoining rooms');
      sock.emit('join-user', user.id);
      if (id) {
        sock.emit('join-consultation', id);
      }
    });

    sock.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    setSocket(sock);
    return () => sock.close();
  }, [user, id]);

  // ── Socket listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!socket || !consultation) return;
    socket.emit('join-consultation', consultation._id);

    const onReceive = (msg) => {
      // Filter own messages (already handled optimistically)
      if (msg.senderId?.toString() === myId?.toString()) return;
      // BUG-11 fix: dedup by _id to prevent duplicate on reconnect
      setMessages(prev => {
        if (msg._id && prev.some(m => m._id?.toString() === msg._id?.toString())) return prev;
        return [...prev, msg];
      });
    };
    const onPrescription = (data) => {
      // BUG-03 fix: update both prescription (legacy) and prescriptionData (structured)
      setConsultation(c => ({
        ...c,
        prescription:     data.prescription,
        prescriptionData: data.prescriptionData || c.prescriptionData,
        diagnosis:        data.diagnosis,
      }));
      toast.success('Dokter mengirimkan resep! 💊');
    };
    // Incoming video call (user side)
    const onVcOffer = ({ offer }) => {
      if (!isDoctor) setIncomingCall({ offer });
    };
    // Status update (e.g. cron auto-started, auto-ended)
    const onStatusUpdate = ({ consultationId, status }) => {
      if (consultationId === consultation._id?.toString()) {
        setConsultation(c => ({ ...c, status }));
        if (status === 'in_progress') toast.success('Sesi konsultasi dimulai!');
        if (status === 'completed') toast.success('Konsultasi telah selesai ✅');
        if (status === 'no_show') toast('Sesi berakhir — tidak ada respons dari pasien');
        if (status === 'refund_requested') toast('Refund otomatis diajukan ke admin');
        // Refresh untuk dapat data terbaru (endTime dll)
        if (['completed', 'no_show', 'refund_requested'].includes(status)) {
          fetchConsultation();
        }
      }
    };
    // Trigger rating modal (dari server setelah dokter klik End atau auto-end)
    const onShowRating = ({ consultationId }) => {
      if (consultationId === consultation._id?.toString() && isUser) {
        setShowRating(true);
      }
    };

    // BUG-08 fix: listen for medical-record-update to update UI in real-time
    const onMedicalRecordUpdate = ({ medicalRecord }) => {
      setConsultation(c => ({ ...c, medicalRecord }));
    };

    socket.on('receive-message',             onReceive);
    socket.on('user-typing',                 () => { setTyping(true); setTimeout(() => setTyping(false), 3000); });
    socket.on('user-stop-typing',            () => setTyping(false));
    socket.on('prescription-update',         onPrescription);
    socket.on('vc-offer',                    onVcOffer);
    socket.on('consultation-status-update',  onStatusUpdate);
    socket.on('show-rating-modal',           onShowRating);
    socket.on('medical-record-update',       onMedicalRecordUpdate);

    return () => {
      socket.off('receive-message',            onReceive);
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('prescription-update',        onPrescription);
      socket.off('vc-offer',                   onVcOffer);
      socket.off('consultation-status-update', onStatusUpdate);
      socket.off('show-rating-modal',          onShowRating);
      socket.off('medical-record-update',      onMedicalRecordUpdate);
    };
  }, [socket, consultation, myId, isDoctor, isUser, fetchConsultation]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !canChat || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    const localId = `local-${Date.now()}-${Math.random()}`;
    const optimistic = { _localId: localId, senderId: myId, senderName: isDoctor ? fmtDoctorName({ titlePrefix: doctorProfile?.titlePrefix, name: user.name, titleSuffix: doctorProfile?.titleSuffix }) : user.name, senderRole: user.role, message: text, timestamp: new Date(), _pending: true };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await api.post(`/api/consultations/${id}/messages`, { message: text });
      const saved = res.data.message;
      setMessages(prev => prev.map(m => m._localId === localId ? { ...saved, _pending: false } : m));
      socket?.emit('send-message', { consultationId: id, _id: saved._id, senderId: myId, senderName: optimistic.senderName, senderRole: user.role, message: text, timestamp: saved.timestamp || new Date() });
    } catch {
      setMessages(prev => prev.filter(m => m._localId !== localId));
      setNewMessage(text);
      toast.error('Gagal kirim pesan');
    } finally { setSending(false); }
  };

  // ── Image upload ───────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Maks 5MB'); return; }
    setUploadingImg(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const r = await api.post(`/api/consultations/${id}/messages/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessages(prev => [...prev, r.data.message]);
    } catch { toast.error('Gagal upload gambar'); }
    finally { setUploadingImg(false); e.target.value = ''; }
  };

  // ── Typing ─────────────────────────────────────────────────────
  const handleTyping = () => {
    socket?.emit('typing', { consultationId: id, senderId: myId, senderName: user.name });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket?.emit('stop-typing', { consultationId: id, senderId: myId }), 1200);
  };

  // ── Doctor actions ─────────────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    try {
      await api.put(`/api/consultations/${id}/start`);
      toast.success('Sesi dimulai!');
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal memulai'); }
    finally { setStarting(false); }
  };

  // handleEnd: opens end-session modal to collect assessment+plan (BUG-01 fix)
  const handleEnd = () => {
    setShowEndModal(true);
  };

  const handleEndConfirm = async (medForm) => {
    if (!medForm.assessment?.trim()) { toast.error('Diagnosis wajib diisi'); return; }
    if (!medForm.plan?.trim())       { toast.error('Rencana Terapi wajib diisi'); return; }
    setEnding(true);
    try {
      await api.put(`/api/consultations/${id}/end`, {
        assessment:        medForm.assessment.trim(),
        plan:              medForm.plan.trim(),
        objectiveFindings: medForm.objectiveFindings?.trim() || '',
        doctorNotes:       medForm.doctorNotes?.trim()       || '',
      });
      toast.success('Konsultasi selesai ✅');
      setShowEndModal(false);
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal mengakhiri'); }
    finally { setEnding(false); }
  };

  const handleSendPrescription = async (payload) => {
    try {
      if (payload && payload.medicines) {
        await api.put(`/api/consultations/${id}/prescription`, payload);
      } else {
        await api.put(`/api/consultations/${id}/prescription`, { prescription: payload });
      }
      toast.success('Resep berhasil dikirim ke pasien!');
      setShowPrescription(false);
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal kirim resep'); }
  };

  const handleSaveMedicalRecord = async (form) => {
    try {
      await api.put(`/api/consultations/${id}/medical-record`, form);
      toast.success('Rekam medis tersimpan!');
      setShowMedicalRecord(false);
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal simpan rekam medis'); }
  };

  const handleCreateSickLetter = async (form) => {
    try {
      await api.post(`/api/consultations/${id}/sick-letter`, form);
      toast.success('Surat sakit dibuat');
      setShowSickLetter(false);
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal buat surat sakit'); }
  };

  const handleIssueSickLetter = async () => {
    try {
      await api.put(`/api/consultations/${id}/sick-letter/issue`);
      toast.success('Surat sakit diterbitkan!');
      fetchConsultation();
    } catch { toast.error('Gagal menerbitkan'); }
  };

  // BUG-10 fix: check content-type before treating response as PDF
  const parseBlobError = async (blob) => {
    try {
      const text = await blob.text();
      const json = JSON.parse(text);
      return json.message || 'Server error';
    } catch { return null; }
  };

  const downloadSickLetterPDF = async () => {
    try {
      const r = await api.get(`/api/consultations/${id}/sick-letter/pdf`, { responseType: 'blob' });
      const contentType = r.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errMsg = await parseBlobError(r.data);
        toast.error(errMsg || 'Surat sakit belum tersedia'); return;
      }
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `surat-sakit-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Surat sakit diunduh');
    } catch { toast.error('Gagal unduh surat sakit'); }
  };

  const downloadPrescriptionPDF = async () => {
    try {
      const r = await api.get(`/api/consultations/${id}/prescription/pdf`, { responseType: 'blob' });
      const contentType = r.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errMsg = await parseBlobError(r.data);
        toast.error(errMsg || 'Resep belum tersedia'); return;
      }
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `resep-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Resep diunduh');
    } catch { toast.error('Gagal unduh resep PDF'); }
  };

  const downloadMedicalRecordPDF = async () => {
    try {
      const r = await api.get(`/api/consultations/${id}/medical-record/pdf`, { responseType: 'blob' });
      const contentType = r.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const errMsg = await parseBlobError(r.data);
        toast.error(errMsg || 'Rekam medis belum tersedia'); return;
      }
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `rekam-medis-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Rekam medis diunduh');
    } catch { toast.error('Gagal unduh rekam medis'); }
  };

  // ── Styles ──────────────────────────────────────────────────────
  const s = {
    root:        { display: 'flex', height: 'calc(100vh - 56px)', background: '#0d1117', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' },
    sidebar:     { width: 280, borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column', background: '#0d1117', flexShrink: 0, overflowY: 'auto' },
    chat:        { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    header:      { padding: '12px 16px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: 12, background: '#161b22', flexShrink: 0 },
    msgArea:     { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
    footer:      { padding: '12px 16px', borderTop: '1px solid #21262d', background: '#161b22', flexShrink: 0 },
    sideSection: { padding: '14px 16px', borderBottom: '1px solid #21262d' },
    label:       { color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'block' },
    actionBtn:   (color = '#1f6feb') => ({ width: '100%', padding: '9px 14px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }),
    ghostBtn:    { width: '100%', padding: '9px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13, marginBottom: 8 },
  };

  // ── Loading / not found ─────────────────────────────────────────
  if (authLoading || loading) return (
    <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8b949e', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
        <div>Memuat konsultasi...</div>
      </div>
    </div>
  );

  if (!consultation) return (
    <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#f85149', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div>Konsultasi tidak ditemukan</div>
        <button onClick={() => navigate(isDoctor ? '/doctor/consultations' : '/consultations')}
          style={{ marginTop: 16, padding: '8px 20px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Kembali
        </button>
      </div>
    </div>
  );

  const doc        = consultation.doctorId;
  const sickLetter = consultation.sickLetter;
  const typeLabel  = isVideoCall ? '📹 Video Call' : '💬 Chat';

  // ── Dokter diblokir saat pending_payment ────────────────────────
  if (isDoctor && !canAccessRoom) {
    const statusMsg = {
      pending_payment: { icon: '💳', title: 'Pembayaran Belum Dikonfirmasi', body: 'Pasien belum menyelesaikan pembayaran. Data konsultasi baru dapat diakses setelah pembayaran berhasil dikonfirmasi.' },
      expired:         { icon: '⏰', title: 'Konsultasi Kadaluarsa',          body: 'Pasien tidak menyelesaikan pembayaran tepat waktu. Slot telah dibebaskan.' },
      cancelled:       { icon: '🚫', title: 'Konsultasi Dibatalkan',           body: 'Konsultasi ini telah dibatalkan.' },
      cancelled_by_doctor: { icon: '🚫', title: 'Konsultasi Dibatalkan', body: 'Konsultasi ini telah dibatalkan.' },
    }[consultation.status] || { icon: '🚫', title: 'Tidak Dapat Diakses', body: '' };

    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 380, padding: 32 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{statusMsg.icon}</div>
            <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{statusMsg.title}</div>
            <div style={{ color: '#8b949e', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{statusMsg.body}</div>
            <div style={{ marginBottom: 20 }}><StatusBadge status={consultation.status} /></div>
            <button onClick={() => navigate('/doctor/consultations')}
              style={{ padding: '10px 24px', background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              ← Kembali ke Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  // User: jika status tidak relevan (bukan confirmed/live/completed) → blokir
  if (isUser && !canAccessRoom && !isCompleted && !isConfirmed) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#8b949e', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Akses Tidak Tersedia</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              Status saat ini: <StatusBadge status={consultation.status} />
            </div>
            <button onClick={() => navigate('/consultations')}
              style={{ padding: '8px 20px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Kembali
            </button>
          </div>
        </div>
      </>
    );
  }

  // Flag: apakah user belum boleh chat (confirmed + belum waktunya)
  const isLockedForUser = isUser && isConfirmed && !timeHasArrived;

  // ── Incoming call notification (user) ──────────────────────────
  const IncomingCallBanner = () => incomingCall && !showVideoCall ? (
    <div style={{ position: 'fixed', top: 80, right: 20, background: '#161b22', border: '1px solid #1f6feb', borderRadius: 14, padding: '16px 20px', zIndex: 9000, boxShadow: '0 8px 30px rgba(0,0,0,.5)', minWidth: 260 }}>
      <div style={{ color: '#e6edf3', fontWeight: 700, marginBottom: 4 }}>📹 Panggilan Video Masuk</div>
      <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 12 }}>{fmtDoctorName(doc)} mengajak video call</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { setIncomingCall(null); }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#f85149', cursor: 'pointer', fontWeight: 600 }}>
          ❌ Tolak
        </button>
        <button onClick={() => { setShowVideoCall(true); setIncomingCall(null); }}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          ✅ Terima
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Video call overlay */}
      {showVideoCall && socket && (
        <VideoCall
          consultationId={id}
          socket={socket}
          isDoctor={isDoctor}
          onClose={() => setShowVideoCall(false)}
        />
      )}

      <IncomingCallBanner />

      <div style={s.root}>
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div style={s.sidebar}>
          <div style={s.sideSection}>
            <button onClick={() => navigate(isDoctor ? '/doctor/consultations' : '/consultations')} style={s.ghostBtn}>
              ← Kembali
            </button>
          </div>

          <div style={s.sideSection}>
            <span style={s.label}>Dokter</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👨‍⚕️</div>
              <div>
                <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>{fmtDoctorName(doc)}</div>
                <div style={{ color: '#58a6ff', fontSize: 12 }}>{doc?.specialization}</div>
              </div>
            </div>
            <StatusBadge status={consultation.status} />
          </div>

          <div style={s.sideSection}>
            <span style={s.label}>Info Konsultasi</span>
            {[
              ['Tipe', typeLabel],
              ...(consultation.scheduledAt ? [['Jadwal', fmtDT(consultation.scheduledAt)]] : []),
              ['Dibuat', new Date(consultation.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#8b949e', fontSize: 12 }}>{k}</span>
                <span style={{ color: '#c9d1d9', fontSize: 12, textAlign: 'right', maxWidth: 160 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Keluhan & riwayat — SELALU tampil untuk dokter */}
          <div style={s.sideSection}>
            <span style={s.label}>Keluhan Pasien</span>
            <div style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.6 }}>{consultation.symptoms}</div>
            {consultation.medicalHistory && (
              <>
                <span style={{ ...s.label, marginTop: 10 }}>Riwayat Penyakit</span>
                <div style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.6 }}>{consultation.medicalHistory}</div>
              </>
            )}
          </div>

          {/* ── Lampiran Pasien — selalu tampil untuk dokter ────── */}
          {isDoctor && consultation.attachmentUrls?.length > 0 && (
            <AttachmentViewer attachmentUrls={consultation.attachmentUrls} />
          )}

          {/* ── Dokter Actions ─────────────────────────────────── */}
          {isDoctor && (
            <div style={s.sideSection}>
              <span style={s.label}>Tindakan Dokter</span>

              {/* Mulai sesi — hanya tersedia 5 menit sebelum jadwal s/d scheduledEnd */}
              {isConfirmed && (() => {
                const EARLY_GRACE_MS = 5 * 60 * 1000;
                const now = Date.now();
                const earliest = consultation.scheduledAt
                  ? new Date(consultation.scheduledAt).getTime() - EARLY_GRACE_MS
                  : 0;
                const expired = consultation.scheduledEnd && now > new Date(consultation.scheduledEnd).getTime();
                const canStart = now >= earliest && !expired;
                const minsLeft = earliest > now ? Math.ceil((earliest - now) / 60000) : 0;

                return (
                  <>
                    {!canStart && !expired && (
                      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#8b949e' }}>
                        ⏰ Start tersedia {minsLeft > 0 ? `dalam ${minsLeft} menit` : 'saat jadwal tiba'}
                        <div style={{ marginTop: 4, color: '#58a6ff' }}>{fmtDT(consultation.scheduledAt)}</div>
                      </div>
                    )}
                    {expired && (
                      <div style={{ background: '#161b22', border: '1px solid #f8514940', borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#f85149' }}>
                        ⚠️ Waktu konsultasi telah berakhir
                      </div>
                    )}
                    <button onClick={handleStart} disabled={starting || !canStart || expired}
                      style={{ ...s.actionBtn('#1a7f37'), opacity: (starting || !canStart || expired) ? 0.4 : 1, cursor: (canStart && !expired) ? 'pointer' : 'not-allowed' }}>
                      ▶ {starting ? 'Memulai...' : 'Mulai Sesi'}
                    </button>
                  </>
                );
              })()}

              {/* Actions saat live */}
              {isLive && (
                <>
                  {/* Video call button untuk dokter */}
                  {isVideoCall && (
                    <button onClick={() => setShowVideoCall(true)} style={s.actionBtn('#7c3aed')}>
                      📹 Mulai Video Call
                    </button>
                  )}
                  <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1f6feb')}>💊 Tulis Resep</button>
                  <button onClick={() => setShowMedicalRecord(true)} style={s.actionBtn('#0e7490')}>📋 Isi Rekam Medis</button>
                  {!sickLetter && (
                    <button onClick={() => setShowSickLetter(true)} style={s.actionBtn('#854d0e')}>📄 Buat Surat Sakit</button>
                  )}
                  {sickLetter?.status === 'draft' && (
                    <button onClick={handleIssueSickLetter} style={s.actionBtn('#d97706')}>✓ Terbitkan Surat Sakit</button>
                  )}
                  <button onClick={handleEnd}
                    style={{ ...s.actionBtn('#c0392b'), background: 'transparent', border: '1px solid #f8514940', color: '#f85149' }}>
                    ■ Akhiri Sesi
                  </button>
                </>
              )}
              {/* Dokter bisa isi/lihat rekam medis & resep setelah selesai */}
              {isCompleted && (
                <>
                  <button onClick={() => setShowMedicalRecord(true)} style={s.actionBtn('#0e7490')}>📋 {consultation.medicalRecord ? 'Edit Rekam Medis' : 'Isi Rekam Medis'}</button>
                  <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1f6feb')}>💊 {consultation.prescription ? 'Lihat/Edit Resep' : 'Tulis Resep'}</button>
                  {!sickLetter && (
                    <button onClick={() => setShowSickLetter(true)} style={s.actionBtn('#854d0e')}>📄 Buat Surat Sakit</button>
                  )}
                  {sickLetter?.status === 'draft' && (
                    <button onClick={handleIssueSickLetter} style={s.actionBtn('#d97706')}>✓ Terbitkan Surat Sakit</button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── User Actions ────────────────────────────────────── */}
          {isUser && (
            <div style={s.sideSection}>
              <span style={s.label}>Aksi</span>

              {/* Video call button untuk user — hanya saat live */}
              {isVideoCall && isLive && (
                <button onClick={() => setShowVideoCall(true)} style={s.actionBtn('#7c3aed')}>
                  📹 Gabung Video Call
                </button>
              )}

              {/* Dokumen — tersedia setelah konsultasi selesai */}
              {isCompleted && (
                <>
                  {consultation.prescription && (
                    <>
                      <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1a7f37')}>💊 Lihat Resep Dokter</button>
                      <button onClick={downloadPrescriptionPDF} style={{ ...s.actionBtn('#166534'), marginTop: -4 }}>⬇ Unduh Resep PDF</button>
                    </>
                  )}
                  {consultation.medicalRecord?.isCompleted && (
                    <button onClick={downloadMedicalRecordPDF} style={s.actionBtn('#0e7490')}>⬇ Unduh Rekam Medis PDF</button>
                  )}
                  {consultation.medicalRecord && !consultation.medicalRecord.isCompleted && (
                    <div style={{ background: '#161b22', border: '1px solid #f0883e40', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#f0883e' }}>
                      ⏳ Rekam medis sedang menunggu dilengkapi oleh dokter.
                    </div>
                  )}
                  {sickLetter?.status === 'issued' && (
                    <button onClick={downloadSickLetterPDF} style={s.actionBtn('#854d0e')}>⬇ Unduh Surat Sakit PDF</button>
                  )}
                </>
              )}

              {/* Rating — tersedia untuk completed, no_show, cancelled_by_doctor/admin (feedback) */}
              {isRatable && !consultation.rating && (
                <button onClick={() => setShowRating(true)} style={s.actionBtn('#ca8a04')}>⭐ Beri Rating</button>
              )}
              {isRatable && consultation.rating && (
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#8b949e' }}>
                  Rating Anda: {'⭐'.repeat(consultation.rating)}
                </div>
              )}

              {/* Saat live tapi belum ada dokumen */}
              {isLive && consultation.prescription && (
                <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1a7f37')}>💊 Lihat Resep Dokter</button>
              )}
              {isLive && sickLetter?.status === 'issued' && (
                <button onClick={downloadSickLetterPDF} style={s.actionBtn('#854d0e')}>⬇ Unduh Surat Sakit</button>
              )}

              {/* Info locked state */}
              {isLockedForUser && (
                <div style={{ background: '#161b22', border: '1px solid #1f6feb30', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#8b949e', textAlign: 'center' }}>
                  🔒 Chat aktif saat jadwal tiba
                </div>
              )}
            </div>
          )}

          {sickLetter && (
            <div style={s.sideSection}>
              <span style={s.label}>Surat Sakit</span>
              <div style={{ background: sickLetter.status === 'issued' ? '#0a3d1e' : '#1a1a2e', border: `1px solid ${sickLetter.status === 'issued' ? '#2ea04330' : '#a371f730'}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: sickLetter.status === 'issued' ? '#3fb950' : '#a371f7', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {sickLetter.status === 'issued' ? '✓ Sudah Terbit' : '○ Draft'}
                </div>
                <div style={{ color: '#c9d1d9', fontSize: 12 }}>Diagnosis: {sickLetter.diagnosis}</div>
                {sickLetter.startDate && <div style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>
                  {new Date(sickLetter.startDate).toLocaleDateString('id-ID')} – {new Date(sickLetter.endDate).toLocaleDateString('id-ID')}
                </div>}
              </div>
            </div>
          )}

          {/* Rekam medis status — untuk dokter */}
          {isDoctor && consultation.medicalRecord && (
            <div style={s.sideSection}>
              <span style={s.label}>Rekam Medis</span>
              <div style={{ background: consultation.medicalRecord.isCompleted ? '#0a3d1e' : '#1a1a2e', border: `1px solid ${consultation.medicalRecord.isCompleted ? '#2ea04330' : '#30363d'}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ color: consultation.medicalRecord.isCompleted ? '#3fb950' : '#a371f7', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                  {consultation.medicalRecord.isCompleted ? '✓ Selesai (pasien bisa unduh)' : '○ Draft (belum final)'}
                </div>
                {consultation.medicalRecord.assessment && <div style={{ color: '#c9d1d9', fontSize: 12 }}>Diagnosis: {consultation.medicalRecord.assessment}</div>}
              </div>
            </div>
          )}
        </div>

        {/* ── Chat Area ────────────────────────────────────────── */}
        <div style={s.chat}>
          <div style={s.header}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👨‍⚕️</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>{fmtDoctorName(doc)}</div>
              <div style={{ color: '#8b949e', fontSize: 12 }}>{doc?.specialization} · {typeLabel}</div>
            </div>
            <StatusBadge status={consultation.status} />
          </div>

          <div style={{ ...s.msgArea, position: 'relative' }}>
            {/* Countdown banner untuk dokter (info saja, tidak memblokir) */}
            {isDoctor && isConfirmed && consultation.scheduledAt && msUntil(consultation.scheduledAt) > 0 && (
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '12px 16px', marginBottom: 4 }}>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 6 }}>ℹ️ Anda bisa klik Mulai Sesi 5 menit sebelum jadwal</div>
                <CountdownBanner scheduledAt={consultation.scheduledAt} />
              </div>
            )}

            {/* Banner terkunci untuk USER — tampilkan jadwal + countdown di atas chat (bukan overlay) */}
            {isLockedForUser && (
              <div style={{ background: 'linear-gradient(135deg,#0d1f3c,#162032)', border: '1px solid #1f6feb50', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 32, flexShrink: 0 }}>🔒</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Ruang Chat Terkunci</div>
                    <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>
                      Konsultasi Anda terkonfirmasi. Chat akan aktif otomatis saat jadwal tiba.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d1117', borderRadius: 8, padding: '8px 12px', width: 'fit-content' }}>
                      <span style={{ color: '#8b949e', fontSize: 11 }}>Jadwal:</span>
                      <span style={{ color: '#58a6ff', fontWeight: 700, fontSize: 12 }}>{fmtDT(consultation.scheduledAt)}</span>
                    </div>
                    <div style={{ marginTop: 8 }}><CountdownBanner scheduledAt={consultation.scheduledAt} /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Session end countdown saat sedang berlangsung */}
            {isLive && consultation.scheduledEnd && msUntil(consultation.scheduledEnd) > 0 && (
              <div style={{ background: '#0a3d1e', border: '1px solid #2ea04330', borderRadius: 10, padding: '10px 14px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⏱️</span>
                <div>
                  <div style={{ color: '#3fb950', fontSize: 12, fontWeight: 700 }}>Sesi berakhir dalam <SessionEndCountdown scheduledEnd={consultation.scheduledEnd} /></div>
                  <div style={{ color: '#8b949e', fontSize: 11 }}>Sesi otomatis ditutup 15 mnt setelah waktu berakhir</div>
                </div>
              </div>
            )}

            {/* Keluhan banner */}
            <div style={{ background: '#161b22', border: '1px solid #1f6feb40', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
              <div style={{ color: '#58a6ff', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>📋 Keluhan Awal</div>
              <div style={{ color: '#c9d1d9', fontSize: 13 }}>{consultation.symptoms}</div>
            </div>

            {messages.map((msg, i) => {
              const isMine = msg.senderId?.toString() === myId?.toString();
              return (
                <div key={msg._id || msg._localId || i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine ? 'linear-gradient(135deg,#1f6feb,#388bfd)' : '#21262d',
                    color: '#e6edf3', fontSize: 14,
                    opacity: msg._pending ? 0.7 : 1,
                  }}>
                    {!isMine && <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>{msg.senderName}</div>}
                    {msg.imageUrl ? (
                      <div>
                        <img src={`${API_URL}${msg.imageUrl}`} alt="img" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.message ? 6 : 0 }} />
                        {msg.message && <div>{msg.message}</div>}
                      </div>
                    ) : (
                      <div style={{ lineHeight: 1.5 }}>{msg.message}</div>
                    )}
                    <div style={{ color: isMine ? 'rgba(255,255,255,.5)' : '#8b949e', fontSize: 10, marginTop: 4, textAlign: 'right' }}>
                      {msg._pending ? '⏳' : fmtTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}

            {typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#58a6ff', animation: 'bounce 1s infinite', animationDelay: `${d}s` }} />
                  ))}
                </div>
                <span>mengetik...</span>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Completed bar */}
          {isCompleted && (
            <div style={{ padding: '16px 20px', background: '#0a3d1e', borderTop: '1px solid #2ea04330', flexShrink: 0 }}>
              <div style={{ color: '#3fb950', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                ✅ Konsultasi selesai — {fmtDate(consultation.endTime)}
              </div>
              {isUser && (
                <div style={{ fontSize: 12, color: '#8b949e' }}>
                  {[
                    consultation.prescription && '💊 Resep tersedia',
                    consultation.medicalRecord?.isCompleted && '📋 Rekam medis tersedia',
                    consultation.sickLetter?.status === 'issued' && '📄 Surat sakit tersedia',
                  ].filter(Boolean).join(' · ') || 'Dokter belum mengisi rekam medis / resep.'}
                  {(consultation.prescription || consultation.medicalRecord?.isCompleted || consultation.sickLetter?.status === 'issued') &&
                    <span style={{ color: '#58a6ff', marginLeft: 6 }}>→ Unduh dari sidebar kiri</span>
                  }
                </div>
              )}
              {isUser && !consultation.rating && (
                <button onClick={() => setShowRating(true)}
                  style={{ marginTop: 10, padding: '6px 18px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ⭐ Beri Rating
                </button>
              )}
            </div>
          )}

          {/* Status info bar — saat tidak bisa chat */}
          {!canChat && !isCompleted && !isLockedForUser && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #21262d', background: '#161b22', textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
              {isConfirmed && isDoctor && '✅ Pembayaran dikonfirmasi. Klik "Mulai Sesi" di sidebar saat siap.'}
              {isConfirmed && isUser && timeHasArrived && '⏳ Menunggu dokter memulai sesi...'}
              {isLive && isUser && !timeHasArrived && '⏳ Sesi berlangsung — menunggu dokter...'}
            </div>
          )}

          {/* Chat input footer — selalu render saat canChat ATAU isLockedForUser */}
          {(canChat || isLockedForUser) && (
            <div style={s.footer}>
              <form onSubmit={canChat ? sendMessage : e => e.preventDefault()}
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                <button type="button"
                  onClick={() => canChat && fileInputRef.current?.click()}
                  disabled={!canChat || uploadingImg}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: '#21262d', border: 'none', color: uploadingImg ? '#3fb950' : '#8b949e', cursor: canChat ? 'pointer' : 'not-allowed', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {uploadingImg ? '⏳' : '📎'}
                </button>
                <input
                  value={canChat ? newMessage : ''}
                  readOnly={!canChat}
                  onChange={e => { if (canChat) { setNewMessage(e.target.value); handleTyping(); } }}
                  onKeyDown={e => { if (canChat && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                  placeholder={isLockedForUser ? '🔒 Chat aktif saat jadwal tiba — silakan lihat UI di atas' : 'Ketik pesan... (Enter untuk kirim)'}
                  style={{ flex: 1, background: isLockedForUser ? '#0d1117' : '#21262d', border: isLockedForUser ? '1px solid #30363d' : 'none', borderRadius: 20, padding: '9px 16px', color: isLockedForUser ? '#484f58' : '#e6edf3', fontSize: 14, outline: 'none', cursor: isLockedForUser ? 'not-allowed' : 'text' }} />
                <button type="submit"
                  disabled={!canChat || !newMessage.trim() || sending}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: (canChat && newMessage.trim() && !sending) ? '#1f6feb' : '#21262d', border: 'none', color: '#fff', cursor: (canChat && !sending) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sending ? '⏳' : '➤'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {showPrescription   && <PrescriptionModal consultation={consultation} isDoctor={isDoctor} onClose={() => setShowPrescription(false)} onSave={handleSendPrescription} />}
      {showMedicalRecord  && <MedicalRecordModal existing={consultation.medicalRecord} consultation={consultation} onClose={() => setShowMedicalRecord(false)} onSave={handleSaveMedicalRecord} />}
      {showSickLetter     && <SickLetterModal onClose={() => setShowSickLetter(false)} onSave={handleCreateSickLetter} />}
      {showRating         && <RatingModal consultationId={id} onClose={() => setShowRating(false)} onSuccess={fetchConsultation} />}
      {showEndModal       && (
        <MedicalRecordModal
          existing={consultation.medicalRecord}
          consultation={consultation}
          onClose={() => setShowEndModal(false)}
          onSave={handleEndConfirm}
          isEndSession={true}
          saving={ending}
        />
      )}

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </>
  );
};

export default ConsultationChat;