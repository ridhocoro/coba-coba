const { User, Doctor, Medicine, Order } = require('../models/mysql');

/**
 * Deep scans an arbitrary object/array to find string identifiers (UUIDs) for 
 * doctorId, userId, medicineId, and auto-populates them from MySQL.
 * Designed to be generic and fail-safe.
 */
async function deeplyPopulateFromMySQL(data, depth = 0) {
    if (!data || typeof data !== 'object') return data;
    if (depth > 10) return data; // Prevent infinite recursion

    if (Array.isArray(data)) {
        await Promise.all(data.map(item => deeplyPopulateFromMySQL(item, depth + 1)));
        return data;
    }

    // Collect IDs to fetch
    const needsFetch = { User: new Set(), Doctor: new Set(), Medicine: new Set(), Order: new Set() };
    const pathsToPatch = [];

    // Local scan helper
    function scan(obj, currentPath) {
        if (!obj || typeof obj !== 'object') return;
        
        // Auto-alias id -> _id for frontend compatibility
        if (obj.id && obj._id === undefined && typeof obj.id === 'string') {
            obj._id = obj.id;
        }

        for (const [key, val] of Object.entries(obj)) {
            if (!val) continue;

            const isUUID = typeof val === 'string' && val.length === 36 && val.includes('-');
            
            if (isUUID) {
                if (key === 'doctorId') { needsFetch.Doctor.add(val); pathsToPatch.push({ obj, key, model: 'Doctor', id: val }); }
                else if (key === 'userId' || key === 'patientId') { needsFetch.User.add(val); pathsToPatch.push({ obj, key, model: 'User', id: val }); }
                else if (key === 'medicineId') { needsFetch.Medicine.add(val); pathsToPatch.push({ obj, key, model: 'Medicine', id: val }); }
                else if (key === 'orderId') { needsFetch.Order.add(val); pathsToPatch.push({ obj, key, model: 'Order', id: val }); }
            } else if (typeof val === 'object') {
                // If it's a Buffer or Date, ignore
                if (!(val instanceof Date) && !Buffer.isBuffer(val)) {
                    scan(val, currentPath + '.' + key);
                }
            }
        }
    }

    scan(data, 'root');

    // Fetch and Build Maps
    const maps = { User: {}, Doctor: {}, Medicine: {}, Order: {} };
    
    await Promise.all(['User', 'Doctor', 'Medicine', 'Order'].map(async (modelName) => {
        const ids = Array.from(needsFetch[modelName]);
        if (ids.length === 0) return;

        let Model;
        if (modelName === 'User') Model = User;
        if (modelName === 'Doctor') Model = Doctor;
        if (modelName === 'Medicine') Model = Medicine;
        if (modelName === 'Order') Model = Order;

        const records = await Model.findAll({ where: { id: ids }, raw: true });
        for (const r of records) {
            r._id = r.id; // Map id to _id
            if (modelName === 'Doctor' && r.userId) {
                // Pre-fetch nested doctor user? Too complex for generic middleware.
                // Just let another pass handle it if needed.
            }
            // Remove sensitive info just in case
            if (modelName === 'User') {
                delete r.password;
                delete r.emailOtp;
                delete r.resetPasswordToken;
            }
            maps[modelName][r.id] = r;
        }
    }));

    // Patch objects
    for (const patch of pathsToPatch) {
        const record = maps[patch.model][patch.id];
        if (record) {
            patch.obj[patch.key] = record;
        }
    }

    // Secondary scan for newly attached nested UUIDs (like doctor.userId)
    for (const patch of pathsToPatch) {
        const record = maps[patch.model][patch.id];
        if (record && typeof record === 'object') {
             await deeplyPopulateFromMySQL(record, depth + 1);
        }
    }

    return data;
}

/**
 * Express middleware to intercept res.json and deeply populate MySQL relationships inside 
 * JSON responses that come from Mongoose.
 */
function hybridPopulateMiddleware(req, res, next) {
    const originalJson = res.json;
    res.json = function (body) {
        // Prevent recursive calls or non-objects
        if (!body || typeof body !== 'object') {
            return originalJson.call(this, body);
        }

        // We run population asynchronously, but res.json is synchronous in Express.
        // We must hold the response until promise resolves.
        deeplyPopulateFromMySQL(body)
            .then(patchedBody => {
                originalJson.call(this, patchedBody);
            })
            .catch(err => {
                console.error("Hybrid Populate Error:", err);
                originalJson.call(this, body); // Fallback to unpopulated
            });
    };
    next();
}

module.exports = { deeplyPopulateFromMySQL, hybridPopulateMiddleware };
