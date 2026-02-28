import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    InputGroup, Form, Modal, Spinner, Alert
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaCalendarAlt, FaSearch, FaFilter, FaArrowLeft,
    FaEye, FaCheckCircle, FaTimesCircle,
    FaUser, FaUserMd, FaClock, FaSync
} from 'react-icons/fa';

/* ─────────────────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
    pending:   { bg: 'warning',   label: 'Menunggu'     },
    confirmed: { bg: 'success',   label: 'Dikonfirmasi' },
    completed: { bg: 'info',      label: 'Selesai'      },
    rejected:  { bg: 'danger',    label: 'Ditolak'      },
    cancelled: { bg: 'secondary', label: 'Dibatalkan'   },
};

/* ─────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────── */
const ManageAppointments = () => {

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [processingId, setProcessingId] = useState(null);

    // Filter
    const [search, setSearch]             = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Modals
    const [selected, setSelected]               = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason]       = useState('');

    /* ─────────────────────────────────────────────────────
       FETCH  — useCallback agar stabil di dependency array
    ───────────────────────────────────────────────────── */
    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/appointments');
            setAppointments(res.data || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal memuat data janji temu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    /* ─────────────────────────────────────────────────────
       MODAL HELPERS
    ───────────────────────────────────────────────────── */
    const resetModals = useCallback(() => {
        setShowDetailModal(false);
        setShowCancelModal(false);
        setCancelReason('');
        setSelected(null);
    }, []);

    const openDetail = useCallback((apt) => {
        setSelected(apt);
        setShowDetailModal(true);
    }, []);

    const openCancel = useCallback((apt) => {
        setSelected(apt);
        setCancelReason('');
        setShowCancelModal(true);
        setShowDetailModal(false);
    }, []);

    /* ─────────────────────────────────────────────────────
       ACTIONS
    ───────────────────────────────────────────────────── */

    // Konfirmasi — optimistic update langsung tanpa full refetch
    const handleConfirm = useCallback(async (id) => {
        if (!window.confirm('Konfirmasi janji temu ini?')) return;
        setProcessingId(id);
        try {
            await api.put(`/api/admin/appointments/${id}/confirm`);

            setAppointments(prev =>
                prev.map(a => a._id === id ? { ...a, status: 'confirmed' } : a)
            );
            // Sync jika modal detail sedang terbuka
            setSelected(prev =>
                prev?._id === id ? { ...prev, status: 'confirmed' } : prev
            );

            toast.success('Janji temu berhasil dikonfirmasi');
            setShowDetailModal(false);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal mengkonfirmasi janji temu');
        } finally {
            setProcessingId(null);
        }
    }, []);

    // Batalkan — optimistic update + reason
    const handleCancel = useCallback(async () => {
        if (!selected) return;
        setProcessingId(selected._id);
        try {
            await api.put(
                `/api/admin/appointments/${selected._id}/cancel`,
                { reason: cancelReason }
            );

            setAppointments(prev =>
                prev.map(a =>
                    a._id === selected._id
                        ? { ...a, status: 'cancelled', rejectionReason: cancelReason }
                        : a
                )
            );

            toast.success('Janji temu berhasil dibatalkan');
            resetModals();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal membatalkan janji temu');
        } finally {
            setProcessingId(null);
        }
    }, [selected, cancelReason, resetModals]);

    /* ─────────────────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────────────────── */
    const getStatusBadge = (status) => {
        const cfg = STATUS_CONFIG[status] || { bg: 'secondary', label: status };
        return <Badge bg={cfg.bg}>{cfg.label}</Badge>;
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    /* ─────────────────────────────────────────────────────
       DERIVED STATE — useMemo, tidak re-compute tiap render
    ───────────────────────────────────────────────────── */
    const filteredAppointments = useMemo(() => {
        const q = search.toLowerCase();
        return appointments.filter(a => {
            const matchSearch =
                !search ||
                a.userId?.name?.toLowerCase().includes(q) ||
                a.doctorId?.name?.toLowerCase().includes(q) ||
                a.complaint?.toLowerCase().includes(q);
            const matchStatus =
                filterStatus === 'all' || a.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [appointments, search, filterStatus]);

    const stats = useMemo(() => ({
        total:     appointments.length,
        pending:   appointments.filter(a => a.status === 'pending').length,
        confirmed: appointments.filter(a => a.status === 'confirmed').length,
        completed: appointments.filter(a => a.status === 'completed').length,
    }), [appointments]);

    /* ─────────────────────────────────────────────────────
       LOADING STATE
    ───────────────────────────────────────────────────── */
    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data janji temu...</p>
        </Container>
    );

    /* ─────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────── */
    return (
        <Container fluid className="py-4 px-4">

            {/* ── HEADER ── */}
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button
                        as={Link} to="/admin"
                        variant="link" className="p-0 text-muted mb-1 d-block"
                    >
                        <FaArrowLeft className="me-1" /> Dashboard Admin
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaCalendarAlt className="me-2 text-primary" />
                        Kelola Janji Temu
                    </h4>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchAppointments}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            {/* ── STATS ── */}
            <Row className="mb-4 g-3">
                {[
                    { label: 'Total',        value: stats.total,     bg: 'primary' },
                    { label: 'Menunggu',     value: stats.pending,   bg: 'warning' },
                    { label: 'Dikonfirmasi', value: stats.confirmed, bg: 'success' },
                    { label: 'Selesai',      value: stats.completed, bg: 'info'    },
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

            {/* ── FILTER ── */}
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
                        <Form.Select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </Form.Select>
                    </InputGroup>
                </Col>
                <Col className="d-flex align-items-center">
                    <span className="text-muted small">
                        {filteredAppointments.length} janji temu
                    </span>
                </Col>
            </Row>

            {/* ── TABLE ── */}
            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>No. Antrian</th>
                                <th>Pasien</th>
                                <th>Dokter</th>
                                <th>Tanggal & Waktu</th>
                                <th>Keluhan</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <FaCalendarAlt size={36} className="mb-2 opacity-25 d-block mx-auto" />
                                        Tidak ada data janji temu
                                    </td>
                                </tr>
                            ) : filteredAppointments.map(a => (
                                <tr key={a._id}>
                                    <td>
                                        <Badge bg="primary">#{a.queueNumber || '-'}</Badge>
                                    </td>
                                    <td>
                                        <div className="fw-semibold small">{a.userId?.name || '-'}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                            {a.userId?.phone || a.userId?.email}
                                        </div>
                                    </td>
                                    <td className="small">
                                        <div>
                                            <FaUserMd className="text-primary me-1" />
                                            dr. {a.doctorId?.name || '-'}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                            {a.doctorId?.specialization}
                                        </div>
                                    </td>
                                    <td className="small">
                                        <div>{formatDate(a.appointmentDate)}</div>
                                        <div className="text-muted">
                                            <FaClock size={10} className="me-1" />
                                            {a.appointmentTime || '-'}
                                        </div>
                                    </td>
                                    <td className="small text-muted" style={{ maxWidth: 140 }}>
                                        {a.complaint?.length > 45
                                            ? a.complaint.slice(0, 45) + '...'
                                            : (a.complaint || '-')}
                                    </td>
                                    <td>{getStatusBadge(a.status)}</td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">

                                            {/* Detail */}
                                            <Button
                                                variant="outline-primary" size="sm"
                                                title="Lihat Detail"
                                                onClick={() => openDetail(a)}
                                            >
                                                <FaEye />
                                            </Button>

                                            {/* Konfirmasi — hanya pending */}
                                            {a.status === 'pending' && (
                                                <Button
                                                    variant="success" size="sm"
                                                    title="Konfirmasi"
                                                    disabled={processingId === a._id}
                                                    onClick={() => handleConfirm(a._id)}
                                                >
                                                    {processingId === a._id
                                                        ? <Spinner size="sm" animation="border" />
                                                        : <FaCheckCircle />}
                                                </Button>
                                            )}

                                            {/* Batalkan — pending atau confirmed */}
                                            {['pending', 'confirmed'].includes(a.status) && (
                                                <Button
                                                    variant="danger" size="sm"
                                                    title="Batalkan"
                                                    disabled={processingId === a._id}
                                                    onClick={() => openCancel(a)}
                                                >
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

            {/* ══════════════════════════════════════════════
                DETAIL MODAL
            ══════════════════════════════════════════════ */}
            <Modal show={showDetailModal} onHide={resetModals} size="md">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaCalendarAlt className="me-2 text-primary" />
                        Detail Janji Temu
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <>
                            {/* Card pasien + dokter (dari kode 5) */}
                            <Row className="g-3 mb-3">
                                <Col md={6}>
                                    <Card className="bg-light border-0 h-100">
                                        <Card.Body className="py-3">
                                            <div className="text-muted small fw-semibold mb-2">
                                                <FaUser className="me-1" /> PASIEN
                                            </div>
                                            <div className="fw-semibold">{selected.userId?.name}</div>
                                            <div className="text-muted small">{selected.userId?.email}</div>
                                            <div className="text-muted small">{selected.userId?.phone || '-'}</div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card className="bg-light border-0 h-100">
                                        <Card.Body className="py-3">
                                            <div className="text-muted small fw-semibold mb-2">
                                                <FaUserMd className="me-1" /> DOKTER
                                            </div>
                                            <div className="fw-semibold">dr. {selected.doctorId?.name}</div>
                                            <div className="text-muted small">{selected.doctorId?.specialization}</div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            {/* Tabel detail */}
                            <Table borderless size="sm">
                                <tbody>
                                    <tr>
                                        <td className="text-muted fw-semibold" style={{ width: '40%' }}>No. Antrian</td>
                                        <td><Badge bg="primary">#{selected.queueNumber || '-'}</Badge></td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Tanggal</td>
                                        <td>{formatDate(selected.appointmentDate)}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Waktu</td>
                                        <td>{selected.appointmentTime || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Keluhan</td>
                                        <td>{selected.complaint || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted fw-semibold">Status</td>
                                        <td>{getStatusBadge(selected.status)}</td>
                                    </tr>
                                    {selected.rejectionReason && (
                                        <tr>
                                            <td className="text-muted fw-semibold">Alasan Batal</td>
                                            <td className="text-danger">{selected.rejectionReason}</td>
                                        </tr>
                                    )}
                                    {selected.doctorNotes && (
                                        <tr>
                                            <td className="text-muted fw-semibold">Catatan Dokter</td>
                                            <td>{selected.doctorNotes}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>

                            {selected.status === 'pending' && (
                                <Alert variant="warning" className="small mt-2 mb-0">
                                    Janji temu ini belum dikonfirmasi. Anda dapat mengkonfirmasi atau membatalkannya.
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={resetModals}>Tutup</Button>

                    {selected?.status === 'pending' && (
                        <>
                            <Button variant="danger" onClick={() => openCancel(selected)}>
                                <FaTimesCircle className="me-1" /> Batalkan
                            </Button>
                            <Button
                                variant="success"
                                disabled={processingId === selected._id}
                                onClick={() => handleConfirm(selected._id)}
                            >
                                {processingId === selected._id
                                    ? <Spinner size="sm" animation="border" />
                                    : <><FaCheckCircle className="me-1" /> Konfirmasi</>}
                            </Button>
                        </>
                    )}

                    {selected?.status === 'confirmed' && (
                        <Button variant="danger" onClick={() => openCancel(selected)}>
                            <FaTimesCircle className="me-1" /> Batalkan
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* ══════════════════════════════════════════════
                CANCEL MODAL
            ══════════════════════════════════════════════ */}
            <Modal show={showCancelModal} onHide={resetModals}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaTimesCircle className="me-2 text-danger" />
                        Batalkan Janji Temu
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="mb-3">
                        Batalkan janji temu <strong>{selected?.userId?.name}</strong>{' '}
                        dengan <strong>dr. {selected?.doctorId?.name}</strong>?
                    </p>
                    <Form.Group>
                        <Form.Label>
                            Alasan Pembatalan{' '}
                            <span className="text-muted small">(opsional)</span>
                        </Form.Label>
                        <Form.Control
                            as="textarea" rows={3}
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            placeholder="Contoh: Dokter berhalangan, jadwal penuh, dll."
                        />
                    </Form.Group>
                    <Alert variant="warning" className="small mt-3 mb-0">
                        Tindakan ini tidak dapat dibatalkan.
                    </Alert>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={resetModals}>Tidak</Button>
                    <Button
                        variant="danger"
                        disabled={processingId === selected?._id}
                        onClick={handleCancel}
                    >
                        {processingId === selected?._id
                            ? <><Spinner size="sm" animation="border" className="me-1" /> Memproses...</>
                            : 'Ya, Batalkan'}
                    </Button>
                </Modal.Footer>
            </Modal>

        </Container>
    );
};

export default ManageAppointments;