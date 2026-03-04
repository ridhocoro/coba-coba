import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Spinner, Alert, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaSave, FaCalendarAlt, FaClock, FaCoffee, FaInfoCircle } from 'react-icons/fa';
import api from '../../utils/api';

const DAYS = [
    { value: 0, label: 'Minggu' },
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
];

const toMinutes = (hhmm) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return h * 60 + m;
};

// Preview slot berdasarkan pengaturan form (sama persis dengan logic backend)
const generatePreviewSlots = (startTime, endTime, lunchStart, lunchEnd) => {
    const slots = [];
    const SESSION = 30, INTERVAL = 60;
    let cur = toMinutes(startTime);
    const end = toMinutes(endTime);
    const lS  = toMinutes(lunchStart);
    const lE  = toMinutes(lunchEnd);

    while (cur + SESSION <= end) {
        if (cur >= lS && cur < lE)         { cur = lE; continue; }
        if (cur < lS && cur + SESSION > lS){ cur = lE; continue; }
        if (cur + SESSION > end) break;
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
        cur += INTERVAL;
    }
    return slots;
};

const DEFAULT_FORM = {
    practiceDays:    [1, 2, 3, 4, 5],
    startTime:       '08:00',
    endTime:         '16:00',
    lunchBreakStart: '12:00',
    lunchBreakEnd:   '13:00',
    isActive:        true,
};

const DoctorAvailability = () => {
    const [form, setForm]       = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [isNew, setIsNew]     = useState(false); // true = belum pernah setup

    useEffect(() => {
        api.get('/api/availability/my')
            .then(r => {
                const a = r.data.availability;
                if (!a) {
                    // Belum pernah setup
                    setIsNew(true);
                    setForm(DEFAULT_FORM);
                } else {
                    setIsNew(false);
                    setForm({
                        practiceDays:    a.practiceDays    || [1,2,3,4,5],
                        startTime:       a.startTime       || '08:00',
                        endTime:         a.endTime         || '16:00',
                        lunchBreakStart: a.lunchBreakStart || '12:00',
                        lunchBreakEnd:   a.lunchBreakEnd   || '13:00',
                        isActive:        a.isActive !== false,
                    });
                }
            })
            .catch(() => toast.error('Gagal memuat pengaturan jadwal'))
            .finally(() => setLoading(false));
    }, []);

    const toggleDay = (day) => {
        setForm(f => ({
            ...f,
            practiceDays: f.practiceDays.includes(day)
                ? f.practiceDays.filter(d => d !== day)
                : [...f.practiceDays, day].sort()
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (form.practiceDays.length === 0) {
            toast.error('Pilih minimal satu hari praktik');
            return;
        }
        if (toMinutes(form.startTime) >= toMinutes(form.endTime)) {
            toast.error('Jam mulai harus sebelum jam selesai');
            return;
        }
        if (previewSlots.length === 0) {
            toast.error('Pengaturan ini tidak menghasilkan slot apapun');
            return;
        }
        setSaving(true);
        try {
            await api.put('/api/availability/my', form);
            toast.success('Jadwal praktik berhasil disimpan!');
            setIsNew(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    const previewSlots = generatePreviewSlots(
        form.startTime, form.endTime, form.lunchBreakStart, form.lunchBreakEnd
    );

    if (loading) return (
        <Container className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
        </Container>
    );

    return (
        <Container className="py-4" style={{ maxWidth: 680 }}>
            <Button as={Link} to="/doctor" variant="link" className="p-0 text-muted mb-3 d-block">
                <FaArrowLeft className="me-1" /> Dashboard
            </Button>
            <h4 className="fw-bold mb-1">
                <FaCalendarAlt className="me-2 text-primary" />
                Jadwal Praktik
            </h4>
            <p className="text-muted small mb-4">
                Sistem membuat slot konsultasi 7 hari ke depan berdasarkan pengaturan ini.
                Setiap slot berdurasi <strong>30 menit</strong> + buffer 30 menit antar sesi.
            </p>

            {isNew && (
                <Alert variant="warning" className="d-flex align-items-start gap-2 mb-3">
                    <FaInfoCircle className="mt-1 flex-shrink-0" />
                    <div>
                        <strong>Jadwal belum diatur.</strong> Pasien belum bisa melihat slot konsultasi Anda.
                        Isi pengaturan di bawah lalu klik <strong>Simpan Jadwal</strong>.
                    </div>
                </Alert>
            )}

            <Form onSubmit={handleSave}>
                {/* Hari Praktik */}
                <Card className="border-0 shadow-sm mb-3">
                    <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">
                            <FaCalendarAlt className="me-2 text-primary" /> Hari Praktik
                        </h6>
                        <div className="d-flex flex-wrap gap-2">
                            {DAYS.map(d => (
                                <Button
                                    key={d.value}
                                    type="button"
                                    variant={form.practiceDays.includes(d.value) ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => toggleDay(d.value)}
                                    style={{ borderRadius: 20, minWidth: 80 }}
                                >
                                    {d.label}
                                </Button>
                            ))}
                        </div>
                        {form.practiceDays.length === 0 && (
                            <Alert variant="danger" className="mt-2 py-2 small mb-0">
                                Pilih minimal satu hari praktik
                            </Alert>
                        )}
                    </Card.Body>
                </Card>

                {/* Jam Praktik */}
                <Card className="border-0 shadow-sm mb-3">
                    <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">
                            <FaClock className="me-2 text-success" /> Jam Praktik (WIB)
                        </h6>
                        <Row className="g-3">
                            <Col sm={6}>
                                <Form.Label className="text-muted small fw-semibold">Jam Mulai</Form.Label>
                                <Form.Control
                                    type="time"
                                    value={form.startTime}
                                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                                    required
                                />
                            </Col>
                            <Col sm={6}>
                                <Form.Label className="text-muted small fw-semibold">Jam Selesai</Form.Label>
                                <Form.Control
                                    type="time"
                                    value={form.endTime}
                                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                                    required
                                />
                            </Col>
                        </Row>
                        {toMinutes(form.startTime) >= toMinutes(form.endTime) && (
                            <Alert variant="danger" className="mt-2 py-2 small mb-0">
                                Jam mulai harus sebelum jam selesai
                            </Alert>
                        )}
                    </Card.Body>
                </Card>

                {/* Break Siang */}
                <Card className="border-0 shadow-sm mb-3">
                    <Card.Body className="p-4">
                        <h6 className="fw-bold mb-3">
                            <FaCoffee className="me-2 text-warning" /> Break Siang (WIB)
                        </h6>
                        <Row className="g-3">
                            <Col sm={6}>
                                <Form.Label className="text-muted small fw-semibold">Mulai Break</Form.Label>
                                <Form.Control
                                    type="time"
                                    value={form.lunchBreakStart}
                                    onChange={e => setForm(f => ({ ...f, lunchBreakStart: e.target.value }))}
                                />
                            </Col>
                            <Col sm={6}>
                                <Form.Label className="text-muted small fw-semibold">Selesai Break</Form.Label>
                                <Form.Control
                                    type="time"
                                    value={form.lunchBreakEnd}
                                    onChange={e => setForm(f => ({ ...f, lunchBreakEnd: e.target.value }))}
                                />
                            </Col>
                        </Row>
                        <Form.Text className="text-muted">
                            Slot pada jam break tidak tersedia untuk pasien.
                        </Form.Text>
                    </Card.Body>
                </Card>

                {/* Status Aktif */}
                <Card className="border-0 shadow-sm mb-3">
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="fw-semibold">Terima Konsultasi</div>
                                <div className="text-muted small">
                                    Nonaktifkan untuk sementara berhenti menerima pasien baru
                                </div>
                            </div>
                            <Form.Check
                                type="switch"
                                id="isActive-switch"
                                checked={form.isActive}
                                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                            />
                        </div>
                    </Card.Body>
                </Card>

                {/* Preview Slot */}
                <Card className="border-0 shadow-sm mb-4" style={{ background: '#f8f9fa' }}>
                    <Card.Body className="p-4">
                        <h6 className="fw-bold mb-2">Preview Slot yang Akan Dibuat</h6>
                        <p className="text-muted small mb-3">
                            Pasien dapat memilih slot berikut setiap harinya:
                        </p>
                        {previewSlots.length === 0 ? (
                            <Alert variant="warning" className="py-2 small mb-0">
                                Tidak ada slot yang dapat dibuat dengan pengaturan ini
                            </Alert>
                        ) : (
                            <div className="d-flex flex-wrap gap-2">
                                {previewSlots.map(slot => (
                                    <Badge
                                        key={slot}
                                        bg="primary"
                                        style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8 }}
                                    >
                                        {slot} WIB
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="text-muted small mt-2">
                            Total: <strong>{previewSlots.length} slot/hari</strong>
                            {' '}(30 mnt sesi + 30 mnt buffer · break {form.lunchBreakStart}–{form.lunchBreakEnd})
                        </div>
                    </Card.Body>
                </Card>

                <div className="d-flex justify-content-end">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={saving || form.practiceDays.length === 0 || previewSlots.length === 0}
                        style={{ minWidth: 160 }}
                    >
                        {saving
                            ? <><Spinner size="sm" className="me-1" />Menyimpan...</>
                            : <><FaSave className="me-1" />Simpan Jadwal</>
                        }
                    </Button>
                </div>
            </Form>
        </Container>
    );
};

export default DoctorAvailability;
