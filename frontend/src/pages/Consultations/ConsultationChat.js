import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import api, { API_URL } from '../../utils/api';

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
const PrescriptionModal = ({ value, onClose, onSave, isDoctor }) => {
  const [text, setText] = useState(value || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(text, diagnosis); setSaving(false); };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 16, width: '100%', maxWidth: 500 }}>
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
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        setCallState('ended');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [consultationId, socket]);

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

    return () => {
      socket.off('vc-offer',         onOffer);
      socket.off('vc-answer',        onAnswer);
      socket.off('vc-ice-candidate', onIce);
      socket.off('vc-end',           onEnd);
    };
  }, [socket, isDoctor, answerCall, cleanup, onClose]);

  // Dokter langsung start call saat komponen mount — useRef agar hanya sekali
  const hasCalledRef = useRef(false);
  useEffect(() => {
    if (isDoctor && !hasCalledRef.current) {
      hasCalledRef.current = true;
      startCall();
    }
  }, [isDoctor, startCall]);

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

// ══════════════════════════════════════════════════════════════════
// MAIN CONSULTATION CHAT
// ══════════════════════════════════════════════════════════════════
const ConsultationChat = () => {
  const { id } = useParams();
  const { user } = useAuth();
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
  const [incomingCall,     setIncomingCall]      = useState(null); // { offer }
  const [uploadingImg, setUploadingImg] = useState(false);
  const [ending,   setEnding]   = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending,  setSending]  = useState(false);

  const msgEndRef     = useRef(null);
  const fileInputRef  = useRef(null);
  const typingTimerRef = useRef(null);
  const pendingMsgIds  = useRef(new Set());

  const isDoctor = user?.role === 'doctor';
  const isUser   = user?.role === 'user';
  const myId     = user?.id || user?._id;

  // ── Access rules ──────────────────────────────────────────────
  // User: chat hanya saat in_progress/ongoing
  // Dokter: bisa lihat semua info kapan saja, chat hanya saat in_progress/ongoing
  const isLive      = ['in_progress', 'ongoing'].includes(consultation?.status);
  const isConfirmed = consultation?.status === 'confirmed';
  const isCompleted = ['completed', 'no_show'].includes(consultation?.status);

  // Dokter: bisa akses room kecuali saat pending_payment/expired
  // User: hanya saat confirmed/live dan waktu sudah tiba
  const DOCTOR_BLOCKED = ['pending_payment', 'expired', 'cancelled', 'cancelled_by_doctor'];
  const timeHasArrived = consultation?.scheduledAt
    ? msUntil(consultation.scheduledAt) <= 0
    : true;
  const canAccessRoom = isDoctor
    ? !DOCTOR_BLOCKED.includes(consultation?.status)
    : (isConfirmed || isLive) && timeHasArrived;

  // Bisa chat hanya saat live: dokter kapan saja, user perlu waktu sudah tiba
  const canChat = isLive && (isDoctor || timeHasArrived);

  const isVideoCall = consultation?.consultationType === 'video_call';

  const fetchConsultation = useCallback(async () => {
    try {
      const r = await api.get(`/api/consultations/${id}`);
      setConsultation(r.data);
      setMessages(r.data.messages || []);
    } catch {
      toast.error('Gagal memuat konsultasi');
      navigate(isDoctor ? '/doctor/consultations' : '/consultations');
    } finally { setLoading(false); }
  }, [id, navigate, isDoctor]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchConsultation();
  }, [user, fetchConsultation, navigate]);

  // ── Setup Socket ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id },
    });
    setSocket(sock);
    return () => sock.close();
  }, [user]);

  // ── Socket listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!socket || !consultation) return;
    socket.emit('join-consultation', consultation._id);

    const onReceive = (msg) => {
      if (msg.senderId?.toString() === myId?.toString()) return;
      setMessages(prev => [...prev, msg]);
    };
    const onPrescription = (data) => {
      setConsultation(c => ({ ...c, prescription: data.prescription, diagnosis: data.diagnosis }));
      toast.success('Dokter mengirimkan resep!');
    };
    // Incoming video call (user side)
    const onVcOffer = ({ offer }) => {
      if (!isDoctor) setIncomingCall({ offer });
    };
    // Status update (e.g. cron auto-started)
    const onStatusUpdate = ({ consultationId, status }) => {
      if (consultationId === consultation._id?.toString()) {
        setConsultation(c => ({ ...c, status }));
        if (status === 'in_progress') toast.success('Sesi konsultasi dimulai!');
      }
    };

    socket.on('receive-message',          onReceive);
    socket.on('user-typing',              () => { setTyping(true); setTimeout(() => setTyping(false), 3000); });
    socket.on('user-stop-typing',         () => setTyping(false));
    socket.on('prescription-update',      onPrescription);
    socket.on('vc-offer',                 onVcOffer);
    socket.on('consultation-status-update', onStatusUpdate);

    return () => {
      socket.off('receive-message',          onReceive);
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('prescription-update',      onPrescription);
      socket.off('vc-offer',                 onVcOffer);
      socket.off('consultation-status-update', onStatusUpdate);
    };
  }, [socket, consultation, myId, isDoctor]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !canChat || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    const localId = `local-${Date.now()}-${Math.random()}`;
    const optimistic = { _localId: localId, senderId: myId, senderName: isDoctor ? `dr. ${user.name}` : user.name, senderRole: user.role, message: text, timestamp: new Date(), _pending: true };
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
  // User confirmed tapi belum waktunya — tampilkan halaman tunggu
  if (isUser && isConfirmed && !timeHasArrived) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ ...s.root, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0 }}>
          <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Ruang Konsultasi Belum Terbuka</div>
            <div style={{ color: '#8b949e', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Konsultasi Anda terkonfirmasi. Ruang chat akan terbuka otomatis saat waktu yang dijadwalkan tiba.
            </div>

            {/* Countdown card */}
            <div style={{ background: '#161b22', border: '1px solid #1f6feb40', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>Jadwal Konsultasi</div>
              <div style={{ color: '#58a6ff', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
                {fmtDT(consultation.scheduledAt)}
              </div>
              <CountdownBanner scheduledAt={consultation.scheduledAt} />
            </div>

            {/* Info */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>👨‍⚕️</span>
                <div>
                  <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>dr. {doc?.name}</div>
                  <div style={{ color: '#58a6ff', fontSize: 11 }}>{doc?.specialization}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <StatusBadge status={consultation.status} />
                <span style={{ background: '#21262d', color: '#8b949e', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{typeLabel}</span>
              </div>
            </div>

            <button onClick={() => navigate('/consultations')}
              style={{ padding: '10px 24px', background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              ← Kembali ke Konsultasi
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── User dengan status yang tidak relevan ───────────────────────
  if (isUser && !canAccessRoom && !isCompleted) {
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

  // ── Incoming call notification (user) ──────────────────────────
  const IncomingCallBanner = () => incomingCall && !showVideoCall ? (
    <div style={{ position: 'fixed', top: 80, right: 20, background: '#161b22', border: '1px solid #1f6feb', borderRadius: 14, padding: '16px 20px', zIndex: 9000, boxShadow: '0 8px 30px rgba(0,0,0,.5)', minWidth: 260 }}>
      <div style={{ color: '#e6edf3', fontWeight: 700, marginBottom: 4 }}>📹 Panggilan Video Masuk</div>
      <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 12 }}>dr. {doc?.name} mengajak video call</div>
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

          {/* ── Dokter Actions ─────────────────────────────────── */}
          {isDoctor && (
            <div style={s.sideSection}>
              <span style={s.label}>Tindakan Dokter</span>

              {/* Mulai sesi — tersedia saat confirmed, waktu tidak dibatasi untuk dokter */}
              {isConfirmed && (
                <button onClick={handleStart} disabled={starting} style={s.actionBtn('#1a7f37')}>
                  ▶ {starting ? 'Memulai...' : 'Mulai Sesi'}
                </button>
              )}

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
              <div style={{ color: '#8b949e', fontSize: 12 }}>{doc?.specialization} · {typeLabel}</div>
            </div>
            <StatusBadge status={consultation.status} />
          </div>

          <div style={s.msgArea}>
            {/* Countdown banner untuk dokter (info saja, tidak memblokir) */}
            {isDoctor && isConfirmed && consultation.scheduledAt && msUntil(consultation.scheduledAt) > 0 && (
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '12px 16px', marginBottom: 4 }}>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 6 }}>ℹ️ Sesi belum dimulai — Anda dapat membaca keluhan di sidebar dan klik Mulai Sesi kapan saja</div>
                <CountdownBanner scheduledAt={consultation.scheduledAt} />
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

          {/* Status info bar — saat tidak bisa chat */}
          {!canChat && !isCompleted && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #21262d', background: '#161b22', textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
              {isConfirmed && isDoctor && '✅ Pembayaran dikonfirmasi. Klik "Mulai Sesi" di sidebar saat siap.'}
              {isConfirmed && isUser && timeHasArrived && '⏳ Menunggu dokter memulai sesi...'}
              {isLive && isUser && !timeHasArrived && '⏳ Sesi berlangsung — menunggu dokter...'}
            </div>
          )}

          {/* Chat input — hanya saat canChat */}
          {canChat && (
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
        </div>
      </div>

      {showPrescription && <PrescriptionModal value={consultation.prescription} isDoctor={isDoctor} onClose={() => setShowPrescription(false)} onSave={handleSendPrescription} />}
      {showSickLetter   && <SickLetterModal onClose={() => setShowSickLetter(false)} onSave={handleCreateSickLetter} />}
      {showRating       && <RatingModal consultationId={id} onClose={() => setShowRating(false)} onSuccess={fetchConsultation} />}

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </>
  );
};

export default ConsultationChat;