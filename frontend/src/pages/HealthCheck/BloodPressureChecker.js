import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, ProgressBar, Table } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaHeartbeat, FaTachometerAlt, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

const BloodPressureChecker = () => {
    const [systolic, setSystolic] = useState('');
    const [diastolic, setDiastolic] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const checkBloodPressure = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/api/health-check/check-blood-pressure', {
                systolic: parseInt(systolic),
                diastolic: parseInt(diastolic)
            });

            setResult(response.data);
            toast.success('Tekanan darah berhasil diperiksa');
        } catch (error) {
            toast.error('Gagal memeriksa tekanan darah');
        } finally {
            setLoading(false);
        }
    };

    const getBPColor = (category) => {
        switch(category) {
            case 'Normal': return 'success';
            case 'Elevated': return 'warning';
            case 'High Blood Pressure (Stage 1)': return 'warning';
            case 'High Blood Pressure (Stage 2)': return 'danger';
            case 'Hypertensive Crisis': return 'danger';
            default: return 'info';
        }
    };

    const getBPIcon = (category) => {
        switch(category) {
            case 'Normal': return '✅';
            case 'Elevated': return '⚠️';
            case 'High Blood Pressure (Stage 1)': return '⚠️';
            case 'High Blood Pressure (Stage 2)': return '🔴';
            case 'Hypertensive Crisis': return '🚨';
            default: return 'ℹ️';
        }
    };

    const getBPProgress = (systolic) => {
        if (systolic < 120) return 25;
        if (systolic <= 129) return 45;
        if (systolic <= 139) return 65;
        if (systolic <= 179) return 85;
        return 100;
    };

    const resetForm = () => {
        setSystolic('');
        setDiastolic('');
        setResult(null);
    };

    return (
        <Container className="py-5">
            <Row className="mb-4">
                <Col>
                    <h2 className="text-center">
                        <FaHeartbeat className="me-2 text-danger" />
                        Cek Tekanan Darah
                    </h2>
                    <p className="text-center text-muted">
                        Periksa kategori tekanan darah Anda berdasarkan nilai sistolik dan diastolik
                    </p>
                </Col>
            </Row>

            <Row>
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-danger text-white">
                            <h4 className="mb-0">📊 Masukkan Hasil Pengukuran</h4>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={checkBloodPressure}>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                <FaTachometerAlt className="me-2" />
                                                Sistolik (atas)
                                            </Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    value={systolic}
                                                    onChange={(e) => setSystolic(e.target.value)}
                                                    placeholder="Contoh: 120"
                                                    required
                                                    min="70"
                                                    max="250"
                                                    className="me-2"
                                                    size="lg"
                                                />
                                                <span className="text-muted h5">mmHg</span>
                                            </div>
                                            <Form.Text className="text-muted">
                                                Tekanan saat jantung memompa darah
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-4">
                                            <Form.Label className="fw-bold">
                                                <FaHeartbeat className="me-2" />
                                                Diastolik (bawah)
                                            </Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    value={diastolic}
                                                    onChange={(e) => setDiastolic(e.target.value)}
                                                    placeholder="Contoh: 80"
                                                    required
                                                    min="40"
                                                    max="150"
                                                    className="me-2"
                                                    size="lg"
                                                />
                                                <span className="text-muted h5">mmHg</span>
                                            </div>
                                            <Form.Text className="text-muted">
                                                Tekanan saat jantung istirahat
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <div className="d-grid gap-2">
                                    <Button type="submit" variant="danger" size="lg" disabled={loading}>
                                        {loading ? 'Memeriksa...' : 'Periksa Tekanan Darah'}
                                    </Button>
                                    {result && (
                                        <Button variant="outline-secondary" onClick={resetForm}>
                                            Periksa Ulang
                                        </Button>
                                    )}
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={6}>
                    {result ? (
                        <Card className={`shadow-sm border-${getBPColor(result.category)} h-100`}>
                            <Card.Header className={`bg-${getBPColor(result.category)} text-white`}>
                                <h4 className="mb-0">
                                    {getBPIcon(result.category)} Hasil Pemeriksaan
                                </h4>
                            </Card.Header>
                            <Card.Body>
                                <div className="text-center mb-4">
                                    <div className="display-1 fw-bold" style={{ fontSize: '4rem' }}>
                                        {result.systolic}/{result.diastolic}
                                    </div>
                                    <h3 className={`text-${getBPColor(result.category)}`}>
                                        {result.category}
                                    </h3>
                                </div>

                                <ProgressBar 
                                    now={getBPProgress(result.systolic)} 
                                    variant={getBPColor(result.category)}
                                    className="mb-4"
                                    style={{ height: '20px' }}
                                />

                                <Alert 
                                    variant={getBPColor(result.category)} 
                                    className="mb-4"
                                >
                                    <FaExclamationTriangle className="me-2" />
                                    {result.advice}
                                </Alert>

                                <Card className="bg-light">
                                    <Card.Body>
                                        <h5>📋 Klasifikasi Tekanan Darah:</h5>
                                        <Table borderless size="sm">
                                            <tbody>
                                                <tr className="border-bottom">
                                                    <td><span className="badge bg-success">&lt; 120</span></td>
                                                    <td><span className="badge bg-success">&lt; 80</span></td>
                                                    <td><strong>Normal</strong></td>
                                                    <td className="text-success">✅ Ideal</td>
                                                </tr>
                                                <tr className="border-bottom">
                                                    <td><span className="badge bg-warning">120-129</span></td>
                                                    <td><span className="badge bg-warning">&lt; 80</span></td>
                                                    <td><strong>Elevated</strong></td>
                                                    <td className="text-warning">⚠️ Waspada</td>
                                                </tr>
                                                <tr className="border-bottom">
                                                    <td><span className="badge bg-orange">130-139</span></td>
                                                    <td><span className="badge bg-orange">80-89</span></td>
                                                    <td><strong>Hipertensi Stage 1</strong></td>
                                                    <td className="text-warning">⚠️ Perlu perhatian</td>
                                                </tr>
                                                <tr className="border-bottom">
                                                    <td><span className="badge bg-danger">≥ 140</span></td>
                                                    <td><span className="badge bg-danger">≥ 90</span></td>
                                                    <td><strong>Hipertensi Stage 2</strong></td>
                                                    <td className="text-danger">🔴 Berbahaya</td>
                                                </tr>
                                                <tr>
                                                    <td><span className="badge bg-danger">&gt; 180</span></td>
                                                    <td><span className="badge bg-danger">&gt; 120</span></td>
                                                    <td><strong>Krisis Hipertensi</strong></td>
                                                    <td className="text-danger">🚨 DARURAT!</td>
                                                </tr>
                                            </tbody>
                                        </Table>
                                    </Card.Body>
                                </Card>

                                {(result.category.includes('Stage') || result.category.includes('Crisis')) && (
                                    <Alert variant="danger" className="mt-4">
                                        <h5>🚨 Segera lakukan:</h5>
                                        <ul className="mb-0">
                                            <li>Istirahat dan tenangkan diri</li>
                                            <li>Hindari kafein dan rokok</li>
                                            <li>Segera konsultasi ke dokter</li>
                                            {result.category === 'Hypertensive Crisis' && (
                                                <li className="fw-bold">KUNJUNGI IGD TERDEKAT!</li>
                                            )}
                                        </ul>
                                    </Alert>
                                )}

                                <div className="mt-4 text-center">
                                    <Button 
                                        variant="outline-primary" 
                                        href="/consultations"
                                        className="me-2"
                                    >
                                        Konsultasi Online
                                    </Button>
                                    <Button 
                                        variant="outline-success" 
                                        href="/appointments"
                                    >
                                        Buat Janji Temu
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    ) : (
                        <Card className="bg-light h-100">
                            <Card.Body className="d-flex flex-column justify-content-center align-items-center text-center p-5">
                                <FaHeartbeat size={80} className="text-danger mb-3" />
                                <h4>Cek Tekanan Darah</h4>
                                <p className="text-muted">
                                    Masukkan nilai sistolik dan diastolik untuk mengetahui kategori
                                    tekanan darah Anda
                                </p>
                                <div className="border rounded p-3 bg-white w-100 mt-3">
                                    <p className="mb-2"><strong>Rentang Normal:</strong></p>
                                    <p className="h4 text-success mb-0">120 / 80</p>
                                    <small className="text-muted">mmHg</small>
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>

            <Row className="mt-5">
                <Col md={6}>
                    <Card className="bg-info text-white">
                        <Card.Body>
                            <h5><FaCheckCircle className="me-2" /> Tips Menjaga Tekanan Darah</h5>
                            <ul className="mb-0">
                                <li className="mb-2">🥗 Konsumsi makanan sehat, rendah garam</li>
                                <li className="mb-2">🏃‍♂️ Olahraga teratur minimal 30 menit/hari</li>
                                <li className="mb-2">⚖️ Jaga berat badan ideal</li>
                                <li className="mb-2">🚭 Hindari rokok dan alkohol</li>
                                <li className="mb-2">😴 Kelola stres dan cukup istirahat</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="bg-warning">
                        <Card.Body>
                            <h5>⚠️ Faktor Risiko Hipertensi</h5>
                            <ul className="mb-0">
                                <li className="mb-2">👨‍🦳 Usia &gt; 65 tahun</li>
                                <li className="mb-2">🧂 Konsumsi garam berlebih</li>
                                <li className="mb-2">⚖️ Obesitas/kelebihan berat badan</li>
                                <li className="mb-2">🧬 Riwayat keluarga</li>
                                <li className="mb-2">🏥 Penyakit kronis (diabetes, ginjal)</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default BloodPressureChecker;