/**
 * doctor/shared.js
 * Konstanta, helper, dan komponen UI yang digunakan bersama
 * oleh semua section di Doctor Dashboard.
 */
import React from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—';
export const fmtDT = (d) => d
    ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
    : '—';
export const toMin  = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
export const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ─── Schedule ─────────────────────────────────────────────────────────────────
// Generator untuk slot 00:30 s.d 23:30 (Konsultasi Online)
const generateConsSlots = () => {
    const slots = [];
    for (let i = 0; i <= 23; i++) {
        slots.push(`${String(i).padStart(2, '0')}:30`);
    }
    return slots;
};

export const CONS_SLOTS = generateConsSlots();
export const APPT_SLOTS = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00'];

export const DAYS_INFO = [
    { val: 1, label: 'Senin' },
    { val: 2, label: 'Selasa' },
    { val: 3, label: 'Rabu' },
    { val: 4, label: 'Kamis' },
    { val: 5, label: 'Jumat' },
    { val: 6, label: 'Sabtu' },
];

export const makeEmptySchedule = () => ({ '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] });

export const DEF_CONS = { schedule: makeEmptySchedule(), isActive: true };
export const DEF_APPT = { schedule: makeEmptySchedule(), isActive: true };

// ─── Status maps ──────────────────────────────────────────────────────────────
export const CONS_STATUS = {
    pending_payment    : { label: 'Menunggu Bayar',    color: '#b45309', bg: '#fffbeb' },
    confirmed          : { label: 'Terkonfirmasi',     color: '#1d4ed8', bg: '#eff6ff' },
    in_progress        : { label: '🟢 Berlangsung',    color: '#15803d', bg: '#f0fdf4' },
    completed          : { label: 'Selesai',           color: '#0e7490', bg: '#ecfeff' },
    no_show            : { label: 'Tdk Hadir',         color: '#b45309', bg: '#fffbeb' },
    cancelled_by_doctor: { label: 'Dibatalkan',        color: '#b91c1c', bg: '#fef2f2' },
    expired            : { label: 'Kadaluarsa',        color: '#6b7280', bg: '#f3f4f6' },
    paid               : { label: 'Terkonfirmasi',     color: '#1d4ed8', bg: '#eff6ff' },
    scheduled          : { label: 'Terjadwal',         color: '#7e22ce', bg: '#f5f3ff' },
    ongoing            : { label: '🟢 Berlangsung',    color: '#15803d', bg: '#f0fdf4' },
};
export const APPT_STATUS = {
    scheduled           : { label: '📅 Terjadwal',    color: '#1d4ed8', bg: '#eff6ff' },
    checked_in          : { label: '✅ Hadir',         color: '#166534', bg: '#dcfce7' },
    completed           : { label: '🏁 Selesai',       color: '#0e7490', bg: '#ecfeff' },
    no_show             : { label: '❌ Tdk Hadir',     color: '#b45309', bg: '#fffbeb' },
    cancelled_by_user   : { label: '🚫 Batal (User)',  color: '#6b7280', bg: '#f3f4f6' },
    cancelled_by_doctor : { label: '🚫 Batal (Dokter)',color: '#b91c1c', bg: '#fef2f2' },
};

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

export const colors = {
    primary : '#2563eb', primaryDark: '#1d4ed8',
    success : '#059669', successDark: '#047857',
    danger  : '#ef4444', dangerDark : '#dc2626',
    warning : '#f59e0b',
    sidebar : '#0f172a', sidebarHover: '#1e293b',
    bg      : '#f8fafc', card: '#ffffff',
    text    : '#0f172a', muted: '#64748b', subtle: '#94a3b8',
    border  : '#e2e8f0',
};

export const Card = ({ children, style = {} }) => (
    <div style={{ background: colors.card, borderRadius: 14, border: `1px solid ${colors.border}`, ...style }}>
        {children}
    </div>
);

export const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, style = {}, type = 'button' }) => {
    const base = {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: 'none', borderRadius: 9, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'opacity .15s',
        opacity: disabled ? 0.55 : 1,
        padding: size === 'sm' ? '5px 13px' : size === 'lg' ? '12px 26px' : '8px 18px',
        fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
    };
    const variants = {
        primary    : { background: colors.primary, color: '#fff' },
        success    : { background: colors.success, color: '#fff' },
        danger     : { background: colors.danger,  color: '#fff' },
        warning    : { background: colors.warning, color: '#fff' },
        ghost      : { background: '#f1f5f9', color: colors.text },
        outline    : { background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}` },
        red_outline: { background: 'transparent', color: colors.danger,  border: `1px solid ${colors.danger}` },
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...(variants[variant] || variants.primary), ...style }}>
            {children}
        </button>
    );
};

export const Spinner = ({ size = 32 }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: size, height: size, border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
);

export const Empty = ({ icon = '📭', text = 'Tidak ada data' }) => (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.muted }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14 }}>{text}</div>
    </div>
);

export const SBadge = ({ status, map }) => {
    const cfg = map[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
    return (
        <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25`, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {cfg.label}
        </span>
    );
};

export const Toggle = ({ checked, onChange, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onChange}>
        <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background .2s', background: checked ? colors.success : '#cbd5e1' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
        </div>
        {label && <span style={{ fontSize: 13, fontWeight: 600, color: checked ? colors.success : colors.muted }}>{label}</span>}
    </div>
);

export const Modal = ({ open, onClose, title, children, width = 520 }) => {
    if (!open) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.22)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>{title}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: colors.muted, lineHeight: 1 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
};

export const SectionHeader = ({ title, subtitle, action }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.muted }}>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
    </div>
);

export const ScheduleGrid = ({ schedule, allowedSlots, onChange, color = colors.primary }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAYS_INFO.map(day => {
            const key       = String(day.val);
            const activeSet = new Set(schedule[key] || []);
            const hasAny    = activeSet.size > 0;
            return (
                <div key={day.val} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: hasAny ? `${color}08` : '#f8fafc', border: `1px solid ${hasAny ? color + '30' : colors.border}`, transition: 'all .15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: hasAny ? color : colors.muted }}>{day.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {allowedSlots.map(slot => {
                            const active = activeSet.has(slot);
                            return (
                                <button key={slot} type="button" onClick={() => onChange(key, slot)} style={{ padding: '5px 11px', borderRadius: 7, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', border: `2px solid ${active ? color : colors.border}`, background: active ? color : '#fff', color: active ? '#fff' : colors.muted }}>
                                    {slot}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        })}
    </div>
);

export const SchedulePreview = ({ schedule, color = colors.primary }) => {
    const activeDays = DAYS_INFO.filter(d => (schedule[String(d.val)] || []).length > 0);
    if (activeDays.length === 0) return (
        <div style={{ fontSize: 12, color: colors.danger, padding: '10px 0' }}>⚠ Belum ada slot yang dipilih</div>
    );
    const total = activeDays.reduce((s, d) => s + (schedule[String(d.val)] || []).length, 0);
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeDays.map(day => {
                    const slots = schedule[String(day.val)] || [];
                    return (
                        <div key={day.val} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 52 }}>{day.label}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {slots.map(s => (
                                    <span key={s} style={{ background: `${color}15`, color, border: `1px solid ${color}30`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                        {s} WIB
                                    </span>
                                ))}
                            </div>
                            <span style={{ fontSize: 11, color: colors.muted }}>({slots.length} slot)</span>
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.muted, fontWeight: 600 }}>Total: {total} slot/minggu</div>
        </div>
    );
};

export const TH = { padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: colors.muted, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' };
export const TD = { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' };

// ─── Reusable form field components ──────────────────────────────────────────

export const ProfileField = ({ label, value, onChange, placeholder, required, hint, type = 'text' }) => (
    <div>
        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>
            {label}{required && <span style={{ color: colors.danger }}> *</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || label}
            style={{ width: '100%', padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: 9, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        {hint && <div style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>{hint}</div>}
    </div>
);

export const InputField = ({ label, value, onChange, placeholder, required, type = 'text' }) => (
    <div>
        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: colors.muted }}>
            {label}{required && <span style={{ color: colors.danger }}> *</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || label}
            style={{ width: '100%', padding: '8px 11px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
    </div>
);