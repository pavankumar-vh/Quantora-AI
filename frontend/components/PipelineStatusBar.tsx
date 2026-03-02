'use client';

import { useState, useEffect } from 'react';
import { Activity, Database, Network, BarChart3, CheckCircle2, Zap } from 'lucide-react';
import { fetchPipelineStatus, fetchBankStatus, type PipelineStatus, type BankConnectionStatus } from '@/lib/api';

const STAGE_ICONS = [Activity, Database, Network, BarChart3];

const STATUS_COLORS: Record<string, string> = {
    connected: '#22c55e',
    processing: '#3b82f6',
    active: '#8b5cf6',
    serving: '#22c55e',
    disconnected: '#ef4444',
};

export default function PipelineStatusBar() {
    const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
    const [bank, setBank] = useState<BankConnectionStatus | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, b] = await Promise.all([
                    fetchPipelineStatus(),
                    fetchBankStatus(),
                ]);
                setPipeline(p);
                setBank(b);
            } catch { /* quiet */ }
        };

        load();
        const interval = setInterval(load, 4000);
        return () => clearInterval(interval);
    }, []);

    if (!pipeline || !bank) return null;

    return (
        <div className="w-full border-b border-[var(--border)] bg-[var(--surface)]">
            {/* Pipeline flow */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-1">
                    {/* Bank connection badge */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)]">
                        <span
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ backgroundColor: bank.connected ? '#22c55e' : '#ef4444' }}
                        />
                        <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                            {bank.bank_name}
                        </span>
                    </div>

                    {/* Pipeline stages */}
                    {pipeline.pipeline.map((stage, i) => {
                        const Icon = STAGE_ICONS[i] || Activity;
                        const color = STATUS_COLORS[stage.status] || '#6b7280';

                        return (
                            <div key={stage.stage} className="flex items-center gap-1">
                                {/* Connector arrow */}
                                <div className="flex items-center gap-0.5 px-1">
                                    <div className="w-4 h-px" style={{ backgroundColor: color, opacity: 0.5 }} />
                                    <Zap size={8} style={{ color }} />
                                    <div className="w-4 h-px" style={{ backgroundColor: color, opacity: 0.5 }} />
                                </div>

                                {/* Stage badge */}
                                <div
                                    className="flex items-center gap-1.5 px-2 py-1 rounded border"
                                    style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
                                >
                                    <Icon size={10} style={{ color }} />
                                    <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                                        {stage.stage}
                                    </span>
                                    <CheckCircle2 size={8} style={{ color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Stats strip */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Latency</span>
                        <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                            {bank.latency_ms}ms
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Ingested</span>
                        <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                            {bank.total_ingested}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase">Protocol</span>
                        <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                            {bank.protocol}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-mono text-green-400">
                            {pipeline.overall_status.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
