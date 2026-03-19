import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import {
    colors, fmtDT,
    Spinner, Empty,
} from './shared';

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL + PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const NotifBell = ({ socketRef }) => {
    const [notifs, setNotifs]       = useState([]);
    const [unread, setUnread]       = useState(0);
    const [open, setOpen]           = useState(false);
    const [loading, setLoading]     = useState(false);
    const panelRef                  = useRef(null);

    const fetchNotifs = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/api/notifications');
            setNotifs(r.data.notifications || []);
            setUnread(r.data.unreadCount || 0);
        } catch { /* silently fail */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

    // Realtime via socket
    useEffect(() => {
        if (!socketRef?.current) return;
        const handler = (n) => {
            setNotifs(prev => [n, ...prev].slice(0, 50));
            setUnread(u => u + 1);
        };
        const unreadHandler = (c) => setUnread(c);
        socketRef.current.on('new-notification', handler);
        socketRef.current.on('unread-count', unreadHandler);
        return () => {
            socketRef.current?.off('new-notification', handler);
            socketRef.current?.off('unread-count', unreadHandler);
        };
    }, [socketRef]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markAllRead = async () => {
        try { await api.put('/api/notifications/read-all'); setUnread(0); setNotifs(prev => prev.map(n => ({ ...n, isRead: true }))); }
        catch { /* ignore */ }
    };

    const markOne = async (id) => {
        try { await api.put(`/api/notifications/${id}/read`); setNotifs(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n)); setUnread(u => Math.max(0, u - 1)); }
        catch { /* ignore */ }
    };

    const typeIcon = (type) => {
        if (type?.includes('appointment')) return '📅';
        if (type?.includes('consultation')) return '🩺';
        if (type?.includes('prescription')) return '💊';
        if (type?.includes('sick_letter'))  return '📄';
        return '🔔';
    };

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            <button
                onClick={() => {
                    setOpen(o => {
                        if (!o) fetchNotifs();
                        return !o;
                    });
                }}
                style={{
                    position: 'relative', background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 10,
                    width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}
            >
                🔔
                {unread > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '0 5px', minWidth: 16, textAlign: 'center', lineHeight: '16px' }}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (() => {
                const rect = panelRef.current?.getBoundingClientRect();
                const panelLeft = rect ? rect.right + 10 : 260;
                const panelTop  = rect ? Math.max(8, rect.top - 4) : 12;
                return (
                <div style={{
                    position: 'fixed', left: panelLeft, top: panelTop, width: 340,
                    background: '#fff', borderRadius: 14,
                    boxShadow: '0 12px 40px rgba(0,0,0,.22)', zIndex: 10000, overflow: 'hidden',
                    border: `1px solid ${colors.border}`,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${colors.border}` }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>Notifikasi</span>
                        {unread > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: colors.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tandai semua dibaca</button>}
                    </div>
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {loading ? <Spinner size={24} /> : notifs.length === 0 ? <Empty icon="🔔" text="Belum ada notifikasi" /> : (
                            notifs.map(n => (
                                <div key={n._id} onClick={() => markOne(n._id)} style={{
                                    padding: '13px 18px', borderBottom: `1px solid #f8fafc`, cursor: 'pointer',
                                    background: n.isRead ? '#fff' : '#eff6ff',
                                    display: 'flex', gap: 12, alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon(n.type)}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 13, color: colors.text, marginBottom: 2 }}>{n.title}</div>
                                        <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>{n.message}</div>
                                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>{fmtDT(n.createdAt)}</div>
                                    </div>
                                    {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.primary, flexShrink: 0, marginTop: 4 }} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                );
            })()}
        </div>
    );
};


export default NotifBell;