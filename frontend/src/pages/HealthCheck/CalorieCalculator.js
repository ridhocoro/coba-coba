import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table, ProgressBar } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaFire, FaApple, FaRunning, FaBed } from 'react-icons/fa';

const CalorieCalculator = () => {
    const [formData, setFormData] = useState({
        gender: 'male',
        age: '',
        weight: '',
        height: '',
        activityLevel: 'moderate'
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const calculateCalories = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/api/health-check/calculate-calories', {
                ...formData,
                age: parseInt(formData.age),
                weight: parseFloat(formData.weight),
                height: parseFloat(formData.height)
            });

            setResult(response.data);
            toast.success('Kebutuhan kalori berhasil dihitung');
        } catch (error) {
            toast.error('Gagal menghitung kebutuhan kalori');
        } finally {
            setLoading(false);
        }
    };

    const getActivityLevelLabel = (level) => {
        const labels = {
            sedentary: 'Jarang Bergerak',
            light: 'Ringan',
            moderate: 'Sedang',
            active: 'Aktif',
            veryActive: 'Sangat Aktif'
        };
        return labels[level] || level;
    };

    const getActivityLevelDescription = (level) => {
        const desc = {
            sedentary: 'Pekerja kantor, jarang olahraga',
            light: 'Olahraga 1-3 hari/minggu',
            moderate: 'Olahraga 3-5 hari/minggu',
            active: 'Olahraga 6-7 hari/minggu',
            veryActive: 'Atlet, pekerja fisik berat'
        };
        return desc[level] || level;
    };

    const resetForm = () => {
        setFormData({
            gender: 'male',
            age: '',
            weight: '',
            height: '',
            activityLevel: 'moderate'
        });
        setResult(null);
    };

    return (
        <Container className="py-5">
            <Row className="mb-4">
                <Col>
                    <h2 className="text-center">
                        <FaFire className="me-2 text-danger" />
                        Kalkulator Kalori Harian
                    </h2>
                    <p className="text-center text-muted">
                        Hitung kebutuhan kalori harian Anda berdasarkan BMR dan tingkat aktivitas
                    </p>
                </Col>
            </Row>

            <Row>
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-danger text-white">
                            <h4 className="mb-0">📝 Data Diri</h4>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={calculateCalories}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold">Jenis Kelamin</Form.Label>
                                    <div className="border p-3 rounded bg-light">
                                        <Form.Check
                                            inline
                                            type="radio"
                                            label="Laki-laki"
                                            name="gender"
                                            value="male"
                                            checked={formData.gender === 'male'}
                                            onChange={handleChange}
                                        />
                                        <Form.Check
                                            inline
                                            type="radio"
                                            label="Perempuan"
                                            name="gender"
                                            value="female"
                                            checked={formData.gender === 'female'}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </Form.Group>

                                <Row>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">Usia</Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    name="age"
                                                    value={formData.age}
                                                    onChange={handleChange}
                                                    placeholder="Tahun"
                                                    required
                                                    min="15"
                                                    max="100"
                                                    className="me-2"
                                                />
                                                <span className="text-muted">th</span>
                                            </div>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">Berat</Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    step="0.1"
                                                    name="weight"
                                                    value={formData.weight}
                                                    onChange={handleChange}
                                                    placeholder="Berat"
                                                    required
                                                    className="me-2"
                                                />
                                                <span className="text-muted">kg</span>
                                            </div>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">Tinggi</Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    step="0.1"
                                                    name="height"
                                                    value={formData.height}
                                                    onChange={handleChange}
                                                    placeholder="Tinggi"
                                                    required
                                                    className="me-2"
                                                />
                                                <span className="text-muted">cm</span>
                                            </div>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold">Tingkat Aktivitas</Form.Label>
                                    <Form.Select 
                                        name="activityLevel" 
                                        value={formData.activityLevel}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="sedentary">Jarang Bergerak (Sedentary)</option>
                                        <option value="light">Ringan (Light)</option>
                                        <option value="moderate">Sedang (Moderate)</option>
                                        <option value="active">Aktif (Active)</option>
                                        <option value="veryActive">Sangat Aktif (Very Active)</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                        {getActivityLevelDescription(formData.activityLevel)}
                                    </Form.Text>
                                </Form.Group>

                                <div className="d-grid gap-2">
                                    <Button type="submit" variant="danger" size="lg" disabled={loading}>
                                        {loading ? 'Menghitung...' : 'Hitung Kebutuhan Kalori'}
                                    </Button>
                                    {result && (
                                        <Button variant="outline-secondary" onClick={resetForm}>
                                            Hitung Ulang
                                        </Button>
                                    )}
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={6}>
                    {result ? (
                        <Card className="shadow-sm h-100">
                            <Card.Header className="bg-success text-white">
                                <h4 className="mb-0">🔥 Hasil Perhitungan</h4>
                            </Card.Header>
                            <Card.Body>
                                <div className="text-center mb-4">
                                    <div className="display-1 fw-bold text-success" style={{ fontSize: '3.5rem' }}>
                                        {result.dailyCalories}
                                    </div>
                                    <h5>Kalori / Hari</h5>
                                    <p className="text-muted">
                                        BMR: {result.bmr} kalori/hari
                                    </p>
                                </div>

                                <Alert variant="info">
                                    <strong>Kebutuhan kalori Anda:</strong> {result.dailyCalories} kalori per hari
                                    untuk mempertahankan berat badan saat ini.
                                </Alert>

                                <Card className="bg-light mb-3">
                                    <Card.Body>
                                        <h5>🎯 Rekomendasi Asupan Kalori:</h5>
                                        <Table borderless size="sm">
                                            <tbody>
                                                <tr>
                                                    <td><strong>Pertahankan berat:</strong></td>
                                                    <td className="text-end">{result.recommendations?.maintain} kalori</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Turunkan berat (ringan):</strong></td>
                                                    <td className="text-end">{result.recommendations?.mildLoss} kalori</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Turunkan berat (sehat):</strong></td>
                                                    <td className="text-end text-success fw-bold">{result.recommendations?.weightLoss} kalori</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Naikkan berat (ringan):</strong></td>
                                                    <td className="text-end">{result.recommendations?.mildGain} kalori</td>
                                                </tr>
                                                <tr>
                                                    <td><strong>Naikkan berat (sehat):</strong></td>
                                                    <td className="text-end text-primary fw-bold">{result.recommendations?.weightGain} kalori</td>
                                                </tr>
                                            </tbody>
                                        </Table>
                                    </Card.Body>
                                </Card>

                                <Row className="mt-3">
                                    <Col md={6}>
                                        <Card className="bg-warning bg-opacity-10">
                                            <Card.Body className="text-center">
                                                <FaApple size={30} className="text-danger mb-2" />
                                                <h6>Sarapan</h6>
                                                <p className="h5">
                                                    {Math.round(result.dailyCalories * 0.3)} kal
                                                </p>
                                                <small className="text-muted">30%</small>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6}>
                                        <Card className="bg-info bg-opacity-10">
                                            <Card.Body className="text-center">
                                                <FaFire size={30} className="text-warning mb-2" />
                                                <h6>Makan Siang</h6>
                                                <p className="h5">
                                                    {Math.round(result.dailyCalories * 0.35)} kal
                                                </p>
                                                <small className="text-muted">35%</small>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6}>
                                        <Card className="bg-primary bg-opacity-10">
                                            <Card.Body className="text-center">
                                                <FaBed size={30} className="text-primary mb-2" />
                                                <h6>Makan Malam</h6>
                                                <p className="h5">
                                                    {Math.round(result.dailyCalories * 0.25)} kal
                                                </p>
                                                <small className="text-muted">25%</small>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6}>
                                        <Card className="bg-success bg-opacity-10">
                                            <Card.Body className="text-center">
                                                <FaRunning size={30} className="text-success mb-2" />
                                                <h6>Camilan</h6>
                                                <p className="h5">
                                                    {Math.round(result.dailyCalories * 0.1)} kal
                                                </p>
                                                <small className="text-muted">10%</small>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    ) : (
                        <Card className="bg-light h-100">
                            <Card.Body className="d-flex flex-column justify-content-center align-items-center text-center p-5">
                                <FaFire size={80} className="text-danger mb-3" />
                                <h4>Hitung Kebutuhan Kalori</h4>
                                <p className="text-muted">
                                    Masukkan data diri dan tingkat aktivitas untuk menghitung
                                    kebutuhan kalori harian Anda
                                </p>
                                <ul className="text-start text-muted">
                                    <li className="mb-2">⚡ Hitung BMR (Basal Metabolic Rate)</li>
                                    <li className="mb-2">🏃‍♂️ Rekomendasi berdasarkan aktivitas</li>
                                    <li className="mb-2">🎯 Target turun/naik berat badan</li>
                                </ul>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>

            <Row className="mt-5">
                <Col md={12}>
                    <Card className="bg-light">
                        <Card.Body>
                            <h5>📚 Apa itu BMR dan Kebutuhan Kalori?</h5>
                            <p>
                                Basal Metabolic Rate (BMR) adalah jumlah kalori yang dibutuhkan tubuh 
                                untuk menjalankan fungsi vital saat istirahat (bernapas, sirkulasi darah, dll). 
                                Kebutuhan kalori harian dihitung dengan mengalikan BMR dengan faktor aktivitas.
                            </p>
                            <Row className="mt-3">
                                <Col md={3}>
                                    <div className="border rounded p-3 text-center">
                                        <strong>Sedentary</strong>
                                        <br />
                                        <small className="text-muted">× 1.2</small>
                                    </div>
                                </Col>
                                <Col md={3}>
                                    <div className="border rounded p-3 text-center">
                                        <strong>Light</strong>
                                        <br />
                                        <small className="text-muted">× 1.375</small>
                                    </div>
                                </Col>
                                <Col md={3}>
                                    <div className="border rounded p-3 text-center">
                                        <strong>Moderate</strong>
                                        <br />
                                        <small className="text-muted">× 1.55</small>
                                    </div>
                                </Col>
                                <Col md={3}>
                                    <div className="border rounded p-3 text-center">
                                        <strong>Active</strong>
                                        <br />
                                        <small className="text-muted">× 1.725</small>
                                    </div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default CalorieCalculator;