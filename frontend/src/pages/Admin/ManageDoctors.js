import React, { useState, useEffect, useRef } from 'react';
import api, { API_URL } from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Modal, Form, Spinner, Alert, InputGroup
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaUserMd, FaPlus, FaEdit, FaToggleOn, FaToggleOff,
    FaArrowLeft, FaExclamationTriangle, FaLink,
    FaSearch, FaSync, FaTrash, FaCamera, FaUpload
} from 'react-icons/fa';

const defaultForm = {
    name: '', specialization: '', consultationFee: '', qualification: '',
    experience: '', bio: '', email: '', password: '', phone: ''
};

const defaultSettings = {
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
    const [settings, setSettings] = useState(defaultSettings); // consultation settings

    // State upload foto
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef();

    // State modal khusus ganti foto (untuk dokter yang sudah ada)
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [photoDoctor, setPhotoDoctor] = useState(null);
    const [photoFileModal, setPhotoFileModal] = useState(null);
    const [photoPreviewModal, setPhotoPreviewModal] = useState(null);
    const photoInputModalRef = useRef();

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkDoctor, setLinkDoctor] = useState(null);
    const [linkUserId, setLinkUserId] = useState('');

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
                const allUsers = userRes.value.data || [];
                setUsers(allUsers.filter(u => u.role === 'doctor'));
            }
        } catch {
            toast.error('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    // Pilih foto di modal tambah/edit
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { toast.error('Ukuran foto maksimal 3MB'); return; }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    // Pilih foto di modal upload foto terpisah
    const handlePhotoModalChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { toast.error('Ukuran foto maksimal 3MB'); return; }
        setPhotoFileModal(file);
        setPhotoPreviewModal(URL.createObjectURL(file));
    };

    // Upload foto ke server (dipanggil setelah doctor tersimpan, atau dari modal foto)
    const uploadPhoto = async (doctorId, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        const res = await api.post(`/api/admin/doctors/${doctorId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.photo;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            let savedDoctorId = editingDoctor?._id;

            if (editingDoctor) {
                await api.put(`/api/admin/doctors/${editingDoctor._id}`, form);
                // Simpan consultation settings via route baru
                await api.put(`/api/doctors/${editingDoctor._id}/settings`, settings);
                toast.success('Data dokter diperbarui');
            } else {
                const res = await api.post('/api/admin/doctors', form);
                savedDoctorId = res.data.doctor?._id;
                // Settings default sudah ditetapkan di model, update jika berbeda
                if (savedDoctorId) await api.put(`/api/doctors/${savedDoctorId}/settings`, settings);
                toast.success('Dokter berhasil ditambahkan');
            }

            // Upload foto jika ada
            if (photoFile && savedDoctorId) {
                setUploadingPhoto(true);
                try {
                    await uploadPhoto(savedDoctorId, photoFile);
                    toast.success('Foto dokter berhasil diupload');
                } catch {
                    toast.error('Data tersimpan, tapi gagal upload foto. Coba upload ulang lewat tombol kamera.');
                } finally {
                    setUploadingPhoto(false);
                }
            }

            setShowDoctorModal(false);
            setPhotoFile(null);
            setPhotoPreview(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal menyimpan');
        } finally {
            setProcessing(false);
        }
    };

    // Simpan foto dari modal terpisah
    const handleSavePhoto = async () => {
        if (!photoFileModal || !photoDoctor) return;
        setUploadingPhoto(true);
        try {
            await uploadPhoto(photoDoctor._id, photoFileModal);
            toast.success('Foto berhasil diperbarui');
            setShowPhotoModal(false);
            setPhotoFileModal(null);
            setPhotoPreviewModal(null);
            fetchData();
        } catch {
            toast.error('Gagal upload foto');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const openPhotoModal = (doctor) => {
        setPhotoDoctor(doctor);
        setPhotoFileModal(null);
        setPhotoPreviewModal(doctor.photo ? `${API_URL}${doctor.photo}` : null);
        setShowPhotoModal(true);
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
            await api.post('/api/doctors/admin/link-user', { doctorId: linkDoctor._id, userId: linkUserId });
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
        setPhotoFile(null);
        setPhotoPreview(doctor.photo ? `${API_URL}${doctor.photo}` : null);
        setSettings({
            allowChat:      doctor.consultationSettings?.allowChat      !== false,
            allowVideoCall: doctor.consultationSettings?.allowVideoCall !== false,
        });
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
        setPhotoFile(null);
        setPhotoPreview(null);
        setSettings(defaultSettings);
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

            {unlinkedDoctors.length > 0 && (
                <Alert variant="warning" className="d-flex align-items-center gap-2 mb-3">
                    <FaExclamationTriangle />
                    <span>
                        <strong>{unlinkedDoctors.length} dokter</strong> belum terhubung ke akun user.
                        Klik tombol <strong>Hubungkan</strong> untuk memperbaiki.
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
                                <th style={{ width: 56 }}>Foto</th>
                                <th>Nama</th>
                                <th>Spesialisasi</th>
                                <th>Biaya</th>
                                <th>Akun</th>
                                <th>Status</th>
                                <th>Online</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-4 text-muted">Tidak ada dokter</td></tr>
                            ) : filtered.map(d => (
                                <tr key={d._id}>
                                    {/* Foto dokter */}
                                    <td className="text-center align-middle">
                                        {d.photo ? (
                                            <img
                                                src={`${API_URL}${d.photo}`}
                                                alt={d.name}
                                                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '50%', border: '2px solid #dee2e6' }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: 40, height: 40, borderRadius: '50%',
                                                background: '#e9ecef', display: 'inline-flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                color: '#adb5bd', fontSize: 18, border: '2px solid #dee2e6'
                                            }}>
                                                <FaUserMd />
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="fw-semibold">dr. {d.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{d.qualification}</div>
                                        <div style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                            {d.consultationSettings?.allowChat      !== false && <span title="Chat aktif" style={{ marginRight: 3 }}>💬</span>}
                                            {d.consultationSettings?.allowVideoCall !== false && <span title="Video aktif">📹</span>}
                                        </div>
                                    </td>
                                    <td className="small">{d.specialization}</td>
                                    <td className="small">Rp {Number(d.consultationFee || 0).toLocaleString('id-ID')}</td>
                                    <td>
                                        {d.userId
                                            ? <Badge bg="success">✓ Terhubung</Badge>
                                            : <Badge bg="danger">✗ Belum</Badge>}
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
                                            onClick={() => handleToggleOnline(d)}
                                        >
                                            {d.isOnline ? '🟢 Online' : '⚫ Offline'}
                                        </Button>
                                    </td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">
                                            <Button variant="outline-primary" size="sm" title="Edit Data" onClick={() => openEdit(d)}>
                                                <FaEdit />
                                            </Button>
                                            <Button variant="outline-info" size="sm" title="Ganti Foto" onClick={() => openPhotoModal(d)}>
                                                <FaCamera />
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
                                                onClick={() => handleToggle(d)}>
                                                {d.isActive ? <FaToggleOff /> : <FaToggleOn />}
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleDelete(d)}>
                                                <FaTrash />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* ═══ Modal Tambah/Edit Dokter ═══════════════════════════════════ */}
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

                            {/* ── Bagian Foto ── */}
                            <Col md={12}>
                                <Form.Label className="fw-semibold small d-block">
                                    <FaCamera className="me-1 text-muted" /> Foto Dokter
                                </Form.Label>
                                <div className="d-flex align-items-center gap-3">
                                    {/* Preview foto */}
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        overflow: 'hidden', border: '2px dashed #dee2e6',
                                        background: '#f8f9fa', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <FaUserMd size={28} color="#adb5bd" />
                                        )}
                                    </div>
                                    <div>
                                        <input
                                            ref={photoInputRef}
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            style={{ display: 'none' }}
                                            onChange={handlePhotoChange}
                                        />
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => photoInputRef.current.click()}
                                        >
                                            <FaUpload className="me-1" />
                                            {photoPreview ? 'Ganti Foto' : 'Pilih Foto'}
                                        </Button>
                                        {photoFile && (
                                            <Button variant="link" size="sm" className="text-danger ms-1 p-0"
                                                onClick={() => { setPhotoFile(null); setPhotoPreview(editingDoctor?.photo ? `${API_URL}${editingDoctor.photo}` : null); }}>
                                                Hapus
                                            </Button>
                                        )}
                                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                                            JPG, PNG, WebP · Maks. 3MB
                                        </div>
                                    </div>
                                </div>
                            </Col>

                            <Col md={12}><hr className="my-1" /></Col>

                            {/* ── Data Dokter ── */}
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

                            {/* ── Consultation Settings ── */}
                            <Col md={12}><hr className="my-1" /></Col>
                            <Col md={12}>
                                <Form.Label className="fw-semibold small d-block mb-2">
                                    ⚙️ Fitur Konsultasi yang Tersedia
                                </Form.Label>
                                <div className="d-flex gap-4 flex-wrap">
                                    {[
                                        { key: 'allowChat',       icon: '💬', label: 'Chat' },
                                        { key: 'allowVideoCall',  icon: '📹', label: 'Video Call' },
                                    ].map(opt => (
                                        <Form.Check
                                            key={opt.key}
                                            type="switch"
                                            id={`setting-${opt.key}`}
                                            label={<span>{opt.icon} {opt.label}</span>}
                                            checked={settings[opt.key] !== false}
                                            onChange={e => setSettings(s => ({ ...s, [opt.key]: e.target.checked }))}
                                        />
                                    ))}
                                </div>
                                {(!settings.allowChat && !settings.allowVideoCall) && (
                                    <div className="text-danger small mt-1">⚠️ Minimal satu fitur harus diaktifkan</div>
                                )}
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
                        <Button type="submit" variant="primary" disabled={processing || uploadingPhoto || (!settings.allowChat && !settings.allowVideoCall)}>
                            {(processing || uploadingPhoto) ? <><Spinner size="sm" className="me-1" />Menyimpan...</> : editingDoctor ? 'Simpan Perubahan' : 'Tambah Dokter'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* ═══ Modal Ganti Foto (dari tombol kamera di tabel) ═════════════ */}
            <Modal show={showPhotoModal} onHide={() => setShowPhotoModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title><FaCamera className="me-2 text-info" />Foto Dokter — dr. {photoDoctor?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center">
                    {/* Preview */}
                    <div style={{
                        width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                        border: '3px solid #dee2e6', background: '#f8f9fa',
                        margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {photoPreviewModal ? (
                            <img src={photoPreviewModal} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <FaUserMd size={44} color="#adb5bd" />
                        )}
                    </div>

                    <input
                        ref={photoInputModalRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handlePhotoModalChange}
                    />
                    <Button variant="outline-secondary" onClick={() => photoInputModalRef.current.click()}>
                        <FaUpload className="me-1" />
                        {photoPreviewModal ? 'Ganti Foto' : 'Pilih Foto'}
                    </Button>
                    <div className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>JPG, PNG, WebP · Maks. 3MB</div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPhotoModal(false)}>Batal</Button>
                    <Button variant="primary" disabled={!photoFileModal || uploadingPhoto} onClick={handleSavePhoto}>
                        {uploadingPhoto ? <><Spinner size="sm" className="me-1" />Mengupload...</> : 'Simpan Foto'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ═══ Modal Hubungkan Dokter ke User ═════════════════════════════ */}
            <Modal show={showLinkModal} onHide={() => setShowLinkModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaLink className="me-2 text-warning" />Hubungkan Dokter ke Akun User</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="warning" className="small">
                        Dokter <strong>dr. {linkDoctor?.name}</strong> belum memiliki akun login.
                    </Alert>
                    <Form.Group>
                        <Form.Label className="fw-semibold">Pilih Akun User (role: doctor)</Form.Label>
                        <Form.Select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}>
                            <option value="">-- Pilih User --</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                            ))}
                        </Form.Select>
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
