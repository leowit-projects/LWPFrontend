import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Tabs,
  Tab,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ArrowBack,
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
  PieChart as PieChartIcon,
  AttachMoney,
  MonetizationOn,
  Delete,
  Lightbulb,
  Timeline,
  Warning,
  Star,
  ArrowUpward,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  LabelList,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { holdingAccountsAPI } from '../../api/client';
import {
  HoldingAccountsResponse,
  HoldingRecommendation,
  BondHoldingDetail,
  MutualFundHoldingDetail,
} from '../../types';

// ─── Sector target allocations ────────────────────────────────────────────────
// Adjust percentages here to match your investment strategy.
// "Others" covers every sector not explicitly listed above it.
const SECTOR_TARGETS: Record<string, number> = {
  Finance: 18,
  'Auto Ancillary': 18,
  FMCG: 16,
  Healthcare: 18,
  'Software Services': 12,
  Energy: 8,
  Others: 10,
};
const NAMED_SECTORS = Object.keys(SECTOR_TARGETS).filter((s) => s !== 'Others');
const SECTOR_GAP_THRESHOLD = 2; // % gap before a sector is flagged as under-invested

const PIE_COLORS = [
'#de324c',  '#f4895f',  '#f8e16f',  '#95cf92',  '#369acc',  '#9656a2', '#d8d8d8'
];

// Sectors shown as individual slices in the pie chart.
// Everything else is collapsed into one "Others" slice.
const PIE_NAMED_SECTORS = [
  'Finance',
  'Healthcare',
  'FMCG',
  'Software Services',
  'Energy',
  'Auto Ancillary',
];

// ─── 52W Range & MA helpers ──────────────────────────────────────────────────

const calculate52WeekPosition = (current: number | null, low: number | null, high: number | null): number => {
  if (current == null || low == null || high == null || high === low) {
    return 0;
  }
  const position = ((current - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, position));
};

const getProgressColor = (percentage: number): 'error' | 'warning' | 'success' => {
  if (percentage < 28) return 'success';
  if (percentage < 55) return 'warning';
  return 'error';
};

const getMASignal = (
  avgPrice: number | null | undefined,
  closePrice: number | null | undefined,
  ma20: number | null | undefined,
  ma200: number | null | undefined
): { signal: string; color: string; chipColor: 'success' | 'error' | 'warning' | 'default' } => {
  if (!avgPrice || !closePrice || !ma20 || !ma200) {
    return { signal: 'No Data', color: 'text.disabled', chipColor: 'default' };
  }

  const belowClose = avgPrice < closePrice;
  const belowMA20 = avgPrice < ma20;
  const belowMA200 = avgPrice < ma200;

  const closeBelowMA20 = closePrice < ma20;
  const closeBelowMA200 = closePrice < ma200;

  const ma20BelowMA200 = ma20 < ma200;

  if (belowClose && belowMA20 && belowMA200) {
    return { signal: 'Too Low', color: 'success.main', chipColor: 'success' };
  }
  
  if (!belowClose && belowMA20 && belowMA200) {
    if (closeBelowMA20 && closeBelowMA200) {
      return { signal: 'Too High', color: 'error.main', chipColor: 'error' };
    }
    return { signal: 'Low', color: 'success.light', chipColor: 'success' };
  }

  if (!belowClose && !belowMA20 && belowMA200) {
    if (ma20BelowMA200) {
      return { signal: 'Too High', color: 'error.main', chipColor: 'error' };
    }
    return { signal: 'High', color: 'error.light', chipColor: 'error' };
  }

  if (!belowClose && !belowMA20 && !belowMA200) {
    return { signal: 'Too High', color: 'error.main', chipColor: 'error' };
  }

  return { signal: 'Neutral', color: 'warning.main', chipColor: 'warning' };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number, currency: string): string => {
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercentage = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const getProfitLossColor = (value: number): 'success' | 'error' | 'default' => {
  if (value > 0) return 'success';
  if (value < 0) return 'error';
  return 'default';
};

const round2 = (v: number) => Math.round(v * 100) / 100;

const formatDaysAgo = (dateString: string): string => {
  const diff = Math.floor(
    Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
};

const getDaysAgoColor = (dateString: string): string => {
  const diff = Math.floor(
    Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000
  );
  return diff > 2 ? 'error.main' : '#00a556';
};

// ─── TabPanel ─────────────────────────────────────────────────────────────────

function TabPanel({
  children,
  value,
  index,
}: {
  children: React.ReactNode;
  value: number;
  index: number;
}) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
      {value === index && children}
    </Box>
  );
}

// ─── Sector analysis hook ─────────────────────────────────────────────────────

interface SectorAnalysis {
  sector: string;
  invested: number;
  actualPct: number;
  targetPct: number;
  gap: number; // positive = under-invested
  isUnder: boolean;
}

function buildSectorAnalysis(
  stocks: Array<{ sector?: string | null; invested_value: number }>
): SectorAnalysis[] {
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
    return { sector, invested, actualPct, targetPct, gap, isUnder: gap > SECTOR_GAP_THRESHOLD };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// 1. Stock summary cards
function StockSummaryCards({
  count,
  invested,
  current,
  pnl,
  currency,
}: {
  count: number;
  invested: number;
  current: number;
  pnl: number;
  currency: string;
}) {
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const cards = [
    { label: 'Total Stocks', value: count.toString(), sub: 'Holdings', color: '#667eea', icon: <ShowChart /> },
    { label: 'Total Invested', value: formatCurrency(invested, currency), sub: 'Cost basis', color: '#764ba2', icon: <AttachMoney /> },
    {
      label: 'Current Value',
      value: formatCurrency(current, currency),
      sub: formatPercentage(((current - invested) / (invested || 1)) * 100) + ' total return',
      color: '#4facfe',
      icon: <TrendingUp />,
    },
    {
      label: 'Total P&L',
      value: formatCurrency(pnl, currency),
      sub: formatPercentage(pnlPct),
      color: pnl >= 0 ? '#43e97b' : '#f5576c',
      icon: pnl >= 0 ? <TrendingUp /> : <TrendingDown />,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((c) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}>
          <Card
            sx={{
              borderTop: `4px solid ${c.color}`,
              background: 'linear-gradient(135deg,#fff 0%,#f8f9ff 100%)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            }}
          >
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                    {c.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: c.color, mt: 0.5 }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{c.sub}</Typography>
                </Box>
                <Box sx={{ color: c.color, opacity: 0.35, mt: 0.5 }}>{c.icon}</Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// 2. Sector pie chart
function SectorPieChart({
  stocks,
  currency,
}: {
  stocks: Array<{ sector?: string | null; invested_value: number }>;
  currency: string;
}) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    stocks.forEach((s) => {
      const raw = s.sector || 'Others';
      // Keep the 6 named sectors as individual slices; bucket everything else
      const key = PIE_NAMED_SECTORS.includes(raw) ? raw : 'Others';
      map[key] = (map[key] || 0) + s.invested_value;
    });
    // Sort named sectors first (in definition order), then Others last
    const named = PIE_NAMED_SECTORS.filter((s) => map[s] !== undefined).map((name) => ({ name, value: map[name] }));
    const others = map['Others'] ? [{ name: 'Others', value: map['Others'] }] : [];
    return [...named, ...others];
  }, [stocks]);

  const total = data.reduce((a, d) => a + d.value, 0);

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text
        x={cx + r * Math.cos(-midAngle * R)}
        y={cy + r * Math.sin(-midAngle * R)}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Paper sx={{ p: 2, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <PieChartIcon fontSize="small" sx={{ color: '#667eea' }} /> Invested by Sector
      </Typography>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={150}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(val: number, name: string) => [
              `${formatCurrency(val, currency)} (${((val / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={9}
            formatter={(value, entry: any) => (
              <span style={{ fontSize: 11, color: '#555' }}>
                {value} — {formatCurrency(entry.payload.value, currency)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// 3. Sector P&L chart
function SectorPnLChart({
  stocks,
  currency,
}: {
  stocks: Array<{
    sector?: string | null;
    invested_value: number;
    current_value: number;
    profit_loss: number;
  }>;
  currency: string;
}) {
  const data = useMemo(() => {
    const map: Record<string, { invested: number; current: number; pnl: number }> = {};
    stocks.forEach((s) => {
      const raw = s.sector || 'Others';
      const key = PIE_NAMED_SECTORS.includes(raw) ? raw : 'Others';
      if (!map[key]) map[key] = { invested: 0, current: 0, pnl: 0 };
      map[key].invested += s.invested_value;
      map[key].current += s.current_value;
      map[key].pnl += s.profit_loss;
    });
    const named = PIE_NAMED_SECTORS
      .filter((s) => map[s])
      .map((name) => ({
        name,
        invested: round2(map[name].invested),
        current: round2(map[name].current),
        pnl: round2(map[name].pnl),
        pnlPct: map[name].invested > 0
          ? parseFloat(((map[name].pnl / map[name].invested) * 100).toFixed(2))
          : 0,
      }));
    const oth = map['Others'];
    const others = oth
      ? [{
          name: 'Others',
          invested: round2(oth.invested),
          current: round2(oth.current),
          pnl: round2(oth.pnl),
          pnlPct: oth.invested > 0
            ? parseFloat(((oth.pnl / oth.invested) * 100).toFixed(2))
            : 0,
        }]
      : [];
    return [...named, ...others];
  }, [stocks]);

  interface TooltipPayload {
    name: string;
    invested: number;
    current: number;
    pnl: number;
    pnlPct: number;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d: TooltipPayload = payload[0].payload;
    return (
      <Paper sx={{ p: 1.5, minWidth: 210, boxShadow: 4, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{label}</Typography>
        {[
          { label: 'Invested', value: formatCurrency(d.invested, currency), color: 'text.primary' },
          { label: 'Current', value: formatCurrency(d.current, currency), color: 'text.primary' },
        ].map((row) => (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">{row.label}</Typography>
            <Typography variant="caption" fontWeight={600} color={row.color}>{row.value}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 0.75 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
          <Typography variant="caption" color="text.secondary">P&L</Typography>
          <Typography
            variant="caption"
            fontWeight={700}
            color={d.pnl >= 0 ? 'success.main' : 'error.main'}
          >
            {formatCurrency(d.pnl, currency)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
          <Typography variant="caption" color="text.secondary">Return</Typography>
          <Typography
            variant="caption"
            fontWeight={700}
            color={d.pnlPct >= 0 ? 'success.main' : 'error.main'}
          >
            {d.pnlPct >= 0 ? '+' : ''}{d.pnlPct.toFixed(2)}%
          </Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Paper sx={{ p: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <TrendingUp fontSize="small" sx={{ color: '#43e97b' }} /> P&L by Sector
      </Typography>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 24, right: 16, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#555' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v, currency)}
            width={95}
            tick={{ fontSize: 11, fill: '#888' }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine y={0} stroke="#bbb" strokeWidth={1.5} />
          <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.pnl >= 0 ? '#4caf50' : '#f44336'}
                fillOpacity={0.82}
              />
            ))}
            <LabelList
              dataKey="pnlPct"
              position="top"
              formatter={(v: any) => typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : ''}
              style={{ fontSize: 11, fontWeight: 700, fill: '#444' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// 4. Sector gap analysis panel
function SectorAnalysisPanel({
  analysis,
  currency,
  totalInvested,
}: {
  analysis: SectorAnalysis[];
  currency: string;
  totalInvested: number;
}) {
  const underSectors = analysis.filter((a) => a.isUnder);

  return (
    <Paper sx={{ p: 2, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Lightbulb fontSize="small" sx={{ color: '#f5a623' }} /> Sector Allocation vs Target
      </Typography>

      {underSectors.length > 0 && (
        <Alert severity="info" icon={<ArrowUpward />} sx={{ mb: 2, py: 0.5 }}>
          <AlertTitle sx={{ fontSize: '0.8rem', mb: 0.25 }}>Sectors below target</AlertTitle>
          {underSectors.map((s) => (
            <Typography key={s.sector} variant="caption" display="block" sx={{ ml: 0.5 }}>
              <strong>{s.sector}</strong>{' '}
              <Chip label={`${s.actualPct.toFixed(1)}%`} size="small" color="warning" sx={{ height: 16, fontSize: '0.65rem' }} />
              {' → '}
              <Chip label={`${s.targetPct}%`} size="small" color="success" sx={{ height: 16, fontSize: '0.65rem' }} />
              {' · invest '}
              <strong style={{ color: '#2e7d32' }}>{formatCurrency((s.gap / 100) * totalInvested, currency)}</strong>
              {' more'}
            </Typography>
          ))}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {analysis.map((a) => (
          <Box key={a.sector}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {a.isUnder && <Warning fontSize="small" sx={{ color: 'warning.main', fontSize: '14px' }} />}
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                  {a.sector}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip
                  label={`${a.actualPct.toFixed(1)}%`}
                  size="small"
                  color={a.isUnder ? 'warning' : a.gap < -SECTOR_GAP_THRESHOLD ? 'error' : 'success'}
                  sx={{ height: 18, fontSize: '0.68rem' }}
                />
                <Typography variant="caption" color="text.disabled">/ {a.targetPct}%</Typography>
              </Box>
            </Box>
            <Box
              sx={{
                height: 7,
                borderRadius: 3,
                backgroundColor: '#eeeeee',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: 3,
                  width: `${Math.min(100, (a.actualPct / (a.targetPct || 1)) * 100)}%`,
                  backgroundColor:
                    a.isUnder ? '#ff9800' : a.gap < -SECTOR_GAP_THRESHOLD ? '#f44336' : '#4caf50',
                  transition: 'width 0.6s ease',
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {formatCurrency(a.invested, currency)}
              {a.gap > 0 && ` · ${formatCurrency((a.gap / 100) * totalInvested, currency)} short`}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// 4. Stock recommendations table (separate from holdings)
function StockRecommendationsTable({
  recommendations,
  underSectors,
  stockSectorMap,
  currency,
  recFilter,
  onRecFilterChange,
}: {
  recommendations: HoldingRecommendation[];
  underSectors: string[];
  stockSectorMap: Record<string, string>;
  currency: string;
  recFilter: string[];
  onRecFilterChange: (_: React.MouseEvent<HTMLElement>, v: string[]) => void;
}) {
  const filtered = recommendations.filter(
    (r) => r.is_active && recFilter.includes(r.recommendation_type)
  );

  const isUnderInvested = (symbol: string): boolean => {
    const sec = stockSectorMap[symbol] || '';
    const isNamed = NAMED_SECTORS.includes(sec);
    return isNamed ? underSectors.includes(sec) : underSectors.includes('Others');
  };

  const columns: GridColDef[] = [
    {
      field: '_priority',
      headerName: '',
      width: 44,
      sortable: false,
      renderCell: (p: GridRenderCellParams) =>
        isUnderInvested(p.row.stock_symbol) ? (
          <Tooltip title={`${stockSectorMap[p.row.stock_symbol] || 'Others'} sector is below target — priority buy`}>
            <Star sx={{ color: '#f5a623', fontSize: 18 }} />
          </Tooltip>
        ) : null,
    },
    {
      field: 'stock_symbol',
      headerName: 'Symbol',
      width: 140,
      renderCell: (p: GridRenderCellParams) => {
        const priority = isUnderInvested(p.row.stock_symbol);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" fontWeight={700}>{p.value as string}</Typography>
            {priority && (
              <Chip
                label="▲"
                size="small"
                sx={{ height: 17, fontSize: '0.62rem', bgcolor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'recommendation_type',
      headerName: 'Action',
      width: 100,
      renderCell: (p: GridRenderCellParams) => {
        const map: Record<string, { bg: string; fg: string }> = {
          BUY: { bg: '#e8f5e9', fg: '#2e7d32' },
          SELL: { bg: '#ffebee', fg: '#c62828' },
          HOLD: { bg: '#fff8e1', fg: '#f57f17' },
        };
        const c = map[p.value as string] || { bg: '#f5f5f5', fg: '#555' };
        return (
          <Chip
            label={p.value as string}
            size="small"
            sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, minWidth: 52 }}
          />
        );
      },
    },
    {
      field: '_sector',
      headerName: 'Sector',
      width: 155,
      sortable: false,
      valueGetter: (_: any, row: HoldingRecommendation) => stockSectorMap[row.stock_symbol] || '—',
    },
    { field: 'current_quantity', headerName: 'Curr Qty', width: 88, type: 'number' },
    {
      field: 'recommended_quantity',
      headerName: 'Rec Qty',
      width: 88,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
          <Typography variant="body2" fontWeight={700} color="primary">{p.value as number}</Typography>
        </Box>
      ),
    },
    {
      field: 'current_average_price',
      headerName: 'Avg Price',
      width: 125,
      type: 'number',
      valueFormatter: (v: number) => formatCurrency(v, currency),
    },
    {
      field: 'target_price',
      headerName: 'Target',
      width: 125,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
          <Typography variant="body2" fontWeight={700} color="success.main">
            {formatCurrency(p.value as number, currency)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'price_52w_low',
      headerName: '52W Low',
      width: 120,
      type: 'number',
      valueFormatter: (v: number) => formatCurrency(v, currency),
    },
    {
      field: 'pe_ratio',
      headerName: 'P/E',
      width: 75,
      type: 'number',
      valueFormatter: (v: number | null) => (v != null ? v.toFixed(1) : '—'),
    },
    {
      field: 'rsi_index',
      headerName: 'RSI',
      width: 75,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const rsi = p.value as number | null;
        if (rsi == null) return (
          <Typography variant="body2" color="text.disabled">—</Typography>
        );
        const color = rsi < 30 ? 'success.main' : rsi > 70 ? 'error.main' : 'text.primary';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" fontWeight={600} color={color}>{rsi.toFixed(1)}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'pegy_index',
      headerName: 'PEGY',
      width: 75,
      type: 'number',
      valueFormatter: (v: number | null) => (v != null ? v.toFixed(2) : '—'),
    },
    {
      field: 'recommendation_date',
      headerName: 'Date',
      width: 105,
      renderCell: (p: GridRenderCellParams) => (
        <Box>
          <Typography variant="caption" display="block">
            {new Date(p.value as string).toLocaleDateString('en-IN')}
          </Typography>
          <Typography variant="caption" color={getDaysAgoColor(p.value as string)}>
            {formatDaysAgo(p.value as string)}
          </Typography>
        </Box>
      ),
    },
  ];

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box
        sx={{
          p: 1.5,
          background: 'linear-gradient(90deg,#667eea,#764ba2)',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Lightbulb sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">
          Stock Recommendations
        </Typography>
        <Chip
          label={`${filtered.length} shown`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'white', fontWeight: 700, height: 20 }}
        />
        {underSectors.length > 0 && (
          <Chip
            icon={<Star sx={{ color: '#f5a623 !important', fontSize: '14px !important' }} />}
            label="★ = priority sector"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.7rem', height: 20 }}
          />
        )}
        <Box sx={{ ml: 'auto' }}>
          <ToggleButtonGroup
            value={recFilter}
            onChange={onRecFilterChange}
            size="small"
            sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)', py: 0.25, px: 1.25, fontSize: '0.72rem' }, '& .Mui-selected': { color: 'white !important', bgcolor: 'rgba(255,255,255,0.2) !important' } }}
          >
            <ToggleButton value="BUY">BUY</ToggleButton>
            <ToggleButton value="SELL">SELL</ToggleButton>
            <ToggleButton value="HOLD">HOLD</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Box sx={{ height: Math.min(480, 56 + filtered.length * 56 + 60) }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          rowHeight={56}
          getRowClassName={(params) =>
            isUnderInvested(params.row.stock_symbol) ? 'priority-row' : ''
          }
          sx={{
            border: 'none',
            '& .priority-row': { bgcolor: '#fff8e1', '&:hover': { bgcolor: '#ffecb3' } },
            '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8f9ff' },
          }}
        />
      </Box>
    </Paper>
  );
}

// 5. Stock holdings detail table (no recommendation columns — those are separate above)
function StockDetailsTable({
  stocks,
  onDelete,
}: {
  stocks: Array<{
    id: number;
    symbol: string;
    name?: string | null;
    sector?: string | null;
    quantity: number;
    average_price: number;
    last_close_price?: number | null;
    price_52w_low?: number | null;
    price_52w_high?: number | null;
    moving_average_20?: number | null;
    moving_average_200?: number | null;
    invested_value: number;
    current_value: number;
    profit_loss: number;
    profit_loss_percentage: number;
    currency: string;
    updated_at: string;
  }>;
  currency: string;
  onDelete: (id: number, name: string) => void;
}) {
  type SortKey = 'symbol' | 'invested_value' | 'current_value' | 'profit_loss' | 'profit_loss_percentage' | 'quantity' | 'average_price';
  const [sortBy, setSortBy] = useState<SortKey>('invested_value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sectorFilter, setSectorFilter] = useState<string>('All');

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'symbol' ? 'asc' : 'desc'); }
  };

  // Unique sector options derived from the stocks prop
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => set.add(s.sector || 'Unknown'));
    return ['All', ...Array.from(set).sort()];
  }, [stocks]);

  const filteredStocks = sectorFilter === 'All'
    ? stocks
    : stocks.filter((s) => (s.sector || 'Unknown') === sectorFilter);

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === 'symbol') {
      const cmp = (a.symbol ?? '').localeCompare(b.symbol ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return sortDir === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
  });

  const sortHeader = (col: SortKey, label: string) => (
    <TableSortLabel
      active={sortBy === col}
      direction={sortBy === col ? sortDir : 'desc'}
      onClick={() => handleSort(col)}
    >
      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">
        {label}
      </Typography>
    </TableSortLabel>
  );

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box
        sx={{
          p: 1.5,
          background: 'linear-gradient(90deg,#4facfe,#00f2fe)',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <ShowChart sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">
          Stock Holdings
        </Typography>
        <Chip
          label={sectorFilter === 'All' ? stocks.length : `${sortedStocks.length} / ${stocks.length}`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }}
        />
        <Box sx={{ ml: 'auto' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel
              sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem',
                '&.Mui-focused': { color: 'white' } }}
            >
              Sector
            </InputLabel>
            <Select
              value={sectorFilter}
              label="Sector"
              onChange={(e) => setSectorFilter(e.target.value)}
              sx={{
                color: 'white',
                fontSize: '0.82rem',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                '.MuiSvgIcon-root': { color: 'white' },
              }}
            >
              {sectorOptions.map((opt) => (
                <MenuItem key={opt} value={opt} sx={{ fontSize: '0.82rem' }}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9ff' }}>
              <TableCell>{sortHeader('symbol', 'Symbol')}</TableCell>
              <TableCell>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Sector</Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Last Close / 52W Range</Typography>
              </TableCell>
              <TableCell align="right">{sortHeader('quantity', 'Qty')}</TableCell>
              <TableCell align="center">{sortHeader('average_price', 'Avg Price')}</TableCell>
              <TableCell align="right">{sortHeader('invested_value', 'Invested')}</TableCell>
              <TableCell align="right">{sortHeader('current_value', 'Current')}</TableCell>
              <TableCell align="right">{sortHeader('profit_loss', 'P&L')}</TableCell>
              <TableCell align="right">{sortHeader('profit_loss_percentage', 'P&L %')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedStocks.map((s) => (
              <TableRow key={s.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{s.symbol}</Typography>
                  <Typography variant="caption" color={getDaysAgoColor(s.updated_at)}>
                    {formatDaysAgo(s.updated_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {s.sector ? (
                    <Chip label={s.sector} size="small" sx={{ height: 19, fontSize: '0.68rem' }} />
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {s.price_52w_low != null && s.price_52w_high != null && s.last_close_price != null ? (
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="caption" display="block">
                            Current: {formatCurrency(s.last_close_price, s.currency)}
                          </Typography>
                          <Typography variant="caption" display="block">
                            52w Low: {formatCurrency(s.price_52w_low, s.currency)}
                          </Typography>
                          <Typography variant="caption" display="block">
                            52w High: {formatCurrency(s.price_52w_high, s.currency)}
                          </Typography>
                          <Typography variant="caption" display="block" fontWeight={600}>
                            Position: {calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high).toFixed(1)}%
                          </Typography>
                        </Box>
                      }
                      arrow
                    >
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
                        <Typography variant="caption" fontSize="0.6rem" color="text.primary" fontWeight={700} textAlign="center">
                          {s.last_close_price ? formatCurrency(s.last_close_price, s.currency) : '—'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high)}
                          color={getProgressColor(calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high))}
                          sx={{
                            height: 6,
                            borderRadius: 1,
                            backgroundColor: 'grey.300',
                          }}
                        />
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="caption" fontSize="0.6rem" color="text.secondary" fontWeight={500}>
                            {formatCurrency(s.price_52w_low, s.currency)}
                          </Typography>
                          <Typography variant="caption" fontSize="0.6rem" color="text.secondary" fontWeight={500}>
                            {formatCurrency(s.price_52w_high, s.currency)}
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">No data</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{s.quantity.toLocaleString()}</Typography>
                </TableCell>
                {/* <TableCell align="right">
                  <Typography variant="body2">{formatCurrency(s.average_price, s.currency)}</Typography>
                </TableCell> */}
                <TableCell>
                  {s.average_price && s.moving_average_20 && s.moving_average_200 ? (() => {
                    const dataPoints = [
                      { value: s.average_price, label: 'Avg. Price', color: null },
                      { value: s.last_close_price ?? s.average_price, label: 'Last Close', color: '#9e9e9e' },
                      { value: s.moving_average_20, label: '20d', color: '#2196f3' },
                      { value: s.moving_average_200, label: '200d', color: '#ff9800' }
                    ];

                    // Sort by value to find min, middle, max
                    const sorted = [...dataPoints].sort((a, b) => a.value - b.value);
                    const minItem = sorted[0];
                    const middleItem = sorted[1];
                    const maxItem = sorted[2];
                    
                    const minValue = minItem.value;
                    const maxValue = maxItem.value;
                    const range = maxValue - minValue;
                    
                    // Calculate positions
                    const avgPricePosition = range > 0 ? ((s.average_price - minValue) / range) * 100 : 50;
                    const ma20Position = range > 0 ? ((s.moving_average_20 - minValue) / range) * 100 : 50;
                    const ma200Position = range > 0 ? ((s.moving_average_200 - minValue) / range) * 100 : 50;
                    
                    // Determine signal based on price position
                    const signal = getMASignal(s.average_price, s.last_close_price, s.moving_average_20, s.moving_average_200);
                    let signalLabel = '';
                    let signalColor = '';
                    let signalWeight: number | undefined = undefined;
                    
                    switch (signal.signal) {
                      case 'Too High':
                        signalLabel = "Buy";
                        signalColor = '#007b04';
                        signalWeight = 800;
                        break;
                      case 'High':
                        signalLabel = 'Buy';
                        signalColor = '#00cf07';
                        signalWeight = 500;
                        break;
                      case 'Neutral':
                        signalLabel = 'Neutral';
                        signalColor = '#ff9800';
                        signalWeight = 500;
                        break;
                      case 'Low':
                        signalLabel = 'No Buy';
                        signalColor = '#ff1100';
                        signalWeight = 500;
                        break;
                      case 'Too Low':
                        signalLabel = 'No Buy';
                        signalColor = '#be0d00';
                        signalWeight = 800;
                        break;
                      default:
                        signalLabel = 'Neutral';
                        signalColor = '#9e9e9e';
                        signalWeight = 500;
                    }
                    
                    // Middle marker color is always black
                    const middleColor = '#000000';

                    return (
                      <Tooltip
                        title={
                          <Box>
                            {sorted.map((d) => (
                              <Typography key={d.label} variant="caption" display="block">
                                {d.label}: {formatCurrency(d.value, s.currency)}
                              </Typography>
                            ))}
                          </Box>
                        }
                        arrow
                      >
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
                          <Typography variant="caption" fontSize="0.6rem" color="text.primary" fontWeight={700} textAlign="center">
                            {s.average_price ? formatCurrency(s.average_price, s.currency) : '—'}
                          </Typography>
                          {/* Main progress bar */}
                          <Box sx={{ position: 'relative', width: '100%', height: 8 }}>
                            <LinearProgress
                              variant="determinate"
                              value={100}
                              sx={{
                                height: 6,
                                borderRadius: 1,
                                backgroundColor: 'grey.300',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: 'transparent',
                                },
                              }}
                            />
                            {/* Middle value marker */}
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${middleItem.label === 'Avg. Price' ? avgPricePosition : 
                                        middleItem.label === '20d' ? ma20Position : ma200Position}%`,
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 3,
                                height: 12,
                                backgroundColor: middleColor,
                                borderRadius: 0.5,
                                zIndex: 3,
                                border: '1px solid white',
                              }}
                            />
                          </Box>
                          {/* Labels */}
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" fontSize="0.65rem" color="text.secondary" fontWeight={300}>
                              {minItem.label}
                            </Typography>
                            <Box 
                              sx={{  
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Typography variant="caption" fontSize="0.6rem" color={signalColor} fontWeight={signalWeight} sx={{ textTransform: 'uppercase' }}>
                                {signalLabel}
                              </Typography>
                            </Box>
                            <Typography variant="caption" fontSize="0.66rem" color="text.secondary" fontWeight={300}>
                              {maxItem.label}
                            </Typography>
                          </Box>
                        </Box>
                      </Tooltip>
                    );
                  })() : (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
                      <Typography variant="caption" fontSize="0.7rem" color="text.primary" fontWeight={700} textAlign="center">
                        {s.average_price ? formatCurrency(s.average_price, s.currency) : '—'}
                      </Typography>
                    </Box>
                    
                  )}  
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatCurrency(s.invested_value, s.currency)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatCurrency(s.current_value, s.currency)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={s.profit_loss >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(s.profit_loss, s.currency)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Chip
                    label={formatPercentage(s.profit_loss_percentage)}
                    color={getProfitLossColor(s.profit_loss)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" color="error" onClick={() => onDelete(s.id, s.symbol)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// 6. ETF tab (summary + DataGrid)
function ETFTab({
  etfs,
  currency,
  onDelete,
}: {
  etfs: HoldingAccountsResponse['holdings']['etfs'];
  currency: string;
  onDelete: (id: number, name: string) => void;
}) {
  const totalInvested = etfs.reduce((a, e) => a + e.invested_value, 0);
  const currentValue = etfs.reduce((a, e) => a + e.current_value, 0);
  const totalPnL = etfs.reduce((a, e) => a + e.profit_loss, 0);

  const cards = [
    { label: 'Total ETFs', value: etfs.length.toString(), color: '#667eea' },
    { label: 'Total Invested', value: formatCurrency(totalInvested, currency), color: '#764ba2' },
    { label: 'Current Value', value: formatCurrency(currentValue, currency), color: '#4facfe' },
    { label: 'Total P&L', value: formatCurrency(totalPnL, currency), color: totalPnL >= 0 ? '#43e97b' : '#f5576c' },
  ];

  const columns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 140,
      renderCell: (p: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{p.row.symbol}</Typography>
          <Typography variant="caption" color={getDaysAgoColor(p.row.updated_at)}>
            {formatDaysAgo(p.row.updated_at)}
          </Typography>
        </Box>
      ),
    },
    { field: 'quantity', headerName: 'Qty', width: 90, align: 'right', headerAlign: 'right', renderCell: (p) => <Typography variant="body2">{p.row.quantity}</Typography> },
    { field: 'average_price', headerName: 'Avg Price', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.average_price, currency) },
    { field: 'last_close_price', headerName: 'Last Close', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => p.row.last_close_price ? formatCurrency(p.row.last_close_price, currency) : '—' },
    { field: 'invested_value', headerName: 'Invested', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.invested_value, currency) },
    { field: 'current_value', headerName: 'Current Value', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.current_value, currency) },
    {
      field: 'profit_loss',
      headerName: 'P&L',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600} color={p.row.profit_loss >= 0 ? 'success.main' : 'error.main'}>
          {formatCurrency(p.row.profit_loss, currency)}
        </Typography>
      ),
    },
    {
      field: 'profit_loss_percentage',
      headerName: 'P&L %',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams) => (
        <Chip label={formatPercentage(p.row.profit_loss_percentage)} color={getProfitLossColor(p.row.profit_loss)} size="small" />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => (
        <IconButton size="small" color="error" onClick={() => onDelete(p.row.id, p.row.symbol)}>
          <Delete fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}>
            <Card sx={{ borderTop: `4px solid ${c.color}`, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{c.label}</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {etfs.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <ShowChart sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No ETFs in this account.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <Box sx={{ p: 1.5, background: 'linear-gradient(90deg,#f093fb,#f5576c)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} color="white">ETF Holdings</Typography>
            <Chip label={etfs.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
          </Box>
          <Box sx={{ height: 420 }}>
            <DataGrid
              rows={etfs}
              columns={columns}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick
              rowHeight={70}
              sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8f9ff' } }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}

// 7. MF + Bonds tab
function MFBondsTab({
  mutualFunds,
  bonds,
  currency,
  onDelete,
}: {
  mutualFunds: MutualFundHoldingDetail[];
  bonds: BondHoldingDetail[];
  currency: string;
  onDelete: (id: number, name: string) => void;
}) {
  const mfInvested = mutualFunds.reduce((a, m) => a + m.invested_value, 0);
  const mfCurrent = mutualFunds.reduce((a, m) => a + m.current_value, 0);
  const mfPnL = mutualFunds.reduce((a, m) => a + m.profit_loss, 0);
  const bondInvested = bonds.reduce((a, b) => a + b.invested_value, 0);
  const bondCurrent = bonds.reduce((a, b) => a + b.current_value, 0);

  const mfCards = [
    { label: 'Mutual Funds', value: mutualFunds.length.toString(), color: '#43e97b' },
    { label: 'MF Invested', value: formatCurrency(mfInvested, currency), color: '#38f9d7' },
    { label: 'MF Current', value: formatCurrency(mfCurrent, currency), color: '#4facfe' },
    { label: 'MF P&L', value: formatCurrency(mfPnL, currency), color: mfPnL >= 0 ? '#43e97b' : '#f5576c' },
  ];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {mfCards.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}>
            <Card sx={{ borderTop: `4px solid ${c.color}`, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{c.label}</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Mutual Funds table */}
      {mutualFunds.length > 0 && (
        <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <Box sx={{ p: 1.5, background: 'linear-gradient(90deg,#43e97b,#38f9d7)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PieChartIcon sx={{ color: 'white', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color="white">Mutual Funds</Typography>
            <Chip label={mutualFunds.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                  {['Name', 'Fund House', 'ISIN', 'Qty', 'Avg Price', 'Invested', 'Current Value', ''].map((h) => (
                    <TableCell key={h} align={['Qty', 'Avg Price', 'Invested', 'Current Value'].includes(h) ? 'right' : 'left'}>
                      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{h}</Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {mutualFunds.map((mf) => (
                  <TableRow key={mf.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{mf.name}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{mf.fund_house || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{mf.isin}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{mf.quantity}</Typography>
                      <Typography variant="caption" color={getDaysAgoColor(mf.updated_at)} display="block">
                        {formatDaysAgo(mf.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(mf.average_price, mf.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(mf.invested_value, mf.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(mf.current_value, mf.currency)}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => onDelete(mf.id, mf.name)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Bonds table */}
      {bonds.length > 0 && (
        <Paper sx={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <Box
            sx={{
              p: 1.5,
              background: 'linear-gradient(90deg,#fa709a,#fee140)',
              borderRadius: '4px 4px 0 0',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <MonetizationOn sx={{ color: 'white', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color="white">Bonds</Typography>
            <Chip label={bonds.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', ml: 1 }}>
              Invested: {formatCurrency(bondInvested, currency)} · Current: {formatCurrency(bondCurrent, currency)}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                  {['Name', 'ISIN', 'Qty', 'Avg Price', 'Face Value', 'Coupon', 'Maturity', 'Invested', 'Current Value', ''].map((h) => (
                    <TableCell key={h} align={['Qty', 'Avg Price', 'Face Value', 'Coupon', 'Invested', 'Current Value'].includes(h) ? 'right' : 'left'}>
                      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{h}</Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {bonds.map((bond) => (
                  <TableRow key={bond.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{bond.name}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{bond.isin}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{bond.quantity}</Typography>
                      <Typography variant="caption" color={getDaysAgoColor(bond.updated_at)} display="block">
                        {formatDaysAgo(bond.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(bond.average_price, bond.currency)}</TableCell>
                    <TableCell align="right">{bond.face_value ? formatCurrency(bond.face_value, bond.currency) : '—'}</TableCell>
                    <TableCell align="right">{bond.coupon_rate ? `${bond.coupon_rate}%` : '—'}</TableCell>
                    <TableCell>{bond.maturity_date ? new Date(bond.maturity_date).toLocaleDateString('en-IN') : '—'}</TableCell>
                    <TableCell align="right">{formatCurrency(bond.invested_value, bond.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(bond.current_value, bond.currency)}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => onDelete(bond.id, bond.name)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {mutualFunds.length === 0 && bonds.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <AccountBalance sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No Mutual Funds or Bonds in this account.</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ListHoldings: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [holdings, setHoldings] = useState<HoldingAccountsResponse | null>(null);

  // Active tab: 0=Stocks, 1=ETFs, 2=MF&Bonds
  const [tabValue, setTabValue] = useState(0);

  // Recommendation type filter (used in Stocks tab)
  const [recFilter, setRecFilter] = useState<string[]>(['BUY', 'SELL', 'HOLD']);

  useEffect(() => {
    if (accountId) loadHoldings();
  }, [accountId]);

  const loadHoldings = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getHoldings(accountId!);
      setHoldings(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHolding = async (holdingId: number, assetName: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete ${assetName}?`)) return;
    try {
      await holdingAccountsAPI.deleteHolding(accountId!, holdingId);
      setSuccess(`${assetName} deleted successfully`);
      await loadHoldings();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete holding');
    }
  };

  const handleRecFilterChange = (_: React.MouseEvent<HTMLElement>, v: string[]) => {
    if (v.length > 0) setRecFilter(v);
  };

  // symbol → sector map (built from stock holdings)
  const stockSectorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    holdings?.holdings.stocks.forEach((s: any) => {
      if (s.sector) map[s.symbol] = s.sector;
    });
    return map;
  }, [holdings?.holdings.stocks]);

  // Sector gap analysis
  const sectorAnalysis = useMemo(
    () => buildSectorAnalysis(holdings?.holdings.stocks ?? []),
    [holdings?.holdings.stocks]
  );

  const underSectors = useMemo(
    () => sectorAnalysis.filter((a) => a.isUnder).map((a) => a.sector),
    [sectorAnalysis]
  );

  // Stock aggregates
  const stockTotals = useMemo(() => {
    const stocks = holdings?.holdings.stocks ?? [];
    return {
      invested: stocks.reduce((a, s) => a + s.invested_value, 0),
      current: stocks.reduce((a, s) => a + s.current_value, 0),
      pnl: stocks.reduce((a, s) => a + s.profit_loss, 0),
    };
  }, [holdings?.holdings.stocks]);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading holdings…
        </Typography>
      </Container>
    );
  }

  if (error && !holdings) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error" onClose={() => navigate('/holding-accounts')}>{error}</Alert>
      </Container>
    );
  }

  if (!holdings) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="info">No holdings data available.</Alert>
      </Container>
    );
  }

  const { stocks, etfs, mutual_funds, bonds } = holdings.holdings;
  const recSummary = holdings.recommendations_summary;

  const tabConfig = [
    { label: 'Stocks', count: stocks.length, color: '#667eea' },
    { label: 'ETFs', count: etfs.length, color: '#f5576c' },
    { label: 'MF & Bonds', count: mutual_funds.length + bonds.length, color: '#43e97b' },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 4 }}>

      {/* ── Header ── */}
      <Box display="flex" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate('/holding-accounts')} sx={{ mr: 1 }}>
          <ArrowBack />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700}>
            Holdings — {holdings.account_id}
          </Typography>
          <Box display="flex" gap={1} alignItems="center" mt={0.5}>
            <Chip label={holdings.account_platform} color="primary" size="small" />
            <Chip label={holdings.currency} variant="outlined" size="small" />
            <Chip
              label={`${holdings.summary.total_holdings} holdings`}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* Recommendations summary (top-right) */}
        {recSummary && recSummary.total_count > 0 && (
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Lightbulb color="primary" fontSize="small" />
            <Chip label={`${recSummary.buy_count} BUY`} color="success" size="small" icon={<TrendingUp />} />
            <Chip label={`${recSummary.sell_count} SELL`} color="error" size="small" icon={<TrendingDown />} />
            <Chip label={`${recSummary.hold_count} HOLD`} color="warning" size="small" icon={<Timeline />} />
          </Box>
        )}
      </Box>

      {/* Alerts */}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ── Tabs ── */}
      <Paper sx={{ mb: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          TabIndicatorProps={{ style: { height: 3, borderRadius: 2 } }}
          sx={{
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.92rem', py: 1.5 },
          }}
        >
          {tabConfig.map((t, i) => (
            <Tab
              key={t.label}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {t.label}
                  <Chip
                    label={t.count}
                    size="small"
                    sx={{
                      height: 19,
                      fontSize: '0.68rem',
                      bgcolor: tabValue === i ? t.color : '#e0e0e0',
                      color: tabValue === i ? 'white' : '#666',
                      fontWeight: 700,
                    }}
                  />
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* ───────────────── STOCKS TAB ───────────────── */}
      <TabPanel value={tabValue} index={0}>
        {stocks.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center' }}>
            <ShowChart sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No stock holdings in this account.</Typography>
          </Paper>
        ) : (
          <>
            {/* 1. Summary cards */}
            <StockSummaryCards
              count={stocks.length}
              invested={stockTotals.invested}
              current={stockTotals.current}
              pnl={stockTotals.pnl}
              currency={holdings.currency}
            />

            {/* 2. Charts row 1: Invested by Sector + Sector Gap Analysis */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectorPieChart stocks={stocks} currency={holdings.currency} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectorAnalysisPanel
                  analysis={sectorAnalysis}
                  currency={holdings.currency}
                  totalInvested={stockTotals.invested}
                />
              </Grid>
            </Grid>

            {/* 2b. Charts row 2: P&L by Sector (full width) */}
            <Box sx={{ mb: 3 }}>
              <SectorPnLChart stocks={stocks} currency={holdings.currency} />
            </Box>

            {/* 3. Recommendations table (with priority highlighting) */}
            {holdings.recommendations && holdings.recommendations.length > 0 && (
              <StockRecommendationsTable
                recommendations={holdings.recommendations}
                underSectors={underSectors}
                stockSectorMap={stockSectorMap}
                currency={holdings.currency}
                recFilter={recFilter}
                onRecFilterChange={handleRecFilterChange}
              />
            )}

            {/* 4. Stock details table */}
            <StockDetailsTable
              stocks={stocks}
              currency={holdings.currency}
              onDelete={handleDeleteHolding}
            />
          </>
        )}
      </TabPanel>

      {/* ───────────────── ETFs TAB ───────────────── */}
      <TabPanel value={tabValue} index={1}>
        <ETFTab etfs={etfs} currency={holdings.currency} onDelete={handleDeleteHolding} />
      </TabPanel>

      {/* ───────────────── MF + BONDS TAB ───────────────── */}
      <TabPanel value={tabValue} index={2}>
        <MFBondsTab
          mutualFunds={mutual_funds}
          bonds={bonds}
          currency={holdings.currency}
          onDelete={handleDeleteHolding}
        />
      </TabPanel>

    </Container>
  );
};

export default ListHoldings;