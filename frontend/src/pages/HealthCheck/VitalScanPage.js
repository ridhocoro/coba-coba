// VitalScanPage.js — v15 (Fixed RMSSD - No More Fake 120)

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
    FaHeartbeat, FaArrowLeft, FaCamera, FaRedo, FaInfoCircle,
    FaLungs, FaWaveSquare, FaLightbulb, FaUserCheck,
    FaExclamationTriangle, FaCheckCircle, FaSpinner, FaChartLine,
    FaGlasses, FaAngleDoubleUp, FaRegDotCircle, FaBan
} from 'react-icons/fa';

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const SAMPLE_DURATION_SEC = 30;
const TARGET_FPS = 30;
const INTERP_HZ = 250;
const MAX_NORMALIZED_MOVEMENT = 0.10;
const REQUIRED_FACE_STABILITY_SEC = 1;
const START_RECORDING_THRESHOLD = 0.40;
const MIN_SAMPLES = 30;
const ROI_MIN_QUALITY = 0.20;

// ROI untuk ekstraksi data rPPG
const FACE_ROIS = {
    forehead: {
        landmarks: [10, 67, 69, 104, 108, 151, 337, 299, 298, 333],
        weight: 0.45,
        color: '#f59e0b',
        label: 'Dahi'
    },
    leftCheek: {
        landmarks: [50, 101, 118, 117, 116, 123, 147, 213, 192, 214],
        weight: 0.25,
        color: '#10b981',
        label: 'Pipi Kiri'
    },
    rightCheek: {
        landmarks: [280, 330, 347, 346, 345, 352, 376, 433, 416, 434],
        weight: 0.25,
        color: '#3b82f6',
        label: 'Pipi Kanan'
    },
    nose: {
        landmarks: [1, 4, 5, 6, 168, 197, 195],
        weight: 0.05,
        color: '#ec4899',
        label: 'Hidung'
    }
};

// Landmark untuk face tracking
const FACE_WIDTH_INDICES = [234, 454];
const NOSE_TIP = 1;

// Riwayat untuk smoothing
let hrHistory = [];
let rrHistory = [];

/* ══════════════════════════════════════════════════════════════════════════════
   SKIN DETECTION (YCbCr Color Space)
══════════════════════════════════════════════════════════════════════════════ */

function isSkinPixel(r, g, b) {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    
    const isSkinCb = cb >= 77 && cb <= 127;
    const isSkinCr = cr >= 133 && cr <= 173;
    const isSkinY = y > 40 && y < 235;
    
    return isSkinCb && isSkinCr && isSkinY;
}

/* ══════════════════════════════════════════════════════════════════════════════
   FACE TILT DETECTION - DENGAN AUTO CALIBRATION
══════════════════════════════════════════════════════════════════════════════ */

let calibratedRoll = 0;
let calibratedYaw = 0;
let calibratedPitch = 0;
let isCalibrated = false;

function calibrateFaceTilt(landmarks) {
    if (!landmarks || isCalibrated) return;
    
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const chin = landmarks[152];
    
    if (leftEye && rightEye && nose && chin) {
        const eyeDeltaX = rightEye.x - leftEye.x;
        const eyeDeltaY = rightEye.y - leftEye.y;
        calibratedRoll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);
        
        const eyeMidX = (leftEye.x + rightEye.x) / 2;
        calibratedYaw = Math.atan2(nose.x - eyeMidX, Math.abs(eyeDeltaX) * 0.5) * (180 / Math.PI);
        
        const faceHeight = Math.abs(chin.y - nose.y);
        const noseToTop = Math.abs(nose.y - (landmarks[10]?.y || nose.y));
        calibratedPitch = ((noseToTop / (faceHeight + 1e-6)) - 0.5) * 90;
        
        isCalibrated = true;
    }
}

function resetTiltCalibration() {
    isCalibrated = false;
    calibratedRoll = 0;
    calibratedYaw = 0;
    calibratedPitch = 0;
}

function detectFaceTilt(landmarks, useCalibration = true) {
    if (!landmarks || landmarks.length < 468) { 
        return { yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } };
    }
    
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const chin = landmarks[152];
    
    if (!leftEye || !rightEye || !nose || !chin) {
        return { yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } };
    }
    
    const eyeDeltaX = rightEye.x - leftEye.x;
    const eyeDeltaY = rightEye.y - leftEye.y;
    let roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);
    
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    let yaw = Math.atan2(nose.x - eyeMidX, Math.abs(eyeDeltaX) * 0.5) * (180 / Math.PI);
    
    const faceHeight = Math.abs(chin.y - nose.y);
    const noseToTop = Math.abs(nose.y - (landmarks[10]?.y || nose.y));
    let pitch = ((noseToTop / (faceHeight + 1e-6)) - 0.5) * 90;
    
    let deviation = { roll: 0, yaw: 0, pitch: 0 };
    
    if (useCalibration && isCalibrated) {
        deviation.roll = Math.abs(roll - calibratedRoll);
        deviation.yaw = Math.abs(yaw - calibratedYaw);
        deviation.pitch = Math.abs(pitch - calibratedPitch);
        
        const isTilted = deviation.roll > 15 || deviation.yaw > 18 || deviation.pitch > 18;
        
        return { 
            yaw: Math.round(yaw), pitch: Math.round(pitch), roll: Math.round(roll),
            deviation: { yaw: Math.round(deviation.yaw), pitch: Math.round(deviation.pitch), roll: Math.round(deviation.roll) },
            isTilted 
        };
    } else {
        const isTilted = Math.abs(roll) > 20 || Math.abs(yaw) > 25 || Math.abs(pitch) > 25;
        return { 
            yaw: Math.round(yaw), pitch: Math.round(pitch), roll: Math.round(roll),
            deviation: { yaw: Math.abs(yaw), pitch: Math.abs(pitch), roll: Math.abs(roll) },
            isTilted 
        };
    }
}

/* ══════════════════════════════════════════════════════════════════════════════
   DSP UTILITIES
══════════════════════════════════════════════════════════════════════════════ */

function hanningWindow(N) {
    return Float64Array.from({ length: N }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
}

function detrend(signal) {
    const N = signal.length;
    if (N < 2) return signal.slice();
    const xMean = (N - 1) / 2;
    const yMean = signal.reduce((a, b) => a + b, 0) / N;
    let num = 0, den = 0;
    signal.forEach((y, x) => {
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
    });
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;
    return signal.map((y, x) => y - (slope * x + intercept));
}

function movingAvg(s, n) {
    const out = new Float64Array(s.length);
    let sum = 0;
    for (let i = 0; i < s.length; i++) {
        sum += s[i];
        if (i >= n) sum -= s[i - n];
        out[i] = sum / Math.min(i + 1, n);
    }
    return out;
}

function butterworthBandpass(signal, fps, lowHz, highHz, order = 2) {
    const loTap = Math.max(1, Math.round(fps / highHz));
    const hiTap = Math.max(loTap + 2, Math.round(fps / lowHz));
    const lo = movingAvg(signal, loTap);
    const hi = movingAvg(signal, hiTap);
    let filtered = signal.map((_, i) => lo[i] - hi[i]);
    for (let o = 1; o < order; o++) {
        filtered = movingAvg(filtered, loTap);
    }
    return filtered;
}

function computePowerSpectrum(signal, fps) {
    const N = signal.length;
    const win = hanningWindow(N);
    const s = signal.map((v, i) => v * win[i]);
    const maxK = Math.floor(N / 2);
    const power = new Float64Array(maxK);
    for (let k = 0; k < maxK; k++) {
        let re = 0, im = 0;
        const step = (2 * Math.PI * k) / N;
        for (let n = 0; n < N; n++) {
            re += s[n] * Math.cos(step * n);
            im -= s[n] * Math.sin(step * n);
        }
        power[k] = re * re + im * im;
    }
    const freqs = Float64Array.from({ length: maxK }, (_, k) => (k * fps) / N);
    return { freqs, power };
}

function peakFrequency(freqs, power, minHz, maxHz) {
    let bestIdx = -1, bestPow = -Infinity;
    for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= minHz && freqs[i] <= maxHz && power[i] > bestPow) {
            bestPow = power[i];
            bestIdx = i;
        }
    }
    if (bestIdx < 0) return null;
    if (bestIdx > 0 && bestIdx < freqs.length - 1) {
        const alpha = power[bestIdx - 1], beta = power[bestIdx], gamma = power[bestIdx + 1];
        const denom = alpha - 2 * beta + gamma;
        if (denom !== 0) {
            const p = 0.5 * (alpha - gamma) / denom;
            return freqs[bestIdx] + p * (freqs[1] - freqs[0]);
        }
    }
    return freqs[bestIdx];
}

/* ══════════════════════════════════════════════════════════════════════════════
   SIGNAL QUALITY INDEX (SQI)
══════════════════════════════════════════════════════════════════════════════ */

function computeSNR(signal, fps) {
    if (signal.length < 30) return 10;
    
    const { freqs, power } = computePowerSpectrum(signal, fps);
    const hrIdx = peakFrequency(freqs, power, 0.7, 3.0);
    if (!hrIdx) return 8;
    
    const hrPowerIdx = Array.from(freqs).findIndex(f => Math.abs(f - hrIdx) < (freqs[1] - freqs[0]) * 1.5);
    const signalPower = hrPowerIdx >= 0 ? power[hrPowerIdx] : 0;
    
    let noisePower = 0;
    let noiseCount = 0;
    for (let i = 0; i < freqs.length; i++) {
        if (Math.abs(freqs[i] - hrIdx) > 0.8 && freqs[i] < 5.0) {
            noisePower += power[i];
            noiseCount++;
        }
    }
    noisePower = noiseCount > 0 ? noisePower / noiseCount : 1;
    
    const snrLinear = signalPower / (noisePower + 1e-9);
    const snrDb = 10 * Math.log10(snrLinear + 0.1);
    
    return Math.min(25, Math.max(5, snrDb));
}

function computePeriodicity(signal, fps) {
    if (!signal || signal.length < 30) return 0.5;
    
    if (signal.length < 60) {
        let zeroCrossings = 0;
        for (let i = 1; i < signal.length; i++) {
            if (signal[i] * signal[i-1] < 0) zeroCrossings++;
        }
        const expectedCrossings = signal.length / (fps / 2.5);
        return Math.min(0.8, Math.max(0.3, zeroCrossings / expectedCrossings));
    }
    
    const autoCorr = [];
    const maxLag = Math.min(signal.length / 2, fps * 3);
    
    for (let lag = 0; lag < maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < signal.length - lag; i++) {
            sum += signal[i] * signal[i + lag];
        }
        autoCorr.push(sum / (signal.length - lag));
    }
    
    const maxCorr = Math.max(...autoCorr);
    if (maxCorr === 0) return 0.5;
    const normCorr = autoCorr.map(v => v / maxCorr);
    
    let bestPeak = 0;
    const minLag = Math.round(fps * 0.3);
    
    for (let lag = minLag; lag < normCorr.length; lag++) {
        const isPeak = (lag === 0 || normCorr[lag] > normCorr[lag - 1]) &&
                       (lag === normCorr.length - 1 || normCorr[lag] > normCorr[lag + 1]);
        
        if (isPeak && normCorr[lag] > bestPeak) {
            bestPeak = normCorr[lag];
        }
    }
    
    return Math.min(0.9, Math.max(0.3, bestPeak));
}

function computePeakSharpness(signal, fps) {
    if (signal.length < 30) return 0.5;
    
    const { freqs, power } = computePowerSpectrum(signal, fps);
    const hrIdx = peakFrequency(freqs, power, 0.7, 3.0);
    if (!hrIdx) return 0.5;
    
    const hrPowerIdx = Array.from(freqs).findIndex(f => Math.abs(f - hrIdx) < (freqs[1] - freqs[0]) * 1.5);
    if (hrPowerIdx < 1 || hrPowerIdx >= power.length - 1) return 0.5;
    
    const peakPower = power[hrPowerIdx];
    const halfPower = peakPower / 2;
    
    let leftIdx = hrPowerIdx;
    let rightIdx = hrPowerIdx;
    
    while (leftIdx > 0 && power[leftIdx] > halfPower) leftIdx--;
    while (rightIdx < power.length - 1 && power[rightIdx] > halfPower) rightIdx++;
    
    const bandwidth = (rightIdx - leftIdx) * (freqs[1] - freqs[0]);
    return Math.max(0.3, Math.min(0.9, 1 - bandwidth / 1.5));
}

function computeHRConsistency(hrWindow, hrFull) {
    if (!hrWindow || !hrFull) return 0.6;
    const diff = Math.abs(hrWindow - hrFull);
    if (diff < 5) return 0.9;
    if (diff < 10) return 0.7;
    if (diff < 20) return 0.5;
    return 0.4;
}

function computeSignalQualityIndex(signal, fps, hrWindow, hrFull) {
    const snr = computeSNR(signal, fps);
    const sharpness = computePeakSharpness(signal, fps);
    const consistency = computeHRConsistency(hrWindow, hrFull);
    const periodicity = computePeriodicity(signal, fps);
    
    const snrScore = Math.min(1, snr / 25);
    
    return (snrScore * 0.35) + (sharpness * 0.25) + (consistency * 0.2) + (periodicity * 0.2);
}

/* ══════════════════════════════════════════════════════════════════════════════
   rPPG ALGORITHMS
══════════════════════════════════════════════════════════════════════════════ */

function chromRPPG(rA, gA, bA) {
    const N = rA.length;
    const Xs = [], Ys = [];
    for (let i = 0; i < N; i++) {
        const sum = rA[i] + gA[i] + bA[i] || 1;
        const rn = rA[i] / sum, gn = gA[i] / sum, bn = bA[i] / sum;
        Xs.push(3 * rn - 2 * gn);
        Ys.push(1.5 * rn + gn - 1.5 * bn);
    }
    const stdX = Math.sqrt(Xs.reduce((a, v) => a + v ** 2, 0) / N) || 1;
    const stdY = Math.sqrt(Ys.reduce((a, v) => a + v ** 2, 0) / N) || 1;
    const alpha = stdX / stdY;
    return Xs.map((x, i) => x - alpha * Ys[i]);
}

function posRPPG(rA, gA, bA) {
    const N = rA.length;
    const S1 = [], S2 = [];
    for (let i = 0; i < N; i++) {
        const sum = rA[i] + gA[i] + bA[i] || 1;
        const rn = rA[i] / sum, gn = gA[i] / sum, bn = bA[i] / sum;
        S1.push(rn - gn);
        S2.push(rn + gn - 2 * bn);
    }
    const stdS1 = Math.sqrt(S1.reduce((a, v) => a + v ** 2, 0) / N) || 1;
    const stdS2 = Math.sqrt(S2.reduce((a, v) => a + v ** 2, 0) / N) || 1;
    const tau = stdS1 / stdS2;
    return S1.map((s, i) => s + tau * S2[i]);
}

function ensembleRPPG(rA, gA, bA, fps) {
    const chrom = detrend(chromRPPG(rA, gA, bA));
    const pos = detrend(posRPPG(rA, gA, bA));
    const cBand = butterworthBandpass(chrom, fps, 0.7, 3.0, 1);
    const pBand = butterworthBandpass(pos, fps, 0.7, 3.0, 1);
    return cBand.map((c, i) => (c + pBand[i]) / 2);
}

/* ══════════════════════════════════════════════════════════════════════════════
   ADAPTIVE PEAK DETECTION & HRV COMPUTATION (FIXED RMSSD)
══════════════════════════════════════════════════════════════════════════════ */

function cubicSplineInterp(xs, ys, queryXs) {
    const n = xs.length;
    if (n < 2) return queryXs.map(() => ys[0] || 0);
    const h = Array.from({ length: n - 1 }, (_, i) => xs[i + 1] - xs[i]);
    const alpha = Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
        alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
    }
    const l = Array(n).fill(1), mu = Array(n).fill(0), z = Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
        l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
        mu[i] = h[i] / l[i];
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    const c = Array(n).fill(0), b = Array(n).fill(0), d = Array(n).fill(0);
    for (let j = n - 2; j >= 0; j--) {
        c[j] = z[j] - mu[j] * c[j + 1];
        b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
        d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    return queryXs.map(x => {
        let lo = 0, hi = n - 2;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (xs[mid] <= x) lo = mid;
            else hi = mid - 1;
        }
        const t = x - xs[lo];
        return ys[lo] + b[lo] * t + c[lo] * t * t + d[lo] * t * t * t;
    });
}

function detectPeaksAdaptive(signal, minDist = 5) {
    const N = signal.length;
    if (N < 10) return [];
    
    const med = signal.slice().sort((a, b) => a - b)[Math.floor(N / 2)];
    const mad = signal.map(v => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(N / 2)] * 1.4826;
    let threshold = med + mad * 0.35;
    
    const peaks = [];
    for (let i = minDist; i < N - minDist; i++) {
        if (signal[i] < threshold) continue;
        let isPeak = true;
        for (let j = i - minDist; j <= i + minDist; j++) {
            if (j !== i && signal[j] >= signal[i]) {
                isPeak = false;
                break;
            }
        }
        if (!isPeak) continue;
        
        let peakPos = i;
        if (i > 0 && i < N - 1) {
            const a = signal[i - 1], b = signal[i], c = signal[i + 1];
            const denom = a - 2 * b + c;
            if (denom !== 0) peakPos = i + 0.5 * (a - c) / denom;
        }
        peaks.push(peakPos);
    }
    
    return peaks;
}

function filterRRIntervals(rrMs) {
    if (rrMs.length < 3) return rrMs;
    
    const sorted = [...rrMs].sort((a, b) => a - b);
    const medianRR = sorted[Math.floor(sorted.length / 2)];
    
    const filtered = rrMs.filter(rr => {
        const deviation = Math.abs(rr - medianRR) / medianRR;
        return deviation <= 0.3;
    });
    
    return filtered.filter(rr => rr >= 350 && rr <= 1500);
}

function computeHRandRMSSD(rppgSignal, fps) {
    const N = rppgSignal.length;
    
    // Validasi awal - return null jika data tidak cukup
    if (N < 45) {
        return { heartRate: null, rmssd: null };
    }
    
    const ts = Array.from({ length: N }, (_, i) => i / fps);
    const nInterp = Math.floor(ts[ts.length - 1] * INTERP_HZ);
    if (nInterp < 50) {
        return { heartRate: null, rmssd: null };
    }
    
    const tsI = Array.from({ length: nInterp }, (_, i) => i / INTERP_HZ);
    const sigI = cubicSplineInterp(ts, rppgSignal, tsI);
    
    const minDist = Math.round(INTERP_HZ * 0.35);
    const peaks = detectPeaksAdaptive(sigI, minDist);
    
    // Perlu minimal 6 peaks untuk HRV yang valid
    if (peaks.length < 6) {
        return { heartRate: null, rmssd: null };
    }
    
    const rrRaw = [];
    for (let i = 1; i < peaks.length; i++) {
        rrRaw.push(((peaks[i] - peaks[i - 1]) / INTERP_HZ) * 1000);
    }
    
    const validRR = filterRRIntervals(rrRaw);
    
    // Perlu minimal 4 RR intervals untuk RMSSD yang valid
    if (validRR.length < 4) {
        return { heartRate: null, rmssd: null };
    }
    
    const meanRR = validRR.reduce((a, b) => a + b, 0) / validRR.length;
    let heartRate = Math.round(60000 / meanRR);
    heartRate = Math.min(160, Math.max(45, heartRate));
    
    // Smoothing HR
    hrHistory.push(heartRate);
    if (hrHistory.length > 5) hrHistory.shift();
    if (hrHistory.length >= 3) {
        const validHR = hrHistory.filter(h => h !== null && h > 0);
        if (validHR.length >= 3) {
            heartRate = Math.round(validHR.reduce((a, b) => a + b, 0) / validHR.length);
        }
    }
    
    // Hitung RMSSD
    let sumSquaredDiff = 0;
    let validDiffCount = 0;
    for (let i = 1; i < validRR.length; i++) {
        const diff = validRR[i] - validRR[i - 1];
        // Filter outlier diff yang terlalu besar
        if (Math.abs(diff) < 200) {
            sumSquaredDiff += diff * diff;
            validDiffCount++;
        }
    }
    
    if (validDiffCount < 3) {
        return { heartRate, rmssd: null };
    }
    
    let rmssd = Math.sqrt(sumSquaredDiff / validDiffCount);
    rmssd = Math.round(rmssd * 10) / 10;
    
    // Batasi ke range fisiologis (5-150 ms) - TIDAK dipaksa ke 120!
    if (rmssd > 150) rmssd = 150;
    if (rmssd < 5) rmssd = null;
    
    // Smoothing RMSSD
    if (rmssd !== null) {
        rrHistory.push(rmssd);
        if (rrHistory.length > 5) rrHistory.shift();
        if (rrHistory.length >= 3) {
            const validRMSSD = rrHistory.filter(r => r !== null && r > 0);
            if (validRMSSD.length >= 3) {
                rmssd = Math.round(validRMSSD.reduce((a, b) => a + b, 0) / validRMSSD.length * 10) / 10;
            }
        }
    }
    
    return { heartRate, rmssd };
}

/* ══════════════════════════════════════════════════════════════════════════════
   RESPIRATORY RATE
══════════════════════════════════════════════════════════════════════════════ */

function computeRespiratoryRate(rppgSignal, fps) {
    if (rppgSignal.length < 60) return null;
    
    const bandpassed = butterworthBandpass(detrend(rppgSignal), fps, 0.12, 0.45, 1);
    const absSignal = bandpassed.map(v => Math.abs(v));
    const envelope = movingAvg(absSignal, Math.max(3, Math.round(fps * 0.5)));
    
    const minDist = Math.max(10, Math.round(fps * 1.2));
    const peaks = detectPeaksAdaptive(envelope, minDist);
    
    if (peaks.length >= 3) {
        const breathIntervals = [];
        for (let i = 1; i < peaks.length; i++) {
            breathIntervals.push((peaks[i] - peaks[i - 1]) / fps);
        }
        const meanInterval = breathIntervals.reduce((a, b) => a + b, 0) / breathIntervals.length;
        const rrFromPeaks = Math.round(60 / meanInterval);
        if (rrFromPeaks >= 8 && rrFromPeaks <= 30) return rrFromPeaks;
    }
    
    const { freqs, power } = computePowerSpectrum(envelope, fps);
    const respHz = peakFrequency(freqs, power, 0.12, 0.45);
    
    if (respHz) {
        const rr = Math.round(respHz * 60);
        if (rr >= 8 && rr <= 30) return rr;
    }
    
    return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   FACE DETECTION & TRACKING
══════════════════════════════════════════════════════════════════════════════ */

function getFaceWidth(landmarks, cW) {
    if (!landmarks) return 200;
    const left = landmarks[FACE_WIDTH_INDICES[0]];
    const right = landmarks[FACE_WIDTH_INDICES[1]];
    if (!left || !right) return 200;
    return Math.abs((right.x - left.x) * cW);
}

function checkHeadMovement(landmarks, prevLandmarks, faceWidth) {
    if (!landmarks || !prevLandmarks || faceWidth < 50) return { moving: false, movement: 0, normalizedMovement: 0 };
    
    const nose = landmarks[NOSE_TIP];
    const prevNose = prevLandmarks[NOSE_TIP];
    
    if (!nose || !prevNose) return { moving: false, movement: 0, normalizedMovement: 0 };
    
    const movement = Math.hypot(nose.x - prevNose.x, nose.y - prevNose.y);
    const normalizedMovement = movement / faceWidth;
    
    return {
        moving: normalizedMovement > MAX_NORMALIZED_MOVEMENT,
        movement: Math.round(movement * 100) / 100,
        normalizedMovement: Math.round(normalizedMovement * 100) / 100
    };
}

function checkLightingOnROI(imageData, landmarks, cW, cH) {
    if (!landmarks) return { good: false, level: 'no_face', message: 'Wajah tidak terdeteksi', percentage: 50 };
    
    const foreheadIndices = FACE_ROIS.forehead.landmarks;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const idx of foreheadIndices) {
        const lm = landmarks[idx];
        if (!lm) continue;
        const px = lm.x * cW, py = lm.y * cH;
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
    }
    
    const pad = 10;
    const rect = {
        x: Math.max(0, Math.floor(minX) - pad),
        y: Math.max(0, Math.floor(minY) - pad),
        w: Math.min(cW, Math.ceil(maxX - minX) + pad * 2),
        h: Math.min(cH, Math.ceil(maxY - minY) + pad * 2)
    };
    
    if (rect.w <= 0 || rect.h <= 0) return { good: true, level: 'good', message: 'Pencahayaan baik', percentage: 60 };
    
    let totalIntensity = 0;
    let pixelCount = 0;
    
    for (let row = rect.y; row < rect.y + rect.h; row += 3) {
        for (let col = rect.x; col < rect.x + rect.w; col += 3) {
            const idx = (row * cW + col) * 4;
            const intensity = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
            totalIntensity += intensity;
            pixelCount++;
        }
    }
    
    if (pixelCount === 0) return { good: true, level: 'good', message: 'Pencahayaan baik', percentage: 60 };
    
    const avgIntensity = totalIntensity / pixelCount;
    const percentage = Math.min(100, Math.max(20, Math.round((avgIntensity / 255) * 100)));
    
    let good = true;
    if (avgIntensity < 35) good = false;
    else if (avgIntensity > 230) good = false;
    
    return { good, percentage };
}

function computeROIQualityWithSkin(imageData, rect, cW, cH) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return 0.3;
    
    let skinPixelCount = 0;
    let totalCount = 0;
    
    for (let row = rect.y; row < rect.y + rect.h; row += 3) {
        for (let col = rect.x; col < rect.x + rect.w; col += 3) {
            const idx = (row * cW + col) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            
            if (isSkinPixel(r, g, b)) {
                skinPixelCount++;
            }
            totalCount++;
        }
    }
    
    if (totalCount === 0) return 0.3;
    const skinRatio = skinPixelCount / totalCount;
    
    return Math.max(0.2, Math.min(0.9, skinRatio));
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROI EXTRACTION
══════════════════════════════════════════════════════════════════════════════ */

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
    return {
        x: Math.max(0, Math.floor(minX) - pad),
        y: Math.max(0, Math.floor(minY) - pad),
        w: Math.min(cW, Math.ceil(maxX - minX) + pad * 2),
        h: Math.min(cH, Math.ceil(maxY - minY) + pad * 2),
    };
}

function avgRGBInRectWithSkinFilter(imageData, rect, cW) {
    const { x, y, w, h } = rect;
    if (w <= 0 || h <= 0) return { r: 128, g: 128, b: 128, skinRatio: 0 };
    let sR = 0, sG = 0, sB = 0, skinCnt = 0;
    
    for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
            const i = (row * cW + col) * 4;
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            
            if (isSkinPixel(r, g, b)) {
                sR += r;
                sG += g;
                sB += b;
                skinCnt++;
            }
        }
    }
    
    if (skinCnt === 0) return { r: 128, g: 128, b: 128, skinRatio: 0 };
    return { 
        r: sR / skinCnt, 
        g: sG / skinCnt, 
        b: sB / skinCnt,
        skinRatio: skinCnt / (w * h)
    };
}

function drawAllFaceLandmarks(ctx, landmarks, cW, cH) {
    if (!landmarks) return;
    
    ctx.save();
    ctx.globalAlpha = 0.2;
    
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm) continue;
        const x = lm.x * cW;
        const y = lm.y * cH;
        
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
        ctx.fillStyle = '#a78bfa';
        ctx.fill();
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawROIBox(ctx, rect, color, label, quality = 1, isSkipped = false) {
    ctx.save();
    
    if (isSkipped) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px Poppins, sans-serif';
        ctx.fillText(`❌ ${label}`, rect.x + 3, rect.y - 3);
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = color;
        ctx.font = 'bold 8px Poppins, sans-serif';
        ctx.fillText(`${label} ${Math.round(quality * 100)}%`, rect.x + 3, rect.y - 3);
    }
    
    ctx.restore();
}

function extractMultiROI(imageData, landmarks, overlayCtx, cW, cH) {
    let tR = 0, tG = 0, tB = 0, tW = 0;
    const roiQualities = {};
    const roiSkipped = {};
    
    drawAllFaceLandmarks(overlayCtx, landmarks, cW, cH);
    
    for (const [key, roi] of Object.entries(FACE_ROIS)) {
        const rect = landmarksBoundingRect(landmarks, roi.landmarks, cW, cH);
        const quality = computeROIQualityWithSkin(imageData, rect, cW, cH);
        roiQualities[key] = quality;
        
        const isSkipped = quality < ROI_MIN_QUALITY;
        
        if (isSkipped) {
            roiSkipped[key] = true;
            drawROIBox(overlayCtx, rect, roi.color, roi.label, quality, true);
            continue;
        }
        
        const { r, g, b } = avgRGBInRectWithSkinFilter(imageData, rect, cW);
        const dynamicWeight = roi.weight * (0.6 + quality * 0.4);
        
        drawROIBox(overlayCtx, rect, roi.color, roi.label, quality, false);
        
        tR += r * dynamicWeight;
        tG += g * dynamicWeight;
        tB += b * dynamicWeight;
        tW += dynamicWeight;
    }
    
    if (tW === 0) {
        return { r: 128, g: 128, b: 128, roiQualities, roiSkipped, allSkipped: true };
    }
    
    return {
        r: tR / tW,
        g: tG / tW,
        b: tB / tW,
        roiQualities,
        roiSkipped,
        allSkipped: false
    };
}

function detectOcclusion(landmarks, imageData, cW, cH) {
    if (!landmarks) return { hasOcclusion: false, occlusionAreas: [] };
    
    const occlusionAreas = [];
    
    const forehead = landmarks[10];
    if (forehead) {
        const fx = forehead.x * cW;
        const fy = forehead.y * cH;
        const radius = 12;
        let nonSkinCount = 0;
        let totalCount = 0;
        
        for (let dy = -radius; dy <= radius; dy += 3) {
            for (let dx = -radius; dx <= radius; dx += 3) {
                const x = Math.min(cW - 1, Math.max(0, fx + dx));
                const y = Math.min(cH - 1, Math.max(0, fy + dy));
                const idx = (Math.floor(y) * cW + Math.floor(x)) * 4;
                const r = imageData.data[idx];
                const g = imageData.data[idx + 1];
                const b = imageData.data[idx + 2];
                if (!isSkinPixel(r, g, b)) nonSkinCount++;
                totalCount++;
            }
        }
        
        if (nonSkinCount / totalCount > 0.7) {
            occlusionAreas.push({ area: 'forehead', warning: 'Rambut menutupi dahi' });
        }
    }
    
    const hasOcclusion = occlusionAreas.length > 0;
    return { hasOcclusion, occlusionAreas };
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */

const VitalScanPage = () => {
    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const landmarkerRef = useRef(null);
    
    const samplesRef = useRef({ r: [], g: [], b: [], ts: [] });
    const movementHistoryRef = useRef([]);
    const prevLandmarksRef = useRef(null);
    const recordingStartTimeRef = useRef(null);
    const frameTimestampsRef = useRef([]);
    
    const [phase, setPhase] = useState('idle');
    const [countdown, setCountdown] = useState(3);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [faceDetected, setFaceDetected] = useState(false);
    const [modelLoading, setModelLoading] = useState(false);
    
    const [lighting, setLighting] = useState({ good: true, percentage: 60 });
    const [headMovement, setHeadMovement] = useState({ moving: false, movement: 0, normalizedMovement: 0 });
    const [faceStability, setFaceStability] = useState({ stable: false, progress: 0 });
    const [faceTilt, setFaceTilt] = useState({ yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } });
    const [occlusion, setOcclusion] = useState({ hasOcclusion: false, occlusionAreas: [] });
    const [sqi, setSqi] = useState({ snr: 12, overall: 60 });
    const [confidenceScore, setConfidenceScore] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [liveHR, setLiveHR] = useState(null);
    const [currentFPS, setCurrentFPS] = useState(0);
    const [roiQualities, setRoiQualities] = useState({});
    const [roiSkipped, setRoiSkipped] = useState({});
    const [calibrationDone, setCalibrationDone] = useState(false);
    const [signalQuality, setSignalQuality] = useState(60);
    
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
                if (!cancelled) {
                    landmarkerRef.current = fl;
                    setModelLoading(false);
                }
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
    }, []);
    
    useEffect(() => () => stopCamera(), [stopCamera]);
    
    const processSignals = useCallback(() => {
        const { r, g, b } = samplesRef.current;
        
        if (g.length < MIN_SAMPLES) {
            setErrorMsg(`Data tidak cukup (${g.length} sampel). Pastikan wajah terlihat jelas.`);
            setPhase('error');
            return;
        }
        
        const timestamps = frameTimestampsRef.current;
        let actualFps = TARGET_FPS;
        if (timestamps.length > 10) {
            const avgDelta = (timestamps[timestamps.length - 1] - timestamps[0]) / timestamps.length;
            actualFps = Math.min(TARGET_FPS, Math.max(15, 1000 / avgDelta));
        }
        
        const rppgSignal = ensembleRPPG(r, g, b, actualFps);
        
        // Hitung Heart Rate & RMSSD (FIXED - tidak pernah return 120 default)
        const { heartRate, rmssd } = computeHRandRMSSD(rppgSignal, actualFps);
        
        // Hitung Respiratory Rate
        const respRate = computeRespiratoryRate(rppgSignal, actualFps);
        
        // Hitung Signal Quality
        const snr = computeSNR(rppgSignal, actualFps);
        const signalSqi = Math.min(100, Math.max(0, Math.round((snr / 25) * 100)));
        setSignalQuality(signalSqi);
        
        setResult({
            heartRate: heartRate || '--',
            rmssd: rmssd !== null ? rmssd : '--',
            respRate: respRate || '--',
            signalQuality: signalSqi,
            snr: Math.round(snr)
        });
        
        setPhase('done');
        stopCamera();
    }, [stopCamera]);
    
    const startSampling = useCallback(() => {
        const video = videoRef.current;
        const overlay = overlayRef.current;
        if (!video || !overlay) return;
        
        resetTiltCalibration();
        setCalibrationDone(false);
        hrHistory = [];
        rrHistory = [];
        
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        const overlayCtx = overlay.getContext('2d');
        
        samplesRef.current = { r: [], g: [], b: [], ts: [] };
        movementHistoryRef.current = [];
        prevLandmarksRef.current = null;
        frameTimestampsRef.current = [];
        recordingStartTimeRef.current = performance.now();
        
        setSqi({ snr: 12, overall: 60 });
        setSignalQuality(60);
        setConfidenceScore(50);
        
        let lastTimestamp = performance.now();
        let recordingActive = true;
        let calibrationFrames = 0;
        let hasStartedRecording = false;
        setIsRecording(true);
        
        const loop = async (now) => {
            const delta = Math.min(0.1, (now - lastTimestamp) / 1000);
            lastTimestamp = now;
            
            frameTimestampsRef.current.push(now);
            if (frameTimestampsRef.current.length > 60) frameTimestampsRef.current.shift();
            if (frameTimestampsRef.current.length > 5) {
                const avgDelta = (frameTimestampsRef.current[frameTimestampsRef.current.length - 1] - frameTimestampsRef.current[0]) / frameTimestampsRef.current.length;
                setCurrentFPS(Math.round(1000 / avgDelta));
            }
            
            const cW = video.videoWidth || 640;
            const cH = video.videoHeight || 480;
            
            if (overlay.width !== cW) {
                overlay.width = cW;
                offCanvas.width = cW;
            }
            if (overlay.height !== cH) {
                overlay.height = cH;
                offCanvas.height = cH;
            }
            
            offCtx.drawImage(video, 0, 0, cW, cH);
            overlayCtx.clearRect(0, 0, cW, cH);
            
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
                overlayCtx.fillStyle = 'rgba(0,0,0,0.6)';
                overlayCtx.fillRect(0, 0, cW, cH);
                overlayCtx.fillStyle = '#fbbf24';
                overlayCtx.font = 'bold 14px Poppins, sans-serif';
                overlayCtx.textAlign = 'center';
                overlayCtx.fillText('Wajah tidak terdeteksi', cW / 2, cH / 2);
                rafRef.current = requestAnimationFrame(loop);
                return;
            }
            
            if (!isCalibrated && calibrationFrames < 8) {
                calibrateFaceTilt(landmarks);
                calibrationFrames++;
                if (isCalibrated) {
                    setCalibrationDone(true);
                }
            }
            
            const imageData = offCtx.getImageData(0, 0, cW, cH);
            const faceWidth = getFaceWidth(landmarks, cW);
            
            const lightingResult = checkLightingOnROI(imageData, landmarks, cW, cH);
            setLighting(lightingResult);
            
            const movement = checkHeadMovement(landmarks, prevLandmarksRef.current, faceWidth);
            setHeadMovement(movement);
            movementHistoryRef.current.push(movement.normalizedMovement);
            if (movementHistoryRef.current.length > TARGET_FPS * 3) movementHistoryRef.current.shift();
            prevLandmarksRef.current = landmarks;
            
            const tilt = detectFaceTilt(landmarks, true);
            setFaceTilt(tilt);
            
            const occlusionResult = detectOcclusion(landmarks, imageData, cW, cH);
            setOcclusion(occlusionResult);
            
            let stabilityProgress = 1;
            let isStable = true;
            if (movementHistoryRef.current.length >= REQUIRED_FACE_STABILITY_SEC * TARGET_FPS) {
                const recentMovements = movementHistoryRef.current.slice(-REQUIRED_FACE_STABILITY_SEC * TARGET_FPS);
                const avgMovement = recentMovements.reduce((a, b) => a + b, 0) / recentMovements.length;
                isStable = avgMovement < MAX_NORMALIZED_MOVEMENT * 0.8;
                stabilityProgress = Math.min(1, recentMovements.length / (REQUIRED_FACE_STABILITY_SEC * TARGET_FPS));
            }
            setFaceStability({ stable: isStable, progress: stabilityProgress });
            
            const { r, g, b, roiQualities: rq, roiSkipped: rs, allSkipped } = extractMultiROI(imageData, landmarks, overlayCtx, cW, cH);
            setRoiQualities(rq);
            setRoiSkipped(rs);
            
            const motionWeight = Math.max(0.3, Math.min(1, 1 - movement.normalizedMovement / MAX_NORMALIZED_MOVEMENT));
            
            let currentSnr = 12;
            if (samplesRef.current.g.length > 60) {
                const rWin = samplesRef.current.r.slice(-60);
                const gWin = samplesRef.current.g.slice(-60);
                const bWin = samplesRef.current.b.slice(-60);
                const rppgLive = ensembleRPPG(rWin, gWin, bWin, TARGET_FPS);
                currentSnr = computeSNR(rppgLive, TARGET_FPS);
                const periodicityLive = computePeriodicity(rppgLive, TARGET_FPS);
                const currentSignalQuality = (currentSnr / 25) * 0.6 + periodicityLive * 0.4;
                setSqi({ snr: Math.round(currentSnr), overall: Math.round(currentSignalQuality * 100) });
            }
            
            const lightingScore = lightingResult.good ? 1 : 0.5;
            const movementScore = movement.moving ? 0.4 : Math.max(0.5, 1 - movement.normalizedMovement / MAX_NORMALIZED_MOVEMENT);
            const stabilityScore = isStable ? 1 : stabilityProgress;
            const tiltScore = tilt.isTilted ? 0.6 : 1;
            const occlusionScore = occlusionResult.hasOcclusion ? 0.6 : 1;
            const roiScore = allSkipped ? 0.3 : 0.9;
            
            const existingScore = (lightingScore * 0.15) + (movementScore * 0.2) + (stabilityScore * 0.15) + 
                                  (tiltScore * 0.15) + (occlusionScore * 0.15) + (roiScore * 0.2);
            
            const currentSignalQuality = Math.min(0.9, Math.max(0.3, (currentSnr / 25)));
            const confidence = (existingScore * 0.6) + (currentSignalQuality * 0.4);
            const finalConfidence = Math.min(0.95, Math.max(0.3, confidence));
            setConfidenceScore(Math.round(finalConfidence * 100));
            
            const isReadyToRecord = finalConfidence > START_RECORDING_THRESHOLD && faceFound && !tilt.isTilted && !allSkipped;
            
            if (isReadyToRecord && recordingActive && !hasStartedRecording) {
                hasStartedRecording = true;
                recordingStartTimeRef.current = now;
            }
            
            if (hasStartedRecording && recordingActive && recordingStartTimeRef.current) {
                const elapsed = (now - recordingStartTimeRef.current) / 1000;
                setProgress(Math.min(100, (elapsed / SAMPLE_DURATION_SEC) * 100));
                
                samplesRef.current.r.push(r * motionWeight);
                samplesRef.current.g.push(g * motionWeight);
                samplesRef.current.b.push(b * motionWeight);
                samplesRef.current.ts.push(elapsed);
                
                const winSize = Math.round(TARGET_FPS * 6);
                if (samplesRef.current.g.length >= winSize) {
                    const rWin = samplesRef.current.r.slice(-winSize);
                    const gWin = samplesRef.current.g.slice(-winSize);
                    const bWin = samplesRef.current.b.slice(-winSize);
                    const rppgLive = ensembleRPPG(rWin, gWin, bWin, TARGET_FPS);
                    const { heartRate: liveHr } = computeHRandRMSSD(rppgLive, TARGET_FPS);
                    if (liveHr && liveHr > 45 && liveHr < 160) setLiveHR(liveHr);
                }
                
                if (elapsed >= SAMPLE_DURATION_SEC) {
                    recordingActive = false;
                    setIsRecording(false);
                    setPhase('processing');
                    processSignals();
                    return;
                }
            }
            
            overlayCtx.font = '8px Poppins, sans-serif';
            overlayCtx.fillStyle = lightingResult.good ? '#22c55e' : '#ef4444';
            overlayCtx.fillText(`💡 ${lightingResult.percentage}%`, 10, 20);
            overlayCtx.fillStyle = !movement.moving ? '#22c55e' : '#eab308';
            overlayCtx.fillText(`📐 ${(movement.normalizedMovement * 100).toFixed(0)}%`, 10, 32);
            overlayCtx.fillStyle = isStable ? '#22c55e' : '#eab308';
            overlayCtx.fillText(`🎯 ${Math.round(stabilityProgress * 100)}%`, 10, 44);
            
            const tiltDisplay = tilt.deviation ? Math.max(tilt.deviation.roll, tilt.deviation.yaw, tilt.deviation.pitch) : Math.abs(tilt.roll);
            overlayCtx.fillStyle = !tilt.isTilted ? '#22c55e' : '#ef4444';
            overlayCtx.fillText(`↺ Tilt:${tiltDisplay}°${isCalibrated ? '✓' : '..'}`, 10, 56);
            
            overlayCtx.fillStyle = !occlusionResult.hasOcclusion ? '#22c55e' : '#ef4444';
            overlayCtx.fillText(`🕶️ ${occlusionResult.hasOcclusion ? 'Tertutup' : 'Clear'}`, 10, 68);
            overlayCtx.fillStyle = currentSnr > 10 ? '#22c55e' : '#f97316';
            overlayCtx.fillText(`📊 SNR:${Math.round(currentSnr)}dB`, 10, 80);
            
            if (!hasStartedRecording && faceFound) {
                overlayCtx.fillStyle = 'rgba(0,0,0,0.4)';
                overlayCtx.fillRect(0, 0, cW, cH);
                overlayCtx.fillStyle = '#fbbf24';
                overlayCtx.font = 'bold 12px Poppins, sans-serif';
                overlayCtx.textAlign = 'center';
                
                let reason = '';
                if (!isCalibrated) reason = 'Kalibrasi wajah...';
                else if (allSkipped) reason = 'Tidak ada area wajah valid';
                else if (tilt.isTilted) reason = `Kepala miring ${tiltDisplay}°`;
                else if (movement.moving) reason = 'Kurangi gerakan kepala';
                else if (!lightingResult.good) reason = 'Perbaiki pencahayaan';
                else if (occlusionResult.hasOcclusion) reason = 'Hindari penutup wajah';
                else reason = 'Siap merekam...';
                
                overlayCtx.fillText(`📊 ${reason}`, cW / 2, cH / 2);
                overlayCtx.font = '10px Poppins, sans-serif';
                overlayCtx.fillStyle = '#94a3b8';
                overlayCtx.fillText(`Confidence: ${Math.round(finalConfidence * 100)}%`, cW / 2, cH / 2 + 30);
            }
            
            rafRef.current = requestAnimationFrame(loop);
        };
        
        rafRef.current = requestAnimationFrame(loop);
    }, [processSignals]);
    
    const startScan = async () => {
        setErrorMsg('');
        setResult(null);
        setPhase('countdown');
        setCountdown(3);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user', frameRate: { ideal: TARGET_FPS } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            
            let cnt = 3;
            const tick = setInterval(() => {
                cnt--;
                setCountdown(cnt);
                if (cnt <= 0) {
                    clearInterval(tick);
                    setPhase('scanning');
                    startSampling();
                }
            }, 1000);
        } catch {
            setErrorMsg('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.');
            setPhase('error');
        }
    };
    
    const reset = () => {
        stopCamera();
        resetTiltCalibration();
        setCalibrationDone(false);
        hrHistory = [];
        rrHistory = [];
        setPhase('idle');
        setProgress(0);
        setResult(null);
        setLiveHR(null);
        setFaceDetected(false);
        setLighting({ good: true, percentage: 60 });
        setHeadMovement({ moving: false, movement: 0, normalizedMovement: 0 });
        setFaceStability({ stable: false, progress: 0 });
        setFaceTilt({ yaw: 0, pitch: 0, roll: 0, isTilted: false, deviation: { yaw: 0, pitch: 0, roll: 0 } });
        setOcclusion({ hasOcclusion: false, occlusionAreas: [] });
        setSqi({ snr: 12, overall: 60 });
        setConfidenceScore(0);
        setCurrentFPS(0);
        setRoiQualities({});
        setRoiSkipped({});
        setSignalQuality(60);
    };
    
    const isVideoVisible = phase === 'countdown' || phase === 'scanning';
    
    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '40px 0 80px' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
                .vs-wrap { max-width: 1000px; margin: 0 auto; padding: 0 24px; font-family: 'Poppins', sans-serif; color: #1e293b; }
                .vs-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; }
                .vs-metric { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px 20px; text-align: center; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .vs-metric:hover { box-shadow: 0 8px 25px rgba(0,0,0,0.08); transform: translateY(-3px); }
                .vs-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
                .vs-progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 3px; transition: width 0.2s ease; }
                .vs-pulse { animation: vsPulse 1.4s ease-in-out infinite; }
                @keyframes vsPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
                .vs-start-btn { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; border: none; border-radius: 12px; padding: 13px 28px; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; transition: all 0.15s; box-shadow: 0 4px 14px rgba(34,197,94,0.35); }
                .vs-start-btn:hover { opacity: 0.92; transform: scale(1.02); }
                .vs-start-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .quality-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
                .vs-disclaimer { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #92400e; line-height: 1.5; }
                .quality-grid { display: flex; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
                .roi-legend { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; padding: 8px 12px; background: #f1f5f9; border-radius: 12px; }
                .roi-dot { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 500; }
                @keyframes vsEnter { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                .result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
                @media (max-width: 640px) { .result-grid { grid-template-columns: 1fr; gap: 12px; } }
                .info-card { background: #f8fafc; border-radius: 16px; padding: 16px 20px; border: 1px solid #e2e8f0; }
            `}</style>
            
            <div className="vs-wrap">
                <div style={{ marginBottom: 28 }}>
                    <Link to="/health-check" style={{ display:'inline-flex', alignItems:'center', gap:7, color:'#64748b', textDecoration:'none', fontSize:13, marginBottom:18, fontWeight:500 }}>
                        <FaArrowLeft size={12} /> Kembali
                    </Link>
                    <h1 style={{ fontFamily:'Poppins', fontSize:32, margin:'0 0 6px', background:'linear-gradient(135deg,#22c55e,#16a34a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                        Vital Scan Pro
                    </h1>
                    <p style={{ color:'#64748b', margin:0, fontSize:14 }}>
                        Face Detection · Skin Detection · HR, RMSSD, Respiratory Rate
                    </p>
                </div>
                
                <div className="vs-disclaimer" style={{ marginBottom: 20 }}>
                    <FaInfoCircle style={{ marginRight: 7 }} />
                    <strong>Edukasi Kesehatan:</strong> Hasil scan bersifat estimasi. Heart Rate (±5 bpm), RMSSD (±10 ms). 
                    Bukan pengganti alat medis.
                </div>
                
                {isVideoVisible && (
                    <div className="vs-card" style={{ marginBottom: 20, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', background: '#0f172a' }}>
                            <video ref={videoRef} muted playsInline
                                style={{ width: '100%', display: 'block', maxHeight: 450, objectFit: 'cover' }} />
                            <canvas ref={overlayRef}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
                            
                            {phase === 'countdown' && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 80, fontWeight: 700, color: '#fff' }}>{countdown}</span>
                                </div>
                            )}
                            
                            {phase === 'scanning' && liveHR && (
                                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,.7)', borderRadius: 20, padding: '4px 12px' }}>
                                    <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 600 }}>♥ {liveHR} bpm</span>
                                </div>
                            )}
                            
                            {phase === 'scanning' && faceTilt.isTilted && (
                                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239,68,68,0.9)', borderRadius: 8, padding: '4px 10px' }}>
                                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>
                                        ⚠️ Miring {Math.max(faceTilt.deviation?.roll || 0, faceTilt.deviation?.yaw || 0, faceTilt.deviation?.pitch || 0)}°
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        {phase === 'scanning' && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <div className="roi-legend">
                                    <span className="roi-dot"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }}></span> Dahi {Math.round((roiQualities.forehead || 0) * 100)}%</span>
                                    <span className="roi-dot"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }}></span> Pipi Kiri {Math.round((roiQualities.leftCheek || 0) * 100)}%</span>
                                    <span className="roi-dot"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }}></span> Pipi Kanan {Math.round((roiQualities.rightCheek || 0) * 100)}%</span>
                                    <span className="roi-dot"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ec4899', display: 'inline-block' }}></span> Hidung {Math.round((roiQualities.nose || 0) * 100)}%</span>
                                    {Object.keys(roiSkipped || {}).length > 0 && (
                                        <span className="roi-dot"><FaBan size={10} color="#dc2626" /> {Object.keys(roiSkipped).length} skipped</span>
                                    )}
                                </div>
                                
                                <div className="quality-grid">
                                    <div className="quality-badge" style={{ background: lighting.good ? '#dcfce7' : '#fee2e2', color: lighting.good ? '#166534' : '#991b1b' }}>
                                        <FaLightbulb size={12} /> {lighting.percentage}%
                                    </div>
                                    <div className="quality-badge" style={{ background: !headMovement.moving ? '#dcfce7' : '#fef9c3', color: !headMovement.moving ? '#166534' : '#854d0e' }}>
                                        <FaUserCheck size={12} /> {(headMovement.normalizedMovement * 100).toFixed(0)}%
                                    </div>
                                    <div className="quality-badge" style={{ background: !faceTilt.isTilted ? '#dcfce7' : '#fee2e2', color: !faceTilt.isTilted ? '#166534' : '#991b1b' }}>
                                        <FaAngleDoubleUp size={12} /> {faceTilt.deviation ? Math.max(faceTilt.deviation.roll, faceTilt.deviation.yaw, faceTilt.deviation.pitch) : Math.abs(faceTilt.roll)}°
                                    </div>
                                    <div className="quality-badge" style={{ background: sqi.overall > 50 ? '#dcfce7' : '#fef9c3', color: sqi.overall > 50 ? '#166534' : '#854d0e' }}>
                                        <FaChartLine size={12} /> SQI {sqi.overall}%
                                    </div>
                                </div>
                                
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: '#64748b' }}>
                                        <span>{progress > 0 ? '✅ Merekam...' : '⏳ Menunggu...'}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="vs-progress-bar">
                                        <div className="vs-progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {phase === 'processing' && (
                    <div className="vs-card" style={{ textAlign: 'center', padding: 48, marginBottom: 20 }}>
                        <FaSpinner size={40} style={{ animation: 'vsPulse 1s infinite', marginBottom: 16, color: '#22c55e' }} />
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Menganalisis sinyal...</div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>rPPG · HRV · Respiratory Rate</div>
                    </div>
                )}
                
                {phase === 'error' && (
                    <div className="vs-card" style={{ textAlign: 'center', padding: 40, marginBottom: 20, border: '1px solid #fca5a5' }}>
                        <FaExclamationTriangle size={34} style={{ marginBottom: 12, color: '#dc2626' }} />
                        <div style={{ fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>Terjadi Kesalahan</div>
                        <div style={{ color: '#64748b', marginBottom: 18, fontSize: 14 }}>{errorMsg}</div>
                        <button className="vs-start-btn" onClick={reset} style={{ background: '#dc2626', boxShadow: 'none' }}>
                            <FaRedo size={13} /> Coba Lagi
                        </button>
                    </div>
                )}
                
                {phase === 'idle' && (
                    <div className="vs-card" style={{ padding: '28px', marginBottom: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 16 }}>Persiapan Scan</h3>
                        <ul style={{ margin: '0 0 20px 20px', color: '#475569', fontSize: 13.5, lineHeight: 1.8 }}>
                            <li>Pastikan ruangan <strong>terang merata</strong></li>
                            <li>Posisikan wajah <strong>tegak lurus</strong> di tengah kamera</li>
                            <li>Jarak <strong>30-50 cm</strong> dari kamera</li>
                            <li><strong>Jangan bergerak</strong> selama 30 detik</li>
                        </ul>
                        
                        <div className="info-card" style={{ marginBottom: 20 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#166534' }}>📊 Yang Akan Diukur</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 16px', fontSize: 12.5 }}>
                                <div><span style={{ color: '#64748b' }}>Heart Rate:</span> <strong>60-100 bpm</strong></div>
                                <div><span style={{ color: '#64748b' }}>RMSSD (HRV):</span> <strong>15-80 ms</strong></div>
                                <div><span style={{ color: '#64748b' }}>Respiratory Rate:</span> <strong>12-20 rpm</strong></div>
                            </div>
                        </div>
                        
                        <div style={{ textAlign: 'center' }}>
                            <button className="vs-start-btn" onClick={startScan} disabled={modelLoading}>
                                <FaCamera size={14} />
                                {modelLoading ? 'Memuat model...' : 'Mulai Scan (30 detik)'}
                            </button>
                        </div>
                    </div>
                )}
                
                {phase === 'done' && result && (
                    <div style={{ animation: 'vsEnter 0.4s ease forwards' }}>
                        <h2 style={{ margin: '0 0 24px', fontFamily: 'Poppins', fontSize: 28 }}>Hasil Scan</h2>
                        
                        <div className="result-grid">
                            {/* Heart Rate Card */}
                            <div className="vs-metric">
                                <div style={{ width: 56, height: 56, borderRadius: 28, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FaHeartbeat size={28} color="#22c55e" />
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, letterSpacing: 0.5, fontWeight: 500 }}>HEART RATE</div>
                                <div style={{ fontSize: 48, fontWeight: 800, color: '#22c55e', lineHeight: 1, marginBottom: 8 }}>{result.heartRate}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>denyut per menit</div>
                                <div style={{ marginTop: 16 }}>
                                    <span style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, background: result.heartRate >= 60 && result.heartRate <= 100 ? '#dcfce7' : '#fee2e2', color: result.heartRate >= 60 && result.heartRate <= 100 ? '#166534' : '#991b1b' }}>
                                        {result.heartRate < 60 ? 'Bradikardia' : result.heartRate > 100 ? 'Takikardia' : 'Normal'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* RMSSD Card */}
                            <div className="vs-metric">
                                <div style={{ width: 56, height: 56, borderRadius: 28, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FaWaveSquare size={28} color="#8b5cf6" />
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, letterSpacing: 0.5, fontWeight: 500 }}>RMSSD (HRV)</div>
                                <div style={{ fontSize: 48, fontWeight: 800, color: '#8b5cf6', lineHeight: 1, marginBottom: 8 }}>{result.rmssd}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>milidetik</div>
                                <div style={{ marginTop: 16 }}>
                                    {result.rmssd !== '--' ? (
                                        <span style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, background: result.rmssd >= 15 && result.rmssd <= 80 ? '#dcfce7' : '#fef9c3', color: result.rmssd >= 15 && result.rmssd <= 80 ? '#166534' : '#854d0e' }}>
                                            {result.rmssd < 15 ? 'Rendah' : result.rmssd > 80 ? 'Tinggi' : 'Normal'}
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
                                            Tidak terdeteksi
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Respiratory Rate Card */}
                            <div className="vs-metric">
                                <div style={{ width: 56, height: 56, borderRadius: 28, background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <FaLungs size={28} color="#06b6d4" />
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, letterSpacing: 0.5, fontWeight: 500 }}>RESPIRATORY RATE</div>
                                <div style={{ fontSize: 48, fontWeight: 800, color: '#06b6d4', lineHeight: 1, marginBottom: 8 }}>{result.respRate}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>napas per menit</div>
                                <div style={{ marginTop: 16 }}>
                                    <span style={{ display: 'inline-block', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, background: result.respRate >= 12 && result.respRate <= 20 ? '#dcfce7' : '#fee2e2', color: result.respRate >= 12 && result.respRate <= 20 ? '#166534' : '#991b1b' }}>
                                        {result.respRate < 12 ? 'Bradipnea' : result.respRate > 20 ? 'Takipnea' : 'Normal'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="info-card" style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                <div><span style={{ color: '#64748b' }}>Signal Quality Index:</span> <strong style={{ fontSize: 16, color: result.signalQuality > 60 ? '#22c55e' : '#f97316' }}>{result.signalQuality}%</strong></div>
                                <div><span style={{ color: '#64748b' }}>Signal-to-Noise Ratio:</span> <strong>{result.snr} dB</strong></div>
                                <div><span style={{ color: '#64748b' }}>Status:</span> 
                                    <strong style={{ color: result.signalQuality > 60 ? '#22c55e' : result.signalQuality > 40 ? '#f97316' : '#dc2626' }}>
                                        {result.signalQuality > 60 ? 'Baik' : result.signalQuality > 40 ? 'Sedang' : 'Rendah'}
                                    </strong>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ textAlign: 'center' }}>
                            <button className="vs-start-btn" onClick={reset}>
                                <FaRedo size={13} /> Scan Ulang
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VitalScanPage;