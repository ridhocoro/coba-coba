import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    InputGroup, Form, Modal, Spinner, Alert
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaStethoscope, FaSearch, FaFilter, FaArrowLeft,
    FaEye, FaDownload, FaCheckCircle, FaTimesCircle,
    FaSync, FaCommentDots
} from 'react-icons/fa';

const ManageConsultations = () => {
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState('');
    const [selected, setSelected] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => { fetchConsultations(); }, []);

    const fetchConsultations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/consultations');
            setConsultations(res.data || []);
        } catch {
            toast.error('Gagal memuat data konsultasi');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!selected) return;
        setProcessing(true);
        try {
            if (actionType === 'end') {
                await api.put(`/api/admin/consultations/${selected._id}/end`);
                toast.success('Konsultasi diselesaikan');
            } else if (actionType === 'cancel') {
                await api.put(`/api/admin/consultations/${selected._id}/cancel`);
                toast.success('Konsultasi dibatalkan');
            }
            setShowActionModal(false);
            setShowDetailModal(false);
            fetchConsultations();
        } catch {
            toast.error('Gagal memproses tindakan');
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadPDF = async (c) => {
        try {
            const res = await api.get(`/api/consultations/${c._id}/sick-letter/pdf`, { responseType: 'blob' });
            // Pastikan response adalah PDF bukan error JSON
            if (res.headers['content-type']?.includes('application/json')) {
                toast.error('Surat sakit tidak ditemukan atau belum diterbitkan');
                return;
            }
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `surat-sakit-${c._id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PDF diunduh');
        } catch {
            toast.error('Gagal mengunduh PDF');
        }
    };

    const getStatusBadge = (status) => {
        const map = {
            pending: ['secondary', 'Pending'],
            waiting_payment: ['warning', 'Menunggu Bayar'],
            paid: ['info', 'Dibayar'],
            ongoing: ['primary', 'Berlangsung'],
            completed: ['success', 'Selesai'],
            cancelled: ['danger', 'Dibatalkan'],
        };
        const [bg, label] = map[status] || ['secondary', status];
        return <Badge bg={bg}>{label}</Badge>;
    };

    const filtered = consultations.filter(c => {
        const matchSearch = !search ||
            c.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.doctorId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.symptoms?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const stats = {
        total: consultations.length,
        ongoing: consultations.filter(c => c.status === 'ongoing').length,
        completed: consultations.filter(c => c.status === 'completed').length,
        waiting: consultations.filter(c => c.status === 'waiting_payment' || c.status === 'paid').length,
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data konsultasi...</p>
        </Container>
    );

    return (
        <Container fluid className="py-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button as={Link} to="/admin" variant="link" className="p-0 text-muted mb-1">
                        <FaArrowLeft className="me-1" /> Dashboard Admin
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaStethoscope className="me-2 text-primary" />
                        Kelola Konsultasi
                    </h4>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchConsultations}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            <Row className="mb-4 g-3">
                {[
                    { label: 'Total', value: stats.total, bg: 'primary' },
                    { label: 'Berlangsung', value: stats.ongoing, bg: 'info' },
                    { label: 'Menunggu Bayar', value: stats.waiting, bg: 'warning' },
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
                            placeholder="Cari pasien, dokter, keluhan..."
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
                            <option value="pending">Pending</option>
                            <option value="waiting_payment">Menunggu Bayar</option>
                            <option value="paid">Dibayar</option>
                            <option value="ongoing">Berlangsung</option>
                            <option value="completed">Selesai</option>
                            <option value="cancelled">Dibatalkan</option>
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
                                <th>Dokter</th>
                                <th>Keluhan</th>
                                <th>Status</th>
                                <th>Surat Sakit</th>
                                <th>Tanggal</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-4 text-muted">Tidak ada data</td></tr>
                            ) : filtered.map(c => (
                                <tr key={c._id}>
                                    <td>
                                        <div className="fw-semibold small">{c.userId?.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{c.userId?.email}</div>
                                    </td>
                                    <td className="small">dr. {c.doctorId?.name}<br />
                                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>{c.doctorId?.specialization}</span>
                                    </td>
                                    <td className="small text-muted" style={{ maxWidth: 130 }}>
                                        {c.symptoms?.length > 40 ? c.symptoms.slice(0, 40) + '...' : c.symptoms}
                                    </td>
                                    <td>{getStatusBadge(c.status)}</td>
                                    <td>
                                        {c.sickLetter
                                            ? <Badge bg={c.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                {c.sickLetter.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                                              </Badge>
                                            : <span className="text-muted small">-</span>
                                        }
                                    </td>
                                    <td className="small text-muted">
                                        {new Date(c.createdAt).toLocaleDateString('id-ID')}
                                    </td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">
                                            <Button variant="outline-primary" size="sm"
                                                onClick={() => { setSelected(c); setShowDetailModal(true); }}>
                                                <FaEye />
                                            </Button>
                                            {c.sickLetter?.status === 'issued' && (
                                                <Button variant="outline-success" size="sm"
                                                    onClick={() => handleDownloadPDF(c)}>
                                                    <FaDownload />
                                                </Button>
                                            )}
                                            {c.status === 'ongoing' && (
                                                <Button variant="success" size="sm"
                                                    title="Selesaikan konsultasi"
                                                    onClick={() => { setSelected(c); setActionType('end'); setShowActionModal(true); }}>
                                                    <FaCheckCircle />
                                                </Button>
                                            )}
                                            {['pending', 'waiting_payment', 'paid', 'ongoing'].includes(c.status) && (
                                                <Button variant="danger" size="sm"
                                                    title="Batalkan konsultasi"
                                                    onClick={() => { setSelected(c); setActionType('cancel'); setShowActionModal(true); }}>
                                                    <FaTimesCircle />
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
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="md">
                <Modal.Header closeButton>
                    <Modal.Title><FaCommentDots className="me-2 text-primary" />Detail Konsultasi</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <>
                            <Table borderless size="sm">
                                <tbody>
                                    <tr><td className="text-muted fw-semibold" style={{ width: '40%' }}>Pasien</td><td>{selected.userId?.name}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Email</td><td>{selected.userId?.email}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Dokter</td><td>dr. {selected.doctorId?.name}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Spesialis</td><td>{selected.doctorId?.specialization}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Keluhan</td><td>{selected.symptoms}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Status</td><td>{getStatusBadge(selected.status)}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Mulai</td><td>{selected.startTime ? new Date(selected.startTime).toLocaleString('id-ID') : '-'}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Selesai</td><td>{selected.endTime ? new Date(selected.endTime).toLocaleString('id-ID') : '-'}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Surat Sakit</td>
                                        <td>{selected.sickLetter
                                            ? <Badge bg={selected.sickLetter.status === 'issued' ? 'success' : 'warning'}>
                                                {selected.sickLetter.status === 'issued' ? 'Diterbitkan' : 'Draft'}
                                              </Badge>
                                            : '-'}
                                        </td>
                                    </tr>
                                    <tr><td className="text-muted fw-semibold">Tgl Dibuat</td><td>{new Date(selected.createdAt).toLocaleString('id-ID')}</td></tr>
                                    <tr><td className="text-muted fw-semibold">Pesan</td><td>{selected.messages?.length || 0} pesan</td></tr>
                                </tbody>
                            </Table>
                            {selected.status === 'ongoing' && (
                                <Alert variant="info" className="small mt-2">
                                    Konsultasi sedang berlangsung. Admin dapat memaksa menyelesaikannya jika diperlukan.
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                    {selected?.sickLetter?.status === 'issued' && (
                        <Button variant="outline-success" onClick={() => handleDownloadPDF(selected)}>
                            <FaDownload className="me-1" /> Unduh PDF
                        </Button>
                    )}
                    {selected?.status === 'ongoing' && (
                        <Button variant="success" onClick={() => { setActionType('end'); setShowActionModal(true); setShowDetailModal(false); }}>
                            <FaCheckCircle className="me-1" /> Selesaikan
                        </Button>
                    )}
                    {['pending', 'waiting_payment', 'paid', 'ongoing'].includes(selected?.status) && (
                        <Button variant="danger" onClick={() => { setActionType('cancel'); setShowActionModal(true); setShowDetailModal(false); }}>
                            <FaTimesCircle className="me-1" /> Batalkan
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Confirmation Modal */}
            <Modal show={showActionModal} onHide={() => setShowActionModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {actionType === 'end'
                            ? <><FaCheckCircle className="me-2 text-success" />Selesaikan Konsultasi</>
                            : <><FaTimesCircle className="me-2 text-danger" />Batalkan Konsultasi</>}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        Apakah Anda yakin ingin <strong>{actionType === 'end' ? 'menyelesaikan' : 'membatalkan'}</strong> konsultasi milik{' '}
                        <strong>{selected?.userId?.name}</strong> dengan <strong>dr. {selected?.doctorId?.name}</strong>?
                    </p>
                    {actionType === 'cancel' && (
                        <Alert variant="warning" className="small">
                            Pembatalan akan mengubah status konsultasi menjadi "Dibatalkan". Tindakan ini tidak dapat dibatalkan.
                        </Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowActionModal(false)}>Tidak</Button>
                    <Button
                        variant={actionType === 'end' ? 'success' : 'danger'}
                        disabled={processing}
                        onClick={handleAction}
                    >
                        {processing ? 'Memproses...' : 'Ya, Lanjutkan'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ManageConsultations;
