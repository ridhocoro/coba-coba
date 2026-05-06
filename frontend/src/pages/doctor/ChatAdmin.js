import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    API_URL, colors, fmtDate, fmtDT, toMin, toHHMM,
    CONS_SLOTS, APPT_SLOTS, DAYS_INFO, makeEmptySchedule, DEF_CONS, DEF_APPT,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge, Toggle, Modal, SectionHeader,
    ScheduleGrid, SchedulePreview, TH, TD, ProfileField, InputField,
} from './shared';

// ═══════════════════════════════════════════════════════════════════════════════
const SectionChatAdmin = ({ socketRef }) => {
    const { user } = useAuth();
    const [messages, setMessages]     = useState([]);
    const [text, setText]             = useState('');
    const [file, setFile]             = useState(null);
    const [sending, setSending]       = useState(false);
    const [loading, setLoading]       = useState(true);
    const [unread, setUnread]         = useState(0);
    const fileRef   = useRef();
    const bottomRef = useRef();

    // Fetch pesan dari admin
    const fetchMessages = useCallback(async () => {
        try {
            const r = await api.get('/api/doctors/my/chat');
            setMessages(r.data.messages || []);
            setUnread(r.data.unreadDoctor || 0);
            // Tandai sudah dibaca
            await api.put('/api/doctors/my/chat/read');
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);

    // Socket real-time: terima pesan dari admin
    useEffect(() => {
        if (!socketRef?.current) return;
        const sock = socketRef.current;
        const handler = ({ message }) => {
            setMessages(prev => [...prev, message]);
            setUnread(0); // langsung dibaca karena sedang buka halaman ini
            api.put('/api/doctors/my/chat/read').catch(() => {});
        };
        sock.on('admin-chat-message', handler);
        return () => sock.off('admin-chat-message', handler);
    }, [socketRef]);

    // Auto-scroll ke bawah
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim() && !file) return;
        setSending(true);
        try {
            const fd = new FormData();
            if (text.trim()) fd.append('text', text.trim());
            if (file)        fd.append('file', file);
            const r = await api.post('/api/doctors/my/chat', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setMessages(prev => [...prev, r.data.message]);
            setText('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } catch {
            toast.error('Gagal mengirim pesan');
        } finally {
            setSending(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const fmtTime = (d) => d
        ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
        : '';

    const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const resolveUrl = (url) => !url ? '' : url.startsWith('http') ? url : `${API}${url}`;

    return (
        <div>
            <SectionHeader
                title="💬 Chat dengan Admin"
                subtitle="Kirim dan terima pesan langsung dari admin klinik"
            />

            <div style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                minHeight: 420,
                maxHeight: 700,
                boxShadow: '0 2px 12px rgba(0,0,0,.06)',
            }}>
                {/* Header chat */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#f8fafc',
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>🏥</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Admin Klinik IPB</div>
                        <div style={{ fontSize: 12, color: colors.muted }}>Pesan akan diterima oleh admin klinik</div>
                    </div>
                    {unread > 0 && (
                        <span style={{
                            marginLeft: 'auto',
                            background: '#ef4444', color: '#fff',
                            borderRadius: 20, padding: '2px 8px',
                            fontSize: 11, fontWeight: 700,
                        }}>{unread} pesan baru</span>
                    )}
                </div>

                {/* Area pesan */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: '#f9fafb',
                }}>
                    {loading && (
                        <div style={{ textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 }}>
                            Memuat pesan...
                        </div>
                    )}
                    {!loading && messages.length === 0 && (
                        <div style={{
                            textAlign: 'center', color: colors.muted,
                            marginTop: 60, fontSize: 14,
                        }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                            <div style={{ fontWeight: 600 }}>Belum ada pesan</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Mulai percakapan dengan admin klinik di sini</div>
                        </div>
                    )}
                    {messages.map((msg, i) => {
                        const isDoctor = msg.senderRole === 'doctor';
                        return (
                            <div key={msg._id || i} style={{
                                display: 'flex',
                                flexDirection: isDoctor ? 'row-reverse' : 'row',
                                alignItems: 'flex-end',
                                gap: 8,
                            }}>
                                {/* Avatar */}
                                {!isDoctor && (
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 15,
                                    }}>🏥</div>
                                )}
                                <div style={{ maxWidth: '70%' }}>
                                    {/* Label pengirim */}
                                    <div style={{
                                        fontSize: 10, color: colors.muted,
                                        marginBottom: 3,
                                        textAlign: isDoctor ? 'right' : 'left',
                                        fontWeight: 600,
                                    }}>
                                        {isDoctor ? 'Anda' : 'Admin'}
                                    </div>
                                    {/* Bubble */}
                                    <div style={{
                                        background: isDoctor
                                            ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                                            : '#fff',
                                        color: isDoctor ? '#fff' : colors.text,
                                        borderRadius: isDoctor ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                        padding: '10px 14px',
                                        fontSize: 13,
                                        lineHeight: 1.5,
                                        boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                                        border: isDoctor ? 'none' : `1px solid ${colors.border}`,
                                        wordBreak: 'break-word',
                                    }}>
                                        {/* File */}
                                        {msg.fileUrl && msg.fileType === 'image' && (
                                            <a href={resolveUrl(msg.fileUrl)} target="_blank" rel="noreferrer">
                                                <img
                                                    src={resolveUrl(msg.fileUrl)}
                                                    alt={msg.fileName}
                                                    style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: msg.text ? 8 : 0 }}
                                                />
                                            </a>
                                        )}
                                        {msg.fileUrl && msg.fileType === 'file' && (
                                            <a
                                                href={resolveUrl(msg.fileUrl)}
                                                target="_blank" rel="noreferrer"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    color: isDoctor ? '#bfdbfe' : colors.primary,
                                                    fontSize: 12, fontWeight: 600,
                                                    marginBottom: msg.text ? 6 : 0,
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                📎 {msg.fileName || 'File'}
                                            </a>
                                        )}
                                        {msg.text && <span>{msg.text}</span>}
                                    </div>
                                    {/* Timestamp */}
                                    <div style={{
                                        fontSize: 10, color: colors.muted,
                                        marginTop: 3,
                                        textAlign: isDoctor ? 'right' : 'left',
                                    }}>
                                        {fmtTime(msg.createdAt)}
                                        {isDoctor && (
                                            <span style={{ marginLeft: 4 }}>
                                                {msg.isRead ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* Preview file yang dipilih */}
                {file && (
                    <div style={{
                        padding: '8px 20px',
                        background: '#eff6ff',
                        borderTop: `1px solid ${colors.border}`,
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontSize: 13,
                    }}>
                        <span>📎</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.text }}>{file.name}</span>
                        <button
                            onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, lineHeight: 1 }}
                        >✕</button>
                    </div>
                )}

                {/* Input area */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 10,
                    background: '#fff',
                }}>
                    {/* Tombol lampir file */}
                    <button
                        onClick={() => fileRef.current?.click()}
                        style={{
                            background: '#f1f5f9', border: `1px solid ${colors.border}`,
                            borderRadius: 10, width: 40, height: 40, flexShrink: 0,
                            cursor: 'pointer', fontSize: 18, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'background .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                        title="Lampirkan file"
                    >📎</button>
                    <input
                        ref={fileRef}
                        type="file"
                        style={{ display: 'none' }}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={e => setFile(e.target.files[0] || null)}
                    />

                    {/* Textarea */}
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Tulis pesan untuk admin... (Enter untuk kirim)"
                        rows={1}
                        style={{
                            flex: 1,
                            resize: 'none',
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            padding: '10px 14px',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            lineHeight: 1.5,
                            outline: 'none',
                            background: '#f8fafc',
                            color: colors.text,
                            maxHeight: 100,
                            overflowY: 'auto',
                            transition: 'border-color .15s',
                        }}
                        onFocus={e => e.target.style.borderColor = colors.primary}
                        onBlur={e => e.target.style.borderColor = colors.border}
                    />

                    {/* Tombol kirim */}
                    <button
                        onClick={handleSend}
                        disabled={sending || (!text.trim() && !file)}
                        style={{
                            background: sending || (!text.trim() && !file)
                                ? '#cbd5e1'
                                : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 12,
                            width: 42, height: 42,
                            flexShrink: 0,
                            cursor: sending || (!text.trim() && !file) ? 'not-allowed' : 'pointer',
                            fontSize: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s',
                            boxShadow: sending || (!text.trim() && !file) ? 'none' : '0 2px 8px rgba(37,99,235,.3)',
                        }}
                        title="Kirim"
                    >
                        {sending ? '⏳' : '➤'}
                    </button>
                </div>
            </div>
        </div>
    );
};


export default SectionChatAdmin;