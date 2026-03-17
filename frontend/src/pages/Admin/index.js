import React, { useState, useEffect, useCallback } from 'react';
import api, { API_URL } from '../../utils/api';
import {
    Container, Row, Col, Nav, Table, Badge, Button,
    Form, Card, Modal, Alert, Spinner
} from 'react-bootstrap';
import {
    FaUsers, FaUserMd, FaCalendarCheck, FaPrescription,
    FaMoneyBillWave, FaFileMedical, FaChartLine, FaPills,
    FaCheckCircle, FaTimesCircle, FaEye, FaDownload, FaEdit,
    FaQrcode, FaUniversity, FaArrowRight, FaCog
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Line, Bar } from 'react-chartjs-2';
import ClinicSettingsTab from './ClinicSettings';
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
                api.get('/api/admin/stats'),
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
            await api.put(`/api/admin/doctors/${doctorId}/toggle-status`);
            toast.success('Status dokter diperbarui');
            loadAll();
        } catch {
            toast.error('Gagal mengubah status dokter');
        }
    };

    const toggleDoctorOnline = async (doctor) => {
        try {
            await api.put(`/api/doctors/${doctor._id}/online-status`, { isOnline: !doctor.isOnline });
            toast.success(`Dokter dr. ${doctor.name}: ${!doctor.isOnline ? 'Online' : 'Offline'}`);
            loadAll();
        } catch {
            toast.error('Gagal mengubah status online');
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

    // ─── Fungsi untuk mendapatkan 7 hari terakhir dengan format yang benar ───
    const getLast7Days = useCallback(() => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const result = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dayName = days[date.getDay()];
            const day = date.getDate();
            const month = months[date.getMonth()];
            result.push({
                label: `${dayName} (${day} ${month})`,
                dateStr: date.toISOString().split('T')[0],
                dayIndex: date.getDay(),
                date: date
            });
        }
        return result;
    }, []);

    const last7Days = getLast7Days();

    // ─── Data untuk grafik pendapatan ───
    const getRevenueChartData = useCallback(() => {
        const labels = last7Days.map(day => day.label);
        
        // Ambil data dari stats.dailyRevenue jika tersedia
        const data = last7Days.map(day => {
            if (stats?.dailyRevenue && stats.dailyRevenue[day.dateStr]) {
                return stats.dailyRevenue[day.dateStr];
            }
            return 0;
        });

        return {
            labels: labels,
            datasets: [{
                label: 'Pendapatan (Rp)',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };
    }, [stats, last7Days]);

    // ─── Data untuk grafik konsultasi ───
    const getConsultationChartData = useCallback(() => {
        const labels = last7Days.map(day => day.label);
        
        // Ambil data dari stats.dailyConsultations jika tersedia
        const data = last7Days.map(day => {
            if (stats?.dailyConsultations && stats.dailyConsultations[day.dateStr]) {
                return stats.dailyConsultations[day.dateStr];
            }
            return 0;
        });

        return {
            labels: labels,
            datasets: [{
                label: 'Jumlah Konsultasi',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };
    }, [stats, last7Days]);

    const revenueChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0
                            }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#e2e8f0',
                    drawBorder: false
                },
                ticks: {
                    callback: function(value) {
                        return 'Rp ' + value.toLocaleString('id-ID');
                    }
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    const consultationChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `Jumlah: ${context.parsed.y} konsultasi`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#e2e8f0',
                    drawBorder: false
                },
                ticks: {
                    stepSize: 1,
                    callback: function(value) {
                        return value;
                    }
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
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
                'rgba(59,130,246,0.6)',
                'rgba(16,185,129,0.6)',
                'rgba(245,158,11,0.6)',
                'rgba(139,92,246,0.6)',
                'rgba(236,72,153,0.6)'
            ],
            borderWidth: 0,
            borderRadius: 6
        }]
    };

    const serviceChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#e2e8f0',
                    drawBorder: false
                },
                ticks: {
                    stepSize: 1
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    // ─── Menu grid shortcut ────────────────────────────────────────────────
    const menuItems = [
        {
            icon: <FaMoneyBillWave />, title: 'Verifikasi Pembayaran',
            desc: 'Proses pembayaran yang menunggu konfirmasi',
            tab: 'payments',
            count: pendingPayments.length
        },
        { icon: <FaUserMd />,        title: 'Kelola Dokter',      desc: 'Tambah, edit, dan atur jadwal dokter',       tab: 'doctors' },
        { icon: <FaCalendarCheck />, title: 'Janji Temu',         desc: 'Lihat semua jadwal pasien',                  tab: 'appointments',   count: appointments.filter(a => a.status === 'pending').length || null },
        { icon: <FaFileMedical />,   title: 'Surat Sakit',        desc: 'Kelola dan setujui surat sakit',             tab: 'sickLetters',    count: sickLetters.filter(l => l.status === 'draft').length || null },
        { icon: <FaPills />,         title: 'Farmasi',            desc: 'Manajemen stok dan data obat',               tab: 'pharmacy' },
        { icon: <FaUsers />,         title: 'Pengguna',           desc: 'Lihat semua data pengguna terdaftar',        tab: 'users' },
        { icon: <FaPrescription />,  title: 'Konsultasi',         desc: 'Pantau semua konsultasi berjalan',           tab: 'consultations',  count: consultations.filter(c => c.status === 'pending_payment').length || null },
        { icon: <FaChartLine />,     title: 'Transaksi',          desc: 'Riwayat seluruh transaksi',                  tab: 'transactions' },
    ];

    // ─── Loading / Error states ───────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <Spinner animation="border" variant="primary" />
                    <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px' }}>
                <Alert variant="danger" style={{ maxWidth: 600, margin: '0 auto' }}>
                    <Alert.Heading>Gagal Memuat Dashboard</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="outline-danger" onClick={loadAll}>Coba Lagi</Button>
                </Alert>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            
            <style>{`
                .admin-sidebar {
                    background: #ffffff;
                    border-right: 1px solid #e2e8f0;
                    height: 100vh;
                    position: sticky;
                    top: 0;
                    overflow-y: auto;
                }
                .admin-sidebar .nav-link {
                    color: #475569;
                    padding: 10px 16px;
                    margin: 2px 8px;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }
                .admin-sidebar .nav-link:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                .admin-sidebar .nav-link.active {
                    background: #f1f5f9;
                    color: #2563eb;
                    font-weight: 500;
                }
                .stat-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.2s ease;
                }
                .stat-card:hover {
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }
                .menu-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    height: 100%;
                }
                .menu-card:hover {
                    background: #f8fafc;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
                }
                .badge-count {
                    background: #fee2e2;
                    color: #b91c1c;
                    border-radius: 20px;
                    padding: 2px 8px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-status {
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .badge-success { background: #dcfce7; color: #166534; }
                .badge-warning { background: #fef3c7; color: #b45309; }
                .badge-danger { background: #fee2e2; color: #b91c1c; }
                .badge-info { background: #dbeafe; color: #1e40af; }
                .badge-secondary { background: #f1f5f9; color: #475569; }
                .table-custom {
                    background: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                .table-custom thead th {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    color: #475569;
                    font-weight: 600;
                    font-size: 13px;
                    padding: 16px;
                }
                .table-custom td {
                    padding: 16px;
                    border-bottom: 1px solid #e2e8f0;
                    color: #0f172a;
                    vertical-align: middle;
                }
                .btn-custom {
                    border-radius: 8px;
                    padding: 6px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .btn-custom-primary {
                    background: #2563eb;
                    border: none;
                    color: white;
                }
                .btn-custom-primary:hover {
                    background: #1d4ed8;
                }
                .btn-custom-outline {
                    background: transparent;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                }
                .btn-custom-outline:hover {
                    background: #f1f5f9;
                }
                .greeting-banner {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 16px;
                    padding: 24px;
                    color: white;
                }
                .chart-container {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    height: 100%;
                }
            `}</style>

            <Container fluid style={{ padding: 0 }}>
                <Row style={{ margin: 0 }}>
                    {/* ── Sidebar ──────────────────────────────────────────────── */}
                    <Col md={3} lg={2} className="admin-sidebar" style={{ padding: '24px 0' }}>
                        <div style={{ padding: '0 16px 20px 16px' }}>
                            <h5 style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Admin Panel</h5>
                            <p style={{ fontSize: 12, color: '#64748b' }}>Klinik Pratama IPB</p>
                        </div>
                        <Nav className="flex-column">
                            {[
                                { key: 'dashboard',     icon: <FaChartLine />,     label: 'Dashboard' },
                                { key: 'payments',      icon: <FaMoneyBillWave />, label: 'Verifikasi Pembayaran', badge: pendingPayments.length },
                                { key: 'doctors',       icon: <FaUserMd />,        label: 'Kelola Dokter' },
                                { key: 'consultations', icon: <FaPrescription />, label: 'Konsultasi' },
                                { key: 'appointments',  icon: <FaCalendarCheck />, label: 'Janji Temu' },
                                { key: 'sickLetters',   icon: <FaFileMedical />,   label: 'Surat Sakit' },
                                { key: 'pharmacy',      icon: <FaPills />,         label: 'Farmasi' },
                                { key: 'transactions',  icon: <FaChartLine />,     label: 'Transaksi' },
                                { key: 'users',         icon: <FaUsers />,         label: 'Pengguna' },
                                { key: 'clinicSettings',icon: <FaCog />,           label: 'Pengaturan Klinik' },
                            ].map(item => (
                                <Nav.Link
                                    key={item.key}
                                    className={`d-flex align-items-center justify-content-between ${activeTab === item.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(item.key)}
                                >
                                    <span>
                                        <span style={{ marginRight: 12, fontSize: 16 }}>{item.icon}</span>
                                        <span style={{ fontSize: 13 }}>{item.label}</span>
                                    </span>
                                    {item.badge > 0 && <span className="badge-count">{item.badge}</span>}
                                </Nav.Link>
                            ))}
                        </Nav>
                    </Col>

                    {/* ── Main Content ──────────────────────────────────────────── */}
                    <Col md={9} lg={10} style={{ padding: '24px' }}>

                        {/* ══ DASHBOARD TAB ══════════════════════════════════════════ */}
                        {activeTab === 'dashboard' && (
                            <div>
                                {/* Welcome banner */}
                                <div className="greeting-banner" style={{ marginBottom: 24 }}>
                                    <Row>
                                        <Col md={8}>
                                            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
                                                Selamat datang, {user?.name} 👋
                                            </h2>
                                            <p style={{ opacity: 0.9, marginBottom: 0 }}>
                                                Kelola seluruh operasional Klinik Pratama IPB dari sini.
                                            </p>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Stats cards */}
                                <Row style={{ marginBottom: 24 }}>
                                    {[
                                        { label: 'Total Pasien',        value: stats.totalPatients || 0,           icon: <FaUsers size={28} /> },
                                        { label: 'Total Dokter',        value: stats.totalDoctors || 0,            icon: <FaUserMd size={28} /> },
                                        { label: 'Konsultasi Hari Ini', value: stats.todayConsultations || 0,      icon: <FaCalendarCheck size={28} /> },
                                        { label: 'Pendapatan Hari Ini', value: formatCurrency(stats.todayRevenue), icon: <FaMoneyBillWave size={28} /> },
                                    ].map((s, i) => (
                                        <Col md={3} key={i}>
                                            <div className="stat-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                    <div style={{ color: '#64748b', fontSize: 13 }}>{s.label}</div>
                                                    <div style={{ color: '#2563eb', opacity: 0.5 }}>{s.icon}</div>
                                                </div>
                                                <div style={{ fontSize: 28, fontWeight: 600, color: '#0f172a' }}>{s.value}</div>
                                            </div>
                                        </Col>
                                    ))}
                                </Row>

                                {/* Charts */}
                                <Row style={{ marginBottom: 24 }}>
                                    <Col md={8}>
                                        <div className="chart-container" style={{ height: '300px' }}>
                                            <h6 style={{ fontWeight: 600, marginBottom: 16 }}>Grafik Pendapatan 7 Hari Terakhir</h6>
                                            <Line 
                                                data={getRevenueChartData()} 
                                                options={revenueChartOptions}
                                                height={250}
                                            />
                                        </div>
                                    </Col>
                                    <Col md={4}>
                                        <div className="stat-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Pembayaran Pending</div>
                                                <div style={{ fontSize: 48, fontWeight: 600, color: '#b45309', marginBottom: 12 }}>{pendingPayments.length}</div>
                                                <Button 
                                                    variant="primary" 
                                                    size="sm"
                                                    onClick={() => setActiveTab('payments')}
                                                    style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 24px' }}
                                                >
                                                    Verifikasi
                                                </Button>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>

                                <Row style={{ marginBottom: 32 }}>
                                    <Col md={6}>
                                        <div className="chart-container" style={{ height: '300px' }}>
                                            <h6 style={{ fontWeight: 600, marginBottom: 16 }}>Grafik Konsultasi 7 Hari Terakhir</h6>
                                            <Line 
                                                data={getConsultationChartData()} 
                                                options={consultationChartOptions}
                                                height={250}
                                            />
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="chart-container" style={{ height: '300px' }}>
                                            <h6 style={{ fontWeight: 600, marginBottom: 16 }}>Statistik Layanan</h6>
                                            <Bar 
                                                data={serviceChartData} 
                                                options={serviceChartOptions}
                                                height={250}
                                            />
                                        </div>
                                    </Col>
                                </Row>

                                {/* Menu grid shortcut */}
                                <h6 style={{ fontWeight: 600, marginBottom: 16 }}>Akses Cepat</h6>
                                <Row className="g-3">
                                    {menuItems.map((item, idx) => (
                                        <Col md={3} key={idx}>
                                            <div className="menu-card" onClick={() => setActiveTab(item.tab)}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                    <div style={{ fontSize: 28, color: '#2563eb' }}>{item.icon}</div>
                                                    {item.count > 0 && <span className="badge-count">{item.count}</span>}
                                                </div>
                                                <h6 style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{item.title}</h6>
                                                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{item.desc}</p>
                                                <span style={{ fontSize: 12, color: '#2563eb' }}>
                                                    Kelola <FaArrowRight size={10} style={{ marginLeft: 4 }} />
                                                </span>
                                            </div>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        )}

                        {/* ══ PAYMENTS TAB ═══════════════════════════════════════════ */}
                        {activeTab === 'payments' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <h5 style={{ fontWeight: 600 }}>Verifikasi Pembayaran Manual</h5>
                                </div>
                                {pendingPayments.length === 0 ? (
                                    <div className="stat-card" style={{ textAlign: 'center', padding: 48 }}>
                                        <FaCheckCircle size={48} style={{ color: '#22c55e', marginBottom: 16 }} />
                                        <h6 style={{ fontWeight: 600, marginBottom: 8 }}>Tidak Ada Pembayaran Menunggu</h6>
                                        <p style={{ color: '#64748b', marginBottom: 0 }}>Semua pembayaran sudah diverifikasi.</p>
                                    </div>
                                ) : (
                                    <div className="table-custom">
                                        <Table responsive style={{ marginBottom: 0 }}>
                                            <thead>
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
                                                        <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>{payment.transactionId}</code></td>
                                                        <td>
                                                            <div style={{ fontWeight: 500 }}>{payment.userId?.name}</div>
                                                            <div style={{ fontSize: 12, color: '#64748b' }}>{payment.userId?.email}</div>
                                                        </td>
                                                        <td style={{ fontSize: 13 }}>{formatDate(payment.createdAt)}</td>
                                                        <td>
                                                            <span className="badge-status badge-info">
                                                                {payment.paymentType === 'consultation' ? 'Konsultasi' : payment.paymentType}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{formatCurrency(payment.amount)}</td>
                                                        <td>
                                                            {payment.bankName === 'QRIS'
                                                                ? <><FaQrcode style={{ marginRight: 6, color: '#16a34a' }} />QRIS</>
                                                                : <><FaUniversity style={{ marginRight: 6, color: '#2563eb' }} />{payment.bankName}</>
                                                            }
                                                        </td>
                                                        <td>
                                                            <Button 
                                                                size="sm"
                                                                variant="outline-primary"
                                                                onClick={() => { setSelectedPayment(payment); setShowPaymentModal(true); }}
                                                                style={{ borderColor: '#e2e8f0', color: '#475569' }}
                                                            >
                                                                <FaEye style={{ marginRight: 4 }} /> Detail
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ══ DOCTORS TAB ════════════════════════════════════════════ */}
                        {activeTab === 'doctors' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <h5 style={{ fontWeight: 600 }}>Kelola Dokter</h5>
                                    <Button 
                                        variant="primary"
                                        onClick={() => { setSelectedDoctor(null); setShowDoctorModal(true); }}
                                        style={{ background: '#2563eb', border: 'none', borderRadius: 8 }}
                                    >
                                        + Tambah Dokter
                                    </Button>
                                </div>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Nama</th><th>Spesialisasi</th><th>Biaya</th>
                                                <th>Rating</th><th>Status</th><th>Online</th><th>Jadwal</th><th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {doctors.map(doctor => (
                                                <tr key={doctor._id}>
                                                    <td><span style={{ fontWeight: 500 }}>{doctor.name}</span></td>
                                                    <td>{doctor.specialization}</td>
                                                    <td>{formatCurrency(doctor.consultationFee)}</td>
                                                    <td>{doctor.rating} ⭐ ({doctor.totalReviews || 0})</td>
                                                    <td>
                                                        <span className={`badge-status ${doctor.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                            {doctor.isActive ? 'Aktif' : 'Nonaktif'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <Button
                                                            size="sm"
                                                            variant={doctor.isOnline ? 'success' : 'outline-secondary'}
                                                            onClick={() => toggleDoctorOnline(doctor)}
                                                            style={{ fontSize: 12 }}
                                                        >
                                                            {doctor.isOnline ? 'Online' : 'Offline'}
                                                        </Button>
                                                    </td>
                                                    <td>
                                                        <Button size="sm" variant="outline-info"
                                                            onClick={() => { setSelectedDoctor(doctor); setShowScheduleModal(true); }}>
                                                            Atur
                                                        </Button>
                                                    </td>
                                                    <td>
                                                        <Button size="sm" variant="outline-warning" className="me-2"
                                                            onClick={() => { setSelectedDoctor(doctor); setShowDoctorModal(true); }}>
                                                            <FaEdit />
                                                        </Button>
                                                        <Button size="sm"
                                                            variant={doctor.isActive ? 'outline-danger' : 'outline-success'}
                                                            onClick={() => deactivateDoctor(doctor._id)}>
                                                            {doctor.isActive ? <FaTimesCircle /> : <FaCheckCircle />}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ CONSULTATIONS TAB ══════════════════════════════════════ */}
                        {activeTab === 'consultations' && (
                            <div>
                                <h5 style={{ fontWeight: 600, marginBottom: 24 }}>Semua Konsultasi</h5>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Pasien</th><th>Dokter</th><th>Keluhan</th>
                                                <th>Status</th><th>Tanggal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {consultations.map(c => (
                                                <tr key={c._id}>
                                                    <td><span style={{ fontWeight: 500 }}>{c.userId?.name}</span></td>
                                                    <td>dr. {c.doctorId?.name}</td>
                                                    <td style={{ maxWidth: 200 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {c.symptoms}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-status ${
                                                            c.status === 'completed' ? 'badge-success' :
                                                            c.status === 'ongoing' ? 'badge-info' :
                                                            c.status === 'pending_payment' ? 'badge-warning' :
                                                            c.status === 'cancelled' ? 'badge-danger' : 'badge-secondary'
                                                        }`}>
                                                            {c.status === 'pending_payment'  ? 'Menunggu Bayar' :
                                                             c.status === 'paid'             ? 'Dibayar' :
                                                             c.status === 'scheduled'        ? 'Terjadwal' :
                                                             c.status === 'ongoing'          ? 'Berlangsung' :
                                                             c.status === 'completed'        ? 'Selesai' :
                                                             c.status === 'cancelled'        ? 'Dibatalkan' :
                                                             c.status === 'expired'          ? 'Kadaluarsa' :
                                                             c.status === 'no_show'          ? 'Tidak Hadir' : c.status}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ SICK LETTERS TAB ═══════════════════════════════════════ */}
                        {activeTab === 'sickLetters' && (
                            <div>
                                <h5 style={{ fontWeight: 600, marginBottom: 24 }}>Persetujuan Surat Sakit</h5>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
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
                                                        <div style={{ fontWeight: 500 }}>{letter.patientName || letter.userId?.name}</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>Usia: {letter.patientAge} th</div>
                                                    </td>
                                                    <td>
                                                        {new Date(letter.startDate).toLocaleDateString('id-ID')}
                                                        <br />
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>
                                                            s/d {new Date(letter.endDate).toLocaleDateString('id-ID')}
                                                        </span>
                                                    </td>
                                                    <td>{letter.diagnosis}</td>
                                                    <td>
                                                        <span className={`badge-status ${letter.status === 'issued' ? 'badge-success' : 'badge-warning'}`}>
                                                            {letter.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {letter.status === 'draft' && (
                                                            <Button size="sm" variant="success" className="me-2"
                                                                onClick={() => approveSickLetter(letter._id)}>
                                                                Terbitkan
                                                            </Button>
                                                        )}
                                                        {letter.status === 'issued' && (
                                                            <Button size="sm" variant="info"
                                                                onClick={() => generatePDF(letter.consultationId?._id || letter.consultationId)}>
                                                                <FaEye style={{ marginRight: 4 }} /> PDF
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ PHARMACY TAB ═══════════════════════════════════════════ */}
                        {activeTab === 'pharmacy' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <h5 style={{ fontWeight: 600 }}>Manajemen Farmasi</h5>
                                    <Button 
                                        variant="primary"
                                        onClick={() => { setSelectedMedicine(null); setShowMedicineModal(true); }}
                                        style={{ background: '#2563eb', border: 'none', borderRadius: 8 }}
                                    >
                                        + Tambah Obat
                                    </Button>
                                </div>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Nama Obat</th><th>Kategori</th><th>Harga</th>
                                                <th>Stok</th><th>Resep</th><th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {medicines.map(medicine => (
                                                <tr key={medicine._id}>
                                                    <td>
                                                        <div style={{ fontWeight: 500 }}>{medicine.name}</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>{medicine.genericName}</div>
                                                    </td>
                                                    <td>{medicine.category?.replace('_', ' ')}</td>
                                                    <td>{formatCurrency(medicine.price)}</td>
                                                    <td>
                                                        <span className={`badge-status ${
                                                            medicine.stock > 10 ? 'badge-success' : 
                                                            medicine.stock > 0 ? 'badge-warning' : 'badge-danger'
                                                        }`}>
                                                            {medicine.stock}
                                                            {medicine.stock === 0 ? ' (Habis)' : ''}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-status ${medicine.prescription ? 'badge-danger' : 'badge-success'}`}>
                                                            {medicine.prescription ? 'Resep' : 'Bebas'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <Button size="sm" variant="outline-warning"
                                                            onClick={() => { setSelectedMedicine(medicine); setShowMedicineModal(true); }}>
                                                            <FaEdit style={{ marginRight: 4 }} /> Edit
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ APPOINTMENTS TAB ═══════════════════════════════════════ */}
                        {activeTab === 'appointments' && (
                            <div>
                                <h5 style={{ fontWeight: 600, marginBottom: 24 }}>Semua Janji Temu</h5>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>No. Antrian</th><th>Pasien</th><th>Dokter</th>
                                                <th>Tanggal & Waktu</th><th>Keluhan</th>
                                                <th>Status</th><th>Pembayaran</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appointments.map(apt => (
                                                <tr key={apt._id}>
                                                    <td><span className="badge-status badge-info">#{apt.queueNumber}</span></td>
                                                    <td><span style={{ fontWeight: 500 }}>{apt.userId?.name}</span></td>
                                                    <td>dr. {apt.doctorId?.name}</td>
                                                    <td>
                                                        {new Date(apt.appointmentDate).toLocaleDateString('id-ID')}
                                                        <br />
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>{apt.appointmentTime}</span>
                                                    </td>
                                                    <td style={{ maxWidth: 150 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {apt.complaint}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-status ${
                                                            apt.status === 'confirmed' ? 'badge-success' :
                                                            apt.status === 'pending' ? 'badge-warning' :
                                                            apt.status === 'completed' ? 'badge-info' : 'badge-danger'
                                                        }`}>
                                                            {apt.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-status ${apt.paymentId?.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                            {apt.paymentId?.status === 'paid' ? 'Lunas' : 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ TRANSACTIONS TAB ═══════════════════════════════════════ */}
                        {activeTab === 'transactions' && (
                            <div>
                                <h5 style={{ fontWeight: 600, marginBottom: 24 }}>Riwayat Transaksi</h5>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>ID Transaksi</th><th>User</th><th>Tipe</th>
                                                <th>Jumlah</th><th>Status</th><th>Tanggal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map(trx => (
                                                <tr key={trx._id}>
                                                    <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>{trx.transactionId}</code></td>
                                                    <td><span style={{ fontWeight: 500 }}>{trx.userId?.name}</span></td>
                                                    <td>
                                                        <span className="badge-status badge-info">
                                                            {trx.paymentType?.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{formatCurrency(trx.amount)}</td>
                                                    <td>
                                                        <span className={`badge-status ${
                                                            trx.status === 'paid' ? 'badge-success' :
                                                            trx.status === 'verified' ? 'badge-info' : 'badge-warning'
                                                        }`}>
                                                            {trx.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {new Date(trx.createdAt).toLocaleDateString('id-ID')}
                                                        <br />
                                                        <span style={{ fontSize: 12, color: '#64748b' }}>
                                                            {new Date(trx.createdAt).toLocaleTimeString('id-ID')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ USERS TAB ══════════════════════════════════════════════ */}
                        {activeTab === 'users' && (
                            <div>
                                <h5 style={{ fontWeight: 600, marginBottom: 24 }}>Data Pengguna</h5>
                                <div className="table-custom">
                                    <Table responsive style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Nama</th><th>Email</th><th>No. Telepon</th>
                                                <th>Role</th><th>Tanggal Daftar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u._id}>
                                                    <td><span style={{ fontWeight: 500 }}>{u.name}</span></td>
                                                    <td>{u.email}</td>
                                                    <td>{u.phone || '-'}</td>
                                                    <td>
                                                        <span className={`badge-status ${
                                                            u.role === 'admin' ? 'badge-danger' : 
                                                            u.role === 'doctor' ? 'badge-success' : 'badge-info'
                                                        }`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* ══ PENGATURAN KLINIK TAB ══════════════════════════════ */}
                        {activeTab === 'clinicSettings' && (
                            <ClinicSettingsTab />
                        )}

                    </Col>
                </Row>
            </Container>

            {/* ══ MODAL: Tambah/Edit Dokter ════════════════════════════════════════ */}
            <Modal show={showDoctorModal} onHide={() => setShowDoctorModal(false)} size="lg" centered>
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                    <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
                        {selectedDoctor ? 'Edit Dokter' : 'Tambah Dokter Baru'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px' }}>
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
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Nama Lengkap</Form.Label>
                                    <Form.Control type="text" name="name" defaultValue={selectedDoctor?.name} required 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Spesialisasi</Form.Label>
                                    <Form.Select name="specialization" defaultValue={selectedDoctor?.specialization} required
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }}>
                                        <option value="">Pilih Spesialisasi</option>
                                        {['Umum','Anak','Penyakit Dalam','Jantung','Kandungan','Gigi','THT','Mata','Kulit'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        {!selectedDoctor && (
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Email Akun Dokter</Form.Label>
                                        <Form.Control type="email" name="email" required 
                                            style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Password</Form.Label>
                                        <Form.Control type="password" name="password" required 
                                            style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                    </Form.Group>
                                </Col>
                            </Row>
                        )}
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Biaya Konsultasi</Form.Label>
                                    <Form.Control type="number" name="consultationFee" defaultValue={selectedDoctor?.consultationFee} required 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Pengalaman (tahun)</Form.Label>
                                    <Form.Control type="number" name="experience" defaultValue={selectedDoctor?.experience} required 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>No. Telepon</Form.Label>
                                    <Form.Control type="text" name="phone" defaultValue={selectedDoctor?.userId?.phone} 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Kualifikasi Pendidikan</Form.Label>
                            <Form.Control type="text" name="qualification" defaultValue={selectedDoctor?.qualification} 
                                style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Biodata</Form.Label>
                            <Form.Control as="textarea" rows={3} name="bio" defaultValue={selectedDoctor?.bio} 
                                style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                        </Form.Group>
                        <Button type="submit" variant="primary" className="w-100" 
                            style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '10px' }}>
                            {selectedDoctor ? 'Update' : 'Simpan'} Dokter
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Atur Jadwal ═══════════════════════════════════════════════ */}
            <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} size="lg" centered>
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                    <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
                        Jadwal Praktek — dr. {selectedDoctor?.name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px' }}>
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
                        <Table bordered style={{ borderColor: '#e2e8f0' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th>Hari</th>
                                    <th>Praktek?</th>
                                    <th>Jam Mulai</th>
                                    <th>Jam Selesai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                                    const d = selectedDoctor?.availableDays?.find(x => x.day === day);
                                    return (
                                        <tr key={day}>
                                            <td style={{ verticalAlign: 'middle' }}>{day}</td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <Form.Check type="checkbox" name={`${day}_available`} defaultChecked={!!d} />
                                            </td>
                                            <td>
                                                <Form.Control type="time" name={`${day}_start`} defaultValue={d?.slots[0]?.startTime || '08:00'} 
                                                    style={{ borderRadius: 6, borderColor: '#e2e8f0' }} />
                                            </td>
                                            <td>
                                                <Form.Control type="time" name={`${day}_end`} defaultValue={d?.slots[0]?.endTime || '16:00'} 
                                                    style={{ borderRadius: 6, borderColor: '#e2e8f0' }} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                        <Button type="submit" variant="primary" className="w-100" 
                            style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '10px' }}>
                            Simpan Jadwal
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Tambah/Edit Obat ══════════════════════════════════════════ */}
            <Modal show={showMedicineModal} onHide={() => setShowMedicineModal(false)} centered>
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                    <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
                        {selectedMedicine ? 'Edit Obat' : 'Tambah Obat Baru'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px' }}>
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
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Nama Obat</Form.Label>
                                    <Form.Control type="text" name="name" defaultValue={selectedMedicine?.name} required 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Nama Generik</Form.Label>
                                    <Form.Control type="text" name="genericName" defaultValue={selectedMedicine?.genericName} 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Kategori</Form.Label>
                                    <Form.Select name="category" defaultValue={selectedMedicine?.category} required
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }}>
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
                                    <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Harga</Form.Label>
                                    <Form.Control type="number" name="price" defaultValue={selectedMedicine?.price} required 
                                        style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Stok</Form.Label>
                            <Form.Control type="number" name="stock" defaultValue={selectedMedicine?.stock} required 
                                style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ fontSize: 13, fontWeight: 500 }}>Deskripsi</Form.Label>
                            <Form.Control as="textarea" rows={3} name="description" defaultValue={selectedMedicine?.description} 
                                style={{ borderRadius: 8, borderColor: '#e2e8f0' }} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check 
                                type="checkbox" 
                                name="prescription" 
                                label="Memerlukan Resep Dokter"
                                defaultChecked={selectedMedicine?.prescription} 
                                style={{ fontSize: 13 }}
                            />
                        </Form.Group>
                        <Button type="submit" variant="primary" className="w-100" 
                            style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '10px' }}>
                            {selectedMedicine ? 'Update Obat' : 'Simpan Obat'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* ══ MODAL: Detail Pembayaran ════════════════════════════════════════ */}
            <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} size="lg" centered>
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                    <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
                        Detail Pembayaran
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px' }}>
                    {selectedPayment && (
                        <>
                            <Row className="mb-3">
                                <Col md={6}>
                                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16 }}>
                                        <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>
                                            Informasi Transaksi
                                        </h6>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>ID: </span>
                                            <span style={{ fontWeight: 500 }}>{selectedPayment.transactionId}</span>
                                        </div>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Tanggal: </span>
                                            <span>{formatDate(selectedPayment.createdAt)}</span>
                                        </div>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Layanan: </span>
                                            <span>{selectedPayment.paymentType}</span>
                                        </div>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Jumlah: </span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(selectedPayment.amount)}</span>
                                        </div>
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>Metode: </span>
                                            <span>{selectedPayment.bankName}</span>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16 }}>
                                        <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>
                                            Informasi User
                                        </h6>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Nama: </span>
                                            <span style={{ fontWeight: 500 }}>{selectedPayment.userId?.name}</span>
                                        </div>
                                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                                            <span style={{ color: '#64748b' }}>Email: </span>
                                            <span>{selectedPayment.userId?.email}</span>
                                        </div>
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ color: '#64748b' }}>Telepon: </span>
                                            <span>{selectedPayment.userId?.phone || '-'}</span>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                            {selectedPayment.paymentType === 'consultation' && selectedPayment.referenceId && (
                                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                    <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>
                                        Detail Konsultasi
                                    </h6>
                                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                                        <span style={{ color: '#64748b' }}>Dokter: </span>
                                        <span style={{ fontWeight: 500 }}>dr. {selectedPayment.referenceId?.doctorId?.name}</span>
                                    </div>
                                    <div style={{ fontSize: 13 }}>
                                        <span style={{ color: '#64748b' }}>Keluhan: </span>
                                        <span>{selectedPayment.referenceId?.symptoms}</span>
                                    </div>
                                </div>
                            )}

                            <h6 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#475569' }}>
                                Bukti Transfer
                            </h6>
                            {selectedPayment.transferProof ? (
                                <div style={{ textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#f8fafc' }}>
                                    <img
                                        src={`${API_URL}${selectedPayment.transferProof}`}
                                        alt="Bukti Transfer"
                                        style={{ maxHeight: '300px', maxWidth: '100%', borderRadius: 4 }}
                                    />
                                    <div style={{ marginTop: 12 }}>
                                        <Button variant="outline-primary" size="sm"
                                            href={`${API_URL}${selectedPayment.transferProof}`}
                                            target="_blank"
                                            style={{ borderColor: '#e2e8f0', color: '#475569' }}>
                                            <FaDownload style={{ marginRight: 4 }} /> Download Bukti
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Alert variant="warning" style={{ fontSize: 13, borderRadius: 8 }}>
                                    Belum ada bukti transfer yang diupload
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
                    <Button variant="outline-secondary" onClick={() => setShowPaymentModal(false)}
                        style={{ borderColor: '#e2e8f0', color: '#475569', borderRadius: 8 }}>
                        Tutup
                    </Button>
                    <Button variant="danger" onClick={() => { setShowPaymentModal(false); setShowRejectModal(true); }}
                        style={{ background: '#b91c1c', border: 'none', borderRadius: 8 }}>
                        Tolak
                    </Button>
                    <Button variant="success" onClick={() => verifyPayment(selectedPayment?._id, 'verified')}
                        style={{ background: '#16a34a', border: 'none', borderRadius: 8 }}>
                        Verifikasi
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ══ MODAL: Alasan Penolakan ══════════════════════════════════════════ */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '20px' }}>
                    <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
                        Alasan Penolakan
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px' }}>
                    <Form.Group>
                        <Form.Label style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                            Catatan untuk user
                        </Form.Label>
                        <Form.Control
                            as="textarea" rows={3}
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Contoh: Bukti tidak jelas, jumlah tidak sesuai, dll"
                            style={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
                    <Button variant="outline-secondary" onClick={() => setShowRejectModal(false)}
                        style={{ borderColor: '#e2e8f0', color: '#475569', borderRadius: 8 }}>
                        Batal
                    </Button>
                    <Button variant="danger" onClick={() => verifyPayment(selectedPayment?._id, 'rejected')}
                        style={{ background: '#b91c1c', border: 'none', borderRadius: 8 }}>
                        Tolak Pembayaran
                    </Button>
                </Modal.Footer>
            </Modal>

        </div>
    );
};

export default AdminDashboard;