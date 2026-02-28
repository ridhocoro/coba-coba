// src/pages/Consultations/consultationchat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, Modal, InputGroup, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import api, { API_URL } from '../../utils/api';
import { 
    FaUserMd, FaUser, FaPaperPlane, FaClock, 
    FaCheckCircle, FaStethoscope, FaFileMedical,
    FaDownload, FaVideo, FaPhone, FaPlus,
    FaStopCircle, FaRegCheckCircle
} from 'react-icons/fa';

const ConsultationChat = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // State
    const [consultation, setConsultation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [showSickLetterForm, setShowSickLetterForm] = useState(false);
    const [sickLetterData, setSickLetterData] = useState({
        diagnosis: '',
        restDays: 3,
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [sickLetter, setSickLetter] = useState(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    
    // Refs
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Check auth
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
    }, [user, navigate]);

    // Fetch consultation
    useEffect(() => {
        fetchConsultation();
    }, [id]);

    // Socket connection
    useEffect(() => {
        if (!user) return;

        const newSocket = io(API_URL, {
            query: { userId: user.id, role: user.role }
        });
        setSocket(newSocket);

        return () => {
            if (newSocket) newSocket.close();
        };
    }, [user]);

    // Socket events
    useEffect(() => {
        if (!socket || !consultation) return;

        socket.emit('join-consultation', consultation._id);

        socket.on('receive-message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('user-typing', (data) => {
            if (data.userId !== user.id) {
                setIsTyping(data.isTyping);
                // Auto-hide after 3 seconds
                if (data.isTyping) {
                    setTimeout(() => setIsTyping(false), 3000);
                }
            }
        });

        socket.on('consultation-ended', () => {
            toast.info('Konsultasi telah diakhiri');
            fetchConsultation();
        });

        return () => {
            socket.off('receive-message');
            socket.off('user-typing');
            socket.off('consultation-ended');
        };
    }, [socket, consultation, user.id]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConsultation = async () => {
        try {
            const response = await api.get(`/api/consultations/${id}`);
            
            setConsultation(response.data);
            setMessages(response.data.messages || []);
            setSickLetter(response.data.sickLetter || null);
            
            // Auto-start if paid
            if (response.data.status === 'paid') {
                await api.put(`/api/consultations/${id}/start`);
                
                const updated = await api.get(`/api/consultations/${id}`);
                setConsultation(updated.data);
                
                // Notifikasi
                socket?.emit('consultation-started', { consultationId: id });
            }
        } catch (error) {
            toast.error('Gagal memuat konsultasi');
            navigate('/consultations');
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const messageData = {
            consultationId: id,
            senderId: user.id,
            senderName: user.role === 'doctor' ? `dr. ${user.name}` : user.name,
            senderRole: user.role,
            message: newMessage,
            timestamp: new Date()
        };

        // Emit via socket untuk real-time
        socket.emit('send-message', messageData);

        // Simpan ke database
        try {
            await api.post(`/api/consultations/${id}/messages`, {
                message: newMessage
            });
        } catch (error) {
            toast.error('Gagal mengirim pesan');
        }

        setNewMessage('');
    };

    const handleTyping = () => {
        socket.emit('typing', { 
            consultationId: id, 
            userId: user.id,
            isTyping: true 
        });

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing', { 
                consultationId: id, 
                userId: user.id,
                isTyping: false 
            });
        }, 1000);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File maksimal 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploadingFile(true);
        try {
            const response = await api.post(`/api/consultations/${id}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const messageData = {
                consultationId: id,
                senderId: user.id,
                senderName: user.role === 'doctor' ? `dr. ${user.name}` : user.name,
                senderRole: user.role,
                message: `📎 ${file.name}`,
                fileUrl: response.data.url,
                fileType: file.type,
                timestamp: new Date()
            };

            socket.emit('send-message', messageData);
            await api.post(`/api/consultations/${id}/messages`, messageData);
            
            toast.success('File berhasil diupload');
            
        } catch (error) {
            toast.error('Gagal upload file');
        } finally {
            setUploadingFile(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleEndConsultation = async () => {
        if (!window.confirm('Apakah Anda yakin ingin mengakhiri konsultasi?')) return;
        
        try {
            await api.put(`/api/consultations/${id}/complete`);
            socket.emit('end-consultation', { consultationId: id });
            toast.success('Konsultasi selesai');
            navigate('/consultations');
        } catch (error) {
            toast.error('Gagal mengakhiri konsultasi');
        }
    };

    const handleCreateSickLetter = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await api.post(`/api/consultations/${id}/sick-letter`, sickLetterData);

            toast.success('Surat sakit berhasil dibuat');
            setSickLetter(response.data.sickLetter);
            setShowSickLetterForm(false);
            
            // Kirim notifikasi via socket
            socket.emit('sick-letter-created', { 
                consultationId: id,
                message: 'Dokter telah membuat surat sakit'
            });
            
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal membuat surat sakit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleIssueSickLetter = async () => {
        try {
            const response = await api.put(`/api/consultations/${id}/sick-letter/issue`);

            toast.success('Surat sakit berhasil diterbitkan');
            setSickLetter(response.data.sickLetter);
            
            socket.emit('sick-letter-issued', { 
                consultationId: id,
                message: 'Surat sakit telah diterbitkan'
            });

        } catch (error) {
            toast.error('Gagal menerbitkan surat sakit');
        }
    };

    const downloadPDF = async () => {
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
            
            toast.success('Surat sakit berhasil diunduh');
        } catch (error) {
            toast.error('Gagal mengunduh surat sakit');
        }
    };

    const startVideoCall = () => {
        // Implementasi video call (Jitsi, Zoom, dll)
        toast.info('Fitur video call akan segera tersedia');
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isDoctor = user?.role === 'doctor';
    const isUser = user?.role === 'user';

    // Loading state
    if (loading) {
        return (
            <Container className="py-5 text-center">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-secondary">Memuat konsultasi...</p>
            </Container>
        );
    }

    if (!consultation) {
        return (
            <Container className="py-5">
                <Alert variant="danger">
                    Konsultasi tidak ditemukan atau tidak dapat diakses
                </Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4" style={{ height: 'calc(100vh - 76px)' }}>
            <Row className="h-100 g-3">
                {/* Chat Area */}
                <Col lg={8} xl={9} className="h-100">
                    <Card className="h-100 d-flex flex-column shadow-sm">
                        {/* Chat Header */}
                        <Card.Header className="bg-primary text-white py-3">
                            <Row className="align-items-center">
                                <Col>
                                    <div className="d-flex align-items-center">
                                        <div className="bg-white bg-opacity-10 rounded-circle p-2 me-3">
                                            <FaUserMd size={20} />
                                        </div>
                                        <div>
                                            <h5 className="mb-0">
                                                dr. {consultation.doctorId?.name}
                                            </h5>
                                            <small className="text-white-50">
                                                {consultation.doctorId?.specialization}
                                            </small>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs="auto">
                                    <Badge bg={
                                        consultation.status === 'ongoing' ? 'success' :
                                        consultation.status === 'completed' ? 'info' : 'warning'
                                    } className="me-2 py-2">
                                        {consultation.status === 'ongoing' ? 'Berlangsung' :
                                         consultation.status === 'completed' ? 'Selesai' : 'Menunggu'}
                                    </Badge>
                                    {sickLetter && sickLetter.status === 'issued' && (
                                        <Badge bg="warning" className="me-2 py-2">
                                            <FaFileMedical className="me-1" />
                                            Surat Sakit
                                        </Badge>
                                    )}
                                    {consultation.status === 'ongoing' && (
                                        <Button 
                                            variant="outline-light" 
                                            size="sm"
                                            onClick={handleEndConsultation}
                                            className="rounded-pill"
                                        >
                                            <FaStopCircle className="me-1" />
                                            Akhiri
                                        </Button>
                                    )}
                                </Col>
                            </Row>
                        </Card.Header>

                        {/* Chat Messages */}
                        <Card.Body 
                            ref={chatContainerRef}
                            className="overflow-auto"
                            style={{ flex: 1, maxHeight: 'calc(100vh - 280px)' }}
                        >
                            {/* Initial Symptoms */}
                            <Card className="mb-4 border-info bg-info bg-opacity-10">
                                <Card.Body className="p-3">
                                    <div className="d-flex">
                                        <div className="bg-info rounded-circle p-2 me-3" style={{ width: '32px', height: '32px' }}>
                                            <FaUser className="text-white" size={16} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <h6 className="text-info mb-2">Keluhan Awal:</h6>
                                            <p className="mb-0">{consultation.symptoms}</p>
                                            {consultation.medicalHistory && (
                                                <>
                                                    <hr className="my-2" />
                                                    <small className="text-secondary">
                                                        <strong>Riwayat:</strong> {consultation.medicalHistory}
                                                    </small>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>

                            {/* Sick Letter Info */}
                            {sickLetter && (
                                <Card className="mb-4 border-success bg-success bg-opacity-10">
                                    <Card.Body>
                                        <div className="d-flex">
                                            <div className="bg-success rounded-circle p-2 me-3" style={{ width: '32px', height: '32px' }}>
                                                <FaFileMedical className="text-white" size={16} />
                                            </div>
                                            <div className="flex-grow-1">
                                                <div className="d-flex justify-content-between align-items-start">
                                                    <div>
                                                        <h6 className="text-success mb-2">
                                                            Surat Sakit {sickLetter.status === 'issued' ? '(Telah Terbit)' : '(Draft)'}
                                                        </h6>
                                                        <p className="mb-1">
                                                            <strong>Diagnosis:</strong> {sickLetter.diagnosis}
                                                        </p>
                                                        <p className="mb-1">
                                                            <strong>Istirahat:</strong> {sickLetter.sickLeaveDays} hari
                                                        </p>
                                                        {sickLetter.notes && (
                                                            <p className="mb-1">
                                                                <strong>Catatan:</strong> {sickLetter.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {sickLetter.status === 'issued' && isUser && (
                                                        <Button 
                                                            variant="success"
                                                            size="sm"
                                                            onClick={downloadPDF}
                                                            className="rounded-pill"
                                                        >
                                                            <FaDownload className="me-1" />
                                                            PDF
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Messages */}
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`d-flex mb-3 ${msg.senderId === user.id ? 'justify-content-end' : 'justify-content-start'}`}
                                >
                                    <div
                                        className={`p-3 rounded-3 ${
                                            msg.senderId === user.id
                                                ? 'bg-primary text-white'
                                                : 'bg-light'
                                        }`}
                                        style={{ maxWidth: '70%' }}
                                    >
                                        <div className="d-flex align-items-center mb-1">
                                            {msg.senderId !== user.id && (
                                                <FaUserMd className="me-1" size={12} />
                                            )}
                                            <small className={msg.senderId === user.id ? 'text-white-50' : 'text-muted'}>
                                                {msg.senderName}
                                            </small>
                                        </div>
                                        
                                        {msg.fileUrl ? (
                                            <div className="mb-1">
                                                <a 
                                                    href={msg.fileUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className={msg.senderId === user.id ? 'text-white' : ''}
                                                >
                                                    {msg.message}
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="mb-1">{msg.message}</div>
                                        )}
                                        
                                        <div className={`text-end ${
                                            msg.senderId === user.id ? 'text-white-50' : 'text-muted'
                                        }`}>
                                            <small>
                                                <FaClock className="me-1" size={10} />
                                                {formatTime(msg.timestamp)}
                                                {msg.senderId === user.id && (
                                                    <FaCheckCircle className="ms-1" size={10} />
                                                )}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Typing Indicator */}
                            {isTyping && (
                                <div className="text-muted small ms-3">
                                    <Spinner animation="grow" size="sm" variant="primary" />
                                    <Spinner animation="grow" size="sm" variant="primary" className="ms-1" />
                                    <Spinner animation="grow" size="sm" variant="primary" className="ms-1" />
                                    <span className="ms-2">Dokter sedang mengetik...</span>
                                </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                        </Card.Body>

                        {/* Chat Input */}
                        {consultation.status === 'ongoing' && (
                            <Card.Footer className="bg-white border-0 py-3">
                                <Form onSubmit={sendMessage}>
                                    <Row className="g-2">
                                        <Col xs="auto">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                onChange={handleFileUpload}
                                                accept="image/*,.pdf,.doc,.docx"
                                            />
                                            <Button
                                                variant="light"
                                                onClick={() => fileInputRef.current.click()}
                                                disabled={uploadingFile}
                                                className="rounded-circle"
                                                style={{ width: '38px', height: '38px' }}
                                            >
                                                {uploadingFile ? <Spinner size="sm" /> : <FaPlus />}
                                            </Button>
                                        </Col>
                                        <Col>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ketik pesan Anda..."
                                                value={newMessage}
                                                onChange={(e) => {
                                                    setNewMessage(e.target.value);
                                                    handleTyping();
                                                }}
                                                className="border-0 bg-light rounded-pill"
                                            />
                                        </Col>
                                        <Col xs="auto">
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                disabled={!newMessage.trim()}
                                                className="rounded-circle"
                                                style={{ width: '38px', height: '38px' }}
                                            >
                                                <FaPaperPlane />
                                            </Button>
                                        </Col>
                                    </Row>
                                </Form>
                            </Card.Footer>
                        )}
                    </Card>
                </Col>

                {/* Info Panel */}
                <Col lg={4} xl={3}>
                    {/* Consultation Info */}
                    <Card className="shadow-sm mb-3">
                        <Card.Header className="bg-info text-white py-2">
                            <h6 className="mb-0">Informasi Konsultasi</h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                            <div className="mb-3">
                                <small className="text-secondary d-block">Tanggal Mulai</small>
                                <p className="mb-0">
                                    {new Date(consultation.createdAt).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            
                            <div className="mb-3">
                                <small className="text-secondary d-block">Jenis Konsultasi</small>
                                <p className="mb-0 text-capitalize">
                                    {consultation.consultationType === 'chat' && 'Chat'}
                                    {consultation.consultationType === 'voice' && 'Voice Call'}
                                    {consultation.consultationType === 'video' && 'Video Call'}
                                </p>
                            </div>

                            {consultation.scheduleType === 'scheduled' && consultation.confirmedDate && (
                                <div className="mb-3">
                                    <small className="text-secondary d-block">Jadwal</small>
                                    <p className="mb-0">
                                        {new Date(consultation.confirmedDate).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'long'
                                        })} {consultation.confirmedTime}
                                    </p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>

                    {/* Doctor Actions */}
                    {isDoctor && consultation.status === 'ongoing' && (
                        <>
                            {/* Create Sick Letter */}
                            {!sickLetter && (
                                <Card className="shadow-sm mb-3 border-success">
                                    <Card.Header className="bg-success text-white py-2">
                                        <h6 className="mb-0">Tindakan Medis</h6>
                                    </Card.Header>
                                    <Card.Body className="p-3">
                                        <Button
                                            variant="success"
                                            className="w-100 mb-2 rounded-pill"
                                            onClick={() => setShowSickLetterForm(true)}
                                        >
                                            <FaFileMedical className="me-2" />
                                            Buat Surat Sakit
                                        </Button>
                                        <Button
                                            variant="outline-primary"
                                            className="w-100 rounded-pill"
                                            onClick={startVideoCall}
                                        >
                                            <FaVideo className="me-2" />
                                            Video Call
                                        </Button>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Issue Draft Sick Letter */}
                            {sickLetter && sickLetter.status === 'draft' && (
                                <Card className="shadow-sm mb-3 border-warning">
                                    <Card.Header className="bg-warning text-white py-2">
                                        <h6 className="mb-0">Surat Sakit Draft</h6>
                                    </Card.Header>
                                    <Card.Body className="p-3">
                                        <p className="small mb-3">
                                            Surat sakit sudah dibuat, perlu diterbitkan.
                                        </p>
                                        <Button
                                            variant="warning"
                                            className="w-100 rounded-pill"
                                            onClick={handleIssueSickLetter}
                                        >
                                            <FaCheckCircle className="me-2" />
                                            Terbitkan Surat
                                        </Button>
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}

                    {/* Patient Actions */}
                    {isUser && (
                        <>
                            {/* Download Sick Letter */}
                            {sickLetter && sickLetter.status === 'issued' && (
                                <Card className="shadow-sm mb-3 border-success">
                                    <Card.Header className="bg-success text-white py-2">
                                        <h6 className="mb-0">Surat Sakit</h6>
                                    </Card.Header>
                                    <Card.Body className="p-3">
                                        <Button
                                            variant="success"
                                            className="w-100 rounded-pill"
                                            onClick={downloadPDF}
                                        >
                                            <FaDownload className="me-2" />
                                            Download PDF
                                        </Button>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Video Call */}
                            {consultation.status === 'ongoing' && consultation.consultationType !== 'chat' && (
                                <Card className="shadow-sm mb-3">
                                    <Card.Body className="p-3">
                                        <Button
                                            variant="primary"
                                            className="w-100 rounded-pill"
                                            onClick={startVideoCall}
                                        >
                                            <FaVideo className="me-2" />
                                            Mulai {consultation.consultationType === 'video' ? 'Video Call' : 'Voice Call'}
                                        </Button>
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}

                    {/* Tips */}
                    <Card className="shadow-sm">
                        <Card.Header className="bg-warning py-2">
                            <h6 className="mb-0 text-dark">Tips Konsultasi</h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                            <ul className="small mb-0 ps-3">
                                <li className="mb-2">Jelaskan keluhan secara detail</li>
                                <li className="mb-2">Sampaikan riwayat penyakit</li>
                                <li className="mb-2">Tanyakan hal yang tidak dimengerti</li>
                                <li className="mb-2">Ikuti saran dan resep dokter</li>
                                <li className="mb-2">Simpan surat sakit jika diberikan</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Modal Surat Sakit */}
            <Modal show={showSickLetterForm} onHide={() => setShowSickLetterForm(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="h5 fw-bold">
                        <FaFileMedical className="me-2 text-primary" />
                        Buat Surat Sakit
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreateSickLetter}>
                    <Modal.Body className="pt-2">
                        <Form.Group className="mb-3">
                            <Form.Label className="small text-secondary">Diagnosis *</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={sickLetterData.diagnosis}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    diagnosis: e.target.value
                                })}
                                placeholder="Contoh: Demam akut, ISPA, dll"
                                className="bg-light border-0"
                                style={{ borderRadius: '10px', resize: 'none' }}
                                required
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label className="small text-secondary">Jumlah Hari Istirahat *</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="30"
                                value={sickLetterData.restDays}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    restDays: parseInt(e.target.value)
                                })}
                                className="bg-light border-0"
                                style={{ borderRadius: '10px' }}
                                required
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label className="small text-secondary">Catatan Tambahan</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={sickLetterData.notes}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    notes: e.target.value
                                })}
                                placeholder="Contoh: Tidak boleh bekerja berat, dll"
                                className="bg-light border-0"
                                style={{ borderRadius: '10px', resize: 'none' }}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button variant="light" onClick={() => setShowSickLetterForm(false)} className="rounded-pill px-4">
                            Batal
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary"
                            disabled={submitting}
                            className="rounded-pill px-4"
                        >
                            {submitting ? 'Menyimpan...' : 'Buat Surat Sakit'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default ConsultationChat;