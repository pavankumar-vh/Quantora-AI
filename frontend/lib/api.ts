// lib/api.ts
// ============================================================
// Frontend API client for the Quantora AI SAGRA backend.
//
// Sends transaction data to the FastAPI backend and receives
// SAGRA risk scores and fraud predictions.
//
// The backend runs the production-ready SAGRA algorithm,
// validated in "SAGRA — Sentinel Adaptive Graph Risk Algorithm.ipynb".
//
// API calls are proxied through Next.js rewrites (next.config.js)
// to avoid CORS issues in development.
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface PredictRequest {
    sender: number;
    receiver: number;
    amount: number;
}

export interface PredictResponse {
    risk_score: number;
    fraud_prediction: number;
}

export interface DetailedPredictResponse extends PredictResponse {
    trs: number;
    grs: number;
    ndb: number;
    sender_degree: number;
    graph_stats: {
        node_count: number;
        edge_count: number;
        density: number;
    };
}

export interface GraphStats {
    node_count: number;
    edge_count: number;
    density: number;
}

/**
 * Send a transaction to the SAGRA backend for fraud prediction.
 *
 * Flow:
 *   1. POST transaction data to /predict
 *   2. Backend adds edge to transaction graph
 *   3. SAGRA computes risk score using TRS + GRS + NDB
 *   4. Returns risk_score and fraud_prediction
 *
 * @param data - Transaction with sender, receiver, and amount
 * @returns PredictResponse with risk_score (0-1) and fraud_prediction (0 or 1)
 */
export async function predictFraud(data: PredictRequest): Promise<PredictResponse> {
    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            console.warn('[Quantora API] Backend returned', res.status);
            return fallbackPrediction(data.amount);
        }

        return await res.json();
    } catch {
        // Backend unavailable — use local fallback
        // This ensures the frontend works standalone for demos
        console.warn('[Quantora API] Backend unreachable, using local fallback');
        return fallbackPrediction(data.amount);
    }
}

/**
 * Get detailed SAGRA breakdown including TRS, GRS, NDB components.
 * Used for dashboard display and debugging.
 */
export async function predictFraudDetailed(data: PredictRequest): Promise<DetailedPredictResponse | null> {
    try {
        const res = await fetch(`${API_BASE}/predict/detailed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Fetch current graph statistics from the backend.
 */
export async function fetchGraphStats(): Promise<GraphStats | null> {
    try {
        const res = await fetch(`${API_BASE}/graph/stats`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Local fallback prediction when the backend is unavailable.
 * Uses a simplified version of the SAGRA TRS formula.
 * This keeps the frontend functional even without the backend.
 */
function fallbackPrediction(amount: number): PredictResponse {
    const trs = Math.min(amount / 10000, 1);
    const risk_score = parseFloat((trs * 0.5).toFixed(4));
    return {
        risk_score,
        fraud_prediction: risk_score > 0.7 ? 1 : 0,
    };
}
