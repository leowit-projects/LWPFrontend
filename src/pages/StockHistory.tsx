import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Card,
  CardContent,
  Grid,
  Divider,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { ShowChart, Timeline, PieChart } from '@mui/icons-material';
import { historicalChartsAPI, stockAPI } from '../api/client';
import {
  PriceHistoryData,
  TimeRange,
  AssetTypeParam,
  ChartSummary,
  StockSymbol,
  ShareholdingPatternResponse,
  ShareholdingType,
} from '../types';

// ── Shareholding colours (consistent with Scheduler card chips) ───────────────
const SHAREHOLDING_COLORS: Record<ShareholdingType, string> = {
  [ShareholdingType.PROMOTERS]: '#2e7d32',
  [ShareholdingType.FIIs]:      '#0288d1',
  [ShareholdingType.DIIs]:      '#1565c0',
  [ShareholdingType.GOVT]:      '#616161',
  [ShareholdingType.PUBLIC]:    '#e65100',
};

const HOLDING_TYPES_ORDER: ShareholdingType[] = [
  ShareholdingType.PROMOTERS,
  ShareholdingType.FIIs,
  ShareholdingType.DIIs,
  ShareholdingType.GOVT,
  ShareholdingType.PUBLIC,
];

// ─────────────────────────────────────────────────────────────────────────────

const StockHistory: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();

  // Price history state
  const [priceLoading, setPriceLoading] = useState<boolean>(true);
  const [priceError, setPriceError]     = useState<string | null>(null);
  const [timeRange, setTimeRange]       = useState<TimeRange>(TimeRange.ONE_YEAR);
  const [chartType, setChartType]       = useState<'simple' | 'ma'>('simple');
  const [simpleHistory, setSimpleHistory] = useState<PriceHistoryData | null>(null);
  const [maHistory, setMAHistory]         = useState<PriceHistoryData | null>(null);
  const [summary, setSummary]             = useState<ChartSummary | null>(null);

  // Stock info + shareholding state
  const [infoLoading, setInfoLoading]   = useState<boolean>(true);
  const [stockDetails, setStockDetails] = useState<StockSymbol | null>(null);
  const [shareholding, setShareholding] = useState<ShareholdingPatternResponse | null>(null);

  // Which holding-type lines are currently shown in the chart
  const [visibleTypes, setVisibleTypes] = useState<Set<ShareholdingType>>(
    new Set(HOLDING_TYPES_ORDER)
  );

  // ── Load price data whenever symbol or time-range changes ──────────────────
  useEffect(() => {
    if (symbol) loadPriceData();
  }, [symbol, timeRange]);

  // ── Load stock details + shareholding once per symbol ──────────────────────
  useEffect(() => {
    if (symbol) loadStockInfo();
  }, [symbol]);

  const loadPriceData = async () => {
    if (!symbol) return;
    setPriceLoading(true);
    setPriceError(null);
    try {
      const [simpleRes, maRes, summaryRes] = await Promise.all([
        historicalChartsAPI.getSimpleHistory(symbol, AssetTypeParam.STOCK, timeRange),
        historicalChartsAPI.getHistoryWithMA(symbol, AssetTypeParam.STOCK, timeRange),
        historicalChartsAPI.getChartSummary(symbol, AssetTypeParam.STOCK),
      ]);
      setSimpleHistory(simpleRes.data);
      setMAHistory(maRes.data);
      setSummary(summaryRes.data);
    } catch (err: any) {
      setPriceError(err.response?.data?.detail || 'Failed to load price history');
    } finally {
      setPriceLoading(false);
    }
  };

  const loadStockInfo = async () => {
    if (!symbol) return;
    setInfoLoading(true);
    try {
      const stockRes = await stockAPI.getById(symbol);
      setStockDetails(stockRes.data);

      // Shareholding is only available for Indian (INR) stocks
      if (stockRes.data.currency === 'INR') {
        try {
          const shRes = await historicalChartsAPI.getShareholdingPattern(symbol);
          setShareholding(shRes.data);
        } catch {
          setShareholding(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load stock details:', err);
    } finally {
      setInfoLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getCurrencySymbol = (currency: string): string =>
    currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency;

  const formatPrice = (price: number | null | undefined): string =>
    price == null ? 'N/A' : price.toFixed(2);

  // ── Price chart data ───────────────────────────────────────────────────────

  const currentHistory = chartType === 'simple' ? simpleHistory : maHistory;
  const chartData      = currentHistory?.history || [];
  const dates          = chartData.map((d) => new Date(d.date));
  const closePrices    = chartData.map((d) => d.close_price || 0);
  const ma20Data       = chartData.map((d) => d.ma_20  || null);
  const ma200Data      = chartData.map((d) => d.ma_200 || null);

  // ── Shareholding chart data ────────────────────────────────────────────────
  // quarters_available is newest-first → reverse for chart (oldest → newest)
  const quarters = shareholding
    ? [...shareholding.quarters_available].reverse()
    : [];

  // Only include types that are toggled on and have at least one data point
  const shareholdingSeries = HOLDING_TYPES_ORDER
    .filter((type) =>
      visibleTypes.has(type) &&
      quarters.some((q) => shareholding?.by_quarter[q]?.[type] != null)
    )
    .map((type) => ({
      data:     quarters.map((q) => shareholding?.by_quarter[q]?.[type] ?? null),
      label:    type as string,
      color:    SHAREHOLDING_COLORS[type],
      showMark: false,
      curve:    'linear' as const,
    }));

  // Auto-zoom: derive y-axis bounds from visible data + a small padding
  const visibleValues = HOLDING_TYPES_ORDER
    .filter((type) => visibleTypes.has(type))
    .flatMap((type) =>
      quarters
        .map((q) => shareholding?.by_quarter[q]?.[type])
        .filter((v): v is number => v != null)
    );
  const yMin = visibleValues.length > 0 ? Math.max(0,   Math.floor(Math.min(...visibleValues) - 3)) : 0;
  const yMax = visibleValues.length > 0 ? Math.min(100, Math.ceil (Math.max(...visibleValues) + 3)) : 100;

  const toggleHoldingType = (type: ShareholdingType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Keep at least one line visible
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const currencySymbol = getCurrencySymbol(
    stockDetails?.currency || summary?.currency || 'USD'
  );

  // ── Loading / error guards ─────────────────────────────────────────────────

  if (priceLoading && infoLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (priceError) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">{priceError}</Alert>
      </Container>
    );
  }

  if (!currentHistory || chartData.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="warning">No price history data available for {symbol}</Alert>
      </Container>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>

      {/* ── 1. Stock Details Header ───────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          flexWrap="wrap"
          gap={2}
        >
          {/* Name + symbol */}
          <Box>
            {infoLoading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
                  {stockDetails?.name || symbol}
                </Typography>
                <Typography variant="h6" color="text.secondary" fontWeight={400} mt={0.5}>
                  {symbol}
                </Typography>
              </>
            )}
          </Box>

          {/* Exchange + currency + asset type + sector badges */}
          <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
            {stockDetails?.exchange && (
              <Chip
                label={stockDetails.exchange}
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            )}
            {stockDetails?.currency && (
              <Chip
                label={stockDetails.currency}
                variant="filled"
                color={stockDetails.currency === 'INR' ? 'success' : 'info'}
                sx={{ fontWeight: 600 }}
              />
            )}
            {stockDetails?.asset_type && (
              <Chip label={stockDetails.asset_type} variant="outlined" size="small" />
            )}
            {stockDetails?.sector_industry && (
              <Chip
                label={stockDetails.sector_industry}
                variant="outlined"
                size="small"
                color="default"
              />
            )}
          </Box>
        </Box>
      </Paper>

      {/* ── 2. Summary Cards ──────────────────────────────────────────────── */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Price
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {currencySymbol}{formatPrice(summary.current_price)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  52W Low
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight={600}>
                  {currencySymbol}{formatPrice(summary.price_52w_low)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  52W High
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight={600}>
                  {currencySymbol}{formatPrice(summary.price_52w_high)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Updated
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {summary.last_updated || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── 3. Price Chart Controls ───────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Time Range
            </Typography>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_e, v) => v !== null && setTimeRange(v)}
              size="small"
            >
              <ToggleButton value={TimeRange.YTD}>YTD</ToggleButton>
              <ToggleButton value={TimeRange.ONE_YEAR}>1Y</ToggleButton>
              <ToggleButton value={TimeRange.THREE_YEARS}>3Y</ToggleButton>
              <ToggleButton value={TimeRange.FIVE_YEARS}>5Y</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Chart Type
            </Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_e, v) => v !== null && setChartType(v)}
              size="small"
            >
              <ToggleButton value="simple">
                <ShowChart sx={{ mr: 1 }} />
                Price Only
              </ToggleButton>
              <ToggleButton value="ma">
                <Timeline sx={{ mr: 1 }} />
                With Moving Averages
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Paper>

      {/* ── 4. Price Chart ────────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {priceLoading ? (
          <Box display="flex" justifyContent="center" py={10}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                {chartType === 'simple' ? 'Close Price' : 'Close Price with Moving Averages'}
              </Typography>
              <Chip
                label={`${currentHistory.data_points} data points`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>

            <Box sx={{ width: '100%', height: 500 }}>
              {chartType === 'simple' ? (
                <LineChart
                  xAxis={[{
                    data: dates,
                    scaleType: 'time',
                    valueFormatter: (d) => d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                  }]}
                  series={[{
                    data: closePrices,
                    label: 'Close Price',
                    color: '#1976d2',
                    showMark: false,
                    curve: 'linear',
                  }]}
                  height={500}
                  grid={{ vertical: true, horizontal: true }}
                  margin={{ left: 80, right: 20, top: 20, bottom: 100 }}
                  sx={{ '& .MuiLineElement-root': { strokeWidth: 2 } }}
                />
              ) : (
                <LineChart
                  xAxis={[{
                    data: dates,
                    scaleType: 'time',
                    valueFormatter: (d) => d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                  }]}
                  series={[
                    { data: closePrices, label: 'Close Price', color: '#1976d2', showMark: false, curve: 'linear' },
                    { data: ma20Data,    label: 'MA 20',        color: '#ff9800', showMark: false, curve: 'linear' },
                    { data: ma200Data,   label: 'MA 200',       color: '#f44336', showMark: false, curve: 'linear' },
                  ]}
                  height={500}
                  grid={{ vertical: true, horizontal: true }}
                  margin={{ left: 80, right: 20, top: 20, bottom: 100 }}
                  sx={{ '& .MuiLineElement-root': { strokeWidth: 2 } }}
                />
              )}
            </Box>

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Period: {currentHistory.start_date} to {currentHistory.end_date}
              </Typography>
              {chartType === 'ma' && (
                <Box display="flex" gap={2}>
                  <Chip label="MA 20"  size="small" sx={{ backgroundColor: '#ff9800', color: 'white' }} />
                  <Chip label="MA 200" size="small" sx={{ backgroundColor: '#f44336', color: 'white' }} />
                </Box>
              )}
            </Box>
          </>
        )}
      </Paper>

      {/* ── 5. Moving Average Analysis ────────────────────────────────────── */}
      {summary && chartType === 'ma' && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" mb={2}>
            Moving Average Analysis
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">MA 20</Typography>
              <Typography variant="h6">{currencySymbol}{formatPrice(summary.ma_20)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">MA 200</Typography>
              <Typography variant="h6">{currencySymbol}{formatPrice(summary.ma_200)}</Typography>
            </Grid>
            {summary.pe_ratio != null && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">P/E Ratio</Typography>
                <Typography variant="h6">{formatPrice(summary.pe_ratio)}</Typography>
              </Grid>
            )}
            {summary.dividend_yield != null && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">Dividend Yield</Typography>
                <Typography variant="h6">{formatPrice(summary.dividend_yield)}%</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* ── 6. Shareholding Pattern (INR stocks only) ─────────────────────── */}
      {stockDetails?.currency === 'INR' && (
        <Paper sx={{ p: 3 }}>
          {/* Section header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <PieChart sx={{ color: 'success.main' }} />
              <Typography variant="h6">Shareholding Pattern</Typography>
              <Typography fontSize={20} lineHeight={1}>🇮🇳</Typography>
            </Box>
            {shareholding && shareholding.count > 0 && (
              <Chip
                label={`${shareholding.quarters_available.length} quarters`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" mb={3}>
            Quarterly breakdown of Promoters, FIIs, DIIs, Government and Public holdings — sourced from screener.in
          </Typography>

          {!shareholding || shareholding.count === 0 ? (
            <Alert severity="info">
              No shareholding data available for {symbol} yet. Trigger a refresh from the Scheduler page.
            </Alert>
          ) : (
            <>
              {/* Clickable toggle chips — click to show/hide each line */}
              <Box display="flex" gap={1} flexWrap="wrap" mb={3} alignItems="center">
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  Toggle:
                </Typography>
                {HOLDING_TYPES_ORDER.map((type) => {
                  const active = visibleTypes.has(type);
                  return (
                    <Chip
                      key={type}
                      label={type}
                      size="small"
                      onClick={() => toggleHoldingType(type)}
                      sx={{
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: active ? SHAREHOLDING_COLORS[type] : 'transparent',
                        color:           active ? 'white' : SHAREHOLDING_COLORS[type],
                        border:          `2px solid ${SHAREHOLDING_COLORS[type]}`,
                        opacity:         active ? 1 : 0.55,
                        transition:      'all 0.15s ease',
                        '&:hover': {
                          opacity: 1,
                          backgroundColor: active
                            ? SHAREHOLDING_COLORS[type]
                            : `${SHAREHOLDING_COLORS[type]}22`,
                        },
                      }}
                    />
                  );
                })}
              </Box>

              {/* Line chart — one series per visible holding type, x = quarter */}
              <Box sx={{ width: '100%', height: 420 }}>
                <LineChart
                  xAxis={[{
                    data: quarters,
                    scaleType: 'point',
                    tickLabelStyle: { fontSize: 11 },
                  }]}
                  yAxis={[{
                    min: yMin,
                    max: yMax,
                    valueFormatter: (v: number) => `${v}%`,
                  }]}
                  series={shareholdingSeries}
                  height={420}
                  grid={{ vertical: true, horizontal: true }}
                  margin={{ left: 60, right: 20, top: 20, bottom: 60 }}
                  sx={{ '& .MuiLineElement-root': { strokeWidth: 2.5 } }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Latest quarter snapshot */}
              <Typography variant="subtitle2" color="text.secondary" mb={2}>
                Latest Quarter — {shareholding.quarters_available[0]}
              </Typography>
              <Grid container spacing={2}>
                {HOLDING_TYPES_ORDER.map((type) => {
                  const val =
                    shareholding.by_quarter[shareholding.quarters_available[0]]?.[type];
                  if (val == null) return null;
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 2 }} key={type}>
                      <Box
                        sx={{
                          borderLeft: `4px solid ${SHAREHOLDING_COLORS[type]}`,
                          pl: 1.5,
                          py: 0.5,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {type}
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                          {val.toFixed(2)}%
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Paper>
      )}

    </Container>
  );
};

export default StockHistory;