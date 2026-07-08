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
  Tabs,
  Tab,
  Divider,
  } from '@mui/material';
import {
  ArrowBack,
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
  PieChart as PieChartIcon,
  AttachMoney,
  Lightbulb,
  Timeline,
  Warning,
  ArrowUpward,
  AutoAwesome,
  } from '@mui/icons-material';
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
  } from '../../types';
import { PIE_NAMED_SECTORS, 
  formatCurrency, 
  formatPercentage, 
  round2, 
  TabPanel, 
  SectorAnalysis, 
  buildSectorAnalysis } from '../../components/HoldingsShared';
import ListHoldingAIInsights from '../../components/ListHoldingAiInsights';
import ListHoldingRecommendations from '../../components/ListHoldingRecommendations';
import ListHoldingPinned from '../../components/ListHoldingPinned';
import ListHoldingStocks from '../../components/ListHoldingStocks';
import ListHoldingETFs from '../../components/ListHoldingETFs';
import ListHoldingMFBonds from '../../components/ListHoldingMFBonds';

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
    const named = PIE_NAMED_SECTORS.filter((s) => s !== 'Others' && map[s]).map((name) => ({
      name, invested: round2(map[name].invested), current: round2(map[name].current), pnl: round2(map[name].pnl),
      pnlPct: map[name].invested > 0 ? parseFloat(((map[name].pnl / map[name].invested) * 100).toFixed(2)) : 0,
    }));
    const oth = map['Others'];
    const others = oth ? [{ name: 'Others', invested: round2(oth.invested), current: round2(oth.current), pnl: round2(oth.pnl), pnlPct: oth.invested > 0 ? parseFloat(((oth.pnl / oth.invested) * 100).toFixed(2)) : 0 }] : [];
    return [...named.sort((a, b) => a.pnl - b.pnl), ...others];
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
      <ResponsiveContainer width="100%" height={550}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatCurrency(v, currency)}
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
            tickLine={false}
            domain={([dataMin, dataMax]: readonly [number, number]) => {
              const abs = Math.max(Math.abs(dataMin), Math.abs(dataMax)) * 1.25;
              return [-abs, abs];
            }} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 12, fontWeight: 600, fill: '#444' }}
            axisLine={false}
            tickLine={false} />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine x={0} stroke="#bbb" strokeWidth={1.5} />
          <Bar dataKey="pnl" name="P&L" maxBarSize={28}>
            {data.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#4caf50' : '#f44336'} fillOpacity={0.82} radius={4} />)}
            <LabelList
              dataKey="pnlPct"
              content={(props: any) => {
                const { x, y, width, height, value } = props;
                if (value == null) return null;
                const isPos = value >= 0;
                return (
                  <text
                    x={isPos ? x + width + 5 : x - 5}
                    y={y + height / 2}
                    textAnchor={isPos ? 'start' : 'end'}
                    dominantBaseline="central"
                    fontSize={11}
                    fontWeight={700}
                    fill={isPos ? '#2e7d32' : '#c62828'}>
                    {isPos ? '+' : ''}{value.toFixed(1)}%
                  </text>
                );
              }}
            />
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
        {[...analysis].sort((a, b) => b.actualPct - a.actualPct).map((a) => (
          <Box key={a.sector}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {a.isUnder && <Warning fontSize="small" sx={{ color: 'warning.main', fontSize: '14px' }} />}
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>{a.sector}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={`${a.actualPct.toFixed(1)}%`} size="small" color={a.isUnder ? 'warning' : a.gap < -a.threshold ? 'error' : 'success'} sx={{ height: 18, fontSize: '0.68rem' }} />
                <Typography variant="caption" color="text.disabled">/ {a.targetPct}%</Typography>
              </Box>
            </Box>
            <Box sx={{ height: 7, borderRadius: 3, backgroundColor: '#eeeeee', overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, width: `${Math.min(100, (a.actualPct / (a.targetPct || 1)) * 100)}%`, backgroundColor: a.isUnder ? '#ff9800' : a.gap < -a.threshold ? '#f44336' : '#4caf50', transition: 'width 0.6s ease' }} />
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

// ─── Main page ────────────────────────────────────────────────────────────────

const ListHoldings: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [holdings, setHoldings] = useState<HoldingAccountsResponse | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => { if (accountId) loadHoldings(); }, [accountId]);

  const loadHoldings = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getHoldings(accountId!);
      console.log('Holdings response:', response.data);
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

  const stockSectorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    holdings?.holdings.stocks.forEach((s: any) => { if (s.sector) map[s.symbol] = s.sector; });
    return map;
  }, [holdings?.holdings.stocks]);

  const sectorAnalysis = useMemo(() => buildSectorAnalysis(holdings?.holdings.stocks ?? []), [holdings?.holdings.stocks]);
  const underSectors = useMemo(() => sectorAnalysis.filter((a) => a.isUnder).map((a) => a.sector), [sectorAnalysis]);

  const stockTotals = useMemo(() => {
    const stocks = holdings?.holdings.stocks ?? [];
    return { invested: stocks.reduce((a, s) => a + (s.invested_value ?? 0), 0), current: stocks.reduce((a, s) => a + (s.current_value ?? 0), 0), pnl: stocks.reduce((a, s) => a + (s.profit_loss ?? 0), 0) };
  }, [holdings?.holdings.stocks]);

  const combinedTotals = useMemo(() => {
    const stocks = holdings?.holdings.stocks ?? [];
    const etfs = holdings?.holdings.etfs ?? [];
    const stockInvested = stocks.reduce((a, s) => a + (s.invested_value ?? 0), 0);
    const stockCurrent = stocks.reduce((a, s) => a + (s.current_value ?? 0), 0);
    const etfInvested = etfs.reduce((a, e) => a + (e.invested_value ?? 0), 0);
    const etfCurrent = etfs.reduce((a, e) => a + (e.current_value ?? 0), 0);
    const totalInvested = stockInvested + etfInvested;
    const totalCurrent = stockCurrent + etfCurrent;
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { stockInvested, stockCurrent, etfInvested, etfCurrent, totalInvested, totalCurrent, totalPnl, totalPnlPct, stockCount: stocks.length, etfCount: etfs.length };
  }, [holdings?.holdings.stocks, holdings?.holdings.etfs]);

  const portfolioAllocation = useMemo(() => {
    const mfCurrent   = (holdings?.holdings.mutual_funds ?? []).reduce((a, m) => a + m.current_value, 0);
    const bondCurrent = (holdings?.holdings.bonds ?? []).reduce((a, b) => a + b.current_value, 0);
    return [
      { name: 'Stocks',     value: round2(combinedTotals.stockCurrent), color: '#667eea' },
      { name: 'ETFs',       value: round2(combinedTotals.etfCurrent),   color: '#f5576c' },
      { name: 'MF & Bonds', value: round2(mfCurrent + bondCurrent),     color: '#43e97b' },
    ].filter(d => d.value > 0);
  }, [combinedTotals, holdings?.holdings.mutual_funds, holdings?.holdings.bonds]);

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

      {/* ── Stocks + ETFs Overview  &  Portfolio Allocation — side by side ── */}
      {(combinedTotals.stockCount > 0 || combinedTotals.etfCount > 0 || portfolioAllocation.length > 0) && (() => {
        const stockProfit = round2(stocks.reduce((a, s) => a + (s.profit_loss > 0 ? s.profit_loss : 0), 0));
        const stockLoss   = round2(stocks.reduce((a, s) => a + (s.profit_loss < 0 ? Math.abs(s.profit_loss) : 0), 0));
        const etfProfit   = round2(etfs.reduce((a, e) => a + (e.profit_loss > 0 ? e.profit_loss : 0), 0));
        const etfLoss     = round2(etfs.reduce((a, e) => a + (e.profit_loss < 0 ? Math.abs(e.profit_loss) : 0), 0));
        const chartData = [{ name: 'Stocks', invested: round2(combinedTotals.stockInvested), current: round2(combinedTotals.stockCurrent), profit: stockProfit, loss: stockLoss }, { name: 'ETFs', invested: round2(combinedTotals.etfInvested), current: round2(combinedTotals.etfCurrent), profit: etfProfit, loss: etfLoss }];
        const C_INVESTED = '#585858'; const C_CURRENT = '#4facfe'; const C_PNL_POS = '#1daa4c'; const C_PNL_NEG = '#f5576c';
        const fmt = (v: number) => formatCurrency(v, holdings.currency);
        const pnlPct = (pnl: number, inv: number) => inv > 0 ? ` (${pnl >= 0 ? '+' : ''}${((pnl / inv) * 100).toFixed(2)}%)` : '';
        const total = portfolioAllocation.reduce((a, d) => a + d.value, 0);
        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          const inv = payload.find((p: any) => p.dataKey === 'invested')?.value ?? 0;
          const cur = payload.find((p: any) => p.dataKey === 'current')?.value ?? 0;
          const profit = payload.find((p: any) => p.dataKey === 'profit')?.value ?? 0;
          const loss = payload.find((p: any) => p.dataKey === 'loss')?.value ?? 0;
          return (<Paper sx={{ p: 1.25, minWidth: 200, boxShadow: 4, border: '1px solid', borderColor: 'divider' }}><Typography variant="subtitle2" fontWeight={700} mb={0.5}>{label}</Typography>{[{ label: 'Invested', value: fmt(inv), color: C_INVESTED }, { label: 'Current Value', value: fmt(cur), color: C_CURRENT }].map(row => (<Box key={row.label} display="flex" justifyContent="space-between" gap={2} mb={0.2}><Typography variant="caption" color="text.secondary">{row.label}</Typography><Typography variant="caption" fontWeight={700} color={row.color}>{row.value}</Typography></Box>))}<Divider sx={{ my: 0.5 }} />{profit > 0 && (<Box display="flex" justifyContent="space-between" gap={2} mb={0.2}><Typography variant="caption" color="text.secondary">Profit</Typography><Typography variant="caption" fontWeight={700} color="success.main">+{fmt(profit)}{pnlPct(profit, inv)}</Typography></Box>)}{loss > 0 && (<Box display="flex" justifyContent="space-between" gap={2}><Typography variant="caption" color="text.secondary">Loss</Typography><Typography variant="caption" fontWeight={700} color="error.main">-{fmt(loss)}{pnlPct(-loss, inv)}</Typography></Box>)}</Paper>);
        };
        return (
          <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="stretch">

            {/* ── Left: Stocks + ETFs Overview ── */}
            {(combinedTotals.stockCount > 0 || combinedTotals.etfCount > 0) && (
              <Paper sx={{ flex: 2, minWidth: 340, px: 3, py: 1.75, background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                  <AccountBalance sx={{ fontSize: 16, color: '#667eea' }} />
                  <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>Stocks + ETFs Overview</Typography>
                  <Chip label={`${combinedTotals.stockCount} stocks · ${combinedTotals.etfCount} ETFs`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }} />
                </Box>
                {/* Row 1: Values + Bar chart */}
                <Box display="flex" gap={0} flexWrap="wrap" alignItems="flex-start">
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pr: 3, mr: 3, borderRight: '1px solid', borderColor: 'divider', minWidth: 160 }}>
                    <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Amount Invested</Typography><Typography variant="h5" fontWeight={700} lineHeight={1.2}>{fmt(combinedTotals.totalInvested)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Current Value</Typography><Typography variant="h5" fontWeight={700} lineHeight={1.2}>{fmt(combinedTotals.totalCurrent)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary" fontWeight={500}>Total P&amp;L</Typography><Box display="flex" alignItems="baseline" gap={0.75}><Typography variant="h5" fontWeight={700} lineHeight={1.2} color={combinedTotals.totalPnl >= 0 ? 'success.main' : 'error.main'}>{combinedTotals.totalPnl >= 0 ? '+' : ''}{fmt(combinedTotals.totalPnl)}</Typography><Chip label={formatPercentage(combinedTotals.totalPnlPct)} size="small" color={combinedTotals.totalPnl >= 0 ? 'success' : 'error'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} /></Box></Box>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 280 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 100, left: 0, bottom: 4 }} barCategoryGap="35%" barSize={15}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v: number) => formatCurrency(v, holdings.currency)} tick={{ display: 'none' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 12, fontWeight: 600, fill: '#444' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 3 }} />
                        <Bar dataKey="invested" name="Invested" fill={C_INVESTED}><LabelList dataKey="invested" position="right" formatter={(v: any) => typeof v === 'number' ? fmt(v) : ''} style={{ fontSize: 9, fontWeight: 600, fill: C_INVESTED }} /></Bar>
                        <Bar dataKey="current" name="Current" fill={C_CURRENT}><LabelList dataKey="current" position="right" formatter={(v: any) => typeof v === 'number' ? fmt(v) : ''} style={{ fontSize: 9, fontWeight: 600, fill: C_CURRENT }} /></Bar>
                        <Bar dataKey="profit" name="Profit" fill={C_PNL_POS}>
                          <LabelList dataKey="profit" 
                            position="right" 
                            content={(props: any) => { const { x, y, width, height, value, index } = props; if (typeof value !== 'number' || value <= 0) return null; const inv = chartData[index]?.invested ?? 0; const pct = inv > 0 ? ` (${((value / inv) * 100).toFixed(1)}%)` : ''; return <text x={x + width + 6} y={y + height / 2} 
                            dominantBaseline="middle" 
                            fontSize={9} 
                            fontWeight={600} 
                            fill={C_PNL_POS}>{`+${fmt(value)}${pct}`}</text>; }} />
                        </Bar>
                        <Bar dataKey="loss" name="Loss" fill={C_PNL_NEG}>
                          <LabelList dataKey="loss" 
                          position="right" 
                          content={(props: any) => { const { x, y, width, height, value, index } = props; if (typeof value !== 'number' || value <= 0) return null; const inv = chartData[index]?.invested ?? 0; const pct = inv > 0 ? ` (${((value / inv) * 100).toFixed(1)}%)` : ''; return <text x={x + width + 6} y={y + height / 2} 
                          dominantBaseline="middle" 
                          fontSize={9} 
                          fontWeight={600} 
                          fill={C_PNL_NEG}>{`-${fmt(value)}${pct}`}</text>; }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
                {/* Row 2: Top 3 Gainers & Losers */}
                {(() => {
                  const top3 = [...stocks].filter(s => (s.profit_loss ?? 0) > 0).sort((a, b) => (b.profit_loss ?? 0) - (a.profit_loss ?? 0)).slice(0, 5);
                  const bot3 = [...stocks].filter(s => (s.profit_loss ?? 0) < 0).sort((a, b) => (a.profit_loss ?? 0) - (b.profit_loss ?? 0)).slice(0, 5);
                  if (top3.length === 0 && bot3.length === 0) return null;
                  return (
                    <Box display="flex" gap={2} mt={1.5} pt={1.5} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                      {top3.length > 0 && (
                        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                          <Typography variant="caption" fontWeight={700} color="success.main" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>▲ Top Gainers</Typography>
                          {top3.map(s => (
                            <Chip key={s.symbol} size="small" label={`${s.symbol} ${formatCurrency(s.profit_loss ?? 0, holdings.currency)} (${s.profit_loss_percentage?.toFixed(1)}%)`} sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }} />
                          ))}
                        </Box>
                      )}
                      {top3.length > 0 && bot3.length > 0 && <Divider orientation="vertical" flexItem />}
                      {bot3.length > 0 && (
                        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                          <Typography variant="caption" fontWeight={700} color="error.main" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>▼ Top Losers</Typography>
                          {bot3.map(s => (
                            <Chip key={s.symbol} size="small" label={`${s.symbol} ${formatCurrency(s.profit_loss ?? 0, holdings.currency)} (${s.profit_loss_percentage?.toFixed(1)}%)`} sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })()}
              </Paper>
            )}

            {/* ── Right: Portfolio Allocation Pie ── */}
            {portfolioAllocation.length > 0 && (
              <Paper sx={{ flex: 1, minWidth: 260, px: 3, py: 1.75, background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid', borderColor: 'grey.200', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                  <PieChartIcon sx={{ fontSize: 16, color: '#764ba2' }} />
                  <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>Portfolio Allocation</Typography>
                  <Chip label={`Total: ${fmt(total)}`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }} />
                </Box>
                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                  <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={portfolioAllocation} cx="50%" cy="50%" innerRadius={48} outerRadius={68} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                          {portfolioAllocation.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                        </Pie>
                        <RechartsTooltip formatter={(v: any) => [fmt(Number(v)), '']} separator="" contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>Portfolio</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>Value</Typography>
                    </Box>
                  </Box>
                  <Box display="flex" flexDirection="column" gap={1.25}>
                    {portfolioAllocation.map(d => {
                      const pct = total > 0 ? (d.value / total * 100).toFixed(1) : '0';
                      return (
                        <Box key={d.name} display="flex" alignItems="center" gap={1.25}>
                          <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: d.color, flexShrink: 0 }} />
                          <Box>
                            <Box display="flex" alignItems="baseline" gap={0.75}>
                              <Typography variant="body2" fontWeight={700}>{d.name}</Typography>
                              <Chip label={`${pct}%`} size="small" sx={{ height: 17, fontSize: '0.62rem', fontWeight: 700, bgcolor: d.color + '22', color: d.color }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary">{fmt(d.value)}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Paper>
            )}

          </Box>
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
            <Grid container spacing={2} sx={{ mb: 2, alignItems: 'stretch' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectorAnalysisPanel analysis={sectorAnalysis} currency={holdings.currency} totalInvested={stockTotals.invested} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectorPnLChart stocks={stocks} currency={holdings.currency} />
              </Grid>
            </Grid>

            <ListHoldingPinned stocks={stocks} currency={holdings.currency} />
            {holdings.recommendations && holdings.recommendations.length > 0 && (<ListHoldingRecommendations recommendations={holdings.recommendations} underSectors={underSectors} stockSectorMap={stockSectorMap} currency={holdings.currency} />)}
            <ListHoldingStocks stocks={stocks} currency={holdings.currency} onDelete={handleDeleteHolding} accountId={accountId!} onRefresh={loadHoldings} />
          </>
        )}
      </TabPanel>

      {/* ── ETFs Tab ── */}
      <TabPanel value={tabValue} index={1}>
        <ListHoldingETFs etfs={etfs} currency={holdings.currency} onDelete={handleDeleteHolding} />
      </TabPanel>

      {/* ── MF + Bonds Tab ── */}
      <TabPanel value={tabValue} index={2}>
        <ListHoldingMFBonds mutualFunds={mutual_funds} bonds={bonds} currency={holdings.currency} onDelete={handleDeleteHolding} />
      </TabPanel>

      {/* ── AI Insights Tab ── */}
      <TabPanel value={tabValue} index={3}>
        <ListHoldingAIInsights holdings={holdings} accountId={accountId!} />
      </TabPanel>
    </Container>
  );
};

export default ListHoldings;