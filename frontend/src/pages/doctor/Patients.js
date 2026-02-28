import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Form, InputGroup, Spinner, Modal
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaUsers, FaSearch, FaEye, FaArrowLeft,
    FaUserCircle, FaEnvelope, FaPhone,
    FaComments, FaFileMedical, FaClock
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DoctorPatients = () => {
    const { user, loading: authLoading } = useAuth();
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'doctor') return;
        fetchData();
    }, [authLoading, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Ambil SEMUA konsultasi dokter ini (bukan hanya ongoing)
            const res = await api.get('/api/consultations/doctor/all');
            setConsultations(res.data.consultations || res.data || []);
        } catch {
            // Fallback ke endpoint yang ada
            try {
                const res = await api.get('/api/consultations/doctor/pending');
                setConsultations(res.data.consultations || []);
            } catch {
                toast.error('Gagal memuat data pasien');
            }
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        pending:         { bg: 'secondary', label: 'Menunggu' },
        waiting_payment: { bg: 'warning',   label: 'Menunggu Bayar' },
        paid:            { bg: 'info',      label: 'Sudah Bayar' },
        ongoing:         { bg: 'primary',   label: 'Berlangsung' },
        completed:       { bg: 'success',   label: 'Selesai' },
        cancelled:       { bg: 'danger',    label: 'Dibatalkan' },
    };

    // Deduplikasi pasien unik
    const uniquePatients = consultations.reduce((acc, c) => {
        if (c.userId?._id && !acc.find(p => p._id === c.userId._id)) {
            acc.push({ ...c.userId, consultations: consultations.filter(x => x.userId?._id === c.userId._id) });
        }
        return acc;
    }, []);

    const filteredPatients = uniquePatients.filter(p => {
        const q = search.toLowerCase();
        return !search || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q);
    });

    const filteredConsultations = consultations.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
            c.userId?.name?.toLowerCase().includes(q) ||
            c.symptoms?.toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <Container fluid className="py-4 px-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button as={Link} to="/doctor" variant="link" className="p-0 text-muted mb-1 d-block">
                        <FaArrowLeft className="me-1" /> Dashboard
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaUsers className="me-2 text-primary" /> Pasien Saya
                    </h4>
                </Col>
                <Col xs="auto">
                    <Badge bg="primary" className="fs-6 px-3 py-2">{uniquePatients.length} Pasien Unik</Badge>
                </Col>
            </Row>

            {/* Stats */}
            <Row className="mb-4 g-2">
                {[
                    { label: 'Total Konsultasi', value: consultations.length, bg: 'primary' },
                    { label: 'Berlangsung', value: consultations.filter(c=>c.status==='ongoing').length, bg: 'info' },
                    { label: 'Selesai', value: consultations.filter(c=>c.status==='completed').length, bg: 'success' },
                    { label: 'Pasien Unik', value: uniquePatients.length, bg: 'warning' },
                ].map((s,i) => (
                    <Col key={i} md={3} xs={6}>
                        <Card className={`border-0 bg-${s.bg} text-white shadow-sm`}>
                            <Card.Body className="py-3 text-center">
                                <div className="fs-4 fw-bold">{s.value}</div>
                                <div className="small opacity-75">{s.label}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Filter */}
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
                    <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">Semua Status</option>
                        {Object.entries(statusConfig).map(([k,v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </Form.Select>
                </Col>
                <Col className="d-flex align-items-center justify-content-end">
                    <span className="text-muted small">{filteredConsultations.length} konsultasi</span>
                </Col>
            </Row>

            {/* Tabel */}
            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                    ) : filteredConsultations.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <FaUsers size={40} className="mb-2 opacity-25" />
                            <p className="mb-0">Belum ada data pasien</p>
                            <p className="small">Pasien akan muncul setelah ada konsultasi</p>
                        </div>
                    ) : (
                        <Table hover responsive className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Pasien</th>
                                    <th>Keluhan</th>
                                    <th>Tanggal</th>
                                    <th>Pesan</th>
                                    <th>Surat Sakit</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredConsultations.map(c => (
                                    <tr key={c._id}>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <FaUserCircle size={28} className="text-secondary flex-shrink-0" />
                                                <div>
                                                    <div className="fw-semibold">{c.userId?.name || '-'}</div>
                                                    <div className="text-muted" style={{fontSize:'0.75rem'}}>{c.userId?.phone || c.userId?.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-muted small" style={{maxWidth:180}}>
                                            {c.symptoms?.length > 60 ? c.symptoms.slice(0,60)+'...' : (c.symptoms || '-')}
                                        </td>
                                        <td className="small text-muted">
                                            <FaClock size={11} className="me-1" />
                                            {new Date(c.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="border">
                                                <FaComments size={11} className="me-1" />
                                                {c.messages?.length || 0}
                                            </Badge>
                                        </td>
                                        <td>
                                            {c.sickLetter ? (
                                                <Badge bg={c.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                    <FaFileMedical size={10} className="me-1" />
                                                    {c.sickLetter.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted small">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <Badge bg={statusConfig[c.status]?.bg || 'secondary'}>
                                                {statusConfig[c.status]?.label || c.status}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Button size="sm" variant="outline-primary"
                                                onClick={() => { setSelected(c); setShowModal(true); }}>
                                                <FaEye />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* Modal Detail Konsultasi */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title><FaUserCircle className="me-2 text-primary" />Detail Konsultasi Pasien</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <Row className="g-3">
                            <Col md={6}>
                                <Card className="bg-light border-0 h-100">
                                    <Card.Body>
                                        <h6 className="mb-3 fw-bold"><FaUserCircle className="me-1 text-primary" />Info Pasien</h6>
                                        <p className="mb-1 fw-semibold">{selected.userId?.name}</p>
                                        <p className="mb-1 small text-muted"><FaEnvelope size={11} className="me-1" />{selected.userId?.email}</p>
                                        <p className="mb-0 small text-muted"><FaPhone size={11} className="me-1" />{selected.userId?.phone || '-'}</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={6}>
                                <Card className="bg-light border-0 h-100">
                                    <Card.Body>
                                        <h6 className="mb-3 fw-bold">Status Konsultasi</h6>
                                        <Badge bg={statusConfig[selected.status]?.bg} className="mb-2">
                                            {statusConfig[selected.status]?.label}
                                        </Badge>
                                        <p className="small text-muted mb-1">Dibuat: {new Date(selected.createdAt).toLocaleDateString('id-ID',{dateStyle:'long'})}</p>
                                        <p className="small text-muted mb-0">Jumlah Pesan: {selected.messages?.length || 0}</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={12}>
                                <Card className="bg-light border-0">
                                    <Card.Body>
                                        <Row>
                                            <Col md={6}>
                                                <p className="fw-semibold small text-muted mb-1">Keluhan Pasien</p>
                                                <p>{selected.symptoms || '-'}</p>
                                            </Col>
                                            <Col md={6}>
                                                <p className="fw-semibold small text-muted mb-1">Diagnosis Dokter</p>
                                                <p>{selected.diagnosis || <span className="text-muted">Belum diisi</span>}</p>
                                            </Col>
                                            {selected.prescription && (
                                                <Col md={12}>
                                                    <p className="fw-semibold small text-muted mb-1">Resep</p>
                                                    <p>{selected.prescription}</p>
                                                </Col>
                                            )}
                                            {selected.sickLetter && (
                                                <Col md={12}>
                                                    <p className="fw-semibold small text-muted mb-1">Surat Sakit</p>
                                                    <Badge bg={selected.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                        {selected.sickLetter.status === 'issued' ? '✓ Sudah Diterbitkan' : '⏳ Draft'}
                                                    </Badge>
                                                    {selected.sickLetter.diagnosis && (
                                                        <p className="small text-muted mt-1 mb-0">Diagnosis: {selected.sickLetter.diagnosis}</p>
                                                    )}
                                                </Col>
                                            )}
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>Tutup</Button>
                    {selected?.status === 'ongoing' && (
                        <Button as={Link} to={`/consultations/${selected._id}`} variant="primary">
                            <FaComments className="me-1" /> Buka Chat
                        </Button>
                    )}
                    {selected?.status === 'ongoing' && !selected?.sickLetter && (
                        <Button as={Link} to="/doctor/sick-letters" variant="warning">
                            <FaFileMedical className="me-1" /> Buat Surat Sakit
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DoctorPatients;
