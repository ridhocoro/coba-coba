import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { 
    FaUserMd, FaUser, FaPaperPlane, FaClock, 
    FaCheckCircle, FaStethoscope, FaFileMedical,
    FaDownload, FaFilePdf, FaPlus
} from 'react-icons/fa';

const ConsultationChat = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
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
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        fetchConsultation();
        
        const newSocket = io('http://localhost:5000');
        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [id, user]);

    useEffect(() => {
        if (socket && consultation) {
            socket.emit('join-consultation', consultation._id);

            socket.on('receive-message', (message) => {
                setMessages(prev => [...prev, message]);
            });

            return () => {
                socket.off('receive-message');
            };
        }
    }, [socket, consultation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConsultation = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/consultations/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setConsultation(response.data);
            setMessages(response.data.messages || []);
            setSickLetter(response.data.sickLetter || null);
            
            // Update status jika paid
            if (response.data.status === 'paid') {
                await axios.put(
                    `http://localhost:5000/api/consultations/${id}/start`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Refresh data
                const updated = await axios.get(
                    `http://localhost:5000/api/consultations/${id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setConsultation(updated.data);
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
            message: newMessage,
            timestamp: new Date()
        };

        socket.emit('send-message', messageData);

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/api/consultations/${id}/messages`,
                { message: newMessage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            toast.error('Gagal mengirim pesan');
        }

        setNewMessage('');
    };

    const handleCreateSickLetter = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `http://localhost:5000/api/consultations/${id}/sick-letter`,
                sickLetterData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Surat sakit berhasil dibuat');
            setSickLetter(response.data.sickLetter);
            setShowSickLetterForm(false);
            
            // Refresh konsultasi
            fetchConsultation();

        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal membuat surat sakit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleIssueSickLetter = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `http://localhost:5000/api/consultations/${id}/sick-letter/issue`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Surat sakit berhasil diterbitkan');
            setSickLetter(response.data.sickLetter);
            fetchConsultation();

        } catch (error) {
            toast.error('Gagal menerbitkan surat sakit');
        }
    };

    const downloadPDF = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/consultations/${id}/sick-letter/pdf`,
                {
                    headers: { Authorization: `Bearer ${token}` },
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
            
            toast.success('Surat sakit berhasil diunduh');
        } catch (error) {
            toast.error('Gagal mengunduh surat sakit');
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isDoctor = user?.role === 'doctor';
    const isUser = user?.role === 'user';

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
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
            <Row className="h-100">
                <Col md={9} className="h-100">
                    <Card className="h-100 d-flex flex-column shadow-sm">
                        {/* Chat Header */}
                        <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="mb-0">
                                    <FaUserMd className="me-2" />
                                    Konsultasi dengan dr. {consultation.doctorId?.name}
                                </h5>
                                <small>
                                    {consultation.doctorId?.specialization}
                                </small>
                            </div>
                            <div>
                                <Badge bg={
                                    consultation.status === 'ongoing' ? 'success' :
                                    consultation.status === 'completed' ? 'info' : 'warning'
                                } className="me-2">
                                    {consultation.status}
                                </Badge>
                                {sickLetter && (
                                    <Badge bg="warning" className="me-2">
                                        <FaFileMedical className="me-1" />
                                        Surat Sakit
                                    </Badge>
                                )}
                            </div>
                        </Card.Header>

                        {/* Chat Messages */}
                        <Card.Body 
                            ref={chatContainerRef}
                            className="overflow-auto"
                            style={{ flex: 1, maxHeight: 'calc(100vh - 250px)' }}
                        >
                            {/* Initial Symptoms */}
                            <Card className="mb-4 border-info">
                                <Card.Body className="p-3">
                                    <h6 className="text-info">Keluhan Awal:</h6>
                                    <p className="mb-0">{consultation.symptoms}</p>
                                </Card.Body>
                            </Card>

                            {/* Sick Letter Info (if exists) */}
                            {sickLetter && (
                                <Card className="mb-4 border-success">
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 className="text-success">
                                                    <FaFileMedical className="me-2" />
                                                    Surat Sakit {sickLetter.status === 'issued' ? '(Telah Terbit)' : '(Draft)'}
                                                </h6>
                                                <p className="mb-1">
                                                    <strong>Diagnosis:</strong> {sickLetter.diagnosis}
                                                </p>
                                                <p className="mb-1">
                                                    <strong>Istirahat:</strong> {Math.ceil((new Date(sickLetter.endDate) - new Date(sickLetter.startDate)) / (1000 * 60 * 60 * 24)) + 1} hari
                                                </p>
                                                {sickLetter.notes && (
                                                    <p className="mb-1">
                                                        <strong>Catatan:</strong> {sickLetter.notes}
                                                    </p>
                                                )}
                                            </div>
                                            {sickLetter.status === 'issued' && (
                                                <Button 
                                                    variant="success"
                                                    size="sm"
                                                    onClick={downloadPDF}
                                                >
                                                    <FaDownload className="me-1" />
                                                    Download PDF
                                                </Button>
                                            )}
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
                                        <div className="mb-1">{msg.message}</div>
                                        <div className={`text-end ${
                                            msg.senderId === user.id ? 'text-white-50' : 'text-muted'
                                        }`}>
                                            <small>
                                                <FaClock className="me-1" size={10} />
                                                {formatTime(msg.timestamp)}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </Card.Body>

                        {/* Chat Input */}
                        {consultation.status === 'ongoing' && (
                            <Card.Footer className="bg-white">
                                <Form onSubmit={sendMessage}>
                                    <Row className="align-items-center">
                                        <Col md={11}>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ketik pesan Anda..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                className="border-0 bg-light"
                                            />
                                        </Col>
                                        <Col md={1}>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                className="w-100"
                                                disabled={!newMessage.trim()}
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

                <Col md={3}>
                    {/* Info Panel */}
                    <Card className="shadow-sm mb-3">
                        <Card.Header className="bg-info text-white">
                            <h6 className="mb-0">Informasi Konsultasi</h6>
                        </Card.Header>
                        <Card.Body>
                            <p className="mb-1"><strong>Tanggal:</strong></p>
                            <p className="text-muted">
                                {new Date(consultation.createdAt).toLocaleDateString('id-ID', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            
                            <p className="mb-1"><strong>Dokter:</strong></p>
                            <p className="text-muted">
                                dr. {consultation.doctorId?.name}
                                <br />
                                <small>{consultation.doctorId?.specialization}</small>
                            </p>
                        </Card.Body>
                    </Card>

                    {/* Doctor Actions */}
                    {isDoctor && consultation.status === 'ongoing' && !sickLetter && (
                        <Card className="shadow-sm mb-3 border-success">
                            <Card.Header className="bg-success text-white">
                                <h6 className="mb-0">Tindakan Medis</h6>
                            </Card.Header>
                            <Card.Body>
                                <Button
                                    variant="success"
                                    className="w-100 mb-2"
                                    onClick={() => setShowSickLetterForm(true)}
                                >
                                    <FaFileMedical className="me-2" />
                                    Buat Surat Sakit
                                </Button>
                                <Button
                                    variant="outline-primary"
                                    className="w-100"
                                >
                                    <FaStethoscope className="me-2" />
                                    Resep Obat
                                </Button>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Doctor Actions - Issue Sick Letter */}
                    {isDoctor && sickLetter && sickLetter.status === 'draft' && (
                        <Card className="shadow-sm mb-3 border-warning">
                            <Card.Header className="bg-warning text-white">
                                <h6 className="mb-0">Surat Sakit Draft</h6>
                            </Card.Header>
                            <Card.Body>
                                <p className="small">Surat sakit sudah dibuat, perlu diterbitkan.</p>
                                <Button
                                    variant="warning"
                                    className="w-100"
                                    onClick={handleIssueSickLetter}
                                >
                                    <FaCheckCircle className="me-2" />
                                    Terbitkan Surat
                                </Button>
                            </Card.Body>
                        </Card>
                    )}

                    {/* User Actions */}
                    {isUser && sickLetter && sickLetter.status === 'issued' && (
                        <Card className="shadow-sm mb-3 border-success">
                            <Card.Header className="bg-success text-white">
                                <h6 className="mb-0">Surat Sakit</h6>
                            </Card.Header>
                            <Card.Body>
                                <Button
                                    variant="success"
                                    className="w-100"
                                    onClick={downloadPDF}
                                >
                                    <FaDownload className="me-2" />
                                    Download PDF
                                </Button>
                            </Card.Body>
                        </Card>
                    )}

                    <Card className="shadow-sm">
                        <Card.Header className="bg-warning">
                            <h6 className="mb-0">Tips Konsultasi</h6>
                        </Card.Header>
                        <Card.Body>
                            <ul className="small mb-0 ps-3">
                                <li className="mb-2">Jelaskan keluhan secara detail</li>
                                <li className="mb-2">Sampaikan riwayat penyakit</li>
                                <li className="mb-2">Tanyakan hal yang tidak dimengerti</li>
                                <li className="mb-2">Ikuti saran dan resep dokter</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Modal Form Surat Sakit */}
            <Modal show={showSickLetterForm} onHide={() => setShowSickLetterForm(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaFileMedical className="me-2 text-primary" />
                        Buat Surat Sakit
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreateSickLetter}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Diagnosis</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={sickLetterData.diagnosis}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    diagnosis: e.target.value
                                })}
                                placeholder="Contoh: Demam akut, ISPA, dll"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Jumlah Hari Istirahat</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="30"
                                value={sickLetterData.restDays}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    restDays: parseInt(e.target.value)
                                })}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Catatan Tambahan</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={sickLetterData.notes}
                                onChange={(e) => setSickLetterData({
                                    ...sickLetterData,
                                    notes: e.target.value
                                })}
                                placeholder="Contoh: Tidak boleh bekerja berat, dll"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowSickLetterForm(false)}>
                            Batal
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary"
                            disabled={submitting}
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