import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Modal, Form, Spinner, Alert, InputGroup
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
    FaUserMd, FaPlus, FaEdit, FaToggleOn, FaToggleOff,
    FaArrowLeft, FaExclamationTriangle, FaLink,
    FaSearch, FaSync, FaTrash, FaClock, FaDollarSign,
    FaGraduationCap, FaBriefcase, FaEnvelope, FaLock,
    FaPhone, FaInfoCircle
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

    const handleSave = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (editingDoctor) {
                await api.put(`/api/admin/doctors/${editingDoctor._id}`, form);
                toast.success('Data dokter diperbarui');
            } else {
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

    const formatCurrency = (amount) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <Spinner animation="border" variant="primary" />
                <p style={{ marginTop: 16, color: '#64748b' }}>Memuat data dokter...</p>
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
                .search-container {
                    position: relative;
                    width: 100%;
                    max-width: 400px;
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
                .alert-custom {
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 12px;
                    padding: 16px 20px;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #b45309;
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
                .badge-custom {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .badge-success { background: #dcfce7; color: #166534; }
                .badge-warning { background: #fef3c7; color: #b45309; }
                .badge-danger { background: #fee2e2; color: #b91c1c; }
                .badge-info { background: #dbeafe; color: #1e40af; }
                .badge-secondary { background: #f1f5f9; color: #475569; }
                
                /* Button Styles */
                .btn-custom {
                    padding: 6px 12px;
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
                
                /* Status Button Styles - Fixed */
                .status-btn {
                    padding: 6px 24px;
                    border-radius: 30px;
                    font-size: 13px;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                    min-width: 100px;
                    text-align: center;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    transition: all 0.2s ease;
                    line-height: 1.5;
                    display: inline-block;
                    letter-spacing: 0.3px;
                }
                .status-btn.online {
                    background-color: #16a34a;
                    color: white;
                }
                .status-btn.online:hover {
                    background-color: #15803d;
                }
                .status-btn.offline {
                    background-color: #f1f5f9;
                    color: #475569;
                }
                .status-btn.offline:hover {
                    background-color: #e2e8f0;
                }
                
                /* Action Buttons */
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
                .action-btn.edit {
                    background: #dbeafe;
                    color: #2563eb;
                }
                .action-btn.edit:hover {
                    background: #bfdbfe;
                }
                .action-btn.link {
                    background: #fef3c7;
                    color: #b45309;
                }
                .action-btn.link:hover {
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
                .action-btn.delete {
                    background: #fee2e2;
                    color: #b91c1c;
                }
                .action-btn.delete:hover {
                    background: #fecaca;
                }
                .action-group {
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                /* Column Alignment */
                .text-center-col {
                    text-align: center;
                }
                .action-header {
                    text-align: center;
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
            `}</style>

            <Container fluid style={{ maxWidth: 1400, margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <FaUserMd size={24} />
                        </div>
                        <div className="header-title">
                            <h1>Kelola Dokter</h1>
                            <p>Manajemen data dokter dan jadwal praktek</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-custom" onClick={fetchData}>
                            <FaSync /> Refresh
                        </button>
                        <button className="btn-custom btn-custom-primary" onClick={openAdd}>
                            <FaPlus /> Tambah Dokter
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <Row className="g-3 mb-4">
                    <Col md={3}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#2563eb', fontSize: 14 }}>Total Dokter</div>
                                <div style={{ color: '#2563eb', opacity: 0.5 }}><FaUserMd size={20} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{doctors.length}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#16a34a', fontSize: 14 }}>Online</div>
                                <div style={{ color: '#16a34a', opacity: 0.5 }}><FaToggleOn size={20} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{doctors.filter(d => d.isOnline).length}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#b45309', fontSize: 14 }}>Perlu Link</div>
                                <div style={{ color: '#b45309', opacity: 0.5 }}><FaLink size={20} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>{unlinkedDoctors.length}</div>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="stats-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ color: '#1e40af', fontSize: 14 }}>Spesialisasi</div>
                                <div style={{ color: '#1e40af', opacity: 0.5 }}><FaGraduationCap size={20} /></div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 600, color: '#0f172a' }}>
                                {[...new Set(doctors.map(d => d.specialization))].length}
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Warning Alert */}
                {unlinkedDoctors.length > 0 && (
                    <div className="alert-custom">
                        <FaExclamationTriangle size={20} />
                        <span>
                            <strong>{unlinkedDoctors.length} dokter</strong> belum terhubung ke akun user. 
                            Dokter tersebut tidak bisa login! Klik tombol <strong>Hubungkan</strong> untuk memperbaiki.
                        </span>
                    </div>
                )}

                {/* Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Cari nama atau spesialisasi..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ fontSize: 14, color: '#64748b' }}>
                        {filtered.length} dokter ditemukan
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nama & Kualifikasi</th>
                                <th>Spesialisasi</th>
                                <th>Biaya</th>
                                <th>Akun User</th>
                                <th>Jadwal</th>
                                <th>Status</th>
                                <th>Online</th>
                                <th className="action-header">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                                        <div style={{ width: 60, height: 60, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <FaUserMd size={24} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <h6 style={{ fontWeight: 600, marginBottom: 4 }}>Tidak ada dokter</h6>
                                        <p style={{ color: '#64748b', fontSize: 13 }}>Tambahkan dokter baru untuk memulai</p>
                                    </td>
                                </tr>
                            ) : filtered.map(d => (
                                <tr key={d._id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>dr. {d.name}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{d.qualification || '-'}</div>
                                    </td>
                                    <td>
                                        <span className="badge-custom badge-info">{d.specialization}</span>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{formatCurrency(d.consultationFee)}</td>
                                    <td>
                                        {d.userId ? (
                                            <span className="badge-custom badge-success">
                                                <FaLink size={10} /> Terhubung
                                            </span>
                                        ) : (
                                            <span className="badge-custom badge-danger">
                                                <FaExclamationTriangle size={10} /> Belum terhubung
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {d.availableDays?.length > 0 ? (
                                            <span className="badge-custom badge-success">
                                                <FaClock size={10} /> {d.availableDays.length} hari
                                            </span>
                                        ) : (
                                            <span className="badge-custom badge-warning">
                                                <FaClock size={10} /> Belum diset
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge-custom ${d.isActive ? 'badge-success' : 'badge-secondary'}`}>
                                            {d.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className={`status-btn ${d.isOnline ? 'online' : 'offline'}`}
                                            onClick={() => handleToggleOnline(d)}
                                        >
                                            {d.isOnline ? 'Online' : 'Offline'}
                                        </button>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="action-group">
                                            <button 
                                                className="action-btn edit" 
                                                title="Edit"
                                                onClick={() => openEdit(d)}
                                            >
                                                <FaEdit />
                                            </button>
                                            
                                            {!d.userId && (
                                                <button 
                                                    className="action-btn link" 
                                                    title="Hubungkan ke User"
                                                    onClick={() => { setLinkDoctor(d); setLinkUserId(''); setShowLinkModal(true); }}
                                                >
                                                    <FaLink />
                                                </button>
                                            )}
                                            
                                            <button
                                                className={`action-btn ${d.isActive ? 'toggle-active' : 'toggle-inactive'}`}
                                                title={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                onClick={() => handleToggle(d)}
                                            >
                                                {d.isActive ? <FaToggleOff /> : <FaToggleOn />}
                                            </button>
                                            
                                            <button
                                                className="action-btn delete"
                                                title="Hapus Dokter"
                                                onClick={() => handleDelete(d)}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Modal Tambah/Edit Dokter */}
                <Modal show={showDoctorModal} onHide={() => setShowDoctorModal(false)} size="lg" centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                                <FaUserMd size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>
                                {editingDoctor ? `Edit dr. ${editingDoctor.name}` : 'Tambah Dokter Baru'}
                            </h5>
                        </div>
                        <button onClick={() => setShowDoctorModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <Form onSubmit={handleSave}>
                        <div className="modal-body-custom">
                            <Row className="g-3">
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Nama Dokter <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            value={form.name}
                                            required
                                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                            placeholder="Contoh: Ahmad Fauzi"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Spesialisasi <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            value={form.specialization}
                                            required
                                            onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
                                            placeholder="Contoh: Umum, Anak, THT"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Biaya Konsultasi (Rp) <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            type="number"
                                            min="0"
                                            value={form.consultationFee}
                                            required
                                            onChange={e => setForm(p => ({ ...p, consultationFee: e.target.value }))}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Kualifikasi</Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            value={form.qualification}
                                            onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))}
                                            placeholder="Contoh: dr., Sp.A, M.Kes"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Pengalaman (tahun)</Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            type="number"
                                            min="0"
                                            value={form.experience}
                                            onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12}>
                                    <Form.Group>
                                        <Form.Label className="form-label-custom">Bio / Deskripsi</Form.Label>
                                        <Form.Control
                                            className="form-control-custom"
                                            as="textarea"
                                            rows={2}
                                            value={form.bio}
                                            onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                                            placeholder="Deskripsi singkat dokter..."
                                        />
                                    </Form.Group>
                                </Col>

                                {/* Akun Login - hanya untuk tambah baru */}
                                {!editingDoctor && (
                                    <>
                                        <Col md={12}>
                                            <hr style={{ margin: '8px 0', borderColor: '#e2e8f0' }} />
                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 12 }}>
                                                <FaEnvelope style={{ marginRight: 6 }} /> Akun Login Dokter
                                            </p>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Email <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                                <Form.Control
                                                    className="form-control-custom"
                                                    type="email"
                                                    value={form.email}
                                                    required
                                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                    placeholder="email@klinik.com"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Password <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
                                                <Form.Control
                                                    className="form-control-custom"
                                                    type="password"
                                                    value={form.password}
                                                    required
                                                    minLength={6}
                                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                                    placeholder="Min. 6 karakter"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">No. Telepon</Form.Label>
                                                <Form.Control
                                                    className="form-control-custom"
                                                    value={form.phone}
                                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                                    placeholder="08xxxxxxxxxx"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={12}>
                                            <Alert variant="info" style={{ fontSize: 13, borderRadius: 8, padding: '12px 16px', background: '#dbeafe', border: 'none', color: '#1e40af' }}>
                                                <FaInfoCircle style={{ marginRight: 8 }} />
                                                Akun login akan dibuat otomatis. Dokter dapat login menggunakan email dan password di atas.
                                            </Alert>
                                        </Col>
                                    </>
                                )}
                            </Row>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-custom" onClick={() => setShowDoctorModal(false)}>
                                Batal
                            </button>
                            <button type="submit" className="btn-custom btn-custom-primary" disabled={processing}>
                                {processing ? 'Menyimpan...' : (editingDoctor ? 'Simpan Perubahan' : 'Tambah Dokter')}
                            </button>
                        </div>
                    </Form>
                </Modal>

                {/* Modal Link User ke Dokter */}
                <Modal show={showLinkModal} onHide={() => setShowLinkModal(false)} centered dialogClassName="modal-custom">
                    <div className="modal-header-custom">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
                                <FaLink size={20} />
                            </div>
                            <h5 style={{ fontWeight: 600, marginBottom: 0 }}>Hubungkan Dokter ke Akun User</h5>
                        </div>
                        <button onClick={() => setShowLinkModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
                    </div>
                    
                    <div className="modal-body-custom">
                        <Alert variant="warning" style={{ fontSize: 13, borderRadius: 8, padding: '12px 16px', background: '#fef3c7', border: 'none', color: '#b45309', marginBottom: 16 }}>
                            <FaExclamationTriangle style={{ marginRight: 8 }} />
                            Dokter <strong>dr. {linkDoctor?.name}</strong> belum memiliki akun login.
                            Hubungkan ke akun user yang sudah ada, atau buat akun baru melalui menu Tambah Dokter.
                        </Alert>
                        
                        <Form.Group>
                            <Form.Label className="form-label-custom">Pilih Akun User (role: doctor)</Form.Label>
                            <select 
                                className="form-control-custom"
                                value={linkUserId} 
                                onChange={e => setLinkUserId(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">-- Pilih User --</option>
                                {users.map(u => (
                                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                            <Form.Text style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'block' }}>
                                Hanya menampilkan user dengan role 'doctor'. Jika tidak ada, buat dokter baru dengan email/password.
                            </Form.Text>
                        </Form.Group>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-custom" onClick={() => setShowLinkModal(false)}>
                            Batal
                        </button>
                        <button 
                            type="button" 
                            className="btn-custom" 
                            style={{ background: '#b45309', color: 'white', border: 'none' }}
                            disabled={processing || !linkUserId} 
                            onClick={handleLinkUser}
                        >
                            {processing ? 'Menghubungkan...' : 'Hubungkan Sekarang'}
                        </button>
                    </div>
                </Modal>
            </Container>
        </div>
    );
};

export default ManageDoctors;