import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, Modal, Image } from 'react-bootstrap';
import api, { API_URL } from '../../utils/api';
import { toast } from 'react-hot-toast';

const ManualPayments = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchPendingPayments();
    }, []);

    const fetchPendingPayments = async () => {
        try {
            const response = await api.get(
                '/api/manual-payment/admin/pending'
            );
            setPayments(response.data.payments);
        } catch (error) {
            toast.error('Gagal memuat data pembayaran');
        } finally {
            setLoading(false);
        }
    };

    const verifyPayment = async (paymentId, status, notes) => {
        try {
            await api.put(
                `/api/manual-payment/admin/verify/${paymentId}`,
                { status, notes }
            );
            toast.success(`Pembayaran ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`);
            fetchPendingPayments();
            setShowModal(false);
        } catch (error) {
            toast.error('Gagal memproses verifikasi');
        }
    };

    const viewProof = (payment) => {
        setSelectedPayment(payment);
        setShowModal(true);
    };

    return (
        <Container>
            <h3 className="mb-4">Verifikasi Pembayaran Manual</h3>
            
            <Table striped bordered hover>
                <thead>
                    <tr>
                        <th>ID Transaksi</th>
                        <th>User</th>
                        <th>Jumlah</th>
                        <th>Tipe</th>
                        <th>Bank</th>
                        <th>Tanggal Transfer</th>
                        <th>Bukti</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map(p => (
                        <tr key={p._id}>
                            <td><code>{p.transactionId}</code></td>
                            <td>{p.userId?.name}</td>
                            <td>Rp {p.amount.toLocaleString()}</td>
                            <td>{p.paymentType}</td>
                            <td>{p.bankName}</td>
                            <td>{new Date(p.transferDate).toLocaleDateString()}</td>
                            <td>
                                <Button 
                                    size="sm" 
                                    variant="info"
                                    onClick={() => viewProof(p)}
                                >
                                    Lihat Bukti
                                </Button>
                            </td>
                            <td>
                                <Button 
                                    size="sm" 
                                    variant="success" 
                                    className="me-2"
                                    onClick={() => verifyPayment(p._id, 'verified', 'OK')}
                                >
                                    Verifikasi
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="danger"
                                    onClick={() => verifyPayment(p._id, 'rejected', 'Bukti tidak jelas')}
                                >
                                    Tolak
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {/* Modal Lihat Bukti */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Bukti Transfer</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedPayment && (
                        <>
                            <p>
                                <strong>ID Transaksi:</strong> {selectedPayment.transactionId}
                            </p>
                            <Image 
                                src={`${API_URL}${selectedPayment.transferProof}`}
                                fluid
                            />
                        </>
                    )}
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default ManualPayments;