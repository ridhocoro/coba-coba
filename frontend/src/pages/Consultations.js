import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Form, Button, 
    Modal, Alert, Table, Badge, Spinner 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaMoneyBillWave, FaCheckCircle, FaClock, FaCopy,
    FaComment, FaUserMd, FaHistory, FaQrcode,
    FaFileMedical, FaDownload, FaTimesCircle
} from 'react-icons/fa';

// ========== MANUAL PAYMENT FORM ==========
const ManualPaymentForm = ({ consultation, amount, onSuccess, onClose }) => {
    const [step, setStep] = useState(1);
    const [banks, setBanks] = useState([]);
    const [qris, setQris] = useState(null);
    const [selectedBank, setSelectedBank] = useState(null);
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [transferDate, setTransferDate] = useState('');
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
            
            if (response.data.transaction.isQRIS) {
                setSelectedBank({
                    bankName: 'QRIS',
                    accountName: 'Klinik Pratama IPB',
                    isQRIS: true
                });
            } else {
                setSelectedBank(banks.find(b => b.id === bankId));
            }
            
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

        if (!transferDate) {
            toast.error('Pilih tanggal transfer');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('proof', file);
        formData.append('transferDate', transferDate);

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
            onSuccess();
            
        } catch (error) {
            toast.error('Gagal upload bukti transfer');
        } finally {
            setUploading(false);
        }
    };

    // ✅ FUNGSI BARU: Hapus konsultasi saat batal
    const handleCancel = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `http://localhost:5000/api/consultations/${consultation._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.info('Konsultasi dibatalkan');
        } catch (error) {
            console.error('Error deleting consultation:', error);
            toast.error('Gagal membatalkan konsultasi');
        } finally {
            onClose();
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

    // STEP 1: Pilih Bank atau QRIS
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
                                    className={`bank-card ${selectedBank?.id === bank.id && !selectedBank?.isQRIS ? 'border-primary' : ''}`}
                                    onClick={() => setSelectedBank({...bank, isQRIS: false})}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <Card.Body className="d-flex align-items-center">
                                        <div className="bank-icon me-3" style={{ fontSize: '2rem' }}>
                                            {bank.bankName === 'Bank BCA' && '🏦'}
                                            {bank.bankName === 'Bank Mandiri' && '🏛️'}
                                            {bank.bankName === 'Bank BRI' && '🌾'}
                                            {bank.bankName === 'Bank BNI' && '🏢'}
                                        </div>
                                        <div>
                                            <strong>{bank.bankName}</strong>
                                            <br />
                                            <small className="text-muted">a.n. {bank.accountName}</small>
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
                        <Card 
                            className={`text-center p-3 bank-card ${selectedBank?.isQRIS ? 'border-primary' : ''}`}
                            onClick={() => setSelectedBank({
                                id: 999,
                                bankName: 'QRIS',
                                accountName: qris.merchantName,
                                isQRIS: true,
                                qrCode: qris.qrCode
                            })}
                            style={{ cursor: 'pointer' }}
                        >
                            <div style={{ width: '200px', height: '200px', margin: '0 auto' }}>
                                <img 
                                    src={qris.qrCode || '/images/qris-klinik.png'} 
                                    alt="QRIS"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://via.placeholder.com/200x200?text=QRIS';
                                    }}
                                />
                            </div>
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
                    <Button variant="outline-secondary" onClick={handleCancel}>
                        Batal
                    </Button>
                </div>
            </div>
        );
    }

    // STEP 2: Instruksi Pembayaran & Upload Bukti
    if (step === 2) {
        return (
            <div className="p-4">
                <Alert variant="info" className="mb-4">
                    <FaClock className="me-2" />
                    <strong>Batas pembayaran:</strong> {formatDate(transaction.expiresAt)}
                </Alert>

                {transaction?.isQRIS && (
                    <Alert variant="success" className="mb-4">
                        <FaQrcode size={24} className="me-2" />
                        <strong>Scan QRIS</strong> menggunakan e-wallet Anda.
                        <br />
                        <small>Setelah scan, upload bukti pembayaran.</small>
                    </Alert>
                )}

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
                                    <td className="text-muted">Metode:</td>
                                    <td><strong>{transaction.bank.bankName}</strong></td>
                                </tr>
                                {!transaction?.isQRIS && (
                                    <>
                                        <tr>
                                            <td className="text-muted">Nomor Rekening:</td>
                                            <td>
                                                <strong>{transaction.bank.accountNumber}</strong>
                                                <Button 
                                                    variant="link" 
                                                    className="p-0 ms-2"
                                                    onClick={() => copyToClipboard(transaction.bank.accountNumber)}
                                                >
                                                    <FaCopy size={12} />
                                                </Button>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Atas Nama:</td>
                                            <td><strong>{transaction.bank.accountName}</strong></td>
                                        </tr>
                                    </>
                                )}
                                <tr>
                                    <td className="text-muted">Total Transfer:</td>
                                    <td><h5 className="text-primary mb-0">Rp {amount.toLocaleString()}</h5></td>
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
                                value={transferDate}
                                onChange={(e) => setTransferDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>File Bukti Transfer</Form.Label>
                            <Form.Control
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                                required
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
                        disabled={!file || !transferDate || uploading}
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
        if (!user) {
            toast.error('Silakan login terlebih dahulu');
            navigate('/login');
            return;
        }
        
        fetchDoctors();
        fetchMyConsultations();
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
        
        if (!selectedDoctor) {
            toast.error('Pilih dokter terlebih dahulu');
            return;
        }

        if (!symptoms) {
            toast.error('Isi keluhan Anda');
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

    const downloadPDF = async (consultation) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/consultations/${consultation._id}/sick-letter/pdf`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `surat-sakit-${consultation._id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            toast.success('Surat sakit berhasil diunduh');
        } catch (error) {
            toast.error('Gagal mengunduh surat sakit');
        }
    };

    // ✅ STATUS BADGE YANG DIPERBAIKI
    const getStatusBadge = (status) => {
        const variants = {
            pending: 'secondary',
            waiting_payment: 'warning',
            paid: 'info',
            ongoing: 'primary',
            completed: 'success',
            verified: 'success',
            cancelled: 'danger'
        };
        
        const labels = {
            pending: 'Menunggu',
            waiting_payment: 'Menunggu Pembayaran',
            paid: 'Menunggu Verifikasi',
            ongoing: 'Sedang Berlangsung',
            completed: 'Selesai',
            verified: 'Lunas / Terverifikasi',
            cancelled: 'Dibatalkan'
        };
        
        return <Badge bg={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
    };

    return (
        <Container className="py-5">
            <Row>
                <Col lg={5} className="mb-4">
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white py-3">
                            <h4 className="mb-0">Konsultasi Online Baru</h4>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Pilih Dokter</Form.Label>
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
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : consultations.length === 0 ? (
                                <div className="text-center py-5">
                                    <FaHistory size={50} className="text-muted mb-3" />
                                    <h5>Belum Ada Konsultasi</h5>
                                    <p className="text-muted">Mulai konsultasi online pertama Anda</p>
                                </div>
                            ) : (
                                consultations.map(cons => (
                                    // Filter: jangan tampilkan yang status cancelled
                                    cons.status !== 'cancelled' && (
                                        <Card key={cons._id} className="mb-3 border-0 bg-light">
                                            <Card.Body>
                                                <Row>
                                                    <Col md={8}>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <FaUserMd className="text-primary me-2" />
                                                            <h6 className="mb-0">{cons.doctorId?.name}</h6>
                                                            {cons.sickLetter && (
                                                                <Badge bg="warning" className="ms-2">
                                                                    <FaFileMedical className="me-1" />
                                                                    Surat Sakit
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-muted small mb-2">
                                                            <FaClock className="me-1" />
                                                            {new Date(cons.createdAt).toLocaleDateString('id-ID')}
                                                        </div>
                                                        <p className="mb-0">
                                                            <strong>Keluhan:</strong> {cons.symptoms}
                                                        </p>
                                                    </Col>
                                                    <Col md={4} className="text-end">
                                                        <div className="mb-2">{getStatusBadge(cons.status)}</div>
                                                        
                                                        {cons.status === 'paid' && (
                                                            <Badge bg="info" className="p-2 w-100">
                                                                Menunggu Verifikasi Admin
                                                            </Badge>
                                                        )}
                                                        
                                                        {cons.status === 'verified' && (
                                                            <Button 
                                                                variant="success" 
                                                                size="sm"
                                                                className="mb-2 w-100"
                                                                onClick={() => startChat(cons._id)}
                                                            >
                                                                <FaComment className="me-1" /> Mulai Chat
                                                            </Button>
                                                        )}
                                                        
                                                        {cons.status === 'ongoing' && (
                                                            <Button 
                                                                variant="primary" 
                                                                size="sm"
                                                                className="mb-2 w-100"
                                                                onClick={() => startChat(cons._id)}
                                                            >
                                                                <FaComment className="me-1" /> Lanjutkan
                                                            </Button>
                                                        )}
                                                        
                                                        {cons.status === 'waiting_payment' && (
                                                            <Button 
                                                                variant="warning" 
                                                                size="sm"
                                                                className="mb-2 w-100"
                                                                onClick={() => {
                                                                    setCurrentConsultation(cons);
                                                                    setPaymentAmount(cons.doctorId?.consultationFee || 0);
                                                                    setShowPaymentModal(true);
                                                                }}
                                                            >
                                                                Bayar Sekarang
                                                            </Button>
                                                        )}
                                                        
                                                        {cons.sickLetter && cons.sickLetter.status === 'issued' && (
                                                            <Button 
                                                                variant="success" 
                                                                size="sm"
                                                                className="w-100"
                                                                onClick={() => downloadPDF(cons)}
                                                            >
                                                                <FaDownload className="me-1" /> Unduh Surat
                                                            </Button>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Card.Body>
                                        </Card>
                                    )
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
            `}</style>
        </Container>
    );
};

export default Consultations;