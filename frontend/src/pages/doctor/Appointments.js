import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Table, Badge, 
    Button, Modal, Form, Alert, Spinner, Tabs, Tab 
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaCalendarAlt, FaUser, FaClock, FaCheckCircle,
    FaTimesCircle, FaHourglassHalf, FaInfoCircle,
    FaStethoscope, FaFilter
} from 'react-icons/fa';

const DoctorAppointments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        completed: 0,
        rejected: 0
    });

    useEffect(() => {
        if (!user || user.role !== 'doctor') {
            toast.error('Akses ditolak');
            navigate('/');
            return;
        }
        fetchAppointments();
    }, [selectedDate]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            let url = 'http://localhost:5000/api/appointments/doctor/appointments';
            const params = new URLSearchParams();
            if (selectedDate) params.append('date', selectedDate);
            
            const response = await axios.get(
                `${url}?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const allAppointments = response.data.appointments || [];
            setAppointments(allAppointments);
            
            // Hitung statistik
            setStats({
                pending: allAppointments.filter(a => a.status === 'pending').length,
                confirmed: allAppointments.filter(a => a.status === 'confirmed').length,
                completed: allAppointments.filter(a => a.status === 'completed').length,
                rejected: allAppointments.filter(a => a.status === 'rejected').length
            });
            
        } catch (error) {
            toast.error('Gagal memuat data janji temu');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/appointments/doctor/${id}/approve`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Janji temu disetujui');
            fetchAppointments();
        } catch (error) {
            toast.error('Gagal menyetujui janji');
        }
    };

    const handleReject = async () => {
        if (!rejectReason) {
            toast.error('Isi alasan penolakan');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/appointments/doctor/${selectedAppointment._id}/reject`,
                { reason: rejectReason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Janji temu ditolak');
            setShowRejectModal(false);
            setRejectReason('');
            fetchAppointments();
        } catch (error) {
            toast.error('Gagal menolak janji');
        }
    };

    const handleComplete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/appointments/doctor/${id}/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Janji temu selesai');
            fetchAppointments();
        } catch (error) {
            toast.error('Gagal menyelesaikan janji');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: { bg: 'warning', icon: FaHourglassHalf, text: 'Menunggu' },
            confirmed: { bg: 'success', icon: FaCheckCircle, text: 'Disetujui' },
            rejected: { bg: 'danger', icon: FaTimesCircle, text: 'Ditolak' },
            completed: { bg: 'info', icon: FaCheckCircle, text: 'Selesai' },
            cancelled: { bg: 'secondary', icon: FaTimesCircle, text: 'Dibatalkan' }
        };
        const v = variants[status] || variants.pending;
        return (
            <Badge bg={v.bg} className="d-flex align-items-center gap-1">
                <v.icon size={12} />
                <span>{v.text}</span>
            </Badge>
        );
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const filteredAppointments = appointments.filter(a => {
        if (activeTab === 'pending') return a.status === 'pending';
        if (activeTab === 'confirmed') return a.status === 'confirmed';
        if (activeTab === 'completed') return a.status === 'completed';
        if (activeTab === 'rejected') return a.status === 'rejected';
        return true;
    });

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <h2 className="text-center">
                        <FaStethoscope className="me-2 text-primary" />
                        Panel Dokter - Janji Temu
                    </h2>
                </Col>
            </Row>

            {/* Stats Cards */}
            <Row className="mb-4 g-4">
                <Col md={3}>
                    <Card className="bg-warning text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Menunggu</h6>
                                    <h2 className="mb-0">{stats.pending}</h2>
                                </div>
                                <FaHourglassHalf size={40} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-success text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Disetujui</h6>
                                    <h2 className="mb-0">{stats.confirmed}</h2>
                                </div>
                                <FaCheckCircle size={40} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-info text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Selesai</h6>
                                    <h2 className="mb-0">{stats.completed}</h2>
                                </div>
                                <FaCheckCircle size={40} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-danger text-white">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-white-50 mb-2">Ditolak</h6>
                                    <h2 className="mb-0">{stats.rejected}</h2>
                                </div>
                                <FaTimesCircle size={40} />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filter by Date */}
            <Row className="mb-4">
                <Col md={4}>
                    <Form.Group>
                        <Form.Label>Filter Tanggal</Form.Label>
                        <Form.Control
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                    <Button variant="outline-secondary" onClick={() => setSelectedDate('')}>
                        Reset
                    </Button>
                </Col>
            </Row>

            {/* Tabs */}
            <Card className="shadow-sm border-0 mb-4">
                <Card.Header className="bg-white">
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => setActiveTab(k)}
                        className="mb-0 border-0"
                    >
                        <Tab eventKey="pending" title={`Menunggu (${stats.pending})`} />
                        <Tab eventKey="confirmed" title={`Disetujui (${stats.confirmed})`} />
                        <Tab eventKey="completed" title={`Selesai (${stats.completed})`} />
                        <Tab eventKey="rejected" title={`Ditolak (${stats.rejected})`} />
                    </Tabs>
                </Card.Header>
                <Card.Body>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="text-center py-5">
                            <FaCalendarAlt size={50} className="text-muted mb-3" />
                            <h5>Tidak Ada Janji Temu</h5>
                            <p className="text-muted">
                                {selectedDate ? 'Tidak ada janji pada tanggal ini' : 'Belum ada janji temu'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover>
                                <thead>
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
                                    {filteredAppointments.map((apt, index) => (
                                        <tr key={apt._id}>
                                            <td>{apt.queueNumber}</td>
                                            <td>
                                                <strong>{apt.userId?.name}</strong>
                                                <br />
                                                <small className="text-muted">{apt.userId?.phone}</small>
                                            </td>
                                            <td>{formatDate(apt.appointmentDate)}</td>
                                            <td>{apt.appointmentTime}</td>
                                            <td>{apt.complaint}</td>
                                            <td>{getStatusBadge(apt.status)}</td>
                                            <td>
                                                {apt.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            variant="success"
                                                            size="sm"
                                                            className="me-2"
                                                            onClick={() => handleApprove(apt._id)}
                                                        >
                                                            <FaCheckCircle className="me-1" />
                                                            Setujui
                                                        </Button>
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedAppointment(apt);
                                                                setShowRejectModal(true);
                                                            }}
                                                        >
                                                            <FaTimesCircle className="me-1" />
                                                            Tolak
                                                        </Button>
                                                    </>
                                                )}
                                                {apt.status === 'confirmed' && (
                                                    <Button
                                                        variant="info"
                                                        size="sm"
                                                        onClick={() => handleComplete(apt._id)}
                                                    >
                                                        Selesai
                                                    </Button>
                                                )}
                                                {apt.status === 'rejected' && apt.rejectionReason && (
                                                    <Button
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        onClick={() => {
                                                            alert(`Alasan: ${apt.rejectionReason}`);
                                                        }}
                                                    >
                                                        <FaInfoCircle className="me-1" />
                                                        Lihat Alasan
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Modal Reject */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Alasan Penolakan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Catatan untuk pasien</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Contoh: Jadwal penuh, dokter tidak praktek, dll"
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Batal
                    </Button>
                    <Button variant="danger" onClick={handleReject}>
                        Tolak Janji
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DoctorAppointments;