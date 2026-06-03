/**
 * frontend/src/utils/cache.js
 *
 * Semua cache disimpan sebagai module-level variable (in-memory),
 * bukan sessionStorage. Nilainya TETAP ada saat React unmount/mount
 * komponen (pindah route), sehingga halaman langsung tampil tanpa
 * menunggu API maupun parse JSON.
 *
 * getCache / setCache / hasCache → dipakai komponen Admin
 * consultCache / apptCache       → dipakai Consultations & Appointments
 */

// ── Generic key-value store (pengganti sessionStorage) ────────────────────────
const store = {};

export const getCache = (key, defaultVal) => {
    return key in store ? store[key] : defaultVal;
};

export const setCache = (key, value) => {
    store[key] = value;
};

export const hasCache = (key) => {
    return key in store;
};

export const clearCache = (key) => {
    delete store[key];
};

// ── In-memory cache untuk Consultations & Appointments (user pages) ───────────
const FRESH_MS = 30 * 1000; // 30 detik dianggap fresh

const memoryCache = {
    consultations: { doctors: null, consultations: null, fetchedAt: null },
    appointments:  { doctors: null, appointments: null,  fetchedAt: null },
};

export const consultCache = {
    get() { return memoryCache.consultations; },
    set(doctors, consultations) {
        memoryCache.consultations = { doctors, consultations, fetchedAt: Date.now() };
    },
    isFresh() {
        return memoryCache.consultations.fetchedAt !== null
            && (Date.now() - memoryCache.consultations.fetchedAt) < FRESH_MS;
    },
    clear() {
        memoryCache.consultations = { doctors: null, consultations: null, fetchedAt: null };
    },
};

export const apptCache = {
    get() { return memoryCache.appointments; },
    set(doctors, appointments) {
        memoryCache.appointments = { doctors, appointments, fetchedAt: Date.now() };
    },
    isFresh() {
        return memoryCache.appointments.fetchedAt !== null
            && (Date.now() - memoryCache.appointments.fetchedAt) < FRESH_MS;
    },
    clear() {
        memoryCache.appointments = { doctors: null, appointments: null, fetchedAt: null };
    },
};