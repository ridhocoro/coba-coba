/**
 * config/b2.js
 *
 * Backblaze B2 — kompatibel dengan AWS S3 SDK (S3-compatible API).
 *
 * Env yang dibutuhkan:
 *   B2_ENDPOINT        = https://s3.us-west-004.backblazeb2.com  (sesuai region bucket)
 *   B2_BUCKET_NAME     = klinik-ipb-video-logs
 *   B2_KEY_ID          = keyID dari App Key B2
 *   B2_APPLICATION_KEY = applicationKey dari App Key B2
 *   B2_REGION          = us-west-004  (sesuai region bucket)
 */

const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const b2Client = new S3Client({
    endpoint         : process.env.B2_ENDPOINT,
    region           : process.env.B2_REGION || 'us-west-004',
    credentials      : {
        accessKeyId     : process.env.B2_KEY_ID,
        secretAccessKey : process.env.B2_APPLICATION_KEY,
    },
    forcePathStyle   : true,   // wajib untuk B2 S3-compatible API
});

const BUCKET = process.env.B2_BUCKET_NAME;

/**
 * Upload buffer/stream ke B2.
 * @param {Buffer} buffer     - isi file
 * @param {string} key        - path di bucket, mis. 'video-logs/konsultasi-abc123.webm'
 * @param {string} mimeType   - 'video/webm' | 'video/mp4'
 * @returns {Promise<string>} - key yang diupload
 */
const uploadToB2 = async (buffer, key, mimeType = 'video/webm') => {
    await b2Client.send(new PutObjectCommand({
        Bucket      : BUCKET,
        Key         : key,
        Body        : buffer,
        ContentType : mimeType,
    }));
    return key;
};

/**
 * Buat pre-signed URL untuk download (berlaku 1 jam).
 * Karena bucket private, URL ini yang diberikan ke client untuk download.
 * @param {string} key  - path file di bucket
 * @param {number} expiresInSeconds - default 3600 (1 jam)
 * @returns {Promise<string>} - signed URL
 */
const getDownloadUrl = async (key, expiresInSeconds = 3600) => {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(b2Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Hapus file dari B2.
 * @param {string} key - path file di bucket
 */
const deleteFromB2 = async (key) => {
    await b2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

module.exports = { b2Client, uploadToB2, getDownloadUrl, deleteFromB2, BUCKET };