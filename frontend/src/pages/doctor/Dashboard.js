import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
    FaUserMd, FaCalendarAlt, FaClock, FaUsers,
    FaFileMedical, FaArrowRight, FaCheckCircle,
    FaHourglassHalf, FaStethoscope, FaClipboardList,
    FaComment, FaExclamationTriangle, FaSync
} from 'react-icons/fa';

const DoctorDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const [stats, setStats] = useState({ todayAppointments: 0, pendingAppointments: 0, totalPatients: 0, ongoingConsultations: 0 });
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [pendingConsultations, setPendingConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // ✅ FIX: default null (belum dicek), bukan false
    const [noProfile, setNoProfile] = useState(null);

    useEffect(() => {
        if (authLoading) return;
        if (user && user.role === 'doctor') {
            fetchDoctorData();
        }
    }, [authLoading, user]);

    const fetchDoctorData = async () => {
        setLoading(true);
        setError(null);
        setNoProfile(null); // reset tiap fetch

        try {
            // ✅ FIX UTAMA: panggil endpoint yang kini sudah ada di backend
            // Sebelumnya endpoint ini tidak ada → selalu 404 → noProfile = true
            await api.get('/api/doctors/my/profile');
            
            // Profil ada, lanjut ambil data dashboard
            setNoProfile(false);

            const [apptRes, consRes] = await Promise.allSettled([
                api.get('/api/appointments/doctor/stats'),
                api.get('/api/consultations/doctor/pending')
            ]);

            if (apptRes.status === 'fulfilled') {
                const d = apptRes.value.data;
                setStats(prev => ({
                    ...prev,
                    todayAppointments: d.stats?.todayAppointments ?? 0,
                    pendingAppointments: d.stats?.pendingAppointments ?? 0,
                    totalPatients: d.stats?.totalPatients ?? 0
                }));
                setTodaySchedule(d.todaySchedule || []);
            }

            if (consRes.status === 'fulfilled') {
                const consultations = consRes.value.data?.consultations || [];
                const ongoing = consultations.filter(c => c.status === 'ongoing').length;
                setStats(prev => ({ ...prev, ongoingConsultations: ongoing }));
                setPendingConsultations(consultations.slice(0, 5));
            }

            if (apptRes.status === 'rejected' && consRes.status === 'rejected') {
                setError('Gagal memuat data dashboard. Pastikan server berjalan.');
            }
        } catch (err) {
            // ✅ FIX: 404 dari /my/profile berarti profil dokter belum dibuat admin
            if (err.response?.status === 404) {
                setNoProfile(true);
            } else {
                console.error('Dashboard error:', err);
                setError('Gagal memuat data dashboard');
                setNoProfile(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { icon: <FaCalendarAlt />, title: 'Jadwal Praktek', color: 'primary', link: '/doctor/appointments', badge: stats.pendingAppointments },
        { icon: <FaFileMedical />, title: 'Surat Sakit', color: 'warning', link: '/doctor/sick-letters' },
        { icon: <FaComment />, title: 'Konsultasi', color: 'success', link: '/doctor/consultations', badge: stats.ongoingConsultations },
        { icon: <FaUsers />, title: 'Pasien Saya', color: 'info', link: '/doctor/patients' }
    ];

    const getApptBadge = (status) => {
        const map = {
            pending: ['warning', 'Menunggu'],
            confirmed: ['success', 'Dikonfirmasi'],
            completed: ['primary', 'Selesai'],
            cancelled: ['danger', 'Batal']
        };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg} className="small">{label}</Badge>;
    };

    const getConsBadge = (status) => {
        const map = {
            paid:            ['info',      'Menunggu Mulai'],
            scheduled:       ['primary',   'Terjadwal'],
            ongoing:         ['success',   'Berlangsung'],
            completed:       ['secondary', 'Selesai'],
            cancelled:       ['danger',    'Dibatalkan'],
            pending_payment: ['warning',   'Menunggu Bayar'],
            expired:         ['secondary', 'Kadaluarsa'],
            no_show:         ['warning',   'Tidak Hadir'],
        };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg} className="small">{label}</Badge>;
    };

    // ✅ Tampilkan loading dulu sebelum tahu status profil
    if (authLoading || loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">{authLoading ? 'Memeriksa akses...' : 'Memuat dashboard...'}</p>
        </Container>
    );

    // ✅ Tampilkan pesan HANYA jika sudah pasti noProfile = true
    if (noProfile === true) return (
        <Container className="py-5">
            <Alert variant="warning" className="text-center">
                <FaExclamationTriangle size={40} className="mb-3 d-block mx-auto" />
                <h5>Profil Dokter Belum Terdaftar</h5>
                <p className="mb-3">
                    Akun Anda terdaftar sebagai <strong>dokter</strong>, tetapi profil dokter belum dibuat oleh admin.
                    Hubungi administrator untuk membuat profil dokter dan menghubungkan akun Anda.
                </p>
                <p className="text-muted small">
                    Admin dapat melakukan ini melalui menu <strong>Kelola Dokter → Tambah Dokter</strong> dengan email akun Anda
                </p>
                <Button variant="outline-warning" size="sm" onClick={fetchDoctorData} className="mt-2">
                    <FaSync className="me-1" /> Cek Ulang
                </Button>
            </Alert>
        </Container>
    );

    return (
        <Container fluid className="py-4 px-4">
            {/* Header */}
            <Row className="mb-4 align-items-center">
                <Col>
                    <div className="d-flex align-items-center gap-3">
                        <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white"
                            style={{ width: 52, height: 52, fontSize: 22 }}>
                            <FaUserMd />
                        </div>
                        <div>
                            <h5 className="fw-bold mb-0">Selamat datang, dr. {user?.name}</h5>
                            <p className="text-muted mb-0 small">Dashboard Dokter</p>
                        </div>
                    </div>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchDoctorData}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            {error && (
                <Alert variant="danger" className="d-flex align-items-center gap-2">
                    <FaExclamationTriangle />
                    <span>{error}</span>
                    <Button variant="link" size="sm" className="ms-auto p-0" onClick={fetchDoctorData}>Coba lagi</Button>
                </Alert>
            )}

            {/* Stats Cards */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Janji Hari Ini', value: stats.todayAppointments, icon: <FaCalendarAlt />, bg: 'primary' },
                    { label: 'Menunggu Konfirmasi', value: stats.pendingAppointments, icon: <FaHourglassHalf />, bg: 'warning' },
                    { label: 'Total Pasien', value: stats.totalPatients, icon: <FaUsers />, bg: 'success' },
                    { label: 'Konsultasi Aktif', value: stats.ongoingConsultations, icon: <FaComment />, bg: 'info' },
                ].map((s, i) => (
                    <Col md={3} xs={6} key={i}>
                        <Card className={`border-0 shadow-sm bg-${s.bg} text-white`}>
                            <Card.Body className="d-flex align-items-center justify-content-between py-3 px-3">
                                <div>
                                    <div className="small opacity-75">{s.label}</div>
                                    <h3 className="fw-bold mb-0">{s.value}</h3>
                                </div>
                                <div className="opacity-25 fs-2">{s.icon}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row className="g-4">
                {/* Quick Actions */}
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 fw-bold pt-3">
                            <FaClipboardList className="me-2 text-primary" />Menu Cepat
                        </Card.Header>
                        <Card.Body className="pt-2">
                            <Row className="g-2">
                                {quickActions.map((action, i) => (
                                    <Col xs={6} key={i}>
                                        <Button
                                            as={Link}
                                            to={action.link}
                                            variant={`outline-${action.color}`}
                                            className="w-100 py-3 position-relative"
                                            style={{ borderRadius: 10 }}>
                                            <div className="fs-4 mb-1">{action.icon}</div>
                                            <div className="small">{action.title}</div>
                                            {action.badge > 0 && (
                                                <Badge bg="danger" pill
                                                    className="position-absolute top-0 end-0 m-1">
                                                    {action.badge}
                                                </Badge>
                                            )}
                                        </Button>
                                    </Col>
                                ))}
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Jadwal Hari Ini */}
                <Col md={8}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center pt-3">
                            <span className="fw-bold">
                                <FaCalendarAlt className="me-2 text-primary" />Jadwal Hari Ini
                            </span>
                            <Button as={Link} to="/doctor/appointments" variant="link" size="sm" className="p-0 text-decoration-none">
                                Lihat Semua <FaArrowRight />
                            </Button>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {todaySchedule.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <FaCalendarAlt size={36} className="mb-2 opacity-25" />
                                    <p className="mb-0 small">Tidak ada janji temu hari ini</p>
                                </div>
                            ) : (
                                <ListGroup variant="flush">
                                    {todaySchedule.map((apt, i) => (
                                        <ListGroup.Item key={apt._id} className="px-3 py-2">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center text-primary"
                                                        style={{ width: 36, height: 36, fontSize: 14 }}>
                                                        {i + 1}
                                                    </div>
                                                    <div>
                                                        <div className="fw-semibold small">{apt.userId?.name}</div>
                                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                            <FaClock className="me-1" />{apt.appointmentTime} · {apt.userId?.phone}
                                                        </div>
                                                    </div>
                                                </div>
                                                {getApptBadge(apt.status)}
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                {/* Konsultasi Perlu Tindakan */}
                {pendingConsultations.length > 0 && (
                    <Col md={12}>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center pt-3">
                                <span className="fw-bold">
                                    <FaStethoscope className="me-2 text-success" />Konsultasi Perlu Tindakan
                                </span>
                                <Button as={Link} to="/doctor/consultations" variant="link" size="sm" className="p-0 text-decoration-none">
                                    Lihat Semua <FaArrowRight />
                                </Button>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <ListGroup variant="flush">
                                    {pendingConsultations.map(c => (
                                        <ListGroup.Item key={c._id} className="px-3 py-2">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="fw-semibold small">{c.userId?.name}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                        {c.symptoms?.slice(0, 60)}{c.symptoms?.length > 60 ? '...' : ''}
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    {getConsBadge(c.status)}
                                                    {c.status === 'ongoing' && (
                                                        <Button as={Link} to={`/consultations/${c._id}`}
                                                            variant="success" size="sm">
                                                            Chat
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            </Card.Body>
                        </Card>
                    </Col>
                )}
            </Row>
        </Container>
    );
};

export default DoctorDashboard;
