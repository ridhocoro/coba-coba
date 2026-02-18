import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { FaUserMd, FaUser, FaPaperPlane, FaClock, FaCheckCircle, FaStethoscope } from 'react-icons/fa';

const ConsultationChat = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [consultation, setConsultation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        fetchConsultation();
        
        // Initialize socket connection
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
                `http://localhost:5000/api/consultations/my-consultations`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const cons = response.data.find(c => c._id === id);
            if (cons) {
                setConsultation(cons);
                setMessages(cons.messages || []);
                
                // Update status to ongoing if paid and not already ongoing/completed
                if (cons.status === 'paid') {
                    await axios.put(
                        `http://localhost:5000/api/consultations/${id}/start`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    cons.status = 'ongoing';
                }
            } else {
                toast.error('Konsultasi tidak ditemukan');
                navigate('/consultations');
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
            message: newMessage,
            timestamp: new Date()
        };

        // Emit via socket
        socket.emit('send-message', messageData);

        // Save to database
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

    const endConsultation = async () => {
        if (window.confirm('Apakah Anda yakin ingin mengakhiri konsultasi?')) {
            try {
                const token = localStorage.getItem('token');
                await axios.put(
                    `http://localhost:5000/api/consultations/${id}/end`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Konsultasi selesai');
                navigate('/consultations');
            } catch (error) {
                toast.error('Gagal mengakhiri konsultasi');
            }
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
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
                                {consultation.status === 'ongoing' && (
                                    <Button 
                                        variant="light" 
                                        size="sm"
                                        onClick={endConsultation}
                                    >
                                        Akhiri Konsultasi
                                    </Button>
                                )}
                            </div>
                        </Card.Header>

                        {/* Chat Messages */}
                        <Card.Body 
                            ref={chatContainerRef}
                            className="overflow-auto"
                            style={{ flex: 1, maxHeight: 'calc(100vh - 250px)' }}
                        >
                            {/* Doctor Info Card */}
                            <Card className="bg-light mb-4">
                                <Card.Body className="p-3">
                                    <Row className="align-items-center">
                                        <Col md={1} className="text-center">
                                            <FaStethoscope size={30} className="text-primary" />
                                        </Col>
                                        <Col md={11}>
                                            <h6>dr. {consultation.doctorId?.name}</h6>
                                            <p className="text-muted small mb-0">
                                                {consultation.doctorId?.bio || 'Dokter spesialis siap membantu keluhan Anda'}
                                            </p>
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Card>

                            {/* Initial Symptoms */}
                            <Card className="mb-4 border-info">
                                <Card.Body className="p-3">
                                    <h6 className="text-info">Keluhan Awal:</h6>
                                    <p className="mb-0">{consultation.symptoms}</p>
                                </Card.Body>
                            </Card>

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
                                                {msg.senderId === user.id ? 'Anda' : 'Dokter'}
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

                        {consultation.status === 'completed' && (
                            <Card.Footer className="bg-light text-center">
                                <FaCheckCircle className="text-success me-2" />
                                Konsultasi telah selesai
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
                            <p className="mb-1">
                                <strong>Tanggal:</strong>
                            </p>
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
                            
                            <p className="mb-1">
                                <strong>Dokter:</strong>
                            </p>
                            <p className="text-muted">
                                dr. {consultation.doctorId?.name}
                                <br />
                                <small>{consultation.doctorId?.specialization}</small>
                            </p>
                            
                            {consultation.diagnosis && (
                                <>
                                    <p className="mb-1">
                                        <strong>Diagnosis:</strong>
                                    </p>
                                    <p className="text-success">
                                        {consultation.diagnosis}
                                    </p>
                                </>
                            )}
                            
                            {consultation.prescription && (
                                <>
                                    <p className="mb-1">
                                        <strong>Resep Obat:</strong>
                                    </p>
                                    <p className="text-muted">
                                        {consultation.prescription}
                                    </p>
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm" 
                                        className="w-100"
                                        href="/pharmacy"
                                    >
                                        Beli Obat
                                    </Button>
                                </>
                            )}
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm">
                        <Card.Header className="bg-warning">
                            <h6 className="mb-0">Tips Konsultasi</h6>
                        </Card.Header>
                        <Card.Body>
                            <ul className="small mb-0 ps-3">
                                <li className="mb-2">
                                    Jelaskan keluhan secara detail dan jujur
                                </li>
                                <li className="mb-2">
                                    Sampaikan riwayat penyakit jika ada
                                </li>
                                <li className="mb-2">
                                    Tanyakan hal yang tidak dimengerti
                                </li>
                                <li className="mb-2">
                                    Ikuti saran dan resep dari dokter
                                </li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ConsultationChat;