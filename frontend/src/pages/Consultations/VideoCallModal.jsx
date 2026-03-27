// frontend/src/pages/Consultations/VideoCallModal.jsx
// Komponen video call WebRTC yang telah dioptimasi
// Fitur:
//   - Fullscreen remote video + PiP lokal
//   - Toggle mic & kamera
//   - Screen share
//   - ICE restart otomatis saat disconnect
//   - Incoming call UI untuk pasien
//   - Connection quality indicator
//   - Timer durasi panggilan

import React, {
    useState, useEffect, useRef, useCallback
} from 'react';
import { toast } from 'react-hot-toast';

// ── ICE Servers (baca dari env atau gunakan public STUN) ──────────────────────
const buildIceServers = () => {
    const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];
    // Tambah TURN jika tersedia (diperlukan untuk production)
    if (process.env.REACT_APP_TURN_URLS) {
        servers.push({
            urls      : process.env.REACT_APP_TURN_URLS,
            username  : process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
        });
    }
    return servers;
};

// ── Utilitas ────────────────────────────────────────────────────────────────
const fmtDuration = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// ── Komponen Utama ────────────────────────────────────────────────────────────
export default function VideoCallModal({
    consultationId,
    socket,
    isDoctor,
    doctorName,
    patientName,
    onClose,
    onCallEnded,
}) {
    const localVideoRef  = useRef(null);
    const remoteVideoRef = useRef(null);
    const pcRef          = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef= useRef(null);
    const hasInitRef     = useRef(false);
    const timerRef       = useRef(null);

    const [callState,    setCallState]    = useState('idle');
    // idle | calling | ringing | connected | ended
    const [micOn,        setMicOn]        = useState(true);
    const [camOn,        setCamOn]        = useState(true);
    const [screenSharing,setScreenSharing]= useState(false);
    const [remoteJoined, setRemoteJoined] = useState(false);
    const [error,        setError]        = useState(null);
    const [duration,     setDuration]     = useState(0);
    const [iceState,     setIceState]     = useState('');
    const [incomingOffer,setIncomingOffer]= useState(null);

    // ── Bersihkan semua resource ──────────────────────────────────────────
    const cleanup = useCallback(() => {
        clearInterval(timerRef.current);
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        pcRef.current          = null;
        localStreamRef.current = null;
        screenStreamRef.current= null;
    }, []);

    // ── Mulai timer durasi ────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }, []);

    // ── Buat PeerConnection ───────────────────────────────────────────────
    const createPC = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) socket.emit('vc-ice-candidate', { consultationId, candidate });
        };

        pc.ontrack = ({ streams }) => {
            if (remoteVideoRef.current && streams[0]) {
                remoteVideoRef.current.srcObject = streams[0];
                setCallState('connected');
                setRemoteJoined(true);
                startTimer();
            }
        };

        pc.oniceconnectionstatechange = () => {
            setIceState(pc.iceConnectionState);
            if (pc.iceConnectionState === 'disconnected') {
                setTimeout(() => {
                    if (pcRef.current?.iceConnectionState === 'disconnected') {
                        socket.emit('vc-ice-restart', { consultationId });
                        if (isDoctor) {
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
    }, [consultationId, isDoctor, socket, startTimer]);

    // ── Ambil stream kamera & mic ─────────────────────────────────────────
    const getLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            return stream;
        } catch (err) {
            const msg = err.name === 'NotAllowedError'
                ? 'Izin kamera/mikrofon ditolak. Aktifkan di pengaturan browser.'
                : err.name === 'NotFoundError'
                ? 'Kamera atau mikrofon tidak ditemukan di perangkat ini.'
                : 'Tidak bisa mengakses kamera/mikrofon. Coba refresh halaman.';
            setError(msg);
            toast.error(msg);
            return null;
        }
    }, []);

    // ── Dokter: mulai panggilan ───────────────────────────────────────────
    const startCall = useCallback(async () => {
        if (hasInitRef.current) return;
        hasInitRef.current = true;
        setCallState('calling');
        setError(null);

        const stream = await getLocalStream();
        if (!stream) { setCallState('idle'); hasInitRef.current = false; return; }

        const pc = createPC();
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('vc-offer', { consultationId, offer });
    }, [consultationId, socket, getLocalStream, createPC]);

    // ── Pasien: terima panggilan ──────────────────────────────────────────
    const answerCall = useCallback(async (offer) => {
        setCallState('ringing');
        setIncomingOffer(null);

        const stream = await getLocalStream();
        if (!stream) return;

        const pc = createPC();
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('vc-answer', { consultationId, answer });
        setCallState('connected');
        startTimer();
    }, [consultationId, socket, getLocalStream, createPC, startTimer]);

    // ── Tolak panggilan ───────────────────────────────────────────────────
    const declineCall = useCallback(() => {
        socket.emit('vc-end', { consultationId });
        setIncomingOffer(null);
        setCallState('ended');
        onClose();
    }, [consultationId, socket, onClose]);

    // ── Akhiri panggilan ──────────────────────────────────────────────────
    const endCall = useCallback(() => {
        socket.emit('vc-end', { consultationId });
        cleanup();
        setCallState('ended');
        if (onCallEnded) onCallEnded(duration);
        setTimeout(onClose, 1500);
    }, [consultationId, socket, cleanup, onClose, onCallEnded, duration]);

    // ── Toggle mic ────────────────────────────────────────────────────────
    const toggleMic = () => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
        setMicOn(p => !p);
    };

    // ── Toggle kamera ─────────────────────────────────────────────────────
    const toggleCam = () => {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setCamOn(p => !p);
    };

    // ── Screen share ──────────────────────────────────────────────────────
    const toggleScreenShare = async () => {
        if (!pcRef.current) return;
        if (screenSharing) {
            // Kembali ke kamera
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
            const camTrack = localStreamRef.current?.getVideoTracks()[0];
            if (camTrack) {
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(camTrack);
            }
            setScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);
                // Auto-stop saat user hentikan screen share via browser UI
                screenTrack.onended = () => toggleScreenShare();
                setScreenSharing(true);
            } catch {
                toast.error('Tidak bisa memulai screen share');
            }
        }
    };

    // ── Socket event handlers ─────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onAnswer = async ({ answer }) => {
            if (!pcRef.current) return;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setCallState('connected');
            setRemoteJoined(true);
            startTimer();
        };

        const onOffer = ({ offer }) => {
            if (!isDoctor) {
                // Tampilkan UI incoming call untuk pasien
                setIncomingOffer(offer);
                setCallState('ringing');
            }
        };

        const onIce = async ({ candidate }) => {
            try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        };

        const onEnd = () => {
            cleanup();
            setCallState('ended');
            toast('Panggilan video diakhiri oleh pihak lain');
            if (onCallEnded) onCallEnded(duration);
            setTimeout(onClose, 1500);
        };

        const onIceRestart = async () => {
            if (!isDoctor && pcRef.current) {
                const offer = await pcRef.current.createOffer({ iceRestart: true }).catch(() => null);
                if (offer) {
                    await pcRef.current.setLocalDescription(offer);
                    socket.emit('vc-answer', { consultationId, answer: offer });
                }
            }
        };

        socket.on('vc-offer',         onOffer);
        socket.on('vc-answer',        onAnswer);
        socket.on('vc-ice-candidate', onIce);
        socket.on('vc-end',           onEnd);
        socket.on('vc-ice-restart',   onIceRestart);

        return () => {
            socket.off('vc-offer',         onOffer);
            socket.off('vc-answer',        onAnswer);
            socket.off('vc-ice-candidate', onIce);
            socket.off('vc-end',           onEnd);
            socket.off('vc-ice-restart',   onIceRestart);
        };
    }, [socket, isDoctor, consultationId, cleanup, onClose, onCallEnded, duration, startTimer, answerCall]);

    // Dokter langsung mulai panggilan
    useEffect(() => {
        if (isDoctor) startCall();
        return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Bersihkan timer saat unmount
    useEffect(() => () => clearInterval(timerRef.current), []);

    // ── Kualitas koneksi ──────────────────────────────────────────────────
    const iceQuality = {
        'connected'    : { color: '#2ecc71', label: 'Baik'     },
        'completed'    : { color: '#2ecc71', label: 'Stabil'   },
        'checking'     : { color: '#f39c12', label: 'Mencoba..'},
        'disconnected' : { color: '#e74c3c', label: 'Terputus' },
        'failed'       : { color: '#c0392b', label: 'Gagal'    },
    }[iceState] || { color: '#8b949e', label: '' };

    const remoteName = isDoctor ? (patientName || 'Pasien') : `dr. ${doctorName || 'Dokter'}`;

    // ── Render: Incoming call (pasien) ────────────────────────────────────
    if (incomingOffer && !isDoctor) {
        return (
            <div style={styles.overlay}>
                <div style={styles.incomingCard}>
                    <div style={styles.incomingAvatar}>👨‍⚕️</div>
                    <p style={styles.incomingTitle}>Panggilan Masuk</p>
                    <p style={styles.incomingName}>{remoteName}</p>
                    <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>
                        mengajak video call konsultasi
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={declineCall} style={styles.btnDecline}>Tolak</button>
                        <button onClick={() => answerCall(incomingOffer)} style={styles.btnAccept}>Terima</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.overlay}>
            {/* Keyframes */}
            <style>{`
                @keyframes vcPulse {
                    0%   { transform: scale(1);   opacity: 0.6; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                @keyframes vcSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Remote video — full screen */}
            <div style={styles.remoteArea}>
                <video
                    ref={remoteVideoRef}
                    autoPlay playsInline
                    style={{ ...styles.remoteVideo, display: remoteJoined ? 'block' : 'none' }}
                />

                {/* Waiting / error state */}
                {!remoteJoined && (
                    <div style={styles.waitingState}>
                        {error ? (
                            <>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                                <p style={{ color: '#e74c3c', fontWeight: 600, textAlign: 'center', maxWidth: 320 }}>{error}</p>
                                <button onClick={onClose} style={styles.btnClose}>Tutup</button>
                            </>
                        ) : (
                            <>
                                {/* Avatar + pulse ring */}
                                <div style={{ position: 'relative', marginBottom: 20 }}>
                                    <div style={styles.avatarCircle}>{isDoctor ? '👤' : '👨‍⚕️'}</div>
                                    <div style={styles.pulseRing} />
                                    <div style={{ ...styles.pulseRing, animationDelay: '0.5s' }} />
                                </div>
                                <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                                    {callState === 'calling'  ? 'Menghubungi...' :
                                     callState === 'ringing'  ? 'Menyambungkan...' : 'Mempersiapkan...'}
                                </p>
                                <p style={{ color: '#8b949e', fontSize: 13 }}>{remoteName}</p>
                            </>
                        )}
                    </div>
                )}

                {/* Local video PiP */}
                <div style={styles.localPip}>
                    <video ref={localVideoRef} autoPlay playsInline muted
                        style={{ ...styles.localVideo, display: camOn && !screenSharing ? 'block' : 'none' }}
                    />
                    {(!camOn || screenSharing) && (
                        <div style={styles.camOff}>{screenSharing ? '🖥' : '🚫'}</div>
                    )}
                </div>

                {/* Status badge + durasi */}
                <div style={styles.topBadge}>
                    {callState === 'connected' && (
                        <>
                            <span style={{ ...styles.dot, background: iceQuality.color }} />
                            {fmtDuration(duration)}
                            {iceQuality.label && (
                                <span style={{ marginLeft: 6, color: iceQuality.color, fontSize: 11 }}>
                                    ({iceQuality.label})
                                </span>
                            )}
                        </>
                    )}
                    {callState === 'calling'  && '📞 Menghubungi...'}
                    {callState === 'ringing'  && '📲 Menyambungkan...'}
                    {callState === 'ended'    && '❌ Panggilan berakhir'}
                </div>

                {/* Remote name overlay */}
                {remoteJoined && (
                    <div style={styles.remoteName}>{remoteName}</div>
                )}
            </div>

            {/* Control bar */}
            <div style={styles.controls}>
                {/* Mic */}
                <button onClick={toggleMic} title={micOn ? 'Matikan Mic' : 'Nyalakan Mic'}
                    style={{ ...styles.ctrlBtn, background: micOn ? '#2c313a' : '#c0392b' }}>
                    {micOn ? '🎙️' : '🔇'}
                </button>

                {/* Kamera */}
                <button onClick={toggleCam} title={camOn ? 'Matikan Kamera' : 'Nyalakan Kamera'}
                    style={{ ...styles.ctrlBtn, background: camOn ? '#2c313a' : '#c0392b' }}>
                    {camOn ? '📹' : '🚫'}
                </button>

                {/* Screen share */}
                <button onClick={toggleScreenShare} title={screenSharing ? 'Stop Screen Share' : 'Bagikan Layar'}
                    style={{ ...styles.ctrlBtn, background: screenSharing ? '#2980b9' : '#2c313a' }}>
                    🖥
                </button>

                {/* End call */}
                <button onClick={endCall} title="Akhiri Panggilan"
                    style={{ ...styles.ctrlBtn, ...styles.endBtn }}>
                    📵
                </button>
            </div>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed', inset: 0,
        background: '#0a0a0a',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    },
    remoteArea: {
        flex: 1,
        position: 'relative',
        background: '#111',
        overflow: 'hidden',
    },
    remoteVideo: {
        width: '100%', height: '100%',
        objectFit: 'cover',
    },
    waitingState: {
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#e6edf3',
    },
    avatarCircle: {
        width: 100, height: 100,
        borderRadius: '50%',
        background: '#1e2530',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 44,
    },
    pulseRing: {
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 100, height: 100,
        borderRadius: '50%',
        border: '2px solid #3498db',
        animation: 'vcPulse 2s linear infinite',
        opacity: 0.5,
    },
    localPip: {
        position: 'absolute',
        bottom: 16, right: 16,
        width: 140, height: 100,
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid #2c313a',
        background: '#1e2530',
        boxShadow: '0 4px 20px rgba(0,0,0,.6)',
    },
    localVideo: {
        width: '100%', height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)',
    },
    camOff: {
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#8b949e', fontSize: 28,
    },
    topBadge: {
        position: 'absolute',
        top: 16, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(22,27,34,0.75)',
        backdropFilter: 'blur(10px)',
        borderRadius: 20,
        padding: '6px 18px',
        fontSize: 13, fontWeight: 600,
        color: '#e6edf3',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
    },
    dot: {
        display: 'inline-block',
        width: 8, height: 8,
        borderRadius: '50%',
    },
    remoteName: {
        position: 'absolute',
        bottom: 130, left: 16,
        background: 'rgba(22,27,34,0.65)',
        backdropFilter: 'blur(6px)',
        borderRadius: 8,
        padding: '4px 12px',
        fontSize: 13,
        color: '#e6edf3',
    },
    controls: {
        background: '#161b22',
        borderTop: '1px solid #21262d',
        padding: '16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    ctrlBtn: {
        width: 54, height: 54,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        fontSize: 22,
        color: '#e6edf3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.1s, background 0.2s',
    },
    endBtn: {
        width: 64, height: 64,
        background: '#c0392b',
        boxShadow: '0 4px 20px rgba(192,57,43,.5)',
    },
    btnClose: {
        marginTop: 16,
        padding: '8px 24px',
        background: '#21262d',
        color: '#e6edf3',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
    },
    // Incoming call card
    incomingCard: {
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: 20,
        padding: '40px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        maxWidth: 320,
        margin: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
    },
    incomingAvatar: {
        width: 90, height: 90,
        borderRadius: '50%',
        background: '#1e2530',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40, marginBottom: 16,
    },
    incomingTitle: {
        color: '#8b949e', fontSize: 13, margin: 0,
    },
    incomingName: {
        color: '#e6edf3', fontSize: 20, fontWeight: 700, margin: '6px 0',
    },
    btnDecline: {
        padding: '12px 28px',
        background: '#c0392b',
        color: '#fff',
        border: 'none',
        borderRadius: 50,
        cursor: 'pointer',
        fontWeight: 600, fontSize: 14,
    },
    btnAccept: {
        padding: '12px 28px',
        background: '#2ecc71',
        color: '#fff',
        border: 'none',
        borderRadius: 50,
        cursor: 'pointer',
        fontWeight: 600, fontSize: 14,
    },
};