const { User, Doctor, Medicine, Order } = require('../models/mysql');

/**
 * Mutates an array of Mongoose JSON objects (or single object) by fetching related MySQL data.
 * @param {Array|Object} docs - Mongoose documents (MUST BE .lean() or .toJSON() already!)
 * @param {String|Array} path - The field containing the ID or array of fields. If array, multiple populates are run sequentially.
 * @param {String} modelName - 'User', 'Doctor', 'Medicine', 'Order'
 * @param {Array|String} attributes - Columns to fetch e.g., ['id', 'name', 'specialization'], or space-separated string
 */
async function populateFromMySQL(docs, path, modelName, attributes) {
    if (!docs) return docs;
    const isArray = Array.isArray(docs);
    const docArr = isArray ? docs : [docs];
    if (docArr.length === 0) return docArr;

    if (Array.isArray(path)) {
        for (const p of path) {
            await populateFromMySQL(docArr, p.field, p.model, p.attributes);
        }
        return isArray ? docArr : docArr[0];
    }

    // Convert string attributes to array
    if (typeof attributes === 'string') {
        attributes = attributes.split(' ').filter(Boolean);
    }
    // Always fetch 'id' for mapping
    if (attributes && Array.isArray(attributes) && !attributes.includes('id')) {
        attributes.push('id');
    }

    // Collect unique IDs
    const ids = [];
    for (const d of docArr) {
        if (!d) continue;
        const val = d[path];
        if (val) {
            if (typeof val === 'string' || typeof val === 'number') ids.push(val);
            else if (val.toString) ids.push(val.toString());
        }
    }
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return isArray ? docArr : docArr[0];

    // Fetch from MySQL
    let Model;
    if (modelName === 'User') Model = User;
    else if (modelName === 'Doctor') Model = Doctor;
    else if (modelName === 'Medicine') Model = Medicine;
    else if (modelName === 'Order') Model = Order;
    else return isArray ? docArr : docArr[0];

    const records = await Model.findAll({
        where: { id: uniqueIds },
        attributes: attributes && attributes.length > 0 ? attributes : undefined,
        raw: true
    });

    // Create map for O(1) lookup
    const map = {};
    for (const r of records) {
        // Map alias _id to id for frontend compatibility
        r._id = r.id; 
        map[r.id] = r;
    }

    // Attach to docs
    for (const d of docArr) {
        if (!d) continue;
        const val = d[path];
        const id = val && val.toString ? val.toString() : val;
        
        if (id && map[id]) {
            d[path] = map[id];
        } else if (id && typeof id === 'string') {
            d[path] = null; // simulate mongoose missing ref
        }
    }

    return isArray ? docArr : docArr[0];
}

module.exports = { populateFromMySQL };
