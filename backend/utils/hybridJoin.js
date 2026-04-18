// utils/hybridJoin.js
const { User, Doctor, Medicine, Order, Payment } = require('../models/mysql');

/**
 * Mutates an array of Mongoose JSON objects (or single object) by fetching related MySQL data.
 * @param {Array|Object} docs - Mongoose documents (MUST BE .lean() or .toJSON() already!)
 * @param {String|Array} path - The field containing the ID or array of fields. If array, multiple populates are run sequentially.
 * @param {String} modelName - 'User', 'Doctor', 'Medicine', 'Order', 'Payment'
 * @param {Array|String} attributes - Columns to fetch e.g., ['id', 'name', 'specialization'], or space-separated string
 * @returns {Promise<Array|Object>} - The populated documents
 */
async function populateFromMySQL(docs, path, modelName, attributes) {
    if (!docs) return docs;
    
    // Handle empty array
    const isArray = Array.isArray(docs);
    const docArr = isArray ? docs : [docs];
    if (docArr.length === 0) return docArr;

    // Handle multiple populate paths sequentially
    if (Array.isArray(path)) {
        for (const p of path) {
            await populateFromMySQL(docArr, p.field, p.model, p.attributes);
        }
        return isArray ? docArr : docArr[0];
    }

    // Convert string attributes to array
    let attrs = null;
    if (typeof attributes === 'string') {
        attrs = attributes.split(/\s+/).filter(Boolean);
    } else if (Array.isArray(attributes)) {
        attrs = [...attributes];
    }
    
    // Always fetch 'id' for mapping
    if (attrs && !attrs.includes('id')) {
        attrs.push('id');
    }

    // Collect unique IDs from the specified field
    const ids = [];
    for (const d of docArr) {
        if (!d) continue;
        const val = d[path];
        if (val) {
            if (typeof val === 'string' || typeof val === 'number') {
                ids.push(val.toString());
            } else if (val && val.toString) {
                ids.push(val.toString());
            }
        }
    }
    
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
        return isArray ? docArr : docArr[0];
    }

    // Get the appropriate MySQL Model
    let Model;
    switch (modelName) {
        case 'User':
            Model = User;
            break;
        case 'Doctor':
            Model = Doctor;
            break;
        case 'Medicine':
            Model = Medicine;
            break;
        case 'Order':
            Model = Order;
            break;
        case 'Payment':
            Model = Payment;
            break;
        default:
            console.warn(`[hybridJoin] Unknown MySQL model: ${modelName}`);
            return isArray ? docArr : docArr[0];
    }

    // Fetch records from MySQL
    let records = [];
    try {
        records = await Model.findAll({
            where: { id: uniqueIds },
            attributes: attrs && attrs.length > 0 ? attrs : undefined,
            raw: true
        });
    } catch (err) {
        console.error(`[hybridJoin] Error fetching from ${modelName}:`, err.message);
        return isArray ? docArr : docArr[0];
    }

    // Create map for O(1) lookup
    const map = {};
    for (const r of records) {
        // Map alias _id to id for frontend compatibility
        const record = { ...r };
        record._id = r.id;
        
        // Format doctor name if needed (for Doctor model)
        if (modelName === 'Doctor') {
            record.formattedName = formatDoctorName(r);
        }
        
        map[r.id] = record;
    }

    // Attach MySQL data to each document
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

/**
 * Helper function to format doctor name with title prefix and suffix
 * @param {Object} doctor - Doctor object from MySQL
 * @returns {string} - Formatted doctor name
 */
function formatDoctorName(doctor) {
    if (!doctor) return '';
    let name = '';
    if (doctor.titlePrefix) name += doctor.titlePrefix + ' ';
    name += doctor.name || '';
    if (doctor.titleSuffix) name += ', ' + doctor.titleSuffix;
    return name.trim();
}

/**
 * Populate multiple fields at once with different models
 * @param {Array|Object} docs - Documents to populate
 * @param {Array} populates - Array of populate configurations
 * @returns {Promise<Array|Object>}
 */
async function populateMany(docs, populates) {
    if (!docs || !populates || !populates.length) return docs;
    
    for (const pop of populates) {
        await populateFromMySQL(docs, pop.field, pop.model, pop.attributes);
    }
    return docs;
}

/**
 * Format doctor names in an array of documents
 * @param {Array} docs - Array of documents with doctorId field
 * @returns {Array} - Documents with formatted doctor name
 */
async function formatDoctorNames(docs) {
    if (!docs || !docs.length) return docs;
    
    // Populate doctor data first
    await populateFromMySQL(docs, 'doctorId', 'Doctor', 'id name titlePrefix titleSuffix specialization');
    
    // Add formatted name to each document
    for (const doc of docs) {
        if (doc.doctorId && doc.doctorId.formattedName) {
            doc.doctorFormattedName = doc.doctorId.formattedName;
        } else if (doc.doctorId) {
            doc.doctorFormattedName = formatDoctorName(doc.doctorId);
        }
    }
    
    return docs;
}

/**
 * Get MySQL model by name
 * @param {string} modelName - Name of the model
 * @returns {Model|null} - Sequelize model or null if not found
 */
function getModel(modelName) {
    switch (modelName) {
        case 'User': return User;
        case 'Doctor': return Doctor;
        case 'Medicine': return Medicine;
        case 'Order': return Order;
        case 'Payment': return Payment;
        default: return null;
    }
}

/**
 * Populate a single document with MySQL data
 * @param {Object} doc - Single document
 * @param {string} field - Field containing the ID
 * @param {string} modelName - MySQL model name
 * @param {Array|string} attributes - Attributes to fetch
 * @returns {Promise<Object>}
 */
async function populateOne(doc, field, modelName, attributes) {
    if (!doc) return doc;
    const result = await populateFromMySQL([doc], field, modelName, attributes);
    return result[0];
}

module.exports = { 
    populateFromMySQL,
    populateMany,
    populateOne,
    formatDoctorNames,
    formatDoctorName,
    getModel
};