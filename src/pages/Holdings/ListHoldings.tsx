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
  Checkbox,
  Button,
  CircularProgress,
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
  AutoAwesome,
  Refresh,
  CheckCircle,
  Cancel,
  FiberManualRecord,
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
const SECTOR_GAP_THRESHOLD = 2;

const PIE_COLORS = [
'#de324c',  '#f4895f',  '#f8e16f',  '#95cf92',  '#369acc',  '#9656a2', '#d8d8d8'
];

const PIE_NAMED_SECTORS = [
  'Finance',
  'Healthcare',
  'FMCG',
  'Software Services',
  'Energy',
  'Auto Ancillary',
];

// ─── AI Insights Types ────────────────────────────────────────────────────────

interface PhilosophyScore {
  name: string;
  score: number;
  note: string;
}

interface InsightFlag {
  ticker: string;
  flag_type: 'RED' | 'YELLOW' | 'GREEN';
  message: string;
  action: string;
}

interface SectorInsight {
  sector: string;
  commentary: string;
  status: 'STRONG' | 'NEUTRAL' | 'WEAK';
}

interface ActionItem {
  action: 'BUY' | 'HOLD' | 'EXIT' | 'TRIM' | 'REVIEW';
  tickers: string[];
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AIInsightsResponse {
  overall_health_score: number;
  overall_summary: string;
  philosophy_scores: PhilosophyScore[];
  key_flags: InsightFlag[];
  sector_insights: SectorInsight[];
  action_items: ActionItem[];
  generated_at: string;
}

// ─── 52W Range & MA helpers ──────────────────────────────────────────────────

const calculate52WeekPosition = (current: number | null, low: number | null, high: number | null): number => {
  if (current == null || low == null || high == null || high === low) return 0;
  return Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
};

const getProgressColor = (percentage: number): 'error' | 'warning' | 'success' => {
  if (percentage < 28) return 'success';
  if (percentage < 55) return 'warning';
  return 'error';
};

const getAvgPriceBuySignal = (
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const formatPercentage = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const getProfitLossColor = (value: number): 'success' | 'error' | 'default' => {
  if (value > 0) return 'success';
  if (value < 0) return 'error';
  return 'default';
};

const round2 = (v: number) => Math.round(v * 100) / 100;

const formatDaysAgo = (dateString: string): string => {
  const diff = Math.floor(Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
};

const getDaysAgoColor = (dateString: string): string => {
  const diff = Math.floor(Math.abs(new Date().getTime() - new Date(dateString).getTime()) / 86_400_000);
  return diff > 2 ? 'error.main' : '#00a556';
};

// ─── TabPanel ─────────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
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
  gap: number;
  isUnder: boolean;
}

function buildSectorAnalysis(stocks: Array<{ sector?: string | null; invested_value: number }>): SectorAnalysis[] {
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

// ─── AI Insights Tab ─────────────────────────────────────────────────────────

function AIInsightsTab({
  holdings,
  accountId,
}: {
  holdings: HoldingAccountsResponse;
  accountId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [error, setError] = useState<string>('');

  const generateInsights = async () => {
    setLoading(true);
    setError('');
    try {
      // Build a compact portfolio summary to send to the backend
      const portfolioPayload = {
        account_id: accountId,
        currency: holdings.currency,
        summary: holdings.summary,
        stocks: holdings.holdings.stocks.map((s: any) => ({
          symbol: s.symbol,
          sector: s.sector,
          quantity: s.quantity,
          average_price: s.average_price,
          last_close_price: s.last_close_price,
          invested_value: s.invested_value,
          current_value: s.current_value,
          profit_loss: s.profit_loss,
          profit_loss_percentage: s.profit_loss_percentage,
          price_52w_low: s.price_52w_low,
          price_52w_high: s.price_52w_high,
          moving_average_20: s.moving_average_20,
          pe_ratio: s.pe_ratio,
          rsi_index: s.rsi_index,
        })),
        etfs: holdings.holdings.etfs.map((e: any) => ({
          symbol: e.symbol,
          invested_value: e.invested_value,
          current_value: e.current_value,
          profit_loss: e.profit_loss,
          profit_loss_percentage: e.profit_loss_percentage,
        })),
        mutual_funds: holdings.holdings.mutual_funds.map((m: any) => ({
          name: m.name,
          invested_value: m.invested_value,
          current_value: m.current_value,
        })),
        bonds: holdings.holdings.bonds.map((b: any) => ({
          name: b.name,
          face_value: b.face_value,
          coupon_rate: b.coupon_rate,
          invested_value: b.invested_value,
        })),
      };
      
      const forceRefresh = !!insights; // Regenerate button = force refresh
      const response = await holdingAccountsAPI.getAiInsights(accountId, portfolioPayload, forceRefresh);
      setInsights(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate AI insights');
    } finally {
      setLoading(false);
    }
  };

  const flagColor = (type: InsightFlag['flag_type']) => {
    if (type === 'RED') return { bg: '#ffebee', border: '#ef9a9a', text: '#c62828', icon: <Cancel sx={{ fontSize: 18, color: '#c62828' }} /> };
    if (type === 'YELLOW') return { bg: '#fff8e1', border: '#ffe082', text: '#f57f17', icon: <Warning sx={{ fontSize: 18, color: '#f57f17' }} /> };
    return { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', icon: <CheckCircle sx={{ fontSize: 18, color: '#2e7d32' }} /> };
  };

  const actionColor = (action: ActionItem['action']) => {
    const map: Record<string, { bg: string; fg: string }> = {
      BUY: { bg: '#e8f5e9', fg: '#2e7d32' },
      HOLD: { bg: '#fff8e1', fg: '#f57f17' },
      EXIT: { bg: '#ffebee', fg: '#c62828' },
      TRIM: { bg: '#fff3e0', fg: '#e65100' },
      REVIEW: { bg: '#e3f2fd', fg: '#1565c0' },
    };
    return map[action] || { bg: '#f5f5f5', fg: '#555' };
  };

  const priorityDot = (priority: ActionItem['priority']) => {
    const colors: Record<string, string> = { HIGH: '#f44336', MEDIUM: '#ff9800', LOW: '#66bb6a' };
    return <FiberManualRecord sx={{ fontSize: 10, color: colors[priority] || '#bbb', mr: 0.5 }} />;
  };

  const sectorStatusColor = (status: SectorInsight['status']) => {
    if (status === 'STRONG') return 'success';
    if (status === 'WEAK') return 'error';
    return 'default';
  };

  const healthScoreColor = (score: number) => {
    if (score >= 75) return '#2e7d32';
    if (score >= 55) return '#f57f17';
    return '#c62828';
  };

  return (
    <Box>
      {/* Header bar */}
      <Paper
        sx={{
          p: 2,
          mb: 2.5,
          background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
          border: '1px solid #e3eaff',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesome sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Portfolio Insights — Powered by Claude AI
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Analysed against your Value Investing Philosophies &nbsp;·&nbsp; Indian Equity focus
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : insights ? <Refresh /> : <AutoAwesome />}
          onClick={generateInsights}
          disabled={loading}
          sx={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontWeight: 700,
            px: 3,
            '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a3f92)' },
          }}
        >
          {loading ? 'Analysing…' : insights ? 'Regenerate' : 'Generate Insights'}
        </Button>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading state */}
      {loading && (
        <Paper sx={{ p: 5, textAlign: 'center', border: '1px solid #e3eaff', borderRadius: 2 }}>
          <CircularProgress size={48} sx={{ color: '#667eea', mb: 2 }} />
          <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
            Claude is reviewing your portfolio…
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Checking against all 5 investment philosophies
          </Typography>
        </Paper>
      )}

      {/* Empty state */}
      {!loading && !insights && !error && (
        <Paper
          sx={{
            p: 6, textAlign: 'center',
            border: '2px dashed #e0e7ff', borderRadius: 2, bgcolor: '#fafbff',
          }}
        >
          <AutoAwesome sx={{ fontSize: 56, color: '#c5cae9', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
            No insights generated yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
            Click "Generate Insights" to get a personalised analysis of your portfolio aligned to your
            value investing philosophies — slow &amp; steady, defensive, diversification, value &amp; promoter integrity.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={generateInsights}
            sx={{ borderColor: '#667eea', color: '#667eea', fontWeight: 700 }}
          >
            Generate Insights
          </Button>
        </Paper>
      )}

      {/* ── Insights content ── */}
      {!loading && insights && (
        <Box>
          {/* Overall health score banner */}
          <Paper
            sx={{
              p: 2.5, mb: 2.5,
              border: `2px solid ${healthScoreColor(insights.overall_health_score)}22`,
              borderLeft: `5px solid ${healthScoreColor(insights.overall_health_score)}`,
              borderRadius: 2, bgcolor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{ color: healthScoreColor(insights.overall_health_score), lineHeight: 1 }}
                >
                  {insights.overall_health_score}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                  Health Score
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={insights.overall_health_score}
                  sx={{
                    mt: 0.5, height: 6, borderRadius: 3,
                    bgcolor: '#eee',
                    '& .MuiLinearProgress-bar': { bgcolor: healthScoreColor(insights.overall_health_score) },
                  }}
                />
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Overall Assessment
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {insights.overall_summary}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                  Generated at {new Date(insights.generated_at).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Row 1: Philosophy scores + Key flags */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {/* Philosophy scores */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2.5, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Star sx={{ fontSize: 18, color: '#f5a623' }} /> Philosophy Alignment
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  {insights.philosophy_scores.map((p) => (
                    <Box key={p.name}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                          {p.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ fontSize: '0.82rem', color: healthScoreColor(p.score) }}
                        >
                          {p.score}/100
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={p.score}
                        sx={{
                          height: 7, borderRadius: 3, bgcolor: '#eee',
                          '& .MuiLinearProgress-bar': { bgcolor: healthScoreColor(p.score), borderRadius: 3 },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                        {p.note}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>

            {/* Key flags */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2.5, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Warning sx={{ fontSize: 18, color: '#ff9800' }} /> Key Flags
                  <Chip
                    label={`${insights.key_flags.filter(f => f.flag_type === 'RED').length} critical`}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }}
                  />
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {insights.key_flags.map((flag, i) => {
                    const c = flagColor(flag.flag_type);
                    return (
                      <Box
                        key={i}
                        sx={{
                          p: 1.25, borderRadius: 1.5,
                          bgcolor: c.bg, border: `1px solid ${c.border}`,
                          display: 'flex', gap: 1, alignItems: 'flex-start',
                        }}
                      >
                        <Box sx={{ mt: 0.1 }}>{c.icon}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.2 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: c.text, fontSize: '0.8rem' }}>
                              {flag.ticker}
                            </Typography>
                            <Chip
                              label={flag.action}
                              size="small"
                              sx={{
                                height: 16, fontSize: '0.62rem', fontWeight: 700,
                                bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
                            {flag.message}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Row 2: Action items */}
          <Paper sx={{ p: 2.5, mb: 2.5, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Lightbulb sx={{ fontSize: 18, color: '#667eea' }} /> Recommended Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {insights.action_items.map((item, i) => {
                const c = actionColor(item.action);
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 2,
                      p: 1.5, borderRadius: 1.5,
                      bgcolor: c.bg, border: `1px solid ${c.fg}22`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 72 }}>
                      {priorityDot(item.priority)}
                      <Chip
                        label={item.action}
                        size="small"
                        sx={{ fontWeight: 700, bgcolor: c.bg, color: c.fg, border: `1px solid ${c.fg}55`, fontSize: '0.72rem' }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        {item.tickers.map((t) => (
                          <Chip
                            key={t}
                            label={t}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#fff', border: '1px solid #ddd' }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {item.reason}
                      </Typography>
                    </Box>
                    <Chip
                      label={item.priority}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.62rem', fontWeight: 600,
                        bgcolor: item.priority === 'HIGH' ? '#ffebee' : item.priority === 'MEDIUM' ? '#fff8e1' : '#f1f8e9',
                        color: item.priority === 'HIGH' ? '#c62828' : item.priority === 'MEDIUM' ? '#f57f17' : '#33691e',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* Row 3: Sector insights */}
          <Paper sx={{ p: 2.5, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <TrendingUp sx={{ fontSize: 18, color: '#43e97b' }} /> Sector Commentary
            </Typography>
            <Grid container spacing={1.5}>
              {insights.sector_insights.map((si) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={si.sector}>
                  <Box
                    sx={{
                      p: 1.5, borderRadius: 1.5, height: '100%',
                      border: '1px solid #eee', bgcolor: '#fafafa',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                        {si.sector}
                      </Typography>
                      <Chip
                        label={si.status}
                        size="small"
                        color={sectorStatusColor(si.status) as any}
                        sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', lineHeight: 1.5 }}>
                      {si.commentary}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Disclaimer */}
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', mt: 2, textAlign: 'center', fontStyle: 'italic' }}
          >
            AI-generated insights are for informational purposes only and do not constitute financial advice.
            Always conduct your own due diligence before making investment decisions.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
// (All original sub-components preserved below unchanged)

function StockSummaryCards({ count, invested, current, pnl, currency }: {
  count: number; invested: number; current: number; pnl: number; currency: string;
}) {
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const cards = [
    { label: 'Total Stocks', value: count.toString(), sub: 'Holdings', color: '#667eea', icon: <ShowChart /> },
    { label: 'Total Invested', value: formatCurrency(invested, currency), sub: 'Cost basis', color: '#764ba2', icon: <AttachMoney /> },
    { label: 'Current Value', value: formatCurrency(current, currency), sub: formatPercentage(((current - invested) / (invested || 1)) * 100) + ' total return', color: '#4facfe', icon: <TrendingUp /> },
    { label: 'Total P&L', value: formatCurrency(pnl, currency), sub: formatPercentage(pnlPct), color: pnl >= 0 ? '#43e97b' : '#f5576c', icon: pnl >= 0 ? <TrendingUp /> : <TrendingDown /> },
  ];
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((c) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}>
          <Card sx={{ borderTop: `4px solid ${c.color}`, background: 'linear-gradient(135deg,#fff 0%,#f8f9ff 100%)', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{c.label}</Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: c.color, mt: 0.5 }}>{c.value}</Typography>
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

function SectorPieChart({ stocks, currency }: { stocks: Array<{ sector?: string | null; invested_value: number }>; currency: string; }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    stocks.forEach((s) => {
      const raw = s.sector || 'Others';
      const key = PIE_NAMED_SECTORS.includes(raw) ? raw : 'Others';
      map[key] = (map[key] || 0) + s.invested_value;
    });
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
      <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
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
          <Pie data={data} cx="50%" cy="50%" outerRadius={150} dataKey="value" labelLine={false} label={renderLabel}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <RechartsTooltip formatter={(val: number, name: string) => [`${formatCurrency(val, currency)} (${((val / total) * 100).toFixed(1)}%)`, name]} />
          <Legend iconType="circle" iconSize={9} formatter={(value, entry: any) => <span style={{ fontSize: 11, color: '#555' }}>{value} — {formatCurrency(entry.payload.value, currency)}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
}

function SectorPnLChart({ stocks, currency }: { stocks: Array<{ sector?: string | null; invested_value: number; current_value: number; profit_loss: number; }>; currency: string; }) {
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
    const named = PIE_NAMED_SECTORS.filter((s) => map[s]).map((name) => ({
      name, invested: round2(map[name].invested), current: round2(map[name].current), pnl: round2(map[name].pnl),
      pnlPct: map[name].invested > 0 ? parseFloat(((map[name].pnl / map[name].invested) * 100).toFixed(2)) : 0,
    }));
    const oth = map['Others'];
    const others = oth ? [{ name: 'Others', invested: round2(oth.invested), current: round2(oth.current), pnl: round2(oth.pnl), pnlPct: oth.invested > 0 ? parseFloat(((oth.pnl / oth.invested) * 100).toFixed(2)) : 0 }] : [];
    return [...named, ...others];
  }, [stocks]);

  interface TooltipPayload { name: string; invested: number; current: number; pnl: number; pnlPct: number; }
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d: TooltipPayload = payload[0].payload;
    return (
      <Paper sx={{ p: 1.5, minWidth: 210, boxShadow: 4, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{label}</Typography>
        {[{ label: 'Invested', value: formatCurrency(d.invested, currency), color: 'text.primary' }, { label: 'Current', value: formatCurrency(d.current, currency), color: 'text.primary' }].map((row) => (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">{row.label}</Typography>
            <Typography variant="caption" fontWeight={600} color={row.color}>{row.value}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 0.75 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
          <Typography variant="caption" color="text.secondary">P&L</Typography>
          <Typography variant="caption" fontWeight={700} color={d.pnl >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(d.pnl, currency)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
          <Typography variant="caption" color="text.secondary">Return</Typography>
          <Typography variant="caption" fontWeight={700} color={d.pnlPct >= 0 ? 'success.main' : 'error.main'}>{d.pnlPct >= 0 ? '+' : ''}{d.pnlPct.toFixed(2)}%</Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Paper sx={{ p: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TrendingUp fontSize="small" sx={{ color: '#43e97b' }} /> P&L by Sector
      </Typography>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 24, right: 16, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatCurrency(v, currency)} width={95} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine y={0} stroke="#bbb" strokeWidth={1.5} />
          <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]} maxBarSize={80}>
            {data.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#4caf50' : '#f44336'} fillOpacity={0.82} />)}
            <LabelList dataKey="pnlPct" position="top" formatter={(v: any) => typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#444' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

function SectorAnalysisPanel({ analysis, currency, totalInvested }: { analysis: SectorAnalysis[]; currency: string; totalInvested: number; }) {
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
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>{a.sector}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={`${a.actualPct.toFixed(1)}%`} size="small" color={a.isUnder ? 'warning' : a.gap < -SECTOR_GAP_THRESHOLD ? 'error' : 'success'} sx={{ height: 18, fontSize: '0.68rem' }} />
                <Typography variant="caption" color="text.disabled">/ {a.targetPct}%</Typography>
              </Box>
            </Box>
            <Box sx={{ height: 7, borderRadius: 3, backgroundColor: '#eeeeee', overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, width: `${Math.min(100, (a.actualPct / (a.targetPct || 1)) * 100)}%`, backgroundColor: a.isUnder ? '#ff9800' : a.gap < -SECTOR_GAP_THRESHOLD ? '#f44336' : '#4caf50', transition: 'width 0.6s ease' }} />
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

function StockRecommendationsTable({ recommendations, underSectors, stockSectorMap, currency, recFilter, onRecFilterChange }: {
  recommendations: HoldingRecommendation[]; underSectors: string[]; stockSectorMap: Record<string, string>; currency: string; recFilter: string[]; onRecFilterChange: (_: React.MouseEvent<HTMLElement>, v: string[]) => void;
}) {
  const filtered = recommendations.filter((r) => r.is_active && recFilter.includes(r.recommendation_type));
  const isUnderInvested = (symbol: string): boolean => {
    const sec = stockSectorMap[symbol] || '';
    const isNamed = NAMED_SECTORS.includes(sec);
    return isNamed ? underSectors.includes(sec) : underSectors.includes('Others');
  };
  const columns: GridColDef[] = [
    { field: '_priority', headerName: '', width: 44, sortable: false, renderCell: (p: GridRenderCellParams) => isUnderInvested(p.row.stock_symbol) ? (<Tooltip title={`${stockSectorMap[p.row.stock_symbol] || 'Others'} sector is below target — priority buy`}><Star sx={{ color: '#f5a623', fontSize: 18 }} /></Tooltip>) : null },
    { field: 'stock_symbol', headerName: 'Symbol', width: 140, renderCell: (p: GridRenderCellParams) => { const priority = isUnderInvested(p.row.stock_symbol); return (<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}><Typography variant="body2" fontWeight={700}>{p.value as string}</Typography>{priority && (<Chip label="▲" size="small" sx={{ height: 17, fontSize: '0.62rem', bgcolor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }} />)}</Box>); } },
    { field: 'recommendation_type', headerName: 'Action', width: 100, renderCell: (p: GridRenderCellParams) => { const map: Record<string, { bg: string; fg: string }> = { BUY: { bg: '#e8f5e9', fg: '#2e7d32' }, SELL: { bg: '#ffebee', fg: '#c62828' }, HOLD: { bg: '#fff8e1', fg: '#f57f17' } }; const c = map[p.value as string] || { bg: '#f5f5f5', fg: '#555' }; return <Chip label={p.value as string} size="small" sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, minWidth: 52 }} />; } },
    { field: '_sector', headerName: 'Sector', width: 155, sortable: false, valueGetter: (_: any, row: HoldingRecommendation) => stockSectorMap[row.stock_symbol] || '—' },
    { field: 'current_quantity', headerName: 'Curr Qty', width: 88, type: 'number' },
    { field: 'recommended_quantity', headerName: 'Rec Qty', width: 88, type: 'number', renderCell: (p: GridRenderCellParams) => (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}><Typography variant="body2" fontWeight={700} color="primary">{p.value as number}</Typography></Box>) },
    { field: 'current_average_price', headerName: 'Avg Price', width: 125, type: 'number', valueFormatter: (v: number) => formatCurrency(v, currency) },
    { field: 'target_price', headerName: 'Target', width: 125, type: 'number', renderCell: (p: GridRenderCellParams) => (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}><Typography variant="body2" fontWeight={700} color="success.main">{formatCurrency(p.value as number, currency)}</Typography></Box>) },
    { field: 'price_52w_low', headerName: '52W Low', width: 120, type: 'number', valueFormatter: (v: number) => formatCurrency(v, currency) },
    { field: 'pe_ratio', headerName: 'P/E', width: 75, type: 'number', valueFormatter: (v: number | null) => (v != null ? v.toFixed(1) : '—') },
    { field: 'rsi_index', headerName: 'RSI', width: 75, type: 'number', renderCell: (p: GridRenderCellParams) => { const rsi = p.value as number | null; if (rsi == null) return <Typography variant="body2" color="text.disabled">—</Typography>; const color = rsi < 30 ? 'success.main' : rsi > 70 ? 'error.main' : 'text.primary'; return (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}><Typography variant="body2" fontWeight={600} color={color}>{rsi.toFixed(1)}</Typography></Box>); } },
    { field: 'pegy_index', headerName: 'PEGY', width: 75, type: 'number', valueFormatter: (v: number | null) => (v != null ? v.toFixed(2) : '—') },
    { field: 'recommendation_date', headerName: 'Date', width: 105, renderCell: (p: GridRenderCellParams) => (<Box><Typography variant="caption" display="block">{new Date(p.value as string).toLocaleDateString('en-IN')}</Typography><Typography variant="caption" color={getDaysAgoColor(p.value as string)}>{formatDaysAgo(p.value as string)}</Typography></Box>) },
  ];
  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box sx={{ p: 1.5, background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Lightbulb sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">Stock Recommendations</Typography>
        <Chip label={`${filtered.length} shown`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'white', fontWeight: 700, height: 20 }} />
        {underSectors.length > 0 && (<Chip icon={<Star sx={{ color: '#f5a623 !important', fontSize: '14px !important' }} />} label="★ = priority sector" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.7rem', height: 20 }} />)}
        <Box sx={{ ml: 'auto' }}>
          <ToggleButtonGroup value={recFilter} onChange={onRecFilterChange} size="small" sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)', py: 0.25, px: 1.25, fontSize: '0.72rem' }, '& .Mui-selected': { color: 'white !important', bgcolor: 'rgba(255,255,255,0.2) !important' } }}>
            <ToggleButton value="BUY">BUY</ToggleButton>
            <ToggleButton value="SELL">SELL</ToggleButton>
            <ToggleButton value="HOLD">HOLD</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Box sx={{ height: Math.min(480, 56 + filtered.length * 56 + 60) }}>
        <DataGrid rows={filtered} columns={columns} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick rowHeight={56} getRowClassName={(params) => isUnderInvested(params.row.stock_symbol) ? 'priority-row' : ''} sx={{ border: 'none', '& .priority-row': { bgcolor: '#fff8e1', '&:hover': { bgcolor: '#ffecb3' } }, '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8f9ff' } }} />
      </Box>
    </Paper>
  );
}

function StockDetailsTable({ stocks, onDelete }: {
  stocks: Array<{ id: number; symbol: string; name?: string | null; sector?: string | null; quantity: number; average_price: number; last_close_price?: number | null; price_52w_low?: number | null; price_52w_high?: number | null; moving_average_20?: number | null; moving_average_200?: number | null; invested_value: number; current_value: number; profit_loss: number; profit_loss_percentage: number; currency: string; updated_at: string; }>;
  currency: string;
  onDelete: (id: number, name: string) => void;
}) {
  type SortKey = 'symbol' | 'invested_value' | 'current_value' | 'profit_loss' | 'profit_loss_percentage' | 'quantity' | 'average_price';
  const [sortBy, setSortBy] = useState<SortKey>('invested_value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [sectorButtonFilter, setSectorButtonFilter] = useState<string>('All');
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'symbol' ? 'asc' : 'desc'); }
  };

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => set.add(s.sector || 'Unknown'));
    return ['All', ...Array.from(set).sort()];
  }, [stocks]);

  const filteredByButton = sectorButtonFilter === 'All' ? stocks : sectorButtonFilter === 'Others' ? stocks.filter((s) => !['Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Software Services', 'Energy'].includes(s.sector || '')) : stocks.filter((s) => s.sector === sectorButtonFilter);
  const filteredStocks = sectorFilter === 'All' ? filteredByButton : filteredByButton.filter((s) => (s.sector || 'Unknown') === sectorFilter);
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === 'symbol') { const cmp = (a.symbol ?? '').localeCompare(b.symbol ?? ''); return sortDir === 'asc' ? cmp : -cmp; }
    return sortDir === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
  });

  const handleGetSymbols = () => {
    const selectedStockData = stocks.filter(stock => selectedStocks.includes(stock.symbol)).map(stock => ({ symbol: stock.symbol, price: stock.last_close_price ? Math.round(stock.last_close_price) : 0 })).sort((a, b) => a.symbol.localeCompare(b.symbol));
    const formattedOutput = selectedStockData.map(stock => `${stock.symbol} - ${stock.price}`).join('\n');
    navigator.clipboard.writeText(formattedOutput).then(() => { alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}\n\nCopied to clipboard!`); }).catch(err => { console.error('Failed to copy to clipboard:', err); alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}`); });
  };

  const sortHeader = (col: SortKey, label: string) => (
    <TableSortLabel active={sortBy === col} direction={sortBy === col ? sortDir : 'desc'} onClick={() => handleSort(col)}>
      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{label}</Typography>
    </TableSortLabel>
  );

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box sx={{ p: 1.5, background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShowChart sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">Stock Holdings</Typography>
        <Chip label={sectorFilter === 'All' ? stocks.length : `${sortedStocks.length} / ${stocks.length}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {selectedStocks.length > 0 && (<Button variant="contained" size="small" onClick={handleGetSymbols} sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 600, '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' } }}>Get Symbols ({selectedStocks.length})</Button>)}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', '&.Mui-focused': { color: 'white' } }}>Sector</InputLabel>
            <Select value={sectorFilter} label="Sector" onChange={(e) => setSectorFilter(e.target.value)} sx={{ color: 'white', fontSize: '0.82rem', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}>
              {sectorOptions.map((opt) => <MenuItem key={opt} value={opt} sx={{ fontSize: '0.82rem' }}>{opt}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fafafa' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['All', 'Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Software Services', 'Energy', 'Others'].map((sec) => (
            <Button key={sec} variant={sectorButtonFilter === sec ? 'contained' : 'outlined'} size="small" onClick={() => setSectorButtonFilter(sec)} sx={{ fontSize: '0.72rem', py: 0.4, px: 1.5, textTransform: 'none', fontWeight: sectorButtonFilter === sec ? 700 : 500, ...(sectorButtonFilter === sec ? { bgcolor: '#1976d2', color: 'white', '&:hover': { bgcolor: '#1565c0' } } : { borderColor: '#ddd', color: 'text.secondary', '&:hover': { borderColor: '#bbb', bgcolor: '#f5f5f5' } }) }}>
              {sec}
            </Button>
          ))}
        </Box>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9ff' }}>
              <TableCell padding="checkbox">
                <Checkbox checked={selectedStocks.length === filteredStocks.length && filteredStocks.length > 0} indeterminate={selectedStocks.length > 0 && selectedStocks.length < filteredStocks.length} onChange={(e) => { if (e.target.checked) { setSelectedStocks(filteredStocks.map(s => s.symbol)); } else { setSelectedStocks([]); } }} size="small" />
              </TableCell>
              <TableCell>{sortHeader('symbol', 'Symbol')}</TableCell>
              <TableCell><Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Sector</Typography></TableCell>
              <TableCell align="center"><Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Last Close / 52W Range</Typography></TableCell>
              <TableCell align="right">{sortHeader('quantity', 'Qty')}</TableCell>
              <TableCell align="right">{sortHeader('average_price', 'Avg. Price')}</TableCell>
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
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedStocks.includes(s.symbol)} onChange={(e) => { if (e.target.checked) { setSelectedStocks([...selectedStocks, s.symbol]); } else { setSelectedStocks(selectedStocks.filter(sym => sym !== s.symbol)); } }} size="small" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{s.symbol}</Typography>
                  <Typography variant="caption" color={getDaysAgoColor(s.updated_at)}>{formatDaysAgo(s.updated_at)}</Typography>
                </TableCell>
                <TableCell>
                  {s.sector ? <Chip label={s.sector} size="small" sx={{ height: 19, fontSize: '0.68rem' }} /> : <Typography variant="body2" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {s.price_52w_low != null && s.price_52w_high != null && s.last_close_price != null ? (
                    <Tooltip title={<Box><Typography variant="caption" display="block">Current: {formatCurrency(s.last_close_price, s.currency)}</Typography><Typography variant="caption" display="block">52w Low: {formatCurrency(s.price_52w_low, s.currency)}</Typography><Typography variant="caption" display="block">52w High: {formatCurrency(s.price_52w_high, s.currency)}</Typography><Typography variant="caption" display="block" fontWeight={600}>Position: {calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high).toFixed(1)}%</Typography></Box>} arrow>
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
                        <Typography variant="caption" fontSize="0.6rem" color="text.primary" fontWeight={700} textAlign="center">{s.last_close_price ? formatCurrency(s.last_close_price, s.currency) : '—'}</Typography>
                        <LinearProgress variant="determinate" value={calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high)} color={getProgressColor(calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high))} sx={{ height: 6, borderRadius: 1, backgroundColor: 'grey.300' }} />
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="caption" fontSize="0.6rem" color="text.secondary" fontWeight={500}>{formatCurrency(s.price_52w_low, s.currency)}</Typography>
                          <Typography variant="caption" fontSize="0.6rem" color="text.secondary" fontWeight={500}>{formatCurrency(s.price_52w_high, s.currency)}</Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.secondary">No data</Typography>
                  )}
                </TableCell>
                <TableCell align="right"><Typography variant="body2">{s.quantity.toLocaleString()}</Typography></TableCell>
                <TableCell align="right">
                  {s.average_price ? (
                    <Tooltip title={<Box><Typography variant="caption" display="block" fontWeight={600}>Avg Price: {formatCurrency(s.average_price, s.currency)}</Typography><Typography variant="caption" display="block">Last Close: {s.last_close_price ? formatCurrency(s.last_close_price, s.currency) : 'N/A'}</Typography><Typography variant="caption" display="block">MA(20): {s.moving_average_20 ? formatCurrency(s.moving_average_20, s.currency) : 'N/A'}</Typography><Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}><Typography variant="caption" display="block" fontSize="0.65rem">{s.average_price && s.last_close_price && s.moving_average_20 && s.average_price < s.last_close_price && s.average_price < s.moving_average_20 ? '✅ Good entry - Price is up from your purchase' : s.average_price && s.last_close_price && s.moving_average_20 && s.average_price > s.last_close_price && s.average_price > s.moving_average_20 && s.last_close_price < s.moving_average_20 ? '💡 Strong opportunity to average down (price < MA20)' : s.average_price && s.last_close_price && s.moving_average_20 && s.average_price > s.last_close_price && s.average_price > s.moving_average_20 && s.last_close_price > s.moving_average_20 ? '💡 Consider averaging down (price > MA20)' : 'Mixed signals'}</Typography></Box></Box>} arrow>
                      <Box>
                        {s.last_close_price && s.moving_average_20 ? (() => {
                          const signal = getAvgPriceBuySignal(s.average_price, s.last_close_price, s.moving_average_20);
                          let symbolPrefix = ''; let symbolColor = '';
                          if (signal.signal === 'Strong Buy') { symbolPrefix = '✓✓ '; symbolColor = '#2e7d32'; }
                          else if (signal.signal === 'Light Buy') { symbolPrefix = '✓ '; symbolColor = '#7cb342'; }
                          else if (signal.signal === 'No Buy') { symbolPrefix = '✗ '; symbolColor = '#e35252'; }
                          else if (signal.signal === 'Strong No Buy') { symbolPrefix = '✗✗ '; symbolColor = '#d32f2f'; }
                          return (<><Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'end', gap: 0.5 }}>{symbolPrefix && (<Typography variant="body2" fontWeight={700} sx={{ color: symbolColor, mr: 0.5 }}>{symbolPrefix}</Typography>)}<Typography variant="body2" fontWeight={600}>{formatCurrency(s.average_price, s.currency)}</Typography></Box></>);
                        })() : <Typography variant="body2" fontWeight={600}>{formatCurrency(s.average_price, s.currency)}</Typography>}
                      </Box>
                    </Tooltip>
                  ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell align="right"><Typography variant="body2">{formatCurrency(s.invested_value, s.currency)}</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2">{formatCurrency(s.current_value, s.currency)}</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2" fontWeight={600} color={s.profit_loss >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(s.profit_loss, s.currency)}</Typography></TableCell>
                <TableCell align="right"><Chip label={formatPercentage(s.profit_loss_percentage)} color={getProfitLossColor(s.profit_loss)} size="small" /></TableCell>
                <TableCell align="center"><IconButton size="small" color="error" onClick={() => onDelete(s.id, s.symbol)}><Delete fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function ETFTab({ etfs, currency, onDelete }: { etfs: HoldingAccountsResponse['holdings']['etfs']; currency: string; onDelete: (id: number, name: string) => void; }) {
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
    { field: 'symbol', headerName: 'Symbol', width: 140, renderCell: (p: GridRenderCellParams) => (<Box><Typography variant="body2" fontWeight={600}>{p.row.symbol}</Typography><Typography variant="caption" color={getDaysAgoColor(p.row.updated_at)}>{formatDaysAgo(p.row.updated_at)}</Typography></Box>) },
    { field: 'quantity', headerName: 'Qty', width: 90, align: 'right', headerAlign: 'right', renderCell: (p) => <Typography variant="body2">{p.row.quantity}</Typography> },
    { field: 'average_price', headerName: 'Avg Price', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.average_price, currency) },
    { field: 'last_close_price', headerName: 'Last Close', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => p.row.last_close_price ? formatCurrency(p.row.last_close_price, currency) : '—' },
    { field: 'invested_value', headerName: 'Invested', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.invested_value, currency) },
    { field: 'current_value', headerName: 'Current Value', width: 130, align: 'right', headerAlign: 'right', renderCell: (p) => formatCurrency(p.row.current_value, currency) },
    { field: 'profit_loss', headerName: 'P&L', width: 130, align: 'right', headerAlign: 'right', renderCell: (p: GridRenderCellParams) => (<Typography variant="body2" fontWeight={600} color={p.row.profit_loss >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(p.row.profit_loss, currency)}</Typography>) },
    { field: 'profit_loss_percentage', headerName: 'P&L %', width: 100, align: 'right', headerAlign: 'right', renderCell: (p: GridRenderCellParams) => <Chip label={formatPercentage(p.row.profit_loss_percentage)} color={getProfitLossColor(p.row.profit_loss)} size="small" /> },
    { field: 'actions', headerName: '', width: 56, sortable: false, renderCell: (p: GridRenderCellParams) => (<IconButton size="small" color="error" onClick={() => onDelete(p.row.id, p.row.symbol)}><Delete fontSize="small" /></IconButton>) },
  ];
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (<Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}><Card sx={{ borderTop: `4px solid ${c.color}`, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}><CardContent sx={{ pb: '12px !important' }}><Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{c.label}</Typography><Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography></CardContent></Card></Grid>))}
      </Grid>
      {etfs.length === 0 ? (<Paper sx={{ p: 5, textAlign: 'center' }}><ShowChart sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} /><Typography color="text.secondary">No ETFs in this account.</Typography></Paper>) : (
        <Paper sx={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <Box sx={{ p: 1.5, background: 'linear-gradient(90deg,#f093fb,#f5576c)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} color="white">ETF Holdings</Typography>
            <Chip label={etfs.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
          </Box>
          <Box sx={{ height: 420 }}>
            <DataGrid rows={etfs} columns={columns} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick rowHeight={70} sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8f9ff' } }} />
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function MFBondsTab({ mutualFunds, bonds, currency, onDelete }: { mutualFunds: MutualFundHoldingDetail[]; bonds: BondHoldingDetail[]; currency: string; onDelete: (id: number, name: string) => void; }) {
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
        {mfCards.map((c) => (<Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}><Card sx={{ borderTop: `4px solid ${c.color}`, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}><CardContent sx={{ pb: '12px !important' }}><Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{c.label}</Typography><Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography></CardContent></Card></Grid>))}
      </Grid>
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
                  {['Name', 'Fund House', 'ISIN', 'Qty', 'Avg Price', 'Invested', 'Current Value', ''].map((h) => (<TableCell key={h} align={['Qty', 'Avg Price', 'Invested', 'Current Value'].includes(h) ? 'right' : 'left'}><Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{h}</Typography></TableCell>))}
                </TableRow>
              </TableHead>
              <TableBody>
                {mutualFunds.map((mf) => (
                  <TableRow key={mf.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{mf.name}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{mf.fund_house || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{mf.isin}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{mf.quantity}</Typography><Typography variant="caption" color={getDaysAgoColor(mf.updated_at)} display="block">{formatDaysAgo(mf.updated_at)}</Typography></TableCell>
                    <TableCell align="right">{formatCurrency(mf.average_price, mf.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(mf.invested_value, mf.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(mf.current_value, mf.currency)}</TableCell>
                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => onDelete(mf.id, mf.name)}><Delete fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      {bonds.length > 0 && (
        <Paper sx={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <Box sx={{ p: 1.5, background: 'linear-gradient(90deg,#fa709a,#fee140)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <MonetizationOn sx={{ color: 'white', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color="white">Bonds</Typography>
            <Chip label={bonds.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', ml: 1 }}>Invested: {formatCurrency(bondInvested, currency)} · Current: {formatCurrency(bondCurrent, currency)}</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                  {['Name', 'ISIN', 'Qty', 'Avg Price', 'Face Value', 'Coupon', 'Maturity', 'Invested', 'Current Value', ''].map((h) => (<TableCell key={h} align={['Qty', 'Avg Price', 'Face Value', 'Coupon', 'Invested', 'Current Value'].includes(h) ? 'right' : 'left'}><Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{h}</Typography></TableCell>))}
                </TableRow>
              </TableHead>
              <TableBody>
                {bonds.map((bond) => (
                  <TableRow key={bond.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{bond.name}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{bond.isin}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{bond.quantity}</Typography><Typography variant="caption" color={getDaysAgoColor(bond.updated_at)} display="block">{formatDaysAgo(bond.updated_at)}</Typography></TableCell>
                    <TableCell align="right">{formatCurrency(bond.average_price, bond.currency)}</TableCell>
                    <TableCell align="right">{bond.face_value ? formatCurrency(bond.face_value, bond.currency) : '—'}</TableCell>
                    <TableCell align="right">{bond.coupon_rate ? `${bond.coupon_rate}%` : '—'}</TableCell>
                    <TableCell>{bond.maturity_date ? new Date(bond.maturity_date).toLocaleDateString('en-IN') : '—'}</TableCell>
                    <TableCell align="right">{formatCurrency(bond.invested_value, bond.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(bond.current_value, bond.currency)}</TableCell>
                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => onDelete(bond.id, bond.name)}><Delete fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      {mutualFunds.length === 0 && bonds.length === 0 && (<Paper sx={{ p: 5, textAlign: 'center' }}><AccountBalance sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} /><Typography color="text.secondary">No Mutual Funds or Bonds in this account.</Typography></Paper>)}
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
  const [tabValue, setTabValue] = useState(0);
  const [recFilter, setRecFilter] = useState<string[]>(['BUY', 'SELL', 'HOLD']);

  useEffect(() => { if (accountId) loadHoldings(); }, [accountId]);

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

  const stockSectorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    holdings?.holdings.stocks.forEach((s: any) => { if (s.sector) map[s.symbol] = s.sector; });
    return map;
  }, [holdings?.holdings.stocks]);

  const sectorAnalysis = useMemo(() => buildSectorAnalysis(holdings?.holdings.stocks ?? []), [holdings?.holdings.stocks]);
  const underSectors = useMemo(() => sectorAnalysis.filter((a) => a.isUnder).map((a) => a.sector), [sectorAnalysis]);

  const stockTotals = useMemo(() => {
    const stocks = holdings?.holdings.stocks ?? [];
    return { invested: stocks.reduce((a, s) => a + s.invested_value, 0), current: stocks.reduce((a, s) => a + s.current_value, 0), pnl: stocks.reduce((a, s) => a + s.profit_loss, 0) };
  }, [holdings?.holdings.stocks]);

  const combinedTotals = useMemo(() => {
    const stocks = holdings?.holdings.stocks ?? [];
    const etfs = holdings?.holdings.etfs ?? [];
    const stockInvested = stocks.reduce((a, s) => a + s.invested_value, 0);
    const stockCurrent = stocks.reduce((a, s) => a + s.current_value, 0);
    const etfInvested = etfs.reduce((a, e) => a + e.invested_value, 0);
    const etfCurrent = etfs.reduce((a, e) => a + e.current_value, 0);
    const totalInvested = stockInvested + etfInvested;
    const totalCurrent = stockCurrent + etfCurrent;
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { stockInvested, stockCurrent, etfInvested, etfCurrent, totalInvested, totalCurrent, totalPnl, totalPnlPct, stockCount: stocks.length, etfCount: etfs.length };
  }, [holdings?.holdings.stocks, holdings?.holdings.etfs]);

  if (loading) {
    return (<Container maxWidth="xl" sx={{ mt: 4 }}><LinearProgress /><Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>Loading holdings…</Typography></Container>);
  }
  if (error && !holdings) {
    return (<Container maxWidth="xl" sx={{ mt: 4 }}><Alert severity="error" onClose={() => navigate('/holding-accounts')}>{error}</Alert></Container>);
  }
  if (!holdings) {
    return (<Container maxWidth="xl" sx={{ mt: 4 }}><Alert severity="info">No holdings data available.</Alert></Container>);
  }

  const { stocks, etfs, mutual_funds, bonds } = holdings.holdings;
  const recSummary = holdings.recommendations_summary;

  // 4 tabs: Stocks, ETFs, MF & Bonds, AI Insights
  const tabConfig = [
    { label: 'Stocks', count: stocks.length, color: '#667eea' },
    { label: 'ETFs', count: etfs.length, color: '#f5576c' },
    { label: 'MF & Bonds', count: mutual_funds.length + bonds.length, color: '#43e97b' },
    { label: 'AI Insights', count: null, color: '#764ba2' },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 4 }}>
      {/* ── Header ── */}
      <Box display="flex" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate('/holding-accounts')} sx={{ mr: 1 }}><ArrowBack /></IconButton>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700}>Holdings — {holdings.account_id}</Typography>
          <Box display="flex" gap={1} alignItems="center" mt={0.5}>
            <Chip label={holdings.account_platform} color="primary" size="small" />
            <Chip label={holdings.currency} variant="outlined" size="small" />
            <Chip label={`${holdings.summary.total_holdings} holdings`} variant="outlined" size="small" />
          </Box>
        </Box>
        {recSummary && recSummary.total_count > 0 && (
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Lightbulb color="primary" fontSize="small" />
            <Chip label={`${recSummary.buy_count} BUY`} color="success" size="small" icon={<TrendingUp />} />
            <Chip label={`${recSummary.sell_count} SELL`} color="error" size="small" icon={<TrendingDown />} />
            <Chip label={`${recSummary.hold_count} HOLD`} color="warning" size="small" icon={<Timeline />} />
          </Box>
        )}
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ── Stocks + ETFs Combined Summary ── */}
      {(combinedTotals.stockCount > 0 || combinedTotals.etfCount > 0) && (() => {
        const stockPnl = combinedTotals.stockCurrent - combinedTotals.stockInvested;
        const etfPnl = combinedTotals.etfCurrent - combinedTotals.etfInvested;
        const chartData = [{ name: 'Stocks', invested: round2(combinedTotals.stockInvested), current: round2(combinedTotals.stockCurrent), pnl: round2(stockPnl) }, { name: 'ETFs', invested: round2(combinedTotals.etfInvested), current: round2(combinedTotals.etfCurrent), pnl: round2(etfPnl) }];
        const C_INVESTED = '#667eea'; const C_CURRENT = '#4facfe'; const C_PNL_POS = '#43e97b'; const C_PNL_NEG = '#f5576c';
        const fmt = (v: number) => formatCurrency(v, holdings.currency);
        const pnlPct = (pnl: number, inv: number) => inv > 0 ? ` (${pnl >= 0 ? '+' : ''}${((pnl / inv) * 100).toFixed(2)}%)` : '';
        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          const inv = payload.find((p: any) => p.dataKey === 'invested')?.value ?? 0;
          const cur = payload.find((p: any) => p.dataKey === 'current')?.value ?? 0;
          const pnl = payload.find((p: any) => p.dataKey === 'pnl')?.value ?? 0;
          return (<Paper sx={{ p: 1.25, minWidth: 200, boxShadow: 4, border: '1px solid', borderColor: 'divider' }}><Typography variant="subtitle2" fontWeight={700} mb={0.5}>{label}</Typography>{[{ label: 'Invested', value: fmt(inv), color: C_INVESTED }, { label: 'Current Value', value: fmt(cur), color: C_CURRENT }].map(row => (<Box key={row.label} display="flex" justifyContent="space-between" gap={2} mb={0.2}><Typography variant="caption" color="text.secondary">{row.label}</Typography><Typography variant="caption" fontWeight={700} color={row.color}>{row.value}</Typography></Box>))}<Divider sx={{ my: 0.5 }} /><Box display="flex" justifyContent="space-between" gap={2}><Typography variant="caption" color="text.secondary">P&amp;L</Typography><Typography variant="caption" fontWeight={700} color={pnl >= 0 ? 'success.main' : 'error.main'}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}{pnlPct(pnl, inv)}</Typography></Box></Paper>);
        };
        return (
          <Paper sx={{ mb: 2, px: 3, py: 1.75, background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <AccountBalance sx={{ fontSize: 16, color: '#667eea' }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>Stocks + ETFs Overview</Typography>
              <Chip label={`${combinedTotals.stockCount} stocks · ${combinedTotals.etfCount} ETFs`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }} />
            </Box>
            <Box display="flex" gap={0} flexWrap="wrap" alignItems="flex-start">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pr: 3, mr: 3, borderRight: '1px solid', borderColor: 'divider', minWidth: 160 }}>
                <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Amount Invested</Typography><Typography variant="h6" fontWeight={700} lineHeight={1.2}>{fmt(combinedTotals.totalInvested)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Current Value</Typography><Typography variant="h6" fontWeight={700} lineHeight={1.2}>{fmt(combinedTotals.totalCurrent)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Total P&amp;L</Typography><Box display="flex" alignItems="baseline" gap={0.75}><Typography variant="h6" fontWeight={700} lineHeight={1.2} color={combinedTotals.totalPnl >= 0 ? 'success.main' : 'error.main'}>{combinedTotals.totalPnl >= 0 ? '+' : ''}{fmt(combinedTotals.totalPnl)}</Typography><Chip label={formatPercentage(combinedTotals.totalPnlPct)} size="small" color={combinedTotals.totalPnl >= 0 ? 'success' : 'error'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} /></Box></Box>
              </Box>
              <Box sx={{ flex: 1, minWidth: 320 }}>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }} barCategoryGap="28%" barGap={3}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v, holdings.currency)} tick={{ display: 'none' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 12, fontWeight: 600, fill: '#444' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Bar dataKey="invested" name="Invested" fill={C_INVESTED} radius={[0, 3, 3, 0]} barSize={14}><LabelList dataKey="invested" position="right" formatter={(v: any) => typeof v === 'number' ? fmt(v) : ''} style={{ fontSize: 10, fontWeight: 600, fill: C_INVESTED }} /></Bar>
                    <Bar dataKey="current" name="Current" fill={C_CURRENT} radius={[0, 3, 3, 0]} barSize={14}><LabelList dataKey="current" position="right" formatter={(v: any) => typeof v === 'number' ? fmt(v) : ''} style={{ fontSize: 10, fontWeight: 600, fill: C_CURRENT }} /></Bar>
                    <Bar dataKey="pnl" name="P&L" radius={[0, 3, 3, 0]} barSize={14}>{chartData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? C_PNL_POS : C_PNL_NEG} />)}<LabelList dataKey="pnl" position="right" formatter={(v: any) => typeof v === 'number' ? `${v >= 0 ? '+' : ''}${fmt(v)}` : ''} style={{ fontSize: 10, fontWeight: 700, fill: '#555' }} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Paper>
        );
      })()}

      {/* ── Tabs ── */}
      <Paper sx={{ mb: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" TabIndicatorProps={{ style: { height: 3, borderRadius: 2 } }} sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.92rem', py: 1.5 } }}>
          {tabConfig.map((t, i) => (
            <Tab key={t.label} label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {t.label === 'AI Insights' && <AutoAwesome sx={{ fontSize: 16, color: tabValue === i ? '#764ba2' : '#aaa' }} />}
                {t.label}
                {t.count !== null && (
                  <Chip label={t.count} size="small" sx={{ height: 19, fontSize: '0.68rem', bgcolor: tabValue === i ? t.color : '#e0e0e0', color: tabValue === i ? 'white' : '#666', fontWeight: 700 }} />
                )}
              </Box>
            } />
          ))}
        </Tabs>
      </Paper>

      {/* ── Stocks Tab ── */}
      <TabPanel value={tabValue} index={0}>
        {stocks.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center' }}><ShowChart sx={{ fontSize: 52, color: 'text.secondary', mb: 1 }} /><Typography color="text.secondary">No stock holdings in this account.</Typography></Paper>
        ) : (
          <>
            <StockSummaryCards count={stocks.length} invested={stockTotals.invested} current={stockTotals.current} pnl={stockTotals.pnl} currency={holdings.currency} />
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}><SectorPieChart stocks={stocks} currency={holdings.currency} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><SectorAnalysisPanel analysis={sectorAnalysis} currency={holdings.currency} totalInvested={stockTotals.invested} /></Grid>
            </Grid>
            <Box sx={{ mb: 3 }}><SectorPnLChart stocks={stocks} currency={holdings.currency} /></Box>
            {holdings.recommendations && holdings.recommendations.length > 0 && (<StockRecommendationsTable recommendations={holdings.recommendations} underSectors={underSectors} stockSectorMap={stockSectorMap} currency={holdings.currency} recFilter={recFilter} onRecFilterChange={handleRecFilterChange} />)}
            <StockDetailsTable stocks={stocks} currency={holdings.currency} onDelete={handleDeleteHolding} />
          </>
        )}
      </TabPanel>

      {/* ── ETFs Tab ── */}
      <TabPanel value={tabValue} index={1}>
        <ETFTab etfs={etfs} currency={holdings.currency} onDelete={handleDeleteHolding} />
      </TabPanel>

      {/* ── MF + Bonds Tab ── */}
      <TabPanel value={tabValue} index={2}>
        <MFBondsTab mutualFunds={mutual_funds} bonds={bonds} currency={holdings.currency} onDelete={handleDeleteHolding} />
      </TabPanel>

      {/* ── AI Insights Tab ── */}
      <TabPanel value={tabValue} index={3}>
        <AIInsightsTab holdings={holdings} accountId={accountId!} />
      </TabPanel>
    </Container>
  );
};

export default ListHoldings;