import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Form, Button, 
    Modal, Alert, Table, Badge, ListGroup 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaMoneyBillWave, 
    FaQrcode, 
    FaBank, 
    FaUpload, 
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaCopy,
    FaDownload
} from 'react-icons/fa';

// ========== MANUAL PAYMENT FORM ==========
const ManualPaymentForm = ({ consultation, amount, onSuccess, onClose }) => {
    const [step, setStep] = useState(1); // 1: pilih bank, 2: instruksi, 3: upload bukti
    const [banks, setBanks] = useState([]);
    const [qris, setQris] = useState(null);
    const [selectedBank, setSelectedBank] = useState(null);
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [transferData, setTransferData] = useState({
        transferDate: '',
        bankName: '',
        accountNumber: '',
        accountName: ''
    });
    const [file, setFile] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    const fetchBankAccounts = async () => {
        try {
            const response = await axios.get(
                'http://localhost:5000/api/manual-payment/bank-accounts'
            );
            setBanks(response.data.banks);
            setQris(response.data.qris[0]);
        } catch (error) {
            toast.error('Gagal memuat data bank');
        }
    };

    const createTransaction = async (bankId) => {
        setLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/manual-payment/create',
                {
                    amount,
                    paymentType: 'consultation',
                    referenceId: consultation._id,
                    bankId
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setTransaction(response.data.transaction);
            setSelectedBank(banks.find(b => b.id === bankId));
            setStep(2);
            
        } catch (error) {
            toast.error('Gagal membuat transaksi');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                toast.error('File maksimal 5MB');
                return;
            }
            setFile(selectedFile);
        }
    };

    const uploadProof = async () => {
        if (!file) {
            toast.error('Pilih file bukti transfer');
            return;
        }

        if (!transferData.transferDate) {
            toast.error('Pilih tanggal transfer');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('proof', file);
        formData.append('transferDate', transferData.transferDate);
        formData.append('bankName', transferData.bankName || selectedBank.bankName);
        formData.append('accountNumber', transferData.accountNumber || selectedBank.accountNumber);
        formData.append('accountName', transferData.accountName || selectedBank.accountName);

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/api/manual-payment/upload-proof/${transaction.id}`,
                formData,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            toast.success('Bukti transfer berhasil diupload! Menunggu verifikasi admin.');
            setStep(3);
            
        } catch (error) {
            toast.error('Gagal upload bukti transfer');
        } finally {
            setUploading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Teks berhasil disalin');
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // STEP 1: Pilih Bank
    if (step === 1) {
        return (
            <div className="p-4">
                <h5 className="mb-4 text-center">Pilih Metode Pembayaran</h5>
                
                <div className="mb-4">
                    <h6 className="mb-3">🏦 Transfer Bank</h6>
                    <Row className="g-3">
                        {banks.map(bank => (
                            <Col md={6} key={bank.id}>
                                <Card 
                                    className={`bank-card cursor-pointer ${selectedBank?.id === bank.id ? 'border-primary' : ''}`}
                                    onClick={() => setSelectedBank(bank)}
                                >
                                    <Card.Body className="d-flex align-items-center">
                                        <div className="bank-icon me-3">
                                            {bank.bankName === 'Bank BCA' && '🏦'}
                                            {bank.bankName === 'Bank Mandiri' && '🏛️'}
                                            {bank.bankName === 'Bank BRI' && '🌾'}
                                            {bank.bankName === 'Bank BNI' && '🏢'}
                                        </div>
                                        <div>
                                            <strong>{bank.bankName}</strong>
                                            <br />
                                            <small className="text-muted">
                                                a.n. {bank.accountName}
                                            </small>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>

                {qris && (
                    <div className="mb-4">
                        <h6 className="mb-3">📱 QRIS (Semua E-Wallet)</h6>
                        <Card className="text-center p-3">
                            <img 
                                src={qris.qrCode} 
                                alt="QRIS"
                                style={{ width: '200px', height: '200px', margin: '0 auto' }}
                            />
                            <p className="mt-2 mb-0">
                                <strong>{qris.merchantName}</strong>
                            </p>
                            <small className="text-muted">
                                Scan dengan OVO/GoPay/Dana/ShopeePay/LinkAja
                            </small>
                        </Card>
                    </div>
                )}

                <div className="d-grid gap-2 mt-4">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => createTransaction(selectedBank.id)}
                        disabled={!selectedBank || loading}
                    >
                        {loading ? 'Memproses...' : 'Lanjutkan'}
                    </Button>
                    <Button variant="outline-secondary" onClick={onClose}>
                        Batal
                    </Button>
                </div>
            </div>
        );
    }

    // STEP 2: Instruksi Pembayaran
    if (step === 2) {
        return (
            <div className="p-4">
                <Alert variant="info" className="mb-4">
                    <FaClock className="me-2" />
                    <strong>Batas pembayaran:</strong> {formatDate(transaction.expiresAt)}
                </Alert>

                <Card className="mb-4 border-success">
                    <Card.Header className="bg-success text-white">
                        <h6 className="mb-0">💰 Detail Pembayaran</h6>
                    </Card.Header>
                    <Card.Body>
                        <Table borderless size="sm">
                            <tbody>
                                <tr>
                                    <td className="text-muted">ID Transaksi:</td>
                                    <td>
                                        <code>{transaction.id}</code>
                                        <Button 
                                            variant="link" 
                                            className="p-0 ms-2"
                                            onClick={() => copyToClipboard(transaction.id)}
                                        >
                                            <FaCopy size={12} />
                                        </Button>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Bank Tujuan:</td>
                                    <td>
                                        <strong>{selectedBank.bankName}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Nomor Rekening:</td>
                                    <td>
                                        <strong>{selectedBank.accountNumber}</strong>
                                        <Button 
                                            variant="link" 
                                            className="p-0 ms-2"
                                            onClick={() => copyToClipboard(selectedBank.accountNumber)}
                                        >
                                            <FaCopy size={12} />
                                        </Button>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Atas Nama:</td>
                                    <td>
                                        <strong>{selectedBank.accountName}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Total Transfer:</td>
                                    <td>
                                        <h5 className="text-primary mb-0">
                                            Rp {amount.toLocaleString()}
                                        </h5>
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </Card.Body>
                </Card>

                <Card className="mb-4">
                    <Card.Header>
                        <h6 className="mb-0">📤 Upload Bukti Transfer</h6>
                    </Card.Header>
                    <Card.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Tanggal Transfer</Form.Label>
                            <Form.Control
                                type="date"
                                value={transferData.transferDate}
                                onChange={(e) => setTransferData({
                                    ...transferData,
                                    transferDate: e.target.value
                                })}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>File Bukti Transfer</Form.Label>
                            <Form.Control
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                            />
                            <Form.Text className="text-muted">
                                Format: JPG, PNG, PDF (maks 5MB)
                            </Form.Text>
                        </Form.Group>

                        {file && (
                            <Alert variant="success" className="mt-3">
                                <FaCheckCircle className="me-2" />
                                File siap: {file.name}
                            </Alert>
                        )}
                    </Card.Body>
                </Card>

                <div className="d-grid gap-2">
                    <Button
                        variant="success"
                        size="lg"
                        onClick={uploadProof}
                        disabled={!file || !transferData.transferDate || uploading}
                    >
                        {uploading ? 'Mengupload...' : 'Upload & Konfirmasi'}
                    </Button>
                    <Button variant="outline-secondary" onClick={() => setStep(1)}>
                        Kembali
                    </Button>
                </div>
            </div>
        );
    }

    // STEP 3: Sukses - Menunggu Verifikasi
    return (
        <div className="p-4 text-center">
            <div className="mb-4">
                <FaCheckCircle size={64} className="text-success mb-3" />
                <h5>Bukti Transfer Terkirim!</h5>
                <p className="text-muted">
                    Terima kasih, bukti transfer Anda sedang diverifikasi oleh admin.
                </p>
            </div>

            <Alert variant="info">
                <strong>ID Transaksi:</strong> {transaction.id}
                <br />
                <small>Proses verifikasi maksimal 1x24 jam</small>
            </Alert>

            <div className="mt-4">
                <Button variant="primary" onClick={onClose}>
                    Tutup
                </Button>
            </div>
        </div>
    );
};

// ========== CONSULTATIONS COMPONENT ==========
const Consultations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [consultations, setConsultations] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [currentConsultation, setCurrentConsultation] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [loadingConsultations, setLoadingConsultations] = useState(true);

    useEffect(() => {
        if (user) {
            fetchDoctors();
            fetchMyConsultations();
        }
    }, [user]);

    const fetchDoctors = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/doctors');
            setDoctors(response.data);
        } catch (error) {
            toast.error('Gagal memuat data dokter');
        }
    };

    const fetchMyConsultations = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/consultations/my-consultations',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setConsultations(response.data);
        } catch (error) {
            toast.error('Gagal memuat riwayat konsultasi');
        } finally {
            setLoadingConsultations(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!user) {
            toast.error('Silakan login terlebih dahulu');
            navigate('/login');
            return;
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/consultations/create',
                {
                    doctorId: selectedDoctor,
                    symptoms
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCurrentConsultation(response.data.consultation);
            setPaymentAmount(response.data.amount);
            setShowPaymentModal(true);
            
        } catch (error) {
            toast.error('Gagal membuat konsultasi');
        } finally {
            setLoading(false);
        }
    };

    const startChat = (consultationId) => {
        navigate(`/consultations/${consultationId}`);
    };

    const getStatusBadge = (status) => {
        const variants = {
            waiting_payment: 'warning',
            pending: 'warning',
            paid: 'info',
            ongoing: 'primary',
            completed: 'success',
            cancelled: 'danger'
        };
        const labels = {
            waiting_payment: 'Menunggu Pembayaran',
            pending: 'Menunggu Verifikasi',
            paid: 'Lunas',
            ongoing: 'Sedang Berlangsung',
            completed: 'Selesai',
            cancelled: 'Dibatalkan'
        };
        return <Badge bg={variants[status]}>{labels[status] || status}</Badge>;
    };

    return (
        <Container className="py-5">
            <Row>
                <Col lg={5} className="mb-4">
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white py-3">
                            <h4 className="mb-0">
                                Konsultasi Online Baru
                            </h4>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">
                                        Pilih Dokter
                                    </Form.Label>
                                    <Form.Select
                                        value={selectedDoctor}
                                        onChange={(e) => setSelectedDoctor(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Pilih Dokter --</option>
                                        {doctors.map(doctor => (
                                            <option key={doctor._id} value={doctor._id}>
                                                {doctor.name} - {doctor.specialization}
                                                (Rp {doctor.consultationFee?.toLocaleString()})
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold">Keluhan / Gejala</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        value={symptoms}
                                        onChange={(e) => setSymptoms(e.target.value)}
                                        placeholder="Jelaskan keluhan atau gejala yang Anda alami..."
                                        required
                                    />
                                </Form.Group>

                                <Button 
                                    type="submit" 
                                    variant="primary" 
                                    size="lg" 
                                    className="w-100"
                                    disabled={loading}
                                >
                                    {loading ? 'Memproses...' : 'Lanjutkan ke Pembayaran'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={7}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-info text-white py-3">
                            <h4 className="mb-0">Riwayat Konsultasi</h4>
                        </Card.Header>
                        <Card.Body>
                            {loadingConsultations ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status" />
                                </div>
                            ) : consultations.length === 0 ? (
                                <div className="text-center py-5">
                                    <h5>Belum Ada Konsultasi</h5>
                                    <p className="text-muted">Mulai konsultasi online pertama Anda</p>
                                </div>
                            ) : (
                                consultations.map(cons => (
                                    <Card key={cons._id} className="mb-3 border-0 bg-light">
                                        <Card.Body>
                                            <Row>
                                                <Col md={8}>
                                                    <div className="d-flex align-items-center mb-2">
                                                        <h6 className="mb-0">dr. {cons.doctorId?.name}</h6>
                                                    </div>
                                                    <div className="text-muted small mb-2">
                                                        {new Date(cons.createdAt).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <p className="mb-0">
                                                        <strong>Keluhan:</strong> {cons.symptoms}
                                                    </p>
                                                </Col>
                                                <Col md={4} className="text-end">
                                                    <div className="mb-2">{getStatusBadge(cons.status)}</div>
                                                    {cons.status === 'paid' && (
                                                        <Button 
                                                            variant="primary" 
                                                            size="sm"
                                                            onClick={() => startChat(cons._id)}
                                                        >
                                                            Mulai Chat
                                                        </Button>
                                                    )}
                                                    {cons.status === 'ongoing' && (
                                                        <Button 
                                                            variant="success" 
                                                            size="sm"
                                                            onClick={() => startChat(cons._id)}
                                                        >
                                                            Lanjutkan Chat
                                                        </Button>
                                                    )}
                                                    {cons.status === 'waiting_payment' && (
                                                        <Button 
                                                            variant="warning" 
                                                            size="sm"
                                                            onClick={() => {
                                                                // Open payment modal again
                                                            }}
                                                        >
                                                            Bayar Sekarang
                                                        </Button>
                                                    )}
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>
                                ))
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Payment Modal */}
            <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Pembayaran Konsultasi
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {currentConsultation && (
                        <ManualPaymentForm
                            consultation={currentConsultation}
                            amount={paymentAmount}
                            onSuccess={() => {
                                fetchMyConsultations();
                                setSelectedDoctor('');
                                setSymptoms('');
                            }}
                            onClose={() => setShowPaymentModal(false)}
                        />
                    )}
                </Modal.Body>
            </Modal>

            <style jsx="true">{`
                .bank-card {
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .bank-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                .bank-icon {
                    font-size: 2rem;
                }
            `}</style>
        </Container>
    );
};

export default Consultations;