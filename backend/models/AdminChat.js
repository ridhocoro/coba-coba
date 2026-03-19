/**
 * AdminChat — chat 1-on-1 antara admin dan dokter
 * Setiap pasangan (adminId ↔ doctorUserId) punya satu thread dengan banyak messages.
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId   : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole : { type: String, enum: ['admin','doctor'], required: true },
    text       : { type: String, default: '' },
    fileUrl    : { type: String },             // URL file/foto yang dikirim
    fileName   : { type: String },
    fileType   : { type: String },             // 'image' | 'file'
    isRead     : { type: Boolean, default: false },
    createdAt  : { type: Date, default: Date.now },
}, { _id: true });

const adminChatSchema = new mongoose.Schema({
    doctorId     : { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, unique: true },
    doctorUserId : { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    adminId      : { type: mongoose.Schema.Types.ObjectId, ref: 'User'   },  // admin yang terakhir chat
    messages     : [messageSchema],
    lastMessage  : { type: String, default: '' },
    lastAt       : { type: Date },
    unreadAdmin  : { type: Number, default: 0 }, // unread untuk admin
    unreadDoctor : { type: Number, default: 0 }, // unread untuk dokter
    createdAt    : { type: Date, default: Date.now },
});

adminChatSchema.index({ doctorId: 1 });
adminChatSchema.index({ doctorUserId: 1 });

module.exports = mongoose.model('AdminChat', adminChatSchema);