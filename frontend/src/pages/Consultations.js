import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import {
  FaStar, FaStarHalfAlt, FaRegStar, FaCircle,
  FaImage, FaSearch
} from 'react-icons/fa';

// ── Helpers ──────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const fmtRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const StarRating = ({ value = 0 }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (value >= i) stars.push(<FaStar key={i} className="text-warning" />);
    else if (value >= i - 0.5) stars.push(<FaStarHalfAlt key={i} className="text-warning" />);
    else stars.push(<FaRegStar key={i} className="text-warning" />);
  }
  return <span>{stars}</span>;
};

const StatusBadge = ({ status }) => {
  const cfg = {
    draft:              { color: '#6b7280', bg: '#f3f4f6', label: 'Draft' },
    pending_payment:    { color: '#b45309', bg: '#fffbeb', label: 'Menunggu Pembayaran' },
    waiting_verification: { color: '#b45309', bg: '#fffbeb', label: 'Verifikasi Pembayaran' },
    confirmed:          { color: '#1d4ed8', bg: '#eff6ff', label: 'Dikonfirmasi' },
    paid:               { color: '#1d4ed8', bg: '#eff6ff', label: 'Dibayar' },
    scheduled:          { color: '#7e22ce', bg: '#f5f3ff', label: 'Terjadwal' },
    in_progress:        { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    ongoing:            { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    completed:          { color: '#1d4ed8', bg: '#eff6ff', label: 'Selesai' },
    cancelled:          { color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan' },
    cancelled_by_doctor:{ color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan Dokter' },
    expired:            { color: '#6b7280', bg: '#f3f4f6', label: 'Kadaluarsa' },
    rejected_payment:   { color: '#b91c1c', bg: '#fef2f2', label: 'Pembayaran Ditolak' },
    no_show:            { color: '#b45309', bg: '#fffbeb', label: 'Tidak Hadir' },
    doctor_no_show:     { color: '#b91c1c', bg: '#fef2f2', label: 'Dokter Tidak Hadir' },
    refund_requested:   { color: '#7e22ce', bg: '#f5f3ff', label: 'Refund Diajukan' },
    refunded:           { color: '#15803d', bg: '#f0fdf4', label: 'Refund Selesai' },
    refund_failed:      { color: '#b91c1c', bg: '#fef2f2', label: 'Refund Ditolak' },
  };
  const c = cfg[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.color}40`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 5
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
      {c.label}
    </span>
  );
};

// ── Countdown timer ───────────────────────────────────────────────
const Countdown = ({ deadline, onExpired }) => {
  const [sisa, setSisa] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setSisa('00:00'); onExpired?.(); return; }
      const m = String(Math.floor(diff / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setSisa(`${m}:${s}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, onExpired]);
  const isUrgent = sisa && parseInt(sisa.split(':')[0]) < 5;
  return (
    <span style={{ color: isUrgent ? '#b91c1c' : '#b45309', fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>
      ⏱ {sisa}
    </span>
  );
};

// ── Xendit Payment Form ───────────────────────────────────────────
const PaymentForm = ({ consultation, amount, deadline, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/consultations/${consultation._id}/initiate-payment`);
      if (res.data.invoiceUrl) {
        window.location.href = res.data.invoiceUrl;
      } else {
        throw new Error('Gagal mendapatkan URL pembayaran');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Terjadi kesalahan');
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {deadline && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: '#92400e', fontSize: 12, marginBottom: 4 }}>Selesaikan pembayaran dalam</div>
          <Countdown deadline={deadline} onExpired={() => { toast.error('Waktu habis, silakan booking ulang'); onClose(); }} />
          <div style={{ color: '#92400e', fontSize: 11, marginTop: 4 }}>Slot dibebaskan jika tidak dibayar tepat waktu</div>
        </div>
      )}

      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Ringkasan</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
          <span>Layanan</span><span style={{ fontWeight: 600 }}>Konsultasi Online</span>
        </div>
        {consultation?.doctorId?.name && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
            <span>Dokter</span><span style={{ fontWeight: 600 }}>dr. {consultation.doctorId.name}</span>
          </div>
        )}
        {consultation?.scheduledAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
            <span>Jadwal</span>
            <span style={{ fontWeight: 600 }}>
              {new Date(consultation.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
            </span>
          </div>
        )}
        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#059669' }}>{fmtRupiah(amount)}</span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>METODE TERSEDIA</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['VA BCA/BRI/BNI/Mandiri', 'QRIS', 'OVO', 'DANA', 'ShopeePay', 'Alfamart/Indomaret'].map(m => (
            <span key={m} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#374151' }}>{m}</span>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginBottom: 16 }}>
        🔒 Anda akan diarahkan ke halaman Xendit yang aman. Konfirmasi <strong>otomatis</strong> setelah bayar — tidak perlu upload bukti.
      </div>

      <button onClick={handlePay} disabled={loading} style={{
        width: '100%', padding: '13px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15,
        background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
        color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {loading ? <>
          <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.35)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'xspin 1s linear infinite' }} />
          Mengarahkan ke Xendit...
        </> : '💳 Bayar Sekarang via Xendit'}
        <style>{`@keyframes xspin{to{transform:rotate(360deg)}}`}</style>
      </button>
      <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>
        Batal
      </button>
    </div>
  );
};


// ── Multi-step Form ───────────────────────────────────────────────
const STEPS = ['Pilih Dokter', 'Tipe Konsultasi', 'Keluhan', 'Pilih Slot'];

const NewConsultationWizard = ({ onCreated }) => {
  const [step, setStep] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [form, setForm] = useState({
    doctorId: '', consultationType: 'chat',
    selectedSlot: null, // { date, startTime, endTime, startUtc, endUtc }
    symptoms: '', medicalHistory: '', attachments: []
  });
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [slots, setSlots] = useState([]);
  const [slotsMsg, setSlotsMsg] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/doctors').then(r => setDoctors(r.data || [])).catch(() => {}).finally(() => setLoadingDoctors(false));
  }, []);

  // Load slots saat step 3 dan dokter dipilih
  useEffect(() => {
    if (step === 3 && form.doctorId) {
      setSlots([]);
      setSlotsMsg('');
      setLoadingSlots(true);
      api.get(`/api/availability/slots/${form.doctorId}`)
        .then(r => {
          setSlots(r.data.slots || []);
          setSlotsMsg(r.data.message || '');
        })
        .catch(() => { toast.error('Gagal memuat slot jadwal'); setSlots([]); setSlotsMsg('Gagal memuat jadwal'); })
        .finally(() => setLoadingSlots(false));
    }
  }, [step, form.doctorId]);

  const selectedDoctor = doctors.find(d => d._id === form.doctorId);
  const specializations = [...new Set(doctors.map(d => d.specialization))].sort();
  const filteredDoctors = doctors.filter(d => {
    const q = search.toLowerCase();
    return (!search || d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q))
      && (!filterSpec || d.specialization === filterSpec);
  });

  // Group slots by date
  const slotsByDate = slots.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const fmtSlotDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const handleSubmit = async () => {
    if (!form.selectedSlot) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('doctorId', form.doctorId);
      fd.append('consultationType', form.consultationType);
      fd.append('scheduledAt', form.selectedSlot.startUtc);
      fd.append('scheduledEnd', form.selectedSlot.endUtc);
      fd.append('symptoms', form.symptoms);
      fd.append('medicalHistory', form.medicalHistory);
      form.attachments.forEach(f => fd.append('attachments', f));

      const r = await api.post('/api/consultations/create', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Konsultasi berhasil dibuat!');
      onCreated(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat konsultasi');
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!form.doctorId;
    if (step === 1) {
      if (!form.consultationType) return false;
      const settings = selectedDoctor?.consultationSettings || {};
      const keyMap = { chat: 'allowChat', video_call: 'allowVideoCall' };
      return settings[keyMap[form.consultationType]] !== false;
    }
    if (step === 2) return form.symptoms.trim().length > 5;
    if (step === 3) return !!form.selectedSlot;
    return true;
  };

  const s = {
    card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    h: { color: '#111827', fontFamily: "\'Inter\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif", fontWeight: 700 },
    sub: { color: '#6b7280', fontSize: 13 },
    inp: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', color: '#111827', width: '100%', fontSize: 14, outline: 'none' },
    btn: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
    btnGhost: { background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontSize: 14 },
  };

  return (
    <div style={s.card} className="p-4">
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24, overflowX: 'auto' }}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                background: i < step ? '#16a34a' : i === step ? '#2563eb' : '#f3f4f6',
                color: i <= step ? '#fff' : '#9ca3af', border: `2px solid ${i < step ? '#22c55e' : i === step ? '#3b82f6' : '#e5e7eb'}`
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i === step ? '#2563eb' : '#6b7280', marginTop: 4, whiteSpace: 'nowrap' }}>{label}</div>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? '#22c55e' : '#e5e7eb', minWidth: 12 }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Pilih Dokter */}
      {step === 0 && (
        <div>
          <h6 style={s.h}>Pilih Dokter</h6>
          <p style={s.sub}>Cari berdasarkan nama atau spesialisasi</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari dokter..."
                style={{ ...s.inp, paddingLeft: 32 }} />
            </div>
            <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)}
              style={{ ...s.inp, width: 'auto', minWidth: 140 }}>
              <option value="">Semua Spesialis</option>
              {specializations.map(sp => <option key={sp}>{sp}</option>)}
            </select>
          </div>
          {loadingDoctors ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Memuat dokter...</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
              {filteredDoctors.map(doc => (
                <div key={doc._id} onClick={() => setForm(f => ({ ...f, doctorId: doc._id, selectedSlot: null }))}
                  style={{
                    border: `2px solid ${form.doctorId === doc._id ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', background: '#ffffff',
                    display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s',
                    boxShadow: form.doctorId === doc._id ? '0 0 0 2px #2563eb40' : 'none'
                  }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {doc.photo ? <img src={`${API_URL}${doc.photo}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : '👨\u200d⚕️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>dr. {doc.name}</div>
                    <div style={{ color: '#2563eb', fontSize: 12 }}>{doc.specialization}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <StarRating value={doc.rating} />
                      <span style={{ color: '#6b7280', fontSize: 11 }}>({doc.totalReviews || 0} ulasan)</span>
                      {doc.experience && <span style={{ color: '#6b7280', fontSize: 11 }}>· {doc.experience} thn</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 13 }}>{fmtRupiah(doc.consultationFee)}</div>
                  </div>
                </div>
              ))}
              {filteredDoctors.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>Dokter tidak ditemukan</div>}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Tipe Konsultasi */}
      {step === 1 && (
        <div>
          <h6 style={s.h}>Pilih Jenis Konsultasi</h6>
          <p style={s.sub}>Dengan dr. {selectedDoctor?.name} — {fmtRupiah(selectedDoctor?.consultationFee)}</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { val: 'chat',       icon: '💬', label: 'Chat',       desc: 'Konsultasi via pesan teks & foto',  key: 'allowChat' },
              { val: 'video_call', icon: '📹', label: 'Video Call', desc: 'Konsultasi tatap muka virtual',     key: 'allowVideoCall' },
            ].map(opt => {
              const settings = selectedDoctor?.consultationSettings || {};
              const isAllowed = settings[opt.key] !== false;
              return (
                <div key={opt.val}
                  onClick={() => isAllowed && setForm(f => ({ ...f, consultationType: opt.val }))}
                  style={{
                    border: `2px solid ${form.consultationType === opt.val ? '#3b82f6' : isAllowed ? '#e5e7eb' : '#f3f4f6'}`,
                    borderRadius: 12, padding: '14px 18px',
                    cursor: isAllowed ? 'pointer' : 'not-allowed',
                    background: isAllowed ? '#ffffff' : '#f9fafb',
                    display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s',
                    opacity: isAllowed ? 1 : 0.5
                  }}>
                  <span style={{ fontSize: 32 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#111827', fontWeight: 600 }}>
                      {opt.label}
                      {!isAllowed && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— Tidak tersedia</span>}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>{opt.desc}</div>
                  </div>
                  {form.consultationType === opt.val && isAllowed && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 20 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Keluhan */}
      {step === 2 && (
        <div>
          <h6 style={s.h}>Isi Keluhan</h6>
          <p style={s.sub}>Informasi ini akan dilihat dokter sebelum konsultasi dimulai</p>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>Gejala / Keluhan <span style={{ color: '#b91c1c' }}>*</span></label>
            <textarea value={form.symptoms} rows={4}
              onChange={e => setForm(f => ({ ...f, symptoms: e.target.value }))}
              placeholder="Ceritakan gejala yang Anda alami secara detail..."
              style={{ ...s.inp, resize: 'vertical', minHeight: 90 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>Riwayat Penyakit</label>
            <textarea value={form.medicalHistory} rows={3}
              onChange={e => setForm(f => ({ ...f, medicalHistory: e.target.value }))}
              placeholder="Penyakit sebelumnya, alergi obat, dll. (opsional)"
              style={{ ...s.inp, resize: 'vertical', minHeight: 70 }} />
          </div>
          <div>
            <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>Lampiran Foto (opsional, maks 5 file, 5MB)</label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: '#ffffff', border: '1px dashed #e5e7eb', borderRadius: 8, cursor: 'pointer'
            }}>
              <FaImage style={{ color: '#2563eb' }} />
              <span style={{ color: '#6b7280', fontSize: 13 }}>
                {form.attachments.length > 0 ? `${form.attachments.length} file dipilih` : 'Pilih foto keluhan...'}
              </span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files).slice(0, 5);
                  setForm(f => ({ ...f, attachments: files }));
                }} />
            </label>
          </div>
        </div>
      )}

      {/* Step 3: Pilih Slot */}
      {step === 3 && (
        <div>
          <h6 style={s.h}>Pilih Jadwal Konsultasi</h6>
          <p style={s.sub}>
            Pilih slot yang tersedia dalam 7 hari ke depan. Setiap slot berdurasi 30 menit.
          </p>

          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              Memuat jadwal tersedia...
            </div>
          ) : slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada slot tersedia</div>
              <div style={{ fontSize: 13 }}>
                {slotsMsg || 'Dokter ini belum mengatur jadwal atau semua slot sudah penuh'}
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
              {Object.entries(slotsByDate).map(([date, daySlots]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: 13, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>
                    📅 {fmtSlotDate(date)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {daySlots.map(slot => {
                      const isSelected = form.selectedSlot?.startUtc === slot.startUtc;
                      const isAvailable = slot.available;
                      return (
                        <button
                          key={slot.startUtc}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && setForm(f => ({ ...f, selectedSlot: slot }))}
                          style={{
                            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: `2px solid ${isSelected ? '#2563eb' : isAvailable ? '#e5e7eb' : '#f3f4f6'}`,
                            background: isSelected ? '#eff6ff' : isAvailable ? '#ffffff' : '#f9fafb',
                            color: isSelected ? '#2563eb' : isAvailable ? '#374151' : '#9ca3af',
                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                            transition: 'all 0.1s',
                            minWidth: 80
                          }}
                        >
                          {slot.startTime}
                          {!isAvailable && <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: '#ef4444' }}>Penuh</span>}
                          {isAvailable && <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: '#6b7280' }}>s/d {slot.endTime}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {form.selectedSlot && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginTop: 16 }}>
              <div style={{ color: '#1d4ed8', fontSize: 12, marginBottom: 8, fontWeight: 700 }}>RINGKASAN PESANAN</div>
              {[
                ['Dokter', `dr. ${selectedDoctor?.name} (${selectedDoctor?.specialization})`],
                ['Tipe', form.consultationType === 'chat' ? '💬 Chat' : '📹 Video Call'],
                ['Tanggal', fmtSlotDate(form.selectedSlot.date)],
                ['Jam', `${form.selectedSlot.startTime} – ${form.selectedSlot.endTime} WIB`],
                ['Biaya', fmtRupiah(selectedDoctor?.consultationFee)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>{k}</span>
                  <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                ⏰ Slot ini akan terkunci 15 menit setelah konfirmasi. Segera lakukan pembayaran.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 10 }}>
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} style={s.btnGhost}>← Kembali</button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ ...s.btn, opacity: canNext() ? 1 : 0.4 }}>
            Lanjut →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canNext() || submitting} style={{ ...s.btn, opacity: (!canNext() || submitting) ? 0.4 : 1 }}>
            {submitting ? 'Membuat...' : 'Buat Konsultasi & Bayar'}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Helper: deadline batal/reschedule (scheduledAt − 24 jam) ──────
const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;

function canCancelConsultation(cons) {
    if (!['confirmed'].includes(cons.status)) return false;
    if (!cons.scheduledAt) return false;
    return new Date(cons.scheduledAt).getTime() - Date.now() > CANCEL_DEADLINE_MS;
}

function fmtCancelDeadline(scheduledAt) {
    const dl = new Date(new Date(scheduledAt).getTime() - CANCEL_DEADLINE_MS);
    return dl.toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
}

// ── History Card ──────────────────────────────────────────────────
const ConsultationCard = ({ cons, onPay, onChat, onDownload, onDownloadPrescription, onDownloadMedRecord, onRate, onRefund, onCancel, onPostCancel, onReschedule }) => {
  const [expanded, setExpanded] = useState(false);
  const needsPay = cons.status === 'pending_payment';
  const canChat = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing'].includes(cons.status);
  const isCompleted = cons.status === 'completed';
  // Rating juga bisa diberikan untuk no_show/cancelled (sebagai feedback)
  const canRate = ['completed', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(cons.status) && !cons.rating;
  const hasSickLetter = cons.sickLetter?.status === 'issued';
  const hasPrescription = !!(cons.prescriptionData?.prescriptionNumber || cons.prescription);
  const hasMedRecord = !!cons.medicalRecord?.isCompleted;
  const canRefund = ['cancelled_by_doctor', 'doctor_no_show'].includes(cons.status);
  const isRefundPending = cons.status === 'refund_requested';
  const isRefundFailed = cons.status === 'refund_failed';
  const showCancelBtn = canCancelConsultation(cons);
  const isConfirmedPast = cons.status === 'confirmed' && cons.scheduledAt &&
      (new Date(cons.scheduledAt).getTime() - Date.now() <= CANCEL_DEADLINE_MS);
  // Reschedule tersedia jika confirmed dan masih dalam batas h-24
  const canRescheduleConsultation = cons.status === 'confirmed' && showCancelBtn;

  // Perlu tindakan pasca-pembatalan oleh dokter/admin/no-show
  const needsPostCancelAction = ['doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'].includes(cons.status)
      && !cons.postCancelChoice && cons.paidAt;

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14,
      marginBottom: 12, overflow: 'hidden', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👨‍⚕️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>dr. {cons.doctorId?.name}</span>
              <span style={{ color: '#2563eb', fontSize: 12 }}>{cons.doctorId?.specialization}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={cons.status} />
              {cons.consultationType && (
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 8px', borderRadius: 20 }}>
                  {cons.consultationType === 'chat' ? '💬 Chat' : '📹 Video'}
                </span>
              )}
            </div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              {fmtDate(cons.createdAt)}
              {cons.scheduledAt && ` · Jadwal: ${fmtDateTime(cons.scheduledAt)}`}
            </div>
          </div>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        {needsPay && cons.paymentDeadline && (
          <div style={{ marginTop: 10, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280', fontSize: 12 }}>Batas pembayaran:</span>
            <Countdown deadline={cons.paymentDeadline} />
          </div>
        )}

        {/* Deadline batalkan/reschedule — tampilkan untuk confirmed */}
        {cons.status === 'confirmed' && cons.scheduledAt && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: showCancelBtn ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${showCancelBtn ? '#bbf7d0' : '#fecaca'}`,
            color: showCancelBtn ? '#166534' : '#b91c1c',
          }}>
            {showCancelBtn
              ? <>⏰ Anda dapat mengubah atau membatalkan jadwal ini hingga: <strong>{fmtCancelDeadline(cons.scheduledAt)}</strong></>
              : <>🔒 Batas pembatalan telah lewat ({fmtCancelDeadline(cons.scheduledAt)})</>
            }
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {needsPay && (
            <button onClick={onPay}
              style={{ background: 'linear-gradient(135deg,#b45309,#d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              💳 Bayar Sekarang
            </button>
          )}
          {canChat && (
            <button onClick={onChat}
              style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              💬 {cons.status === 'ongoing' ? 'Lanjutkan Chat' : 'Buka Room'}
            </button>
          )}
          {showCancelBtn && onCancel && (
            <button onClick={onCancel}
              style={{ background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              ❌ Batalkan & Refund
            </button>
          )}
          {canRescheduleConsultation && onReschedule && (
            <button onClick={onReschedule}
              style={{ background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              🔄 Reschedule
            </button>
          )}
          {needsPostCancelAction && onPostCancel && (
            <button onClick={onPostCancel}
              style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              🔄 Pilih Refund / Reschedule
            </button>
          )}
          {canRate && (
            <button onClick={onRate}
              style={{ background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              ⭐ Beri Rating
            </button>
          )}
          {hasSickLetter && (
            <button onClick={onDownload}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              📄 Surat Sakit
            </button>
          )}
          {hasPrescription && (
            <button onClick={onDownloadPrescription}
              style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              💊 Resep PDF
            </button>
          )}
          {hasMedRecord && (
            <button onClick={onDownloadMedRecord}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              📋 Rekam Medis
            </button>
          )}
          {canRefund && (
            <button onClick={onRefund}
              style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              💸 Ajukan Refund
            </button>
          )}
          {isRefundPending && (
            <span style={{ padding: '7px 14px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ⏳ Menunggu Proses Refund
            </span>
          )}
          {isRefundFailed && cons.refund?.failReason && (
            <div style={{ padding: '7px 14px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12 }}>
              ❌ Refund ditolak: {cons.refund.failReason}
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px', background: '#fafafa' }}>
          {cons.symptoms && <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Keluhan: </span><span style={{ color: '#111827', fontSize: 13 }}>{cons.symptoms}</span></div>}
          {cons.medicalHistory && <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Riwayat: </span><span style={{ color: '#111827', fontSize: 13 }}>{cons.medicalHistory}</span></div>}

          {/* Rekam medis ringkasan */}
          {cons.medicalRecord?.assessment && (
            <div style={{ marginBottom: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ color: '#0369a1', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>📋 REKAM MEDIS</div>
              <div style={{ fontSize: 13, color: '#111827' }}><span style={{ color: '#6b7280' }}>Diagnosis: </span>{cons.medicalRecord.assessment}</div>
              {cons.medicalRecord.plan && <div style={{ fontSize: 13, color: '#111827', marginTop: 2 }}><span style={{ color: '#6b7280' }}>Rencana: </span>{cons.medicalRecord.plan}</div>}
            </div>
          )}

          {/* Resep ringkasan */}
          {cons.prescriptionData?.medicines?.length > 0 ? (
            <div style={{ marginBottom: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ color: '#15803d', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>💊 RESEP — No. {cons.prescriptionData.prescriptionNumber}</div>
              {cons.prescriptionData.medicines.slice(0, 3).map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: '#374151' }}>
                  {i+1}. {m.name}{m.dose ? ' '+m.dose : ''} — {m.frequency}
                </div>
              ))}
              {cons.prescriptionData.medicines.length > 3 && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>+{cons.prescriptionData.medicines.length - 3} obat lainnya</div>
              )}
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Berlaku s/d: {cons.prescriptionData.validUntil ? new Date(cons.prescriptionData.validUntil).toLocaleDateString('id-ID') : '-'} · {cons.prescriptionData.isUsed ? '✓ Sudah digunakan' : '○ Belum digunakan'}
              </div>
            </div>
          ) : cons.prescription ? (
            <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Resep: </span><span style={{ color: '#16a34a', fontSize: 13 }}>{cons.prescription}</span></div>
          ) : null}

          {cons.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#6b7280', fontSize: 12 }}>Rating: </span>
              <StarRating value={cons.rating} />
              {cons.ratingComment && <span style={{ color: '#111827', fontSize: 12 }}>"{cons.ratingComment}"</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Refund Modal ─────────────────────────────────────────────────
const RefundModal = ({ consultation, onClose, onSuccess }) => {
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountHolder: '', notes: '' });
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = React.useRef();

  const handleSubmit = async () => {
    if (!form.bankName || !form.accountNumber || !form.accountHolder) {
      toast.error('Lengkapi semua field yang wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('bankName', form.bankName);
      fd.append('accountNumber', form.accountNumber);
      fd.append('accountName', form.accountHolder);  // backend pakai accountName
      fd.append('notes', form.notes);
      if (proofFile) fd.append('proof', proofFile);  // backend pakai 'proof'

      await api.post(`/api/consultations/${consultation._id}/refund-request`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Pengajuan refund berhasil dikirim');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan refund');
    } finally { setSubmitting(false); }
  };

  const cancelReason = {
    cancelled_by_doctor: 'Konsultasi dibatalkan oleh dokter',
    doctor_no_show: 'Dokter tidak hadir dalam 15 menit setelah jadwal',
  }[consultation.status] || 'Konsultasi dibatalkan';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>💸 Ajukan Refund</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Alasan */}
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
            <strong>Alasan refund:</strong> {cancelReason}
          </div>

          {[
            { key: 'bankName', label: 'Nama Bank *', placeholder: 'Contoh: BCA, BRI, Mandiri, BNI' },
            { key: 'accountNumber', label: 'Nomor Rekening *', placeholder: 'Contoh: 1234567890' },
            { key: 'accountHolder', label: 'Atas Nama *', placeholder: 'Sesuai buku tabungan' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none' }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>Catatan Tambahan</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Informasi tambahan (opsional)..."
              rows={2}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'none', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>Bukti Pembayaran (opsional)</label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setProofFile(e.target.files[0])} />
            <button type="button" onClick={() => fileRef.current.click()}
              style={{ padding: '8px 16px', border: '1px dashed #d1d5db', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
              📎 {proofFile ? proofFile.name : 'Pilih File'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSubmit} disabled={submitting || !form.bankName || !form.accountNumber || !form.accountHolder}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Mengirim...' : '✓ Kirim Pengajuan Refund'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Rating Modal ─────────────────────────────────────────────────
const RatingModal = ({ consultationId, doctorName, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) { toast.error('Pilih rating terlebih dahulu'); return; }
    setSubmitting(true);
    try {
      await api.post(`/api/consultations/${consultationId}/rating`, { rating, comment });
      toast.success('Terima kasih atas rating Anda!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal kirim rating');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, width: '90%', maxWidth: 420, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <h5 style={{ color: '#111827', fontWeight: 700, marginBottom: 6 }}>Beri Rating</h5>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Bagaimana pengalaman konsultasi dengan dr. {doctorName}?</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)} style={{ fontSize: 36, cursor: 'pointer', transition: 'transform 0.1s', transform: i <= (hovered || rating) ? 'scale(1.2)' : 'scale(1)' }}>
              {i <= (hovered || rating) ? '⭐' : '☆'}
            </span>
          ))}
        </div>
        <textarea value={comment} rows={3} onChange={e => setComment(e.target.value)}
          placeholder="Tambahkan komentar (opsional)..."
          style={{ width: '100%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', color: '#111827', fontSize: 14, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Batal</button>
          <button onClick={handleSubmit} disabled={!rating || submitting}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed', opacity: rating ? 1 : 0.5 }}>
            {submitting ? 'Mengirim...' : 'Kirim Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const Consultations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('history'); // 'new' | 'history'
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [ratingModal, setRatingModal] = useState(null);
  const [refundModal, setRefundModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Bank info untuk disbursement (paidAt > 7 hari)
  const [needsBankInfo, setNeedsBankInfo]   = useState(false);
  const [bankCode, setBankCode]             = useState('');
  const [accountNumber, setAccountNumber]   = useState('');
  const [accountName, setAccountName]       = useState('');
  const [bankList, setBankList]             = useState([]);

  // Post-cancel choice (reschedule atau refund setelah doctor_no_show/cancelled_by_doctor/admin)
  const [postCancelModal, setPostCancelModal] = useState(null); // consultation object
  const [postCancelChoice, setPostCancelChoice] = useState(null); // 'refund'|'reschedule'
  const [postCancelBankCode, setPostCancelBankCode] = useState('');
  const [postCancelAccount, setPostCancelAccount] = useState('');
  const [postCancelAccountName, setPostCancelAccountName] = useState('');
  const [postCancelProcessing, setPostCancelProcessing] = useState(false);

  // Fetch daftar bank Xendit
  useEffect(() => {
    api.get('/api/xendit/banks').then(r => setBankList(r.data.banks || [])).catch(() => {});
  }, []);

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/consultations/my-consultations');
      setConsultations(r.data || []);
    } catch { toast.error('Gagal memuat konsultasi'); }
    finally { setLoading(false); }
  }, []);

  const handleCancelConsultation = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      const payload = { reason: 'Dibatalkan oleh pasien' };
      if (needsBankInfo) {
        if (!bankCode || !accountNumber || !accountName) {
          toast.error('Data rekening wajib diisi untuk menerima refund');
          setCancelling(false); return;
        }
        payload.bankCode = bankCode;
        payload.accountNumber = accountNumber;
        payload.accountName = accountName;
      }
      const r = await api.put(`/api/consultations/${cancelModal._id}/cancel`, payload);
      if (r.data.needsBankInfo) {
        setNeedsBankInfo(true);
        setCancelling(false); return;
      }
      toast.success('Konsultasi dibatalkan. Refund akan diproses dalam 1x24 jam.');
      setCancelModal(null); setNeedsBankInfo(false);
      setBankCode(''); setAccountNumber(''); setAccountName('');
      fetchConsultations();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Gagal membatalkan konsultasi');
    } finally { setCancelling(false); }
  };

  const handlePostCancelChoice = async () => {
    if (!postCancelModal || !postCancelChoice) return;
    setPostCancelProcessing(true);
    try {
      if (postCancelChoice === 'refund') {
        const payload = {};
        if (postCancelBankCode) {
          payload.bankCode = postCancelBankCode;
          payload.accountNumber = postCancelAccount;
          payload.accountName = postCancelAccountName;
        }
        await api.post(`/api/xendit/refund/${postCancelModal._id}`, payload);
        toast.success('Refund sedang diproses. Dana akan masuk dalam 1x24 jam.');
        setPostCancelModal(null); fetchConsultations();
      } else if (postCancelChoice === 'reschedule') {
        navigate(`/consultations/book/${postCancelModal.doctorId?._id || postCancelModal.doctorId}?rescheduleId=${postCancelModal._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses pilihan');
    } finally { setPostCancelProcessing(false); }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchConsultations();
  }, [user, fetchConsultations, navigate]);

  // ── Polling ringan saat ada pending_payment (safety net untuk Xendit webhook)
  useEffect(() => {
    const hasPending = consultations.some(c => c.status === 'pending_payment');
    if (!hasPending) return;
    const interval = setInterval(fetchConsultations, 10000);
    return () => clearInterval(interval);
  }, [consultations, fetchConsultations]);

  // ── Socket: update real-time dari Xendit webhook
  useEffect(() => {
    if (!user) return;
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id }
    });
    sock.emit('join-user', user.id);
    sock.on('new-notification', (notif) => {
      if (['payment_verified', 'consultation_started', 'consultation_ended'].includes(notif.type)) {
        fetchConsultations();
      }
    });
    sock.on('consultation-status-update', () => fetchConsultations());
    return () => sock.close();
  }, [user, fetchConsultations]);

  const handleCreated = async (data) => {
    setView('history');
    fetchConsultations();
    // Langsung redirect ke Xendit — tidak perlu buka modal manual
    try {
      const res = await api.post(`/api/consultations/${data.consultation._id}/initiate-payment`);
      if (res.data.invoiceUrl) {
        toast.success('Slot dikunci! Mengarahkan ke pembayaran...');
        setTimeout(() => { window.location.href = res.data.invoiceUrl; }, 700);
      }
    } catch (err) {
      // Fallback: buka modal jika redirect gagal
      toast.error('Redirect gagal, klik tombol Bayar untuk melanjutkan.');
      setPayModal({ consultation: data.consultation, amount: data.amount, deadline: data.paymentDeadline });
    }
  };

  const handleDownloadPDF = async (cons) => {
    try {
      const r = await api.get(`/api/consultations/${cons._id}/sick-letter/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `surat-sakit-${cons._id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Surat sakit diunduh');
    } catch { toast.error('Gagal mengunduh surat sakit'); }
  };

  const handleDownloadPrescription = async (cons) => {
    try {
      const r = await api.get(`/api/consultations/${cons._id}/prescription/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const rxNum = cons.prescriptionData?.prescriptionNumber || cons._id;
      const a = document.createElement('a'); a.href = url; a.download = `resep-${rxNum}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Resep PDF diunduh');
    } catch { toast.error('Gagal mengunduh resep PDF'); }
  };

  const handleDownloadMedRecord = async (cons) => {
    try {
      const r = await api.get(`/api/consultations/${cons._id}/medical-record/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `rekam-medis-${cons._id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Rekam medis PDF diunduh');
    } catch { toast.error('Gagal mengunduh rekam medis'); }
  };

  const active = consultations.filter(c => ['pending_payment', 'waiting_verification', 'confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing'].includes(c.status));
  const needsAction = consultations.filter(c => ['cancelled_by_doctor', 'cancelled_by_admin', 'cancelled_by_user', 'doctor_no_show', 'refund_requested', 'refund_failed'].includes(c.status));
  const history = consultations.filter(c => ['completed', 'cancelled', 'expired', 'rejected_payment', 'no_show', 'refunded', 'cancelled_by_user', 'cancelled_by_admin', 'cancelled_by_doctor'].includes(c.status) && !needsAction.find(n => n._id === c._id));

  const s = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  return (
    <div style={{ ...s, minHeight: '100vh', background: '#ffffff', padding: '32px 16px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ color: '#111827', fontWeight: 800, marginBottom: 2 }}>Konsultasi Online</h4>
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Konsultasi dengan dokter berpengalaman dari rumah</p>
          </div>
          <div style={{ display: 'flex', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            {[['history', '📋 Riwayat'], ['new', '➕ Konsultasi Baru']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: view === v ? '#2563eb' : 'transparent',
                  color: view === v ? '#fff' : '#6b7280', transition: 'all 0.2s'
                }}>{label}</button>
            ))}
          </div>
        </div>

        {view === 'new' ? (
          <NewConsultationWizard onCreated={handleCreated} />
        ) : (
          <div>
            {/* Active */}
            {active.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h6 style={{ color: '#2563eb', fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>⚡ Aktif ({active.length})</h6>
                {active.map(cons => (
                  <ConsultationCard key={cons._id} cons={cons}
                    onPay={() => setPayModal({ consultation: cons, amount: cons.doctorId?.consultationFee, deadline: cons.paymentDeadline })}
                    onChat={() => navigate(`/consultations/${cons._id}`)}
                    onDownload={() => handleDownloadPDF(cons)}
                    onDownloadPrescription={() => handleDownloadPrescription(cons)}
                    onDownloadMedRecord={() => handleDownloadMedRecord(cons)}
                    onRate={() => setRatingModal({ id: cons._id, doctorName: cons.doctorId?.name })}
                    onRefund={() => setRefundModal(cons)}
                    onCancel={() => setCancelModal(cons)}
                    onReschedule={() => navigate(`/consultations/book/${cons.doctorId?._id || cons.doctorId}?rescheduleId=${cons._id}`)}
                  />
                ))}
              </div>
            )}

            {/* Perlu Tindakan (dibatalkan / refund) */}
            {needsAction.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h6 style={{ color: '#b91c1c', fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>⚠️ Perlu Tindakan ({needsAction.length})</h6>
                {needsAction.map(cons => (
                  <ConsultationCard key={cons._id} cons={cons}
                    onPay={() => {}}
                    onChat={() => navigate(`/consultations/${cons._id}`)}
                    onDownload={() => handleDownloadPDF(cons)}
                    onDownloadPrescription={() => handleDownloadPrescription(cons)}
                    onDownloadMedRecord={() => handleDownloadMedRecord(cons)}
                    onRate={() => setRatingModal({ id: cons._id, doctorName: cons.doctorId?.name })}
                    onRefund={() => setRefundModal(cons)}
                    onPostCancel={() => { setPostCancelModal(cons); setPostCancelChoice(null); setPostCancelBankCode(''); setPostCancelAccount(''); setPostCancelAccountName(''); }}
                  />
                ))}
              </div>
            )}

            {/* History */}
            <div>
              <h6 style={{ color: '#6b7280', fontWeight: 700, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
                📂 Riwayat ({history.length})
              </h6>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Memuat...</div>
              ) : history.length === 0 && active.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#6b7280', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
                  <div style={{ fontWeight: 600 }}>Belum ada konsultasi</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Mulai konsultasi pertama Anda</div>
                  <button onClick={() => setView('new')} style={{ marginTop: 16, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                    Mulai Sekarang
                  </button>
                </div>
              ) : (
                history.map(cons => (
                  <ConsultationCard key={cons._id} cons={cons}
                    onPay={() => {}}
                    onChat={() => navigate(`/consultations/${cons._id}`)}
                    onDownload={() => handleDownloadPDF(cons)}
                    onDownloadPrescription={() => handleDownloadPrescription(cons)}
                    onDownloadMedRecord={() => handleDownloadMedRecord(cons)}
                    onRate={() => setRatingModal({ id: cons._id, doctorName: cons.doctorId?.name })}
                    onRefund={() => setRefundModal(cons)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>💳 Pembayaran Konsultasi</span>
              <button onClick={() => setPayModal(null)} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <PaymentForm
                consultation={payModal.consultation}
                amount={payModal.amount}
                deadline={payModal.deadline}
                onSuccess={() => { fetchConsultations(); }}
                onClose={() => setPayModal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <RefundModal
          consultation={refundModal}
          onClose={() => setRefundModal(null)}
          onSuccess={fetchConsultations}
        />
      )}

      {/* Modal Konfirmasi Batalkan Konsultasi */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>❌ Batalkan Konsultasi</span>
              <button onClick={() => { setCancelModal(null); setNeedsBankInfo(false); setBankCode(''); setAccountNumber(''); setAccountName(''); }} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Perhatian</div>
              <div>Pembatalan akan memicu <strong>refund otomatis</strong> ke rekening Anda dalam <strong>1x24 jam</strong>.</div>
              <div style={{ marginTop: 4, color: '#991b1b' }}>Catatan: biaya layanan payment gateway tidak termasuk dalam refund.</div>
            </div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 16, lineHeight: 1.7 }}>
              <div>👨‍⚕️ <strong>Dokter:</strong> dr. {cancelModal.doctorId?.name}</div>
              <div>📅 <strong>Jadwal:</strong> {cancelModal.scheduledAt ? new Date(cancelModal.scheduledAt).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB' : '—'}</div>
            </div>

            {needsBankInfo && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                  💳 Masukkan data rekening untuk menerima refund
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>
                  Metode pembayaran yang digunakan tidak mendukung refund otomatis. Dana akan dikirim langsung ke rekening Anda dalam 1x24 jam.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Bank <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={bankCode} onChange={e => setBankCode(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                      <option value="">— Pilih Bank —</option>
                      {bankList.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nomor Rekening <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="mis. 1234567890" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nama Pemilik Rekening <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Sesuai nama di buku tabungan" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setCancelModal(null); setNeedsBankInfo(false); setBankCode(''); setAccountNumber(''); setAccountName(''); }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                Kembali
              </button>
              <button onClick={handleCancelConsultation} disabled={cancelling}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.6 : 1 }}>
                {cancelling ? 'Memproses...' : needsBankInfo ? 'Konfirmasi & Refund' : 'Ya, Batalkan & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Post-Cancel: Pilih Refund atau Reschedule (doctor_no_show / cancelled_by_doctor / cancelled_by_admin) */}
      {postCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                {postCancelModal.status === 'doctor_no_show' ? '😔 Dokter Tidak Hadir' : '🚫 Konsultasi Dibatalkan'}
              </span>
              <button onClick={() => setPostCancelModal(null)} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
              Konsultasi Anda dengan <strong>dr. {postCancelModal.doctorId?.name}</strong> tidak dapat dilanjutkan. Pilih tindakan selanjutnya:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <label style={{ border: `2px solid ${postCancelChoice === 'reschedule' ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: postCancelChoice === 'reschedule' ? '#eff6ff' : '#fff' }}>
                <input type="radio" value="reschedule" checked={postCancelChoice === 'reschedule'} onChange={() => setPostCancelChoice('reschedule')} style={{ marginRight: 8 }} />
                <strong style={{ color: '#111827' }}>🔄 Reschedule</strong>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 20px' }}>Pilih jadwal baru dengan dokter yang sama. Tidak dikenakan biaya tambahan.</p>
              </label>
              <label style={{ border: `2px solid ${postCancelChoice === 'refund' ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: postCancelChoice === 'refund' ? '#eff6ff' : '#fff' }}>
                <input type="radio" value="refund" checked={postCancelChoice === 'refund'} onChange={() => setPostCancelChoice('refund')} style={{ marginRight: 8 }} />
                <strong style={{ color: '#111827' }}>💰 Refund 100%</strong>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 20px' }}>Dana dikembalikan dalam 1x24 jam. Catatan: biaya payment gateway tidak termasuk dalam refund.</p>
              </label>
            </div>

            {postCancelChoice === 'refund' && (() => {
              const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
              const paidAt = postCancelModal.paidAt;
              const needsBank = !paidAt || (Date.now() - new Date(paidAt).getTime()) >= REFUND_WINDOW_MS;
              return needsBank ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 10 }}>💳 Masukkan data rekening untuk refund</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Bank <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={postCancelBankCode} onChange={e => setPostCancelBankCode(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                      <option value="">— Pilih Bank —</option>
                      {bankList.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nomor Rekening <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={postCancelAccount} onChange={e => setPostCancelAccount(e.target.value)} placeholder="mis. 1234567890" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nama Pemilik Rekening <span style={{ color: '#ef4444' }}>*</span></label>
                    <input value={postCancelAccountName} onChange={e => setPostCancelAccountName(e.target.value)} placeholder="Sesuai nama di buku tabungan" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
              ) : null;
            })()}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPostCancelModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                Nanti
              </button>
              <button onClick={handlePostCancelChoice} disabled={!postCancelChoice || postCancelProcessing}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: !postCancelChoice ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 700, cursor: !postCancelChoice ? 'not-allowed' : 'pointer', opacity: postCancelProcessing ? 0.6 : 1 }}>
                {postCancelProcessing ? 'Memproses...' : postCancelChoice === 'reschedule' ? 'Pilih Jadwal Baru →' : postCancelChoice === 'refund' ? 'Konfirmasi Refund' : 'Pilih Tindakan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <RatingModal
          consultationId={ratingModal.id}
          doctorName={ratingModal.doctorName}
          onClose={() => setRatingModal(null)}
          onSuccess={fetchConsultations}
        />
      )}
    </div>
  );
};

export default Consultations;