import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    InputGroup, Form, Modal, Spinner, Alert
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaUsers, FaSearch, FaFilter, FaArrowLeft,
    FaEye, FaEdit, FaToggleOn, FaToggleOff,
    FaKey, FaSync, FaUserCheck, FaUserSlash
} from 'react-icons/fa';

const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [processing, setProcessing] = useState(false);

    const [editForm, setEditForm] = useState({ name: '', phone: '', address: { street: '', city: '', province: '', postalCode: '' } });
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/users');
            setUsers(res.data || []);
        } catch {
            toast.error('Gagal memuat data pengguna');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (user) => {
        if (user.role === 'admin') { toast.error('Tidak dapat menonaktifkan akun admin'); return; }
        try {
            await api.put(`/api/admin/users/${user._id}/toggle-status`);
            toast.success(`User ${user.isActive ? 'dinonaktifkan' : 'diaktifkan'}`);
            fetchUsers();
        } catch {
            toast.error('Gagal mengubah status user');
        }
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await api.put(`/api/admin/users/${selected._id}`, editForm);
            toast.success('Data user berhasil diperbarui');
            setShowEditModal(false);
            fetchUsers();
        } catch {
            toast.error('Gagal memperbarui data user');
        } finally {
            setProcessing(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return; }
        setProcessing(true);
        try {
            await api.put(`/api/admin/users/${selected._id}/reset-password`, { newPassword });
            toast.success('Password berhasil direset');
            setShowPasswordModal(false);
            setNewPassword('');
        } catch {
            toast.error('Gagal mereset password');
        } finally {
            setProcessing(false);
        }
    };

    const openEdit = (user) => {
        setSelected(user);
        setEditForm({
            name: user.name || '',
            phone: user.phone || '',
            address: {
                street: user.address?.street || '',
                city: user.address?.city || '',
                province: user.address?.province || '',
                postalCode: user.address?.postalCode || ''
            }
        });
        setShowEditModal(true);
    };

    const getRoleBadge = (role) => {
        const map = { admin: ['danger', 'Admin'], doctor: ['primary', 'Dokter'], user: ['success', 'Pasien'] };
        const [bg, label] = map[role] || ['secondary', role];
        return <Badge bg={bg}>{label}</Badge>;
    };

    const filtered = users.filter(u => {
        const matchSearch = !search ||
            u.name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.phone?.toLowerCase().includes(search.toLowerCase());
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const matchStatus = filterStatus === 'all' || 
            (filterStatus === 'active' ? u.isActive !== false : u.isActive === false);
        return matchSearch && matchRole && matchStatus;
    });

    const stats = {
        total: users.length,
        pasien: users.filter(u => u.role === 'user').length,
        dokter: users.filter(u => u.role === 'doctor').length,
        inactive: users.filter(u => u.isActive === false).length,
    };

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Memuat data pengguna...</p>
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
                        <FaUsers className="me-2 text-primary" />
                        Kelola Pengguna
                    </h4>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" size="sm" onClick={fetchUsers}>
                        <FaSync className="me-1" /> Refresh
                    </Button>
                </Col>
            </Row>

            <Row className="mb-4 g-3">
                {[
                    { label: 'Total', value: stats.total, bg: 'primary' },
                    { label: 'Pasien', value: stats.pasien, bg: 'success' },
                    { label: 'Dokter', value: stats.dokter, bg: 'info' },
                    { label: 'Nonaktif', value: stats.inactive, bg: 'danger' },
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
                <Col md={4}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            placeholder="Cari nama, email, telepon..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={2}>
                    <Form.Select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                        <option value="all">Semua Role</option>
                        <option value="user">Pasien</option>
                        <option value="doctor">Dokter</option>
                        <option value="admin">Admin</option>
                    </Form.Select>
                </Col>
                <Col md={2}>
                    <Form.Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </Form.Select>
                </Col>
                <Col className="d-flex align-items-center">
                    <span className="text-muted small">{filtered.length} pengguna</span>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Nama</th>
                                <th>Email</th>
                                <th>Telepon</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Tgl Daftar</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-4 text-muted">Tidak ada data</td></tr>
                            ) : filtered.map(u => (
                                <tr key={u._id} className={u.isActive === false ? 'opacity-50' : ''}>
                                    <td>
                                        <div className="fw-semibold small">{u.name}</div>
                                    </td>
                                    <td className="small text-muted">{u.email}</td>
                                    <td className="small">{u.phone || '-'}</td>
                                    <td>{getRoleBadge(u.role)}</td>
                                    <td>
                                        <Badge bg={u.isActive === false ? 'danger' : 'success'}>
                                            {u.isActive === false ? 'Nonaktif' : 'Aktif'}
                                        </Badge>
                                    </td>
                                    <td className="small text-muted">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                                    <td>
                                        <div className="d-flex gap-1 flex-wrap">
                                            <Button variant="outline-primary" size="sm" title="Lihat Detail"
                                                onClick={() => { setSelected(u); setShowDetailModal(true); }}>
                                                <FaEye />
                                            </Button>
                                            <Button variant="outline-warning" size="sm" title="Edit"
                                                onClick={() => openEdit(u)}>
                                                <FaEdit />
                                            </Button>
                                            {u.role !== 'admin' && (
                                                <>
                                                    <Button
                                                        variant={u.isActive === false ? 'outline-success' : 'outline-danger'}
                                                        size="sm"
                                                        title={u.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
                                                        onClick={() => handleToggleStatus(u)}>
                                                        {u.isActive === false ? <FaUserCheck /> : <FaUserSlash />}
                                                    </Button>
                                                    <Button variant="outline-secondary" size="sm" title="Reset Password"
                                                        onClick={() => { setSelected(u); setShowPasswordModal(true); }}>
                                                        <FaKey />
                                                    </Button>
                                                </>
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
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaEye className="me-2 text-primary" />Detail Pengguna</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <Table borderless size="sm">
                            <tbody>
                                <tr><td className="text-muted fw-semibold" style={{ width: '40%' }}>Nama</td><td>{selected.name}</td></tr>
                                <tr><td className="text-muted fw-semibold">Email</td><td>{selected.email}</td></tr>
                                <tr><td className="text-muted fw-semibold">Telepon</td><td>{selected.phone || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Role</td><td>{getRoleBadge(selected.role)}</td></tr>
                                <tr><td className="text-muted fw-semibold">Status</td>
                                    <td><Badge bg={selected.isActive === false ? 'danger' : 'success'}>{selected.isActive === false ? 'Nonaktif' : 'Aktif'}</Badge></td></tr>
                                <tr><td className="text-muted fw-semibold">Jalan</td><td>{selected.address?.street || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Kota</td><td>{selected.address?.city || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Provinsi</td><td>{selected.address?.province || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Kode Pos</td><td>{selected.address?.postalCode || '-'}</td></tr>
                                <tr><td className="text-muted fw-semibold">Tgl Daftar</td><td>{new Date(selected.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</td></tr>
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Tutup</Button>
                    <Button variant="warning" onClick={() => { setShowDetailModal(false); openEdit(selected); }}>
                        <FaEdit className="me-1" /> Edit
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Edit Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaEdit className="me-2 text-warning" />Edit Pengguna</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleEditSave}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Nama Lengkap</Form.Label>
                            <Form.Control type="text" value={editForm.name} required
                                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Nomor Telepon</Form.Label>
                            <Form.Control type="text" value={editForm.phone}
                                onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                        </Form.Group>
                        <hr />
                        <p className="fw-semibold small mb-2">Alamat</p>
                        <Row className="g-2">
                            <Col md={12}>
                                <Form.Control placeholder="Jalan" value={editForm.address.street}
                                    onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, street: e.target.value } }))} />
                            </Col>
                            <Col md={6}>
                                <Form.Control placeholder="Kota" value={editForm.address.city}
                                    onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} />
                            </Col>
                            <Col md={6}>
                                <Form.Control placeholder="Provinsi" value={editForm.address.province}
                                    onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, province: e.target.value } }))} />
                            </Col>
                            <Col md={6}>
                                <Form.Control placeholder="Kode Pos" value={editForm.address.postalCode}
                                    onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))} />
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowEditModal(false)}>Batal</Button>
                        <Button type="submit" variant="primary" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal show={showPasswordModal} onHide={() => { setShowPasswordModal(false); setNewPassword(''); }}>
                <Modal.Header closeButton>
                    <Modal.Title><FaKey className="me-2 text-secondary" />Reset Password</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleResetPassword}>
                    <Modal.Body>
                        <Alert variant="warning" className="small">
                            Reset password untuk: <strong>{selected?.name}</strong>
                        </Alert>
                        <Form.Group>
                            <Form.Label>Password Baru</Form.Label>
                            <Form.Control
                                type="password"
                                placeholder="Minimal 6 karakter"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}>Batal</Button>
                        <Button type="submit" variant="danger" disabled={processing}>
                            {processing ? 'Mereset...' : 'Reset Password'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default ManageUsers;
