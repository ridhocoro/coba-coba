-- ============================================================
-- KLINIK IPB - MySQL Schema (Hybrid dengan MongoDB)
-- 
-- Strategi:
--   MySQL  → data relasional & transaksional
--            (users, doctors, medicines, orders, payments, schedules)
--   MongoDB → data fleksibel & real-time
--            (consultations + messages, notifications, admin_chats)
--
-- Jalankan: mysql -u root -p klinik_ipb < mysql_schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS klinik_ipb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE klinik_ipb;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
    id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,        -- bcrypt hash
    phone         VARCHAR(20)  NOT NULL,
    date_of_birth DATE,
    gender        ENUM('laki-laki','perempuan','') DEFAULT '',
    role          ENUM('user','mahasiswa','doctor','admin') NOT NULL DEFAULT 'user',
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
    quota_bonus   INT          NOT NULL DEFAULT 0,  -- tambahan kuota mahasiswa dari admin

    -- Alamat (JSON agar fleksibel)
    address_street      VARCHAR(255),
    address_city        VARCHAR(100),
    address_province    VARCHAR(100),
    address_postal_code VARCHAR(10),

    -- OTP & Reset
    email_otp              VARCHAR(10),
    email_otp_expires      DATETIME,
    email_otp_invalidated  TINYINT(1) DEFAULT 0,
    otp_resend_count       INT DEFAULT 0,
    otp_resend_window_start DATETIME,
    reset_password_token   VARCHAR(255),
    reset_password_expires DATETIME,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_email    (email),
    INDEX idx_users_role     (role),
    INDEX idx_users_verified (is_verified, created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 2. DOCTORS
-- ============================================================
CREATE TABLE doctors (
    id               CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id          CHAR(36)     NOT NULL,
    name             VARCHAR(120) NOT NULL,
    specialization   VARCHAR(100) NOT NULL,
    qualification    VARCHAR(255),
    gender           VARCHAR(20)  DEFAULT '',
    experience       INT,
    consultation_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    rating           DECIMAL(3,1)  DEFAULT 0,
    total_reviews    INT           DEFAULT 0,
    is_active        TINYINT(1)    DEFAULT 1,
    is_online        TINYINT(1)    DEFAULT 0,
    bio              TEXT,
    photo            VARCHAR(500),
    signature_url    VARCHAR(500),

    -- Identitas & kredensial
    str_number       VARCHAR(100),
    alumnus          VARCHAR(255),
    practice_location VARCHAR(255),
    title_prefix     VARCHAR(50),
    title_suffix     VARCHAR(100),

    -- Pengaturan tipe konsultasi
    allow_chat       TINYINT(1) DEFAULT 1,
    allow_video_call TINYINT(1) DEFAULT 1,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_doctors_user    (user_id),
    INDEX idx_doctors_active  (is_active),
    INDEX idx_doctors_spec    (specialization)
) ENGINE=InnoDB;

-- ============================================================
-- 3. DOCTOR SCHEDULES (jadwal mingguan)
-- ============================================================
CREATE TABLE doctor_schedules (
    id           CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    doctor_id    CHAR(36)    NOT NULL,
    day_of_week  TINYINT     NOT NULL,   -- 0=Minggu, 1=Senin, ..., 6=Sabtu
    start_time   TIME        NOT NULL,
    end_time     TIME        NOT NULL,
    is_available TINYINT(1)  DEFAULT 1,
    created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_sched_doctor (doctor_id),
    INDEX idx_sched_day    (day_of_week)
) ENGINE=InnoDB;

-- ============================================================
-- 4. DOCTOR SCHEDULE OVERRIDES (tanggal khusus: libur/tambah)
-- ============================================================
CREATE TABLE doctor_schedule_overrides (
    id           CHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    doctor_id    CHAR(36)   NOT NULL,
    override_date DATE      NOT NULL,
    is_available TINYINT(1) DEFAULT 0,  -- 0 = libur di tanggal ini
    start_time   TIME,
    end_time     TIME,
    reason       VARCHAR(255),
    created_at   DATETIME   DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    UNIQUE KEY uq_override (doctor_id, override_date),
    INDEX idx_override_date (override_date)
) ENGINE=InnoDB;

-- ============================================================
-- 5. MEDICINES
-- ============================================================
CREATE TABLE medicines (
    id                       CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    name                     VARCHAR(200) NOT NULL,
    generic_name             VARCHAR(200),
    description              TEXT,
    category                 ENUM('obat_bebas','obat_bebas_terbatas','obat_keras','antibiotik','vitamin','alat_kesehatan') NOT NULL,
    price                    DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock                    INT           NOT NULL DEFAULT 0,
    locked_stock             INT           NOT NULL DEFAULT 0,
    min_stock                INT           NOT NULL DEFAULT 10,
    unit                     VARCHAR(30)   DEFAULT 'tablet',
    requires_prescription    TINYINT(1)   DEFAULT 0,
    available_for_student_quota TINYINT(1) DEFAULT 0,
    image                    VARCHAR(500),
    manufacturer             VARCHAR(200),
    is_active                TINYINT(1)   DEFAULT 1,
    created_at               DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_med_name     (name),
    INDEX idx_med_category (category),
    INDEX idx_med_active   (is_active),
    FULLTEXT idx_med_search (name, generic_name, description)
) ENGINE=InnoDB;

-- ============================================================
-- 6. APPOINTMENTS (janji temu tatap muka)
-- ============================================================
CREATE TABLE appointments (
    id           CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id      CHAR(36)    NOT NULL,
    doctor_id    CHAR(36)    NOT NULL,
    scheduled_at DATETIME    NOT NULL,
    scheduled_end DATETIME,
    status       ENUM('pending','confirmed','in_progress','completed','cancelled','no_show') DEFAULT 'pending',
    symptoms     TEXT,
    notes        TEXT,
    cancel_reason VARCHAR(255),
    cancelled_by  ENUM('user','doctor','admin','system'),
    created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_appt_user   (user_id),
    INDEX idx_appt_doctor (doctor_id),
    INDEX idx_appt_date   (scheduled_at),
    INDEX idx_appt_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 7. ORDERS
-- ============================================================
CREATE TABLE orders (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    order_number    VARCHAR(30) NOT NULL UNIQUE,   -- INV/YYMMDD/NNNNN
    user_id         CHAR(36)    NOT NULL,

    -- Harga
    subtotal_obat    DECIMAL(12,2) DEFAULT 0,
    shipping_cost    DECIMAL(12,2) DEFAULT 0,
    total_amount     DECIMAL(12,2) NOT NULL,
    is_student_discount TINYINT(1) DEFAULT 0,
    student_free_qty INT           DEFAULT 0,

    -- Pengiriman
    delivery_method    ENUM('diantar','pickup') NOT NULL,
    shipping_address   VARCHAR(500),
    shipping_detail    VARCHAR(255),
    shipping_lat       DECIMAL(10,7),
    shipping_lng       DECIMAL(10,7),
    shipping_phone     VARCHAR(20),
    distance           DECIMAL(8,2)  DEFAULT 0,
    estimated_delivery VARCHAR(100),

    -- Resep
    requires_prescription        TINYINT(1) DEFAULT 0,
    prescription_image_url       VARCHAR(500),
    prescription_status          ENUM('pending','approved','rejected'),
    prescription_rejected_reason VARCHAR(500),
    prescription_reviewed_at     DATETIME,
    prescription_reviewed_by     CHAR(36),
    prescription_upload_count    INT DEFAULT 0,

    -- Pembayaran
    payment_method      VARCHAR(50),
    xendit_external_id  VARCHAR(100),
    payment_expiry      DATETIME,

    -- Status flow
    status ENUM(
        'waiting_prescription','prescription_rejected','pending','paid',
        'diproses','dikirim','terkirim','siap_diambil','selesai',
        'expired','cancelled','refund_requested','refund_rejected','refunded'
    ) DEFAULT 'pending',

    -- Refund
    refund_video_url     VARCHAR(500),
    refund_reason        TEXT,
    refund_requested_at  DATETIME,
    refund_reviewed_at   DATETIME,
    refund_reviewed_by   CHAR(36),
    refund_reject_reason TEXT,
    refund_bank_code     VARCHAR(20),
    refund_account_number VARCHAR(30),
    refund_account_name  VARCHAR(120),
    refund_method        ENUM('xendit_refund','xendit_disbursement','manual'),
    refund_processed_at  DATETIME,

    -- Timestamps untuk cron
    terkirim_at     DATETIME,
    diproses_paid_at DATETIME,
    siap_diambil_at DATETIME,
    completed_at    DATETIME,
    cancelled_at    DATETIME,
    cancel_reason   VARCHAR(255),
    notes           TEXT,
    stock_lock_expiry DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_user   (user_id),
    INDEX idx_order_status (status),
    INDEX idx_order_number (order_number),
    INDEX idx_order_date   (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 8. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
    id                   CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    order_id             CHAR(36)     NOT NULL,
    medicine_id          CHAR(36),
    medicine_name        VARCHAR(200) NOT NULL,    -- snapshot
    price                DECIMAL(12,2) NOT NULL,
    final_price          DECIMAL(12,2) NOT NULL,   -- setelah diskon
    quantity             INT          NOT NULL,
    subtotal             DECIMAL(12,2) NOT NULL,
    requires_prescription TINYINT(1)  DEFAULT 0,
    is_free_for_student  TINYINT(1)   DEFAULT 0,

    FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL,
    INDEX idx_oi_order (order_id)
) ENGINE=InnoDB;

-- ============================================================
-- 9. PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id              CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id         CHAR(36)     NOT NULL,
    order_id        CHAR(36),
    -- consultation_id akan disimpan sebagai VARCHAR (MongoDB ObjectId string)
    consultation_mongo_id VARCHAR(24),
    payment_type    ENUM('order','consultation') NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    method          VARCHAR(50),
    status          ENUM('pending','paid','expired','failed','refunded') DEFAULT 'pending',
    xendit_invoice_id  VARCHAR(100),
    xendit_external_id VARCHAR(100),
    xendit_payment_url VARCHAR(500),
    paid_at         DATETIME,
    expired_at      DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id)  ON DELETE SET NULL,
    INDEX idx_pay_user   (user_id),
    INDEX idx_pay_order  (order_id),
    INDEX idx_pay_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 10. CLINIC SETTINGS
-- ============================================================
CREATE TABLE clinic_settings (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    setting_key  VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed default settings
INSERT INTO clinic_settings (setting_key, setting_value) VALUES
    ('clinic_name', 'Klinik Pratama IPB'),
    ('consultation_fee_default', '50000'),
    ('student_monthly_quota', '8'),
    ('shipping_cost_per_km', '3000'),
    ('free_shipping_radius_km', '3'),
    ('operating_hours_start', '08:00'),
    ('operating_hours_end', '20:00'),
    ('payment_expiry_minutes', '15'),
    ('webrtc_stun_urls', '["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]');

-- ============================================================
-- VIEW: Student quota usage per bulan
-- ============================================================
CREATE OR REPLACE VIEW vw_student_monthly_quota AS
SELECT
    o.user_id,
    SUM(i.quantity) AS used_qty,
    DATE_FORMAT(o.created_at, '%Y-%m') AS month_year
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.is_student_discount = 1
  AND o.status NOT IN ('cancelled','expired','refunded')
GROUP BY o.user_id, month_year;
