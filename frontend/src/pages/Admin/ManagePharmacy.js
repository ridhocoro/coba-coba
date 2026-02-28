import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
    Container, Row, Col, Card, Table, Badge, Button,
    Form, InputGroup, Spinner, Modal, Tabs, Tab
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import {
    FaPills, FaSearch, FaPlus, FaEdit, FaTrash,
    FaArrowLeft, FaBoxOpen, FaShoppingCart, FaFilter
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const orderStatusConfig = {
    pending:    { bg: 'warning',   label: 'Menunggu' },
    processing: { bg: 'info',      label: 'Diproses' },
    shipped:    { bg: 'primary',   label: 'Dikirim' },
    delivered:  { bg: 'success',   label: 'Diterima' },
    cancelled:  { bg: 'danger',    label: 'Dibatalkan' },
};

const ManagePharmacy = () => {
    const [medicines, setMedicines] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [filterOrderStatus, setFilterOrderStatus] = useState('all');

    // Modal obat
    const [showMedModal, setShowMedModal] = useState(false);
    const [editingMed, setEditingMed] = useState(null);
    const [medForm, setMedForm] = useState({ name:'', category:'', price:'', stock:'', description:'', unit:'tablet' });
    const [savingMed, setSavingMed] = useState(false);

    // Modal update status order
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [updatingOrder, setUpdatingOrder] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [medsRes, ordersRes] = await Promise.all([
                api.get('/api/pharmacy/admin/medicines'),
                api.get('/api/pharmacy/admin/orders'),
            ]);
            setMedicines(medsRes.data.medicines || medsRes.data || []);
            setOrders(ordersRes.data.orders || ordersRes.data || []);
        } catch {
            toast.error('Gagal memuat data farmasi');
        } finally {
            setLoading(false);
        }
    };

    const openMedModal = (med = null) => {
        if (med) {
            setEditingMed(med);
            setMedForm({ name: med.name, category: med.category||'', price: med.price, stock: med.stock, description: med.description||'', unit: med.unit||'tablet' });
        } else {
            setEditingMed(null);
            setMedForm({ name:'', category:'', price:'', stock:'', description:'', unit:'tablet' });
        }
        setShowMedModal(true);
    };

    const handleSaveMed = async (e) => {
        e.preventDefault();
        if (!medForm.name || !medForm.price || !medForm.stock) { toast.error('Nama, harga, dan stok wajib diisi'); return; }
        setSavingMed(true);
        try {
            if (editingMed) {
                await api.put(`/api/pharmacy/admin/medicines/${editingMed._id}`, medForm);
                toast.success('Obat berhasil diperbarui');
            } else {
                await api.post('/api/pharmacy/admin/medicines', medForm);
                toast.success('Obat berhasil ditambahkan');
            }
            setShowMedModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan obat');
        } finally {
            setSavingMed(false);
        }
    };

    const handleDeleteMed = async (id, name) => {
        if (!window.confirm(`Hapus obat "${name}"?`)) return;
        try {
            await api.delete(`/api/pharmacy/admin/medicines/${id}`);
            toast.success('Obat berhasil dihapus');
            fetchData();
        } catch {
            toast.error('Gagal menghapus obat');
        }
    };

    const handleUpdateOrderStatus = async () => {
        if (!newStatus) return;
        setUpdatingOrder(true);
        try {
            await api.put(`/api/pharmacy/admin/orders/${selectedOrder._id}/status`, { status: newStatus });
            toast.success('Status pesanan diperbarui');
            setShowOrderModal(false);
            fetchData();
        } catch {
            toast.error('Gagal memperbarui status');
        } finally {
            setUpdatingOrder(false);
        }
    };

    const filteredMeds = medicines.filter(m =>
        !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.category?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredOrders = orders.filter(o => {
        const q = orderSearch.toLowerCase();
        const matchSearch = !orderSearch || o.userId?.name?.toLowerCase().includes(q) || o._id?.toLowerCase().includes(q);
        const matchStatus = filterOrderStatus === 'all' || o.status === filterOrderStatus;
        return matchSearch && matchStatus;
    });

    const lowStock = medicines.filter(m => m.stock <= 10).length;

    return (
        <Container fluid className="py-4 px-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <Button as={Link} to="/admin" variant="link" className="p-0 text-muted mb-1 d-block">
                        <FaArrowLeft className="me-1" /> Dashboard Admin
                    </Button>
                    <h4 className="fw-bold mb-0">
                        <FaPills className="me-2 text-success" /> Manajemen Farmasi
                    </h4>
                </Col>
            </Row>

            {/* Stats */}
            <Row className="mb-4 g-2">
                {[
                    { label: 'Total Obat', value: medicines.length, bg: 'primary' },
                    { label: 'Stok Menipis (≤10)', value: lowStock, bg: lowStock > 0 ? 'danger' : 'success' },
                    { label: 'Total Pesanan', value: orders.length, bg: 'info' },
                    { label: 'Pesanan Pending', value: orders.filter(o => o.status === 'pending').length, bg: 'warning' },
                ].map((s, i) => (
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

            <Tabs defaultActiveKey="medicines" className="mb-3">
                {/* Tab: Daftar Obat */}
                <Tab eventKey="medicines" title={<span><FaBoxOpen className="me-1" />Daftar Obat ({medicines.length})</span>}>
                    <div className="d-flex justify-content-between mb-3 gap-2 flex-wrap">
                        <InputGroup style={{maxWidth: 350}}>
                            <InputGroup.Text><FaSearch /></InputGroup.Text>
                            <Form.Control placeholder="Cari nama/kategori obat..." value={search} onChange={e => setSearch(e.target.value)} />
                        </InputGroup>
                        <Button variant="primary" onClick={() => openMedModal()}>
                            <FaPlus className="me-1" /> Tambah Obat
                        </Button>
                    </div>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-0">
                            {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : (
                                <Table hover responsive className="mb-0">
                                    <thead className="bg-light">
                                        <tr><th>Nama Obat</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Satuan</th><th>Aksi</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredMeds.map(m => (
                                            <tr key={m._id}>
                                                <td className="fw-semibold">{m.name}</td>
                                                <td><Badge bg="light" text="dark" className="border">{m.category || '-'}</Badge></td>
                                                <td>Rp {Number(m.price).toLocaleString('id-ID')}</td>
                                                <td>
                                                    <Badge bg={m.stock <= 10 ? 'danger' : m.stock <= 30 ? 'warning' : 'success'}>
                                                        {m.stock}
                                                    </Badge>
                                                </td>
                                                <td className="text-muted small">{m.unit || 'tablet'}</td>
                                                <td>
                                                    <div className="d-flex gap-1">
                                                        <Button size="sm" variant="outline-primary" onClick={() => openMedModal(m)}><FaEdit /></Button>
                                                        <Button size="sm" variant="outline-danger" onClick={() => handleDeleteMed(m._id, m.name)}><FaTrash /></Button>
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

                {/* Tab: Pesanan */}
                <Tab eventKey="orders" title={<span><FaShoppingCart className="me-1" />Pesanan ({orders.length})</span>}>
                    <Row className="mb-3 g-2">
                        <Col md={4}>
                            <InputGroup>
                                <InputGroup.Text><FaSearch /></InputGroup.Text>
                                <Form.Control placeholder="Cari nama pelanggan / ID..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                            </InputGroup>
                        </Col>
                        <Col md={3}>
                            <Form.Select value={filterOrderStatus} onChange={e => setFilterOrderStatus(e.target.value)}>
                                <option value="all">Semua Status</option>
                                {Object.entries(orderStatusConfig).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                            </Form.Select>
                        </Col>
                    </Row>
                    <Card className="border-0 shadow-sm">
                        <Card.Body className="p-0">
                            {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : filteredOrders.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <FaShoppingCart size={40} className="mb-2 opacity-25" />
                                    <p className="mb-0">Tidak ada pesanan ditemukan</p>
                                </div>
                            ) : (
                                <Table hover responsive className="mb-0">
                                    <thead className="bg-light">
                                        <tr><th>ID Pesanan</th><th>Pelanggan</th><th>Total</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredOrders.map(o => (
                                            <tr key={o._id}>
                                                <td><code className="small">{o._id.slice(-8).toUpperCase()}</code></td>
                                                <td>
                                                    <div className="fw-semibold">{o.userId?.name || '-'}</div>
                                                    <div className="text-muted small">{o.userId?.email}</div>
                                                </td>
                                                <td className="fw-semibold">Rp {Number(o.totalAmount || 0).toLocaleString('id-ID')}</td>
                                                <td className="small text-muted">{new Date(o.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td>
                                                <td><Badge bg={orderStatusConfig[o.status]?.bg || 'secondary'}>{orderStatusConfig[o.status]?.label || o.status}</Badge></td>
                                                <td>
                                                    <Button size="sm" variant="outline-primary" onClick={() => {
                                                        setSelectedOrder(o);
                                                        setNewStatus(o.status);
                                                        setShowOrderModal(true);
                                                    }}>Update</Button>
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

            {/* Modal Tambah/Edit Obat */}
            <Modal show={showMedModal} onHide={() => setShowMedModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{editingMed ? 'Edit Obat' : 'Tambah Obat Baru'}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSaveMed}>
                    <Modal.Body>
                        <Row className="g-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Nama Obat <span className="text-danger">*</span></Form.Label>
                                    <Form.Control value={medForm.name} onChange={e => setMedForm(f=>({...f,name:e.target.value}))} required placeholder="Contoh: Paracetamol 500mg" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Kategori</Form.Label>
                                    <Form.Control value={medForm.category} onChange={e => setMedForm(f=>({...f,category:e.target.value}))} placeholder="Analgesik, Antibiotik, dll" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Satuan</Form.Label>
                                    <Form.Select value={medForm.unit} onChange={e => setMedForm(f=>({...f,unit:e.target.value}))}>
                                        <option value="tablet">Tablet</option>
                                        <option value="kapsul">Kapsul</option>
                                        <option value="botol">Botol</option>
                                        <option value="sachet">Sachet</option>
                                        <option value="tube">Tube</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Harga (Rp) <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="number" min="0" value={medForm.price} onChange={e => setMedForm(f=>({...f,price:e.target.value}))} required />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Stok <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="number" min="0" value={medForm.stock} onChange={e => setMedForm(f=>({...f,stock:e.target.value}))} required />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold small">Deskripsi</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={medForm.description} onChange={e => setMedForm(f=>({...f,description:e.target.value}))} />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowMedModal(false)}>Batal</Button>
                        <Button type="submit" variant="primary" disabled={savingMed}>
                            {savingMed ? <Spinner size="sm" className="me-1" /> : null}
                            {editingMed ? 'Simpan Perubahan' : 'Tambah Obat'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal Update Status Pesanan */}
            <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Update Status Pesanan</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedOrder && (
                        <div>
                            <p className="mb-2 fw-semibold">{selectedOrder.userId?.name}</p>
                            <p className="small text-muted mb-3">ID: {selectedOrder._id}</p>
                            <Form.Group>
                                <Form.Label className="fw-semibold">Status Baru</Form.Label>
                                <Form.Select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                                    {Object.entries(orderStatusConfig).map(([k,v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowOrderModal(false)}>Batal</Button>
                    <Button variant="primary" onClick={handleUpdateOrderStatus} disabled={updatingOrder}>
                        {updatingOrder ? <Spinner size="sm" className="me-1" /> : null}Simpan
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ManagePharmacy;
