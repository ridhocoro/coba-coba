import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Modal, Form, Spinner, Alert, InputGroup, Tabs, Tab
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaUserMd, FaPlus, FaEdit, FaToggleOn, FaToggleOff,
    FaArrowLeft, FaExclamationTriangle, FaLink,
    FaSearch, FaSync, FaCalendarAlt, FaTrash
} from 'react-icons/fa';

const defaultForm = {
    name: '', specialization: '', consultationFee: '', qualification: '',
    experience: '', bio: '', email: '', password: '', phone: ''
};

const ManageDoctors = () => {
    const [doctors, setDoctors] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState(false);

    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [form, setForm] = useState(defaultForm);

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkDoctor, setLinkDoctor] = useState(null);
    const [linkUserId, setLinkUserId] = useState('');

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleDoctor, setScheduleDoctor] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [doctorRes, userRes] = await Promise.allSettled([
                api.get('/api/admin/doctors'),
                api.get('/api/admin/users')
            ]);
            if (doctorRes.status === 'fulfilled') {
                setDoctors(doctorRes.value.data.doctors || doctorRes.value.data || []);
            }
            if (userRes.status === 'fulfilled') {
                // Ambil users role doctor yang belum punya doctor record
                const allUsers = userRes.value.data || [];
                setUsers(allUsers.filter(u => u.role === 'doctor'));
            }
        } catch {
            toast.error('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (editingDoctor) {
                await api.put(`/api/admin/doctors/${editingDoctor._id}`, form);
                toast.success('Data dokter diperbarui');
            } else {
                // Buat dokter baru (admin.js akan buat User + Doctor sekaligus)
                await api.post('/api/admin/doctors', form);
                toast.success('Dokter berhasil ditambahkan');
            }
            setShowDoctorModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal menyimpan');
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleOnline = async (doctor) => {
        try {
            await api.put(`/api/doctors/${doctor._id}/online-status`, { isOnline: !doctor.isOnline });
            toast.success(`Status dokter: ${!doctor.isOnline ? 'Online' : 'Offline'}`);
            fetchData();
        } catch {
            toast.error('Gagal mengubah status online');
        }
    };

    const handleToggle = async (doctor) => {
        try {
            await api.put(`/api/admin/doctors/${doctor._id}/toggle-status`);
            toast.success(`Dokter ${doctor.isActive ? 'dinonaktifkan' : 'diaktifkan'}`);
            fetchData();
        } catch {
            toast.error('Gagal mengubah status');
        }
    };

    const handleDelete = async (doctor) => {
        if (!window.confirm(`Hapus dokter ${doctor.name}? Data tidak dapat dikembalikan.`)) return;
        try {
            await api.delete(`/api/admin/doctors/${doctor._id}`);
            toast.success('Dokter dihapus');
            fetchData();
        } catch {
            toast.error('Gagal menghapus dokter');
        }
    };

    const handleLinkUser = async () => {
        if (!linkUserId) { toast.error('Pilih user terlebih dahulu'); return; }
        setProcessing(true);
        try {
            await api.post('/api/doctors/admin/link-user', {
                doctorId: linkDoctor._id,
                userId: linkUserId
            });
            toast.success('Dokter berhasil dihubungkan ke user!');
            setShowLinkModal(false);
            setLinkUserId('');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menghubungkan');
        } finally {
            setProcessing(false);
        }
    };

    const openEdit = (doctor) => {
        setEditingDoctor(doctor);
        setForm({
            name: doctor.name || '',
            specialization: doctor.specialization || '',
            consultationFee: doctor.consultationFee || '',
            qualification: doctor.qualification || '',
            experience: doctor.experience || '',
            bio: doctor.bio || '',
            email: '', password: '', phone: ''
        });
        setShowDoctorModal(true);
    };

    const openAdd = () => {
        setEditingDoctor(null);
        setForm(defaultForm);
        setShowDoctorModal(true);
    };

    const filtered = doctors.filter(d =>
        !search ||
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization?.toLowerCase().includes(search.toLowerCase())
    );

    const unlinkedDoctors = doctors.filter(d => !d.userId);

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data dokter...</p>
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
                        <FaUserMd className="me-2 text-primary" />
                        Kelola Dokter
                    </h4>
                </Col>
                <Col xs="auto" className="d-flex gap-2">
                    <Button variant="outline-secondary" size="sm" onClick={fetchData}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                    <Button variant="primary" onClick={openAdd}>
                        <FaPlus className="me-1" /> Tambah Dokter
                    </Button>
                </Col>
            </Row>

            {/* Warning dokter belum terhubung */}
            {unlinkedDoctors.length > 0 && (
                <Alert variant="warning" className="d-flex align-items-center gap-2 mb-3">
                    <FaExclamationTriangle />
                    <span>
                        <strong>{unlinkedDoctors.length} dokter</strong> belum terhubung ke akun user.
                        Dokter tersebut tidak bisa login! Klik tombol <strong>Hubungkan</strong> untuk memperbaiki.
                    </span>
                </Alert>
            )}

            <Row className="mb-3 g-2">
                <Col md={5}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            placeholder="Cari nama atau spesialisasi..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col className="d-flex align-items-center">
                    <span className="text-muted small">{filtered.length} dokter</span>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Nama</th>
                                <th>Spesialisasi</th>
                                <th>Biaya</th>
                                <th>Akun User</th>
                                <th>Jadwal</th>
                                <th>Status</th>
                                <th>Online</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-4 text-muted">Tidak ada dokter</td></tr>
                            ) : filtered.map(d => (
                                <tr key={d._id}>
                                    <td>
                                        <div className="fw-semibold">dr. {d.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{d.qualification}</div>
                                    </td>
                                    <td className="small">{d.specialization}</td>
                                    <td className="small">Rp {Number(d.consultationFee || 0).toLocaleString('id-ID')}</td>
                                    <td>
                                        {d.userId
                                            ? <Badge bg="success">✓ Terhubung</Badge>
                                            : <Badge bg="danger">✗ Belum terhubung</Badge>
                                        }
                                    </td>
                                    <td className="small text-muted">
                                        {d.availableDays?.length > 0
                                            ? `${d.availableDays.length} hari`
                                            : <span className="text-warning">Belum diset</span>}
                                    </td>
                                    <td>
                                        <Badge bg={d.isActive ? 'success' : 'secondary'}>
                                            {d.isActive ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </td>
                                    <td>
                                        <Button
                                            variant={d.isOnline ? 'success' : 'outline-secondary'}
                                            size="sm"
                                            title={d.isOnline ? 'Klik untuk set Offline' : 'Klik untuk set Online'}
                                            onClick={() => handleToggleOnline(d)}
                                        >
                                            {d.isOnline ? '🟢 Online' : '⚫ Offline'}
                                        </Button>
                                    </td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">
                                            <Button variant="outline-primary" size="sm" title="Edit" onClick={() => openEdit(d)}>
                                                <FaEdit />
                                            </Button>
                                            {!d.userId && (
                                                <Button variant="warning" size="sm" title="Hubungkan ke User"
                                                    onClick={() => { setLinkDoctor(d); setLinkUserId(''); setShowLinkModal(true); }}>
                                                    <FaLink />
                                                </Button>
                                            )}
                                            <Button
                                                variant={d.isActive ? 'outline-danger' : 'outline-success'}
                                                size="sm"
                                                title={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                onClick={() => handleToggle(d)}>
                                                {d.isActive ? <FaToggleOff /> : <FaToggleOn />}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* Modal Tambah/Edit Dokter */}
            <Modal show={showDoctorModal} onHide={() => setShowDoctorModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaUserMd className="me-2 text-primary" />
                        {editingDoctor ? `Edit dr. ${editingDoctor.name}` : 'Tambah Dokter Baru'}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSave}>
                    <Modal.Body>
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Nama Dokter <span className="text-danger">*</span></Form.Label>
                                    <Form.Control value={form.name} required
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Contoh: Ahmad Fauzi" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Spesialisasi <span className="text-danger">*</span></Form.Label>
                                    <Form.Control value={form.specialization} required
                                        onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
                                        placeholder="Contoh: Umum, Anak, THT" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Biaya Konsultasi (Rp) <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="number" min="0" value={form.consultationFee} required
                                        onChange={e => setForm(p => ({ ...p, consultationFee: e.target.value }))} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Kualifikasi</Form.Label>
                                    <Form.Control value={form.qualification}
                                        onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))}
                                        placeholder="Contoh: dr., Sp.A, M.Kes" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Pengalaman (tahun)</Form.Label>
                                    <Form.Control type="number" min="0" value={form.experience}
                                        onChange={e => setForm(p => ({ ...p, experience: e.target.value }))} />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Bio / Deskripsi</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={form.bio}
                                        onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                                        placeholder="Deskripsi singkat dokter..." />
                                </Form.Group>
                            </Col>

                            {/* Akun Login - hanya untuk tambah baru */}
                            {!editingDoctor && (
                                <>
                                    <Col md={12}><hr className="my-1" /><p className="fw-semibold small text-primary mb-0">Akun Login Dokter</p></Col>
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">Email <span className="text-danger">*</span></Form.Label>
                                            <Form.Control type="email" value={form.email} required
                                                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                placeholder="email@klinik.com" />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">Password <span className="text-danger">*</span></Form.Label>
                                            <Form.Control type="password" value={form.password} required minLength={6}
                                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                                placeholder="Min. 6 karakter" />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="fw-semibold small">No. Telepon</Form.Label>
                                            <Form.Control value={form.phone}
                                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                                placeholder="08xxxxxxxxxx" />
                                        </Form.Group>
                                    </Col>
                                    <Col md={12}>
                                        <Alert variant="info" className="small py-2 mb-0">
                                            Akun login akan dibuat otomatis. Dokter dapat login menggunakan email dan password di atas.
                                        </Alert>
                                    </Col>
                                </>
                            )}
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowDoctorModal(false)}>Batal</Button>
                        <Button type="submit" variant="primary" disabled={processing}>
                            {processing ? 'Menyimpan...' : editingDoctor ? 'Simpan Perubahan' : 'Tambah Dokter'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal Link User ke Dokter */}
            <Modal show={showLinkModal} onHide={() => setShowLinkModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaLink className="me-2 text-warning" />Hubungkan Dokter ke Akun User</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="warning" className="small">
                        Dokter <strong>dr. {linkDoctor?.name}</strong> belum memiliki akun login.
                        Hubungkan ke akun user yang sudah ada, atau buat akun baru melalui menu Tambah Dokter.
                    </Alert>
                    <Form.Group>
                        <Form.Label className="fw-semibold">Pilih Akun User (role: doctor)</Form.Label>
                        <Form.Select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}>
                            <option value="">-- Pilih User --</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                            ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                            Hanya menampilkan user dengan role 'doctor'. Jika tidak ada, buat dokter baru dengan email/password.
                        </Form.Text>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowLinkModal(false)}>Batal</Button>
                    <Button variant="warning" disabled={processing || !linkUserId} onClick={handleLinkUser}>
                        {processing ? 'Menghubungkan...' : 'Hubungkan Sekarang'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ManageDoctors;