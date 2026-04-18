// Admin/AdminChat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';
import { fmtDoctorName } from '../../utils/format';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminChat = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [threads, setThreads] = useState({});
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const bottomRef = useRef();
  const socketRef = useRef();

  // Fetch semua dokter + thread yang sudah ada
  const fetchData = useCallback(async () => {
    setLoadingDoctors(true);
    setError(null);
    try {
      // Fetch semua dokter aktif
      const docRes = await api.get('/api/admin/doctors');
      console.log('Doctors response:', docRes.data);
      
      const rawDoctors = docRes.data.doctors || [];
      // Normalize doctor data
      const normalized = rawDoctors.map(d => ({
        ...d,
        _id: String(d._id || d.id),
        id: String(d.id || d._id),
        name: d.name || d.userId?.name || 'Dokter',
        specialization: d.specialization || '-'
      }));
      
      setDoctors(normalized);
      
      // Fetch chat threads
      try {
        const threadRes = await api.get('/api/admin/chat/threads');
        console.log('Threads response:', threadRes.data);
        
        const map = {};
        for (const t of (threadRes.data.threads || [])) {
          let doctorId = null;
          if (t.doctorId) {
            doctorId = String(t.doctorId._id || t.doctorId.id || t.doctorId);
          }
          if (doctorId) {
            map[doctorId] = {
              ...t,
              lastMessage: t.lastMessage || 'Belum ada pesan',
              unreadAdmin: t.unreadAdmin || 0
            };
          }
        }
        setThreads(map);
      } catch (threadErr) {
        console.error('Error fetching threads:', threadErr);
        // Non-critical error, just log
      }
    } catch (err) {
      console.error('AdminChat fetchData error:', err);
      setError('Gagal memuat data chat');
      toast.error('Gagal memuat daftar dokter');
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket real-time
  useEffect(() => {
    if (!user) return;
    
    const sock = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
      query: { userId: user.id },
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = sock;
    
    sock.on('connect', () => {
      console.log('AdminChat socket connected');
    });
    
    sock.on('admin-chat-message', ({ doctorId, message }) => {
      const did = String(doctorId);
      setThreads(prev => ({
        ...prev,
        [did]: {
          ...prev[did],
          lastMessage: message.text || `📎 ${message.fileName || 'file'}`,
          unreadAdmin: active === did ? 0 : ((prev[did]?.unreadAdmin || 0) + 1),
        },
      }));
      if (active === did) {
        setMessages(prev => [...prev, message]);
        // Mark as read when active
        api.put(`/api/admin/chat/${did}/read`).catch(console.error);
      }
    });
    
    sock.on('disconnect', () => {
      console.log('AdminChat socket disconnected');
    });
    
    return () => {
      if (sock) sock.disconnect();
    };
  }, [user, active]);

  const openThread = async (doctor) => {
    const doctorId = String(doctor._id || doctor.id);
    setActive(doctorId);
    setLoadingMsgs(true);
    try {
      const r = await api.get(`/api/admin/chat/${doctorId}`);
      setMessages(r.data.messages || []);
      // Mark as read
      await api.put(`/api/admin/chat/${doctorId}/read`);
      setThreads(prev => ({ 
        ...prev, 
        [doctorId]: { ...prev[doctorId], unreadAdmin: 0 } 
      }));
    } catch (err) {
      console.error('openThread error:', err);
      toast.error('Gagal memuat pesan');
    } finally {
      setLoadingMsgs(false);
    }
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
          lastMessage: text.trim() || `📎 ${file?.name || 'file'}`,
        },
      }));
      setText('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Gagal kirim pesan');
    } finally {
      setSending(false);
    }
  };

  const activeDoctor = doctors.find(d => String(d._id || d.id) === active);

  const styles = {
    wrap: { 
      display: 'flex', 
      height: 'calc(100vh - 160px)', 
      border: '1px solid #e2e8f0', 
      borderRadius: 12, 
      overflow: 'hidden', 
      background: '#fff' 
    },
    sidebar: { 
      width: 280, 
      borderRight: '1px solid #e2e8f0', 
      overflowY: 'auto', 
      flexShrink: 0, 
      background: '#fafafa' 
    },
    sidebarHeader: { 
      padding: '14px 16px', 
      fontWeight: 700, 
      fontSize: 14, 
      borderBottom: '1px solid #e2e8f0', 
      background: '#fff', 
      color: '#0f172a',
      position: 'sticky',
      top: 0,
      zIndex: 1
    },
    doctorRow: (isActive) => ({
      padding: '12px 14px',
      cursor: 'pointer',
      borderBottom: '1px solid #f1f5f9',
      background: isActive ? '#eff6ff' : '#fff',
      transition: 'background .1s',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      ':hover': { background: '#f8fafc' }
    }),
    avatar: { 
      width: 40, 
      height: 40, 
      borderRadius: '50%', 
      background: '#dbeafe', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontSize: 18, 
      flexShrink: 0 
    },
    main: { flex: 1, display: 'flex', flexDirection: 'column' },
    chatHeader: { 
      padding: '12px 16px', 
      borderBottom: '1px solid #e2e8f0', 
      fontWeight: 700, 
      fontSize: 14, 
      color: '#0f172a', 
      background: '#f8fafc', 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12 
    },
    messages: { 
      flex: 1, 
      overflowY: 'auto', 
      padding: 16, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12,
      background: '#f9fafb'
    },
    bubble: (isMine) => ({
      maxWidth: '70%',
      alignSelf: isMine ? 'flex-end' : 'flex-start',
      background: isMine ? '#2563eb' : '#fff',
      color: isMine ? '#fff' : '#0f172a',
      borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      padding: '10px 14px',
      fontSize: 13,
      boxShadow: '0 1px 2px rgba(0,0,0,.05)',
      wordBreak: 'break-word'
    }),
    inputBar: { 
      padding: '12px 16px', 
      borderTop: '1px solid #e2e8f0', 
      display: 'flex', 
      gap: 10, 
      alignItems: 'flex-end', 
      background: '#fff' 
    },
    textarea: { 
      flex: 1, 
      padding: '10px 14px', 
      border: '1px solid #e2e8f0', 
      borderRadius: 12, 
      fontSize: 13, 
      resize: 'none', 
      fontFamily: 'inherit', 
      outline: 'none', 
      maxHeight: 100,
      backgroundColor: '#f9fafb'
    },
    sendBtn: { 
      padding: '8px 18px', 
      borderRadius: 10, 
      border: 'none', 
      background: '#2563eb', 
      color: '#fff', 
      fontWeight: 600, 
      cursor: 'pointer', 
      fontSize: 13,
      transition: 'opacity .2s'
    },
    errorBox: {
      background: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: 8,
      padding: '12px 16px',
      margin: '16px',
      color: '#991b1b',
      fontSize: 13,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  if (error) {
    return (
      <div style={styles.errorBox}>
        <span>⚠️ {error}</span>
        <button 
          onClick={fetchData}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Sidebar — semua dokter */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          💬 Chat dengan Dokter 
          {!loadingDoctors && ` (${doctors.length})`}
        </div>
        
        {loadingDoctors && (
          <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
            <div>⏳ Memuat dokter...</div>
          </div>
        )}
        
        {!loadingDoctors && doctors.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍⚕️</div>
            <p>Tidak ada dokter terdaftar</p>
          </div>
        )}
        
        {doctors.map(doc => {
          const docId = String(doc._id || doc.id);
          const thread = threads[docId];
          const unread = thread?.unreadAdmin || 0;
          const lastMsg = thread?.lastMessage || 'Belum ada percakapan';
          const isActive = active === docId;
          
          return (
            <div 
              key={docId} 
              style={styles.doctorRow(isActive)} 
              onClick={() => openThread(doc)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#fff'; }}
            >
              <div style={styles.avatar}>
                {doc.photo ? (
                  <img src={doc.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  '👨‍⚕️'
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                    {fmtDoctorName(doc)}
                  </span>
                  {unread > 0 && (
                    <span style={{ 
                      background: '#ef4444', 
                      color: '#fff', 
                      borderRadius: 20, 
                      padding: '2px 8px', 
                      fontSize: 10, 
                      fontWeight: 700,
                      flexShrink: 0 
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {doc.specialization}
                </div>
                <div style={{ 
                  fontSize: 11, 
                  color: '#94a3b8', 
                  marginTop: 2, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap' 
                }}>
                  {lastMsg}
                </div>
              </div>
            </div>
          );
        })}
      </aside>

      {/* Chat area */}
      <main style={styles.main}>
        {!active ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#94a3b8', 
            flexDirection: 'column', 
            gap: 12 
          }}>
            <span style={{ fontSize: 64 }}>💬</span>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Pilih dokter untuk mulai chat</p>
            <p style={{ fontSize: 13 }}>Klik salah satu dokter di daftar sebelah kiri</p>
          </div>
        ) : (
          <>
            <div style={styles.chatHeader}>
              <div style={styles.avatar}>
                {activeDoctor?.photo ? (
                  <img src={activeDoctor.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  '👨‍⚕️'
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{fmtDoctorName(activeDoctor)}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                  {activeDoctor?.specialization}
                </div>
              </div>
            </div>

            <div style={styles.messages}>
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  ⏳ Memuat pesan...
                </div>
              )}
              
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#94a3b8', 
                  marginTop: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <span style={{ fontSize: 48 }}>👋</span>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>
                    Belum ada pesan
                  </p>
                  <p style={{ fontSize: 12 }}>
                    Mulai percakapan dengan {fmtDoctorName(activeDoctor)}.
                  </p>
                </div>
              )}
              
              {messages.map((msg, idx) => {
                const isMine = msg.senderRole === 'admin';
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={styles.bubble(isMine)}>
                      {msg.text && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>}
                      {msg.fileUrl && (
                        msg.fileType === 'image' ? (
                          <img 
                            src={msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_URL}${msg.fileUrl}`}
                            alt={msg.fileName}
                            style={{ 
                              maxWidth: 200, 
                              borderRadius: 8, 
                              marginTop: msg.text ? 8 : 0, 
                              display: 'block',
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_URL}${msg.fileUrl}`, '_blank')}
                          />
                        ) : (
                          <a 
                            href={msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_URL}${msg.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ 
                              color: isMine ? '#bfdbfe' : '#2563eb', 
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: msg.text ? 8 : 0
                            }}
                          >
                            📎 {msg.fileName}
                          </a>
                        )
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', margin: '4px 8px 0' }}>
                      {isMine ? 'Admin' : fmtDoctorName(activeDoctor)} · {fmtTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div style={styles.inputBar}>
              <input 
                type="file" 
                ref={fileRef} 
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)} 
              />
              <button 
                onClick={() => fileRef.current?.click()}
                style={{ 
                  padding: '8px 12px', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: 10, 
                  background: '#fff', 
                  cursor: 'pointer', 
                  fontSize: 16,
                  transition: 'all .2s'
                }}
                title="Lampirkan file"
              >
                📎
              </button>
              
              {file && (
                <div style={{ 
                  fontSize: 11, 
                  color: '#2563eb', 
                  maxWidth: 150, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  background: '#eff6ff',
                  padding: '4px 10px',
                  borderRadius: 16
                }}>
                  📄 {file.name}
                  <button 
                    onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              <textarea
                style={styles.textarea}
                rows={1}
                placeholder="Ketik pesan..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    handleSend(); 
                  } 
                }}
              />
              
              <button 
                style={{ 
                  ...styles.sendBtn, 
                  opacity: (sending || (!text.trim() && !file)) ? 0.5 : 1 
                }} 
                onClick={handleSend}
                disabled={sending || (!text.trim() && !file)}
              >
                {sending ? '⌛' : '➤ Kirim'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminChat;