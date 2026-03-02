import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
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
    paid:               { color: '#1d4ed8', bg: '#eff6ff', label: 'Dibayar' },
    scheduled:          { color: '#7e22ce', bg: '#f5f3ff', label: 'Terjadwal' },
    ongoing:            { color: '#15803d', bg: '#f0fdf4', label: 'Berlangsung' },
    completed:          { color: '#1d4ed8', bg: '#eff6ff', label: 'Selesai' },
    cancelled:          { color: '#b91c1c', bg: '#fef2f2', label: 'Dibatalkan' },
    expired:            { color: '#6b7280', bg: '#f3f4f6', label: 'Kadaluarsa' },
    rejected_payment:   { color: '#b91c1c', bg: '#fef2f2', label: 'Pembayaran Ditolak' },
    no_show:            { color: '#b45309', bg: '#fffbeb', label: 'Tidak Hadir' },
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

// ── Manual Payment Form ───────────────────────────────────────────
const PaymentForm = ({ consultation, amount, deadline, onSuccess, onClose }) => {
  const [step, setStep] = useState(1);
  const [banks, setBanks] = useState([]);
  const [qris, setQris] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    api.get('/api/manual-payment/bank-accounts').then(r => {
      setBanks(r.data.banks || []);
      setQris(r.data.qris?.[0] || null);
    }).catch(() => toast.error('Gagal memuat rekening'));
  }, []);

  const createTrx = async (bankId) => {
    setLoading(true);
    try {
      const r = await api.post('/api/manual-payment/create', {
        amount, paymentType: 'consultation', referenceId: consultation._id, bankId
      });
      setTransaction(r.data.transaction);
      setSelectedBank(r.data.transaction.isQRIS
        ? { bankName: 'QRIS', accountName: 'Klinik Pratama IPB', isQRIS: true }
        : banks.find(b => b.id === bankId));
      setStep(2);
    } catch { toast.error('Gagal membuat transaksi'); }
    finally { setLoading(false); }
  };

  const uploadProof = async () => {
    if (!file || !transferDate) { toast.error('Lengkapi semua field'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('proof', file);
    fd.append('transferDate', transferDate);
    try {
      await api.post(`/api/manual-payment/upload-proof/${transaction.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Bukti transfer terkirim! Menunggu verifikasi admin.');
      setStep(3);
      onSuccess();
    } catch { toast.error('Gagal upload bukti'); }
    finally { setUploading(false); }
  };

  const s = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  if (step === 1) return (
    <div style={s} className="p-2">
      {deadline && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Selesaikan pembayaran dalam</div>
          <Countdown deadline={deadline} />
        </div>
      )}
      <h6 style={{ color: '#111827', fontWeight: 700, marginBottom: 16 }}>Pilih Metode Pembayaran</h6>
      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {banks.map(bank => (
          <div key={bank.id} onClick={() => setSelectedBank({ ...bank, isQRIS: false })}
            style={{
              border: `2px solid ${selectedBank?.id === bank.id && !selectedBank?.isQRIS ? '#2563eb' : '#e5e7eb'}`,
              borderRadius: 12, padding: '12px 16px', cursor: 'pointer', background: '#ffffff',
              display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s'
            }}>
            <span style={{ fontSize: 28 }}>🏦</span>
            <div>
              <div style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>{bank.bankName}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>a.n. {bank.accountName}</div>
            </div>
          </div>
        ))}
        {qris && (
          <div onClick={() => setSelectedBank({ id: 999, bankName: 'QRIS', accountName: qris.merchantName, isQRIS: true, qrCode: qris.qrCode })}
            style={{
              border: `2px solid ${selectedBank?.isQRIS ? '#16a34a' : '#e5e7eb'}`,
              borderRadius: 12, padding: '12px 16px', cursor: 'pointer', background: '#ffffff',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
            <span style={{ fontSize: 28 }}>📱</span>
            <div>
              <div style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>QRIS</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>OVO · GoPay · Dana · ShopeePay</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: 12 }}>Total Pembayaran</div>
        <div style={{ color: '#2563eb', fontWeight: 800, fontSize: 22 }}>{fmtRupiah(amount)}</div>
      </div>
      <button onClick={() => selectedBank && createTrx(selectedBank.id)}
        disabled={!selectedBank || loading}
        style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontWeight: 700,
          background: selectedBank ? 'linear-gradient(135deg,#2563eb,#3b82f6)' : '#e5e7eb',
          color: selectedBank ? '#fff' : '#9ca3af', cursor: selectedBank ? 'pointer' : 'not-allowed', fontSize: 15
        }}>
        {loading ? 'Memproses...' : 'Lanjutkan →'}
      </button>
      <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
        Batal
      </button>
    </div>
  );

  if (step === 2) return (
    <div style={s} className="p-2">
      {deadline && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Sisa waktu pembayaran</div>
          <Countdown deadline={deadline} />
        </div>
      )}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Detail Transfer</div>
        {transaction?.bank?.accountNumber && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#6b7280', fontSize: 12 }}>No. Rekening: </span>
            <span style={{ color: '#111827', fontWeight: 700, fontFamily: 'monospace' }}>{transaction.bank.accountNumber}</span>
            <button onClick={() => { navigator.clipboard.writeText(transaction.bank.accountNumber); toast.success('Disalin!'); }}
              style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12 }}>salin</button>
          </div>
        )}
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Bank: </span>
          <span style={{ color: '#111827', fontWeight: 600 }}>{selectedBank?.bankName}</span>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Nominal: </span>
          <span style={{ color: '#2563eb', fontWeight: 800, fontSize: 18 }}>{fmtRupiah(amount)}</span>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>Tanggal Transfer</label>
        <input type="date" value={transferDate} max={new Date().toISOString().split('T')[0]}
          onChange={e => setTransferDate(e.target.value)}
          style={{ width: '100%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', color: '#111827', fontSize: 14 }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>Bukti Transfer</label>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: '#ffffff', border: '1px dashed #e5e7eb', borderRadius: 8, cursor: 'pointer'
        }}>
          <FaImage style={{ color: '#2563eb' }} />
          <span style={{ color: file ? '#16a34a' : '#6b7280', fontSize: 13 }}>
            {file ? file.name : 'Klik untuk pilih file (JPG/PNG/PDF, maks 5MB)'}
          </span>
          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files[0];
              if (f && f.size > 5 * 1024 * 1024) { toast.error('Maks 5MB'); return; }
              setFile(f);
            }} />
        </label>
      </div>
      <button onClick={uploadProof} disabled={!file || !transferDate || uploading}
        style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontWeight: 700,
          background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', cursor: 'pointer', fontSize: 15,
          opacity: (!file || !transferDate || uploading) ? 0.5 : 1
        }}>
        {uploading ? 'Mengupload...' : '✓ Upload & Konfirmasi'}
      </button>
      <button onClick={() => setStep(1)} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
        ← Kembali
      </button>
    </div>
  );

  return (
    <div style={{ ...s, textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <div style={{ color: '#16a34a', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Bukti Terkirim!</div>
      <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        Pembayaran Anda sedang diverifikasi admin.<br />Proses maksimal 1×24 jam.
      </div>
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        ID: <code style={{ color: '#2563eb' }}>{transaction?.id}</code>
      </div>
      <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        Tutup
      </button>
    </div>
  );
};

// ── Multi-step Form ───────────────────────────────────────────────
const STEPS = ['Pilih Dokter', 'Tipe Konsultasi', 'Keluhan', 'Jadwal'];

const NewConsultationWizard = ({ onCreated }) => {
  const [step, setStep] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [form, setForm] = useState({
    doctorId: '', consultationType: 'chat', scheduleType: 'instant',
    scheduledAt: '', symptoms: '', medicalHistory: '', attachments: []
  });
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/doctors').then(r => setDoctors(r.data || [])).catch(() => {}).finally(() => setLoadingDoctors(false));
  }, []);

  const selectedDoctor = doctors.find(d => d._id === form.doctorId);
  const specializations = [...new Set(doctors.map(d => d.specialization))].sort();
  const filteredDoctors = doctors.filter(d => {
    const q = search.toLowerCase();
    return (!search || d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q))
      && (!filterSpec || d.specialization === filterSpec);
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('doctorId', form.doctorId);
      fd.append('consultationType', form.consultationType);
      fd.append('scheduleType', form.scheduleType);
      if (form.scheduleType === 'scheduled') fd.append('scheduledAt', form.scheduledAt);
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
    if (step === 1) return !!form.consultationType;
    if (step === 2) return form.symptoms.trim().length > 5;
    if (step === 3) return form.scheduleType === 'instant' || !!form.scheduledAt;
    return true;
  };

  const s = {
    card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    h: { color: '#111827', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontWeight: 700 },
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
                <div key={doc._id} onClick={() => setForm(f => ({ ...f, doctorId: doc._id }))}
                  style={{
                    border: `2px solid ${form.doctorId === doc._id ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', background: '#ffffff',
                    display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s',
                    boxShadow: form.doctorId === doc._id ? '0 0 0 2px #2563eb40' : 'none'
                  }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {doc.photo ? <img src={`${API_URL}${doc.photo}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : '👨‍⚕️'}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                      <FaCircle style={{ fontSize: 7, color: doc.isOnline ? '#16a34a' : '#9ca3af' }} />
                      <span style={{ fontSize: 11, color: doc.isOnline ? '#16a34a' : '#9ca3af' }}>
                        {doc.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
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
              { val: 'chat', icon: '💬', label: 'Chat', desc: 'Konsultasi via pesan teks & foto' },
              { val: 'voice_call', icon: '📞', label: 'Voice Call', desc: 'Konsultasi via panggilan suara' },
              { val: 'video_call', icon: '📹', label: 'Video Call', desc: 'Konsultasi tatap muka virtual' },
            ].map(opt => (
              <div key={opt.val} onClick={() => setForm(f => ({ ...f, consultationType: opt.val }))}
                style={{
                  border: `2px solid ${form.consultationType === opt.val ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 12, padding: '14px 18px', cursor: 'pointer', background: '#ffffff',
                  display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s'
                }}>
                <span style={{ fontSize: 32 }}>{opt.icon}</span>
                <div>
                  <div style={{ color: '#111827', fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{opt.desc}</div>
                </div>
                {form.consultationType === opt.val && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 20 }}>✓</span>}
              </div>
            ))}
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
            {form.attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {form.attachments.map((f, i) => (
                  <span key={i} style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Jadwal */}
      {step === 3 && (
        <div>
          <h6 style={s.h}>Pilih Jadwal</h6>
          <p style={s.sub}>Tentukan kapan konsultasi akan berlangsung</p>
          <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
            {[
              { val: 'instant', icon: '⚡', label: 'Langsung (Instant)', desc: 'Konsultasi dimulai segera setelah pembayaran dikonfirmasi admin' },
              { val: 'scheduled', icon: '📅', label: 'Terjadwal', desc: 'Tentukan waktu konsultasi, dokter dikonfirmasi oleh admin' },
            ].map(opt => (
              <div key={opt.val} onClick={() => setForm(f => ({ ...f, scheduleType: opt.val }))}
                style={{
                  border: `2px solid ${form.scheduleType === opt.val ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 12, padding: '14px 18px', cursor: 'pointer', background: '#ffffff',
                  display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'all 0.15s'
                }}>
                <span style={{ fontSize: 28, marginTop: 2 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#111827', fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{opt.desc}</div>
                </div>
                {form.scheduleType === opt.val && <span style={{ color: '#3b82f6', fontSize: 20 }}>✓</span>}
              </div>
            ))}
          </div>
          {form.scheduleType === 'scheduled' && (
            <div>
              <label style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6 }}>
                Pilih Tanggal & Waktu <span style={{ color: '#b91c1c' }}>*</span>
              </label>
              <input type="datetime-local" value={form.scheduledAt}
                min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                style={s.inp} />
            </div>
          )}
          {/* Summary */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginTop: 20 }}>
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>RINGKASAN</div>
            {[
              ['Dokter', `dr. ${selectedDoctor?.name} (${selectedDoctor?.specialization})`],
              ['Tipe', form.consultationType === 'chat' ? 'Chat' : form.consultationType === 'voice_call' ? 'Voice Call' : 'Video Call'],
              ['Jadwal', form.scheduleType === 'instant' ? 'Langsung' : fmtDateTime(form.scheduledAt)],
              ['Biaya', fmtRupiah(selectedDoctor?.consultationFee)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{k}</span>
                <span style={{ color: '#111827', fontSize: 13, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
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

// ── History Card ──────────────────────────────────────────────────
const ConsultationCard = ({ cons, onPay, onChat, onDownload, onRate }) => {
  const [expanded, setExpanded] = useState(false);
  const needsPay = cons.status === 'pending_payment';
  const canChat = ['paid', 'scheduled', 'ongoing'].includes(cons.status);
  const isCompleted = cons.status === 'completed';
  const hasSickLetter = cons.sickLetter?.status === 'issued';

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
                  {cons.consultationType === 'chat' ? '💬 Chat' : cons.consultationType === 'voice_call' ? '📞 Suara' : '📹 Video'}
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
          {isCompleted && !cons.rating && (
            <button onClick={onRate}
              style={{ background: 'linear-gradient(135deg,#854d0e,#ca8a04)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              ⭐ Beri Rating
            </button>
          )}
          {hasSickLetter && (
            <button onClick={onDownload}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              📄 Unduh Surat Sakit
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px', background: '#fafafa' }}>
          {cons.symptoms && <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Keluhan: </span><span style={{ color: '#111827', fontSize: 13 }}>{cons.symptoms}</span></div>}
          {cons.medicalHistory && <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Riwayat: </span><span style={{ color: '#111827', fontSize: 13 }}>{cons.medicalHistory}</span></div>}
          {cons.prescription && <div style={{ marginBottom: 8 }}><span style={{ color: '#6b7280', fontSize: 12 }}>Resep: </span><span style={{ color: '#16a34a', fontSize: 13 }}>{cons.prescription}</span></div>}
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
  const [payModal, setPayModal] = useState(null); // { consultation, amount }
  const [ratingModal, setRatingModal] = useState(null); // { id, doctorName }

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/consultations/my-consultations');
      setConsultations(r.data || []);
    } catch { toast.error('Gagal memuat konsultasi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchConsultations();
  }, [user, fetchConsultations, navigate]);

  const handleCreated = (data) => {
    setView('history');
    setPayModal({ consultation: data.consultation, amount: data.amount, deadline: data.paymentDeadline });
    fetchConsultations();
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

  const active = consultations.filter(c => ['pending_payment', 'paid', 'scheduled', 'ongoing'].includes(c.status));
  const history = consultations.filter(c => ['completed', 'cancelled', 'expired', 'rejected_payment', 'no_show'].includes(c.status));

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
                    onRate={() => setRatingModal({ id: cons._id, doctorName: cons.doctorId?.name })}
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
                    onRate={() => setRatingModal({ id: cons._id, doctorName: cons.doctorId?.name })}
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