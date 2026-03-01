import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Container, Row, Col, Card, Form, Button, 
    Badge, Modal, Alert, Spinner 
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
    FaCalendarAlt, FaUserMd, FaClock, 
    FaHistory, FaCheckCircle, FaTimesCircle, FaHourglassHalf,
    FaInfoCircle, FaArrowRight, FaHospital
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
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [myAppointments, setMyAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

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
            const response = await api.get('/api/doctors');
            setDoctors(response.data);
        } catch (error) {
            toast.error('Gagal memuat data dokter');
        }
    };

    const fetchMyAppointments = async () => {
        try {
            const response = await api.get('/api/appointments/my-appointments');
            setMyAppointments(response.data);
        } catch (error) {
            toast.error('Gagal memuat riwayat janji temu');
        } finally {
            setLoadingAppointments(false);
        }
    };

    const fetchAvailableSlots = async (doctorId, date) => {
        if (!doctorId || !date) return;
        
        setLoadingSlots(true);
        try {
            const response = await api.get(`/api/appointments/available-slots/${doctorId}/${date}`);
            setAvailableSlots(response.data.slots || []);
        } catch (error) {
            toast.error('Gagal memuat jadwal tersedia');
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchAvailableSlots(selectedDoctor, selectedDate);
        } else {
            setAvailableSlots([]);
        }
    }, [selectedDoctor, selectedDate]);

    const handleDoctorChange = (e) => {
        setSelectedDoctor(e.target.value);
        setSelectedTime('');
    };

    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
        setSelectedTime('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedDoctor || !selectedDate || !selectedTime || !complaint.trim()) {
            toast.error('Semua field harus diisi');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/api/appointments/create', {
                doctorId: selectedDoctor,
                appointmentDate: selectedDate,
                appointmentTime: selectedTime,
                complaint
            });

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
            await api.put(`/api/appointments/${selectedAppointment._id}/cancel`, {
                reason: cancelReason
            });
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
            pending:    { bg: 'warning',   bgSoft: '#fff3cd', text: '#856404', icon: FaHourglassHalf, label: 'Menunggu'       },
            confirmed:  { bg: 'success',   bgSoft: '#d4edda', text: '#155724', icon: FaCheckCircle,   label: 'Dikonfirmasi'   },
            checked_in: { bg: 'primary',   bgSoft: '#cce5ff', text: '#004085', icon: FaCheckCircle,   label: 'Sudah Hadir ✓' },
            rejected:   { bg: 'danger',    bgSoft: '#f8d7da', text: '#721c24', icon: FaTimesCircle,   label: 'Ditolak'        },
            completed:  { bg: 'info',      bgSoft: '#d1ecf1', text: '#0c5460', icon: FaCheckCircle,   label: 'Selesai'        },
            cancelled:  { bg: 'secondary', bgSoft: '#e2e3e5', text: '#383d41', icon: FaTimesCircle,   label: 'Dibatalkan'     },
        };
        const v = variants[status] || variants.pending;
        return (
            <span 
                className="d-inline-flex align-items-center gap-1 px-3 py-1 rounded-pill small fw-medium"
                style={{ backgroundColor: v.bgSoft, color: v.text }}
            >
                <v.icon size={12} />
                {v.label}
            </span>
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

    const formatTime = (time) => {
        return time; // Asumsi format sudah HH:MM
    };

    // Filter appointments by status
    const filteredAppointments = filterStatus === 'all' 
        ? myAppointments 
        : myAppointments.filter(apt => apt.status === filterStatus);

    // Hitung minimal date (hari ini)
    const minDate = new Date().toISOString().split('T')[0];

    return (
        <div className="appointments-page bg-light min-vh-100 py-5">
            <Container>
                {/* Header */}
                <Row className="mb-4">
                    <Col>
                        <div className="d-flex align-items-center">
                            <div className="bg-primary bg-opacity-10 rounded-3 p-3 me-3">
                                <FaHospital size={24} className="text-primary" />
                            </div>
                            <div>
                                <h4 className="fw-bold mb-1">Janji Temu</h4>
                                <p className="text-secondary mb-0">Buat janji dengan dokter pilihan Anda</p>
                            </div>
                        </div>
                    </Col>
                </Row>

                <Row className="g-4">
                    {/* Left Column - Booking Form */}
                    <Col lg={5}>
                        <Card className="border-0 shadow-sm">
                            <Card.Body className="p-4">
                                <h5 className="fw-bold mb-4 d-flex align-items-center">
                                    <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-2">
                                        <FaCalendarAlt className="text-primary" size={16} />
                                    </div>
                                    Buat Janji Temu Baru
                                </h5>

                                <Form onSubmit={handleSubmit}>
                                    {/* Pilih Dokter */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium text-secondary small">
                                            <FaUserMd className="me-1" />
                                            Pilih Dokter
                                        </Form.Label>
                                        <Form.Select
                                            value={selectedDoctor}
                                            onChange={handleDoctorChange}
                                            className="bg-light border-0 py-2"
                                            style={{ borderRadius: '10px' }}
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

                                    {/* Pilih Tanggal */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium text-secondary small">
                                            <FaCalendarAlt className="me-1" />
                                            Pilih Tanggal
                                        </Form.Label>
                                        <Form.Control
                                            type="date"
                                            value={selectedDate}
                                            onChange={handleDateChange}
                                            min={minDate}
                                            className="bg-light border-0 py-2"
                                            style={{ borderRadius: '10px' }}
                                            required
                                        />
                                    </Form.Group>

                                    {/* Pilih Waktu */}
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-medium text-secondary small">
                                            <FaClock className="me-1" />
                                            Pilih Waktu
                                        </Form.Label>
                                        {loadingSlots ? (
                                            <div className="text-center py-3 bg-light rounded-3">
                                                <Spinner size="sm" className="me-2" />
                                                <span className="small">Memuat jadwal...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {availableSlots.length > 0 ? (
                                                        availableSlots.map(slot => (
                                                            <Button
                                                                key={slot}
                                                                variant={selectedTime === slot ? 'primary' : 'light'}
                                                                size="sm"
                                                                className={`rounded-pill px-3 ${selectedTime === slot ? 'shadow-sm' : ''}`}
                                                                onClick={() => setSelectedTime(slot)}
                                                                type="button"
                                                            >
                                                                {formatTime(slot)}
                                                            </Button>
                                                        ))
                                                    ) : (
                                                        <div className="w-100 text-center py-3 bg-light rounded-3">
                                                            <small className="text-secondary">
                                                                {selectedDoctor && selectedDate 
                                                                    ? 'Tidak ada jadwal tersedia' 
                                                                    : 'Pilih dokter dan tanggal terlebih dahulu'}
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedDoctor && selectedDate && availableSlots.length === 0 && !loadingSlots && (
                                                    <Form.Text className="text-danger d-block mt-2">
                                                        <FaInfoCircle className="me-1" />
                                                        Tidak ada jadwal tersedia untuk tanggal ini
                                                    </Form.Text>
                                                )}
                                            </>
                                        )}
                                    </Form.Group>

                                    {/* Keluhan */}
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-medium text-secondary small">
                                            Keluhan
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={complaint}
                                            onChange={(e) => setComplaint(e.target.value)}
                                            placeholder="Jelaskan keluhan Anda..."
                                            className="bg-light border-0"
                                            style={{ borderRadius: '10px', resize: 'none' }}
                                            required
                                        />
                                    </Form.Group>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="w-100 py-2 fw-medium"
                                        style={{ borderRadius: '10px' }}
                                        disabled={loading || loadingSlots}
                                    >
                                        {loading ? (
                                            <>
                                                <Spinner size="sm" className="me-2" />
                                                Memproses...
                                            </>
                                        ) : (
                                            <>
                                                Buat Janji Temu
                                                <FaArrowRight className="ms-2" />
                                            </>
                                        )}
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>

                    {/* Right Column - Appointment History */}
                    <Col lg={7}>
                        <Card className="border-0 shadow-sm">
                            <Card.Body className="p-4">
                                <div className="d-flex align-items-center justify-content-between mb-4">
                                    <h5 className="fw-bold mb-0 d-flex align-items-center">
                                        <div className="bg-info bg-opacity-10 rounded-circle p-2 me-2">
                                            <FaHistory className="text-info" size={16} />
                                        </div>
                                        Riwayat Janji Temu
                                    </h5>
                                    
                                    {/* Filter Status */}
                                    <Form.Select 
                                        size="sm"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        style={{ width: '140px', borderRadius: '20px' }}
                                        className="border-0 bg-light"
                                    >
                                        <option value="all">Semua</option>
                                        <option value="pending">Menunggu</option>
                                        <option value="confirmed">Dikonfirmasi</option>
                                        <option value="checked_in">Sudah Hadir</option>
                                        <option value="completed">Selesai</option>
                                        <option value="cancelled">Dibatalkan</option>
                                        <option value="rejected">Ditolak</option>
                                    </Form.Select>
                                </div>

                                {loadingAppointments ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                    </div>
                                ) : filteredAppointments.length === 0 ? (
                                    <div className="text-center py-5">
                                        <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                                            <FaCalendarAlt size={30} className="text-secondary" />
                                        </div>
                                        <h6 className="fw-bold mb-2">Belum Ada Janji Temu</h6>
                                        <p className="text-secondary small mb-0">
                                            {filterStatus === 'all' 
                                                ? 'Buat janji temu pertama Anda dengan dokter pilihan'
                                                : 'Tidak ada janji temu dengan status ini'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="appointment-list">
                                        {filteredAppointments.map(apt => (
                                            <Card key={apt._id} className="mb-3 border-0 shadow-sm">
                                                <Card.Body className="p-3">
                                                    <Row>
                                                        <Col md={8}>
                                                            <div className="d-flex align-items-center mb-2">
                                                                <FaUserMd className="text-primary me-2" size={14} />
                                                                <h6 className="fw-bold mb-0 small">
                                                                    {apt.doctorId?.name}
                                                                </h6>
                                                                <Badge bg="light" text="dark" className="ms-2 small">
                                                                    {apt.doctorId?.specialization}
                                                                </Badge>
                                                            </div>
                                                            
                                                            <div className="d-flex align-items-center mb-2">
                                                                <FaCalendarAlt className="text-secondary me-2" size={12} />
                                                                <span className="small text-secondary">
                                                                    {formatDate(apt.appointmentDate)}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="d-flex align-items-center mb-2">
                                                                <FaClock className="text-secondary me-2" size={12} />
                                                                <span className="small text-secondary">
                                                                    {apt.appointmentTime}
                                                                </span>
                                                                <Badge bg="light" text="dark" className="ms-2 small">
                                                                    No. {apt.queueNumber}
                                                                </Badge>
                                                            </div>
                                                            
                                                            <div className="mt-2 p-2 bg-light rounded-3">
                                                                <small className="text-secondary d-block">
                                                                    <span className="fw-medium">Keluhan:</span> {apt.complaint}
                                                                </small>
                                                            </div>
                                                            
                                                            {apt.rejectionReason && (
                                                                <Alert variant="danger" className="mt-2 py-2 small">
                                                                    <FaInfoCircle className="me-1" />
                                                                    {apt.rejectionReason}
                                                                </Alert>
                                                            )}
                                                        </Col>
                                                        
                                                        <Col md={4} className="text-md-end mt-3 mt-md-0">
                                                            <div className="mb-2">
                                                                {getStatusBadge(apt.status)}
                                                            </div>
                                                            
                                                            {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                                                <Button
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    className="mt-2 rounded-pill px-3"
                                                                    onClick={() => {
                                                                        setSelectedAppointment(apt);
                                                                        setShowCancelModal(true);
                                                                    }}
                                                                >
                                                                    Batalkan
                                                                </Button>
                                                            )}
                                                            
                                                            {apt.status === 'completed' && (
                                                                <Badge
                                                                    bg="light"
                                                                    text="success"
                                                                    className="mt-2 px-3 py-2 border border-success"
                                                                    style={{ borderRadius: '20px', fontSize: '0.75rem' }}
                                                                >
                                                                    ✓ Selesai ditangani
                                                                </Badge>
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
                <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h5 fw-bold">Batalkan Janji Temu</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-2">
                        <p className="small text-secondary mb-3">
                            Apakah Anda yakin ingin membatalkan janji temu ini?
                        </p>
                        <Form.Group>
                            <Form.Label className="fw-medium small">Alasan Pembatalan</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Jelaskan alasan pembatalan..."
                                className="bg-light border-0"
                                style={{ borderRadius: '10px', resize: 'none' }}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button 
                            variant="light" 
                            onClick={() => setShowCancelModal(false)}
                            className="rounded-pill px-4"
                        >
                            Tutup
                        </Button>
                        <Button 
                            variant="danger" 
                            onClick={handleCancel}
                            className="rounded-pill px-4"
                        >
                            Batalkan Janji
                        </Button>
                    </Modal.Footer>
                </Modal>
            </Container>

            <style jsx="true">{`
                .appointments-page {
                    background-color: #f8f9fa;
                }
                .bg-opacity-10 {
                    opacity: 0.1;
                }
                .btn {
                    transition: all 0.2s ease;
                }
                .btn:hover {
                    transform: translateY(-2px);
                }
                .appointment-list {
                    max-height: 600px;
                    overflow-y: auto;
                    padding-right: 5px;
                }
                .appointment-list::-webkit-scrollbar {
                    width: 5px;
                }
                .appointment-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .appointment-list::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 10px;
                }
                .appointment-list::-webkit-scrollbar-thumb:hover {
                    background: #999;
                }
            `}</style>
        </div>
    );
};

export default Appointments;