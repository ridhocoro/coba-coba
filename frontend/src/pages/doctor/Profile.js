import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    API_URL, colors, fmtDate, fmtDT, toMin, toHHMM,
    CONS_SLOTS, APPT_SLOTS, DAYS_INFO, makeEmptySchedule, DEF_CONS, DEF_APPT,
    CONS_STATUS, APPT_STATUS,
    Card, Btn, Spinner, Empty, SBadge, Toggle, Modal, SectionHeader,
    ScheduleGrid, SchedulePreview, TH, TD, ProfileField, InputField,
} from './shared';



const SectionProfile = () => {
    const [form, setForm] = useState({ name: '', specialization: '', qualification: '', gender: '', bio: '', experience: '' });
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [uploading, setUploading]     = useState(false);
    const [uploadingSig, setUploadingSig] = useState(false);
    const [photoUrl, setPhotoUrl]       = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');
    const [consultationFee, setConsultationFee] = useState(null);
    const fileRef  = useRef(null);
    const sigRef   = useRef(null);
    // ── Ubah Password ──
    const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [showPw, setShowPw]     = useState({ current: false, new: false, confirm: false });

    useEffect(() => {
        api.get('/api/doctors/my/profile')
            .then(r => {
                const d = r.data.doctor;
                if (!d) return;
                setForm({
                    name:           d.name           || '',
                    specialization: d.specialization || '',
                    qualification:  d.qualification  || '',
                    gender:         d.gender         || '',
                    bio:            d.bio            || '',
                    experience:     d.experience     != null ? String(d.experience) : '',
                });
                setPhotoUrl(d.photo || '');
                setSignatureUrl(d.signatureUrl || '');
                setConsultationFee(d.consultationFee ?? null);
            })
            .catch(() => toast.error('Gagal memuat profil'))
            .finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        if (!form.name.trim())           { toast.error('Nama wajib diisi'); return; }
        if (!form.specialization.trim()) { toast.error('Spesialisasi wajib diisi'); return; }
        setSaving(true);
        try {
            const r = await api.put('/api/doctors/my/profile', form);
            setForm(f => ({ ...f, ...r.data.doctor }));
            toast.success('Profil berhasil disimpan ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan profil'); }
        finally { setSaving(false); }
    };

    const savePassword = async () => {
        if (!pwForm.currentPassword) { toast.error('Password lama wajib diisi'); return; }
        if (pwForm.newPassword.length < 6) { toast.error('Password baru minimal 6 karakter'); return; }
        if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Konfirmasi password tidak cocok'); return; }
        setPwSaving(true);
        try {
            await api.put('/api/users/change-password', {
                currentPassword: pwForm.currentPassword,
                newPassword    : pwForm.newPassword,
            });
            toast.success('Password berhasil diubah ✅');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal mengubah password'); }
        finally { setPwSaving(false); }
    };

    const handlePhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran foto maksimal 5 MB'); return; }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('photo', file);
            const r = await api.post('/api/doctors/my/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPhotoUrl(r.data.photoUrl);
            toast.success('Foto profil diperbarui ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal upload foto'); }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    };

    const handleSignature = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5 MB'); return; }
        setUploadingSig(true);
        try {
            const fd = new FormData();
            fd.append('signature', file);
            const r = await api.post('/api/doctors/my/signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSignatureUrl(r.data.signatureUrl);
            toast.success('Tanda tangan berhasil diupload ✅');
        } catch (e) { toast.error(e.response?.data?.message || 'Gagal upload tanda tangan'); }
        finally { setUploadingSig(false); if (sigRef.current) sigRef.current.value = ''; }
    };

    if (loading) return <Spinner />;

    const fullPhoto = photoUrl
        ? (photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`)
        : null;
    const fullSig = signatureUrl
        ? (signatureUrl.startsWith('http') ? signatureUrl : `${API_URL}${signatureUrl}`)
        : null;

    return (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <SectionHeader title="Profil Saya" subtitle="Informasi profil dokter yang tampil kepada pasien" />

            {/* ── Avatar + cover card ── */}
            <Card style={{ marginBottom: 18, overflow: 'hidden' }}>
                {/* Cover gradient */}
                <div style={{ height: 110, background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #0ea5e9 100%)', borderRadius: '14px 14px 0 0' }} />

                {/* Centered avatar block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 28px' }}>
                    {/* Avatar — overlaps cover */}
                    <div style={{ position: 'relative', marginTop: -52 }}>
                        <div style={{
                            width: 104, height: 104, borderRadius: 26, overflow: 'hidden',
                            background: '#e2e8f0', border: '4px solid #fff',
                            boxShadow: '0 6px 20px rgba(0,0,0,.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {fullPhoto
                                ? <img src={fullPhoto} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = ''; }} />
                                : <span style={{ fontSize: 44 }}>👨‍⚕️</span>}
                        </div>
                        {uploading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)', borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: colors.primary, fontWeight: 700 }}>⬆</div>
                        )}
                    </div>

                    {/* Name & specialization */}
                    <div style={{ textAlign: 'center', marginTop: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: colors.text, lineHeight: 1.2 }}>
                            {form.name || 'Nama Dokter'}
                        </div>
                        <div style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                            {form.specialization || 'Spesialisasi'}
                            {form.qualification ? <span style={{ color: colors.subtle }}> · {form.qualification}</span> : ''}
                        </div>
                        {(form.experience || form.gender) && (
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                {form.gender && (
                                    <span style={{ fontSize: 12, background: '#f1f5f9', color: colors.muted, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                                        {form.gender === 'Laki-laki' ? '👨' : '👩'} {form.gender}
                                    </span>
                                )}
                                {form.experience && (
                                    <span style={{ fontSize: 12, background: '#eff6ff', color: colors.primary, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                                        🩺 {form.experience} tahun pengalaman
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Upload button */}
                    <div style={{ marginTop: 16 }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" ref={fileRef} onChange={handlePhoto} style={{ display: 'none' }} />
                        <Btn size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            {uploading ? '⬆ Mengunggah…' : '📷 Ganti Foto'}
                        </Btn>
                        <div style={{ fontSize: 10, color: colors.subtle, marginTop: 5, textAlign: 'center' }}>JPG · PNG · WEBP · maks 5 MB</div>
                    </div>
                </div>
            </Card>

            {/* ── Form card ── */}
            <Card style={{ padding: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Row 1: Nama */}
                    <ProfileField label="Nama Lengkap" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="dr. Nama Lengkap, Sp.X" />

                    {/* Row 2: Spesialisasi + Pendidikan */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <ProfileField label="Spesialisasi" value={form.specialization} onChange={v => setForm(f => ({ ...f, specialization: v }))} required placeholder="mis. Umum, Penyakit Dalam" />
                        <ProfileField label="Pendidikan / Gelar" value={form.qualification} onChange={v => setForm(f => ({ ...f, qualification: v }))} placeholder="mis. S.Ked, dr., Sp.PD" />
                    </div>

                    {/* Row 3: Gender + Pengalaman */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Jenis Kelamin</label>
                            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                                <option value="">— Pilih —</option>
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                            </select>
                        </div>
                        <ProfileField label="Pengalaman (tahun)" value={form.experience} onChange={v => setForm(f => ({ ...f, experience: v }))} placeholder="mis. 5" hint="Masukkan angka tahun pengalaman" />
                    </div>

                    {/* Row 4: Bio */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>Bio / Deskripsi Singkat</label>
                        <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={4}
                            placeholder="Tuliskan deskripsi singkat tentang keahlian dan pengalaman Anda..."
                            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                </div>

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
                    <Btn onClick={saveProfile} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} size="lg">
                        {saving ? '…' : '💾 Simpan Profil'}
                    </Btn>
                </div>
            </Card>

            {/* ── Biaya Konsultasi (read-only) ── */}
            <Card style={{ padding: 24, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 4 }}>💰 Biaya Konsultasi</div>
                        <div style={{ fontSize: 13, color: colors.muted }}>Biaya hanya dapat diubah oleh admin klinik.</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>
                        {consultationFee !== null
                            ? `Rp ${Number(consultationFee).toLocaleString('id-ID')}`
                            : <span style={{ color: colors.muted, fontSize: 14 }}>Belum diatur</span>
                        }
                    </div>
                </div>
            </Card>

            {/* ── Tanda Tangan Digital ── */}
            <Card style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 4 }}>✍️ Tanda Tangan Digital</div>
                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
                    Tanda tangan ini akan dicetak di pojok kanan bawah surat sakit PDF. Gunakan gambar dengan latar belakang putih atau transparan.
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Preview */}
                    <div style={{
                        width: 180, height: 100, border: `2px dashed ${colors.border}`, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fafafa', overflow: 'hidden', flexShrink: 0,
                    }}>
                        {fullSig
                            ? <img src={fullSig} alt="Tanda tangan" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <span style={{ fontSize: 12, color: colors.muted, textAlign: 'center', padding: 8 }}>Belum ada tanda tangan</span>
                        }
                    </div>
                    <div style={{ flex: 1 }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" ref={sigRef} onChange={handleSignature} style={{ display: 'none' }} />
                        <Btn size="sm" variant="outline" onClick={() => sigRef.current?.click()} disabled={uploadingSig}>
                            {uploadingSig ? '⬆ Mengunggah…' : '📤 Upload Tanda Tangan'}
                        </Btn>
                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 6 }}>JPG · PNG · WEBP · maks 5 MB</div>
                        <div style={{ fontSize: 11, color: colors.subtle, marginTop: 2 }}>Disarankan: ukuran 400×200 px, latar putih</div>
                    </div>
                </div>
            </Card>
            {/* ── Ubah Password ── */}
            <Card style={{ padding: 24, marginTop: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.text, marginBottom: 4 }}>🔒 Ubah Password</div>
                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>
                    Gunakan password yang kuat dan berbeda dari sebelumnya.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { key: 'currentPassword', label: 'Password Lama',    pwKey: 'current' },
                        { key: 'newPassword',     label: 'Password Baru',    pwKey: 'new' },
                        { key: 'confirmPassword', label: 'Konfirmasi Password Baru', pwKey: 'confirm' },
                    ].map(({ key, label, pwKey }) => (
                        <div key={key}>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>{label}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPw[pwKey] ? 'text' : 'password'}
                                    value={pwForm[key]}
                                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                                    placeholder={label}
                                    style={{
                                        width: '100%', padding: '9px 40px 9px 12px',
                                        border: `1px solid ${colors.border}`, borderRadius: 9,
                                        fontSize: 13, fontFamily: 'inherit', outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(p => ({ ...p, [pwKey]: !p[pwKey] }))}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 15, color: colors.muted, lineHeight: 1,
                                    }}
                                >{showPw[pwKey] ? '🙈' : '👁️'}</button>
                            </div>
                        </div>
                    ))}
                    {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                        <div style={{ fontSize: 12, color: colors.danger }}>⚠️ Konfirmasi password tidak cocok</div>
                    )}
                    {pwForm.newPassword && pwForm.newPassword.length < 6 && (
                        <div style={{ fontSize: 12, color: colors.warning }}>⚠️ Password minimal 6 karakter</div>
                    )}
                </div>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
                    <Btn
                        onClick={savePassword}
                        disabled={pwSaving || !pwForm.currentPassword || pwForm.newPassword.length < 6 || pwForm.newPassword !== pwForm.confirmPassword}
                        variant="warning"
                        style={{ width: '100%', justifyContent: 'center' }}
                        size="lg"
                    >
                        {pwSaving ? '…' : '🔒 Ubah Password'}
                    </Btn>
                </div>
            </Card>
        </div>
    );
};

export default SectionProfile;