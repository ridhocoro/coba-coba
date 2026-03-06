/**
 * PaymentResult.jsx
 * Halaman hasil pembayaran setelah redirect dari Xendit.
 *
 * Routes di App.js:
 *   <Route path="/payment/success" element={<PaymentResult />} />
 *   <Route path="/payment/failed"  element={<PaymentResult />} />
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';

const S = {
    page : { minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: 16 },
    card : { background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: '40px 32px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' },
    btn  : (primary) => ({
        padding: '11px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
        background: primary ? '#2563eb' : '#f3f4f6', color: primary ? '#fff' : '#374151',
    }),
};

const Spinner = () => (
    <div style={{ width: 48, height: 48, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const PaymentResult = () => {
    const [params]   = useSearchParams();
    const navigate   = useNavigate();
    const location   = useLocation();

    const [status, setStatus]   = useState('checking'); // checking | paid | failed | unknown
    const [type, setType]       = useState(null);
    const [refId, setRefId]     = useState(null);

    const externalId = params.get('external_id');
    const isSuccessPath = location.pathname.includes('success');

    useEffect(() => {
        if (!externalId) {
            setStatus(isSuccessPath ? 'paid' : 'failed');
            return;
        }

        const check = async () => {
            try {
                const res = await api.get(`/api/xendit/status/${externalId}`);
                const data = res.data;
                setType(data.type);
                setRefId(data.consultation?._id || data.payment?.referenceId);

                if (data.status === 'paid' || isSuccessPath) {
                    setStatus('paid');
                } else if (['expired','failed'].includes(data.status)) {
                    setStatus('failed');
                } else {
                    // Mungkin sedang diproses Xendit
                    setStatus(isSuccessPath ? 'paid' : 'pending');
                }
            } catch {
                setStatus(isSuccessPath ? 'paid' : 'failed');
            }
        };

        check();
    }, [externalId, isSuccessPath]);

    if (status === 'checking') return (
        <div style={S.page}>
            <div style={S.card}>
                <Spinner />
                <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Memverifikasi Pembayaran</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Mohon tunggu sebentar...</div>
            </div>
        </div>
    );

    if (status === 'paid') return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={{ fontSize: 64, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#111827', marginBottom: 8 }}>Pembayaran Berhasil!</div>
                <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
                    Pembayaran Anda telah dikonfirmasi secara otomatis oleh sistem.
                </div>
                {type === 'consultation' && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#166534' }}>
                        📅 Konsultasi Anda telah terkonfirmasi. Sistem akan otomatis memulai sesi saat waktu konsultasi tiba.
                    </div>
                )}
                {externalId && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
                        ID: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{externalId}</code>
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {refId && type === 'consultation' && (
                        <button style={S.btn(true)} onClick={() => navigate(`/consultations`)}>
                            Lihat Konsultasi
                        </button>
                    )}
                    <button style={S.btn(!refId || type !== 'consultation')} onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    );

    if (status === 'pending') return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={{ fontSize: 64, marginBottom: 8 }}>⏳</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#111827', marginBottom: 8 }}>Pembayaran Diproses</div>
                <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                    Pembayaran Anda sedang diverifikasi. Halaman akan otomatis update saat konfirmasi diterima.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button style={S.btn(true)} onClick={() => navigate('/consultations')}>
                        Lihat Konsultasi
                    </button>
                </div>
            </div>
        </div>
    );

    // failed
    return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={{ fontSize: 64, marginBottom: 8 }}>❌</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#111827', marginBottom: 8 }}>Pembayaran Gagal</div>
                <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
                    Pembayaran tidak berhasil atau waktu pembayaran habis (15 menit).
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#991b1b' }}>
                    Slot yang Anda pilih telah dibebaskan dan bisa diambil kembali. Silakan booking ulang.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button style={S.btn(true)} onClick={() => navigate('/consultations')}>
                        Booking Ulang
                    </button>
                    <button style={S.btn(false)} onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentResult;
