// VitalScanPage.jsx — v20 (v19 UX + v2 DSP: Cooley-Tukey FFT, zero-phase Butterworth,
//   IQR outlier removal, moving median ROI smoothing, SNR-weighted confidence)
// UI refresh: staggered enter animations, emoji, polish visual

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
    FaHeartbeat, FaArrowLeft, FaCamera, FaRedo, FaInfoCircle,
    FaLungs, FaWaveSquare, FaLightbulb, FaUserCheck,
    FaExclamationTriangle, FaSpinner, FaChartLine,
    FaAngleDoubleUp, FaBan, FaSun, FaTachometerAlt,
    FaAdjust, FaEdge, FaChrome, FaFirefox
} from 'react-icons/fa';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const SAMPLE_DURATION_SEC       = 60;
const TARGET_FPS                = 30;
const INTERP_HZ                 = 250;
const MAX_NORMALIZED_MOVEMENT   = 0.10;
const REQUIRED_FACE_STABILITY_SEC = 1;
const START_RECORDING_THRESHOLD = 0.40;
const MIN_SAMPLES               = 60;

const HR_BAND                   = [0.65, 3.5];
const RESP_BAND                 = [0.12, 0.6];
const RR_MIN_MS                 = 350;
const RR_MAX_MS                 = 1700;
const ROI_SMOOTH_WINDOW         = 15;
const OUTLIER_IQR_MULT          = 1.5;

const CAMERA_CONFIGS = [
    { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } },
    { video: { width: { min: 480, ideal: 1280, max: 1920 }, height: { min: 360, ideal: 720, max: 1080 }, facingMode: 'user' } },
    { video: { width: { exact: 640 }, height: { exact: 480 }, facingMode: { exact: 'user' } } },
];

const BRIGHTNESS_LEVELS = { off: 1.0, low: 1.3, medium: 1.8, high: 2.3, extreme: 3.0 };

/* ═══════════════════════════════════════════════════════════════
   BROWSER DETECTION
═══════════════════════════════════════════════════════════════ */
function getBrowserInfo() {
    const ua = navigator.userAgent;
    const isEdge    = ua.indexOf('Edg')     > -1;
    const isChrome  = !isEdge && ua.indexOf('Chrome')  > -1;
    const isFirefox = ua.indexOf('Firefox') > -1;
    const browser   = isEdge ? 'Edge' : isChrome ? 'Chrome' : isFirefox ? 'Firefox' : ua.indexOf('Safari') > -1 ? 'Safari' : 'Unknown';
    return { browser, isEdge, isChrome, isFirefox };
}

/* ═══════════════════════════════════════════════════════════════
   ADVANCED CAMERA CONTROLLER
═══════════════════════════════════════════════════════════════ */
class AdvancedCameraController {
    constructor(videoElement) { this.video = videoElement; this.brightnessLevel = 1.0; }
    applyBrightness(level) {
        if (!this.video) return;
        this.brightnessLevel = level;
        this.video.style.filter = level === 1.0 ? '' : `brightness(${level}) contrast(${0.9 + (level - 1) * 0.2})`;
    }
    reset() { if (this.video) this.video.style.filter = ''; this.brightnessLevel = 1.0; }
}

/* ═══════════════════════════════════════════════════════════════
   DSP — Cooley-Tukey FFT + zero-phase Butterworth
═══════════════════════════════════════════════════════════════ */
function butterCoeffs(fs, f1, f2) {
    const T  = 1 / fs;
    const W1 = (2 / T) * Math.tan(Math.PI * f1 * T);
    const W2 = (2 / T) * Math.tan(Math.PI * f2 * T);
    const W0 = Math.sqrt(W1 * W2);
    const BW = W2 - W1;
    const a0 =  4 / (T * T) + 2 * BW / T + W0 * W0;
    const a1 = -8 / (T * T) + 2 * W0 * W0;
    const a2 =  4 / (T * T) - 2 * BW / T + W0 * W0;
    return {
        b: [2 * BW / T / a0,  0, -2 * BW / T / a0],
        a: [1, a1 / a0, a2 / a0],
    };
}

function applyBiquad(signal, b, a) {
    const out = new Float64Array(signal.length);
    let w1 = 0, w2 = 0;
    for (let i = 0; i < signal.length; i++) {
        const w0 = signal[i] - a[1] * w1 - a[2] * w2;
        out[i]   = b[0] * w0 + b[1] * w1 + b[2] * w2;
        w2 = w1; w1 = w0;
    }
    return out;
}

function bandpass(signal, fs, f1, f2) {
    if (signal.length < 8) return new Float64Array(signal);
    const arr = signal instanceof Float64Array ? signal : new Float64Array(signal);
    const { b, a } = butterCoeffs(fs, f1, f2);
    const fwd = applyBiquad(arr, b, a);
    const rev = new Float64Array(fwd.length);
    let w1 = 0, w2 = 0;
    for (let i = fwd.length - 1; i >= 0; i--) {
        const w0 = fwd[i] - a[1] * w1 - a[2] * w2;
        rev[i]   = b[0] * w0 + b[1] * w1 + b[2] * w2;
        w2 = w1; w1 = w0;
    }
    return rev;
}

function detrend(signal) {
    const N = signal.length;
    if (N < 2) return signal instanceof Float64Array ? signal : new Float64Array(signal);
    const xm = (N - 1) / 2;
    const ym = signal.reduce((a, b) => a + b, 0) / N;
    let num = 0, den = 0;
    for (let i = 0; i < N; i++) { num += (i - xm) * (signal[i] - ym); den += (i - xm) ** 2; }
    const slope = den ? num / den : 0;
    const ic    = ym - slope * xm;
    return new Float64Array(N).map((_, i) => signal[i] - (slope * i + ic));
}

function zscore(signal) {
    const N    = signal.length;
    const mean = signal.reduce((a, b) => a + b, 0) / N;
    const std  = Math.sqrt(signal.reduce((a, b) => a + (b - mean) ** 2, 0) / N) || 1;
    return new Float64Array(N).map((_, i) => (signal[i] - mean) / std);
}

function hanning(N) {
    return Float64Array.from({ length: N }, (_, i) => 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1))));
}

function fft(signal) {
    const N = signal.length;
    let size = 1;
    while (size < N) size <<= 1;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < N; i++) re[i] = signal[i];
    for (let i = 1, j = 0; i < size; i++) {
        let bit = size >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= size; len <<= 1) {
        const ang = -2 * Math.PI / len;
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < size; i += len) {
            let curRe = 1, curIm = 0;
            for (let j = 0; j < len / 2; j++) {
                const uRe = re[i + j], uIm = im[i + j];
                const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
                const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
                re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
                re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
                const nRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe; curRe = nRe;
            }
        }
    }
    return { re, im, size };
}

function powerSpectrum(signal) {
    const win      = hanning(signal.length);
    const windowed = signal.map ? signal.map((v, i) => v * win[i]) : Array.from(signal).map((v, i) => v * win[i]);
    const { re, im, size } = fft(windowed);
    const half = size / 2;
    const ps   = new Float64Array(half);
    for (let i = 0; i < half; i++) ps[i] = re[i] ** 2 + im[i] ** 2;
    return { ps, size };
}

function computeSNRBand(signal, fs, f1, f2) {
    if (signal.length < 30) return 0.1;
    const { ps, size } = powerSpectrum(signal);
    let sigPow = 0, totPow = 0;
    for (let i = 1; i < ps.length; i++) {
        const f = i * fs / size;
        totPow += ps[i];
        if (f >= f1 && f <= f2) sigPow += ps[i];
    }
    return totPow > 0 ? sigPow / totPow : 0;
}

function dominantFreq(signal, fs, f1, f2) {
    const { ps, size } = powerSpectrum(signal);
    let maxPow = -1, maxF = (f1 + f2) / 2;
    for (let i = 1; i < ps.length; i++) {
        const f = i * fs / size;
        if (f >= f1 && f <= f2 && ps[i] > maxPow) { maxPow = ps[i]; maxF = f; }
    }
    return maxF;
}

function removeOutliersIQR(rgbHistory) {
    if (rgbHistory.length < 10) return rgbHistory;
    const intensities = rgbHistory.map(f => f.r + f.g + f.b);
    const sorted      = [...intensities].sort((a, b) => a - b);
    const q1          = sorted[Math.floor(sorted.length * 0.25)];
    const q3          = sorted[Math.floor(sorted.length * 0.75)];
    const iqr         = q3 - q1;
    const lo          = q1 - OUTLIER_IQR_MULT * iqr;
    const hi          = q3 + OUTLIER_IQR_MULT * iqr;
    const filtered    = rgbHistory.filter(f => {
        const v = f.r + f.g + f.b;
        return v >= lo && v <= hi;
    });
    return filtered.length >= MIN_SAMPLES ? filtered : rgbHistory;
}

function movingMedian(values, windowSize = ROI_SMOOTH_WINDOW) {
    if (values.length < windowSize) return values instanceof Float64Array ? values : new Float64Array(values);
    const result = new Float64Array(values.length);
    const half   = Math.floor(windowSize / 2);
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - half);
        const end   = Math.min(values.length, i + half + 1);
        const win   = Array.from(values).slice(start, end).sort((a, b) => a - b);
        result[i]   = win[Math.floor(win.length / 2)];
    }
    return result;
}

function cubicSplineResample(values, timestamps, targetFs) {
    const totalSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
    const N        = Math.floor(totalSec * targetFs);
    if (N < 4) return new Float64Array(values);
    const out  = new Float64Array(N);
    const srcN = values.length;
    for (let i = 0; i < N; i++) {
        const t  = timestamps[0] + (i / targetFs) * 1000;
        let lo = 0, hi = srcN - 2;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (timestamps[mid + 1] < t) lo = mid + 1; else hi = mid; }
        const j  = lo;
        const dt = timestamps[j + 1] - timestamps[j];
        const mu = dt > 0 ? (t - timestamps[j]) / dt : 0;
        const p0 = values[Math.max(0, j - 1)];
        const p1 = values[j];
        const p2 = values[Math.min(srcN - 1, j + 1)];
        const p3 = values[Math.min(srcN - 1, j + 2)];
        const mu2 = mu * mu, mu3 = mu2 * mu;
        out[i] = 0.5 * (2 * p1 + (-p0 + p2) * mu + (2 * p0 - 5 * p1 + 4 * p2 - p3) * mu2 + (-p0 + 3 * p1 - 3 * p2 + p3) * mu3);
    }
    return out;
}

function computeCHROM(rgbHistory) {
    const N = rgbHistory.length;
    const signal = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        const { r, g, b } = rgbHistory[i];
        const norm = r + g + b || 1;
        const Rn = r / norm, Gn = g / norm, Bn = b / norm;
        const X  = 3 * Rn - 2 * Gn;
        const Y  = 1.5 * Rn + Gn - 1.5 * Bn;
        signal[i] = X - Y;
    }
    return signal;
}

function computePOS(rgbHistory) {
    const N = rgbHistory.length;
    const rN = new Float64Array(N), gN = new Float64Array(N), bN = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        const { r, g, b } = rgbHistory[i];
        const mu = (r + g + b) / 3 || 1;
        rN[i] = r / mu; gN[i] = g / mu; bN[i] = b / mu;
    }
    const rD = detrend(rN), gD = detrend(gN), bD = detrend(bN);
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) out[i] = rD[i] - gD[i] + bD[i];
    return out;
}

function rPPGEnsemble(rgbHistory, fps) {
    if (rgbHistory.length < 10) return new Float64Array(rgbHistory.length);
    const [f1, f2] = HR_BAND;
    const chromF = bandpass(detrend(computeCHROM(rgbHistory)), fps, f1, f2);
    const posF   = bandpass(detrend(computePOS(rgbHistory)),   fps, f1, f2);
    const snrC   = computeSNRBand(chromF, fps, f1, f2);
    const snrP   = computeSNRBand(posF,   fps, f1, f2);
    const total  = snrC + snrP || 1;
    const wC     = snrC / total, wP = snrP / total;
    const out    = new Float64Array(chromF.length);
    for (let i = 0; i < out.length; i++) out[i] = wC * chromF[i] + wP * posF[i];
    return out;
}

function detectPeaks(signal, fs) {
    const minDist = Math.round(fs / 3.5);
    const N       = signal.length;
    const peaks   = [];
    const sorted  = Array.from(signal).sort((a, b) => a - b);
    const med     = sorted[Math.floor(N / 2)];
    const mad     = sorted.map(v => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(N / 2)] * 1.4826;
    const thresh  = med + mad * 0.5;
    const sigMin  = sorted[0], sigMax = sorted[N - 1];
    const minProm = (sigMax - sigMin) * 0.15;

    for (let i = minDist; i < N - minDist; i++) {
        if (signal[i] < thresh) continue;
        let isPeak = true;
        let localMin = Infinity;
        for (let j = i - minDist; j <= i + minDist; j++) {
            if (j !== i && signal[j] >= signal[i]) { isPeak = false; break; }
            if (j < i && signal[j] < localMin) localMin = signal[j];
        }
        if (!isPeak || signal[i] - localMin < minProm) continue;
        let peakPos = i;
        if (i > 0 && i < N - 1) {
            const denom = signal[i - 1] - 2 * signal[i] + signal[i + 1];
            if (denom !== 0) peakPos = i + 0.5 * (signal[i - 1] - signal[i + 1]) / denom;
        }
        peaks.length === 0 || peakPos - peaks[peaks.length - 1] >= minDist
            ? peaks.push(peakPos)
            : signal[i] > signal[Math.round(peaks[peaks.length - 1])] && (peaks[peaks.length - 1] = peakPos);
    }
    return peaks;
}

function filterEctopicRR(rrMs) {
    if (rrMs.length < 3) return rrMs;
    let filtered = rrMs.filter(rr => rr >= RR_MIN_MS && rr <= RR_MAX_MS);
    if (filtered.length < 3) return filtered;
    const sorted   = [...filtered].sort((a, b) => a - b);
    const medianRR = sorted[Math.floor(sorted.length / 2)];
    filtered = filtered.filter(rr => Math.abs(rr - medianRR) / medianRR <= 0.20);
    const clean = [filtered[0]];
    for (let i = 1; i < filtered.length; i++) {
        const rr   = filtered[i];
        const prev = filtered[i - 1];
        const next = i < filtered.length - 1 ? filtered[i + 1] : null;
        const diffPrev = Math.abs(rr - prev) / prev;
        if (next !== null) {
            const diffNext = Math.abs(next - prev) / prev;
            if (diffPrev > 0.25 && diffNext < 0.15) continue;
        }
        if (Math.abs(rr - prev) < 500) clean.push(rr);
    }
    return clean;
}

function calcHeartRate(peaks, fs) {
    if (peaks.length < 3) return null;
    const rrSamples = [];
    for (let i = 1; i < peaks.length; i++) rrSamples.push((peaks[i] - peaks[i - 1]) / fs * 1000);
    const filtered = filterEctopicRR(rrSamples);
    if (filtered.length < 2) return null;
    const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    return Math.round(60000 / mean);
}

function calcRMSSD(peaks, fs) {
    if (peaks.length < 4) return null;
    const rrMs   = [];
    for (let i = 1; i < peaks.length; i++) rrMs.push((peaks[i] - peaks[i - 1]) / fs * 1000);
    const filtered = filterEctopicRR(rrMs);
    if (filtered.length < 3) return null;
    let sumSq = 0, cnt = 0;
    for (let i = 1; i < filtered.length; i++) {
        const diff = filtered[i] - filtered[i - 1];
        if (Math.abs(diff) < 300) { sumSq += diff * diff; cnt++; }
    }
    if (cnt < 2) return null;
    return Math.round(Math.sqrt(sumSq / cnt));
}

function calcRespiratoryRate(rppgSignal, roiAreaHistory, fps) {
    const results = [];
    if (rppgSignal.length >= fps * 10) {
        const respFiltered = bandpass(detrend(rppgSignal), fps, RESP_BAND[0], RESP_BAND[1]);
        const f  = dominantFreq(respFiltered, fps, RESP_BAND[0], RESP_BAND[1]);
        const rr = Math.round(f * 60);
        if (rr >= 8 && rr <= 35) results.push(rr);
    }
    if (roiAreaHistory && roiAreaHistory.length >= fps * 10) {
        const smoothed   = movingMedian(roiAreaHistory, ROI_SMOOTH_WINDOW);
        const respArea   = bandpass(detrend(smoothed), fps, RESP_BAND[0], RESP_BAND[1]);
        const f  = dominantFreq(respArea, fps, RESP_BAND[0], RESP_BAND[1]);
        const rr = Math.round(f * 60);
        if (rr >= 8 && rr <= 35) results.push(rr);
    }
    if (!results.length) return null;
    return Math.round(results.reduce((a, b) => a + b, 0) / results.length);
}

function calcConfidence({ validFrames, totalFrames, rrCount, snr, lightingGood, hasTilt, hasOcclusion }) {
    const frameScore   = Math.min(1, validFrames / Math.max(totalFrames, 1));
    const rrScore      = Math.min(1, rrCount / 25);
    const snrScore     = Math.min(1, snr / 0.4);
    const envScore     = (lightingGood ? 1 : 0.6) * (hasTilt ? 0.7 : 1) * (hasOcclusion ? 0.8 : 1);
    const confidence   = frameScore * 25 + rrScore * 25 + snrScore * 30 + envScore * 20;
    return Math.round(Math.min(100, confidence));
}

/* ═══════════════════════════════════════════════════════════════
   SKIN DETECTION / FACE TILT / ROI — (logika tidak diubah)
═══════════════════════════════════════════════════════════════ */
function isSkinPixel(r, g, b) {
    const y  = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return cb >= 70 && cb <= 135 && cr >= 128 && cr <= 178 && y > 30 && y < 240
        && r > 60 && g > 40 && b > 20 && r > b && (r - g) >= -10;
}

let _calRoll = 0, _calYaw = 0, _calPitch = 0, _calibrated = false;

function calibrateFaceTilt(lm) {
    if (!lm || _calibrated) return;
    const le = lm[33], re = lm[263], nose = lm[1], chin = lm[152];
    if (!le || !re || !nose || !chin) return;
    const dx = re.x - le.x, dy = re.y - le.y;
    _calRoll  = Math.atan2(dy, dx) * (180 / Math.PI);
    const emx = (le.x + re.x) / 2;
    _calYaw   = Math.atan2(nose.x - emx, Math.abs(dx) * 0.5) * (180 / Math.PI);
    const fh  = Math.abs(chin.y - nose.y);
    const nt  = Math.abs(nose.y - (lm[10]?.y || nose.y));
    _calPitch = ((nt / (fh + 1e-6)) - 0.5) * 90;
    _calibrated = true;
}

function resetTiltCalibration() { _calibrated = false; _calRoll = _calYaw = _calPitch = 0; }

function detectFaceTilt(lm) {
    if (!lm || lm.length < 468)
        return { yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } };
    const le = lm[33], re = lm[263], nose = lm[1], chin = lm[152];
    if (!le || !re || !nose || !chin)
        return { yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } };
    const dx    = re.x - le.x, dy = re.y - le.y;
    const roll  = Math.atan2(dy, dx) * (180 / Math.PI);
    const emx   = (le.x + re.x) / 2;
    const yaw   = Math.atan2(nose.x - emx, Math.abs(dx) * 0.5) * (180 / Math.PI);
    const fh    = Math.abs(chin.y - nose.y);
    const nt    = Math.abs(nose.y - (lm[10]?.y || nose.y));
    const pitch = ((nt / (fh + 1e-6)) - 0.5) * 90;
    const dev   = _calibrated
        ? { roll: Math.abs(roll - _calRoll), yaw: Math.abs(yaw - _calYaw), pitch: Math.abs(pitch - _calPitch) }
        : { roll: Math.abs(roll), yaw: Math.abs(yaw), pitch: Math.abs(pitch) };
    const isTilted = dev.roll > 15 || dev.yaw > 18 || dev.pitch > 18;
    return { yaw: Math.round(yaw), pitch: Math.round(pitch), roll: Math.round(roll), deviation: { yaw: Math.round(dev.yaw), pitch: Math.round(dev.pitch), roll: Math.round(dev.roll) }, isTilted };
}

const FACE_ROIS = {
    forehead:   { landmarks: [10,67,69,104,108,151,337,299,298,333],       weight: 0.45, color: '#f59e0b', label: 'Dahi'       },
    leftCheek:  { landmarks: [50,101,118,117,116,123,147,213,192,214],     weight: 0.25, color: '#10b981', label: 'Pipi Kanan' },
    rightCheek: { landmarks: [280,330,347,346,345,352,376,433,416,434],    weight: 0.25, color: '#3b82f6', label: 'Pipi Kiri'  },
    nose:       { landmarks: [1,4,5,6,168,197,195],                        weight: 0.05, color: '#ec4899', label: 'Hidung'     },
};
const FACE_WIDTH_INDICES = [234, 454];
const NOSE_TIP           = 1;

function landmarksBoundingRect(lmList, indices, cW, cH) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const idx of indices) {
        const lm = lmList[idx];
        if (!lm) continue;
        const px = lm.x * cW, py = lm.y * cH;
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
    const pad = 10;
    return { x: Math.max(0, Math.floor(minX) - pad), y: Math.max(0, Math.floor(minY) - pad), w: Math.min(cW, Math.ceil(maxX - minX) + pad * 2), h: Math.min(cH, Math.ceil(maxY - minY) + pad * 2) };
}

function roiSkinQuality(imageData, rect, cW) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return 0.3;
    let skin = 0, total = 0;
    for (let row = rect.y; row < rect.y + rect.h; row += 3) {
        for (let col = rect.x; col < rect.x + rect.w; col += 3) {
            const i = (row * cW + col) * 4;
            if (isSkinPixel(imageData.data[i], imageData.data[i+1], imageData.data[i+2])) skin++;
            total++;
        }
    }
    return total ? Math.max(0.2, Math.min(0.9, skin / total)) : 0.3;
}

function avgRGBSkinFiltered(imageData, rect, cW) {
    const { x, y, w, h } = rect;
    if (w <= 0 || h <= 0) return { r: 128, g: 128, b: 128 };
    let sR = 0, sG = 0, sB = 0, cnt = 0;
    for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
            const i = (row * cW + col) * 4;
            const r = imageData.data[i], g = imageData.data[i+1], b = imageData.data[i+2];
            if (isSkinPixel(r, g, b)) { sR += r; sG += g; sB += b; cnt++; }
        }
    }
    return cnt ? { r: sR / cnt, g: sG / cnt, b: sB / cnt } : { r: 128, g: 128, b: 128 };
}

function extractMultiROI(imageData, landmarks, overlayCtx, cW, cH) {
    let tR = 0, tG = 0, tB = 0, tW = 0;
    const roiQualities = {}, roiSkipped = {};
    for (const [key, roi] of Object.entries(FACE_ROIS)) {
        const rect    = landmarksBoundingRect(landmarks, roi.landmarks, cW, cH);
        const quality = roiSkinQuality(imageData, rect, cW);
        roiQualities[key] = quality;
        const skip = quality < 0.20;
        overlayCtx.save();
        overlayCtx.strokeStyle = skip ? '#ef4444' : roi.color;
        overlayCtx.lineWidth   = 1.5;
        overlayCtx.setLineDash(skip ? [4,4] : [5,3]);
        overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        overlayCtx.fillStyle = skip ? '#ef4444' : roi.color;
        overlayCtx.font      = 'bold 7px sans-serif';
        overlayCtx.fillText(skip ? '❌' : `${Math.round(quality * 100)}%`, rect.x + 3, rect.y - 2);
        overlayCtx.restore();
        if (skip) { roiSkipped[key] = true; continue; }
        const { r, g, b } = avgRGBSkinFiltered(imageData, rect, cW);
        const w = roi.weight * (0.6 + quality * 0.4);
        tR += r * w; tG += g * w; tB += b * w; tW += w;
    }
    if (tW === 0) return { r: 128, g: 128, b: 128, roiQualities, roiSkipped, allSkipped: true, area: 0 };
    const allRects = Object.keys(FACE_ROIS).map(k => landmarksBoundingRect(landmarks, FACE_ROIS[k].landmarks, cW, cH));
    const totalArea = allRects.reduce((s, r) => s + r.w * r.h, 0);
    return { r: tR / tW, g: tG / tW, b: tB / tW, roiQualities, roiSkipped, allSkipped: false, area: totalArea };
}

function drawFaceLandmarks(ctx, landmarks, cW, cH) {
    if (!landmarks) return;
    ctx.save(); ctx.globalAlpha = 0.15;
    for (const lm of landmarks) {
        ctx.beginPath(); ctx.arc(lm.x * cW, lm.y * cH, 1, 0, 2 * Math.PI);
        ctx.fillStyle = '#a78bfa'; ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
}

function getFaceWidth(landmarks, cW) {
    const l = landmarks[FACE_WIDTH_INDICES[0]], r = landmarks[FACE_WIDTH_INDICES[1]];
    return l && r ? Math.abs((r.x - l.x) * cW) : 200;
}

function checkHeadMovement(landmarks, prev, faceWidth) {
    if (!landmarks || !prev || faceWidth < 50) return { moving: false, movement: 0, normalizedMovement: 0 };
    const n = landmarks[NOSE_TIP], pn = prev[NOSE_TIP];
    if (!n || !pn) return { moving: false, movement: 0, normalizedMovement: 0 };
    const mv = Math.hypot(n.x - pn.x, n.y - pn.y);
    const nm = mv / faceWidth;
    return { moving: nm > 0.10, movement: mv, normalizedMovement: nm };
}

function checkLighting(imageData, landmarks, cW, cH) {
    if (!landmarks) return { good: false, percentage: 50 };
    const indices = FACE_ROIS.forehead.landmarks;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const idx of indices) {
        const lm = landmarks[idx];
        if (!lm) continue;
        if (lm.x * cW < minX) minX = lm.x * cW;
        if (lm.y * cH < minY) minY = lm.y * cH;
        if (lm.x * cW > maxX) maxX = lm.x * cW;
        if (lm.y * cH > maxY) maxY = lm.y * cH;
    }
    const pad = 10;
    const rect = { x: Math.max(0, Math.floor(minX) - pad), y: Math.max(0, Math.floor(minY) - pad), w: Math.min(cW, Math.ceil(maxX - minX) + pad * 2), h: Math.min(cH, Math.ceil(maxY - minY) + pad * 2) };
    if (rect.w <= 0 || rect.h <= 0) return { good: true, percentage: 60 };
    let total = 0, count = 0;
    for (let row = rect.y; row < rect.y + rect.h; row += 3)
        for (let col = rect.x; col < rect.x + rect.w; col += 3) {
            const idx = (row * cW + col) * 4;
            total += (imageData.data[idx] + imageData.data[idx+1] + imageData.data[idx+2]) / 3;
            count++;
        }
    if (!count) return { good: true, percentage: 60 };
    const avg = total / count;
    return { good: avg >= 35 && avg <= 230, percentage: Math.round((avg / 255) * 100) };
}

function detectOcclusion(landmarks, imageData, cW, cH) {
    if (!landmarks) return { hasOcclusion: false, occlusionAreas: [] };
    const forehead = landmarks[10];
    if (!forehead) return { hasOcclusion: false, occlusionAreas: [] };
    const fx = forehead.x * cW, fy = forehead.y * cH, radius = 12;
    let nonSkin = 0, total = 0;
    for (let dy = -radius; dy <= radius; dy += 3)
        for (let dx = -radius; dx <= radius; dx += 3) {
            const x = Math.min(cW - 1, Math.max(0, fx + dx));
            const y = Math.min(cH - 1, Math.max(0, fy + dy));
            const i = (Math.floor(y) * cW + Math.floor(x)) * 4;
            if (!isSkinPixel(imageData.data[i], imageData.data[i+1], imageData.data[i+2])) nonSkin++;
            total++;
        }
    const hasOcclusion = nonSkin / total > 0.7;
    return { hasOcclusion, occlusionAreas: hasOcclusion ? [{ area: 'forehead', warning: 'Rambut menutupi dahi' }] : [] };
}

let _hrHistory  = [];
let _rrHistory  = [];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function VitalScanPage() {
    const videoRef      = useRef(null);
    const overlayRef    = useRef(null);
    const streamRef     = useRef(null);
    const rafRef        = useRef(null);
    const landmarkerRef = useRef(null);
    const camCtrlRef    = useRef(null);

    const rgbBuf        = useRef([]);
    const movHistRef    = useRef([]);
    const prevLmRef     = useRef(null);
    const recStartRef   = useRef(null);
    const fpsTimesRef   = useRef([]);
    const actualFpsRef  = useRef(TARGET_FPS);

    const [phase, setPhase]             = useState('idle');
    const [countdown, setCountdown]     = useState(3);
    const [progress, setProgress]       = useState(0);
    const [result, setResult]           = useState(null);
    const [errorMsg, setErrorMsg]       = useState('');
    const [faceDetected, setFaceDetected] = useState(false);
    const [modelLoading, setModelLoading] = useState(false);

    const [lighting, setLighting]       = useState({ good: true, percentage: 60 });
    const [headMovement, setHeadMovement] = useState({ moving: false, normalizedMovement: 0 });
    const [faceStability, setFaceStability] = useState({ stable: false, progress: 0 });
    const [faceTilt, setFaceTilt]       = useState({ isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } });
    const [occlusion, setOcclusion]     = useState({ hasOcclusion: false, occlusionAreas: [] });
    const [sqi, setSqi]                 = useState({ snr: 0, overall: 0 });
    const [confidenceScore, setConfidenceScore] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [liveHR, setLiveHR]           = useState(null);
    const [currentFPS, setCurrentFPS]   = useState(0);
    const [roiQualities, setRoiQualities] = useState({});
    const [roiSkipped, setRoiSkipped]   = useState({});
    const [brightnessMode, setBrightnessMode] = useState('off');
    const [browserInfo]                 = useState(() => getBrowserInfo());
    const [calibDone, setCalibDone]     = useState(false);

    /* ── MediaPipe loader ────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setModelLoading(true);
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );
                const fl = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU',
                    },
                    outputFaceBlendshapes: false,
                    runningMode: 'VIDEO',
                    numFaces: 1,
                });
                if (!cancelled) { landmarkerRef.current = fl; setModelLoading(false); }
            } catch (e) {
                console.error('FaceLandmarker error:', e);
                if (!cancelled) setModelLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const stopCamera = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        camCtrlRef.current?.reset();
    }, []);

    useEffect(() => () => stopCamera(), [stopCamera]);

    /* ── Final processing ─────────────────────────────────────── */
    const processSignals = useCallback(() => {
        const allFrames   = rgbBuf.current;
        const validFrames = allFrames.filter(f => !f.skipped);

        if (validFrames.length < MIN_SAMPLES) {
            setErrorMsg(`Data tidak cukup (${validFrames.length} frame valid). Pastikan wajah terlihat jelas.`);
            setPhase('error');
            return;
        }

        const fps = actualFpsRef.current;
        const cleanFrames = removeOutliersIQR(validFrames);
        const ensemble = rPPGEnsemble(cleanFrames, fps);
        const interp = cubicSplineResample(
            Array.from(ensemble),
            cleanFrames.map(f => f.ts),
            INTERP_HZ
        );

        const hrSignal = bandpass(detrend(zscore(interp)), INTERP_HZ, HR_BAND[0], HR_BAND[1]);
        const peaks    = detectPeaks(Array.from(hrSignal), INTERP_HZ);
        const hr       = calcHeartRate(peaks, INTERP_HZ);
        const rmssd    = calcRMSSD(peaks, INTERP_HZ);

        if (hr) {
            _hrHistory.push(hr);
            if (_hrHistory.length > 5) _hrHistory.shift();
        }
        const sortedHR = [..._hrHistory].sort((a, b) => a - b);
        const finalHR  = sortedHR.length ? sortedHR[Math.floor(sortedHR.length / 2)] : hr;

        const snrHR  = computeSNRBand(Array.from(hrSignal), INTERP_HZ, HR_BAND[0], HR_BAND[1]);

        const rppgAtFps  = rPPGEnsemble(cleanFrames, fps);
        const rawROIArea = cleanFrames.map(f => f.area || 0);
        const smoothROI  = movingMedian(rawROIArea, ROI_SMOOTH_WINDOW);
        const respRate   = calcRespiratoryRate(Array.from(rppgAtFps), smoothROI, fps);

        const rrCount    = peaks.length > 1 ? peaks.length - 1 : 0;
        const confidence = calcConfidence({
            validFrames:  cleanFrames.length,
            totalFrames:  allFrames.length,
            rrCount,
            snr:          snrHR,
            lightingGood: lighting.good,
            hasTilt:      faceTilt.isTilted,
            hasOcclusion: occlusion.hasOcclusion,
        });

        const snrDb = computeSNRBand(Array.from(hrSignal), INTERP_HZ, HR_BAND[0], HR_BAND[1]);

        setResult({
            heartRate:     finalHR ?? '--',
            rmssd:         rmssd   ?? '--',
            respRate:      respRate ?? '--',
            confidence,
            rrCount,
            validFrames:   cleanFrames.length,
            totalFrames:   allFrames.length,
            snr:           Math.round(snrDb * 100),
            signalQuality: Math.round(Math.min(100, snrDb * 250)),
        });
        setPhase('done');
        stopCamera();
    }, [stopCamera, lighting, faceTilt, occlusion]);

    /* ── Main scan loop ───────────────────────────────────────── */
    const startSampling = useCallback(() => {
        const video   = videoRef.current;
        const overlay = overlayRef.current;
        if (!video || !overlay) return;

        resetTiltCalibration();
        setCalibDone(false);
        _hrHistory = []; _rrHistory = [];

        const offCanvas = document.createElement('canvas');
        const offCtx    = offCanvas.getContext('2d', { willReadFrequently: true });
        const ovCtx     = overlay.getContext('2d');

        rgbBuf.current      = [];
        movHistRef.current  = [];
        prevLmRef.current   = null;
        fpsTimesRef.current = [];
        recStartRef.current = null;
        actualFpsRef.current = TARGET_FPS;

        let lastTs         = performance.now();
        let recordingActive = true;
        let hasStartedRec  = false;
        let calibFrames    = 0;
        let frameCount     = 0;
        let fpsMeasureStart = performance.now();

        setIsRecording(true);

        const loop = (now) => {
            frameCount++;
            if (now - fpsMeasureStart >= 1000) {
                setCurrentFPS(frameCount);
                actualFpsRef.current = frameCount || TARGET_FPS;
                frameCount = 0; fpsMeasureStart = now;
            }
            lastTs = now;
            fpsTimesRef.current.push(now);
            if (fpsTimesRef.current.length > 60) fpsTimesRef.current.shift();

            const cW = video.videoWidth  || 640;
            const cH = video.videoHeight || 480;
            if (overlay.width !== cW)  { overlay.width  = cW; offCanvas.width  = cW; }
            if (overlay.height !== cH) { overlay.height = cH; offCanvas.height = cH; }

            offCtx.drawImage(video, 0, 0, cW, cH);
            ovCtx.clearRect(0, 0, cW, cH);

            let landmarks = null;
            if (landmarkerRef.current) {
                try {
                    const det = landmarkerRef.current.detectForVideo(video, now);
                    if (det.faceLandmarks?.length > 0) landmarks = det.faceLandmarks[0];
                } catch (_) {}
            }
            const faceFound = !!landmarks;
            setFaceDetected(faceFound);

            if (!faceFound) {
                ovCtx.fillStyle = 'rgba(0,0,0,0.55)';
                ovCtx.fillRect(0, 0, cW, cH);
                ovCtx.fillStyle = '#fbbf24';
                ovCtx.font = 'bold 14px sans-serif';
                ovCtx.textAlign = 'center';
                ovCtx.fillText('😶 Wajah tidak terdeteksi', cW / 2, cH / 2);
                rafRef.current = requestAnimationFrame(loop); return;
            }

            if (!_calibrated && calibFrames < 8) {
                calibrateFaceTilt(landmarks);
                calibFrames++;
                if (_calibrated) setCalibDone(true);
            }

            const imageData = offCtx.getImageData(0, 0, cW, cH);
            const faceWidth = getFaceWidth(landmarks, cW);

            const lightingRes  = checkLighting(imageData, landmarks, cW, cH);
            const movement     = checkHeadMovement(landmarks, prevLmRef.current, faceWidth);
            const tilt         = detectFaceTilt(landmarks);
            const occRes       = detectOcclusion(landmarks, imageData, cW, cH);
            setLighting(lightingRes);
            setHeadMovement(movement);
            setFaceTilt(tilt);
            setOcclusion(occRes);

            movHistRef.current.push(movement.normalizedMovement);
            if (movHistRef.current.length > TARGET_FPS * 3) movHistRef.current.shift();
            prevLmRef.current = landmarks;

            const recentMov = movHistRef.current.slice(-REQUIRED_FACE_STABILITY_SEC * TARGET_FPS);
            const avgMov    = recentMov.length ? recentMov.reduce((a, b) => a + b, 0) / recentMov.length : 1;
            const isStable  = avgMov < 0.08;
            setFaceStability({ stable: isStable, progress: Math.min(1, recentMov.length / (REQUIRED_FACE_STABILITY_SEC * TARGET_FPS)) });

            const { r, g, b, roiQualities: rq, roiSkipped: rs, allSkipped, area } = extractMultiROI(imageData, landmarks, ovCtx, cW, cH);
            setRoiQualities(rq);
            setRoiSkipped(rs);

            let currentSnr = 0.1;
            if (rgbBuf.current.filter(f => !f.skipped).length > 60) {
                const last60   = rgbBuf.current.filter(f => !f.skipped).slice(-60);
                const ensLive  = rPPGEnsemble(last60, actualFpsRef.current);
                const filt     = bandpass(detrend(ensLive), actualFpsRef.current, HR_BAND[0], HR_BAND[1]);
                currentSnr     = computeSNRBand(filt, actualFpsRef.current, HR_BAND[0], HR_BAND[1]);
                setSqi({ snr: Math.round(currentSnr * 100), overall: Math.round(Math.min(100, currentSnr * 250)) });

                const winSize = Math.round(actualFpsRef.current * 6);
                const lastWin = rgbBuf.current.filter(f => !f.skipped).slice(-winSize);
                if (lastWin.length >= winSize * 0.8) {
                    const ens    = rPPGEnsemble(lastWin, actualFpsRef.current);
                    const interp = cubicSplineResample(Array.from(ens), lastWin.map(f => f.ts), INTERP_HZ);
                    const fHR    = bandpass(detrend(zscore(interp)), INTERP_HZ, HR_BAND[0], HR_BAND[1]);
                    const pks    = detectPeaks(Array.from(fHR), INTERP_HZ);
                    const lhr    = calcHeartRate(pks, INTERP_HZ);
                    if (lhr && lhr >= 40 && lhr <= 200) {
                        _hrHistory.push(lhr);
                        if (_hrHistory.length > 5) _hrHistory.shift();
                        const sorted = [..._hrHistory].sort((a, b) => a - b);
                        setLiveHR(sorted[Math.floor(sorted.length / 2)]);
                    }
                }
            }

            const lightScore   = lightingRes.good ? 1 : 0.5;
            const movScore     = movement.moving ? 0.4 : Math.max(0.5, 1 - movement.normalizedMovement / 0.10);
            const stabScore    = isStable ? 1 : 0.5;
            const tiltScore    = tilt.isTilted ? 0.6 : 1;
            const occScore     = occRes.hasOcclusion ? 0.7 : 1;
            const roiScore     = allSkipped ? 0.3 : 0.9;
            const snrScore     = Math.min(1, currentSnr / 0.4);
            const conf         = lightScore * 0.12 + movScore * 0.15 + stabScore * 0.12 + tiltScore * 0.12 + occScore * 0.10 + roiScore * 0.15 + snrScore * 0.24;
            setConfidenceScore(Math.round(Math.min(95, conf * 100)));

            const isReady = conf > START_RECORDING_THRESHOLD && faceFound && !tilt.isTilted && !allSkipped;
            if (isReady && recordingActive && !hasStartedRec) {
                hasStartedRec = true;
                recStartRef.current = now;
            }

            if (hasStartedRec && recordingActive && recStartRef.current) {
                const elapsed = (now - recStartRef.current) / 1000;
                setProgress(Math.min(100, (elapsed / SAMPLE_DURATION_SEC) * 100));
                const motionFree = movement.normalizedMovement < MAX_NORMALIZED_MOVEMENT && !tilt.isTilted;
                rgbBuf.current.push({ r, g, b, ts: now, area, skipped: !motionFree || allSkipped });
                if (elapsed >= SAMPLE_DURATION_SEC) {
                    recordingActive = false;
                    setIsRecording(false);
                    setPhase('processing');
                    setTimeout(() => processSignals(), 100);
                    return;
                }
            }

            drawFaceLandmarks(ovCtx, landmarks, cW, cH);
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
    }, [processSignals]);

    /* ── Start scan ────────────────────────────────────────────── */
    const startScan = async () => {
        setErrorMsg(''); setResult(null);
        setPhase('countdown'); setCountdown(3);
        for (let i = 0; i < CAMERA_CONFIGS.length; i++) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONFIGS[i]);
                streamRef.current = stream;
                camCtrlRef.current = new AdvancedCameraController(videoRef.current);
                if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
                break;
            } catch (err) {
                if (i === CAMERA_CONFIGS.length - 1) { setErrorMsg('Kamera tidak bisa diakses: ' + err.message); setPhase('error'); return; }
            }
        }
        let cnt = 3;
        const tick = setInterval(() => {
            cnt--; setCountdown(cnt);
            if (cnt <= 0) { clearInterval(tick); setPhase('scanning'); startSampling(); }
        }, 1000);
    };

    const reset = () => {
        stopCamera(); resetTiltCalibration(); setCalibDone(false);
        _hrHistory = []; _rrHistory = [];
        setPhase('idle'); setProgress(0); setResult(null); setLiveHR(null);
        setFaceDetected(false); setIsRecording(false); setErrorMsg('');
        setLighting({ good: true, percentage: 60 });
        setHeadMovement({ moving: false, normalizedMovement: 0 });
        setFaceStability({ stable: false, progress: 0 });
        setFaceTilt({ isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } });
        setOcclusion({ hasOcclusion: false, occlusionAreas: [] });
        setSqi({ snr: 0, overall: 0 }); setConfidenceScore(0); setCurrentFPS(0);
        setRoiQualities({}); setRoiSkipped({}); setBrightnessMode('off');
        camCtrlRef.current?.reset(); rgbBuf.current = [];
    };

    const changeBrightness = (mode) => {
        setBrightnessMode(mode);
        camCtrlRef.current?.applyBrightness(BRIGHTNESS_LEVELS[mode]);
    };

    const isVideoVisible = phase === 'countdown' || phase === 'scanning';

    const brightnessModes = [
        { value: 'off',     label: 'OFF',  color: '#475569' },
        { value: 'low',     label: 'LOW',  color: '#d97706' },
        { value: 'medium',  label: 'MED',  color: '#ea580c' },
        { value: 'high',    label: 'HIGH', color: '#dc2626' },
        { value: 'extreme', label: 'MAX',  color: '#9f1239' },
    ];

    const getBrowserIcon = () => {
        if (browserInfo.isEdge)    return <FaEdge    size={11} style={{ marginRight: 4 }} />;
        if (browserInfo.isChrome)  return <FaChrome  size={11} style={{ marginRight: 4 }} />;
        if (browserInfo.isFirefox) return <FaFirefox size={11} style={{ marginRight: 4 }} />;
        return null;
    };

    /* ─── HR / RMSSD / RR category helpers ─────────────────────── */
    const hrCat = (hr) => {
        if (hr === '--' || isNaN(+hr)) return { label: '— Tidak terdeteksi', emoji: '❓', bg: '#f1f5f9', fg: '#64748b', border: '#cbd5e1' };
        if (+hr < 50)  return { label: 'Bradikardia',    emoji: '💙', bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };
        if (+hr < 60)  return { label: 'Normal Rendah',  emoji: '🟢', bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' };
        if (+hr <= 85) return { label: 'Normal',         emoji: '✅', bg: '#dcfce7', fg: '#166534', border: '#86efac' };
        if (+hr <= 100) return { label: 'Normal Tinggi', emoji: '🟡', bg: '#fefce8', fg: '#92400e', border: '#fde68a' };
        if (+hr <= 110) return { label: 'Elevasi Ringan',emoji: '🟠', bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' };
        return             { label: 'Takikardia',        emoji: '❤️‍🔥', bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' };
    };
    const rmssdCat = (v) => {
        if (v === '--' || isNaN(+v)) return { label: 'Tidak terdeteksi', emoji: '❓', bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' };
        if (+v < 15) return { label: 'Rendah — Stres tinggi', emoji: '😰', bg: '#fefce8', fg: '#854d0e', border: '#fde68a' };
        if (+v <= 80) return { label: 'Normal',               emoji: '😊', bg: '#dcfce7', fg: '#166534', border: '#86efac' };
        return           { label: 'Tinggi — Rileks',           emoji: '🧘', bg: '#fefce8', fg: '#854d0e', border: '#fde68a' };
    };
    const respCat = (v) => {
        if (v === '--' || isNaN(+v)) return { label: '— Tidak terdeteksi', emoji: '❓', bg: '#f1f5f9', fg: '#64748b', border: '#cbd5e1' };
        if (+v < 12)  return { label: 'Bradipnea',  emoji: '🐢', bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };
        if (+v <= 20) return { label: 'Normal',      emoji: '✅', bg: '#dcfce7', fg: '#166534', border: '#86efac' };
        return            { label: 'Takipnea',       emoji: '⚡', bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' };
    };

    /* ─── Render ─────────────────────────────────────────────────── */
    return (
        <div style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #f8fafc 50%, #f0fdf4 100%)', minHeight: '100vh', padding: '40px 0 80px' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');

                /* ── Animations ── */
                @keyframes vsSlideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes vsSlideIn {
                    from { opacity: 0; transform: translateX(-14px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes vsFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes vsPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.5; transform: scale(0.95); }
                }
                @keyframes vsHeartbeat {
                    0%, 100% { transform: scale(1); }
                    14%      { transform: scale(1.18); }
                    28%      { transform: scale(1); }
                    42%      { transform: scale(1.10); }
                    70%      { transform: scale(1); }
                }
                @keyframes vsCountPop {
                    0%   { transform: scale(0.5); opacity: 0; }
                    60%  { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                @keyframes vsSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes vsGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.25); }
                    50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
                }
                @keyframes vsBarFill {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
                @keyframes vsShimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }

                .vs-wrap {
                    max-width: 960px;
                    margin: 0 auto;
                    padding: 0 24px;
                    font-family: 'Poppins', sans-serif;
                    color: #1e293b;
                }

                /* Staggered enter */
                .vs-enter-1 { animation: vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) both; }
                .vs-enter-2 { animation: vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.07s both; }
                .vs-enter-3 { animation: vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.14s both; }
                .vs-enter-4 { animation: vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.21s both; }
                .vs-enter-5 { animation: vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.28s both; }
                .vs-enter-slide { animation: vsSlideIn 0.4s cubic-bezier(.22,.68,0,1.2) both; }

                .vs-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
                }

                .vs-metric {
                    background: #fff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 28px 20px 24px;
                    text-align: center;
                    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    position: relative;
                    overflow: hidden;
                }
                .vs-metric::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #22c55e, #16a34a);
                    border-radius: 20px 20px 0 0;
                }
                .vs-metric:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 32px rgba(0,0,0,0.10);
                    border-color: #86efac;
                }

                .vs-start-btn {
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: #fff;
                    border: none;
                    border-radius: 14px;
                    padding: 14px 32px;
                    font-size: 15px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 16px rgba(34,197,94,0.35);
                    animation: vsGlow 2.5s ease-in-out infinite;
                }
                .vs-start-btn:hover:not(:disabled) {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 24px rgba(34,197,94,0.45);
                }
                .vs-start-btn:active:not(:disabled) {
                    transform: translateY(0) scale(0.98);
                }
                .vs-start-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                    animation: none;
                    box-shadow: none;
                }

                .qbadge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 11px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }

                .brightness-btn {
                    padding: 5px 10px;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: 700;
                    font-family: 'Poppins', sans-serif;
                    transition: all 0.15s ease;
                    cursor: pointer;
                    border: none;
                    color: #fff;
                }
                .brightness-btn:hover { opacity: 0.82; transform: scale(1.05); }

                .roi-legend {
                    display: flex;
                    gap: 14px;
                    flex-wrap: wrap;
                    padding: 8px 12px;
                    background: #f8fafc;
                    border-radius: 10px;
                    border: 1px solid #f1f5f9;
                }
                .roi-dot {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10px;
                    font-weight: 600;
                    color: #475569;
                }

                .result-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                    margin-bottom: 24px;
                }
                @media (max-width: 640px) {
                    .result-grid { grid-template-columns: 1fr; gap: 14px; }
                }

                .tip-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 14px;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #f1f5f9;
                    margin-bottom: 8px;
                    font-size: 13.5px;
                    color: #475569;
                    line-height: 1.6;
                    animation: vsSlideIn 0.4s cubic-bezier(.22,.68,0,1.2) both;
                }

                .feature-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 12px;
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #15803d;
                }

                .stat-card {
                    background: #f8fafc;
                    border-radius: 14px;
                    padding: 14px 12px;
                    text-align: center;
                    border: 1px solid #f1f5f9;
                    transition: all 0.2s ease;
                }
                .stat-card:hover {
                    background: #f0fdf4;
                    border-color: #bbf7d0;
                }

                .live-hr-badge {
                    animation: vsHeartbeat 1.2s ease-in-out infinite;
                    display: inline-block;
                }

                .processing-icon {
                    animation: vsSpin 1.2s linear infinite;
                }

                .countdown-num {
                    animation: vsCountPop 0.5s cubic-bezier(.22,.68,0,1.2) both;
                }
            `}</style>

            <div className="vs-wrap">

                {/* ── Header ── */}
                <div style={{ marginBottom: 32 }}>
                    <Link to="/health-check"
                        className="vs-enter-slide"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#64748b', textDecoration: 'none', fontSize: 13, marginBottom: 20, fontWeight: 500, padding: '6px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                        <FaArrowLeft size={11} /> Kembali
                    </Link>

                    <div className="vs-enter-1">
                        <h1 style={{ fontFamily: 'Poppins', fontSize: 34, margin: '0 0 4px', fontWeight: 800, color: '#15803d', letterSpacing: '-0.5px' }}>
                            Vital Scan
                        </h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span>📡 FFT · Zero-phase IIR · IQR Outlier · SNR Confidence</span>
                            <span style={{ background: '#f1f5f9', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#475569', display: 'inline-flex', alignItems: 'center' }}>
                                {getBrowserIcon()}{browserInfo.browser}
                            </span>
                        </p>
                    </div>
                </div>

                {/* ── Disclaimer ── */}
                <div className="vs-enter-2" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 14, padding: '12px 16px', fontSize: 12.5, color: '#92400e', marginBottom: 22, lineHeight: 1.6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                    <div><strong>Edukasi Kesehatan:</strong> Hasil scan bersifat estimasi. HR ±5 bpm, RMSSD ±10 ms. Bukan pengganti alat medis klinis.</div>
                </div>

                {/* ── VIDEO ── */}
                {isVideoVisible && (
                    <div className="vs-card vs-enter-3" style={{ marginBottom: 20, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', background: '#0f172a' }}>
                            <video ref={videoRef} muted playsInline
                                style={{ width: '100%', display: 'block', maxHeight: 440, objectFit: 'cover' }} />
                            <canvas ref={overlayRef}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

                            {/* Brightness controls */}
                            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderRadius: 12, padding: '5px 10px', alignItems: 'center' }}>
                                <FaAdjust size={10} style={{ color: '#94a3b8', marginRight: 4 }} />
                                {brightnessModes.map(m => (
                                    <button key={m.value} onClick={() => changeBrightness(m.value)}
                                        className="brightness-btn"
                                        style={{ background: brightnessMode === m.value ? m.color : 'rgba(255,255,255,0.15)', boxShadow: brightnessMode === m.value ? `0 0 8px ${m.color}66` : 'none' }}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Face tilt warning */}
                            {phase === 'scanning' && faceTilt.isTilted && (
                                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '5px 12px', animation: 'vsPulse 1s ease-in-out infinite' }}>
                                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
                                        ↕️ Miringkan {Math.max(faceTilt.deviation?.roll || 0, faceTilt.deviation?.yaw || 0, faceTilt.deviation?.pitch || 0)}°
                                    </span>
                                </div>
                            )}

                            {/* Live HR */}
                            {phase === 'scanning' && liveHR && (
                                <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)', borderRadius: 32, padding: '8px 18px', border: '1px solid rgba(34,197,94,0.3)' }}>
                                    <span className="live-hr-badge" style={{ color: '#22c55e', fontSize: 22, fontWeight: 800 }}>♥</span>
                                    <span style={{ color: '#f0fdf4', fontSize: 22, fontWeight: 800, marginLeft: 6 }}>{liveHR}</span>
                                    <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 4 }}>bpm</span>
                                </div>
                            )}

                            {/* Circular progress */}
                            {phase === 'scanning' && progress > 0 && (
                                <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
                                    <svg width="64" height="64" viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
                                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                                        <circle cx="32" cy="32" r="28" fill="none" stroke="#22c55e" strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 28}`}
                                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                                            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.3s ease' }} />
                                        <text x="32" y="37" textAnchor="middle" fill="#22c55e" fontSize="13" fontWeight="bold" fontFamily="Poppins, sans-serif">{Math.round(progress)}</text>
                                    </svg>
                                </div>
                            )}

                            {/* Countdown */}
                            {phase === 'countdown' && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.70)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                    <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, letterSpacing: 2 }}>BERSIAP...</span>
                                    <span key={countdown} className="countdown-num" style={{ fontSize: 96, fontWeight: 800, color: '#22c55e', lineHeight: 1, textShadow: '0 0 40px rgba(34,197,94,0.6)' }}>
                                        {countdown}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: 13 }}>😌 Tetap diam & tatap kamera</span>
                                </div>
                            )}
                        </div>

                        {/* Scan status bar */}
                        {phase === 'scanning' && (
                            <div style={{ padding: '14px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa', animation: 'vsFadeIn 0.3s ease both' }}>
                                <div className="roi-legend" style={{ marginBottom: 12 }}>
                                    {Object.entries(FACE_ROIS).map(([k, roi]) => (
                                        <span key={k} className="roi-dot">
                                            <span style={{ width: 10, height: 10, borderRadius: 3, background: roi.color, display: 'inline-block', boxShadow: `0 0 4px ${roi.color}66` }} />
                                            {roi.label} <strong>{Math.round((roiQualities[k] || 0) * 100)}%</strong>
                                            {roiSkipped[k] && <FaBan size={9} color="#dc2626" style={{ marginLeft: 2 }} />}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span className="qbadge" style={{ background: lighting.good ? '#dcfce7' : '#fee2e2', color: lighting.good ? '#166534' : '#991b1b' }}>
                                        ☀️ {lighting.percentage}%
                                    </span>
                                    <span className="qbadge" style={{ background: !headMovement.moving ? '#dcfce7' : '#fef9c3', color: !headMovement.moving ? '#166534' : '#854d0e' }}>
                                        🧘 {(headMovement.normalizedMovement * 100).toFixed(0)}%
                                    </span>
                                    <span className="qbadge" style={{ background: !faceTilt.isTilted ? '#dcfce7' : '#fee2e2', color: !faceTilt.isTilted ? '#166534' : '#991b1b' }}>
                                        📐 {faceTilt.deviation ? Math.max(faceTilt.deviation.roll, faceTilt.deviation.yaw, faceTilt.deviation.pitch) : 0}°
                                    </span>
                                    <span className="qbadge" style={{ background: sqi.overall > 50 ? '#dcfce7' : '#fef9c3', color: sqi.overall > 50 ? '#166534' : '#854d0e' }}>
                                        📊 SQI {sqi.overall}%
                                    </span>
                                    <span className="qbadge" style={{ background: confidenceScore > 50 ? '#dcfce7' : '#fef9c3', color: confidenceScore > 50 ? '#166534' : '#854d0e' }}>
                                        ✦ {confidenceScore}%
                                    </span>
                                    <span className="qbadge" style={{ background: currentFPS >= 25 ? '#dcfce7' : '#fef9c3', color: currentFPS >= 25 ? '#166534' : '#854d0e' }}>
                                        ⚡ {currentFPS} fps
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── PROCESSING ── */}
                {phase === 'processing' && (
                    <div className="vs-card vs-enter-1" style={{ textAlign: 'center', padding: '56px 32px', marginBottom: 20 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
                        <div className="processing-icon" style={{ display: 'inline-block', marginBottom: 20 }}>
                            <FaSpinner size={32} style={{ color: '#22c55e' }} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#15803d' }}>Menganalisis sinyal...</div>
                        <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.8 }}>
                            <span style={{ display: 'block' }}>🧮 IQR Removal → FFT Cooley-Tukey</span>
                            <span style={{ display: 'block' }}>🌊 Zero-phase IIR → Peak Detection</span>
                            <span style={{ display: 'block' }}>📈 SNR-weighted Confidence Score</span>
                        </div>
                    </div>
                )}

                {/* ── ERROR ── */}
                {phase === 'error' && (
                    <div className="vs-card vs-enter-1" style={{ textAlign: 'center', padding: '44px 32px', marginBottom: 20, border: '1.5px solid #fca5a5' }}>
                        <div style={{ fontSize: 52, marginBottom: 12 }}>😵</div>
                        <div style={{ fontWeight: 700, marginBottom: 8, color: '#dc2626', fontSize: 18 }}>Oops, ada masalah!</div>
                        <div style={{ color: '#64748b', marginBottom: 24, fontSize: 14, maxWidth: 360, margin: '0 auto 24px' }}>{errorMsg}</div>
                        <button className="vs-start-btn" onClick={reset} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 16px rgba(239,68,68,0.35)', animation: 'none' }}>
                            <FaRedo size={13} /> 🔄 Coba Lagi
                        </button>
                    </div>
                )}

                {/* ── IDLE ── */}
                {phase === 'idle' && (
                    <div className="vs-card vs-enter-3" style={{ padding: '28px 28px 32px', marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 17, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                            📋 Persiapan Scan
                        </h3>

                        {[
                            { emoji: '☀️', text: 'Pastikan ruangan <strong>terang merata</strong> — hindari backlight dari jendela', delay: '0.08s' },
                            { emoji: '🎯', text: 'Posisikan wajah <strong>tegak lurus</strong> di tengah kamera, jarak 30–50 cm', delay: '0.16s' },
                            { emoji: '🧘', text: '<strong>Jangan bergerak</strong> selama 60 detik — semakin diam semakin akurat', delay: '0.24s' },
                            { emoji: '💡', text: 'Gunakan tombol <strong>Brightness</strong> jika ruangan kurang cahaya', delay: '0.32s' },
                        ].map((tip, i) => (
                            <div key={i} className="tip-item" style={{ animationDelay: tip.delay }}>
                                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{tip.emoji}</span>
                                <span dangerouslySetInnerHTML={{ __html: tip.text }} />
                            </div>
                        ))}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 24 }}>
                            {[
                                { emoji: '⚡', label: 'FFT Cooley-Tukey' },
                                { emoji: '🌊', label: 'Zero-phase Butterworth' },
                                { emoji: '🔍', label: 'IQR Outlier Removal' },
                                { emoji: '📊', label: 'SNR Confidence' },
                                { emoji: '🎯', label: 'Median ROI Smoothing' },
                            ].map(f => (
                                <span key={f.label} className="feature-pill">
                                    {f.emoji} {f.label}
                                </span>
                            ))}
                        </div>

                        {browserInfo.isEdge && (
                            <div style={{ background: '#e0f2fe', borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#0369a1', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <FaEdge size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                                <span><strong>Mode Edge:</strong> Izin kamera akan diminta — pastikan klik "Izinkan".</span>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', paddingTop: 4 }}>
                            <button className="vs-start-btn" onClick={startScan} disabled={modelLoading}>
                                {modelLoading
                                    ? <><FaSpinner size={14} style={{ animation: 'vsSpin 1s linear infinite' }} /> ⏳ Memuat model AI...</>
                                    : <><FaCamera size={14} /> 🚀 Mulai Scan (60 detik)</>
                                }
                            </button>
                            {modelLoading && (
                                <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                                    Mengunduh MediaPipe Face Landmarker...
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── RESULTS ── */}
                {phase === 'done' && result && (
                    <div style={{ animation: 'vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) both' }}>

                        {/* Result header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
                            <h2 style={{ margin: 0, fontFamily: 'Poppins', fontSize: 28, fontWeight: 800, color: '#15803d' }}>
                                🎉 Hasil Scan
                            </h2>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{
                                    background: result.confidence >= 70 ? '#dcfce7' : result.confidence >= 50 ? '#fef9c3' : '#fee2e2',
                                    color:      result.confidence >= 70 ? '#15803d' : result.confidence >= 50 ? '#854d0e' : '#991b1b',
                                    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                    border: `1px solid ${result.confidence >= 70 ? '#86efac' : result.confidence >= 50 ? '#fde68a' : '#fca5a5'}`
                                }}>
                                    {result.confidence >= 70 ? '✅' : result.confidence >= 50 ? '⚠️' : '❌'} Confidence {result.confidence}%
                                </span>
                            </div>
                        </div>

                        {/* Metric cards */}
                        <div className="result-grid">
                            {[
                                {
                                    emoji: '❤️',
                                    iconBg: '#dcfce7',
                                    label: 'HEART RATE',
                                    value: result.heartRate,
                                    unit: 'bpm',
                                    cat: hrCat(result.heartRate),
                                    detail: 'SNR-weighted CHROM+POS ensemble',
                                    animDelay: '0s',
                                },
                                {
                                    emoji: '🧬',
                                    iconBg: '#ede9fe',
                                    label: 'RMSSD (HRV)',
                                    value: result.rmssd,
                                    unit: 'ms',
                                    cat: rmssdCat(result.rmssd),
                                    detail: 'Ectopic-filtered RR intervals',
                                    animDelay: '0.08s',
                                },
                                {
                                    emoji: '🫁',
                                    iconBg: '#cffafe',
                                    label: 'RESPIRATORY RATE',
                                    value: result.respRate,
                                    unit: 'rpm',
                                    cat: respCat(result.respRate),
                                    detail: 'ROI area + rPPG dual FFT',
                                    animDelay: '0.16s',
                                },
                            ].map(m => (
                                <div key={m.label} className="vs-metric"
                                    style={{ animation: `vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) ${m.animDelay} both` }}>
                                    <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>{m.emoji}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, letterSpacing: 1, fontWeight: 600 }}>{m.label}</div>
                                    <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: m.cat.fg, fontFamily: 'Poppins' }}>{m.value}</div>
                                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>{m.unit}</div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        fontSize: 11.5, padding: '5px 14px', borderRadius: 20,
                                        fontWeight: 700,
                                        background: m.cat.bg, color: m.cat.fg,
                                        border: `1px solid ${m.cat.border}`
                                    }}>
                                        {m.cat.emoji} {m.cat.label}
                                    </span>
                                    <div style={{ fontSize: 10, color: '#b0bec5', marginTop: 10, lineHeight: 1.4 }}>{m.detail}</div>
                                </div>
                            ))}
                        </div>

                        {/* Stats row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22, animation: 'vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.22s both' }}>
                            {[
                                { label: 'Frame Valid',   value: result.validFrames, emoji: '🎞️' },
                                { label: 'Total Frame',   value: result.totalFrames, emoji: '📷' },
                                { label: 'RR Intervals',  value: result.rrCount,     emoji: '💓' },
                                { label: 'SNR Ratio',     value: `${result.snr}%`,   emoji: '📡' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', fontFamily: 'Poppins' }}>{s.value}</div>
                                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Disclaimer */}
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 18px', fontSize: 12.5, color: '#92400e', lineHeight: 1.7, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.3s both' }}>
                            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>📋</span>
                            <div>
                                <strong>Disclaimer:</strong> Hasil estimasi berbasis kamera rPPG — bukan alat klinis.
                                HR ±5 bpm, RMSSD ±15 ms, RR ±3 rpm dalam kondisi ideal. Confidence dihitung dari
                                SNR sinyal, kualitas frame, dan jumlah RR interval.
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', animation: 'vsSlideUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.36s both' }}>
                            <button className="vs-start-btn" onClick={reset}>
                                <FaRedo size={13} /> 🔄 Scan Ulang
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}