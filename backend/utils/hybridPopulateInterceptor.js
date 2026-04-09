const { User, Doctor, Medicine, Order } = require('../models/mysql');

/**
 * Deep scans an arbitrary object/array to find string identifiers (UUIDs) for 
 * doctorId, userId, medicineId, and auto-populates them from MySQL.
 *
 * FIX: Convert Mongoose documents to plain objects BEFORE scanning to avoid
 * circular getter loops (id <-> _id virtuals) that cause "Maximum call stack
 * size exceeded".
 */

function toPlain(val) {
    if (!val || typeof val !== 'object') return val;
    if (typeof val.toObject === 'function') {
        try { return val.toObject({ virtuals: false }); } catch (_) {}
    }
    return val;
}

async function deeplyPopulateFromMySQL(data, depth = 0) {
    if (!data || typeof data !== 'object') return data;
    if (depth > 10) return data;

    data = toPlain(data);

    if (Array.isArray(data)) {
        const plain = data.map(toPlain);
        await Promise.all(plain.map(item => deeplyPopulateFromMySQL(item, depth + 1)));
        return plain;
    }

    const needsFetch = { User: new Set(), Doctor: new Set(), Medicine: new Set(), Order: new Set() };
    const pathsToPatch = [];
    const visited = new WeakSet();

    function scan(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (visited.has(obj)) return;
        visited.add(obj);

        if (typeof obj.id === 'string' && obj._id === undefined) {
            obj._id = obj.id;
        }

        const keys = Object.keys(obj);
        for (const key of keys) {
            let val;
            try { val = obj[key]; } catch (_) { continue; }
            if (!val) continue;
            if (val instanceof Date || Buffer.isBuffer(val)) continue;

            const isUUID = typeof val === 'string' && val.length === 36 && val.includes('-');

            if (isUUID) {
                if (key === 'doctorId')                      { needsFetch.Doctor.add(val);   pathsToPatch.push({ obj, key, model: 'Doctor',   id: val }); }
                else if (key === 'userId' || key === 'patientId') { needsFetch.User.add(val); pathsToPatch.push({ obj, key, model: 'User',     id: val }); }
                else if (key === 'medicineId')               { needsFetch.Medicine.add(val); pathsToPatch.push({ obj, key, model: 'Medicine', id: val }); }
                else if (key === 'orderId')                  { needsFetch.Order.add(val);    pathsToPatch.push({ obj, key, model: 'Order',    id: val }); }
            } else if (typeof val === 'object') {
                const plainVal = toPlain(val);
                if (Array.isArray(plainVal)) {
                    plainVal.forEach(item => { if (item && typeof item === 'object') scan(toPlain(item)); });
                } else {
                    scan(plainVal);
                }
            }
        }
    }

    scan(data);

    const maps = { User: {}, Doctor: {}, Medicine: {}, Order: {} };

    await Promise.all(['User', 'Doctor', 'Medicine', 'Order'].map(async (modelName) => {
        const ids = Array.from(needsFetch[modelName]);
        if (ids.length === 0) return;

        const ModelMap = { User, Doctor, Medicine, Order };
        const records = await ModelMap[modelName].findAll({ where: { id: ids }, raw: true });
        for (const r of records) {
            r._id = r.id;
            if (modelName === 'User') {
                delete r.password;
                delete r.emailOtp;
                delete r.resetPasswordToken;
            }
            maps[modelName][r.id] = r;
        }
    }));

    for (const patch of pathsToPatch) {
        const record = maps[patch.model][patch.id];
        if (record) patch.obj[patch.key] = record;
    }

    for (const patch of pathsToPatch) {
        const record = maps[patch.model][patch.id];
        if (record && typeof record === 'object') {
            await deeplyPopulateFromMySQL(record, depth + 1);
        }
    }

    return data;
}

function hybridPopulateMiddleware(req, res, next) {
    const originalJson = res.json;
    res.json = function (body) {
        if (!body || typeof body !== 'object') {
            return originalJson.call(this, body);
        }
        deeplyPopulateFromMySQL(body)
            .then(patchedBody => { originalJson.call(this, patchedBody); })
            .catch(err => {
                console.error('Hybrid Populate Error:', err);
                originalJson.call(this, body);
            });
    };
    next();
}

module.exports = { deeplyPopulateFromMySQL, hybridPopulateMiddleware };