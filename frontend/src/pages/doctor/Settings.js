import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Container, Card, Form, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { FaCog, FaSave, FaArrowLeft } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const DoctorSettings = () => {
    const [settings, setSettings] = useState({
        allowChat: true,
        allowVideoCall: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/api/doctors/my/profile')
            .then(r => {
                const s = r.data.doctor?.consultationSettings || {};
                setSettings({
                    allowChat:      s.allowChat      !== false,
                    allowVideoCall: s.allowVideoCall !== false,
                });
            })
            .catch(() => toast.error('Gagal memuat profil'))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!settings.allowChat && !settings.allowVideoCall) {
            toast.error('Minimal satu fitur konsultasi harus diaktifkan');
            return;
        }
        setSaving(true);
        try {
            await api.put('/api/doctors/my/settings', settings);
            toast.success('Pengaturan berhasil disimpan');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan pengaturan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
        </Container>
    );

    const features = [
        {
            key: 'allowChat',
            icon: '💬',
            label: 'Chat',
            desc: 'Pasien dapat berkonsultasi lewat pesan teks dan foto',
        },
        {
            key: 'allowVideoCall',
            icon: '📹',
            label: 'Video Call',
            desc: 'Pasien dapat melakukan konsultasi tatap muka virtual',
        },
    ];

    return (
        <Container className="py-4" style={{ maxWidth: 600 }}>
            <Button as={Link} to="/doctor" variant="link" className="p-0 text-muted mb-3 d-block">
                <FaArrowLeft className="me-1" /> Dashboard
            </Button>
            <h4 className="fw-bold mb-1">
                <FaCog className="me-2 text-secondary" />
                Pengaturan Konsultasi
            </h4>
            <p className="text-muted small mb-4">
                Atur fitur konsultasi yang ingin Anda aktifkan. Fitur yang dinonaktifkan tidak akan tersedia untuk pasien saat memilih dokter.
            </p>

            <Form onSubmit={handleSave}>
                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">Fitur yang Tersedia untuk Pasien</h6>
                        <div className="d-flex flex-column gap-3">
                            {features.map(f => (
                                <div key={f.key} style={{
                                    border: `2px solid ${settings[f.key] ? '#0d6efd' : '#dee2e6'}`,
                                    borderRadius: 12, padding: '14px 16px',
                                    background: settings[f.key] ? '#f0f6ff' : '#f8f9fa',
                                    transition: 'all 0.2s'
                                }}>
                                    <Row className="align-items-center">
                                        <Col>
                                            <div className="d-flex align-items-center gap-2">
                                                <span style={{ fontSize: 24 }}>{f.icon}</span>
                                                <div>
                                                    <div className="fw-semibold">{f.label}</div>
                                                    <div className="text-muted small">{f.desc}</div>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col xs="auto">
                                            <Form.Check
                                                type="switch"
                                                id={`switch-${f.key}`}
                                                checked={settings[f.key]}
                                                onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.checked }))}
                                            />
                                        </Col>
                                    </Row>
                                </div>
                            ))}
                        </div>

                        {!settings.allowChat && !settings.allowVideoCall && (
                            <Alert variant="danger" className="mt-3 py-2 small">
                                ⚠️ Minimal satu fitur harus diaktifkan agar pasien bisa membuat konsultasi.
                            </Alert>
                        )}
                    </Card.Body>
                </Card>

                <div className="d-flex justify-content-between align-items-center">
                    <div className="text-muted small">
                        Perubahan berlaku segera untuk konsultasi baru.
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={saving || (!settings.allowChat && !settings.allowVideoCall)}
                    >
                        {saving ? <><Spinner size="sm" className="me-1" />Menyimpan...</> : <><FaSave className="me-1" />Simpan Pengaturan</>}
                    </Button>
                </div>
            </Form>
        </Container>
    );
};

export default DoctorSettings;
