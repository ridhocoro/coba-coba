import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { FaTimes, FaPaperPlane, FaSpinner } from 'react-icons/fa';

const LOGO = '/images/AI-logo.png';

const SUGGESTIONS = [
    'Manfaat vitamin c',
    'Gejala demam berdarah',
    'Cara menurunkan tekanan darah',
    'Tips hidup sehat',
];

const AIChatbot = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen]         = useState(false);
    const [messages, setMessages]     = useState([]);
    const [input, setInput]           = useState('');
    const [loading, setLoading]       = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const messagesEndRef               = useRef(null);
    const inputRef                     = useRef(null);

    useEffect(() => {
        if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen]);

    const handleOpen = () => {
        setIsOpen(true);
        if (!hasGreeted) {
            const greeting = user
                ? `Halo, **${user.name || user.email}**! 👋 Saya asisten AI Klinik IPB. Ada yang bisa saya bantu seputar layanan klinik atau informasi kesehatan?`
                : `Halo! 👋 Saya asisten AI Klinik IPB. Saya siap membantu Anda dengan informasi seputar layanan klinik dan kesehatan. Ada yang bisa saya bantu?`;
            setMessages([{ role: 'assistant', content: greeting, id: Date.now() }]);
            setHasGreeted(true);
        }
    };

    const handleSend = async (text) => {
        const message = (text || input).trim();
        if (!message || loading) return;

        const userMessage     = { role: 'user', content: message, id: Date.now() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const apiMessages = updatedMessages.map(({ role, content }) => ({ role, content }));
            const res = await api.post('/api/ollama/chat', { messages: apiMessages });
            setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply, id: Date.now() }]);
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Terjadi kesalahan';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Maaf, terjadi kesalahan: ${errMsg}. Silakan coba lagi.`,
                id: Date.now()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const renderText = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
            return part.split('\n').map((line, j, arr) => (
                <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
            ));
        });
    };

    /* ─── Logo avatar reusable ─── */
    const LogoAvatar = ({ size = 28 }) => (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: '#f0f4f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
        }}>
            <img
                src={LOGO}
                alt="Klinik IPB"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
            />
        </div>
    );

    return (
        <>
            {/* ── Floating button ── TANPA WARNA BIRU, HANYA LOGO ── */}
            {!isOpen && (
                <button
                    onClick={handleOpen}
                    title="Chat dengan ASK IPB"
                    style={{
                        position: 'fixed', bottom: '28px', right: '28px',
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'transparent',
                        border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 9999,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        overflow: 'visible',
                        padding: 0,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                        borderRadius: '50%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.28)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'; }}
                >
                    <img
                        src={LOGO}
                        alt="Klinik IPB"
                        style={{ 
                            width: '64px', 
                            height: '64px', 
                            objectFit: 'contain',
                            borderRadius: '50%',
                            display: 'block',
                            mixBlendMode: 'multiply',
                        }}
                        onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement.innerHTML += '<span style="font-size:36px">🏥</span>';
                        }}
                    />
                </button>
            )}

            {/* ── Chat window ── */}
            {isOpen && (
                <div style={{
                    position: 'fixed', bottom: '28px', right: '28px', width: '380px',
                    maxWidth: 'calc(100vw - 32px)', height: '560px', maxHeight: 'calc(100vh - 60px)',
                    display: 'flex', flexDirection: 'column', borderRadius: '18px',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.18)', zIndex: 9999, overflow: 'hidden',
                    background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                    animation: 'slideUp 0.25s ease-out',
                }}>

                    {/* Header */}
                    <div style={{
                        background: '#2c3e50',
                        padding: '14px 16px', display: 'flex', alignItems: 'center',
                        gap: '10px', flexShrink: 0,
                    }}>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', flexShrink: 0,
                            padding: '2px',
                        }}>
                            <img
                                src={LOGO}
                                alt="Klinik IPB"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', lineHeight: 1.2 }}>ASK IPB</div>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Asisten Klinik IPB</div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                                width: '30px', height: '30px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', color: '#fff',
                            }}
                        >
                            <FaTimes size={14} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '14px',
                        display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8f9fb',
                    }}>
                        {messages.map(msg => (
                            <div key={msg.id} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end', gap: '6px',
                                maxWidth: '100%',
                            }}>
                                {msg.role === 'assistant' && <LogoAvatar size={28} />}

                                <div style={{
                                    maxWidth: '78%', padding: '10px 13px',
                                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.role === 'user' ? '#e9ecef' : '#fff',  /* Abu-abu terang untuk user, bukan biru */
                                    color: msg.role === 'user' ? '#333' : '#333',
                                    fontSize: '13.5px', lineHeight: '1.55',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                }}>
                                    {renderText(msg.content)}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                                <LogoAvatar size={28} />
                                <div style={{
                                    padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                                    display: 'flex', gap: '5px', alignItems: 'center',
                                }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{
                                            width: '7px', height: '7px', borderRadius: '50%',
                                            background: '#6c757d', display: 'inline-block',  /* Abu-abu, bukan biru */
                                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.length === 1 && !loading && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {SUGGESTIONS.map((s, i) => (
                                    <button key={i} onClick={() => handleSend(s)} style={{
                                        background: '#fff', border: '1px solid #ced4da', borderRadius: '20px',
                                        padding: '5px 12px', fontSize: '12px', color: '#495057',
                                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#e9ecef'; e.currentTarget.style.borderColor = '#adb5bd'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ced4da'; }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div style={{
                        padding: '10px 12px', borderTop: '1px solid #e8ecf0',
                        background: '#fff', display: 'flex', gap: '8px',
                        alignItems: 'flex-end', flexShrink: 0,
                    }}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ketik pesan Anda..."
                            rows={1}
                            disabled={loading}
                            style={{
                                flex: 1, border: '1px solid #dde2ea', borderRadius: '12px',
                                padding: '9px 13px', fontSize: '13.5px', outline: 'none',
                                resize: 'none', fontFamily: 'inherit', maxHeight: '100px',
                                overflowY: 'auto', lineHeight: '1.5',
                                transition: 'border-color 0.15s',
                                background: loading ? '#f5f5f5' : '#fff',
                            }}
                            onFocus={e => e.target.style.borderColor = '#6c757d'}
                            onBlur={e => e.target.style.borderColor = '#dde2ea'}
                            onInput={e => {
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                            }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: input.trim() && !loading ? '#6c757d' : '#e0e0e0',
                                border: 'none', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                                flexShrink: 0, transition: 'all 0.15s',
                            }}
                        >
                            {loading
                                ? <FaSpinner size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                : <FaPaperPlane size={14} />
                            }
                        </button>
                    </div>

                    <div style={{
                        textAlign: 'center', padding: '5px 8px 8px',
                        fontSize: '10.5px', color: '#aaa', background: '#fff', flexShrink: 0,
                    }}>
                        AI dapat membuat kesalahan. Konsultasikan ke dokter untuk informasi medis penting.
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp   { from{opacity:0;transform:translateY(20px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
                @keyframes bounce    { 0%,80%,100%{transform:translateY(0);opacity:0.5} 40%{transform:translateY(-6px);opacity:1} }
                @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            `}</style>
        </>
    );
};

export default AIChatbot;