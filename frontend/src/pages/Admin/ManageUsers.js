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
    FaKey, FaSync, FaUserCheck, FaUserSlash,
    FaEnvelope, FaPhone, FaMapMarkerAlt, FaCalendarAlt,
    FaUserCircle, FaCheckCircle, FaTimesCircle, FaUserMd
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
        const map = { 
            admin: { bg: '#fee2e2', color: '#b91c1c', label: 'Admin' },
            doctor: { bg: '#dbeafe', color: '#1e40af', label: 'Dokter' },
            user: { bg: '#dcfce7', color: '#166534', label: 'Pasien' }
        };
        const config = map[role] || { bg: '#f1f5f9', color: '#475569', label: role };
        return (
            <span style={{ background: config.bg, color: config.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>
                {config.label}
            </span>
        );
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

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Spinner animation="border" variant="primary" />
                <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data pengguna...</p>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '24px' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            
            <style>{`
                .page-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header-icon {
                    width: 44px;
                    height: 44px;
                    background: #dbeafe;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #2563eb;
                }
                .header-title h1 {
                    font-size: 24px;
                    font-weight: 600;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                .header-title p {
                    font-size: 14px;
                    color: #64748b;
                    margin-bottom: 0;
                }
                .stats-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.2s ease;
                }
                .stats-card:hover {
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }
                .stats-value {
                    font-size: 32px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .stats-label {
                    font-size: 14px;
                    color: #64748b;
                }
                .search-container {
                    position: relative;
                    width: 100%;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    font-size: 14px;
                }
                .search-input {
                    width: 100%;
                    padding: 10px 16px 10px 40px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    background: #ffffff;
                }
                .search-input:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .filter-select {
                    padding: 10px 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    background: #ffffff;
                    width: 100%;
                }
                .filter-select:focus {
                    outline: none;
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                }
                .table-container {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    margin-top: 24px;
                }
                .table-container table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .table-container th {
                    background: #f8fafc;
                    padding: 16px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    text-align: left;
                    border-bottom: 1px solid #e2e8f0;
                }
                .table-container td {
                    padding: 16px;
                    font-size: 14px;
                    color: #0f172a;
                    border-bottom: 1px solid #e2e8f0;
                    vertical-align: middle;
                }
                .table-container tr:last-child td {
                    border-bottom: none;
                }
                .table-container tr.inactive td {
                    opacity: 0.6;
                }
                .status-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-block;
                }
                .status-badge.active {
                    background: #dcfce7;
                    color: #166534;
                }
                .status-badge.inactive {
                    background: #fee2e2;
                    color: #b91c1c;
                }
                .action-group {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .action-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 16px;
                }
                .action-btn.view {
                    background: #dbeafe;
                    color: #2563eb;
                }
                .action-btn.view:hover {
                    background: #bfdbfe;
                }
                .action-btn.edit {
                    background: #fef3c7;
                    color: #b45309;
                }
                .action-btn.edit:hover {
                    background: #fde68a;
                }
                .action-btn.toggle-active {
                    background: #fee2e2;
                    color: #b91c1c;
                }
                .action-btn.toggle-inactive {
                    background: #dcfce7;
                    color: #166534;
                }
                .action-btn.reset {
                    background: #f1f5f9;
                    color: #475569;
                }
                .action-btn.reset:hover {
                    background: #e2e8f0;
                }
                .modal-custom .modal-content {
                    border-radius: 20px;
                    border: none;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
                }
                .modal-header-custom {
                    padding: 20px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-body-custom {
                    padding: 24px;
                }
                .modal-footer-custom {
                    padding: 16px 24px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                .detail-item {
                    display: flex;
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .detail-label {
                    width: 120px;
                    color: #64748b;
                    font-size: 13px;
                }
                .detail-value {
                    flex: 1;
                    color: #0f172a;
                    font-size: 13px;
                    font-weight: 500;
                }
                .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .form-control-custom {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 14px;
                    width: 100%;
                }
                .form-control-custom:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
                    outline: none;
                }
                .btn-custom {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #475569;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                .btn-custom:hover {
                    background: #f1f5f9;
                }
                .btn-custom-primary {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: white;
                }
                .btn-custom-primary:hover {
                    background: #1d4ed8;
                }
                .btn-custom-danger {
                    background: #b91c1c;
                    border-color: #b91c1c;
                    color: white;
                }
                .btn-custom-danger:hover {
                    background: #991b1b;
                }
                .info-alert {
                    background: #dbeafe;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 16px;
                    color: #1e40af;
                    font-size: 13px;
                }
            `}</style>

            <Container fluid style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <FaUsers size={24} />
                        </div>
                        <div className="header-title">
                            <h1>Kelola Pengguna</h1>
                            <p>Manajemen data pasien, dokter, dan admin</p>
                        </div>
                    </div>
                    <button className="btn-custom" onClick={fetchUsers}>
                        <FaSync /> Refresh
                    </button>
                </div>

                {/* Stats Cards */}
                <Row className="g-3 mb-4">
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#2563eb', fontSize: 14 }}>Total</div>
                                <FaUsers style={{ color: '#2563eb', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.total}</div>
                            <div className="stats-label">Seluruh pengguna</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#166534', fontSize: 14 }}>Pasien</div>
                                <FaUserCircle style={{ color: '#166534', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.pasien}</div>
                            <div className="stats-label">Aktif terdaftar</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#1e40af', fontSize: 14 }}>Dokter</div>
                                <FaUserMd style={{ color: '#1e40af', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.dokter}</div>
                            <div className="stats-label">Tenaga medis</div>
                        </div>
                    </Col>
                    <Col md={3} xs={6}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ color: '#b91c1c', fontSize: 14 }}>Nonaktif</div>
                                <FaUserSlash style={{ color: '#b91c1c', opacity: 0.5 }} size={20} />
                            </div>
                            <div className="stats-value">{stats.inactive}</div>
                            <div className="stats-label">Akun tidak aktif</div>
                        </div>
                    </Col>
                </Row>

                {/* Search & Filter */}
                <Row className="g-3 mb-3">
                    <Col md={4}>
                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Cari nama, email, atau telepon..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </Col>
                    <Col md={2}>
                        <select className="filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            <option value="all">Semua Role</option>
                            <option value="user">Pasien</option>
                            <option value="doctor">Dokter</option>
                            <option value="admin">Admin</option>
                        </select>
                    </Col>
                    <Col md={2}>
                        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </Col>
                    <Col md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 14, color: '#64748b' }}>{filtered.length} pengguna ditemukan</span>
                    </Col>
                </Row>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nama</th>
                                <th>Email</th>
                                <th>Telepon</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Tanggal Daftar</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px' }}>
                                        <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaUsers size={24} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada pengguna</h6>
                                        <p style={{ color: '#64748b', fontSize: 13 }}>Tidak ada data yang sesuai dengan filter</p>
                                    </td>
                                </tr>
                            ) : filtered.map(u => (
                                <tr key={u._id} className={u.isActive === false ? 'inactive' : ''}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                                    </td>
                                    <td style={{ color: '#475569' }}>{u.email}</td>
                                    <td style={{ color: '#475569' }}>{u.phone || '-'}</td>
                                    <td>{getRoleBadge(u.role)}</td>
                                    <td>
                                        <span className={`status-badge ${u.isActive === false ? 'inactive' : 'active'}`}>
                                            {u.isActive === false ? 'Nonaktif' : 'Aktif'}
                                        </span>
                                    </td>
                                    <td style={{ color: '#64748b', fontSize: 13 }}>{formatDate(u.createdAt)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="action-group" style={{ justifyContent: 'center' }}>
                                            <button 
                                                className="action-btn view" 
                                                title="Lihat Detail"
                                                onClick={() => { setSelected(u); setShowDetailModal(true); }}
                                            >
                                                <FaEye />
                                            </button>
                                            <button 
                                                className="action-btn edit" 
                                                title="Edit"
                                                onClick={() => openEdit(u)}
                                            >
                                                <FaEdit />
                                            </button>
                                            {u.role !== 'admin' && (
                                                <>
                                                    <button
                                                        className={`action-btn ${u.isActive === false ? 'toggle-inactive' : 'toggle-active'}`}
                                                        title={u.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
                                                        onClick={() => handleToggleStatus(u)}>
                                                        {u.isActive === false ? <FaUserCheck /> : <FaUserSlash />}
                                                    </button>
                                                    <button 
                                                        className="action-btn reset" 
                                                        title="Reset Password"
                                                        onClick={() => { setSelected(u); setShowPasswordModal(true); }}
                                                    >
                                                        <FaKey />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Detail Modal */}
                <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                <FaEye size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Detail Pengguna</h5>
                        </div>
                        <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <div className="modal-body-custom">
                        {selected && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                    <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaUserCircle size={30} style={{ color: '#94a3b8' }} />
                                    </div>
                                    <div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 4 }}>{selected.name}</h6>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {getRoleBadge(selected.role)}
                                            <span className={`status-badge ${selected.isActive === false ? 'inactive' : 'active'}`}>
                                                {selected.isActive === false ? 'Nonaktif' : 'Aktif'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-item">
                                    <div className="detail-label"><FaEnvelope size={12} style={{ marginRight: 6 }} /> Email</div>
                                    <div className="detail-value">{selected.email}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label"><FaPhone size={12} style={{ marginRight: 6 }} /> Telepon</div>
                                    <div className="detail-value">{selected.phone || '-'}</div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label"><FaMapMarkerAlt size={12} style={{ marginRight: 6 }} /> Alamat</div>
                                    <div className="detail-value">
                                        {selected.address?.street || '-'}<br />
                                        {selected.address?.city && `${selected.address.city}, `}
                                        {selected.address?.province && `${selected.address.province} `}
                                        {selected.address?.postalCode && `${selected.address.postalCode}`}
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <div className="detail-label"><FaCalendarAlt size={12} style={{ marginRight: 6 }} /> Tanggal Daftar</div>
                                    <div className="detail-value">{new Date(selected.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
                                </div>
                            </>
                        )}
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-custom" onClick={() => setShowDetailModal(false)}>
                            Tutup
                        </button>
                        <button type="button" className="btn-custom btn-custom-primary" onClick={() => { setShowDetailModal(false); openEdit(selected); }}>
                            <FaEdit style={{ marginRight: 4 }} /> Edit
                        </button>
                    </div>
                </Modal>

                {/* Edit Modal */}
                <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
                                <FaEdit size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Edit Pengguna</h5>
                        </div>
                        <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <Form onSubmit={handleEditSave}>
                        <div className="modal-body-custom">
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Nama Lengkap</Form.Label>
                                <Form.Control
                                    className="form-control-custom"
                                    type="text"
                                    value={editForm.name}
                                    required
                                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Nomor Telepon</Form.Label>
                                <Form.Control
                                    className="form-control-custom"
                                    type="text"
                                    value={editForm.phone}
                                    onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                />
                            </Form.Group>
                            
                            <hr style={{ margin: '16px 0', borderColor: '#e2e8f0' }} />
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 12 }}>
                                <FaMapMarkerAlt style={{ marginRight: 6 }} /> Alamat
                            </p>
                            
                            <Row className="g-2">
                                <Col md={12}>
                                    <Form.Control
                                        className="form-control-custom"
                                        placeholder="Jalan"
                                        value={editForm.address.street}
                                        onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, street: e.target.value } }))}
                                    />
                                </Col>
                                <Col md={6}>
                                    <Form.Control
                                        className="form-control-custom"
                                        placeholder="Kota"
                                        value={editForm.address.city}
                                        onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, city: e.target.value } }))}
                                    />
                                </Col>
                                <Col md={6}>
                                    <Form.Control
                                        className="form-control-custom"
                                        placeholder="Provinsi"
                                        value={editForm.address.province}
                                        onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, province: e.target.value } }))}
                                    />
                                </Col>
                                <Col md={6}>
                                    <Form.Control
                                        className="form-control-custom"
                                        placeholder="Kode Pos"
                                        value={editForm.address.postalCode}
                                        onChange={e => setEditForm(p => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))}
                                    />
                                </Col>
                            </Row>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-custom" onClick={() => setShowEditModal(false)}>
                                Batal
                            </button>
                            <button type="submit" className="btn-custom btn-custom-primary" disabled={processing}>
                                {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </Form>
                </Modal>

                {/* Reset Password Modal */}
                <Modal show={showPasswordModal} onHide={() => { setShowPasswordModal(false); setNewPassword(''); }} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                                <FaKey size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Reset Password</h5>
                        </div>
                        <button onClick={() => { setShowPasswordModal(false); setNewPassword(''); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <Form onSubmit={handleResetPassword}>
                        <div className="modal-body-custom">
                            <div className="info-alert" style={{ marginBottom: 16 }}>
                                <FaKey style={{ marginRight: 8 }} />
                                Reset password untuk: <strong>{selected?.name}</strong>
                            </div>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Password Baru</Form.Label>
                                <Form.Control
                                    className="form-control-custom"
                                    type="password"
                                    placeholder="Minimal 6 karakter"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-custom" onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}>
                                Batal
                            </button>
                            <button type="submit" className="btn-custom btn-custom-danger" disabled={processing}>
                                {processing ? 'Mereset...' : 'Reset Password'}
                            </button>
                        </div>
                    </Form>
                </Modal>
            </Container>
        </div>
    );
};

export default ManageUsers;