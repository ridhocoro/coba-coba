import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaHeartbeat, FaTachometerAlt, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/* ── semua state & logika identik dengan aslinya ── */
const BloodPressureChecker = () => {
    const [systolic,  setSystolic]  = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [result,    setResult]    = useState(null);
    const [loading,   setLoading]   = useState(false);

    const checkBloodPressure = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('/api/health-check/check-blood-pressure', {
                systolic: parseInt(systolic), diastolic: parseInt(diastolic)
            });
            setResult(response.data);
            toast.success('Tekanan darah berhasil diperiksa');
        } catch { toast.error('Gagal memeriksa tekanan darah'); }
        finally { setLoading(false); }
    };

    const getBPColor = (category) => {
        switch(category) {
            case 'Normal':                          return '#16a34a';
            case 'Elevated':                        return '#d97706';
            case 'High Blood Pressure (Stage 1)':   return '#ea580c';
            case 'High Blood Pressure (Stage 2)':   return '#dc2626';
            case 'Hypertensive Crisis':             return '#991b1b';
            default:                                return '#6b7280';
        }
    };

    const getBPBg = (category) => {
        switch(category) {
            case 'Normal':                          return '#dcfce7';
            case 'Elevated':                        return '#fef9c3';
            case 'High Blood Pressure (Stage 1)':   return '#ffedd5';
            case 'High Blood Pressure (Stage 2)':   return '#fee2e2';
            case 'Hypertensive Crisis':             return '#fee2e2';
            default:                                return '#f3f4f6';
        }
    };

    const getBPIcon = (category) => {
        switch(category) {
            case 'Normal':                          return '✅';
            case 'Elevated':                        return '⚠️';
            case 'High Blood Pressure (Stage 1)':   return '⚠️';
            case 'High Blood Pressure (Stage 2)':   return '🔴';
            case 'Hypertensive Crisis':             return '🚨';
            default:                                return 'ℹ️';
        }
    };

    const getBPProgress = (systolic) => {
        if (systolic < 120) return 20;
        if (systolic <= 129) return 40;
        if (systolic <= 139) return 62;
        if (systolic <= 179) return 82;
        return 100;
    };

    const resetForm = () => { setSystolic(''); setDiastolic(''); setResult(null); };

    const BP_TABLE = [
        { sys:'< 120',   dia:'< 80',  label:'Normal',             desc:'Ideal',              color:'#16a34a', bg:'#dcfce7', pct:20  },
        { sys:'120–129', dia:'< 80',  label:'Elevated',           desc:'Waspada',            color:'#d97706', bg:'#fef9c3', pct:40  },
        { sys:'130–139', dia:'80–89', label:'Hipertensi Stage 1', desc:'Perlu perhatian',    color:'#ea580c', bg:'#ffedd5', pct:62  },
        { sys:'≥ 140',   dia:'≥ 90',  label:'Hipertensi Stage 2', desc:'Berbahaya',          color:'#dc2626', bg:'#fee2e2', pct:82  },
        { sys:'> 180',   dia:'> 120', label:'Krisis Hipertensi',  desc:'DARURAT!',           color:'#991b1b', bg:'#fee2e2', pct:100 },
    ];

    const TIPS = ['🥗 Konsumsi makanan sehat, rendah garam','🏃‍♂️ Olahraga teratur minimal 30 menit/hari','⚖️ Jaga berat badan ideal','🚭 Hindari rokok dan alkohol','😴 Kelola stres dan cukup istirahat'];
    const RISKS = ['👨‍🦳 Usia > 65 tahun','🧂 Konsumsi garam berlebih','⚖️ Obesitas/kelebihan berat badan','🧬 Riwayat keluarga','🏥 Penyakit kronis (diabetes, ginjal)'];

    const S = {
        page : { background:'#fafafa', minHeight:'100vh', padding:'40px 0 80px', fontFamily:"'DM Sans',sans-serif" },
        wrap : { maxWidth:880, margin:'0 auto', padding:'0 24px' },
        card : { background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden' },
        cHead: { padding:'16px 24px', borderBottom:'1px solid #f1f5f9', fontSize:14, fontWeight:700, color:'#0f172a' },
        body : { padding:'24px' },
        label: { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 },
        input: { width:'100%', padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:20, fontWeight:700, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s', textAlign:'center', letterSpacing:'2px' },
        btnP : { width:'100%', padding:'12px', background:'#0f172a', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' },
        btnG : { width:'100%', padding:'12px', background:'transparent', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
    };

    return (
        <div style={S.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
                .bp-input:focus{border-color:#16a34a!important;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
                .bp-btnP:hover:not(:disabled){background:#1e293b!important}
                .bp-btnP:disabled{opacity:.5;cursor:not-allowed}
                .bp-btnG:hover{background:#f9fafb!important}
                @keyframes bpUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .bp-fade{animation:bpUp .35s ease both}
                @keyframes spin{to{transform:rotate(360deg)}}
                .bp-bar-track{background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;margin-bottom:4px}
                .bp-bar-fill{height:100%;border-radius:99px;transition:width .6s cubic-bezier(.4,0,.2,1)}
            `}</style>
            <div style={S.wrap}>

                {/* Back + Header */}
                <div className="bp-fade" style={{ marginBottom:32 }}>
                    <Link to="/health-check" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280', textDecoration:'none', marginBottom:20 }}>
                        <FaArrowLeft size={11}/> Kembali
                    </Link>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'#f0fdf4', color:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <FaHeartbeat size={18}/>
                        </div>
                        <div>
                            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:28, fontWeight:400, color:'#0f172a', margin:0 }}>Cek Tekanan Darah</h1>
                            <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Sistolik & Diastolik · Standar AHA</p>
                        </div>
                    </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

                    {/* ── Form ── */}
                    <div className="bp-fade" style={{ ...S.card, animationDelay:'.08s' }}>
                        <div style={S.cHead}>📊 Masukkan Hasil Pengukuran</div>
                        <div style={S.body}>
                            <form onSubmit={checkBloodPressure}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:28 }}>
                                    <div>
                                        <label style={S.label}><FaTachometerAlt size={11} style={{ marginRight:6 }}/>Sistolik (atas)</label>
                                        <input className="bp-input" style={S.input} type="number" value={systolic} onChange={e=>setSystolic(e.target.value)}
                                            placeholder="120" required min="70" max="250"/>
                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                                            <span style={{ fontSize:12, color:'#94a3b8' }}>mmHg</span>
                                            <span style={{ fontSize:11, color:'#6b7280' }}>Saat jantung memompa</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={S.label}><FaHeartbeat size={11} style={{ marginRight:6 }}/>Diastolik (bawah)</label>
                                        <input className="bp-input" style={S.input} type="number" value={diastolic} onChange={e=>setDiastolic(e.target.value)}
                                            placeholder="80" required min="40" max="150"/>
                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                                            <span style={{ fontSize:12, color:'#94a3b8' }}>mmHg</span>
                                            <span style={{ fontSize:11, color:'#6b7280' }}>Saat jantung istirahat</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Normal reference */}
                                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 14px', marginBottom:24, display:'flex', alignItems:'center', gap:10 }}>
                                    <span style={{ fontSize:16 }}>💚</span>
                                    <div>
                                        <span style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>Normal: </span>
                                        <span style={{ fontSize:13, color:'#16a34a' }}>Sistolik &lt; 120 mmHg · Diastolik &lt; 80 mmHg</span>
                                    </div>
                                </div>

                                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    <button type="submit" className="bp-btnP" style={S.btnP} disabled={loading}>
                                        {loading ? <><span style={{ display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',marginRight:8,verticalAlign:'middle' }}/>Memeriksa...</> : 'Periksa Tekanan Darah'}
                                    </button>
                                    {result && <button type="button" className="bp-btnG" style={S.btnG} onClick={resetForm}>Periksa Ulang</button>}
                                </div>
                            </form>
                        </div>

                        {/* Klasifikasi tabel */}
                        <div style={{ padding:'0 24px 24px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Klasifikasi Tekanan Darah</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                {BP_TABLE.map(row => (
                                    <div key={row.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:row.bg, opacity: result && result.category===row.label ? 1 : result ? 0.45 : 1 }}>
                                        <div style={{ minWidth:72 }}>
                                            <span style={{ fontSize:10, fontWeight:700, color:row.color, background:'rgba(255,255,255,.6)', borderRadius:4, padding:'2px 6px' }}>{row.sys}</span>
                                        </div>
                                        <div style={{ flex:1 }}>
                                            <span style={{ fontSize:12, fontWeight:600, color:row.color }}>{row.label}</span>
                                        </div>
                                        <span style={{ fontSize:11, color:row.color, fontWeight:600 }}>{row.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Result + Tips ── */}
                    <div className="bp-fade" style={{ animationDelay:'.14s', display:'flex', flexDirection:'column', gap:16 }}>
                        {result ? (
                            <>
                                {/* Result card */}
                                <div style={S.card}>
                                    <div style={{ padding:'20px 24px', background: getBPBg(result.category), borderBottom:'1px solid #f1f5f9' }}>
                                        <div style={{ fontSize:13, fontWeight:600, color:'#6b7280', marginBottom:6 }}>Hasil Pemeriksaan</div>
                                        <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginBottom:8 }}>
                                            <div style={{ fontSize:48, fontWeight:800, color: getBPColor(result.category), lineHeight:1 }}>
                                                {result.systolic}<span style={{ fontSize:24, fontWeight:400 }}>/</span>{result.diastolic}
                                            </div>
                                            <div style={{ paddingBottom:8, fontSize:14, color: getBPColor(result.category), fontWeight:600 }}>mmHg</div>
                                        </div>
                                        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.6)', borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700, color: getBPColor(result.category) }}>
                                            {getBPIcon(result.category)} {result.category}
                                        </div>
                                    </div>

                                    <div style={S.body}>
                                        {/* Progress bar */}
                                        <div style={{ marginBottom:20 }}>
                                            <div className="bp-bar-track">
                                                <div className="bp-bar-fill" style={{ width:`${getBPProgress(result.systolic)}%`, background: getBPColor(result.category) }}/>
                                            </div>
                                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#94a3b8' }}>
                                                <span>Normal</span><span>Krisis</span>
                                            </div>
                                        </div>

                                        {/* Advice */}
                                        <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                                            {result.advice}
                                        </div>

                                        {/* Emergency warning */}
                                        {(result.category.includes('Stage') || result.category.includes('Crisis')) && (
                                            <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
                                                <div style={{ fontSize:13, fontWeight:700, color:'#b91c1c', marginBottom:8 }}>🚨 Segera lakukan:</div>
                                                <ul style={{ margin:0, paddingLeft:18 }}>
                                                    {['Istirahat dan tenangkan diri','Hindari kafein dan rokok','Segera konsultasi ke dokter',
                                                      ...(result.category==='Hypertensive Crisis'?['KUNJUNGI IGD TERDEKAT!']:[])
                                                    ].map(t => <li key={t} style={{ fontSize:13, color:'#b91c1c', marginBottom:4 }}>{t}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* CTA */}
                                        <div style={{ display:'flex', gap:10 }}>
                                            <a href="/consultations" style={{ flex:1, textAlign:'center', padding:'10px', background:'#eff6ff', color:'#2563eb', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Konsultasi Online</a>
                                            <a href="/appointments"  style={{ flex:1, textAlign:'center', padding:'10px', background:'#f0fdf4', color:'#16a34a', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Janji Temu</a>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ ...S.card, padding:32, textAlign:'center' }}>
                                <div style={{ width:64, height:64, borderRadius:16, background:'#f0fdf4', color:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                                    <FaHeartbeat size={26}/>
                                </div>
                                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:8 }}>Cek Tekanan Darah</div>
                                <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom:16 }}>Masukkan nilai sistolik dan diastolik untuk mengetahui kategori tekanan darah Anda</p>
                                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'14px', display:'inline-block' }}>
                                    <div style={{ fontSize:11, color:'#16a34a', fontWeight:600, marginBottom:4 }}>RENTANG NORMAL</div>
                                    <div style={{ fontSize:32, fontWeight:800, color:'#16a34a', lineHeight:1 }}>120 <span style={{ fontWeight:400 }}>/</span> 80</div>
                                    <div style={{ fontSize:12, color:'#16a34a', marginTop:2 }}>mmHg</div>
                                </div>
                            </div>
                        )}

                        {/* Tips & Risks */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                            <div style={{ ...S.card, padding:'16px 20px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                                    <FaCheckCircle size={12} style={{ color:'#16a34a' }}/>
                                    <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Tips Menjaga TD</span>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                                    {TIPS.map(t => <div key={t} style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{t}</div>)}
                                </div>
                            </div>
                            <div style={{ ...S.card, padding:'16px 20px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                                    <span style={{ fontSize:12 }}>⚠️</span>
                                    <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Faktor Risiko</span>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                                    {RISKS.map(r => <div key={r} style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{r}</div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BloodPressureChecker;