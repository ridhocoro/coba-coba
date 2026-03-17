/**
 * Cloudinary config
 * Env vars yang dibutuhkan:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key    : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET,
});

/**
 * Buat multer upload middleware yang menyimpan file ke Cloudinary.
 * @param {string} folder - subfolder di Cloudinary (mis. 'refund-pharmacy')
 * @param {string[]} allowedFormats - mis. ['mp4','mov','avi','jpg','png']
 * @param {number} maxSizeMB - batas ukuran file dalam MB
 */
const createCloudinaryUpload = (folder, allowedFormats, maxSizeMB = 50) => {
    const storage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder,
            resource_type : 'auto',
            allowed_formats: allowedFormats,
        },
    });

    return multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = file.originalname.split('.').pop().toLowerCase();
            if (allowedFormats.includes(ext)) return cb(null, true);
            cb(new Error(`Format tidak didukung. Gunakan: ${allowedFormats.join(', ')}`));
        },
    });
};

module.exports = { cloudinary, createCloudinaryUpload };