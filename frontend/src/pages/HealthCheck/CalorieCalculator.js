import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaFire, FaApple, FaRunning, FaBed, FaArrowLeft } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/* ── semua state & logika identik dengan aslinya ── */
const CalorieCalculator = () => {
    const [formData, setFormData] = useState({ gender:'male', age:'', weight:'', height:'', activityLevel:'moderate' });
    const [result,  setResult]  = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const calculateCalories = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('/api/health-check/calculate-calories', {
                ...formData,
                age: parseInt(formData.age), weight: parseFloat(formData.weight), height: parseFloat(formData.height)
            });
            setResult(response.data);
            toast.success('Kebutuhan kalori berhasil dihitung');
        } catch { toast.error('Gagal menghitung kebutuhan kalori'); }
        finally { setLoading(false); }
    };

    const getActivityLevelLabel = (level) => ({ sedentary:'Jarang Bergerak', light:'Ringan', moderate:'Sedang', active:'Aktif', veryActive:'Sangat Aktif' }[level] || level);
    const getActivityLevelDescription = (level) => ({ sedentary:'Pekerja kantor, jarang olahraga', light:'Olahraga 1-3 hari/minggu', moderate:'Olahraga 3-5 hari/minggu', active:'Olahraga 6-7 hari/minggu', veryActive:'Atlet, pekerja fisik berat' }[level] || level);
    const resetForm = () => { setFormData({ gender:'male', age:'', weight:'', height:'', activityLevel:'moderate' }); setResult(null); };

    const ACTIVITY_LEVELS = [
        { val:'sedentary', label:'Jarang Bergerak (Sedentary)' },
        { val:'light',     label:'Ringan (Light)'              },
        { val:'moderate',  label:'Sedang (Moderate)'           },
        { val:'active',    label:'Aktif (Active)'              },
        { val:'veryActive',label:'Sangat Aktif (Very Active)'  },
    ];

    const ACTIVITY_FACTORS = [
        { key:'sedentary', factor:'× 1.2'   },
        { key:'light',     factor:'× 1.375' },
        { key:'moderate',  factor:'× 1.55'  },
        { key:'active',    factor:'× 1.725' },
    ];

    const MEAL_DIST = [
        { icon:<FaApple  size={18}/>, label:'Sarapan',    pct:0.30, color:'#dc2626', bg:'#fef2f2' },
        { icon:<FaFire   size={18}/>, label:'Makan Siang',pct:0.35, color:'#d97706', bg:'#fffbeb' },
        { icon:<FaBed    size={18}/>, label:'Makan Malam',pct:0.25, color:'#2563eb', bg:'#eff6ff' },
        { icon:<FaRunning size={18}/>,label:'Camilan',    pct:0.10, color:'#16a34a', bg:'#f0fdf4' },
    ];

    const S = {
        page : { background:'#fafafa', minHeight:'100vh', padding:'40px 0 80px', fontFamily:"'DM Sans',sans-serif" },
        wrap : { maxWidth:880, margin:'0 auto', padding:'0 24px' },
        card : { background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden' },
        cHead: { padding:'16px 24px', borderBottom:'1px solid #f1f5f9', fontSize:14, fontWeight:700, color:'#0f172a' },
        body : { padding:'24px' },
        label: { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 },
        input: { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s' },
        btnP : { width:'100%', padding:'12px', background:'#0f172a', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' },
        btnG : { width:'100%', padding:'12px', background:'transparent', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
        radioRow: (checked) => ({ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:`1px solid ${checked?'#dc2626':'#e5e7eb'}`, background:checked?'#fef2f2':'#fff', cursor:'pointer', transition:'all .15s' }),
        dot  : (checked) => ({ width:16, height:16, borderRadius:'50%', border:`2px solid ${checked?'#dc2626':'#d1d5db'}`, background:checked?'#dc2626':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }),
        dotIn: { width:6, height:6, borderRadius:'50%', background:'#fff' },
    };

    return (
        <div style={S.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
                .cal-input:focus{border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,.1)}
                .cal-btnP:hover:not(:disabled){background:#1e293b!important}
                .cal-btnP:disabled{opacity:.5;cursor:not-allowed}
                .cal-btnG:hover{background:#f9fafb!important}
                .cal-select:focus{border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,.1);outline:none}
                @keyframes calUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .cal-fade{animation:calUp .35s ease both}
                @keyframes spin{to{transform:rotate(360deg)}}
            `}</style>
            <div style={S.wrap}>

                {/* Back + Header */}
                <div className="cal-fade" style={{ marginBottom:32 }}>
                    <Link to="/health-check" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280', textDecoration:'none', marginBottom:20 }}>
                        <FaArrowLeft size={11}/> Kembali
                    </Link>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'#fef2f2', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <FaFire size={18}/>
                        </div>
                        <div>
                            <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:28, fontWeight:400, color:'#0f172a', margin:0 }}>Kalkulator Kalori</h1>
                            <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Kebutuhan kalori harian berdasarkan BMR</p>
                        </div>
                    </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

                    {/* ── Form ── */}
                    <div className="cal-fade" style={{ ...S.card, animationDelay:'.08s' }}>
                        <div style={S.cHead}>📝 Data Diri</div>
                        <div style={S.body}>
                            <form onSubmit={calculateCalories}>
                                {/* Gender */}
                                <div style={{ marginBottom:20 }}>
                                    <label style={S.label}>Jenis Kelamin</label>
                                    <div style={{ display:'flex', gap:10 }}>
                                        {[{val:'male',label:'Laki-laki'},{val:'female',label:'Perempuan'}].map(g => (
                                            <label key={g.val} style={{ ...S.radioRow(formData.gender===g.val), flex:1, justifyContent:'center' }} onClick={()=>setFormData({...formData,gender:g.val})}>
                                                <div style={S.dot(formData.gender===g.val)}>{formData.gender===g.val&&<div style={S.dotIn}/>}</div>
                                                <span style={{ fontSize:13, fontWeight:formData.gender===g.val?600:400, color:'#374151' }}>{g.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Age / Weight / Height */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
                                    {[
                                        { name:'age',    label:'Usia',  placeholder:'Tahun', unit:'th',  min:15, max:100, step:1   },
                                        { name:'weight', label:'Berat', placeholder:'Berat', unit:'kg',  step:'0.1'                },
                                        { name:'height', label:'Tinggi',placeholder:'Tinggi',unit:'cm',  step:'0.1'                },
                                    ].map(f => (
                                        <div key={f.name}>
                                            <label style={S.label}>{f.label}</label>
                                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                <input className="cal-input" style={S.input} type="number" name={f.name} value={formData[f.name]} onChange={handleChange}
                                                    placeholder={f.placeholder} required min={f.min} max={f.max} step={f.step}/>
                                                <span style={{ fontSize:12, color:'#94a3b8', fontWeight:600, flexShrink:0 }}>{f.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Activity Level */}
                                <div style={{ marginBottom:24 }}>
                                    <label style={S.label}>Tingkat Aktivitas</label>
                                    <select className="cal-select" name="activityLevel" value={formData.activityLevel} onChange={handleChange} required
                                        style={{ ...S.input, appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center', paddingRight:36 }}>
                                        {ACTIVITY_LEVELS.map(a => <option key={a.val} value={a.val}>{a.label}</option>)}
                                    </select>
                                    <p style={{ fontSize:12, color:'#94a3b8', marginTop:6, marginBottom:0 }}>{getActivityLevelDescription(formData.activityLevel)}</p>
                                </div>

                                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    <button type="submit" className="cal-btnP" style={S.btnP} disabled={loading}>
                                        {loading ? <><span style={{ display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',marginRight:8,verticalAlign:'middle' }}/>Menghitung...</> : 'Hitung Kebutuhan Kalori'}
                                    </button>
                                    {result && <button type="button" className="cal-btnG" style={S.btnG} onClick={resetForm}>Hitung Ulang</button>}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Result ── */}
                    <div className="cal-fade" style={{ animationDelay:'.14s', display:'flex', flexDirection:'column', gap:16 }}>
                        {result ? (
                            <>
                                {/* Main result */}
                                <div style={S.card}>
                                    <div style={{ padding:'20px 24px', background:'#fef2f2', borderBottom:'1px solid #f1f5f9' }}>
                                        <div style={{ fontSize:13, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Kebutuhan Kalori Harian</div>
                                        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                                            <div style={{ fontSize:52, fontWeight:800, color:'#dc2626', lineHeight:1 }}>{result.dailyCalories}</div>
                                            <div style={{ paddingBottom:8, fontSize:14, color:'#dc2626', fontWeight:600 }}>kal/hari</div>
                                        </div>
                                        <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>BMR: <strong style={{ color:'#0f172a' }}>{result.bmr}</strong> kal/hari</div>
                                    </div>
                                    <div style={S.body}>
                                        {/* Recommendations */}
                                        <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Rekomendasi Asupan</div>
                                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
                                            {[
                                                { label:'Pertahankan berat',     val: result.recommendations?.maintain,   color:'#374151', bold:false },
                                                { label:'Turunkan (ringan)',      val: result.recommendations?.mildLoss,   color:'#374151', bold:false },
                                                { label:'Turunkan (sehat)',       val: result.recommendations?.weightLoss, color:'#16a34a', bold:true  },
                                                { label:'Naikkan (ringan)',       val: result.recommendations?.mildGain,   color:'#374151', bold:false },
                                                { label:'Naikkan (sehat)',        val: result.recommendations?.weightGain, color:'#2563eb', bold:true  },
                                            ].map(row => (
                                                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, background:'#f8fafc' }}>
                                                    <span style={{ fontSize:13, color:'#6b7280' }}>{row.label}</span>
                                                    <span style={{ fontSize:13, fontWeight:row.bold?700:600, color:row.color }}>{row.val} kal</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Meal distribution */}
                                        <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Distribusi Makan</div>
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                                            {MEAL_DIST.map(m => (
                                                <div key={m.label} style={{ background:m.bg, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                                                    <div style={{ color:m.color }}>{m.icon}</div>
                                                    <div>
                                                        <div style={{ fontSize:11, color:m.color, fontWeight:600 }}>{m.label}</div>
                                                        <div style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>{Math.round(result.dailyCalories*m.pct)}</div>
                                                        <div style={{ fontSize:10, color:'#94a3b8' }}>{(m.pct*100).toFixed(0)}%</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* CTA */}
                                <div style={{ ...S.card, padding:'16px 20px', display:'flex', gap:10 }}>
                                    <a href="/consultations" style={{ flex:1, textAlign:'center', padding:'10px', background:'#eff6ff', color:'#2563eb', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Konsultasi Online</a>
                                    <a href="/appointments"  style={{ flex:1, textAlign:'center', padding:'10px', background:'#f0fdf4', color:'#16a34a', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Janji Temu</a>
                                </div>
                            </>
                        ) : (
                            <div style={{ ...S.card, padding:32, textAlign:'center' }}>
                                <div style={{ width:64, height:64, borderRadius:16, background:'#fef2f2', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>
                                    <FaFire size={26}/>
                                </div>
                                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:8 }}>Hitung Kebutuhan Kalori</div>
                                <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom:20 }}>Masukkan data diri dan tingkat aktivitas untuk menghitung kebutuhan kalori harian Anda</p>
                                <div style={{ display:'flex', flexDirection:'column', gap:8, textAlign:'left' }}>
                                    {['⚡ Hitung BMR (Basal Metabolic Rate)','🏃‍♂️ Rekomendasi berdasarkan aktivitas','🎯 Target turun/naik berat badan'].map(t => (
                                        <div key={t} style={{ fontSize:13, color:'#6b7280', display:'flex', alignItems:'center', gap:8 }}>{t}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* BMR info */}
                        <div style={{ ...S.card, padding:'16px 20px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Faktor Aktivitas (BMR ×)</div>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                                {ACTIVITY_FACTORS.map(a => (
                                    <div key={a.key} style={{ textAlign:'center', padding:'8px 6px', background:formData.activityLevel===a.key?'#fef2f2':'#f8fafc', borderRadius:8, border:`1px solid ${formData.activityLevel===a.key?'#fecaca':'#e5e7eb'}` }}>
                                        <div style={{ fontSize:11, fontWeight:700, color:formData.activityLevel===a.key?'#dc2626':'#374151' }}>{getActivityLevelLabel(a.key)}</div>
                                        <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{a.factor}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalorieCalculator;