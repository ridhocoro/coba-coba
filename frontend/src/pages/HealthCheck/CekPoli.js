import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { FaRobot, FaStethoscope, FaArrowRight, FaHospitalAlt, FaTooth, FaBabyCarriage, FaAppleAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
            const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/health-check/recommend-poli`, {
                keluhan
            });

            if (response.data.success) {
                setResult(response.data);
            } else {
                setError(response.data.message || 'Gagal memproses rekomendasi Poli.');
            }
        } catch (err) {
            console.error(err);
            setError('Gagal menghubungi AI Triage Klinik IPB. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const handleLanjutBooking = () => {
        // Navigasi ke halaman buat janji temu
        navigate('/consultations');
    };

    const getPoliTheme = (poliName) => {
        switch(poliName) {
            case 'Poli Gigi': return { bg: '#e0e7ff', color: '#4f46e5', icon: <FaTooth size={40} /> };
            case 'Poli KIA': return { bg: '#fce7f3', color: '#db2777', icon: <FaBabyCarriage size={40} /> };
            case 'Poli Gizi': return { bg: '#dcfce7', color: '#16a34a', icon: <FaAppleAlt size={40} /> };
            default: return { bg: '#e0f2fe', color: '#0284c7', icon: <FaStethoscope size={40} /> };
        }
    };

    return (
        <Container className="py-5" style={{ minHeight: '80vh' }}>
            <Row className="justify-content-center mb-4">
                <Col md={8} className="text-center">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 60, height: 60,
                        backgroundColor: '#eff6ff',
                        color: '#3b82f6',
                        borderRadius: '50%',
                        marginBottom: 16
                    }}>
                        <FaRobot size={32} />
                    </div>
                    <h2 className="fw-bold" style={{ color: '#1e293b' }}>Smart Triage AI</h2>
                    <p className="text-muted" style={{ fontSize: '1.1rem' }}>
                        Bingung harus periksa ke poli mana? Ceritakan keluhan Anda secara bebas, dan biarkan AI kami mengarahkan Anda ke dokter yang tepat.
                    </p>
                </Col>
            </Row>

            <Row className="justify-content-center">
                <Col md={8} lg={6}>
                    <Card className="border-0 shadow-sm" style={{ borderRadius: 16, overflow: 'hidden' }}>
                        <Card.Body className="p-4 p-md-5">
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold text-secondary">Apa yang Anda rasakan hari ini?</Form.Label>
                                    <Form.Control 
                                        as="textarea" 
                                        rows={4}
                                        placeholder="Contoh: Saya sudah batuk 3 hari dan badan terasa panas saat malam, kadang disertai pusing..."
                                        value={keluhan}
                                        onChange={(e) => setKeluhan(e.target.value)}
                                        style={{ 
                                            borderRadius: 12, 
                                            padding: 16, 
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #cbd5e1',
                                            resize: 'none'
                                        }}
                                    />
                                </Form.Group>

                                {error && <Alert variant="danger" className="border-0" style={{ borderRadius: 8 }}>{error}</Alert>}

                                <Button 
                                    type="submit" 
                                    className="w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                                    disabled={loading || !keluhan.trim()}
                                    style={{ 
                                        borderRadius: 12, 
                                        backgroundColor: '#0f172a', 
                                        border: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {loading ? (
                                        <><Spinner size="sm" animation="border" /> Memproses Analisis...</>
                                    ) : (
                                        <>Cek Rekomendasi Poli <FaArrowRight /></>
                                    )}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>

                    {result && (
                        <div className="mt-4 animate__animated animate__fadeInUp">
                            <Card className="border-0 shadow-sm" style={{ borderRadius: 16 }}>
                                <Card.Body className="p-4">
                                    <h5 className="fw-bold text-center mb-4" style={{ color: '#475569' }}>Hasil Analisis AI</h5>
                                    
                                    <div className="text-center mb-4 p-4" style={{ 
                                        backgroundColor: getPoliTheme(result.recommendedPoli).bg, 
                                        borderRadius: 16 
                                    }}>
                                        <div style={{ color: getPoliTheme(result.recommendedPoli).color, marginBottom: 12 }}>
                                            {getPoliTheme(result.recommendedPoli).icon}
                                        </div>
                                        <h3 className="fw-bold mb-1" style={{ color: getPoliTheme(result.recommendedPoli).color }}>
                                            {result.recommendedPoli}
                                        </h3>
                                        <span className="badge bg-white text-secondary mt-2 shadow-sm" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                                            Prediksi Kategori: {result.kategori}
                                        </span>
                                    </div>

                                    {result.referralNote && (
                                        <Alert variant="warning" className="border-0 d-flex gap-3" style={{ borderRadius: 12, backgroundColor: '#fffbeb', color: '#b45309' }}>
                                            <div><FaHospitalAlt size={24} /></div>
                                            <div>
                                                <strong>Catatan Khusus:</strong><br />
                                                <span style={{ fontSize: '0.9rem' }}>{result.referralNote}</span>
                                            </div>
                                        </Alert>
                                    )}

                                    <Button 
                                        onClick={handleLanjutBooking}
                                        className="w-100 py-3 fw-bold mt-2"
                                        variant="primary"
                                        style={{ borderRadius: 12 }}
                                    >
                                        Lanjut Buat Janji Temu / Konsultasi
                                    </Button>
                                </Card.Body>
                            </Card>
                        </div>
                    )}
                </Col>
            </Row>
        </Container>
    );
};

export default CekPoli;
