import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
    Container, Row, Col, Card, Table, Badge, 
    Button, Modal, Form, Alert, Spinner, Tabs, Tab 
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
    FaCalendarAlt, FaUser, FaClock, FaCheckCircle,
    FaTimesCircle, FaHourglassHalf, FaInfoCircle,
    FaStethoscope, FaSync, FaUserCheck
} from 'react-icons/fa';

const DoctorAppointments = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [stats, setStats] = useState({ pending: 0, confirmed: 0, checked_in: 0, completed: 0, rejected: 0 });
    const [processing, setProcessing] = useState(false);

    // ✅ FIX: tunggu auth loading selesai dulu sebelum cek role
    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'doctor') {
            toast.error('Akses ditolak');
            navigate('/');
            return;
        }
        fetchAppointments();
    }, [authLoading, user, selectedDate]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedDate) params.append('date', selectedDate);
            
            const response = await api.get(`/api/appointments/doctor/appointments?${params.toString()}`);
            const allAppointments = response.data.appointments || response.data || [];
            setAppointments(allAppointments);
            
            setStats({
                pending:    allAppointments.filter(a => a.status === 'pending').length,
                confirmed:  allAppointments.filter(a => a.status === 'confirmed').length,
                checked_in: allAppointments.filter(a => a.status === 'checked_in').length,
                completed:  allAppointments.filter(a => a.status === 'completed').length,
                rejected:   allAppointments.filter(a => a.status === 'rejected').length,
            });
        } catch (error) {
            console.error('Fetch appointments error:', error);
            toast.error('Gagal memuat data janji temu');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        setProcessing(true);
        try {
            await api.put(`/api/appointments/doctor/${id}/approve`);
            toast.success('Janji temu disetujui');
            fetchAppointments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyetujui janji');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) { toast.error('Isi alasan penolakan'); return; }
        setProcessing(true);
        try {
            await api.put(`/api/appointments/doctor/${selectedAppointment._id}/reject`, { reason: rejectReason });
            toast.success('Janji temu ditolak');
            setShowRejectModal(false);
            setRejectReason('');
            fetchAppointments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menolak janji');
        } finally {
            setProcessing(false);
        }
    };

    const handleCheckIn = async (id) => {
        if (!window.confirm('Konfirmasi pasien sudah hadir (check-in)?')) return;
        setProcessing(true);
        try {
            await api.put(`/api/appointments/doctor/${id}/check-in`);
            toast.success('Pasien berhasil di-check-in');
            fetchAppointments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal melakukan check-in');
        } finally {
            setProcessing(false);
        }
    };

    const handleComplete = async (id) => {
        if (!window.confirm('Tandai janji temu ini sebagai selesai?')) return;
        setProcessing(true);
        try {
            await api.put(`/api/appointments/doctor/${id}/complete`);
            toast.success('Janji temu diselesaikan');
            fetchAppointments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyelesaikan janji');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending:    { bg: 'warning',   text: 'Menunggu'   },
            confirmed:  { bg: 'success',   text: 'Disetujui'  },
            checked_in: { bg: 'primary',   text: 'Hadir ✓'   },
            rejected:   { bg: 'danger',    text: 'Ditolak'    },
            completed:  { bg: 'info',      text: 'Selesai'    },
            cancelled:  { bg: 'secondary', text: 'Dibatalkan' },
        };
        const v = variants[status] || { bg: 'secondary', text: status };
        return <Badge bg={v.bg}>{v.text}</Badge>;
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const filteredAppointments = appointments.filter(a => {
        if (activeTab === 'all') return true;
        return a.status === activeTab;
    });

    // Tampilkan spinner saat auth masih loading
    if (authLoading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memeriksa akses...</p>
        </Container>
    );

    return (
        <Container fluid className="py-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <h4 className="fw-bold mb-0">
                        <FaStethoscope className="me-2 text-primary" />
                        Janji Temu Saya
                    </h4>
                    <p className="text-muted small mb-0">Kelola jadwal janji temu pasien</p>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchAppointments} disabled={loading}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Menunggu',  value: stats.pending,    bg: 'warning', tab: 'pending',    icon: FaHourglassHalf },
                    { label: 'Disetujui', value: stats.confirmed,  bg: 'success', tab: 'confirmed',  icon: FaCheckCircle   },
                    { label: 'Hadir',     value: stats.checked_in, bg: 'primary', tab: 'checked_in', icon: FaUserCheck     },
                    { label: 'Selesai',   value: stats.completed,  bg: 'info',    tab: 'completed',  icon: FaCalendarAlt   },
                    { label: 'Ditolak',   value: stats.rejected,   bg: 'danger',  tab: 'rejected',   icon: FaTimesCircle   },
                ].map((s, i) => (
                    <Col key={i}>
                        <Card
                            className={`bg-${s.bg} text-white border-0 shadow-sm`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setActiveTab(s.tab)}
                        >
                            <Card.Body className="py-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="small opacity-75">{s.label}</div>
                                        <h3 className="fw-bold mb-0">{s.value}</h3>
                                    </div>
                                    <s.icon size={30} className="opacity-25" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Filter */}
            <Row className="mb-3 g-2 align-items-end">
                <Col md={3}>
                    <Form.Label className="small fw-semibold">Filter Tanggal</Form.Label>
                    <Form.Control type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </Col>
                <Col xs="auto">
                    <Button variant="outline-secondary" size="sm" onClick={() => setSelectedDate('')}>Reset</Button>
                </Col>
            </Row>

            {/* Tabs + Table */}
            <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-0 pt-3 pb-0">
                    <Tabs activeKey={activeTab} onSelect={k => setActiveTab(k)} className="mb-0 border-0">
                        <Tab eventKey="pending"    title={`Menunggu (${stats.pending})`} />
                        <Tab eventKey="confirmed"  title={`Disetujui (${stats.confirmed})`} />
                        <Tab eventKey="checked_in" title={`Hadir (${stats.checked_in})`} />
                        <Tab eventKey="completed"  title={`Selesai (${stats.completed})`} />
                        <Tab eventKey="rejected"   title={`Ditolak (${stats.rejected})`} />
                        <Tab eventKey="all"        title={`Semua (${appointments.length})`} />
                    </Tabs>
                </Card.Header>
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted">Memuat janji temu...</p>
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaCalendarAlt size={48} className="text-muted mb-3 opacity-25" />
                            <h6 className="text-muted">Tidak ada janji temu</h6>
                            <p className="text-muted small">{selectedDate ? 'Tidak ada janji pada tanggal ini' : 'Belum ada data'}</p>
                        </div>
                    ) : (
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>No.</th>
                                    <th>Pasien</th>
                                    <th>Tanggal</th>
                                    <th>Waktu</th>
                                    <th>Keluhan</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAppointments.map(apt => (
                                    <tr key={apt._id}>
                                        <td><Badge bg="primary">#{apt.queueNumber || '-'}</Badge></td>
                                        <td>
                                            <div className="fw-semibold">{apt.userId?.name}</div>
                                            <div className="text-muted small">{apt.userId?.phone}</div>
                                        </td>
                                        <td className="small">{formatDate(apt.appointmentDate)}</td>
                                        <td className="small">
                                            <FaClock className="me-1 text-muted" size={11} />
                                            {apt.appointmentTime}
                                        </td>
                                        <td className="small text-muted" style={{ maxWidth: 150 }}>
                                            {apt.complaint?.length > 45 ? apt.complaint.slice(0, 45) + '...' : apt.complaint}
                                        </td>
                                        <td>{getStatusBadge(apt.status)}</td>
                                        <td>
                                            <div className="d-flex gap-1 flex-wrap">
                                                <Button variant="outline-secondary" size="sm"
                                                    onClick={() => { setSelectedAppointment(apt); setShowDetailModal(true); }}>
                                                    <FaInfoCircle />
                                                </Button>
                                                {apt.status === 'pending' && (
                                                    <>
                                                        <Button variant="success" size="sm" disabled={processing}
                                                            onClick={() => handleApprove(apt._id)}>
                                                            <FaCheckCircle />
                                                        </Button>
                                                        <Button variant="danger" size="sm"
                                                            onClick={() => { setSelectedAppointment(apt); setShowRejectModal(true); }}>
                                                            <FaTimesCircle />
                                                        </Button>
                                                    </>
                                                )}
                                                {apt.status === 'confirmed' && (
                                                    <Button variant="primary" size="sm" disabled={processing}
                                                        onClick={() => handleCheckIn(apt._id)}
                                                        title="Pasien sudah hadir">
                                                        <FaUserCheck />
                                                    </Button>
                                                )}
                                                {apt.status === 'checked_in' && (
                                                    <Button variant="info" size="sm" disabled={processing}
                                                        onClick={() => handleComplete(apt._id)}>
                                                        Selesai
                                                    </Button>
                                                )}
                                                {apt.status === 'rejected' && apt.rejectionReason && (
                                                    <Button variant="outline-secondary" size="sm"
                                                        onClick={() => { setSelectedAppointment(apt); setShowDetailModal(true); }}>
                                                        <FaInfoCircle />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Detail Modal */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaCalendarAlt className="me-2 text-primary" />Detail Janji Temu</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedAppointment && (
                        <Table borderless size="sm">
                            <tbody>
                                <tr><td className="text-muted fw-semibold" style={{ width: '40%' }}>Pasien</td><td>{selectedAppointment.userId?.name}</td></tr>
                                <tr><td className="text-muted fw-semibold">Telepon</td><td>{selectedAppointment.userId?.phone || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Email</td><td>{selectedAppointment.userId?.email || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Tanggal</td><td>{formatDate(selectedAppointment.appointmentDate)}</td></tr>
                                <tr><td className="text-muted fw-semibold">Waktu</td><td>{selectedAppointment.appointmentTime}</td></tr>
                                <tr><td className="text-muted fw-semibold">Keluhan</td><td>{selectedAppointment.complaint}</td></tr>
                                <tr><td className="text-muted fw-semibold">Status</td><td>{getStatusBadge(selectedAppointment.status)}</td></tr>
                                {selectedAppointment.rejectionReason && (
                                    <tr><td className="text-muted fw-semibold">Alasan Tolak</td>
                                        <td className="text-danger">{selectedAppointment.rejectionReason}</td>
                                    </tr>
                                )}
                                {selectedAppointment.doctorNotes && (
                                    <tr><td className="text-muted fw-semibold">Catatan</td><td>{selectedAppointment.doctorNotes}</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                    {selectedAppointment?.status === 'pending' && (
                        <>
                            <Button variant="success" disabled={processing}
                                onClick={() => { handleApprove(selectedAppointment._id); setShowDetailModal(false); }}>
                                <FaCheckCircle className="me-1" /> Setujui
                            </Button>
                            <Button variant="danger"
                                onClick={() => { setShowDetailModal(false); setShowRejectModal(true); }}>
                                <FaTimesCircle className="me-1" /> Tolak
                            </Button>
                        </>
                    )}
                    {selectedAppointment?.status === 'confirmed' && (
                        <Button variant="primary" disabled={processing}
                            onClick={() => { handleCheckIn(selectedAppointment._id); setShowDetailModal(false); }}>
                            <FaUserCheck className="me-1" /> Check-in Pasien
                        </Button>
                    )}
                    {selectedAppointment?.status === 'checked_in' && (
                        <Button variant="info" disabled={processing}
                            onClick={() => { handleComplete(selectedAppointment._id); setShowDetailModal(false); }}>
                            Tandai Selesai
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Reject Modal */}
            <Modal show={showRejectModal} onHide={() => { setShowRejectModal(false); setRejectReason(''); }}>
                <Modal.Header closeButton>
                    <Modal.Title><FaTimesCircle className="me-2 text-danger" />Tolak Janji Temu</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="mb-2">Pasien: <strong>{selectedAppointment?.userId?.name}</strong></p>
                    <Form.Group>
                        <Form.Label>Alasan Penolakan <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            as="textarea" rows={3}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Contoh: Jadwal penuh, dokter tidak praktek, dll."
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Batal</Button>
                    <Button variant="danger" disabled={processing} onClick={handleReject}>
                        {processing ? 'Memproses...' : 'Tolak Janji'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DoctorAppointments;
