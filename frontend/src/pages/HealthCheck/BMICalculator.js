import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaWeight, FaRuler, FaArrowLeft } from 'react-icons/fa';
import { Link } from 'react-router-dom';

/* ── semua state & logika identik dengan aslinya ── */
const BMICalculator = () => {
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [unit,   setUnit]   = useState('cm');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error,  setError]  = useState('');

    const calculateBMI = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!weight || !height) { setError('Masukkan berat dan tinggi badan'); setLoading(false); return; }
        const weightNum = parseFloat(weight);
        const heightNum = parseFloat(height);
        if (isNaN(weightNum) || isNaN(heightNum)) { setError('Format angka tidak valid'); setLoading(false); return; }
        if (weightNum <= 0 || heightNum <= 0) { setError('Berat dan tinggi harus lebih dari 0'); setLoading(false); return; }
        if (unit === 'cm'       && (heightNum < 50  || heightNum > 300)) { setError('Tinggi badan harus antara 50-300 cm');        setLoading(false); return; }
        if (unit === 'm'        && (heightNum < 0.5 || heightNum > 3))   { setError('Tinggi badan harus antara 0.5-3 meter');      setLoading(false); return; }
        if (unit === 'imperial' && (heightNum < 1.6 || heightNum > 9.8)) { setError('Tinggi badan harus antara 1.6-9.8 feet');     setLoading(false); return; }

        try {
            console.log('Mengirim data:', { weight: weightNum, height: heightNum, unit });
            const response = await api.post('/api/health-check/calculate-bmi', { weight: weightNum, height: heightNum, unit });
            console.log('Response:', response.data);
            setResult(response.data);
            toast.success('BMI berhasil dihitung');
        } catch (error) {
            console.error('BMI Error:', error);
            const errorMsg = error.response?.data?.error || 'Gagal menghitung BMI';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally { setLoading(false); }
    };

    const getBMICategoryColor = (category) => {
        if (!category) return '#6b7280';
        const cat = category.toLowerCase();
        if (cat.includes('underweight'))                              return '#d97706';
        if (cat.includes('normal'))                                   return '#16a34a';
        if (cat.includes('overweight'))                               return '#d97706';
        if (cat.includes('obesitas') || cat.includes('obesity'))      return '#dc2626';
        return '#6b7280';
    };

    const getBMICategoryBg = (category) => {
        if (!category) return '#f3f4f6';
        const cat = category.toLowerCase();
        if (cat.includes('underweight'))                              return '#fef9c3';
        if (cat.includes('normal'))                                   return '#dcfce7';
        if (cat.includes('overweight'))                               return '#fef9c3';
        if (cat.includes('obesitas') || cat.includes('obesity'))      return '#fee2e2';
        return '#f3f4f6';
    };

    const getBMICategoryIcon = (category) => {
        if (!category) return 'ℹ️';
        const cat = category.toLowerCase();
        if (cat.includes('normal'))                                   return '✅';
        if (cat.includes('underweight'))                              return '⚠️';
        if (cat.includes('overweight'))                               return '⚠️';
        if (cat.includes('obesitas') || cat.includes('obesity'))      return '🔴';
        return 'ℹ️';
    };

    const resetForm = () => { setWeight(''); setHeight(''); setResult(null); setError(''); setUnit('cm'); };

    const UNIT_OPTS = [
        { val:'cm',       label:'Centimeter (cm) & Kilogram (kg)',  hint:'Contoh: Tinggi 175 cm, Berat 70 kg'     },
        { val:'m',        label:'Meter (m) & Kilogram (kg)',         hint:'Contoh: Tinggi 1.75 m, Berat 70 kg'    },
        { val:'imperial', label:'Feet (ft) & Pounds (lb)',           hint:'Contoh: Tinggi 5.7 ft, Berat 154 lb'   },
    ];

    const BMI_TABLE = [
        { range:'< 18.5',      label:'Underweight', desc:'Kekurangan berat badan', color:'#d97706', bg:'#fef9c3' },
        { range:'18.5 – 24.9', label:'Normal',      desc:'Berat badan ideal',       color:'#16a34a', bg:'#dcfce7' },
        { range:'25.0 – 29.9', label:'Overweight',  desc:'Kelebihan berat badan',   color:'#d97706', bg:'#fef9c3' },
        { range:'≥ 30.0',      label:'Obesitas',    desc:'Sangat kelebihan berat',  color:'#dc2626', bg:'#fee2e2' },
    ];

    const S = {
        page  : { background:'#fafafa', minHeight:'100vh', padding:'40px 0 80px', fontFamily:"'Poppins', sans-serif" },
        wrap  : { maxWidth:880, margin:'0 auto', padding:'0 24px' },
        label : { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 },
        input : { width:'100%', padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .15s', boxSizing:'border-box' },
        card  : { background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden' },
        chHead: { padding:'16px 24px', borderBottom:'1px solid #f1f5f9', fontSize:14, fontWeight:700, color:'#0f172a' },
        body  : { padding:'24px' },
        pill  : (color,bg) => ({ display:'inline-block', background:bg, color:color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }),
        btnPrimary: { width:'100%', padding:'12px', background:'#0f172a', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', transition:'background .15s', fontFamily:'inherit' },
        btnGhost  : { width:'100%', padding:'12px', background:'transparent', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
        radioWrap : { display:'flex', flexDirection:'column', gap:10 },
        radioRow  : (checked) => ({ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1px solid ${checked?'#2563eb':'#e5e7eb'}`, background:checked?'#eff6ff':'#fff', cursor:'pointer', transition:'all .15s' }),
        unitDot   : (checked) => ({ width:16, height:16, borderRadius:'50%', border:`2px solid ${checked?'#2563eb':'#d1d5db'}`, background:checked?'#2563eb':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }),
        unitDotIn : { width:6, height:6, borderRadius:'50%', background:'#fff' },
    };

    return (
        <div style={S.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                .bmi-input:focus{border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
                .bmi-btn-primary:hover:not(:disabled){background:#1e293b!important}
                .bmi-btn-primary:disabled{opacity:.5;cursor:not-allowed}
                .bmi-btn-ghost:hover{background:#f9fafb!important}
                @keyframes bmiUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .bmi-fade{animation:bmiUp .35s ease both}
            `}</style>
            <div style={S.wrap}>

                {/* Back + Header */}
                <div className="bmi-fade" style={{ marginBottom:32 }}>
                    <Link to="/health-check" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#6b7280', textDecoration:'none', marginBottom:20 }}>
                        <FaArrowLeft size={11}/> Kembali
                    </Link>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'#eff6ff', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <FaWeight size={18}/>
                        </div>
                        <div>
                            <h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:28, fontWeight:400, color:'#0f172a', margin:0 }}>Kalkulator BMI</h1>
                            <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Indeks Massa Tubuh · Standar WHO</p>
                        </div>
                    </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

                    {/* ── Form ── */}
                    <div className="bmi-fade" style={{ ...S.card, animationDelay:'.08s' }}>
                        <div style={S.chHead}>📝 Masukkan Data</div>
                        <div style={S.body}>
                            {error && (
                                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#b91c1c' }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            <form onSubmit={calculateBMI}>
                                {/* Unit */}
                                <div style={{ marginBottom:20 }}>
                                    <label style={S.label}><FaRuler size={11} style={{ marginRight:6 }}/>Unit Pengukuran</label>
                                    <div style={S.radioWrap}>
                                        {UNIT_OPTS.map(o => (
                                            <label key={o.val} style={S.radioRow(unit===o.val)} onClick={() => setUnit(o.val)}>
                                                <div style={S.unitDot(unit===o.val)}>{unit===o.val && <div style={S.unitDotIn}/>}</div>
                                                <span style={{ fontSize:13, color:'#374151', fontWeight: unit===o.val?600:400 }}>{o.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p style={{ fontSize:12, color:'#94a3b8', marginTop:8, marginBottom:0 }}>
                                        {UNIT_OPTS.find(o=>o.val===unit)?.hint}
                                    </p>
                                </div>

                                {/* Weight + Height */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
                                    <div>
                                        <label style={S.label}><FaWeight size={11} style={{ marginRight:6 }}/>Berat Badan</label>
                                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                            <input className="bmi-input" style={S.input} type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}
                                                placeholder={unit==='imperial'?'Pounds':'Kilogram'} required />
                                            <span style={{ fontSize:13, color:'#94a3b8', fontWeight:600, flexShrink:0 }}>{unit==='imperial'?'lb':'kg'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={S.label}><FaRuler size={11} style={{ marginRight:6 }}/>Tinggi Badan</label>
                                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                            <input className="bmi-input" style={S.input} type="number" step={unit==='cm'?'1':'0.01'} value={height} onChange={e=>setHeight(e.target.value)}
                                                placeholder={unit==='imperial'?'Feet':unit==='cm'?'Centimeter':'Meter'} required />
                                            <span style={{ fontSize:13, color:'#94a3b8', fontWeight:600, flexShrink:0 }}>{unit==='imperial'?'ft':unit==='cm'?'cm':'m'}</span>
                                        </div>
                                        <p style={{ fontSize:11, color:'#94a3b8', marginTop:5, marginBottom:0 }}>
                                            {unit==='cm'?'Contoh: 175':unit==='m'?'Contoh: 1.75':'Contoh: 5.7'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    <button type="submit" className="bmi-btn-primary" style={S.btnPrimary} disabled={loading}>
                                        {loading ? <><span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', marginRight:8, verticalAlign:'middle' }}/>Menghitung...</> : 'Hitung BMI'}
                                    </button>
                                    {result && <button type="button" className="bmi-btn-ghost" style={S.btnGhost} onClick={resetForm}>Hitung Ulang</button>}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Result ── */}
                    <div className="bmi-fade" style={{ animationDelay:'.14s' }}>
                        {result ? (
                            <div style={S.card}>
                                {/* Result header */}
                                <div style={{ padding:'20px 24px', background: getBMICategoryBg(result.category), borderBottom:'1px solid #f1f5f9' }}>
                                    <div style={{ fontSize:13, fontWeight:600, color:'#6b7280', marginBottom:6 }}>Hasil BMI Anda</div>
                                    <div style={{ display:'flex', alignItems:'flex-end', gap:12 }}>
                                        <div style={{ fontSize:52, fontWeight:800, color: getBMICategoryColor(result.category), lineHeight:1 }}>{result.bmi}</div>
                                        <div style={{ paddingBottom:6 }}>
                                            <div style={{ ...S.pill(getBMICategoryColor(result.category), 'rgba(255,255,255,.6)'), fontSize:12 }}>
                                                {getBMICategoryIcon(result.category)} {result.category}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={S.body}>
                                    {/* Advice */}
                                    <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                                        {result.advice}
                                    </div>

                                    {/* BMI Table */}
                                    <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>
                                        Klasifikasi BMI (WHO)
                                    </div>
                                    <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
                                        {BMI_TABLE.map(row => (
                                            <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:8, background:row.bg, opacity: result.category?.toLowerCase().includes(row.label.toLowerCase())?1:0.5 }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                                    <span style={{ ...S.pill(row.color, 'rgba(255,255,255,.5)', ), fontSize:10 }}>{row.range}</span>
                                                    <span style={{ fontSize:13, fontWeight:600, color:row.color }}>{row.label}</span>
                                                </div>
                                                <span style={{ fontSize:11, color:row.color }}>{row.desc}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Detail */}
                                    {result.details && (
                                        <div style={{ fontSize:12, color:'#94a3b8', background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginBottom:20 }}>
                                            Berat: {result.details.weight?.toFixed(1)} kg · Tinggi: {result.details.height?.toFixed(2)} m · Rumus: {result.details.weight?.toFixed(1)} / ({result.details.height?.toFixed(2)}²) = {result.bmi}
                                        </div>
                                    )}

                                    {/* CTA */}
                                    <div style={{ display:'flex', gap:10 }}>
                                        <a href="/consultations" style={{ flex:1, textAlign:'center', padding:'10px', background:'#eff6ff', color:'#2563eb', border:'none', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Konsultasi Online</a>
                                        <a href="/appointments"  style={{ flex:1, textAlign:'center', padding:'10px', background:'#f0fdf4', color:'#16a34a', border:'none', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none' }}>Janji Temu</a>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...S.card, padding:32, textAlign:'center' }}>
                                <div style={{ width:64, height:64, borderRadius:16, background:'#eff6ff', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>
                                    <FaWeight size={26}/>
                                </div>
                                <div style={{ fontSize:16, fontWeight:600, color:'#0f172a', marginBottom:8 }}>Belum ada hasil</div>
                                <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6, marginBottom:20 }}>Masukkan berat dan tinggi badan untuk menghitung BMI</p>
                                <div style={{ background:'#f8fafc', borderRadius:10, padding:'14px 16px', textAlign:'left', fontSize:13 }}>
                                    <div style={{ fontWeight:600, color:'#374151', marginBottom:8 }}>Contoh perhitungan</div>
                                    <div style={{ color:'#6b7280' }}>Berat: <strong style={{ color:'#0f172a' }}>70 kg</strong></div>
                                    <div style={{ color:'#6b7280' }}>Tinggi: <strong style={{ color:'#0f172a' }}>175 cm</strong></div>
                                    <div style={{ marginTop:8, color:'#2563eb', fontWeight:700 }}>BMI: 22.9 → Normal ✅</div>
                                </div>
                            </div>
                        )}

                        {/* Info box */}
                        <div style={{ ...S.card, marginTop:16, padding:'16px 20px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Apa itu BMI?</div>
                            <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.65, margin:0 }}>
                                Body Mass Index adalah ukuran berat badan relatif terhadap tinggi badan. BMI membantu mengidentifikasi kategori berat badan, namun tidak mengukur lemak secara langsung — interpretasikan bersama tenaga kesehatan.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
};

export default BMICalculator;