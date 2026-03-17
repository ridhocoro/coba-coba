/**
 * Admin — Pengaturan Klinik
 * Upload logo, upload stempel, edit nama & alamat klinik.
 * Route: /admin/clinic-settings
 */
import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ClinicSettings = () => {
    const [settings, setSettings]   = useState(null);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [uploadingLogo,  setUploadingLogo]  = useState(false);
    const [uploadingStamp, setUploadingStamp] = useState(false);

    const [form, setForm] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '' });

    const logoRef  = useRef(null);
    const stampRef = useRef(null);

    const fmtUrl = (url) => url
        ? (url.startsWith('http') ? url : `${API_URL}${url}`)
        : null;

    const fetchSettings = async () => {
        try {
            const r = await api.get('/api/clinic-settings');
            const s = r.data.settings;
            setSettings(s);
            setForm({
                clinicName:    s.clinicName    || '',
                clinicAddress: s.clinicAddress || '',
                clinicPhone:   s.clinicPhone   || '',
            });
        } catch {
            toast.error('Gagal memuat pengaturan klinik');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleSaveInfo = async (e) => {
        e.preventDefault();
        if (!form.clinicName.trim()) { toast.error('Nama klinik wajib diisi'); return; }
        setSaving(true);
        try {
            const r = await api.put('/api/clinic-settings', form);
            setSettings(r.data.settings);
            toast.success('Informasi klinik berhasil disimpan ✅');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    const handleUpload = async (field, file, ref) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5 MB'); return; }

        const setUploading = field === 'logo' ? setUploadingLogo : setUploadingStamp;
        const endpoint     = field === 'logo' ? '/api/clinic-settings/logo' : '/api/clinic-settings/stamp';
        const fieldName    = field === 'logo' ? 'logo' : 'stamp';

        setUploading(true);
        try {
            const fd = new FormData();
            fd.append(fieldName, file);
            const r = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSettings(prev => ({
                ...prev,
                ...(field === 'logo' ? { logoUrl: r.data.logoUrl } : { stampUrl: r.data.stampUrl }),
            }));
            toast.success(`${field === 'logo' ? 'Logo' : 'Stempel'} berhasil diupload ✅`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal upload');
        } finally {
            setUploading(false);
            if (ref.current) ref.current.value = '';
        }
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat pengaturan klinik...</p>
        </Container>
    );

    const logoUrl  = fmtUrl(settings?.logoUrl);
    const stampUrl = fmtUrl(settings?.stampUrl);

    return (
        <Container fluid className="py-4 px-4" style={{ maxWidth: 900 }}>
            {/* Header */}
            <div className="d-flex align-items-center gap-3 mb-4">
                <div style={{ fontSize: 32 }}>🏥</div>
                <div>
                    <h4 className="mb-0 fw-bold">Pengaturan Klinik</h4>
                    <p className="text-muted small mb-0">Kelola informasi, logo, dan stempel klinik yang digunakan di dokumen PDF</p>
                </div>
            </div>

            <Row className="g-4">
                {/* ── Informasi Klinik ── */}
                <Col xs={12}>
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white border-bottom fw-semibold">
                            📋 Informasi Klinik
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleSaveInfo}>
                                <Row className="g-3">
                                    <Col xs={12} md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">
                                                Nama Klinik <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                value={form.clinicName}
                                                onChange={e => setForm(f => ({ ...f, clinicName: e.target.value }))}
                                                placeholder="mis. Klinik Pratama IPB"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">No. Telepon Klinik</Form.Label>
                                            <Form.Control
                                                value={form.clinicPhone}
                                                onChange={e => setForm(f => ({ ...f, clinicPhone: e.target.value }))}
                                                placeholder="mis. (0251) 123-4567"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">Alamat Klinik</Form.Label>
                                            <Form.Control
                                                value={form.clinicAddress}
                                                onChange={e => setForm(f => ({ ...f, clinicAddress: e.target.value }))}
                                                placeholder="mis. Jl. Raya Dramaga, Bogor, Jawa Barat"
                                            />
                                            <Form.Text className="text-muted">
                                                Ditampilkan di header surat sakit dan dokumen PDF lainnya.
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <div className="mt-3">
                                    <Button type="submit" variant="primary" disabled={saving}>
                                        {saving ? <><Spinner size="sm" className="me-2" />Menyimpan...</> : '💾 Simpan Informasi'}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* ── Logo Klinik ── */}
                <Col xs={12} md={6}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-bottom fw-semibold">
                            🖼️ Logo Klinik
                        </Card.Header>
                        <Card.Body>
                            <p className="text-muted small mb-3">
                                Logo ditampilkan di header surat sakit dan dokumen resmi lainnya.
                                Gunakan gambar dengan latar transparan atau putih.
                            </p>

                            {/* Preview */}
                            <div style={{
                                width: '100%', height: 140, border: '2px dashed #dee2e6', borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#f8f9fa', marginBottom: 16, overflow: 'hidden',
                            }}>
                                {logoUrl
                                    ? <img src={logoUrl} alt="Logo klinik" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                                    : <div className="text-center text-muted">
                                        <div style={{ fontSize: 40 }}>🏥</div>
                                        <small>Belum ada logo</small>
                                    </div>
                                }
                            </div>

                            <input
                                type="file"
                                ref={logoRef}
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: 'none' }}
                                onChange={e => handleUpload('logo', e.target.files?.[0], logoRef)}
                            />
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    disabled={uploadingLogo}
                                    onClick={() => logoRef.current?.click()}
                                >
                                    {uploadingLogo
                                        ? <><Spinner size="sm" className="me-1" />Mengupload...</>
                                        : '📤 Upload Logo'
                                    }
                                </Button>
                                {logoUrl && <Badge bg="success" className="py-2">✓ Sudah ada logo</Badge>}
                            </div>
                            <small className="text-muted d-block mt-2">JPG · PNG · WEBP · maks 5 MB · Rekomendasi: 300×300 px</small>
                        </Card.Body>
                    </Card>
                </Col>

                {/* ── Stempel Klinik ── */}
                <Col xs={12} md={6}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-bottom fw-semibold">
                            🔏 Stempel Klinik
                        </Card.Header>
                        <Card.Body>
                            <p className="text-muted small mb-3">
                                Stempel dicetak di pojok kiri bawah surat sakit PDF.
                                Bisa berupa stempel resmi klinik atau kombinasi logo + teks.
                            </p>

                            {/* Preview */}
                            <div style={{
                                width: '100%', height: 140, border: '2px dashed #dee2e6', borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#f8f9fa', marginBottom: 16, overflow: 'hidden',
                            }}>
                                {stampUrl
                                    ? <img src={stampUrl} alt="Stempel klinik" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                                    : <div className="text-center text-muted">
                                        <div style={{ fontSize: 40 }}>🔏</div>
                                        <small>Belum ada stempel</small>
                                    </div>
                                }
                            </div>

                            <input
                                type="file"
                                ref={stampRef}
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: 'none' }}
                                onChange={e => handleUpload('stamp', e.target.files?.[0], stampRef)}
                            />
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    disabled={uploadingStamp}
                                    onClick={() => stampRef.current?.click()}
                                >
                                    {uploadingStamp
                                        ? <><Spinner size="sm" className="me-1" />Mengupload...</>
                                        : '📤 Upload Stempel'
                                    }
                                </Button>
                                {stampUrl && <Badge bg="success" className="py-2">✓ Sudah ada stempel</Badge>}
                            </div>
                            <small className="text-muted d-block mt-2">JPG · PNG · WEBP · maks 5 MB · Rekomendasi: 300×300 px</small>
                        </Card.Body>
                    </Card>
                </Col>

                {/* ── Pratinjau di PDF ── */}
                <Col xs={12}>
                    <Alert variant="info" className="small mb-0">
                        <strong>ℹ️ Catatan:</strong> Logo dan stempel digunakan di surat sakit PDF yang digenerate sistem.
                        Jika file belum diupload, posisi stempel/tanda tangan akan menampilkan kotak placeholder.
                        Pastikan format file PNG dengan latar transparan untuk hasil terbaik.
                    </Alert>
                </Col>
            </Row>
        </Container>
    );
};

export default ClinicSettings;