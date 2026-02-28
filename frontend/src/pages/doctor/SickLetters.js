import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Modal, Form, Alert, Spinner, Tabs, Tab
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    FaFileMedical, FaDownload, FaCheckCircle, FaClock,
    FaPlus, FaEye, FaArrowLeft, FaUser, FaStethoscope,
    FaSync
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const DoctorSickLetters = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [ongoingConsultations, setOngoingConsultations] = useState([]);
    const [issuedLetters, setIssuedLetters] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedConsultation, setSelectedConsultation] = useState(null);
    const [form, setForm] = useState({ diagnosis: '', restDays: 3, notes: '' });
    const [saving, setSaving] = useState(false);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedLetter, setSelectedLetter] = useState(null);

    // ✅ FIX: tunggu authLoading selesai dulu
    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'doctor') {
            navigate('/');
            return;
        }
        fetchData();
    }, [authLoading, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // ✅ FIX: Gunakan /doctor/all yang return semua status + sickLetter populated
            const res = await api.get('/api/consultations/doctor/all');
            const all = res.data.consultations || res.data || [];

            // Konsultasi ongoing (bisa buat surat sakit baru)
            setOngoingConsultations(all.filter(c => c.status === 'ongoing'));
            // Semua konsultasi yang punya sickLetter
            setIssuedLetters(all.filter(c => c.sickLetter));
        } catch (err) {
            console.error('SickLetters fetch error:', err);
            toast.error('Gagal memuat data surat sakit');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = (consultation) => {
        setSelectedConsultation(consultation);
        setForm({ diagnosis: '', restDays: 3, notes: '' });
        setShowCreateModal(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.diagnosis.trim()) { toast.error('Diagnosis wajib diisi'); return; }
        setSaving(true);
        try {
            await api.post(`/api/consultations/${selectedConsultation._id}/sick-letter`, form);
            toast.success('Surat sakit berhasil dibuat (draft)');
            setShowCreateModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal membuat surat sakit');
        } finally {
            setSaving(false);
        }
    };

    const handleIssue = async (consultationId) => {
        if (!window.confirm('Terbitkan surat sakit ini? Pasien akan mendapatkan notifikasi.')) return;
        try {
            await api.put(`/api/consultations/${consultationId}/sick-letter/issue`);
            toast.success('Surat sakit berhasil diterbitkan');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menerbitkan surat sakit');
        }
    };

    const handleDownloadPDF = async (consultationId, letterNumber) => {
        try {
            const response = await api.get(`/api/consultations/${consultationId}/sick-letter/pdf`, { responseType: 'blob' });
            // Check if response is error JSON
            if (response.headers['content-type']?.includes('application/json')) {
                toast.error('Surat sakit belum diterbitkan atau tidak ditemukan');
                return;
            }
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `surat-sakit-${letterNumber || consultationId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF berhasil diunduh');
        } catch (err) {
            toast.error('Gagal mengunduh PDF');
        }
    };

    const getStatusBadge = (letter) => {
        if (!letter) return <Badge bg="secondary">Belum Ada</Badge>;
        const map = { draft: ['warning', 'Draft'], issued: ['success', 'Diterbitkan'] };
        const [bg, label] = map[letter.status] || ['secondary', letter.status];
        return <Badge bg={bg}>{label}</Badge>;
    };

    if (authLoading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memeriksa akses...</p>
        </Container>
    );

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data surat sakit...</p>
        </Container>
    );

    return (
        <Container className="py-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button as={Link} to="/doctor" variant="link" className="p-0 text-muted mb-1">
                        <FaArrowLeft className="me-1" /> Dashboard
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaFileMedical className="me-2 text-warning" />
                        Kelola Surat Sakit
                    </h4>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchData}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            {/* Stats */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Konsultasi Aktif', value: ongoingConsultations.length, bg: 'primary' },
                    { label: 'Belum Ada Surat', value: ongoingConsultations.filter(c => !c.sickLetter).length, bg: 'warning' },
                    { label: 'Draft', value: issuedLetters.filter(c => c.sickLetter?.status === 'draft').length, bg: 'info' },
                    { label: 'Diterbitkan', value: issuedLetters.filter(c => c.sickLetter?.status === 'issued').length, bg: 'success' },
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

            <Tabs defaultActiveKey="ongoing" className="mb-3">

                {/* Tab: Konsultasi Aktif */}
                <Tab eventKey="ongoing" title={
                    <span>
                        <FaStethoscope className="me-1" />
                        Konsultasi Aktif
                        {ongoingConsultations.length > 0 && (
                            <Badge bg="primary" className="ms-1">{ongoingConsultations.length}</Badge>
                        )}
                    </span>
                }>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-0">
                            {ongoingConsultations.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <FaFileMedical size={40} className="mb-2 opacity-25" />
                                    <p className="mb-1 fw-semibold">Tidak ada konsultasi aktif saat ini</p>
                                    <p className="small">Konsultasi akan muncul di sini setelah pasien melakukan pembayaran dan diverifikasi</p>
                                </div>
                            ) : (
                                <Table hover responsive className="mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>Pasien</th>
                                            <th>Keluhan</th>
                                            <th>Tanggal</th>
                                            <th>Status Surat</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ongoingConsultations.map(c => (
                                            <tr key={c._id}>
                                                <td>
                                                    <div className="fw-semibold">{c.userId?.name}</div>
                                                    <div className="text-muted small">{c.userId?.phone}</div>
                                                </td>
                                                <td>
                                                    <span className="text-muted small">
                                                        {c.symptoms?.length > 60 ? c.symptoms.slice(0, 60) + '...' : c.symptoms}
                                                    </span>
                                                </td>
                                                <td className="small text-muted">
                                                    {new Date(c.createdAt).toLocaleDateString('id-ID')}
                                                </td>
                                                <td>{getStatusBadge(c.sickLetter)}</td>
                                                <td>
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        {!c.sickLetter && (
                                                            <Button variant="primary" size="sm" onClick={() => openCreateModal(c)}>
                                                                <FaPlus className="me-1" /> Buat
                                                            </Button>
                                                        )}
                                                        {c.sickLetter?.status === 'draft' && (
                                                            <>
                                                                <Button variant="success" size="sm" onClick={() => handleIssue(c._id)}>
                                                                    <FaCheckCircle className="me-1" /> Terbitkan
                                                                </Button>
                                                                <Button variant="outline-secondary" size="sm"
                                                                    onClick={() => { setSelectedLetter(c.sickLetter); setShowDetailModal(true); }}>
                                                                    <FaEye />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {c.sickLetter?.status === 'issued' && (
                                                            <Button variant="outline-info" size="sm"
                                                                onClick={() => handleDownloadPDF(c._id, c.sickLetter.letterNumber)}>
                                                                <FaDownload className="me-1" /> PDF
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
                </Tab>

                {/* Tab: Semua Surat */}
                <Tab eventKey="issued" title={
                    <span>
                        <FaCheckCircle className="me-1" />
                        Semua Surat Sakit
                        {issuedLetters.length > 0 && (
                            <Badge bg="success" className="ms-1">{issuedLetters.length}</Badge>
                        )}
                    </span>
                }>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-0">
                            {issuedLetters.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <FaFileMedical size={40} className="mb-2 opacity-25" />
                                    <p className="mb-0">Belum ada surat sakit yang dibuat</p>
                                </div>
                            ) : (
                                <Table hover responsive className="mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>No. Surat</th>
                                            <th>Pasien</th>
                                            <th>Diagnosis</th>
                                            <th>Periode Istirahat</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issuedLetters.map(c => (
                                            <tr key={c._id}>
                                                <td><code className="small">{c.sickLetter?.letterNumber || '-'}</code></td>
                                                <td>
                                                    <div className="fw-semibold">{c.userId?.name}</div>
                                                    <div className="text-muted small">{c.userId?.phone}</div>
                                                </td>
                                                <td className="small">{c.sickLetter?.diagnosis}</td>
                                                <td className="small">
                                                    {c.sickLetter?.startDate && new Date(c.sickLetter.startDate).toLocaleDateString('id-ID')}
                                                    {' – '}
                                                    {c.sickLetter?.endDate && new Date(c.sickLetter.endDate).toLocaleDateString('id-ID')}
                                                </td>
                                                <td>{getStatusBadge(c.sickLetter)}</td>
                                                <td>
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        <Button variant="outline-primary" size="sm"
                                                            onClick={() => { setSelectedLetter(c.sickLetter); setShowDetailModal(true); }}>
                                                            <FaEye />
                                                        </Button>
                                                        {c.sickLetter?.status === 'draft' && (
                                                            <Button variant="success" size="sm" onClick={() => handleIssue(c._id)}>
                                                                <FaCheckCircle className="me-1" /> Terbitkan
                                                            </Button>
                                                        )}
                                                        {c.sickLetter?.status === 'issued' && (
                                                            <Button variant="outline-info" size="sm"
                                                                onClick={() => handleDownloadPDF(c._id, c.sickLetter.letterNumber)}>
                                                                <FaDownload />
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
                </Tab>
            </Tabs>

            {/* Modal Buat Surat */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="md" backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaFileMedical className="me-2 text-warning" />
                        Buat Surat Sakit
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreate}>
                    <Modal.Body>
                        {selectedConsultation && (
                            <Alert variant="light" className="border mb-3">
                                <div className="fw-semibold">
                                    <FaUser className="me-1 text-primary" />
                                    {selectedConsultation.userId?.name}
                                </div>
                                <div className="text-muted small mt-1">
                                    Keluhan: {selectedConsultation.symptoms}
                                </div>
                            </Alert>
                        )}
                        <Row className="g-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">
                                        Diagnosis <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea" rows={2}
                                        value={form.diagnosis}
                                        onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                                        placeholder="Contoh: Infeksi Saluran Pernapasan Atas (ISPA)"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">
                                        Lama Istirahat (hari) <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        type="number" min={1} max={30}
                                        value={form.restDays}
                                        onChange={e => setForm(f => ({ ...f, restDays: e.target.value }))}
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Mulai hari ini, {form.restDays} hari ke depan
                                    </Form.Text>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Catatan Tambahan</Form.Label>
                                    <Form.Control
                                        as="textarea" rows={2}
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Rekomendasi obat, pantangan, dll (opsional)"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Alert variant="info" className="mt-3 small mb-0">
                            Surat disimpan sebagai <strong>draft</strong>. Klik <strong>Terbitkan</strong> agar pasien bisa unduh PDF.
                        </Alert>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Batal</Button>
                        <Button type="submit" variant="warning" disabled={saving}>
                            {saving ? <><Spinner size="sm" className="me-1" />Menyimpan...</> : (
                                <><FaFileMedical className="me-1" />Simpan Draft</>
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal Detail */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title><FaFileMedical className="me-2" />Detail Surat Sakit</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedLetter && (
                        <Table borderless size="sm">
                            <tbody>
                                <tr><td className="text-muted fw-semibold" style={{ width: '40%' }}>No. Surat</td><td>{selectedLetter.letterNumber || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Diagnosis</td><td>{selectedLetter.diagnosis}</td></tr>
                                <tr><td className="text-muted fw-semibold">Mulai</td><td>{selectedLetter.startDate && new Date(selectedLetter.startDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}</td></tr>
                                <tr><td className="text-muted fw-semibold">Sampai</td><td>{selectedLetter.endDate && new Date(selectedLetter.endDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}</td></tr>
                                <tr><td className="text-muted fw-semibold">Catatan</td><td>{selectedLetter.notes || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Status</td><td>{getStatusBadge(selectedLetter)}</td></tr>
                                {selectedLetter.issuedAt && (
                                    <tr><td className="text-muted fw-semibold">Diterbitkan</td><td>{new Date(selectedLetter.issuedAt).toLocaleDateString('id-ID')}</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DoctorSickLetters;
