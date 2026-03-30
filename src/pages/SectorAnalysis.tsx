import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Paper, Grid,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip as MuiTooltip, OutlinedInput, Checkbox, ListItemText,
  TextField, Stack, Divider,
} from '@mui/material';
import { ShowChart, TrendingUp, AccountBalance, Remove } from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { hedgingAPI } from '../api/client';
import type { SectorInfo, ETFSymbol, SectorStock, CompareResponse, CompareSeries } from '../types';

// ─── Colour palette ───────────────────────────────────────────────────────────
// Sector lines = solid, Stock lines = dashed, ETF lines = dotted
const COLORS = ['#1565c0', '#c62828', '#2e7d32', '#6a1b9a', '#e65100', '#00838f', '#4e342e', '#37474f'];

const typeStyle: Record<string, { strokeDasharray: string; strokeWidth: number }> = {
  sector: { strokeDasharray: '0',    strokeWidth: 2.5 },
  stock:  { strokeDasharray: '6 3',  strokeWidth: 1.8 },
  etf:    { strokeDasharray: '2 4',  strokeWidth: 2.0 },
};

const typeIcon: Record<string, React.ReactNode> = {
  sector: <ShowChart    fontSize="small" />,
  stock:  <TrendingUp   fontSize="small" />,
  etf:    <AccountBalance fontSize="small" />,
};

const typeLabel: Record<string, string> = {
  sector: 'Sector Index',
  stock:  'Stock',
  etf:    'ETF',
};

// ─── Metric helpers ───────────────────────────────────────────────────────────
const corrColor = (rho: number | null): string => {
  if (rho === null) return '#9e9e9e';
  if (rho >= 0.8)  return '#1b5e20';
  if (rho >= 0.6)  return '#388e3c';
  if (rho >= 0.4)  return '#f57c00';
  if (rho >= 0.0)  return '#e65100';
  return '#c62828';
};

const corrVerdict = (rho: number | null): string => {
  if (rho === null) return '—';
  if (rho >= 0.8)  return 'Strong (hedge effective)';
  if (rho >= 0.6)  return 'Moderate';
  if (rho >= 0.4)  return 'Weak';
  return 'Low / Inverse';
};

const betaVerdict = (beta: number | null): string => {
  if (beta === null) return '—';
  if (beta < 0.7)  return `${beta.toFixed(2)}  (under-amplifier)`;
  if (beta <= 1.3) return `${beta.toFixed(2)}  (1:1 tracker)`;
  return `${beta.toFixed(2)}  (amplifier — scale hedge up)`;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
const today    = () => new Date().toISOString().split('T')[0];
const yearsAgo = (n: number) => {
  const d = new Date(); d.setFullYear(d.getFullYear() - n);
  return d.toISOString().split('T')[0];
};

// ─── Chart data builder for MUI X Charts ─────────────────────────────────────
// Series id uses '-' separator (CSS-safe) instead of '::' from the backend.
const cleanId = (id: string) => id.replace('::', '-');

interface MuiSeries {
  id: string;
  data: (number | null)[];
  label: string;
  color: string;
  showMark: boolean;
  curve: 'linear';
}

const buildChartData = (
  series: CompareSeries[],
): { dates: string[]; seriesData: MuiSeries[] } => {
  if (!series.length) return { dates: [], seriesData: [] };
  const spine = series.reduce((a, b) => (a.dates.length > b.dates.length ? a : b));
  const dates = spine.dates;
  const seriesData: MuiSeries[] = series.map((s, i) => ({
    id:       cleanId(s.id),
    data:     dates.map(d => { const idx = s.dates.indexOf(d); return idx >= 0 ? (s.levels[idx] ?? null) : null; }),
    label:    s.label,
    color:    COLORS[i % COLORS.length],
    showMark: false,
    curve:    'linear',
  }));
  return { dates, seriesData };
};

// ─── Small components ─────────────────────────────────────────────────────────
const CurrencyToggle: React.FC<{
  value: 'INR' | 'USD';
  onChange: (v: 'INR' | 'USD') => void;
}> = ({ value, onChange }) => (
  <Box display="flex" gap={1}>
    {(['INR', 'USD'] as const).map(c => (
      <Button
        key={c}
        size="small"
        variant={value === c ? 'contained' : 'outlined'}
        onClick={() => onChange(c)}
        sx={{
          minWidth: 80, fontWeight: 700,
          ...(value === c && {
            bgcolor: c === 'INR' ? '#1b5e20' : '#0d47a1',
            '&:hover': { bgcolor: c === 'INR' ? '#2e7d32' : '#1565c0' },
          }),
        }}
      >
        {c === 'INR' ? '🇮🇳' : '🇺🇸'} {c}
      </Button>
    ))}
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SectorAnalysis: React.FC = () => {
  const [currency,    setCurrency]    = useState<'INR' | 'USD'>('INR');
  const [sectors,     setSectors]     = useState<SectorInfo[]>([]);
  const [etfs,        setEtfs]        = useState<ETFSymbol[]>([]);

  // selections
  const [selSectors,  setSelSectors]  = useState<string[]>([]);
  const [selStocks,   setSelStocks]   = useState<string[]>([]);
  const [selETFs,     setSelETFs]     = useState<string[]>([]);
  const [sectorStocksMap, setSectorStocksMap] = useState<Record<string, SectorStock[]>>({});

  // date range
  const [startDate,   setStartDate]   = useState(yearsAgo(2));
  const [endDate,     setEndDate]     = useState(today());

  // results
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [result,      setResult]      = useState<CompareResponse | null>(null);

  // ── Load sectors + ETFs whenever currency changes ─────────────────────────
  useEffect(() => {
    hedgingAPI.getSectors().then(r => setSectors(r.data)).catch(() => setSectors([]));
    hedgingAPI.getETFs(currency).then(r => setEtfs(r.data)).catch(() => setEtfs([]));

    // Reset selections when currency changes
    setSelSectors([]);
    setSelStocks([]);
    setSelETFs([]);
    setSectorStocksMap({});
    setResult(null);
  }, [currency]);

  // ── Load stocks for newly selected sectors ────────────────────────────────
  useEffect(() => {
    selSectors.forEach(sector => {
      if (!sectorStocksMap[sector]) {
        hedgingAPI.getStocksInSector(sector, currency)
          .then(r => setSectorStocksMap(prev => ({ ...prev, [sector]: r.data.stocks })))
          .catch(() => {});
      }
    });
    // Remove stock selections that belong to de-selected sectors
    const validStocks = selSectors.flatMap(s => (sectorStocksMap[s] ?? []).map(st => st.symbol));
    setSelStocks(prev => prev.filter(t => validStocks.includes(t)));
  }, [selSectors]);

  const allAvailableStocks: SectorStock[] = selSectors.flatMap(s => sectorStocksMap[s] ?? []);

  // ── Run analysis ──────────────────────────────────────────────────────────
  const run = async () => {
    if (!selSectors.length) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await hedgingAPI.compare({
        currency,
        sectors:     selSectors,
        tickers:     selStocks,
        etf_symbols: selETFs,
        start_date:  startDate,
        end_date:    endDate,
      });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const { dates: chartDates, seriesData: chartSeries } =
    result ? buildChartData(result.series) : { dates: [], seriesData: [] };

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 3 }}>

      {/* Header */}
      <Box sx={{
        mb: 2, px: 2.5, py: 2, borderRadius: 2,
        background: 'linear-gradient(120deg, #1a237e, #1565c0)',
        color: '#fff', display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <ShowChart sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h6" fontWeight={800}>Sector Analysis</Typography>
          <Typography variant="body2" sx={{ opacity: .8 }}>
            Compare sector indexes · stocks · ETFs — rebased to 100 · Beta & Correlation
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} alignItems="flex-start">

        {/* ── Left panel: controls ─────────────────────────────────────── */}
        <Grid sx={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>

            {/* Currency */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: .5 }}>
              Market
            </Typography>
            <Box mt={0.5} mb={2}>
              <CurrencyToggle value={currency} onChange={setCurrency} />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Sectors */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: .5 }}>
              Sectors <Typography component="span" variant="caption" color="primary.main">(required)</Typography>
            </Typography>
            <FormControl fullWidth size="small" sx={{ mt: 0.5, mb: selSectors.length ? 1 : 2 }}>
              <InputLabel>Select sectors</InputLabel>
              <Select
                multiple
                value={selSectors}
                label="Select sectors"
                onChange={e => setSelSectors(e.target.value as string[])}
                input={<OutlinedInput label="Select sectors" />}
                renderValue={sel => `${sel.length} selected`}
              >
                {sectors.map(s => {
                  const count = currency === 'INR' ? s.inr_count : s.usd_count;
                  return (
                    <MenuItem key={s.sector} value={s.sector} disabled={count === 0}>
                      <Checkbox checked={selSectors.includes(s.sector)} size="small" />
                      <ListItemText
                        primary={s.sector}
                        secondary={`${count} ${currency} stocks`}
                      />
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {selSectors.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {selSectors.map((s, i) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onDelete={() => setSelSectors(prev => prev.filter(x => x !== s))}
                    sx={{ bgcolor: COLORS[i % COLORS.length], color: '#fff',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)',
                        '&:hover': { color: '#fff' } } }}
                  />
                ))}
              </Box>
            )}

            {/* Stocks */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: .5 }}>
              Stocks <Typography component="span" variant="caption">(optional)</Typography>
            </Typography>
            <FormControl fullWidth size="small" sx={{ mt: 0.5, mb: selStocks.length ? 1 : 2 }}
              disabled={!allAvailableStocks.length}>
              <InputLabel>Add individual stocks</InputLabel>
              <Select
                multiple
                value={selStocks}
                label="Add individual stocks"
                onChange={e => setSelStocks(e.target.value as string[])}
                input={<OutlinedInput label="Add individual stocks" />}
                renderValue={sel => `${sel.length} selected`}
              >
                {allAvailableStocks.map(s => (
                  <MenuItem key={s.symbol} value={s.symbol}>
                    <Checkbox checked={selStocks.includes(s.symbol)} size="small" />
                    <ListItemText primary={s.symbol} secondary={s.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selStocks.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {selStocks.map(t => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    variant="outlined"
                    onDelete={() => setSelStocks(prev => prev.filter(x => x !== t))}
                    sx={{ borderColor: 'text.secondary', color: 'text.secondary' }}
                  />
                ))}
              </Box>
            )}

            {/* ETFs */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: .5 }}>
              ETFs <Typography component="span" variant="caption">(optional)</Typography>
            </Typography>
            {etfs.length === 0 ? (
              <Alert severity="info" sx={{ mt: 0.5, mb: 2, fontSize: '0.72rem' }}>
                No {currency} ETFs in your database.
              </Alert>
            ) : (
              <>
                <FormControl fullWidth size="small" sx={{ mt: 0.5, mb: selETFs.length ? 1 : 2 }}>
                  <InputLabel>Add ETFs</InputLabel>
                  <Select
                    multiple
                    value={selETFs}
                    label="Add ETFs"
                    onChange={e => setSelETFs(e.target.value as string[])}
                    input={<OutlinedInput label="Add ETFs" />}
                    renderValue={sel => `${sel.length} selected`}
                  >
                    {etfs.map(e => (
                      <MenuItem key={e.symbol} value={e.symbol}>
                        <Checkbox checked={selETFs.includes(e.symbol)} size="small" />
                        <ListItemText primary={e.symbol} secondary={e.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selETFs.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {selETFs.map(e => (
                      <Chip
                        key={e}
                        label={e}
                        size="small"
                        variant="outlined"
                        onDelete={() => setSelETFs(prev => prev.filter(x => x !== e))}
                        color="secondary"
                      />
                    ))}
                  </Box>
                )}
              </>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Date range */}
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: .5 }}>
              Date range
            </Typography>
            <TextField fullWidth size="small" label="Start date" type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              sx={{ mt: 0.5, mb: 1.5 }} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth size="small" label="End date" type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />

            <Button
              fullWidth variant="contained" size="large" onClick={run}
              disabled={loading || !selSectors.length}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ShowChart />}
              sx={{ fontWeight: 700 }}
            >
              {loading ? 'Computing…' : 'Compare'}
            </Button>

            {selSectors.length > 0 && (
              <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.72rem' }}>
                <strong>Benchmark:</strong> {selSectors[0]} index. Beta &amp; ρ of all other
                series are relative to it.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* ── Right panel: results ──────────────────────────────────────── */}
        <Grid sx={{ xs: 12, md: 9 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {!result && !loading && (
            <Paper variant="outlined" sx={{
              p: 6, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed',
            }}>
              <ShowChart sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" fontWeight={600}>
                Select at least one sector and click Compare.
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                Add more sectors, individual stocks, or ETFs from your database to overlay them.
              </Typography>
            </Paper>
          )}

          {result && (
            <Stack spacing={2}>

              {/* Active series chips */}
              <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Showing:
                </Typography>
                {result.series.map((s, i) => (
                  <Chip
                    key={s.id}
                    icon={typeIcon[s.type]}
                    label={s.label}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: COLORS[i % COLORS.length],
                      color: COLORS[i % COLORS.length],
                      '& .MuiChip-icon': { color: COLORS[i % COLORS.length] },
                    }}
                  />
                ))}
                <Chip
                  icon={<Remove fontSize="small" />}
                  label="Sector  ——"
                  size="small" variant="filled" sx={{ bgcolor: '#f5f5f5', fontSize: '0.7rem' }}
                />
                <Chip
                  icon={<Remove fontSize="small" />}
                  label="Stock  - - -"
                  size="small" variant="filled" sx={{ bgcolor: '#f5f5f5', fontSize: '0.7rem' }}
                />
                <Chip
                  icon={<Remove fontSize="small" />}
                  label="ETF  ·····"
                  size="small" variant="filled" sx={{ bgcolor: '#f5f5f5', fontSize: '0.7rem' }}
                />
              </Box>

              {/* Chart */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Performance Comparison — rebased to 100 at {result.start_date}
                  </Typography>
                  <Chip
                    label={`Benchmark: ${result.benchmark}`}
                    size="small" color="primary" variant="outlined"
                  />
                </Box>
                <LineChart
                  xAxis={[{
                    data: chartDates,
                    scaleType: 'point',
                    tickLabelStyle: { fontSize: 11 },
                    tickInterval: (_: string, i: number) =>
                      i % Math.max(1, Math.floor(chartDates.length / 10)) === 0,
                    valueFormatter: (v: string) => {
                      const d = new Date(v);
                      const yy  = String(d.getFullYear()).slice(2);
                      const mmm = d.toLocaleString('en', { month: 'short' });
                      return `${mmm}-${yy}`;
                    },
                  }]}
                  yAxis={[{ tickLabelStyle: { fontSize: 11 } }]}
                  series={chartSeries}
                  height={360}
                  sx={{
                    // Dashed lines for stocks, dotted for ETFs
                    ...result.series.reduce((acc, s) => {
                      const id = cleanId(s.id);
                      if (s.type === 'stock') {
                        acc[`& .MuiLineElement-series-${id}`] = { strokeDasharray: '6 3' };
                      } else if (s.type === 'etf') {
                        acc[`& .MuiLineElement-series-${id}`] = { strokeDasharray: '2 4' };
                      }
                      return acc;
                    }, {} as Record<string, object>),
                  }}
                />
              </Paper>

              {/* Metrics table */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                  Beta &amp; Correlation vs Benchmark ({result.benchmark})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                        <TableCell>Series</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="center">
                          <MuiTooltip title="β = Cov(series, benchmark) / Var(benchmark). How much the series amplifies benchmark moves.">
                            <span>Beta (β)</span>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell align="center">
                          <MuiTooltip title="Pearson ρ of daily returns. ρ → 1 means they move in lockstep.">
                            <span>Correlation (ρ)</span>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell>Verdict</TableCell>
                        <TableCell align="center">
                          <MuiTooltip title="Hedge ratio = β. Short this many units of the benchmark per unit of this series.">
                            <span>Hedge Ratio</span>
                          </MuiTooltip>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.series.map((s, i) => {
                        const isBenchmark = i === 0 && s.type === 'sector';
                        return (
                          <TableRow key={s.id} hover>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Box sx={{
                                  width: 12, height: 12, borderRadius: '50%',
                                  bgcolor: COLORS[i % COLORS.length], flexShrink: 0,
                                }} />
                                <Box>
                                  <Typography variant="body2" fontWeight={700}>{s.label}</Typography>
                                  {s.type === 'sector' && (
                                    <Typography variant="caption" color="text.secondary">
                                      {(s as any).stock_count} stocks
                                    </Typography>
                                  )}
                                  {s.type === 'etf' && (
                                    <Typography variant="caption" color="text.secondary">
                                      {(s as any).name}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={typeIcon[s.type]}
                                label={typeLabel[s.type]}
                                size="small"
                                variant="outlined"
                                color={s.type === 'sector' ? 'primary' : s.type === 'etf' ? 'secondary' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {isBenchmark ? (
                                <Typography variant="body2" color="text.disabled">Benchmark</Typography>
                              ) : (
                                <Typography variant="body2" fontWeight={600}>
                                  {betaVerdict(s.beta)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {isBenchmark ? (
                                <Typography variant="body2" color="text.disabled">—</Typography>
                              ) : (
                                <Typography variant="body2" fontWeight={700}
                                  sx={{ color: corrColor(s.correlation) }}>
                                  {s.correlation !== null ? s.correlation.toFixed(3) : '—'}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {isBenchmark ? (
                                <Typography variant="body2" color="text.disabled">—</Typography>
                              ) : (
                                <Typography variant="body2" sx={{ color: corrColor(s.correlation) }}>
                                  {corrVerdict(s.correlation)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {isBenchmark ? (
                                <Typography variant="body2" color="text.disabled">—</Typography>
                              ) : (
                                <MuiTooltip
                                  title={s.beta !== null
                                    ? `Short ${s.beta.toFixed(3)}× benchmark notional to hedge this position`
                                    : ''}
                                >
                                  <Typography variant="body2" fontWeight={700}>
                                    {s.beta !== null ? s.beta.toFixed(3) : '—'}
                                  </Typography>
                                </MuiTooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box mt={2} p={1.5} bgcolor="grey.50" borderRadius={1}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>How to use:</strong> High ρ (≥ 0.8) means the benchmark effectively
                    explains this series' moves — a sector-ETF hedge would work. The hedge ratio
                    tells you how many units of the benchmark to short per unit of this position.
                    Stocks with low ρ carry mostly idiosyncratic (company-specific) risk that sector
                    hedging cannot neutralise.
                  </Typography>
                </Box>
              </Paper>

            </Stack>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default SectorAnalysis;