import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';

import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';
import { fmtDoctorName } from '../../utils/format';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminChat = () => {
  const { user } = useAuth();
  const [doctors, setDoctors]   = useState([]); // semua dokter
  const [threads, setThreads]   = useState({}); // map doctorId -> thread info
  const [active, setActive]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [file, setFile]         = useState(null);
  const [sending, setSending]   = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const fileRef   = useRef();
  const bottomRef = useRef();
  const socketRef = useRef();

  // Fetch semua dokter + thread yang sudah ada
  const fetchData = useCallback(async () => {
    try {
      const [docRes, threadRes] = await Promise.all([
        api.get('/api/admin/doctors'),
        api.get('/api/admin/chat/threads'),
      ]);
      setDoctors(docRes.data.doctors || []);
      // Map thread by doctorId for quick lookup
      const map = {};
      for (const t of (threadRes.data.threads || [])) {
        const id = t.doctorId?._id || t.doctorId;
        map[id] = t;
      }
      setThreads(map);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Socket real-time
  useEffect(() => {
    if (!user) return;
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id },
    });
    socketRef.current = sock;
    sock.on('admin-chat-message', ({ doctorId, message }) => {
      setThreads(prev => ({
        ...prev,
        [doctorId]: {
          ...prev[doctorId],
          lastMessage: message.text || `📎 ${message.fileName}`,
          unreadAdmin: active === doctorId ? 0 : ((prev[doctorId]?.unreadAdmin || 0) + 1),
        },
      }));
      if (active === doctorId) {
        setMessages(prev => [...prev, message]);
      }
    });
    return () => sock.disconnect();
  }, [user, active]);

  const openThread = async (doctor) => {
    const doctorId = doctor._id;
    setActive(doctorId);
    setLoadingMsgs(true);
    try {
      const r = await api.get(`/api/admin/chat/${doctorId}`);
      setMessages(r.data.messages || []);
      await api.put(`/api/admin/chat/${doctorId}/read`);
      setThreads(prev => ({ ...prev, [doctorId]: { ...prev[doctorId], unreadAdmin: 0 } }));
    } catch {}
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    if (!active) return;
    setSending(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append('text', text.trim());
      if (file) fd.append('file', file);
      const r = await api.post(`/api/admin/chat/${active}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => [...prev, r.data.message]);
      setThreads(prev => ({
        ...prev,
        [active]: {
          ...prev[active],
          lastMessage: text.trim() || `📎 ${file?.name}`,
        },
      }));
      setText(''); setFile(null);
    } catch { toast.error('Gagal kirim pesan'); }
    finally { setSending(false); }
  };

  const activeDoctor = doctors.find(d => d._id === active);

  const S = {
    wrap: { display: 'flex', height: 'calc(100vh - 160px)', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' },
    sidebar: { width: 260, borderRight: '1px solid #e2e8f0', overflowY: 'auto', flexShrink: 0, background: '#fafafa' },
    sidebarHeader: { padding: '14px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid #e2e8f0', background: '#fff', color: '#0f172a' },
    doctorRow: (a) => ({
      padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
      background: a ? '#eff6ff' : '#fff', transition: 'background .1s',
      display: 'flex', alignItems: 'center', gap: 10,
    }),
    avatar: { width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 },
    main: { flex: 1, display: 'flex', flexDirection: 'column' },
    chatHeader: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: 14, color: '#0f172a', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 },
    messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
    bubble: (isMine) => ({
      maxWidth: '72%', alignSelf: isMine ? 'flex-end' : 'flex-start',
      background: isMine ? '#2563eb' : '#f1f5f9',
      color: isMine ? '#fff' : '#0f172a',
      borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      padding: '8px 12px', fontSize: 13,
    }),
    inputBar: { padding: '10px 14px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'flex-end', background: '#fff' },
    textarea: { flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none', maxHeight: 100 },
    sendBtn: { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: sending ? 0.6 : 1 },
  };

  const fmtTime = d => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={S.wrap}>
      {/* Sidebar — semua dokter */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>💭 Chat dengan Dokter ({doctors.length})</div>
        {doctors.length === 0 && (
          <p style={{ padding: 16, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Tidak ada dokter terdaftar</p>
        )}
        {doctors.map(doc => {
          const thread   = threads[doc._id];
          const unread   = thread?.unreadAdmin || 0;
          const lastMsg  = thread?.lastMessage || 'Belum ada percakapan';
          const isActive = active === doc._id;
          return (
            <div key={doc._id} style={S.doctorRow(isActive)} onClick={() => openThread(doc)}>
              <div style={S.avatar}>👨‍⚕️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>fmtDoctorName(doc)</span>
                  {unread > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{unread}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.specialization}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg}</div>
              </div>
            </div>
          );
        })}
      </aside>

      {/* Chat area */}
      <main style={S.main}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 48 }}>💭</span>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Pilih dokter untuk mulai chat</p>
            <p style={{ fontSize: 12 }}>Pilih dari daftar dokter di sebelah kiri</p>
          </div>
        ) : (
          <>
            <div style={S.chatHeader}>
              <div style={S.avatar}>👨‍⚕️</div>
              <div>
                <div>fmtDoctorName(activeDoctor)</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{activeDoctor?.specialization}</div>
              </div>
            </div>

            <div style={S.messages}>
              {loadingMsgs && <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>Memuat pesan...</p>}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>
                  <p style={{ fontSize: 32 }}>👋</p>
                  <p style={{ fontSize: 13 }}>Belum ada pesan. Mulai percakapan dengan fmtDoctorName(activeDoctor).</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.senderRole === 'admin';
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={S.bubble(isMine)}>
                      {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
                      {msg.fileUrl && (
                        msg.fileType === 'image'
                          ? <img src={msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_URL}${msg.fileUrl}`}
                              alt={msg.fileName} style={{ maxWidth: 200, borderRadius: 8, marginTop: msg.text ? 8 : 0, display: 'block' }} />
                          : <a href={msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_URL}${msg.fileUrl}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: isMine ? '#bfdbfe' : '#2563eb', fontSize: 12 }}>
                              📎 {msg.fileName}
                            </a>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', margin: '2px 4px' }}>
                      {isMine ? 'Admin' : fmtDoctorName(activeDoctor)} · {fmtTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div style={S.inputBar}>
              <input type="file" ref={fileRef} style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 16 }}
                title="Lampirkan file">
                📎
              </button>
              {file && (
                <div style={{ fontSize: 11, color: '#2563eb', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {file.name}
                  <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}
              <textarea
                style={S.textarea}
                rows={1}
                placeholder="Ketik pesan..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button style={S.sendBtn} onClick={handleSend}
                disabled={sending || (!text.trim() && !file)}>
                {sending ? '...' : '➤ Kirim'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminChat;