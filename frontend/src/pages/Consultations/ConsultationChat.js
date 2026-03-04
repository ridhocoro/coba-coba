import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import api, { API_URL } from '../../utils/api';

// ── Helpers ───────────────────────────────────────────────────────
const fmtTime = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const StatusBadge = ({ status }) => {
  const cfg = {
    paid:      { color: '#58a6ff', label: 'Dibayar' },
    scheduled: { color: '#a371f7', label: 'Terjadwal' },
    ongoing:   { color: '#3fb950', label: 'Berlangsung' },
    completed: { color: '#58a6ff', label: 'Selesai' },
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

// ── Prescription Modal ────────────────────────────────────────────
const PrescriptionModal = ({ value, onClose, onSave, isDoctor }) => {
  const [text, setText] = useState(value || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(text, diagnosis); setSaving(false); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 500, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e6edf3', fontWeight: 700 }}>💊 {isDoctor ? 'Tulis Resep Digital' : 'Resep Dokter'}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {isDoctor ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 6 }}>Diagnosis</label>
                <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Contoh: ISPA, Demam akut..."
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 6 }}>Resep</label>
                <textarea value={text} rows={6} onChange={e => setText(e.target.value)}
                  placeholder={"Contoh:\n1. Paracetamol 500mg — 3×1 sehari\n2. Vitamin C — 1×1"}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleSave} disabled={!text.trim() || saving}
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!text.trim() || saving) ? 0.5 : 1 }}>
                  {saving ? 'Menyimpan...' : '✓ Kirim Resep'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ background: '#161b22', borderRadius: 10, padding: 16, whiteSpace: 'pre-wrap', color: '#3fb950', fontFamily: 'monospace', fontSize: 14 }}>
              {value || 'Belum ada resep'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sick Letter Modal ─────────────────────────────────────────────
const SickLetterModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ diagnosis: '', restDays: 3, notes: '' });
  const [saving, setSaving] = useState(false);
  const handleSave = async (e) => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 440 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e6edf3', fontWeight: 700 }}>📋 Buat Surat Sakit</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={handleSave} style={{ padding: 20 }}>
          {[
            { key: 'diagnosis', label: 'Diagnosis *', type: 'textarea', placeholder: 'Contoh: Demam akut, ISPA...' },
            { key: 'restDays', label: 'Hari Istirahat *', type: 'number', placeholder: '3' },
            { key: 'notes', label: 'Catatan', type: 'textarea', placeholder: 'Anjuran / larangan (opsional)' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 6 }}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea value={form[f.key]} rows={2} required={f.label.includes('*')}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14, resize: 'vertical' }} />
              ) : (
                <input type={f.type} value={form[f.key]} min={1} max={30} required
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#e6edf3', fontSize: 14 }} />
              )}
            </div>
          ))}
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

// ══════════════════════════════════════════════════════════════════
// MAIN CONSULTATION CHAT
// ══════════════════════════════════════════════════════════════════
const ConsultationChat = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [typing, setTyping] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showSickLetter, setShowSickLetter] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);

  const msgEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  // Ref untuk melacak message ID lokal agar tidak duplikat dengan socket
  const pendingMsgIds = useRef(new Set());

  const isDoctor = user?.role === 'doctor';
  const isUser = user?.role === 'user';
  const isOngoing = consultation?.status === 'ongoing';
  const isCompleted = consultation?.status === 'completed';
  const myId = user?.id || user?._id;

  const fetchConsultation = useCallback(async () => {
    try {
      const r = await api.get(`/api/consultations/${id}`);
      setConsultation(r.data);
      setMessages(r.data.messages || []);
    } catch {
      toast.error('Gagal memuat konsultasi');
      navigate(user?.role === 'doctor' ? '/doctor/consultations' : '/consultations');
    } finally { setLoading(false); }
  }, [id, navigate, user?.role]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchConsultation();
  }, [user, fetchConsultation, navigate]);

  // ── Setup Socket ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id }
    });
    setSocket(sock);
    return () => sock.close();
  }, [user]);

  // ── Socket event listeners ────────────────────────────────────
  useEffect(() => {
    if (!socket || !consultation) return;
    socket.emit('join-consultation', consultation._id);

    const onReceive = (msg) => {
      // Jika pesan ini adalah echo dari pesan kita sendiri yang sedang pending → abaikan
      // (pengirim sudah dapat optimistic update)
      if (msg.senderId?.toString() === myId?.toString()) return;

      setMessages(prev => [...prev, msg]);
    };

    socket.on('receive-message', onReceive);
    socket.on('user-typing', () => { setTyping(true); setTimeout(() => setTyping(false), 3000); });
    socket.on('user-stop-typing', () => setTyping(false));
    socket.on('prescription-update', (data) => {
      setConsultation(c => ({ ...c, prescription: data.prescription, diagnosis: data.diagnosis }));
      toast.success('Dokter mengirimkan resep!');
    });

    return () => {
      socket.off('receive-message', onReceive);
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('prescription-update');
    };
  }, [socket, consultation, myId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // ── Kirim pesan teks ──────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isOngoing || sending) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Buat ID lokal sementara untuk optimistic update
    const localId = `local-${Date.now()}-${Math.random()}`;

    // Optimistic update — tampilkan langsung di UI pengirim
    const optimistic = {
      _localId: localId,
      senderId: myId,
      senderName: isDoctor ? `dr. ${user.name}` : user.name,
      senderRole: user.role,
      message: text,
      timestamp: new Date(),
      _pending: true
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      // Simpan ke DB via REST
      const res = await api.post(`/api/consultations/${id}/messages`, { message: text });
      const savedMsg = res.data.message;

      // Ganti optimistic dengan pesan tersimpan (punya _id valid dari DB)
      setMessages(prev => prev.map(m =>
        m._localId === localId ? { ...savedMsg, _pending: false } : m
      ));

      // Broadcast ke pihak lain via socket — socket.to() di server hanya kirim ke pihak lain
      socket?.emit('send-message', {
        consultationId: id,
        _id: savedMsg._id,
        senderId: myId,
        senderName: isDoctor ? `dr. ${user.name}` : user.name,
        senderRole: user.role,
        message: text,
        timestamp: savedMsg.timestamp || new Date()
      });

    } catch {
      // Rollback optimistic jika gagal
      setMessages(prev => prev.filter(m => m._localId !== localId));
      setNewMessage(text); // kembalikan teks
      toast.error('Gagal kirim pesan');
    } finally {
      setSending(false);
    }
  };

  // ── Upload gambar ─────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Maks 5MB'); return; }
    setUploadingImg(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      // REST upload sekaligus emit socket (backend emit ke semua di room via io.to)
      const r = await api.post(`/api/consultations/${id}/messages/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Backend sudah emit socket untuk gambar, cukup update state lokal
      const savedMsg = r.data.message;
      setMessages(prev => [...prev, savedMsg]);
    } catch { toast.error('Gagal upload gambar'); }
    finally { setUploadingImg(false); e.target.value = ''; }
  };

  // ── Typing indicator ──────────────────────────────────────────
  const handleTyping = () => {
    socket?.emit('typing', { consultationId: id, senderId: myId, senderName: user.name });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket?.emit('stop-typing', { consultationId: id, senderId: myId });
    }, 1200);
  };

  // ── Dokter: mulai / akhiri ────────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    try {
      await api.put(`/api/consultations/${id}/start`);
      toast.success('Konsultasi dimulai!');
      fetchConsultation();
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal memulai'); }
    finally { setStarting(false); }
  };

  const handleEnd = async () => {
    if (!window.confirm('Akhiri konsultasi ini?')) return;
    setEnding(true);
    try {
      await api.put(`/api/consultations/${id}/end`);
      toast.success('Konsultasi selesai');
      fetchConsultation();
      if (isUser) setShowRating(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal mengakhiri'); }
    finally { setEnding(false); }
  };

  const handleSendPrescription = async (prescription, diagnosis) => {
    try {
      await api.put(`/api/consultations/${id}/prescription`, { prescription, diagnosis });
      setConsultation(c => ({ ...c, prescription, diagnosis }));
      toast.success('Resep dikirim!');
      setShowPrescription(false);
    } catch { toast.error('Gagal kirim resep'); }
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

  const downloadPDF = async () => {
    try {
      const r = await api.get(`/api/consultations/${id}/sick-letter/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `surat-sakit-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error('Gagal unduh PDF'); }
  };

  // ── Styles ─────────────────────────────────────────────────────
  const s = {
    root: { display: 'flex', height: 'calc(100vh - 56px)', background: '#0d1117', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' },
    sidebar: { width: 280, borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column', background: '#0d1117', flexShrink: 0, overflowY: 'auto' },
    chat: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    header: { padding: '12px 16px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: 12, background: '#161b22', flexShrink: 0 },
    msgArea: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
    footer: { padding: '12px 16px', borderTop: '1px solid #21262d', background: '#161b22', flexShrink: 0 },
    sideSection: { padding: '14px 16px', borderBottom: '1px solid #21262d' },
    label: { color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'block' },
    actionBtn: (color = '#1f6feb') => ({ width: '100%', padding: '9px 14px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }),
    ghostBtn: { width: '100%', padding: '9px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13, marginBottom: 8 },
  };

  if (loading) return (
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
        <button onClick={() => navigate(user?.role === 'doctor' ? '/doctor/consultations' : '/consultations')}
          style={{ marginTop: 16, padding: '8px 20px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Kembali
        </button>
      </div>
    </div>
  );

  const doc = consultation.doctorId;
  const sickLetter = consultation.sickLetter;
  // Label tipe konsultasi (tidak ada voice_call)
  const typeLabel = consultation.consultationType === 'chat' ? '💬 Chat' : '📹 Video Call';

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
                <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>dr. {doc?.name}</div>
                <div style={{ color: '#58a6ff', fontSize: 12 }}>{doc?.specialization}</div>
              </div>
            </div>
            <StatusBadge status={consultation.status} />
          </div>

          <div style={s.sideSection}>
            <span style={s.label}>Info Konsultasi</span>
            {[
              ['Tipe', typeLabel],
              ['Jadwal', consultation.scheduleType === 'instant' ? '⚡ Langsung' : '📅 Terjadwal'],
              ...(consultation.scheduledAt ? [['Waktu', new Date(consultation.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })]] : []),
              ['Dibuat', new Date(consultation.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#8b949e', fontSize: 12 }}>{k}</span>
                <span style={{ color: '#c9d1d9', fontSize: 12, textAlign: 'right', maxWidth: 140 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={s.sideSection}>
            <span style={s.label}>Keluhan Pasien</span>
            <div style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.5 }}>{consultation.symptoms}</div>
            {consultation.medicalHistory && (
              <>
                <span style={{ ...s.label, marginTop: 8 }}>Riwayat Penyakit</span>
                <div style={{ color: '#c9d1d9', fontSize: 13, lineHeight: 1.5 }}>{consultation.medicalHistory}</div>
              </>
            )}
          </div>

          {/* Dokter Actions */}
          {isDoctor && (
            <div style={s.sideSection}>
              <span style={s.label}>Tindakan Dokter</span>
              {['paid', 'scheduled'].includes(consultation.status) && (
                <button onClick={handleStart} disabled={starting} style={s.actionBtn('#1a7f37')}>
                  ▶ {starting ? 'Memulai...' : 'Mulai Konsultasi'}
                </button>
              )}
              {isOngoing && (
                <>
                  <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1f6feb')}>💊 Tulis Resep</button>
                  {!sickLetter && (
                    <button onClick={() => setShowSickLetter(true)} style={s.actionBtn('#854d0e')}>📋 Buat Surat Sakit</button>
                  )}
                  {sickLetter?.status === 'draft' && (
                    <button onClick={handleIssueSickLetter} style={s.actionBtn('#d97706')}>✓ Terbitkan Surat Sakit</button>
                  )}
                  <button onClick={handleEnd} disabled={ending}
                    style={{ ...s.actionBtn('#c0392b'), background: 'transparent', border: '1px solid #f8514940', color: '#f85149' }}>
                    ■ {ending ? 'Mengakhiri...' : 'Akhiri Sesi'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* User Actions */}
          {isUser && (
            <div style={s.sideSection}>
              <span style={s.label}>Aksi</span>
              {consultation.prescription && (
                <button onClick={() => setShowPrescription(true)} style={s.actionBtn('#1a7f37')}>💊 Lihat Resep Dokter</button>
              )}
              {sickLetter?.status === 'issued' && (
                <button onClick={downloadPDF} style={s.actionBtn('#854d0e')}>📄 Unduh Surat Sakit</button>
              )}
              {isCompleted && !consultation.rating && (
                <button onClick={() => setShowRating(true)} style={s.actionBtn('#ca8a04')}>⭐ Beri Rating</button>
              )}
              {consultation.rating && (
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#8b949e' }}>
                  Rating Anda: {'⭐'.repeat(consultation.rating)}
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
              </div>
            </div>
          )}
        </div>

        {/* ── Chat Area ────────────────────────────────────────── */}
        <div style={s.chat}>
          <div style={s.header}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👨‍⚕️</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>dr. {doc?.name}</div>
              <div style={{ color: '#8b949e', fontSize: 12 }}>{doc?.specialization}</div>
            </div>
            <StatusBadge status={consultation.status} />
          </div>

          {consultation._accessRestricted ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
              <div style={{ fontWeight: 600, color: '#e6edf3' }}>Akses Terbatas</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Chat hanya tersedia setelah pembayaran dikonfirmasi</div>
            </div>
          ) : (
            <div style={s.msgArea}>
              {/* Keluhan Banner */}
              <div style={{ background: '#161b22', border: '1px solid #1f6feb40', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
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
                      transition: 'opacity 0.2s'
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
                      <div style={{ color: isMine ? 'rgba(255,255,255,0.5)' : '#8b949e', fontSize: 10, marginTop: 4, textAlign: 'right' }}>
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
          )}

          {isCompleted && !consultation._accessRestricted && (
            <div style={{ padding: '12px 16px', background: '#0a3d1e', borderTop: '1px solid #2ea04330', textAlign: 'center', color: '#3fb950', fontSize: 13, fontWeight: 600 }}>
              ✅ Konsultasi selesai pada {fmtDate(consultation.endTime)}
              {isUser && !consultation.rating && (
                <button onClick={() => setShowRating(true)}
                  style={{ marginLeft: 12, padding: '4px 14px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ⭐ Beri Rating
                </button>
              )}
            </div>
          )}

          {isOngoing && !consultation._accessRestricted && (
            <div style={s.footer}>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: '#21262d', border: 'none', color: uploadingImg ? '#3fb950' : '#8b949e', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {uploadingImg ? '⏳' : '📎'}
                </button>
                <input value={newMessage}
                  onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                  placeholder="Ketik pesan... (Enter untuk kirim)"
                  style={{ flex: 1, background: '#21262d', border: 'none', borderRadius: 20, padding: '9px 16px', color: '#e6edf3', fontSize: 14, outline: 'none' }} />
                <button type="submit" disabled={!newMessage.trim() || sending}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: newMessage.trim() && !sending ? '#1f6feb' : '#21262d', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sending ? '⏳' : '➤'}
                </button>
              </form>
            </div>
          )}

          {!isOngoing && !isCompleted && !consultation._accessRestricted && (
            <div style={{ padding: '20px', textAlign: 'center', borderTop: '1px solid #21262d', color: '#8b949e', fontSize: 13 }}>
              {consultation.status === 'paid' && isDoctor && '⏳ Klik "Mulai Konsultasi" di sidebar untuk memulai sesi'}
              {consultation.status === 'scheduled' && isDoctor && '📅 Mulai konsultasi saat jadwal tiba'}
              {['paid', 'scheduled'].includes(consultation.status) && isUser && '⏳ Menunggu dokter memulai sesi...'}
            </div>
          )}
        </div>
      </div>

      {showPrescription && <PrescriptionModal value={consultation.prescription} isDoctor={isDoctor} onClose={() => setShowPrescription(false)} onSave={handleSendPrescription} />}
      {showSickLetter && <SickLetterModal onClose={() => setShowSickLetter(false)} onSave={handleCreateSickLetter} />}
      {showRating && <RatingModal consultationId={id} onClose={() => setShowRating(false)} onSuccess={fetchConsultation} />}

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </>
  );
};

export default ConsultationChat;
