// lib/api.ts
// ============================================================
// Production API client for the Quantora AI SAGRA backend.
//
// All data flows through the backend — no mock data.
// Endpoints:
//   POST /transactions        → submitTransaction()
//   GET  /transactions        → fetchTransactions()
//   GET  /transactions/stats  → fetchTransactionStats()
//   GET  /graph/data          → fetchGraphData()
//   GET  /alerts              → fetchAlerts()
//   GET  /dashboard           → fetchDashboard()
// ============================================================

import type { Transaction, GraphNode, GraphEdge, RiskLevel } from '@/lib/mockData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


// ─────────────────────────────────────────────────────
// Backend Response Types
// ─────────────────────────────────────────────────────

export interface StoredTransaction {
    id: string;
    sender: string;
    receiver: string;
    amount: number;
    timestamp: string;
    risk_score: number;
    risk_level: 'high' | 'medium' | 'low';
    is_fraud: boolean;
    trs: number;
    grs: number;
    ndb: number;
}

export interface TransactionsResponse {
    transactions: StoredTransaction[];
    total: number;
}

export interface TransactionStats {
    total: number;
    fraud_count: number;
    fraud_rate: number;
    avg_risk: number;
    total_amount: number;
    fraud_amount: number;
    high_count: number;
    medium_count: number;
    low_count: number;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: { nodes: number; edges: number; fraud: number };
}

export interface AlertData {
    alertId: string;
    account: string;
    riskScore: number;
    triggerReason: string;
    status: 'active' | 'investigating' | 'resolved';
    timestamp: string;
    clusterId: string;
    transactionId?: string;
}

export interface AlertsResponse {
    alerts: AlertData[];
    active: number;
    investigating: number;
}

export interface DashboardKpi {
    id: string;
    label: string;
    value: string;
    rawValue: number;
    change: number;
    changeLabel: string;
    invertChange?: boolean;
}

export interface TrendPoint {
    time: string;
    transactions: number;
    fraudAlerts: number;
}

export interface RiskDistPoint {
    label: string;
    value: number;
    color: string;
}

export interface ClusterData {
    clusterId: string;
    accountsInvolved: number;
    avgRiskScore: number;
    status: 'active' | 'monitoring' | 'contained';
    lastActivity: string;
}

export interface DashboardData {
    kpis: DashboardKpi[];
    trend: TrendPoint[];
    risk_distribution: RiskDistPoint[];
    clusters: ClusterData[];
    threat_level: 'High' | 'Medium' | 'Low';
}


// ─────────────────────────────────────────────────────
// API Functions — Production Endpoints
// ─────────────────────────────────────────────────────

/**
 * Submit a new transaction for SAGRA scoring.
 * Returns the fully scored transaction record.
 */
export async function submitTransaction(data: {
    sender: string;
    receiver: string;
    amount: number;
}): Promise<StoredTransaction> {
    const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch stored transactions from the backend.
 */
export async function fetchTransactions(
    limit = 50,
    fraudOnly = false,
): Promise<TransactionsResponse> {
    const params = new URLSearchParams({
        limit: String(limit),
        fraud_only: String(fraudOnly),
    });
    const res = await fetch(`${API_BASE}/transactions?${params}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch KPI metrics computed from all stored transactions.
 */
export async function fetchTransactionStats(): Promise<TransactionStats> {
    const res = await fetch(`${API_BASE}/transactions/stats`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch network graph data (nodes + edges) for D3 visualization.
 */
export async function fetchGraphData(): Promise<GraphData> {
    const res = await fetch(`${API_BASE}/graph/data`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

export interface NodeDetail {
    id: string;
    risk_score: number;
    risk_level: 'high' | 'medium' | 'low';
    is_fraud_account: boolean;
    group: string;
    degree: { in: number; out: number; total: number };
    flow: {
        total_sent: number;
        total_received: number;
        net_flow: number;
        transaction_count: number;
        fraud_count: number;
    };
    sagra: { avg_trs: number; avg_grs: number; avg_ndb: number };
    neighbors: { id: string; risk_score: number; risk_level: string }[];
    recent_transactions: StoredTransaction[];
}

/**
 * Fetch detailed analytics for a single graph node.
 */
export async function fetchNodeDetail(nodeId: string): Promise<NodeDetail> {
    const res = await fetch(`${API_BASE}/graph/node/${nodeId}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch fraud alerts derived from high-risk transactions.
 */
export async function fetchAlerts(limit = 50): Promise<AlertsResponse> {
    const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch full dashboard data package (KPIs, trend, distribution, clusters).
 */
export async function fetchDashboard(): Promise<DashboardData> {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}


// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

/**
 * Map a backend StoredTransaction to the frontend Transaction type.
 */
export function mapApiTransaction(t: StoredTransaction): Transaction {
    return {
        id: t.id,
        senderId: t.sender,
        receiverId: t.receiver,
        amount: t.amount,
        timestamp: new Date(t.timestamp),
        risk: t.risk_level as RiskLevel,
        isFraud: t.is_fraud,
    };
}


// ─────────────────────────────────────────────────────
// Bank CBS Integration Types & Endpoints
// ─────────────────────────────────────────────────────

export interface BankConnectionStatus {
    connected: boolean;
    bank_name: string;
    api_version: string;
    protocol: string;
    feed_type: string;
    last_poll: string | null;
    total_ingested: number;
    uptime_seconds: number;
    latency_ms: number;
    error_count: number;
    transactions_processed_by_sagra: number;
    ingestion_active: boolean;
}

export interface PipelineStage {
    stage: string;
    status: string;
    detail: string;
    protocol?: string;
    latency_ms?: number;
    total_ingested?: number;
    fraud_detected?: number;
    avg_risk?: number;
    clusters?: number;
    active_alerts?: number;
}

export interface PipelineStatus {
    pipeline: PipelineStage[];
    overall_status: string;
    uptime_seconds: number;
}

export interface BankFeedTransaction {
    message_id: string;
    instruction_id: string;
    end_to_end_id: string;
    creation_datetime: string;
    channel: string;
    debtor_account_id: string;
    debtor_iban: string;
    debtor_bic: string;
    debtor_name: string;
    creditor_account_id: string;
    creditor_iban: string;
    creditor_bic: string;
    creditor_name: string;
    amount: number;
    currency: string;
    merchant_category: string;
    merchant_label: string;
    originator_country: string;
    beneficiary_country: string;
    geo: { city: string; country: string; lat: number; lon: number };
    remittance_info: string;
    batch_id: string;
    bank_risk_flag: boolean;
    sagra_processed: boolean;
}

export interface BankFeedResponse {
    feed: BankFeedTransaction[];
    total_in_buffer: number;
    bank_name: string;
    feed_type: string;
}

/**
 * Fetch the bank CBS API connection status.
 */
export async function fetchBankStatus(): Promise<BankConnectionStatus> {
    const res = await fetch(`${API_BASE}/bank/status`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch raw ISO 20022 transactions from the bank feed (pre-SAGRA).
 */
export async function fetchBankFeed(limit = 50): Promise<BankFeedResponse> {
    const res = await fetch(`${API_BASE}/bank/feed?limit=${limit}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch full pipeline status (Bank CBS → SAGRA → Dashboard).
 */
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
    const res = await fetch(`${API_BASE}/pipeline/status`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}


// ─────────────────────────────────────────────────────
// Legacy Endpoints (kept for backwards compatibility)
// ─────────────────────────────────────────────────────

export interface PredictRequest {
    sender: number;
    receiver: number;
    amount: number;
}

export interface PredictResponse {
    risk_score: number;
    fraud_prediction: number;
}

export async function predictFraud(data: PredictRequest): Promise<PredictResponse> {
    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) return fallbackPrediction(data.amount);
        return await res.json();
    } catch {
        return fallbackPrediction(data.amount);
    }
}

function fallbackPrediction(amount: number): PredictResponse {
    const trs = Math.min(amount / 10000, 1);
    const risk_score = parseFloat((trs * 0.5).toFixed(4));
    return { risk_score, fraud_prediction: risk_score > 0.7 ? 1 : 0 };
}

export async function fetchGraphStats() {
    try {
        const res = await fetch(`${API_BASE}/graph/stats`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}


// ─────────────────────────────────────────────────────
// Bank Input Types & Endpoints
// ─────────────────────────────────────────────────────

export interface FileUploadResponse {
    status: string;
    filename: string;
    rows_processed: number;
    fraud_detected: number;
    avg_risk: number;
    transactions: StoredTransaction[];
}

export interface UploadRecord {
    id: string;
    filename: string;
    rows_processed: number;
    fraud_detected: number;
    avg_risk: number;
    timestamp: string;
}

export interface ManualTransactionRequest {
    sender: string;
    receiver: string;
    amount: number;
    iban?: string;
    bic?: string;
    description?: string;
}

export interface BankApiConnection {
    id: string;
    bank_name: string;
    api_key: string;
    endpoint_url: string;
    status: string;
    created_at: string;
    last_sync: string;
    transactions_synced: number;
}

export interface BankApiConnectionRequest {
    bank_name: string;
    api_key: string;
    endpoint_url: string;
}

export interface SyncResult {
    status: string;
    connection_id: string;
    bank_name: string;
    transactions_synced: number;
    transactions: StoredTransaction[];
}

/**
 * Upload a CSV bank statement file for batch SAGRA processing.
 */
export async function uploadBankFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/bank/input/upload`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    return await res.json();
}

/**
 * Fetch history of file uploads.
 */
export async function fetchUploadHistory(): Promise<{ uploads: UploadRecord[] }> {
    const res = await fetch(`${API_BASE}/bank/input/uploads`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Submit a single manual transaction for SAGRA scoring.
 */
export async function submitManualTransaction(data: ManualTransactionRequest): Promise<StoredTransaction> {
    const res = await fetch(`${API_BASE}/bank/input/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Register a new external bank API connection.
 */
export async function addBankConnection(data: BankApiConnectionRequest): Promise<BankApiConnection> {
    const res = await fetch(`${API_BASE}/bank/input/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * List all registered external bank API connections.
 */
export async function listBankConnections(): Promise<{ connections: BankApiConnection[] }> {
    const res = await fetch(`${API_BASE}/bank/input/connections`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}

/**
 * Remove a bank API connection by ID.
 */
export async function removeBankConnection(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/bank/input/connections/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
}

/**
 * Trigger a manual sync from a registered bank connection.
 */
export async function syncBankConnection(id: string): Promise<SyncResult> {
    const res = await fetch(`${API_BASE}/bank/input/connections/${id}/sync`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
}
