import React, { useState, useEffect } from 'react';
import { 
    Container, Row, Col, Card, Form, Button, 
    Table, Badge, Modal, Alert, Spinner 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaCalendarAlt, FaUserMd, FaClock, FaMoneyBillWave, 
    FaHistory, FaCheckCircle, FaTimesCircle, FaHourglassHalf,
    FaInfoCircle
} from 'react-icons/fa';

const Appointments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [complaint, setComplaint] = useState('');
    const [availableSlots, setAvailableSlots] = useState([]);
    const [myAppointments, setMyAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    useEffect(() => {
        if (!user) {
            toast.error('Silakan login terlebih dahulu');
            navigate('/login');
            return;
        }
        fetchDoctors();
        fetchMyAppointments();
    }, [user]);

    const fetchDoctors = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/doctors');
            setDoctors(response.data);
        } catch (error) {
            toast.error('Gagal memuat data dokter');
        }
    };

    const fetchMyAppointments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/appointments/my-appointments',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMyAppointments(response.data);
        } catch (error) {
            toast.error('Gagal memuat riwayat janji temu');
        } finally {
            setLoadingAppointments(false);
        }
    };

    const fetchAvailableSlots = async (doctorId, date) => {
        if (!doctorId || !date) return;
        
        try {
            const response = await axios.get(
                `http://localhost:5000/api/appointments/available-slots/${doctorId}/${date}`
            );
            setAvailableSlots(response.data.slots);
        } catch (error) {
            toast.error('Gagal memuat jadwal tersedia');
        }
    };

    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchAvailableSlots(selectedDoctor, selectedDate);
        }
    }, [selectedDoctor, selectedDate]);

    const handleDoctorChange = (e) => {
        setSelectedDoctor(e.target.value);
        setSelectedTime('');
        setAvailableSlots([]);
    };

    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
        setSelectedTime('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedDoctor || !selectedDate || !selectedTime || !complaint) {
            toast.error('Semua field harus diisi');
            return;
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/appointments/create',
                {
                    doctorId: selectedDoctor,
                    appointmentDate: selectedDate,
                    appointmentTime: selectedTime,
                    complaint
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Janji temu berhasil dibuat! Menunggu konfirmasi dokter.');
            fetchMyAppointments();
            
            // Reset form
            setSelectedDoctor('');
            setSelectedDate('');
            setSelectedTime('');
            setComplaint('');
            setAvailableSlots([]);
            
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal membuat janji temu');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelReason) {
            toast.error('Isi alasan pembatalan');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/appointments/${selectedAppointment._id}/cancel`,
                { reason: cancelReason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Janji temu dibatalkan');
            setShowCancelModal(false);
            setCancelReason('');
            fetchMyAppointments();
        } catch (error) {
            toast.error('Gagal membatalkan janji temu');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: { bg: 'warning', icon: FaHourglassHalf, text: 'Menunggu Konfirmasi' },
            confirmed: { bg: 'success', icon: FaCheckCircle, text: 'Dikonfirmasi' },
            rejected: { bg: 'danger', icon: FaTimesCircle, text: 'Ditolak' },
            completed: { bg: 'info', icon: FaCheckCircle, text: 'Selesai' },
            cancelled: { bg: 'secondary', icon: FaTimesCircle, text: 'Dibatalkan' }
        };
        const v = variants[status] || variants.pending;
        return (
            <Badge bg={v.bg} className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
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

    // Hitung minimal date (hari ini)
    const minDate = new Date().toISOString().split('T')[0];

    return (
        <Container className="py-5">
            <Row>
                <Col lg={5} className="mb-4">
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white py-3">
                            <h4 className="mb-0">
                                <FaCalendarAlt className="me-2" />
                                Buat Janji Temu Baru
                            </h4>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">
                                        <FaUserMd className="me-2" />
                                        Pilih Dokter
                                    </Form.Label>
                                    <Form.Select
                                        value={selectedDoctor}
                                        onChange={handleDoctorChange}
                                        required
                                    >
                                        <option value="">-- Pilih Dokter --</option>
                                        {doctors.map(doctor => (
                                            <option key={doctor._id} value={doctor._id}>
                                                {doctor.name} - {doctor.specialization}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">
                                        <FaCalendarAlt className="me-2" />
                                        Pilih Tanggal
                                    </Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={selectedDate}
                                        onChange={handleDateChange}
                                        min={minDate}
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">
                                        <FaClock className="me-2" />
                                        Pilih Waktu
                                    </Form.Label>
                                    <Form.Select
                                        value={selectedTime}
                                        onChange={(e) => setSelectedTime(e.target.value)}
                                        required
                                        disabled={!availableSlots.length}
                                    >
                                        <option value="">-- Pilih Waktu --</option>
                                        {availableSlots.map(slot => (
                                            <option key={slot} value={slot}>
                                                {slot}
                                            </option>
                                        ))}
                                    </Form.Select>
                                    {selectedDoctor && selectedDate && availableSlots.length === 0 && (
                                        <Form.Text className="text-danger">
                                            Tidak ada jadwal tersedia untuk tanggal ini
                                        </Form.Text>
                                    )}
                                </Form.Group>

                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-bold">Keluhan / Catatan</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        value={complaint}
                                        onChange={(e) => setComplaint(e.target.value)}
                                        placeholder="Jelaskan keluhan Anda..."
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
                                    {loading ? 'Memproses...' : 'Buat Janji Temu'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={7}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-info text-white py-3">
                            <h4 className="mb-0">
                                <FaHistory className="me-2" />
                                Riwayat Janji Temu
                            </h4>
                        </Card.Header>
                        <Card.Body>
                            {loadingAppointments ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : myAppointments.length === 0 ? (
                                <div className="text-center py-5">
                                    <FaCalendarAlt size={50} className="text-muted mb-3" />
                                    <h5>Belum Ada Janji Temu</h5>
                                    <p className="text-muted">
                                        Buat janji temu pertama Anda dengan dokter pilihan
                                    </p>
                                </div>
                            ) : (
                                <div className="appointment-list">
                                    {myAppointments.map(apt => (
                                        <Card key={apt._id} className="mb-3 border-start border-4 border-primary">
                                            <Card.Body>
                                                <Row>
                                                    <Col md={8}>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <FaUserMd className="text-primary me-2" />
                                                            <h6 className="mb-0">
                                                                {apt.doctorId?.name} - {apt.doctorId?.specialization}
                                                            </h6>
                                                        </div>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <FaCalendarAlt className="text-info me-2" />
                                                            <span>
                                                                {formatDate(apt.appointmentDate)}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <FaClock className="text-success me-2" />
                                                            <span>{apt.appointmentTime}</span>
                                                            <Badge bg="secondary" className="ms-2">
                                                                No. Antrian: {apt.queueNumber}
                                                            </Badge>
                                                        </div>
                                                        <div className="mt-2">
                                                            <strong>Keluhan:</strong>
                                                            <p className="text-muted mb-0">{apt.complaint}</p>
                                                        </div>
                                                        {apt.rejectionReason && (
                                                            <Alert variant="danger" className="mt-2 py-2">
                                                                <small>
                                                                    <strong>Alasan ditolak:</strong> {apt.rejectionReason}
                                                                </small>
                                                            </Alert>
                                                        )}
                                                    </Col>
                                                    <Col md={4} className="text-end">
                                                        <div className="mb-2">
                                                            {getStatusBadge(apt.status)}
                                                        </div>
                                                        {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                className="mt-2"
                                                                onClick={() => {
                                                                    setSelectedAppointment(apt);
                                                                    setShowCancelModal(true);
                                                                }}
                                                            >
                                                                Batalkan
                                                            </Button>
                                                        )}
                                                        {apt.status === 'completed' && (
                                                            <Button
                                                                variant="success"
                                                                size="sm"
                                                                className="mt-2"
                                                                onClick={() => navigate(`/appointments/${apt._id}/payment`)}
                                                            >
                                                                Bayar Sekarang
                                                            </Button>
                                                        )}
                                                    </Col>
                                                </Row>
                                            </Card.Body>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Modal Cancel */}
            <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Batalkan Janji Temu</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Alasan Pembatalan</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Jelaskan alasan pembatalan..."
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
                        Tutup
                    </Button>
                    <Button variant="danger" onClick={handleCancel}>
                        Batalkan Janji
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default Appointments;