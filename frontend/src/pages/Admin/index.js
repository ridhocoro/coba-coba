import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Nav, Table, Badge, Button, Form, Card, Modal } from 'react-bootstrap';
import { 
    FaUsers, FaUserMd, FaCalendarCheck, FaPrescription,
    FaMoneyBillWave, FaFileMedical, FaChartLine, FaPills,
    FaCheckCircle, FaTimesCircle, FaEye, FaDownload, FaEdit,
    FaClock, FaQrcode, FaUniversity, FaHistory
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({});
    const [doctors, setDoctors] = useState([]);
    const [consultations, setConsultations] = useState([]);
    const [sickLetters, setSickLetters] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showMedicineModal, setShowMedicineModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        fetchDashboardData();
        fetchPendingPayments();
        const interval = setInterval(() => {
            fetchDashboardData();
            fetchPendingPayments();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [
                statsRes,
                doctorsRes,
                consultationsRes,
                lettersRes,
                appointmentsRes,
                medicinesRes,
                usersRes,
                transactionsRes
            ] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/payments/stats', { headers }),
                axios.get('http://localhost:5000/api/admin/doctors', { headers }),
                axios.get('http://localhost:5000/api/admin/consultations', { headers }),
                axios.get('http://localhost:5000/api/admin/sick-letters', { headers }),
                axios.get('http://localhost:5000/api/admin/appointments', { headers }),
                axios.get('http://localhost:5000/api/pharmacy/medicines', { headers }),
                axios.get('http://localhost:5000/api/admin/users', { headers }),
                axios.get('http://localhost:5000/api/admin/transactions', { headers })
            ]);

            setStats(statsRes.data);
            setDoctors(doctorsRes.data);
            setConsultations(consultationsRes.data);
            setSickLetters(lettersRes.data);
            setAppointments(appointmentsRes.data);
            setMedicines(medicinesRes.data.medicines || medicinesRes.data);
            setUsers(usersRes.data);
            setTransactions(transactionsRes.data);
        } catch (error) {
            toast.error('Gagal memuat data dashboard');
        }
    };

    const fetchPendingPayments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/admin/payments/pending',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPendingPayments(response.data.payments);
        } catch (error) {
            console.error('Gagal memuat pembayaran pending:', error);
        } finally {
            setLoading(false);
        }
    };

    const verifyPayment = async (paymentId, status) => {
        if (status === 'rejected' && !rejectNotes) {
            toast.error('Isi alasan penolakan');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/admin/payments/${paymentId}/verify`,
                { 
                    status, 
                    notes: status === 'rejected' ? rejectNotes : 'Pembayaran valid' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`Pembayaran ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`);
            setShowPaymentModal(false);
            setShowRejectModal(false);
            setRejectNotes('');
            fetchPendingPayments();
            fetchDashboardData();
            
        } catch (error) {
            toast.error('Gagal memproses verifikasi');
        }
    };

    const approveSickLetter = async (id) => {
        try {
            await axios.put(
                `http://localhost:5000/api/admin/sick-letters/${id}/approve`,
                {},
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            toast.success('Surat sakit disetujui');
            fetchDashboardData();
        } catch (error) {
            toast.error('Gagal menyetujui surat sakit');
        }
    };

    const generatePDF = async (id) => {
        try {
            const response = await axios.get(
                `http://localhost:5000/api/sick-letters/${id}/pdf`,
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    responseType: 'blob'
                }
            );
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `surat-sakit-${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            toast.success('PDF berhasil diunduh');
        } catch (error) {
            toast.error('Gagal generate PDF');
        }
    };

    const saveDoctor = async (doctorData) => {
        try {
            if (selectedDoctor) {
                await axios.put(
                    `http://localhost:5000/api/doctors/${selectedDoctor._id}`,
                    doctorData,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                toast.success('Data dokter diperbarui');
            } else {
                await axios.post(
                    'http://localhost:5000/api/doctors',
                    doctorData,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                toast.success('Dokter berhasil ditambahkan');
            }
            setShowDoctorModal(false);
            fetchDashboardData();
        } catch (error) {
            toast.error('Gagal menyimpan data dokter');
        }
    };

    const updateSchedule = async (doctorId, schedule) => {
        try {
            await axios.put(
                `http://localhost:5000/api/doctors/${doctorId}/schedule`,
                { schedule },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            toast.success('Jadwal dokter diperbarui');
            setShowScheduleModal(false);
            fetchDashboardData();
        } catch (error) {
            toast.error('Gagal memperbarui jadwal');
        }
    };

    const deactivateDoctor = async (doctorId) => {
        if (window.confirm('Yakin ingin menonaktifkan dokter ini?')) {
            try {
                await axios.delete(
                    `http://localhost:5000/api/doctors/${doctorId}`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                toast.success('Dokter dinonaktifkan');
                fetchDashboardData();
            } catch (error) {
                toast.error('Gagal menonaktifkan dokter');
            }
        }
    };

    const updateStock = async (medicineId, stock) => {
        try {
            await axios.put(
                `http://localhost:5000/api/pharmacy/medicines/${medicineId}/stock`,
                { stock },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            toast.success('Stok obat diperbarui');
            setShowMedicineModal(false);
            fetchDashboardData();
        } catch (error) {
            toast.error('Gagal memperbarui stok');
        }
    };

    const saveMedicine = async (medicineData) => {
        try {
            if (selectedMedicine) {
                await axios.put(
                    `http://localhost:5000/api/pharmacy/medicines/${selectedMedicine._id}`,
                    medicineData,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                toast.success('Data obat diperbarui');
            } else {
                await axios.post(
                    'http://localhost:5000/api/pharmacy/medicines',
                    medicineData,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                );
                toast.success('Obat berhasil ditambahkan');
            }
            setShowMedicineModal(false);
            fetchDashboardData();
        } catch (error) {
            toast.error('Gagal menyimpan data obat');
        }
    };

    const formatCurrency = (amount) => {
        return `Rp ${amount?.toLocaleString() || 0}`;
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

    // Chart Data
    const revenueChartData = {
        labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
        datasets: [
            {
                label: 'Pendapatan (Rp)',
                data: [1200000, 1500000, 1800000, 1600000, 2100000, 900000, 500000],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const consultationChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
        datasets: [
            {
                label: 'Konsultasi Online',
                data: [65, 72, 85, 90, 105, 120],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                label: 'Janji Temu',
                data: [45, 52, 58, 62, 70, 85],
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            }
        ]
    };

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4">
            <Row>
                {/* Sidebar */}
                <Col md={3} lg={2} className="bg-light sidebar vh-100 position-sticky top-0 pt-4">
                    <h5 className="px-3 mb-4">Menu Admin</h5>
                    <Nav className="flex-column">
                        <Nav.Link 
                            className={activeTab === 'dashboard' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            <FaChartLine className="me-2" /> Dashboard
                        </Nav.Link>
                        
                        <Nav.Link 
                            className={activeTab === 'payments' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('payments')}
                        >
                            <FaMoneyBillWave className="me-2" /> 
                            Verifikasi Pembayaran
                            {pendingPayments.length > 0 && (
                                <Badge bg="danger" className="ms-2">{pendingPayments.length}</Badge>
                            )}
                        </Nav.Link>
                        
                        <Nav.Link 
                            className={activeTab === 'doctors' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('doctors')}
                        >
                            <FaUserMd className="me-2" /> Kelola Dokter
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'consultations' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('consultations')}
                        >
                            <FaCalendarCheck className="me-2" /> Konsultasi
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'appointments' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('appointments')}
                        >
                            <FaCalendarCheck className="me-2" /> Janji Temu
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'sickLetters' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('sickLetters')}
                        >
                            <FaFileMedical className="me-2" /> Surat Sakit
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'pharmacy' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('pharmacy')}
                        >
                            <FaPills className="me-2" /> Farmasi
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'transactions' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('transactions')}
                        >
                            <FaMoneyBillWave className="me-2" /> Transaksi
                        </Nav.Link>
                        <Nav.Link 
                            className={activeTab === 'users' ? 'active bg-primary text-white' : ''}
                            onClick={() => setActiveTab('users')}
                        >
                            <FaUsers className="me-2" /> Pengguna
                        </Nav.Link>
                    </Nav>
                </Col>

                {/* Main Content */}
                <Col md={9} lg={10} className="py-4">
                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <div>
                            <h3 className="mb-4">Dashboard</h3>
                            <Row>
                                <Col md={3} className="mb-3">
                                    <Card className="bg-primary text-white">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <h6 className="mb-0">Total Pasien</h6>
                                                    <h2 className="mt-2 mb-0">{stats.totalPatients || 0}</h2>
                                                </div>
                                                <FaUsers size={40} />
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="bg-success text-white">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <h6 className="mb-0">Total Dokter</h6>
                                                    <h2 className="mt-2 mb-0">{stats.totalDoctors || 0}</h2>
                                                </div>
                                                <FaUserMd size={40} />
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="bg-info text-white">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <h6 className="mb-0">Konsultasi Hari Ini</h6>
                                                    <h2 className="mt-2 mb-0">{stats.todayConsultations || 0}</h2>
                                                </div>
                                                <FaCalendarCheck size={40} />
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="bg-warning text-white">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <h6 className="mb-0">Pendapatan Hari Ini</h6>
                                                    <h2 className="mt-2 mb-0">
                                                        Rp {(stats.todayRevenue || 0).toLocaleString()}
                                                    </h2>
                                                </div>
                                                <FaMoneyBillWave size={40} />
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            <Row className="mt-4">
                                <Col md={8}>
                                    <Card>
                                        <Card.Header>
                                            <h5 className="mb-0">Grafik Pendapatan Mingguan</h5>
                                        </Card.Header>
                                        <Card.Body>
                                            <Line data={revenueChartData} />
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={4}>
                                    <Card>
                                        <Card.Header>
                                            <h5 className="mb-0">Status Pembayaran</h5>
                                        </Card.Header>
                                        <Card.Body>
                                            <div className="text-center">
                                                <h1 className="display-3 text-warning">
                                                    {pendingPayments.length}
                                                </h1>
                                                <p className="text-muted">Pembayaran Menunggu Verifikasi</p>
                                                <Button 
                                                    variant="primary" 
                                                    size="sm"
                                                    onClick={() => setActiveTab('payments')}
                                                >
                                                    Verifikasi Sekarang
                                                </Button>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            <Row className="mt-4">
                                <Col md={12}>
                                    <Card>
                                        <Card.Header>
                                            <h5 className="mb-0">Statistik Layanan</h5>
                                        </Card.Header>
                                        <Card.Body>
                                            <Bar data={consultationChartData} />
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* PAYMENTS TAB */}
                    {activeTab === 'payments' && (
                        <div>
                            <h3 className="mb-4">Verifikasi Pembayaran Manual</h3>
                            
                            {pendingPayments.length === 0 ? (
                                <Card className="text-center p-5">
                                    <FaCheckCircle size={50} className="text-success mb-3" />
                                    <h5>Tidak Ada Pembayaran Menunggu Verifikasi</h5>
                                    <p className="text-muted">Semua pembayaran sudah diverifikasi.</p>
                                </Card>
                            ) : (
                                <Table striped bordered hover responsive>
                                    <thead>
                                        <tr>
                                            <th>ID Transaksi</th>
                                            <th>User</th>
                                            <th>Tanggal</th>
                                            <th>Layanan</th>
                                            <th>Jumlah</th>
                                            <th>Metode</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingPayments.map(payment => (
                                            <tr key={payment._id}>
                                                <td>
                                                    <code>{payment.transactionId}</code>
                                                </td>
                                                <td>
                                                    <strong>{payment.userId?.name}</strong>
                                                    <br />
                                                    <small className="text-muted">{payment.userId?.email}</small>
                                                </td>
                                                <td>{formatDate(payment.createdAt)}</td>
                                                <td>
                                                    <Badge bg="info">
                                                        {payment.paymentType === 'consultation' ? 'Konsultasi' : payment.paymentType}
                                                    </Badge>
                                                </td>
                                                <td className="fw-bold">{formatCurrency(payment.amount)}</td>
                                                <td>
                                                    {payment.bankName === 'QRIS' ? (
                                                        <><FaQrcode className="me-1 text-success" /> QRIS</>
                                                    ) : (
                                                        <><FaUniversity className="me-1 text-primary" /> {payment.bankName}</>
                                                    )}
                                                </td>
                                                <td>
                                                    <Badge bg="warning">Menunggu</Badge>
                                                </td>
                                                <td>
                                                    <Button
                                                        size="sm"
                                                        variant="info"
                                                        onClick={() => {
                                                            setSelectedPayment(payment);
                                                            setShowPaymentModal(true);
                                                        }}
                                                    >
                                                        <FaEye className="me-1" />
                                                        Lihat
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </div>
                    )}

                    {/* DOCTORS TAB */}
                    {activeTab === 'doctors' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h3>Kelola Dokter</h3>
                                <Button 
                                    variant="primary"
                                    onClick={() => {
                                        setSelectedDoctor(null);
                                        setShowDoctorModal(true);
                                    }}
                                >
                                    + Tambah Dokter
                                </Button>
                            </div>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Spesialisasi</th>
                                        <th>Biaya Konsultasi</th>
                                        <th>Rating</th>
                                        <th>Status</th>
                                        <th>Jadwal</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctors.map(doctor => (
                                        <tr key={doctor._id}>
                                            <td>{doctor.name}</td>
                                            <td>{doctor.specialization}</td>
                                            <td>Rp {doctor.consultationFee?.toLocaleString()}</td>
                                            <td>
                                                {doctor.rating} ⭐ 
                                                ({doctor.totalReviews || 0} ulasan)
                                            </td>
                                            <td>
                                                <Badge bg={doctor.isActive ? 'success' : 'danger'}>
                                                    {doctor.isActive ? 'Aktif' : 'Nonaktif'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button 
                                                    size="sm" 
                                                    variant="info"
                                                    onClick={() => {
                                                        setSelectedDoctor(doctor);
                                                        setShowScheduleModal(true);
                                                    }}
                                                >
                                                    Atur Jadwal
                                                </Button>
                                            </td>
                                            <td>
                                                <Button 
                                                    size="sm" 
                                                    variant="warning" 
                                                    className="me-2"
                                                    onClick={() => {
                                                        setSelectedDoctor(doctor);
                                                        setShowDoctorModal(true);
                                                    }}
                                                >
                                                    <FaEdit />
                                                </Button>
                                                {doctor.isActive && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="danger"
                                                        onClick={() => deactivateDoctor(doctor._id)}
                                                    >
                                                        <FaTimesCircle />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* SICK LETTERS TAB */}
                    {activeTab === 'sickLetters' && (
                        <div>
                            <h3 className="mb-4">Persetujuan Surat Sakit</h3>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>No. Surat</th>
                                        <th>Pasien</th>
                                        <th>Tanggal</th>
                                        <th>Diagnosis</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sickLetters.map(letter => (
                                        <tr key={letter._id}>
                                            <td>{letter.letterNumber || '-'}</td>
                                            <td>
                                                {letter.patientName || letter.userId?.name}
                                                <br />
                                                <small className="text-muted">
                                                    Usia: {letter.patientAge} th
                                                </small>
                                            </td>
                                            <td>
                                                {new Date(letter.startDate).toLocaleDateString('id-ID')}
                                                <br />
                                                <small className="text-muted">
                                                    s/d {new Date(letter.endDate).toLocaleDateString('id-ID')}
                                                </small>
                                            </td>
                                            <td>{letter.diagnosis}</td>
                                            <td>
                                                <Badge bg={
                                                    letter.status === 'pending' ? 'warning' :
                                                    letter.status === 'paid' ? 'info' :
                                                    letter.status === 'approved' ? 'primary' :
                                                    letter.status === 'issued' ? 'success' : 'secondary'
                                                }>
                                                    {letter.status}
                                                </Badge>
                                            </td>
                                            <td>
                                                {letter.status === 'pending' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="success"
                                                        className="me-2"
                                                        onClick={() => approveSickLetter(letter._id)}
                                                    >
                                                        <FaCheckCircle /> Setujui
                                                    </Button>
                                                )}
                                                {letter.status === 'approved' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="primary"
                                                        onClick={() => generatePDF(letter._id)}
                                                    >
                                                        <FaDownload /> Generate PDF
                                                    </Button>
                                                )}
                                                {letter.status === 'issued' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="info"
                                                        onClick={() => generatePDF(letter._id)}
                                                    >
                                                        <FaEye /> Lihat PDF
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* PHARMACY TAB */}
                    {activeTab === 'pharmacy' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h3>Manajemen Farmasi</h3>
                                <Button 
                                    variant="primary"
                                    onClick={() => {
                                        setSelectedMedicine(null);
                                        setShowMedicineModal(true);
                                    }}
                                >
                                    + Tambah Obat
                                </Button>
                            </div>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>Nama Obat</th>
                                        <th>Kategori</th>
                                        <th>Harga</th>
                                        <th>Stok</th>
                                        <th>Resep</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {medicines.map(medicine => (
                                        <tr key={medicine._id}>
                                            <td>
                                                {medicine.name}
                                                <br />
                                                <small className="text-muted">{medicine.genericName}</small>
                                            </td>
                                            <td>{medicine.category?.replace('_', ' ')}</td>
                                            <td>Rp {medicine.price?.toLocaleString()}</td>
                                            <td>
                                                <Badge bg={medicine.stock > 10 ? 'success' : medicine.stock > 0 ? 'warning' : 'danger'}>
                                                    {medicine.stock} {medicine.stock === 0 ? 'Habis' : ''}
                                                </Badge>
                                            </td>
                                            <td>
                                                {medicine.prescription ? 
                                                    <Badge bg="danger">Resep</Badge> : 
                                                    <Badge bg="success">Bebas</Badge>
                                                }
                                            </td>
                                            <td>
                                                <Button 
                                                    size="sm" 
                                                    variant="warning" 
                                                    className="me-2"
                                                    onClick={() => {
                                                        setSelectedMedicine(medicine);
                                                        setShowMedicineModal(true);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="info"
                                                    onClick={() => {
                                                        setSelectedMedicine(medicine);
                                                        setShowMedicineModal(true);
                                                    }}
                                                >
                                                    Update Stok
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* APPOINTMENTS TAB */}
                    {activeTab === 'appointments' && (
                        <div>
                            <h3 className="mb-4">Daftar Janji Temu</h3>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>No. Antrian</th>
                                        <th>Pasien</th>
                                        <th>Dokter</th>
                                        <th>Tanggal & Waktu</th>
                                        <th>Keluhan</th>
                                        <th>Status</th>
                                        <th>Pembayaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map(apt => (
                                        <tr key={apt._id}>
                                            <td>{apt.queueNumber}</td>
                                            <td>{apt.userId?.name}</td>
                                            <td>dr. {apt.doctorId?.name}</td>
                                            <td>
                                                {new Date(apt.appointmentDate).toLocaleDateString('id-ID')}
                                                <br />
                                                <small>{apt.appointmentTime}</small>
                                            </td>
                                            <td>{apt.complaint}</td>
                                            <td>
                                                <Badge bg={
                                                    apt.status === 'confirmed' ? 'success' :
                                                    apt.status === 'pending' ? 'warning' :
                                                    apt.status === 'completed' ? 'info' : 'danger'
                                                }>
                                                    {apt.status}
                                                </Badge>
                                            </td>
                                            <td>
                                                {apt.paymentId?.status === 'paid' ? 
                                                    <Badge bg="success">Lunas</Badge> : 
                                                    <Badge bg="warning">Pending</Badge>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* TRANSACTIONS TAB */}
                    {activeTab === 'transactions' && (
                        <div>
                            <h3 className="mb-4">Riwayat Transaksi</h3>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>ID Transaksi</th>
                                        <th>User</th>
                                        <th>Tipe</th>
                                        <th>Jumlah</th>
                                        <th>Status</th>
                                        <th>Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(trx => (
                                        <tr key={trx._id}>
                                            <td>{trx.transactionId}</td>
                                            <td>{trx.userId?.name}</td>
                                            <td>
                                                <Badge bg="info">
                                                    {trx.paymentType?.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td>Rp {trx.amount?.toLocaleString()}</td>
                                            <td>
                                                <Badge bg={trx.status === 'paid' ? 'success' : 'warning'}>
                                                    {trx.status}
                                                </Badge>
                                            </td>
                                            <td>
                                                {new Date(trx.createdAt).toLocaleDateString('id-ID')}
                                                <br />
                                                <small>{new Date(trx.createdAt).toLocaleTimeString('id-ID')}</small>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div>
                            <h3 className="mb-4">Data Pengguna</h3>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Email</th>
                                        <th>No. Telepon</th>
                                        <th>Role</th>
                                        <th>Tanggal Daftar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user._id}>
                                            <td>{user.name}</td>
                                            <td>{user.email}</td>
                                            <td>{user.phone}</td>
                                            <td>
                                                <Badge bg="primary">{user.role}</Badge>
                                            </td>
                                            <td>
                                                {new Date(user.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Col>
            </Row>

            {/* Modal Tambah/Edit Dokter */}
            <Modal show={showDoctorModal} onHide={() => setShowDoctorModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {selectedDoctor ? 'Edit Dokter' : 'Tambah Dokter Baru'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const doctorData = {
                            name: formData.get('name'),
                            specialization: formData.get('specialization'),
                            consultationFee: parseInt(formData.get('consultationFee')),
                            qualification: formData.get('qualification'),
                            experience: parseInt(formData.get('experience')),
                            bio: formData.get('bio'),
                            isActive: true
                        };
                        saveDoctor(doctorData);
                    }}>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Nama Lengkap</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        defaultValue={selectedDoctor?.name}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Spesialisasi</Form.Label>
                                    <Form.Select 
                                        name="specialization"
                                        defaultValue={selectedDoctor?.specialization}
                                        required
                                    >
                                        <option value="">Pilih Spesialisasi</option>
                                        <option value="Umum">Umum</option>
                                        <option value="Anak">Anak</option>
                                        <option value="Penyakit Dalam">Penyakit Dalam</option>
                                        <option value="Jantung">Jantung</option>
                                        <option value="Kandungan">Kandungan</option>
                                        <option value="Gigi">Gigi</option>
                                        <option value="THT">THT</option>
                                        <option value="Mata">Mata</option>
                                        <option value="Kulit">Kulit</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Biaya Konsultasi</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="consultationFee"
                                        defaultValue={selectedDoctor?.consultationFee}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Pengalaman (tahun)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="experience"
                                        defaultValue={selectedDoctor?.experience}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Kualifikasi Pendidikan</Form.Label>
                            <Form.Control
                                type="text"
                                name="qualification"
                                defaultValue={selectedDoctor?.qualification}
                                placeholder="Contoh: Spesialis Penyakit Dalam, Konsultan"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Biodata</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="bio"
                                defaultValue={selectedDoctor?.bio}
                                placeholder="Riwayat pendidikan, pengalaman, dll"
                            />
                        </Form.Group>
                        <Button type="submit" variant="primary" className="w-100">
                            {selectedDoctor ? 'Update' : 'Simpan'} Dokter
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal Atur Jadwal */}
            <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        Atur Jadwal Praktek - dr. {selectedDoctor?.name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        const schedule = [];
                        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        
                        days.forEach(day => {
                            const startTime = e.target[`${day}_start`]?.value;
                            const endTime = e.target[`${day}_end`]?.value;
                            const isAvailable = e.target[`${day}_available`]?.checked;
                            
                            if (isAvailable && startTime && endTime) {
                                schedule.push({
                                    day,
                                    slots: [{
                                        startTime,
                                        endTime,
                                        isAvailable: true
                                    }]
                                });
                            }
                        });
                        
                        updateSchedule(selectedDoctor._id, schedule);
                    }}>
                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>Hari</th>
                                    <th>Praktek?</th>
                                    <th>Jam Mulai</th>
                                    <th>Jam Selesai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                    const daySchedule = selectedDoctor?.availableDays?.find(d => d.day === day);
                                    return (
                                        <tr key={day}>
                                            <td>{day}</td>
                                            <td>
                                                <Form.Check 
                                                    type="checkbox"
                                                    name={`${day}_available`}
                                                    defaultChecked={!!daySchedule}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="time"
                                                    name={`${day}_start`}
                                                    defaultValue={daySchedule?.slots[0]?.startTime || '08:00'}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="time"
                                                    name={`${day}_end`}
                                                    defaultValue={daySchedule?.slots[0]?.endTime || '16:00'}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                        <Button type="submit" variant="primary" className="w-100">
                            Simpan Jadwal
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal Tambah/Edit Obat */}
            <Modal show={showMedicineModal} onHide={() => setShowMedicineModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {selectedMedicine ? 'Edit Obat' : 'Tambah Obat Baru'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        if (selectedMedicine) {
                            const stock = parseInt(e.target.stock.value);
                            updateStock(selectedMedicine._id, stock);
                        } else {
                            const medicineData = {
                                name: e.target.name.value,
                                genericName: e.target.genericName.value,
                                category: e.target.category.value,
                                price: parseInt(e.target.price.value),
                                stock: parseInt(e.target.stock.value),
                                description: e.target.description.value,
                                prescription: e.target.prescription.checked,
                                isActive: true
                            };
                            saveMedicine(medicineData);
                        }
                    }}>
                        <Form.Group className="mb-3">
                            <Form.Label>Nama Obat</Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                defaultValue={selectedMedicine?.name}
                                required={!selectedMedicine}
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Nama Generik</Form.Label>
                            <Form.Control
                                type="text"
                                name="genericName"
                                defaultValue={selectedMedicine?.genericName}
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Kategori</Form.Label>
                            <Form.Select 
                                name="category"
                                defaultValue={selectedMedicine?.category}
                                required={!selectedMedicine}
                            >
                                <option value="">Pilih Kategori</option>
                                <option value="obat_bebas">Obat Bebas</option>
                                <option value="obat_bebas_terbatas">Obat Bebas Terbatas</option>
                                <option value="obat_keras">Obat Keras</option>
                                <option value="antibiotik">Antibiotik</option>
                            </Form.Select>
                        </Form.Group>
                        
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Harga</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="price"
                                        defaultValue={selectedMedicine?.price}
                                        required={!selectedMedicine}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Stok</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="stock"
                                        defaultValue={selectedMedicine?.stock}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Deskripsi</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="description"
                                defaultValue={selectedMedicine?.description}
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                name="prescription"
                                label="Memerlukan Resep Dokter"
                                defaultChecked={selectedMedicine?.prescription}
                            />
                        </Form.Group>
                        
                        <Button type="submit" variant="primary" className="w-100">
                            {selectedMedicine ? 'Update Stok' : 'Simpan Obat'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal Detail Pembayaran */}
            <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaMoneyBillWave className="me-2 text-primary" />
                        Detail Pembayaran
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedPayment && (
                        <>
                            <Row className="mb-4">
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">📋 Informasi Transaksi</h6>
                                            <p className="mb-1">
                                                <strong>ID:</strong> {selectedPayment.transactionId}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Tanggal:</strong> {formatDate(selectedPayment.createdAt)}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Layanan:</strong> {selectedPayment.paymentType}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Jumlah:</strong> {formatCurrency(selectedPayment.amount)}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Metode:</strong> {selectedPayment.bankName}
                                            </p>
                                            {selectedPayment.transferDate && (
                                                <p className="mb-1">
                                                    <strong>Tgl Transfer:</strong> {new Date(selectedPayment.transferDate).toLocaleDateString('id-ID')}
                                                </p>
                                            )}
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">👤 Informasi User</h6>
                                            <p className="mb-1">
                                                <strong>Nama:</strong> {selectedPayment.userId?.name}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Email:</strong> {selectedPayment.userId?.email}
                                            </p>
                                            <p className="mb-1">
                                                <strong>Telepon:</strong> {selectedPayment.userId?.phone}
                                            </p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            {selectedPayment.paymentType === 'consultation' && selectedPayment.referenceId && (
                                <Card className="bg-light border-0 mb-4">
                                    <Card.Body>
                                        <h6 className="mb-3">🩺 Detail Konsultasi</h6>
                                        <p className="mb-1">
                                            <strong>Dokter:</strong> dr. {selectedPayment.referenceId?.doctorId?.name}
                                        </p>
                                        <p className="mb-1">
                                            <strong>Keluhan:</strong> {selectedPayment.referenceId?.symptoms}
                                        </p>
                                    </Card.Body>
                                </Card>
                            )}

                            <h6 className="mb-3">📎 Bukti Transfer</h6>
                            {selectedPayment.transferProof ? (
                                <div className="text-center border p-3 rounded bg-light">
                                    <img 
                                        src={`http://localhost:5000${selectedPayment.transferProof}`}
                                        alt="Bukti Transfer"
                                        style={{ maxHeight: '300px', maxWidth: '100%' }}
                                    />
                                    <div className="mt-3">
                                        <Button 
                                            variant="outline-primary"
                                            size="sm"
                                            href={`http://localhost:5000${selectedPayment.transferProof}`}
                                            target="_blank"
                                        >
                                            <FaDownload className="me-1" />
                                            Download Bukti
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Alert variant="warning">
                                    Belum ada bukti transfer yang diupload
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                        Tutup
                    </Button>
                    <Button 
                        variant="danger"
                        onClick={() => {
                            setShowPaymentModal(false);
                            setShowRejectModal(true);
                        }}
                    >
                        <FaTimesCircle className="me-1" />
                        Tolak
                    </Button>
                    <Button 
                        variant="success"
                        onClick={() => verifyPayment(selectedPayment._id, 'verified')}
                    >
                        <FaCheckCircle className="me-1" />
                        Verifikasi
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Modal Alasan Penolakan */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Alasan Penolakan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Catatan untuk user</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Contoh: Bukti tidak jelas, jumlah tidak sesuai, dll"
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Batal
                    </Button>
                    <Button 
                        variant="danger"
                        onClick={() => verifyPayment(selectedPayment._id, 'rejected')}
                    >
                        Tolak Pembayaran
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default AdminDashboard;