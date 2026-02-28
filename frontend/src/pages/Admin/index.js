import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../../utils/api';
import {
    Container, Row, Col, Nav, Table, Badge, Button,
    Form, Card, Modal, Alert, Spinner
} from 'react-bootstrap';
import {
    FaUsers, FaUserMd, FaCalendarCheck, FaPrescription,
    FaMoneyBillWave, FaFileMedical, FaChartLine, FaPills,
    FaCheckCircle, FaTimesCircle, FaEye, FaDownload, FaEdit,
    FaQrcode, FaUniversity, FaArrowRight, FaShieldAlt
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
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
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Title, Tooltip, Legend, Filler
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
    const [error, setError] = useState(null);

    // Modal states
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showMedicineModal, setShowMedicineModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');

    const { user } = useAuth();

    useEffect(() => {
        loadAll();
        const interval = setInterval(loadAll, 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── Fetch semua data sekaligus ───────────────────────────────────────────────
    const loadAll = async () => {
        try {
            setError(null);
            // BUG FIX #1: route yang benar adalah /api/admin/stats,
            // bukan /api/admin/payments/stats yang tidak ada di backend
            const [
                statsRes,
                pendingRes,
                doctorsRes,
                consultationsRes,
                lettersRes,
                appointmentsRes,
                medicinesRes,
                usersRes,
                transactionsRes
            ] = await Promise.all([
                api.get('/api/admin/stats'),               // ✅ route yang benar
                api.get('/api/admin/payments/pending'),
                api.get('/api/admin/doctors'),
                api.get('/api/admin/consultations'),
                api.get('/api/admin/sick-letters'),
                api.get('/api/admin/appointments'),
                api.get('/api/pharmacy/medicines'),
                api.get('/api/admin/users'),
                api.get('/api/admin/transactions')
            ]);

            setStats(statsRes.data || {});
            setPendingPayments(pendingRes.data.payments || []);
            setDoctors(doctorsRes.data.doctors || doctorsRes.data || []);
            setConsultations(consultationsRes.data || []);
            setSickLetters(lettersRes.data || []);
            setAppointments(appointmentsRes.data || []);
            setMedicines(medicinesRes.data.medicines || medicinesRes.data || []);
            setUsers(usersRes.data || []);
            setTransactions(transactionsRes.data || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
            setError('Gagal memuat data dashboard. Pastikan server aktif dan kamu sudah login sebagai admin.');
            toast.error('Gagal memuat data dashboard');
        } finally {
            // BUG FIX #2: setLoading(false) sekarang selalu dipanggil,
            // sebelumnya hanya ada di fetchPendingPayments sehingga bisa stuck
            setLoading(false);
        }
    };

    // ─── Actions ──────────────────────────────────────────────────────────────────
    const verifyPayment = async (paymentId, status) => {
        if (status === 'rejected' && !rejectNotes.trim()) {
            toast.error('Isi alasan penolakan terlebih dahulu');
            return;
        }
        try {
            await api.put(`/api/admin/payments/${paymentId}/verify`, {
                status,
                notes: status === 'rejected' ? rejectNotes : 'Pembayaran valid'
            });
            toast.success(`Pembayaran ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`);
            setShowPaymentModal(false);
            setShowRejectModal(false);
            setRejectNotes('');
            loadAll();
        } catch {
            toast.error('Gagal memproses verifikasi');
        }
    };

    const approveSickLetter = async (id) => {
        try {
            await api.put(`/api/admin/sick-letters/${id}/approve`);
            toast.success('Surat sakit disetujui');
            loadAll();
        } catch {
            toast.error('Gagal menyetujui surat sakit');
        }
    };

    const generatePDF = async (id) => {
        try {
            const response = await api.get(`/api/consultations/${id}/sick-letter/pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `surat-sakit-${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF berhasil diunduh');
        } catch {
            toast.error('Gagal generate PDF');
        }
    };

    const saveDoctor = async (doctorData) => {
        try {
            if (selectedDoctor) {
                await api.put(`/api/admin/doctors/${selectedDoctor._id}`, doctorData);
                toast.success('Data dokter diperbarui');
            } else {
                await api.post('/api/admin/doctors', doctorData);
                toast.success('Dokter berhasil ditambahkan');
            }
            setShowDoctorModal(false);
            loadAll();
        } catch {
            toast.error('Gagal menyimpan data dokter');
        }
    };

    const updateSchedule = async (doctorId, schedule) => {
        try {
            await api.put(`/api/doctors/${doctorId}/schedule`, { schedule });
            toast.success('Jadwal dokter diperbarui');
            setShowScheduleModal(false);
            loadAll();
        } catch {
            toast.error('Gagal memperbarui jadwal');
        }
    };

    const deactivateDoctor = async (doctorId) => {
        if (!window.confirm('Yakin ingin mengubah status dokter ini?')) return;
        try {
            // BUG FIX #3: gunakan toggle-status (PUT) bukan DELETE
            await api.put(`/api/admin/doctors/${doctorId}/toggle-status`);
            toast.success('Status dokter diperbarui');
            loadAll();
        } catch {
            toast.error('Gagal mengubah status dokter');
        }
    };

    const saveMedicine = async (medicineData) => {
        try {
            if (selectedMedicine) {
                await api.put(`/api/pharmacy/medicines/${selectedMedicine._id}`, medicineData);
                toast.success('Data obat diperbarui');
            } else {
                await api.post('/api/pharmacy/medicines', medicineData);
                toast.success('Obat berhasil ditambahkan');
            }
            setShowMedicineModal(false);
            loadAll();
        } catch {
            toast.error('Gagal menyimpan data obat');
        }
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────────
    const formatCurrency = (amount) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

    const formatDate = (date) =>
        new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

    // ─── Chart data ───────────────────────────────────────────────────────────────
    const revenueChartData = {
        labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
        datasets: [{
            label: 'Pendapatan (Rp)',
            data: [0, 0, 0, 0, 0, 0, stats.todayRevenue || 0],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
        }]
    };

    const serviceChartData = {
        labels: ['Konsultasi', 'Janji Temu', 'Surat Sakit', 'Pengguna', 'Dokter'],
        datasets: [{
            label: 'Jumlah',
            data: [
                consultations.length, appointments.length, sickLetters.length,
                users.length, doctors.length
            ],
            backgroundColor: [
                'rgba(54,162,235,0.6)', 'rgba(255,99,132,0.6)',
                'rgba(255,205,86,0.6)', 'rgba(75,192,192,0.6)',
                'rgba(153,102,255,0.6)'
            ],
            borderWidth: 1
        }]
    };

    // ─── Menu grid shortcut (dengan badge dinamis) ────────────────────────────────
    const menuItems = [
        {
            icon: <FaMoneyBillWave />, title: 'Verifikasi Pembayaran',
            desc: 'Proses pembayaran yang menunggu konfirmasi',
            color: 'warning', tab: 'payments',
            // BUG FIX #4: badge dinamis dari API, bukan hardcoded "3"
            count: pendingPayments.length
        },
        { icon: <FaUserMd />,        title: 'Kelola Dokter',      desc: 'Tambah, edit, dan atur jadwal dokter',       color: 'primary',   tab: 'doctors' },
        { icon: <FaCalendarCheck />, title: 'Janji Temu',         desc: 'Lihat semua jadwal pasien',                  color: 'success',   tab: 'appointments',   count: appointments.filter(a => a.status === 'pending').length || null },
        { icon: <FaFileMedical />,   title: 'Surat Sakit',        desc: 'Kelola dan setujui surat sakit',             color: 'info',      tab: 'sickLetters',    count: sickLetters.filter(l => l.status === 'draft').length || null },
        { icon: <FaPills />,         title: 'Farmasi',            desc: 'Manajemen stok dan data obat',               color: 'danger',    tab: 'pharmacy' },
        { icon: <FaUsers />,         title: 'Pengguna',           desc: 'Lihat semua data pengguna terdaftar',        color: 'secondary', tab: 'users' },
        { icon: <FaPrescription />,  title: 'Konsultasi',         desc: 'Pantau semua konsultasi berjalan',           color: 'dark',      tab: 'consultations' },
        { icon: <FaChartLine />,     title: 'Transaksi',          desc: 'Riwayat seluruh transaksi',                  color: 'primary',   tab: 'transactions' },
    ];

    // ─── Loading / Error states ───────────────────────────────────────────────────
    if (loading) {
        return (
            <Container className="py-5 text-center">
                <Spinner animation="border" variant="primary" role="status" />
                <p className="mt-3 text-muted">Memuat data dashboard...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="py-5">
                <Alert variant="danger">
                    <Alert.Heading>Gagal Memuat Dashboard</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="outline-danger" onClick={loadAll}>Coba Lagi</Button>
                </Alert>
            </Container>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <Container fluid className="py-4">
            <Row>
                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <Col md={3} lg={2} className="bg-light sidebar vh-100 position-sticky top-0 pt-4">
                    <h5 className="px-3 mb-4 d-flex align-items-center gap-2">
                        <FaShieldAlt className="text-warning" /> Menu Admin
                    </h5>
                    <Nav className="flex-column">
                        {[
                            { key: 'dashboard',     icon: <FaChartLine />,     label: 'Dashboard' },
                            { key: 'payments',      icon: <FaMoneyBillWave />, label: 'Verifikasi Pembayaran', badge: pendingPayments.length },
                            { key: 'doctors',       icon: <FaUserMd />,        label: 'Kelola Dokter' },
                            { key: 'consultations', icon: <FaCalendarCheck />, label: 'Konsultasi' },
                            { key: 'appointments',  icon: <FaCalendarCheck />, label: 'Janji Temu' },
                            { key: 'sickLetters',   icon: <FaFileMedical />,   label: 'Surat Sakit' },
                            { key: 'pharmacy',      icon: <FaPills />,         label: 'Farmasi' },
                            { key: 'transactions',  icon: <FaMoneyBillWave />, label: 'Transaksi' },
                            { key: 'users',         icon: <FaUsers />,         label: 'Pengguna' },
                        ].map(item => (
                            <Nav.Link
                                key={item.key}
                                className={`d-flex align-items-center justify-content-between py-2 ${
                                    activeTab === item.key ? 'bg-primary text-white rounded' : ''
                                }`}
                                onClick={() => setActiveTab(item.key)}
                            >
                                <span>{item.icon} <span className="ms-2">{item.label}</span></span>
                                {item.badge > 0 && <Badge bg="danger">{item.badge}</Badge>}
                            </Nav.Link>
                        ))}
                    </Nav>
                </Col>

                {/* ── Main Content ──────────────────────────────────────────── */}
                <Col md={9} lg={10} className="py-4">

                    {/* ══ DASHBOARD TAB ══════════════════════════════════════════ */}
                    {activeTab === 'dashboard' && (
                        <div>
                            {/* Welcome banner */}
                            <Card className="border-0 bg-primary text-white mb-4">
                                <Card.Body className="p-4">
                                    <Row className="align-items-center">
                                        <Col md={9}>
                                            <h3 className="mb-1">Selamat datang, {user?.name} 👋</h3>
                                            <p className="mb-0 opacity-75">
                                                Kelola seluruh operasional Klinik Pratama IPB dari sini.
                                            </p>
                                        </Col>
                                        <Col md={3} className="text-end">
                                            <FaShieldAlt size={60} className="opacity-25" />
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Card>

                            {/* Stats cards */}
                            <Row className="mb-4">
                                {[
                                    { label: 'Total Pasien',        value: stats.totalPatients || 0,           color: 'primary', icon: <FaUsers size={36} /> },
                                    { label: 'Total Dokter',        value: stats.totalDoctors || 0,            color: 'success', icon: <FaUserMd size={36} /> },
                                    { label: 'Konsultasi Hari Ini', value: stats.todayConsultations || 0,      color: 'info',    icon: <FaCalendarCheck size={36} /> },
                                    { label: 'Pendapatan Hari Ini', value: formatCurrency(stats.todayRevenue), color: 'warning', icon: <FaMoneyBillWave size={36} /> },
                                ].map((s, i) => (
                                    <Col md={3} className="mb-3" key={i}>
                                        <Card className={`bg-${s.color} text-white h-100`}>
                                            <Card.Body>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <h6 className="mb-0 opacity-75">{s.label}</h6>
                                                        <h2 className="mt-2 mb-0 fw-bold">{s.value}</h2>
                                                    </div>
                                                    <div className="opacity-50">{s.icon}</div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>

                            {/* Charts */}
                            <Row className="mb-4">
                                <Col md={8}>
                                    <Card className="h-100">
                                        <Card.Header><h5 className="mb-0">Grafik Pendapatan Mingguan</h5></Card.Header>
                                        <Card.Body><Line data={revenueChartData} /></Card.Body>
                                    </Card>
                                </Col>
                                <Col md={4}>
                                    <Card className="h-100">
                                        <Card.Header><h5 className="mb-0">Pembayaran Pending</h5></Card.Header>
                                        <Card.Body className="text-center d-flex flex-column justify-content-center">
                                            <h1 className="display-3 text-warning fw-bold">{pendingPayments.length}</h1>
                                            <p className="text-muted">Menunggu Verifikasi</p>
                                            <Button variant="primary" size="sm" onClick={() => setActiveTab('payments')}>
                                                Verifikasi Sekarang
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            <Row className="mb-4">
                                <Col>
                                    <Card>
                                        <Card.Header><h5 className="mb-0">Statistik Layanan</h5></Card.Header>
                                        <Card.Body><Bar data={serviceChartData} /></Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Menu grid shortcut */}
                            <h5 className="mb-3">Akses Cepat</h5>
                            <Row className="g-3">
                                {menuItems.map((item, idx) => (
                                    <Col md={3} key={idx}>
                                        <Card
                                            className="h-100 border-0 shadow-sm"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setActiveTab(item.tab)}
                                        >
                                            <Card.Body className="p-3 position-relative">
                                                {item.count > 0 && (
                                                    <Badge bg="danger" className="position-absolute top-0 end-0 m-2">
                                                        {item.count}
                                                    </Badge>
                                                )}
                                                <div className={`text-${item.color} mb-2`} style={{ fontSize: '1.8rem' }}>
                                                    {item.icon}
                                                </div>
                                                <h6 className="fw-bold mb-1">{item.title}</h6>
                                                <p className="text-muted small mb-2">{item.desc}</p>
                                                <span className={`text-${item.color} small`}>
                                                    Kelola <FaArrowRight size={10} className="ms-1" />
                                                </span>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    )}

                    {/* ══ PAYMENTS TAB ═══════════════════════════════════════════ */}
                    {activeTab === 'payments' && (
                        <div>
                            <h3 className="mb-4">Verifikasi Pembayaran Manual</h3>
                            {pendingPayments.length === 0 ? (
                                <Card className="text-center p-5 border-0 shadow-sm">
                                    <FaCheckCircle size={50} className="text-success mb-3 mx-auto" />
                                    <h5>Tidak Ada Pembayaran Menunggu</h5>
                                    <p className="text-muted mb-0">Semua pembayaran sudah diverifikasi.</p>
                                </Card>
                            ) : (
                                <Table striped bordered hover responsive>
                                    <thead className="table-dark">
                                        <tr>
                                            <th>ID Transaksi</th>
                                            <th>User</th>
                                            <th>Tanggal</th>
                                            <th>Layanan</th>
                                            <th>Jumlah</th>
                                            <th>Metode</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingPayments.map(payment => (
                                            <tr key={payment._id}>
                                                <td><code>{payment.transactionId}</code></td>
                                                <td>
                                                    <strong>{payment.userId?.name}</strong><br />
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
                                                    {payment.bankName === 'QRIS'
                                                        ? <><FaQrcode className="me-1 text-success" />QRIS</>
                                                        : <><FaUniversity className="me-1 text-primary" />{payment.bankName}</>
                                                    }
                                                </td>
                                                <td>
                                                    <Button size="sm" variant="info"
                                                        onClick={() => { setSelectedPayment(payment); setShowPaymentModal(true); }}>
                                                        <FaEye className="me-1" /> Lihat
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </div>
                    )}

                    {/* ══ DOCTORS TAB ════════════════════════════════════════════ */}
                    {activeTab === 'doctors' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h3>Kelola Dokter</h3>
                                <Button variant="primary" onClick={() => { setSelectedDoctor(null); setShowDoctorModal(true); }}>
                                    + Tambah Dokter
                                </Button>
                            </div>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>Nama</th><th>Spesialisasi</th><th>Biaya Konsultasi</th>
                                        <th>Rating</th><th>Status</th><th>Jadwal</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctors.map(doctor => (
                                        <tr key={doctor._id}>
                                            <td>{doctor.name}</td>
                                            <td>{doctor.specialization}</td>
                                            <td>{formatCurrency(doctor.consultationFee)}</td>
                                            <td>{doctor.rating} ⭐ ({doctor.totalReviews || 0})</td>
                                            <td>
                                                <Badge bg={doctor.isActive ? 'success' : 'danger'}>
                                                    {doctor.isActive ? 'Aktif' : 'Nonaktif'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button size="sm" variant="info"
                                                    onClick={() => { setSelectedDoctor(doctor); setShowScheduleModal(true); }}>
                                                    Atur Jadwal
                                                </Button>
                                            </td>
                                            <td>
                                                <Button size="sm" variant="warning" className="me-2"
                                                    onClick={() => { setSelectedDoctor(doctor); setShowDoctorModal(true); }}>
                                                    <FaEdit />
                                                </Button>
                                                <Button size="sm"
                                                    variant={doctor.isActive ? 'danger' : 'success'}
                                                    onClick={() => deactivateDoctor(doctor._id)}>
                                                    {doctor.isActive ? <FaTimesCircle /> : <FaCheckCircle />}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ══ CONSULTATIONS TAB ══════════════════════════════════════ */}
                    {activeTab === 'consultations' && (
                        <div>
                            <h3 className="mb-4">Semua Konsultasi</h3>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>Pasien</th><th>Dokter</th><th>Keluhan</th>
                                        <th>Status</th><th>Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consultations.map(c => (
                                        <tr key={c._id}>
                                            <td>{c.userId?.name}</td>
                                            <td>dr. {c.doctorId?.name}</td>
                                            <td>{c.symptoms}</td>
                                            <td>
                                                <Badge bg={
                                                    c.status === 'completed' ? 'success' :
                                                    c.status === 'ongoing'   ? 'primary' :
                                                    c.status === 'pending'   ? 'warning' : 'secondary'
                                                }>{c.status}</Badge>
                                            </td>
                                            <td>{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ══ SICK LETTERS TAB ═══════════════════════════════════════ */}
                    {activeTab === 'sickLetters' && (
                        <div>
                            <h3 className="mb-4">Persetujuan Surat Sakit</h3>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>No. Surat</th><th>Pasien</th><th>Periode</th>
                                        <th>Diagnosis</th><th>Status</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sickLetters.map(letter => (
                                        <tr key={letter._id}>
                                            <td>{letter.letterNumber || '-'}</td>
                                            <td>
                                                {letter.patientName || letter.userId?.name}<br />
                                                <small className="text-muted">Usia: {letter.patientAge} th</small>
                                            </td>
                                            <td>
                                                {new Date(letter.startDate).toLocaleDateString('id-ID')}
                                                {' s/d '}
                                                {new Date(letter.endDate).toLocaleDateString('id-ID')}
                                            </td>
                                            <td>{letter.diagnosis}</td>
                                            <td>
                                                {/* ✅ FIX: enum SickLetter hanya 'draft' | 'issued' */}
                                                <Badge bg={letter.status === 'issued' ? 'success' : 'warning'}>
                                                    {letter.status === 'issued' ? 'Diterbitkan' : 'Draft (Belum Terbit)'}
                                                </Badge>
                                            </td>
                                            <td>
                                                {/* ✅ FIX: 'draft' = bisa diterbitkan, 'issued' = bisa download PDF */}
                                                {letter.status === 'draft' && (
                                                    <Button size="sm" variant="success" className="me-2"
                                                        onClick={() => approveSickLetter(letter._id)}>
                                                        <FaCheckCircle /> Terbitkan
                                                    </Button>
                                                )}
                                                {letter.status === 'issued' && (
                                                    <Button size="sm" variant="info"
                                                        onClick={() => generatePDF(letter.consultationId?._id || letter.consultationId)}>
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

                    {/* ══ PHARMACY TAB ═══════════════════════════════════════════ */}
                    {activeTab === 'pharmacy' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h3>Manajemen Farmasi</h3>
                                <Button variant="primary" onClick={() => { setSelectedMedicine(null); setShowMedicineModal(true); }}>
                                    + Tambah Obat
                                </Button>
                            </div>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>Nama Obat</th><th>Kategori</th><th>Harga</th>
                                        <th>Stok</th><th>Resep</th><th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {medicines.map(medicine => (
                                        <tr key={medicine._id}>
                                            <td>
                                                {medicine.name}<br />
                                                <small className="text-muted">{medicine.genericName}</small>
                                            </td>
                                            <td>{medicine.category?.replace('_', ' ')}</td>
                                            <td>{formatCurrency(medicine.price)}</td>
                                            <td>
                                                <Badge bg={medicine.stock > 10 ? 'success' : medicine.stock > 0 ? 'warning' : 'danger'}>
                                                    {medicine.stock}{medicine.stock === 0 ? ' — Habis' : ''}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Badge bg={medicine.prescription ? 'danger' : 'success'}>
                                                    {medicine.prescription ? 'Resep' : 'Bebas'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button size="sm" variant="warning"
                                                    onClick={() => { setSelectedMedicine(medicine); setShowMedicineModal(true); }}>
                                                    <FaEdit /> Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ══ APPOINTMENTS TAB ═══════════════════════════════════════ */}
                    {activeTab === 'appointments' && (
                        <div>
                            <h3 className="mb-4">Semua Janji Temu</h3>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>No. Antrian</th><th>Pasien</th><th>Dokter</th>
                                        <th>Tanggal & Waktu</th><th>Keluhan</th>
                                        <th>Status</th><th>Pembayaran</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map(apt => (
                                        <tr key={apt._id}>
                                            <td>{apt.queueNumber}</td>
                                            <td>{apt.userId?.name}</td>
                                            <td>dr. {apt.doctorId?.name}</td>
                                            <td>
                                                {new Date(apt.appointmentDate).toLocaleDateString('id-ID')}<br />
                                                <small>{apt.appointmentTime}</small>
                                            </td>
                                            <td>{apt.complaint}</td>
                                            <td>
                                                <Badge bg={
                                                    apt.status === 'confirmed'  ? 'success' :
                                                    apt.status === 'pending'    ? 'warning' :
                                                    apt.status === 'completed'  ? 'info'    : 'danger'
                                                }>{apt.status}</Badge>
                                            </td>
                                            <td>
                                                <Badge bg={apt.paymentId?.status === 'paid' ? 'success' : 'warning'}>
                                                    {apt.paymentId?.status === 'paid' ? 'Lunas' : 'Pending'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ══ TRANSACTIONS TAB ═══════════════════════════════════════ */}
                    {activeTab === 'transactions' && (
                        <div>
                            <h3 className="mb-4">Riwayat Transaksi</h3>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>ID Transaksi</th><th>User</th><th>Tipe</th>
                                        <th>Jumlah</th><th>Status</th><th>Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(trx => (
                                        <tr key={trx._id}>
                                            <td><code>{trx.transactionId}</code></td>
                                            <td>{trx.userId?.name}</td>
                                            <td><Badge bg="info">{trx.paymentType?.replace('_', ' ')}</Badge></td>
                                            <td>{formatCurrency(trx.amount)}</td>
                                            <td>
                                                <Badge bg={
                                                    trx.status === 'paid'     ? 'success' :
                                                    trx.status === 'verified' ? 'primary' : 'warning'
                                                }>{trx.status}</Badge>
                                            </td>
                                            <td>
                                                {new Date(trx.createdAt).toLocaleDateString('id-ID')}<br />
                                                <small className="text-muted">{new Date(trx.createdAt).toLocaleTimeString('id-ID')}</small>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* ══ USERS TAB ══════════════════════════════════════════════ */}
                    {activeTab === 'users' && (
                        <div>
                            <h3 className="mb-4">Data Pengguna</h3>
                            <Table striped bordered hover responsive>
                                <thead className="table-dark">
                                    <tr>
                                        <th>Nama</th><th>Email</th><th>No. Telepon</th>
                                        <th>Role</th><th>Tanggal Daftar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td>{u.name}</td>
                                            <td>{u.email}</td>
                                            <td>{u.phone || '-'}</td>
                                            <td>
                                                <Badge bg={u.role === 'admin' ? 'danger' : u.role === 'doctor' ? 'success' : 'primary'}>
                                                    {u.role}
                                                </Badge>
                                            </td>
                                            <td>{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                </Col>
            </Row>

            {/* ══ MODAL: Tambah/Edit Dokter ════════════════════════════════════════ */}
            <Modal show={showDoctorModal} onHide={() => setShowDoctorModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{selectedDoctor ? 'Edit Dokter' : 'Tambah Dokter Baru'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.target);
                        saveDoctor({
                            name: fd.get('name'),
                            email: fd.get('email'),
                            password: fd.get('password'),
                            phone: fd.get('phone'),
                            specialization: fd.get('specialization'),
                            consultationFee: parseInt(fd.get('consultationFee')),
                            qualification: fd.get('qualification'),
                            experience: parseInt(fd.get('experience')),
                            bio: fd.get('bio'),
                            isActive: true
                        });
                    }}>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Nama Lengkap</Form.Label>
                                    <Form.Control type="text" name="name" defaultValue={selectedDoctor?.name} required />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Spesialisasi</Form.Label>
                                    <Form.Select name="specialization" defaultValue={selectedDoctor?.specialization} required>
                                        <option value="">Pilih Spesialisasi</option>
                                        {['Umum','Anak','Penyakit Dalam','Jantung','Kandungan','Gigi','THT','Mata','Kulit'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        {/* Email & password hanya saat tambah dokter baru */}
                        {!selectedDoctor && (
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Email Akun Dokter</Form.Label>
                                        <Form.Control type="email" name="email" required />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Password</Form.Label>
                                        <Form.Control type="password" name="password" required />
                                    </Form.Group>
                                </Col>
                            </Row>
                        )}
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Biaya Konsultasi</Form.Label>
                                    <Form.Control type="number" name="consultationFee" defaultValue={selectedDoctor?.consultationFee} required />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Pengalaman (tahun)</Form.Label>
                                    <Form.Control type="number" name="experience" defaultValue={selectedDoctor?.experience} required />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>No. Telepon</Form.Label>
                                    <Form.Control type="text" name="phone" defaultValue={selectedDoctor?.userId?.phone} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Kualifikasi Pendidikan</Form.Label>
                            <Form.Control type="text" name="qualification" defaultValue={selectedDoctor?.qualification} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Biodata</Form.Label>
                            <Form.Control as="textarea" rows={3} name="bio" defaultValue={selectedDoctor?.bio} />
                        </Form.Group>
                        <Button type="submit" variant="primary" className="w-100">
                            {selectedDoctor ? 'Update' : 'Simpan'} Dokter
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Atur Jadwal ═══════════════════════════════════════════════ */}
            <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Jadwal Praktek — dr. {selectedDoctor?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                        const schedule = days
                            .filter(day => e.target[`${day}_available`]?.checked)
                            .map(day => ({
                                day,
                                slots: [{
                                    startTime: e.target[`${day}_start`].value,
                                    endTime: e.target[`${day}_end`].value,
                                    isAvailable: true
                                }]
                            }));
                        updateSchedule(selectedDoctor._id, schedule);
                    }}>
                        <Table bordered>
                            <thead>
                                <tr><th>Hari</th><th>Praktek?</th><th>Jam Mulai</th><th>Jam Selesai</th></tr>
                            </thead>
                            <tbody>
                                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                                    const d = selectedDoctor?.availableDays?.find(x => x.day === day);
                                    return (
                                        <tr key={day}>
                                            <td>{day}</td>
                                            <td><Form.Check type="checkbox" name={`${day}_available`} defaultChecked={!!d} /></td>
                                            <td><Form.Control type="time" name={`${day}_start`} defaultValue={d?.slots[0]?.startTime || '08:00'} /></td>
                                            <td><Form.Control type="time" name={`${day}_end`} defaultValue={d?.slots[0]?.endTime || '16:00'} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                        <Button type="submit" variant="primary" className="w-100">Simpan Jadwal</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Tambah/Edit Obat ══════════════════════════════════════════ */}
            <Modal show={showMedicineModal} onHide={() => setShowMedicineModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{selectedMedicine ? 'Edit Obat' : 'Tambah Obat Baru'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => {
                        e.preventDefault();
                        saveMedicine({
                            name: e.target.name.value,
                            genericName: e.target.genericName.value,
                            category: e.target.category.value,
                            price: parseInt(e.target.price.value),
                            stock: parseInt(e.target.stock.value),
                            description: e.target.description.value,
                            prescription: e.target.prescription.checked,
                            isActive: true
                        });
                    }}>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Nama Obat</Form.Label>
                                    <Form.Control type="text" name="name" defaultValue={selectedMedicine?.name} required />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Nama Generik</Form.Label>
                                    <Form.Control type="text" name="genericName" defaultValue={selectedMedicine?.genericName} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Kategori</Form.Label>
                                    <Form.Select name="category" defaultValue={selectedMedicine?.category} required>
                                        <option value="">Pilih Kategori</option>
                                        <option value="obat_bebas">Obat Bebas</option>
                                        <option value="obat_bebas_terbatas">Obat Bebas Terbatas</option>
                                        <option value="obat_keras">Obat Keras</option>
                                        <option value="antibiotik">Antibiotik</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Harga</Form.Label>
                                    <Form.Control type="number" name="price" defaultValue={selectedMedicine?.price} required />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Stok</Form.Label>
                            <Form.Control type="number" name="stock" defaultValue={selectedMedicine?.stock} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Deskripsi</Form.Label>
                            <Form.Control as="textarea" rows={3} name="description" defaultValue={selectedMedicine?.description} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check type="checkbox" name="prescription" label="Memerlukan Resep Dokter"
                                defaultChecked={selectedMedicine?.prescription} />
                        </Form.Group>
                        <Button type="submit" variant="primary" className="w-100">
                            {selectedMedicine ? 'Update Obat' : 'Simpan Obat'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Detail Pembayaran ════════════════════════════════════════ */}
            <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title><FaMoneyBillWave className="me-2 text-primary" />Detail Pembayaran</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedPayment && (
                        <>
                            <Row className="mb-3">
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">📋 Informasi Transaksi</h6>
                                            <p className="mb-1"><strong>ID:</strong> {selectedPayment.transactionId}</p>
                                            <p className="mb-1"><strong>Tanggal:</strong> {formatDate(selectedPayment.createdAt)}</p>
                                            <p className="mb-1"><strong>Layanan:</strong> {selectedPayment.paymentType}</p>
                                            <p className="mb-1"><strong>Jumlah:</strong> {formatCurrency(selectedPayment.amount)}</p>
                                            <p className="mb-0"><strong>Metode:</strong> {selectedPayment.bankName}</p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card className="bg-light border-0">
                                        <Card.Body>
                                            <h6 className="mb-3">👤 Informasi User</h6>
                                            <p className="mb-1"><strong>Nama:</strong> {selectedPayment.userId?.name}</p>
                                            <p className="mb-1"><strong>Email:</strong> {selectedPayment.userId?.email}</p>
                                            <p className="mb-0"><strong>Telepon:</strong> {selectedPayment.userId?.phone || '-'}</p>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            {selectedPayment.paymentType === 'consultation' && selectedPayment.referenceId && (
                                <Card className="bg-light border-0 mb-3">
                                    <Card.Body>
                                        <h6 className="mb-3">🩺 Detail Konsultasi</h6>
                                        <p className="mb-1"><strong>Dokter:</strong> dr. {selectedPayment.referenceId?.doctorId?.name}</p>
                                        <p className="mb-0"><strong>Keluhan:</strong> {selectedPayment.referenceId?.symptoms}</p>
                                    </Card.Body>
                                </Card>
                            )}

                            <h6 className="mb-2">📎 Bukti Transfer</h6>
                            {selectedPayment.transferProof ? (
                                <div className="text-center border p-3 rounded bg-light">
                                    <img
                                        src={`${API_URL}${selectedPayment.transferProof}`}
                                        alt="Bukti Transfer"
                                        style={{ maxHeight: '300px', maxWidth: '100%' }}
                                    />
                                    <div className="mt-3">
                                        <Button variant="outline-primary" size="sm"
                                            href={`${API_URL}${selectedPayment.transferProof}`}
                                            target="_blank">
                                            <FaDownload className="me-1" /> Download Bukti
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Alert variant="warning">Belum ada bukti transfer yang diupload</Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Tutup</Button>
                    <Button variant="danger" onClick={() => { setShowPaymentModal(false); setShowRejectModal(true); }}>
                        <FaTimesCircle className="me-1" /> Tolak
                    </Button>
                    <Button variant="success" onClick={() => verifyPayment(selectedPayment?._id, 'verified')}>
                        <FaCheckCircle className="me-1" /> Verifikasi
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ══ MODAL: Alasan Penolakan ══════════════════════════════════════════ */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Alasan Penolakan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Catatan untuk user</Form.Label>
                        <Form.Control
                            as="textarea" rows={3}
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Contoh: Bukti tidak jelas, jumlah tidak sesuai, dll"
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Batal</Button>
                    <Button variant="danger" onClick={() => verifyPayment(selectedPayment?._id, 'rejected')}>
                        Tolak Pembayaran
                    </Button>
                </Modal.Footer>
            </Modal>

        </Container>
    );
};

export default AdminDashboard;
