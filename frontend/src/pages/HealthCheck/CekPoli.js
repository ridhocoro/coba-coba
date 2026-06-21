import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { FaRobot, FaStethoscope, FaArrowLeft, FaHospitalAlt, FaTooth, FaBabyCarriage, FaAppleAlt } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const CekPoli = () => {
    const [keluhan, setKeluhan] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!keluhan.trim()) {
            setError('Silakan ceritakan keluhan Anda terlebih dahulu.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const response = await api.post('/api/health-check/recommend-poli', {
                keluhan
            });

            if (response.data.success) {
                setResult(response.data.data);
            } else {
                setError(response.data.message || 'Gagal memproses keluhan.');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Gagal menghubungi AI Triage Klinik IPB. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const S = {
        page  : { background:'#fafafa', minHeight:'100vh', padding:'40px 0 80px', fontFamily:"'Poppins', sans-serif" },
        wrap  : { maxWidth:880, margin:'0 auto', padding:'0 24px' },
        label : { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 },
        input : { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .15s', boxSizing:'border-box', resize:'vertical' },
        card  : { background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden' },
        chHead: { padding:'16px 24px', borderBottom:'1px solid #f1f5f9', fontSize:14, fontWeight:700, color:'#0f172a' },
        body  : { padding:'24px' },
        btnPrimary: { width:'100%', padding:'12px', background:'#0284c7', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', transition:'background .15s', fontFamily:'inherit' },
    };

    const getPoliInfo = (poliName) => {
        switch (poliName) {
            case 'Poli Umum':
                return { icon: <FaStethoscope size={24} />, bg: '#dcfce7', color: '#16a34a' }; // Green
            case 'Poli Gigi':
                return { icon: <FaTooth size={24} />, bg: '#e0f2fe', color: '#0284c7' }; // Blue
            case 'Poli KIA':
                return { icon: <FaBabyCarriage size={24} />, bg: '#fae8ff', color: '#c026d3' }; // Fuchsia
            case 'Poli Gizi':
                return { icon: <FaAppleAlt size={24} />, bg: '#fef9c3', color: '#ca8a04' }; // Yellow
            default:
                return { icon: <FaHospitalAlt size={24} />, bg: '#f3f4f6', color: '#6b7280' }; // Gray
        }
    };

    return (
        <div style={S.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                .poli-input:focus{border-color:#0284c7!important;box-shadow:0 0 0 3px rgba(2, 132, 199,.1)}
                .poli-btn-primary:hover:not(:disabled){background:#0369a1!important}
                .poli-btn-primary:disabled{opacity:.5;cursor:not-allowed}
                @keyframes poliUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .poli-fade{animation:poliUp .35s ease both}
            `}</style>
            <div style={S.wrap}>

                {/* Back + Header */}
                <div className="poli-fade" style={{ marginBottom:32 }}>
                    <Link to="/health-check" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280', textDecoration:'none', marginBottom:20 }}>
                        <FaArrowLeft size={11}/> Kembali
                    </Link>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'#e0f2fe', color:'#0284c7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <FaRobot size={18}/>
                        </div>
                        <div>
                            <h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:28, fontWeight:400, color:'#0f172a', margin:0 }}>Smart Triage AI</h1>
                            <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Prediksi poli berdasarkan keluhan via AI</p>
                        </div>
                    </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr)', gap:20, alignItems:'start' }}>

                    {/* ── Form ── */}
                    <div className="poli-fade" style={{ ...S.card, animationDelay:'.08s' }}>
                        <div style={S.chHead}>💬 Ceritakan Keluhan Anda</div>
                        <div style={S.body}>
                            {error && (
                                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#b91c1c' }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div style={{ marginBottom:20 }}>
                                    <label style={S.label}>Keluhan Medis</label>
                                    <textarea 
                                        className="poli-input"
                                        style={{...S.input, minHeight:'120px'}}
                                        placeholder="Contoh: Saya batuk berdahak dan dada terasa sesak sejak dua hari yang lalu."
                                        value={keluhan}
                                        onChange={(e) => setKeluhan(e.target.value)}
                                        required
                                    />
                                    <p style={{ fontSize:12, color:'#94a3b8', marginTop:8, marginBottom:0 }}>
                                        Jelaskan sedetail mungkin, misalnya sejak kapan keluhan muncul, bagian mana yang sakit, dll.
                                    </p>
                                </div>

                                <button type="submit" style={S.btnPrimary} className="poli-btn-primary" disabled={loading}>
                                    {loading ? (
                                        <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Menganalisis...</>
                                    ) : (
                                        <><FaRobot className="me-2"/> Cek Rekomendasi Poli</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* ── Result ── */}
                    {result && (
                        <div className="poli-fade" style={{ ...S.card, animationDelay:'.15s' }}>
                            <div style={S.chHead}>🤖 Hasil Rekomendasi AI</div>
                            <div style={S.body}>
                                <div style={{ textAlign:'center', marginBottom:24 }}>
                                    <div style={{ display:'inline-flex', width:64, height:64, borderRadius:'50%', background:getPoliInfo(result.kategori).bg, color:getPoliInfo(result.kategori).color, alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                                        {getPoliInfo(result.kategori).icon}
                                    </div>
                                    <div style={{ fontSize:13, color:'#6b7280', marginBottom:4 }}>Disarankan ke</div>
                                    <div style={{ fontSize:22, fontWeight:700, color:'#0f172a' }}>{result.kategori}</div>
                                </div>

                                <div style={{ background:'#f8fafc', borderRadius:12, padding:'16px', marginBottom:24 }}>
                                    <div style={{ fontSize:12, fontWeight:600, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Analisis Rinci</div>
                                    <div style={{ fontSize:14, color:'#334155', lineHeight:1.6 }}>{result.alasan}</div>
                                </div>

                                {result.perluRujukan && (
                                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'16px', marginBottom:24, display:'flex', gap:12 }}>
                                        <div style={{ color:'#d97706', paddingTop:2 }}><FaHospitalAlt size={16}/></div>
                                        <div>
                                            <div style={{ fontSize:13, fontWeight:600, color:'#b45309', marginBottom:4 }}>Perlu Rujukan Eksternal</div>
                                            <div style={{ fontSize:13, color:'#92400e', lineHeight:1.5 }}>
                                                {result.pesanRujukan || "Kondisi Anda mungkin memerlukan penanganan dari rumah sakit atau spesialis tingkat lanjut. Silakan kunjungi Poli Umum kami untuk mendapatkan surat rujukan."}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display:'flex', gap:12 }}>
                                    <Button variant="outline-secondary" className="w-100" onClick={() => { setKeluhan(''); setResult(null); setError(''); }} style={{ borderRadius:10, fontWeight:600, fontSize:14, padding:'10px' }}>
                                        Cek Keluhan Lain
                                    </Button>
                                    <Button variant="primary" className="w-100" onClick={() => navigate('/appointments')} style={{ borderRadius:10, fontWeight:600, fontSize:14, padding:'10px', background:'#0f172a', borderColor:'#0f172a' }}>
                                        Buat Janji Temu
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default CekPoli;
