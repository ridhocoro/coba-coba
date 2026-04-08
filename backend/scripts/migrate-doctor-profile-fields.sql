-- ============================================================
-- Migration: Tambah field profil dokter baru
-- Compatible: MySQL 8.0+
-- Aman dijalankan ulang (cek kolom via INFORMATION_SCHEMA dulu)
-- ============================================================

SET @db = DATABASE();

-- str_number
SET @col = 'str_number';
SET @tbl = 'doctors';
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
    CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(100) DEFAULT NULL COMMENT ''Nomor Surat Tanda Registrasi'''),
    'SELECT ''str_number sudah ada, dilewati'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- alumnus
SET @col = 'alumnus';
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
    CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(255) DEFAULT NULL COMMENT ''Asal institusi pendidikan'''),
    'SELECT ''alumnus sudah ada, dilewati'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- practice_location
SET @col = 'practice_location';
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
    CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(255) DEFAULT NULL COMMENT ''Lokasi praktik dokter'''),
    'SELECT ''practice_location sudah ada, dilewati'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- title_prefix
SET @col = 'title_prefix';
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
    CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(50) DEFAULT NULL COMMENT ''Gelar depan, mis. dr.'''),
    'SELECT ''title_prefix sudah ada, dilewati'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- title_suffix
SET @col = 'title_suffix';
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @tbl AND COLUMN_NAME = @col) = 0,
    CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col, '` VARCHAR(100) DEFAULT NULL COMMENT ''Gelar belakang, mis. Sp.PD'''),
    'SELECT ''title_suffix sudah ada, dilewati'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verifikasi hasil
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'doctors'
  AND COLUMN_NAME IN ('str_number','alumnus','practice_location','title_prefix','title_suffix')
ORDER BY ORDINAL_POSITION;
