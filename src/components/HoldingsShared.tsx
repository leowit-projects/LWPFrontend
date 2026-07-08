import React from 'react';
import {
  Box,
  } from '@mui/material';

// ─── Sector target allocations ────────────────────────────────────────────────
export const SECTOR_TARGETS: Record<string, number> = {
  'Auto Ancillary': 18,
  Energy: 5,
  Finance: 18,
  FMCG: 16,
  Healthcare: 16,
  Infrastructure: 3,
  'Technology': 14,
  Others: 10,
};
export const NAMED_SECTORS = Object.keys(SECTOR_TARGETS).filter((s) => s !== 'Others');
export const SECTOR_GAP_THRESHOLD_RATIO = 0.15;

export const PIE_NAMED_SECTORS = [
  'Auto Ancillary',
  'Energy',
  'Finance',
  'FMCG',
  'Healthcare',
  'Infrastructure',
  'Technology',
  'Others',
];

// ─── AI Insights Types ────────────────────────────────────────────────────────

export interface InsightFlag {
  ticker: string;
  flag_type: 'RED' | 'YELLOW' | 'GREEN';
  message: string;
  action: string;
}

export interface SectorInsight {
  sector: string;
  commentary: string;
  status: 'STRONG' | 'NEUTRAL' | 'WEAK';
}

export interface ActionItem {
  action: 'BUY' | 'HOLD' | 'EXIT' | 'TRIM' | 'REVIEW';
  tickers: string[];
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── 52W Range & MA helpers ──────────────────────────────────────────────────

export const calculate52WeekPosition = (current: number | null, low: number | null, high: number | null): number => {
  if (current == null || low == null || high == null || high === low) return 0;
  return Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
};

export const getProgressColor = (percentage: number): 'error' | 'warning' | 'success' => {
  if (percentage < 28) return 'success';
  if (percentage < 55) return 'warning';
  return 'error';
};

export const getAvgPriceBuySignal = (
  avgPrice: number | null | undefined,
  lastClose: number | null | undefined,
  ma20: number | null | undefined
): { signal: string; color: string } => {
  if (!avgPrice || !lastClose || !ma20) return { signal: 'No Data', color: '#9e9e9e' };
  if (avgPrice < lastClose && lastClose < ma20) return { signal: 'Strong No Buy', color: '#d32f2f' };
  if (avgPrice < lastClose && lastClose > ma20) return { signal: 'No Buy', color: '#e57373' };
  if (avgPrice > lastClose && avgPrice > ma20 && lastClose < ma20) return { signal: 'Strong Buy', color: '#2e7d32' };
  if (avgPrice > lastClose && avgPrice > ma20 && lastClose > ma20) return { signal: 'Light Buy', color: '#7cb342' };
  return { signal: 'Neutral', color: '#ff9800' };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatCurrency = (value: number, currency: string): string => {
  if (value == null || !isFinite(value)) return '—';
  if (currency === 'INR') {
    const isNeg = value < 0;
    const abs = Math.abs(value);
    const fmt = abs.toFixed(2);
    const [int, dec] = fmt.split('.');
    let last3 = int.substring(int.length - 3);
    const rest = int.substring(0, int.length - 3);
    if (rest !== '') last3 = ',' + last3;
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
    return `${isNeg ? '-' : ''}₹${formatted}.${dec}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

// Price without currency symbol — for compact "Avg / LTP" pairs
export const formatPrice = (value: number | null | undefined, currency: string): string => {
  if (value == null || !isFinite(value)) return '—';
  if (currency === 'INR') return formatCurrency(value, currency).replace('₹', '');
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

// ─── Position Size filter brackets (per account currency) ─────────────────────
export interface PositionSizeBracket { label: string; min: number; max: number } // min ≤ invested < max
export const POSITION_SIZE_BRACKETS: Record<'INR' | 'USD', PositionSizeBracket[]> = {
  INR: [
    { label: 'Less than ₹50K', min: 0, max: 50_000 },
    { label: '₹50K – ₹1L', min: 50_000, max: 100_000 },
    { label: '₹1L – ₹3L', min: 100_000, max: 300_000 },
    { label: '₹3L – ₹5L', min: 300_000, max: 500_000 },
    { label: '₹5L & above', min: 500_000, max: Infinity },
  ],
  USD: [
    { label: 'Less than $500', min: 0, max: 500 },
    { label: '$500 – $2K', min: 500, max: 2_000 },
    { label: '$2K – $5K', min: 2_000, max: 5_000 },
    { label: '$5K – $10K', min: 5_000, max: 10_000 },
    { label: '$10K & above', min: 10_000, max: Infinity },
  ],
};

export const formatPercentage = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const getProfitLossColor = (value: number): 'success' | 'error' | 'default' => {
  if (value > 0) return 'success';
  if (value < 0) return 'error';
  return 'default';
};

export const round2 = (v: number) => Math.round(v * 100) / 100;

export const formatDaysAgo = (dateString: string): string => {
  const diff = Math.floor(Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
};

export const getDaysAgoColor = (dateString: string): string => {
  const diff = Math.floor(Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000);
  return diff > 2 ? 'error.main' : '#00a556';
};

// ─── TabPanel ─────────────────────────────────────────────────────────────────

export function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
      {value === index && children}
    </Box>
  );
}

// ─── Sector analysis hook ─────────────────────────────────────────────────────

export interface SectorAnalysis {
  sector: string;
  invested: number;
  actualPct: number;
  targetPct: number;
  gap: number;
  threshold: number;
  isUnder: boolean;
}

export function buildSectorAnalysis(stocks: Array<{ sector?: string | null; invested_value: number }>): SectorAnalysis[] {
  const totalInvested = stocks.reduce((a, s) => a + s.invested_value, 0);
  if (totalInvested === 0) return [];
  const sectorMap: Record<string, number> = {};
  stocks.forEach((s) => {
    const raw = s.sector || 'Others';
    const key = NAMED_SECTORS.includes(raw) ? raw : 'Others';
    sectorMap[key] = (sectorMap[key] || 0) + s.invested_value;
  });
  return Object.keys(SECTOR_TARGETS).map((sector) => {
    const invested = sectorMap[sector] || 0;
    const actualPct = (invested / totalInvested) * 100;
    const targetPct = SECTOR_TARGETS[sector];
    const gap = targetPct - actualPct;
    const threshold = targetPct * SECTOR_GAP_THRESHOLD_RATIO;
    return { sector, invested, actualPct, targetPct, gap, threshold, isUnder: gap > threshold };
  });
}