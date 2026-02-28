import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Form, InputGroup, Spinner, Modal, ListGroup
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaStethoscope, FaSearch, FaFilter, FaEye, FaArrowLeft,
    FaComment, FaFileMedical, FaClock, FaCheckCircle,
    FaSync, FaUser
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DoctorConsultations = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'doctor') { navigate('/'); return; }
        fetchData();
    }, [authLoading, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/consultations/doctor/all');
            setConsultations(res.data.consultations || res.data || []);
        } catch {
            toast.error('Gagal memuat data konsultasi');
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        pending:         { bg: 'secondary', label: 'Menunggu' },
        waiting_payment: { bg: 'warning',   label: 'Menunggu Bayar' },
        paid:            { bg: 'info',      label: 'Sudah Dibayar' },
        ongoing:         { bg: 'primary',   label: 'Berlangsung' },
        completed:       { bg: 'success',   label: 'Selesai' },
        cancelled:       { bg: 'danger',    label: 'Dibatalkan' },
    };

    const filtered = consultations.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
            c.userId?.name?.toLowerCase().includes(q) ||
            c.symptoms?.toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const stats = {
        ongoing: consultations.filter(c => c.status === 'ongoing').length,
        paid: consultations.filter(c => c.status === 'paid').length,
        completed: consultations.filter(c => c.status === 'completed').length,
        total: consultations.length,
    };

    if (authLoading || loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data...</p>
        </Container>
    );

    return (
        <Container fluid className="py-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button as={Link} to="/doctor" variant="link" className="p-0 text-muted mb-1">
                        <FaArrowLeft className="me-1" /> Dashboard
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaStethoscope className="me-2 text-success" />
                        Konsultasi Saya
                    </h4>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchData}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            <Row className="mb-4 g-3">
                {[
                    { label: 'Total', value: stats.total, bg: 'primary' },
                    { label: 'Berlangsung', value: stats.ongoing, bg: 'info' },
                    { label: 'Menunggu Masuk', value: stats.paid, bg: 'warning' },
                    { label: 'Selesai', value: stats.completed, bg: 'success' },
                ].map((s, i) => (
                    <Col md={3} xs={6} key={i}>
                        <Card className={`border-0 shadow-sm bg-${s.bg} text-white`}>
                            <Card.Body className="py-3 text-center">
                                <div className="fw-bold fs-3">{s.value}</div>
                                <div className="small opacity-75">{s.label}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row className="mb-3 g-2">
                <Col md={5}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            placeholder="Cari nama pasien atau keluhan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={3}>
                    <InputGroup>
                        <InputGroup.Text><FaFilter /></InputGroup.Text>
                        <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Semua Status</option>
                            {Object.entries(statusConfig).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </Form.Select>
                    </InputGroup>
                </Col>
                <Col className="d-flex align-items-center">
                    <span className="text-muted small">{filtered.length} konsultasi</span>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Pasien</th>
                                <th>Keluhan</th>
                                <th>Status</th>
                                <th>Surat Sakit</th>
                                <th>Tanggal</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-5 text-muted">
                                    <FaStethoscope size={32} className="mb-2 opacity-25 d-block mx-auto" />
                                    Tidak ada konsultasi
                                </td></tr>
                            ) : filtered.map(c => (
                                <tr key={c._id}>
                                    <td>
                                        <div className="fw-semibold small">{c.userId?.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{c.userId?.phone}</div>
                                    </td>
                                    <td className="small text-muted" style={{ maxWidth: 150 }}>
                                        {c.symptoms?.length > 50 ? c.symptoms.slice(0, 50) + '...' : c.symptoms}
                                    </td>
                                    <td>
                                        <Badge bg={statusConfig[c.status]?.bg || 'secondary'}>
                                            {statusConfig[c.status]?.label || c.status}
                                        </Badge>
                                    </td>
                                    <td>
                                        {c.sickLetter
                                            ? <Badge bg={c.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                {c.sickLetter.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                                              </Badge>
                                            : <span className="text-muted small">-</span>}
                                    </td>
                                    <td className="small text-muted">
                                        {new Date(c.createdAt).toLocaleDateString('id-ID')}
                                    </td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">
                                            <Button variant="outline-secondary" size="sm"
                                                onClick={() => { setSelected(c); setShowModal(true); }}>
                                                <FaEye />
                                            </Button>
                                            {c.status === 'ongoing' && (
                                                <Button as={Link} to={`/consultations/${c._id}`}
                                                    variant="success" size="sm">
                                                    <FaComment className="me-1" /> Chat
                                                </Button>
                                            )}
                                            {(c.status === 'ongoing' || c.status === 'completed') && !c.sickLetter && (
                                                <Button as={Link} to="/doctor/sick-letters"
                                                    variant="warning" size="sm">
                                                    <FaFileMedical className="me-1" /> Surat
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* Detail Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="md">
                <Modal.Header closeButton>
                    <Modal.Title><FaStethoscope className="me-2 text-primary" />Detail Konsultasi</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <>
                            <Table borderless size="sm">
                                <tbody>
                                    <tr><td className="text-muted fw-semibold" style={{ width: '40%' }}>Pasien</td><td>{selected.userId?.name}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Telepon</td><td>{selected.userId?.phone || '-'}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Email</td><td>{selected.userId?.email || '-'}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Keluhan</td><td>{selected.symptoms}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Status</td>
                                        <td><Badge bg={statusConfig[selected.status]?.bg}>{statusConfig[selected.status]?.label}</Badge></td></tr>
                                    <tr><td className="text-muted fw-semibold">Dibuat</td>
                                        <td>{new Date(selected.createdAt).toLocaleString('id-ID')}</td></tr>
                                    {selected.startTime && <tr><td className="text-muted fw-semibold">Mulai</td><td>{new Date(selected.startTime).toLocaleString('id-ID')}</td></tr>}
                                    {selected.endTime && <tr><td className="text-muted fw-semibold">Selesai</td><td>{new Date(selected.endTime).toLocaleString('id-ID')}</td></tr>}
                                    <tr><td className="text-muted fw-semibold">Surat Sakit</td>
                                        <td>{selected.sickLetter
                                            ? <Badge bg={selected.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                {selected.sickLetter.status === 'issued' ? `Diterbitkan (${selected.sickLetter.letterNumber})` : 'Draft'}
                                              </Badge>
                                            : '-'}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Pesan</td><td>{selected.messages?.length || 0} pesan</td></tr>
                                </tbody>
                            </Table>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>Tutup</Button>
                    {selected?.status === 'ongoing' && (
                        <Button as={Link} to={`/consultations/${selected._id}`} variant="success">
                            <FaComment className="me-1" /> Buka Chat
                        </Button>
                    )}
                    {(selected?.status === 'ongoing' || selected?.status === 'completed') && !selected?.sickLetter && (
                        <Button as={Link} to="/doctor/sick-letters" variant="warning">
                            <FaFileMedical className="me-1" /> Buat Surat Sakit
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DoctorConsultations;
