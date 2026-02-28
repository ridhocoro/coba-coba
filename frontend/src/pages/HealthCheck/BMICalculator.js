import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { FaCalculator, FaInfoCircle, FaWeight, FaRuler } from 'react-icons/fa';

const BMICalculator = () => {
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [unit, setUnit] = useState('cm'); // ✅ UBAH DARI 'metric' KE 'cm'!
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const calculateBMI = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        // Validasi input
        if (!weight || !height) {
            setError('Masukkan berat dan tinggi badan');
            setLoading(false);
            return;
        }

        const weightNum = parseFloat(weight);
        const heightNum = parseFloat(height);

        if (isNaN(weightNum) || isNaN(heightNum)) {
            setError('Format angka tidak valid');
            setLoading(false);
            return;
        }

        if (weightNum <= 0 || heightNum <= 0) {
            setError('Berat dan tinggi harus lebih dari 0');
            setLoading(false);
            return;
        }

        // ✅ Validasi range berdasarkan unit
        if (unit === 'cm' && (heightNum < 50 || heightNum > 300)) {
            setError('Tinggi badan harus antara 50-300 cm');
            setLoading(false);
            return;
        }
        if (unit === 'm' && (heightNum < 0.5 || heightNum > 3)) {
            setError('Tinggi badan harus antara 0.5-3 meter');
            setLoading(false);
            return;
        }
        if (unit === 'imperial' && (heightNum < 1.6 || heightNum > 9.8)) {
            setError('Tinggi badan harus antara 1.6-9.8 feet');
            setLoading(false);
            return;
        }

        try {
            console.log('Mengirim data:', { weight: weightNum, height: heightNum, unit }); // ✅ Debug
            
            const response = await api.post('/api/health-check/calculate-bmi', {
                weight: weightNum,
                height: heightNum,
                unit: unit // ✅ Kirim 'cm', 'm', atau 'imperial'
            });
            
            console.log('Response:', response.data); // ✅ Debug
            setResult(response.data);
            toast.success('BMI berhasil dihitung');
        } catch (error) {
            console.error('BMI Error:', error);
            const errorMsg = error.response?.data?.error || 'Gagal menghitung BMI';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const getBMICategoryColor = (category) => {
        if (!category) return 'info';
        const cat = category.toLowerCase();
        if (cat.includes('underweight')) return 'warning';
        if (cat.includes('normal')) return 'success';
        if (cat.includes('overweight')) return 'warning';
        if (cat.includes('obesitas') || cat.includes('obesity')) return 'danger';
        return 'info';
    };

    const getBMICategoryIcon = (category) => {
        if (!category) return 'ℹ️';
        const cat = category.toLowerCase();
        if (cat.includes('normal')) return '✅';
        if (cat.includes('underweight')) return '⚠️';
        if (cat.includes('overweight')) return '⚠️';
        if (cat.includes('obesitas') || cat.includes('obesity')) return '🔴';
        return 'ℹ️';
    };

    const resetForm = () => {
        setWeight('');
        setHeight('');
        setResult(null);
        setError('');
        setUnit('cm');
    };

    return (
        <Container className="py-5">
            <Row className="mb-4">
                <Col>
                    <h2 className="text-center">
                        <FaCalculator className="me-2" />
                        Kalkulator BMI (Indeks Massa Tubuh)
                    </h2>
                    <p className="text-center text-muted">
                        Hitung indeks massa tubuh Anda untuk mengetahui kategori berat badan ideal
                    </p>
                </Col>
            </Row>

            <Row>
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-primary text-white">
                            <h4 className="mb-0">📝 Masukkan Data Anda</h4>
                        </Card.Header>
                        <Card.Body>
                            {error && (
                                <Alert variant="danger" className="mb-4">
                                    <FaInfoCircle className="me-2" />
                                    {error}
                                </Alert>
                            )}

                            <Form onSubmit={calculateBMI}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold">
                                        <FaRuler className="me-2" />
                                        Unit Pengukuran
                                    </Form.Label>
                                    <div className="border p-3 rounded bg-light">
                                        <Form.Check
                                            inline
                                            type="radio"
                                            label="Centimeter (cm) & Kilogram (kg)"
                                            name="unit"
                                            value="cm" // ✅ VALUE = 'cm' BUKAN 'metric'!
                                            checked={unit === 'cm'}
                                            onChange={(e) => setUnit(e.target.value)}
                                        />
                                        <Form.Check
                                            inline
                                            type="radio"
                                            label="Meter (m) & Kilogram (kg)"
                                            name="unit"
                                            value="m" // ✅ VALUE = 'm' BUKAN 'metric-m'!
                                            checked={unit === 'm'}
                                            onChange={(e) => setUnit(e.target.value)}
                                        />
                                        <Form.Check
                                            inline
                                            type="radio"
                                            label="Feet (ft) & Pounds (lb)"
                                            name="unit"
                                            value="imperial"
                                            checked={unit === 'imperial'}
                                            onChange={(e) => setUnit(e.target.value)}
                                        />
                                    </div>
                                    <Form.Text className="text-muted">
                                        {unit === 'cm' && 'Contoh: Tinggi 175 cm, Berat 70 kg'}
                                        {unit === 'm' && 'Contoh: Tinggi 1.75 m, Berat 70 kg'}
                                        {unit === 'imperial' && 'Contoh: Tinggi 5.7 ft, Berat 154 lb'}
                                    </Form.Text>
                                </Form.Group>

                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">
                                                <FaWeight className="me-2" />
                                                Berat Badan
                                            </Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    step="0.1"
                                                    value={weight}
                                                    onChange={(e) => setWeight(e.target.value)}
                                                    placeholder={unit === 'imperial' ? 'Pounds (lb)' : 'Kilogram (kg)'}
                                                    required
                                                    className="me-2"
                                                />
                                                <span className="text-muted" style={{ minWidth: '40px' }}>
                                                    {unit === 'imperial' ? 'lb' : 'kg'}
                                                </span>
                                            </div>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">
                                                <FaRuler className="me-2" />
                                                Tinggi Badan
                                            </Form.Label>
                                            <div className="d-flex align-items-center">
                                                <Form.Control
                                                    type="number"
                                                    step={unit === 'cm' ? '1' : '0.01'}
                                                    value={height}
                                                    onChange={(e) => setHeight(e.target.value)}
                                                    placeholder={
                                                        unit === 'imperial' ? 'Feet (ft)' : 
                                                        unit === 'cm' ? 'Centimeter (cm)' : 'Meter (m)'
                                                    }
                                                    required
                                                    className="me-2"
                                                />
                                                <span className="text-muted" style={{ minWidth: '40px' }}>
                                                    {unit === 'imperial' ? 'ft' : 
                                                     unit === 'cm' ? 'cm' : 'm'}
                                                </span>
                                            </div>
                                            <Form.Text className="text-muted">
                                                {unit === 'cm' && 'Contoh: 175'}
                                                {unit === 'm' && 'Contoh: 1.75'}
                                                {unit === 'imperial' && 'Contoh: 5.7'}
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <div className="d-grid gap-2 mt-4">
                                    <Button 
                                        type="submit" 
                                        variant="primary" 
                                        size="lg" 
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" />
                                                Menghitung...
                                            </>
                                        ) : (
                                            'Hitung BMI'
                                        )}
                                    </Button>
                                    {result && (
                                        <Button 
                                            variant="outline-secondary" 
                                            onClick={resetForm}
                                        >
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
                        <Card className={`shadow-sm border-${getBMICategoryColor(result.category)} h-100`}>
                            <Card.Header className={`bg-${getBMICategoryColor(result.category)} text-white`}>
                                <h4 className="mb-0">
                                    {getBMICategoryIcon(result.category)} Hasil BMI Anda
                                </h4>
                            </Card.Header>
                            <Card.Body>
                                <div className="text-center mb-4">
                                    <div className="display-1 fw-bold" style={{ fontSize: '4rem' }}>
                                        {result.bmi}
                                    </div>
                                    <h3 className={`text-${getBMICategoryColor(result.category)}`}>
                                        {result.category}
                                    </h3>
                                </div>
                                
                                <Alert variant={getBMICategoryColor(result.category)} className="mb-4">
                                    <FaInfoCircle className="me-2" />
                                    {result.advice}
                                </Alert>

                                <Card className="bg-light">
                                    <Card.Body>
                                        <h6>📋 Klasifikasi BMI (WHO):</h6>
                                        <Table borderless size="sm">
                                            <tbody>
                                                <tr>
                                                    <td><span className="badge bg-warning">&lt; 18.5</span></td>
                                                    <td><strong>Underweight</strong></td>
                                                    <td className="text-muted">Kekurangan berat badan</td>
                                                </tr>
                                                <tr>
                                                    <td><span className="badge bg-success">18.5 - 24.9</span></td>
                                                    <td><strong>Normal</strong></td>
                                                    <td className="text-muted">Berat badan ideal</td>
                                                </tr>
                                                <tr>
                                                    <td><span className="badge bg-warning">25.0 - 29.9</span></td>
                                                    <td><strong>Overweight</strong></td>
                                                    <td className="text-muted">Kelebihan berat badan</td>
                                                </tr>
                                                <tr>
                                                    <td><span className="badge bg-danger">≥ 30.0</span></td>
                                                    <td><strong>Obesitas</strong></td>
                                                    <td className="text-muted">Sangat kelebihan berat badan</td>
                                                </tr>
                                            </tbody>
                                        </Table>
                                    </Card.Body>
                                </Card>

                                {result.details && (
                                    <div className="mt-3">
                                        <h6>📌 Detail Perhitungan:</h6>
                                        <p className="text-muted small mb-0">
                                            Berat: {result.details.weight?.toFixed(1)} kg<br />
                                            Tinggi: {result.details.height?.toFixed(2)} m<br />
                                            Rumus: {result.details.weight?.toFixed(1)} / ({result.details.height?.toFixed(2)}²) = {result.bmi}
                                        </p>
                                    </div>
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
                                <FaCalculator size={80} className="text-primary mb-3" />
                                <h4>Belum ada hasil</h4>
                                <p className="text-muted mb-4">
                                    Masukkan berat dan tinggi badan Anda untuk menghitung BMI
                                </p>
                                <div className="bg-white p-3 rounded w-100">
                                    <p className="mb-2"><strong>Contoh:</strong></p>
                                    <p className="text-success mb-1">✓ Berat: 70 kg</p>
                                    <p className="text-success mb-0">✓ Tinggi: 175 cm</p>
                                    <p className="text-primary fw-bold mt-2">Hasil: 22.9 (Normal)</p>
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>

            <Row className="mt-5">
                <Col md={12}>
                    <Card className="bg-info text-white">
                        <Card.Body>
                            <Row className="align-items-center">
                                <Col md={1} className="text-center">
                                    <FaInfoCircle size={40} />
                                </Col>
                                <Col md={11}>
                                    <h5>Apa itu BMI?</h5>
                                    <p className="mb-0">
                                        Body Mass Index (BMI) atau Indeks Massa Tubuh adalah ukuran yang digunakan 
                                        untuk menilai berat badan seseorang berdasarkan tinggi dan berat badan. 
                                        BMI dapat membantu mengidentifikasi apakah seseorang memiliki berat badan 
                                        ideal, kurang, atau berlebih. Namun perlu diingat bahwa BMI tidak mengukur 
                                        lemak tubuh secara langsung dan tidak memperhitungkan massa otot, sehingga 
                                        hasilnya perlu diinterpretasikan dengan hati-hati bersama tenaga kesehatan.
                                    </p>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default BMICalculator;