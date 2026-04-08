// backend/models/mysql/index.js
// Semua Sequelize models + asosiasi

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');
const bcrypt = require('bcryptjs');

// ============================================================
// USER MODEL
// ============================================================
const User = sequelize.define('User', {
    id: {
        type: DataTypes.CHAR(36),
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name           : { type: DataTypes.STRING(120), allowNull: false },
    email          : { type: DataTypes.STRING(120), allowNull: false, unique: true },
    password       : { type: DataTypes.STRING(255), allowNull: false },
    phone          : { type: DataTypes.STRING(20),  allowNull: false },
    dateOfBirth    : { type: DataTypes.DATEONLY,    field: 'date_of_birth' },
    gender         : { type: DataTypes.ENUM('laki-laki','perempuan',''), defaultValue: '' },
    role           : {
        type: DataTypes.ENUM('user','mahasiswa','doctor','admin'),
        defaultValue: 'user',
    },
    isActive       : { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'is_active'  },
    isVerified     : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_verified' },
    quotaBonus     : { type: DataTypes.INTEGER, defaultValue: 0,     field: 'quota_bonus' },

    // Alamat
    addressStreet    : { type: DataTypes.STRING(255), field: 'address_street'    },
    addressCity      : { type: DataTypes.STRING(100), field: 'address_city'      },
    addressProvince  : { type: DataTypes.STRING(100), field: 'address_province'  },
    addressPostalCode: { type: DataTypes.STRING(10),  field: 'address_postal_code' },

    // OTP
    emailOtp            : { type: DataTypes.STRING(10),  field: 'email_otp'              },
    emailOtpExpires     : { type: DataTypes.DATE,        field: 'email_otp_expires'      },
    emailOtpInvalidated : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'email_otp_invalidated' },
    otpResendCount      : { type: DataTypes.INTEGER, defaultValue: 0, field: 'otp_resend_count' },
    otpResendWindowStart: { type: DataTypes.DATE, field: 'otp_resend_window_start' },
    resetPasswordToken  : { type: DataTypes.STRING(255), field: 'reset_password_token'   },
    resetPasswordExpires: { type: DataTypes.DATE,        field: 'reset_password_expires' },
}, {
    tableName  : 'users',
    underscored: true,
    hooks: {
        beforeSave: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

User.prototype.comparePassword = function(plain) {
    return bcrypt.compare(plain, this.password);
};

// ============================================================
// DOCTOR MODEL
// ============================================================
const Doctor = sequelize.define('Doctor', {
    id              : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId          : { type: DataTypes.CHAR(36), allowNull: false, field: 'user_id' },
    name            : { type: DataTypes.STRING(120), allowNull: false },
    specialization  : { type: DataTypes.STRING(100), allowNull: false },
    qualification   : { type: DataTypes.STRING(255) },
    gender          : { type: DataTypes.STRING(20), defaultValue: '' },
    experience      : { type: DataTypes.INTEGER },
    consultationFee : { type: DataTypes.DECIMAL(12,2), defaultValue: 0, field: 'consultation_fee' },
    rating          : { type: DataTypes.DECIMAL(3,1), defaultValue: 0 },
    totalReviews    : { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_reviews' },
    isActive        : { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'is_active'  },
    isOnline        : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_online'  },
    bio             : { type: DataTypes.TEXT },
    photo           : { type: DataTypes.STRING(500) },
    signatureUrl    : { type: DataTypes.STRING(500), field: 'signature_url' },
    allowChat       : { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'allow_chat'       },
    allowVideoCall  : { type: DataTypes.BOOLEAN, defaultValue: true,  field: 'allow_video_call' },
    strNumber       : { type: DataTypes.STRING(100), field: 'str_number' },
    alumnus         : { type: DataTypes.STRING(255) },
    practiceLocation: { type: DataTypes.STRING(255), field: 'practice_location' },
    titlePrefix     : { type: DataTypes.STRING(50),  field: 'title_prefix' },
    titleSuffix     : { type: DataTypes.STRING(100), field: 'title_suffix' },
}, { tableName: 'doctors', underscored: true });

// ============================================================
// MEDICINE MODEL
// ============================================================
const Medicine = sequelize.define('Medicine', {
    id                        : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name                      : { type: DataTypes.STRING(200), allowNull: false },
    genericName               : { type: DataTypes.STRING(200), field: 'generic_name' },
    description               : { type: DataTypes.TEXT },
    category                  : {
        type: DataTypes.ENUM('obat_bebas','obat_bebas_terbatas','obat_keras','antibiotik','vitamin','alat_kesehatan'),
        allowNull: false,
    },
    price                     : { type: DataTypes.DECIMAL(12,2), defaultValue: 0, allowNull: false },
    stock                     : { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    lockedStock               : { type: DataTypes.INTEGER, defaultValue: 0, field: 'locked_stock' },
    minStock                  : { type: DataTypes.INTEGER, defaultValue: 10, field: 'min_stock' },
    unit                      : { type: DataTypes.STRING(30), defaultValue: 'tablet' },
    requiresPrescription      : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'requires_prescription' },
    availableForStudentQuota  : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'available_for_student_quota' },
    image                     : { type: DataTypes.STRING(500) },
    manufacturer              : { type: DataTypes.STRING(200) },
    isActive                  : { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
    tableName  : 'medicines',
    underscored: true,
    getterMethods: {
        availableStock() { return Math.max(0, (this.stock || 0) - (this.lockedStock || 0)); }
    }
});

// ============================================================
// ORDER MODEL
// ============================================================
const Order = sequelize.define('Order', {
    id           : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    orderNumber  : { type: DataTypes.STRING(30), unique: true, field: 'order_number' },
    userId       : { type: DataTypes.CHAR(36), allowNull: false, field: 'user_id' },

    subtotalObat      : { type: DataTypes.DECIMAL(12,2), defaultValue: 0, field: 'subtotal_obat'    },
    shippingCost      : { type: DataTypes.DECIMAL(12,2), defaultValue: 0, field: 'shipping_cost'    },
    totalAmount       : { type: DataTypes.DECIMAL(12,2), allowNull: false, field: 'total_amount'    },
    isStudentDiscount : { type: DataTypes.BOOLEAN, defaultValue: false,   field: 'is_student_discount' },
    studentFreeQty    : { type: DataTypes.INTEGER, defaultValue: 0,       field: 'student_free_qty' },

    deliveryMethod    : { type: DataTypes.ENUM('diantar','pickup'), allowNull: false, field: 'delivery_method' },
    shippingAddress   : { type: DataTypes.STRING(500), field: 'shipping_address'  },
    shippingDetail    : { type: DataTypes.STRING(255), field: 'shipping_detail'   },
    shippingLat       : { type: DataTypes.DECIMAL(10,7), field: 'shipping_lat'    },
    shippingLng       : { type: DataTypes.DECIMAL(10,7), field: 'shipping_lng'    },
    shippingPhone     : { type: DataTypes.STRING(20),  field: 'shipping_phone'    },
    distance          : { type: DataTypes.DECIMAL(8,2), defaultValue: 0           },
    estimatedDelivery : { type: DataTypes.STRING(100), field: 'estimated_delivery'},

    requiresPrescription       : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'requires_prescription' },
    prescriptionImageUrl       : { type: DataTypes.STRING(500), field: 'prescription_image_url' },
    prescriptionStatus         : { type: DataTypes.ENUM('pending','approved','rejected'), field: 'prescription_status' },
    prescriptionRejectedReason : { type: DataTypes.STRING(500), field: 'prescription_rejected_reason' },
    prescriptionReviewedAt     : { type: DataTypes.DATE, field: 'prescription_reviewed_at' },
    prescriptionUploadCount    : { type: DataTypes.INTEGER, defaultValue: 0, field: 'prescription_upload_count' },

    paymentMethod     : { type: DataTypes.STRING(50),  field: 'payment_method'    },
    xenditExternalId  : { type: DataTypes.STRING(100), field: 'xendit_external_id'},
    paymentExpiry     : { type: DataTypes.DATE,        field: 'payment_expiry'    },

    status: {
        type: DataTypes.ENUM(
            'waiting_prescription','prescription_rejected','pending','paid',
            'diproses','dikirim','terkirim','siap_diambil','selesai',
            'expired','cancelled','refund_requested','refund_rejected','refunded'
        ),
        defaultValue: 'pending',
    },

    // Refund fields
    refundVideoUrl      : { type: DataTypes.STRING(500), field: 'refund_video_url'     },
    refundReason        : { type: DataTypes.TEXT,        field: 'refund_reason'        },
    refundRequestedAt   : { type: DataTypes.DATE,        field: 'refund_requested_at'  },
    refundReviewedAt    : { type: DataTypes.DATE,        field: 'refund_reviewed_at'   },
    refundRejectReason  : { type: DataTypes.TEXT,        field: 'refund_reject_reason' },
    refundBankCode      : { type: DataTypes.STRING(20),  field: 'refund_bank_code'     },
    refundAccountNumber : { type: DataTypes.STRING(30),  field: 'refund_account_number'},
    refundAccountName   : { type: DataTypes.STRING(120), field: 'refund_account_name'  },
    refundMethod        : { type: DataTypes.ENUM('xendit_refund','xendit_disbursement','manual'), field: 'refund_method' },
    refundProcessedAt   : { type: DataTypes.DATE, field: 'refund_processed_at' },

    terkirimAt      : { type: DataTypes.DATE, field: 'terkirim_at'      },
    diprosesPaidAt  : { type: DataTypes.DATE, field: 'diproses_paid_at' },
    siapDiambilAt   : { type: DataTypes.DATE, field: 'siap_diambil_at'  },
    completedAt     : { type: DataTypes.DATE, field: 'completed_at'     },
    cancelledAt     : { type: DataTypes.DATE, field: 'cancelled_at'     },
    cancelReason    : { type: DataTypes.STRING(255), field: 'cancel_reason' },
    notes           : { type: DataTypes.TEXT },
    stockLockExpiry : { type: DataTypes.DATE, field: 'stock_lock_expiry' },
}, {
    tableName  : 'orders',
    underscored: true,
    hooks: {
        beforeCreate: async (order) => {
            if (!order.orderNumber) {
                const d  = new Date();
                const yy = d.getFullYear().toString().slice(-2);
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const dd = d.getDate().toString().padStart(2, '0');
                const sfx = (Date.now() % 100000).toString().padStart(5, '0')
                          + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                order.orderNumber = `INV/${yy}${mm}${dd}/${sfx}`;
            }
        }
    }
});

// ============================================================
// ORDER ITEMS MODEL
// ============================================================
const OrderItem = sequelize.define('OrderItem', {
    id                  : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    orderId             : { type: DataTypes.CHAR(36), allowNull: false, field: 'order_id'     },
    medicineId          : { type: DataTypes.CHAR(36),                   field: 'medicine_id'  },
    medicineName        : { type: DataTypes.STRING(200), allowNull: false, field: 'medicine_name' },
    price               : { type: DataTypes.DECIMAL(12,2), allowNull: false },
    finalPrice          : { type: DataTypes.DECIMAL(12,2), allowNull: false, field: 'final_price' },
    quantity            : { type: DataTypes.INTEGER, allowNull: false },
    subtotal            : { type: DataTypes.DECIMAL(12,2), allowNull: false },
    requiresPrescription: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'requires_prescription' },
    isFreeForStudent    : { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_free_for_student'   },
}, { tableName: 'order_items', timestamps: false });

// ============================================================
// PAYMENT MODEL
// ============================================================
const Payment = sequelize.define('Payment', {
    id                  : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId              : { type: DataTypes.CHAR(36), allowNull: false, field: 'user_id'  },
    orderId             : { type: DataTypes.CHAR(36),                   field: 'order_id' },
    consultationMongoId : { type: DataTypes.STRING(24), field: 'consultation_mongo_id' },  // MongoDB ObjectId
    paymentType         : { type: DataTypes.ENUM('order','consultation'), allowNull: false, field: 'payment_type' },
    amount              : { type: DataTypes.DECIMAL(12,2), allowNull: false },
    method              : { type: DataTypes.STRING(50) },
    status              : { type: DataTypes.ENUM('pending','paid','expired','failed','refunded'), defaultValue: 'pending' },
    xenditInvoiceId     : { type: DataTypes.STRING(100), field: 'xendit_invoice_id'   },
    xenditExternalId    : { type: DataTypes.STRING(100), field: 'xendit_external_id'  },
    xenditPaymentUrl    : { type: DataTypes.STRING(500), field: 'xendit_payment_url'  },
    paidAt              : { type: DataTypes.DATE,        field: 'paid_at'             },
    expiredAt           : { type: DataTypes.DATE,        field: 'expired_at'          },
}, { tableName: 'payments', underscored: true });

// ============================================================
// ASOSIASI
// ============================================================
User.hasOne(Doctor,      { foreignKey: 'userId', as: 'doctorProfile' });
Doctor.belongsTo(User,   { foreignKey: 'userId', as: 'user'          });

const DoctorSchedule = sequelize.define('DoctorSchedule', {
    id         : { type: DataTypes.CHAR(36), defaultValue: DataTypes.UUIDV4, primaryKey: true },
    doctorId   : { type: DataTypes.CHAR(36), allowNull: false, field: 'doctor_id'  },
    dayOfWeek  : { type: DataTypes.TINYINT, allowNull: false,  field: 'day_of_week'},
    startTime  : { type: DataTypes.TIME, allowNull: false, field: 'start_time' },
    endTime    : { type: DataTypes.TIME, allowNull: false, field: 'end_time'   },
    isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_available' },
}, { tableName: 'doctor_schedules', underscored: true, updatedAt: false });

Doctor.hasMany(DoctorSchedule, { foreignKey: 'doctorId', as: 'schedules' });
DoctorSchedule.belongsTo(Doctor, { foreignKey: 'doctorId' });

Order.belongsTo(User,    { foreignKey: 'userId', as: 'user'     });
User.hasMany(Order,      { foreignKey: 'userId', as: 'orders'   });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order,    { foreignKey: 'orderId',    as: 'order'    });
OrderItem.belongsTo(Medicine, { foreignKey: 'medicineId', as: 'medicine' });

Payment.belongsTo(User,  { foreignKey: 'userId',  as: 'user'  });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

module.exports = { sequelize, User, Doctor, DoctorSchedule, Medicine, Order, OrderItem, Payment };