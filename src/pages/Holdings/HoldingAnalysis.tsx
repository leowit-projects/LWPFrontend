import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Grid,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  TrendingUp,
  AccountBalance,
  Warning,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';

import {
  PortfolioBetaResponse,
  CorrelationMatrixResponse,
  HoldingBetaResult,
} from '../../types';
import { holdingAnalysisAPI } from '@/api/client';
import { useParams } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LOOKBACK_OPTIONS = [
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatINR = (value: number | null | undefined): string => {
  if (value == null) return '—';
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (value >= 1_00_000)    return `₹${(value / 1_00_000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const getRiskColor = (
  risk: string,
): 'success' | 'warning' | 'error' | 'default' => {
  switch (risk) {
    case 'Low':    return 'success';
    case 'Medium': return 'warning';
    case 'High':   return 'error';
    default:       return 'default';
  }
};

// Interpolates between green → yellow → red based on correlation value [-1, +1]
const correlationToColor = (value: number): string => {
  if (value >= 0.9)  return '#d32f2f';   // deep red
  if (value >= 0.7)  return '#f44336';   // red
  if (value >= 0.5)  return '#ff7043';   // deep orange
  if (value >= 0.3)  return '#ffa726';   // orange
  if (value >= 0.1)  return '#ffee58';   // yellow
  if (value >= -0.1) return '#e8f5e9';   // near-zero — light green
  if (value >= -0.3) return '#66bb6a';   // green
  return '#2e7d32';                       // deep green (strong negative)
};

const correlationTextColor = (value: number): string =>
  Math.abs(value) >= 0.5 ? '#fff' : '#000';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title:    string;
  value:    React.ReactNode;
  subtitle?: string;
  icon:     React.ReactNode;
  color:    string;
  alert?:   'normal' | 'amber' | 'critical';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title, value, subtitle, icon, color, alert,
}) => {
  const borderColor =
    alert === 'critical' ? '#d32f2f' :
    alert === 'amber'    ? '#ed6c02' :
    color;

  return (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        borderLeft: `4px solid ${borderColor}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700} mt={0.5} color={borderColor}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ color, opacity: 0.8, mt: 0.5 }}>
          {icon}
        </Box>
      </Box>
    </Paper>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const HoldingAnalysis: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  
  const [lookbackDays, setLookbackDays]     = useState<number>(365);
  const [betaData, setBetaData]             = useState<PortfolioBetaResponse | null>(null);
  const [corrData, setCorrData]             = useState<CorrelationMatrixResponse | null>(null);
  const [loadingBeta, setLoadingBeta]       = useState<boolean>(false);
  const [loadingCorr, setLoadingCorr]       = useState<boolean>(false);
  const [error, setError]                   = useState<string>('');

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadBeta = useCallback(async (accountId: string, lookbackDays: number): Promise<void> => {
    setLoadingBeta(true);
    setError('');
    try {
      const response = await holdingAnalysisAPI.getPortfolioBeta(accountId, lookbackDays);
      setBetaData(response.data);
    } catch (err: any) {
      console.error('Failed to load beta data:', err);
      setError(err.response?.data?.detail || 'Failed to load beta analysis');
    } finally {
      setLoadingBeta(false);
    }
  }, []);

  const loadCorrelation = useCallback(async (accountId: string, lookbackDays: number): Promise<void> => {
    setLoadingCorr(true);
    try {
      const response = await holdingAnalysisAPI.getCorrelationMatrix(accountId, lookbackDays);
      setCorrData(response.data);
    } catch (err: any) {
      console.error('Failed to load correlation data:', err);
      // Non-fatal — beta data is more important
    } finally {
      setLoadingCorr(false);
    }
  }, []);

  useEffect(() => {
    if (accountId) {
      loadBeta(accountId, lookbackDays);
      loadCorrelation(accountId, lookbackDays);
    }
  }, [accountId, lookbackDays, loadBeta, loadCorrelation]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLookbackChange = (
    _: React.MouseEvent<HTMLElement>,
    newDays: number | null,
  ): void => {
    if (newDays !== null) setLookbackDays(newDays);
  };

  // ── Holdings DataGrid columns ──────────────────────────────────────────────

  const columns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      flex: 0.8,
      minWidth: 110,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'company_name',
      headerName: 'Company',
      flex: 1.5,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {params.value ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'beta',
      headerName: 'Beta (β)',
      flex: 0.7,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        if (params.value == null) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const beta = params.value as number;
        const color =
          beta > 1.2 ? 'error.main' :
          beta < 0.8 ? 'success.main' :
          'text.primary';
        return (
          <Typography variant="body2" fontWeight={600} color={color}>
            {beta.toFixed(2)}
          </Typography>
        );
      },
    },
    {
      field: 'correlation',
      headerName: 'Correlation (r)',
      flex: 0.8,
      minWidth: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        if (params.value == null) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const r = params.value as number;
        return (
          <Typography
            variant="body2"
            fontWeight={500}
            color={r > 0.7 ? 'error.main' : r < 0.3 ? 'success.main' : 'text.primary'}
          >
            {r.toFixed(2)}
          </Typography>
        );
      },
    },
    {
      field: 'risk_level',
      headerName: 'Risk',
      flex: 0.7,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={getRiskColor(params.value as string)}
          size="small"
        />
      ),
    },
    {
      field: 'current_value',
      headerName: 'Current Value',
      flex: 1,
      minWidth: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {formatINR(params.value)}
        </Typography>
      ),
    },
    {
      field: 'data_points',
      headerName: 'Data Points',
      flex: 0.7,
      minWidth: 110,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'error',
      headerName: 'Note',
      flex: 1,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams) =>
        params.value ? (
          <Tooltip title={params.value}>
            <Typography variant="caption" color="warning.main" noWrap>
              ⚠ {params.value}
            </Typography>
          </Tooltip>
        ) : null,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 4 }}>

      {/* ── Page header + lookback toggle ─────────────────────────────────── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={700}>
          Hedge Analysis — India Holdings
        </Typography>

        <ToggleButtonGroup
          value={lookbackDays}
          exclusive
          onChange={handleLookbackChange}
          size="small"
        >
          {LOOKBACK_OPTIONS.map((opt) => (
            <ToggleButton key={opt.days} value={opt.days}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loadingBeta ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
          <CircularProgress />
        </Box>
      ) : betaData ? (
        <>
          {/* ── Summary cards ───────────────────────────────────────────── */}
          <Grid container spacing={2} mb={3}>

            {/* Portfolio Beta */}
            <Grid sx={{ xs:12, sm:6, md:3 }}>
              <SummaryCard
                title="Portfolio Beta"
                value={betaData.portfolio_beta != null ? betaData.portfolio_beta.toFixed(2) : '—'}
                subtitle={
                  betaData.portfolio_beta != null
                    ? betaData.portfolio_beta > 1.2 ? 'Aggressive — amplifies market moves'
                    : betaData.portfolio_beta < 0.8 ? 'Defensive — less than market'
                    : 'Moderate — tracks market closely'
                    : 'Insufficient data'
                }
                icon={<TrendingUp fontSize="large" />}
                color="#1976d2"
              />
            </Grid>

            {/* Portfolio Value */}
            <Grid sx={{ xs:12, sm:6, md:3 }}>
              <SummaryCard
                title="INR Portfolio Value"
                value={formatINR(betaData.portfolio_value)}
                subtitle={`${betaData.holdings.length} active holdings`}
                icon={<AccountBalance fontSize="large" />}
                color="#2e7d32"
              />
            </Grid>

            {/* Hedge Lots */}
            <Grid sx={{ xs:12, sm:6, md:3 }}>
              <SummaryCard
                title="Suggested Hedge Lots"
                value={
                  betaData.hedge_lots_suggested != null
                    ? `${betaData.hedge_lots_suggested} lot${betaData.hedge_lots_suggested !== 1 ? 's' : ''}`
                    : '—'
                }
                subtitle={
                  betaData.hedge_value_required != null
                    ? `~${formatINR(betaData.hedge_value_required)} margin required`
                    : betaData.nifty_lot_value != null
                    ? `1 lot = ${formatINR(betaData.nifty_lot_value)}`
                    : undefined
                }
                icon={<Warning fontSize="large" />}
                color="#ed6c02"
              />
            </Grid>

            {/* Nifty Expiry */}
            <Grid sx={{ xs:12, sm:6, md:3 }}>
              <SummaryCard
                title="Next Nifty Expiry"
                value={
                  betaData.nifty_expiry
                    ? `${betaData.nifty_expiry.days_to_expiry} days`
                    : '—'
                }
                subtitle={
                  betaData.nifty_expiry
                    ? `${betaData.nifty_expiry.expiry_month_label} · ${betaData.nifty_expiry.expiry_date}`
                    : undefined
                }
                icon={<Schedule fontSize="large" />}
                color={
                  betaData.nifty_expiry?.urgency === 'critical' ? '#d32f2f' :
                  betaData.nifty_expiry?.urgency === 'amber'    ? '#ed6c02' :
                  '#2e7d32'
                }
                alert={betaData.nifty_expiry?.urgency}
              />
            </Grid>
          </Grid>

          {/* ── Expiry reminder banner ───────────────────────────────────── */}
          {betaData.nifty_expiry && betaData.nifty_expiry.urgency !== 'normal' && (
            <Alert
              severity={betaData.nifty_expiry.urgency === 'critical' ? 'error' : 'warning'}
              icon={<Schedule />}
              sx={{ mb: 3 }}
            >
              <strong>Rollover Reminder:</strong> The{' '}
              {betaData.nifty_expiry.expiry_month_label} Nifty futures contract
              expires in <strong>{betaData.nifty_expiry.days_to_expiry} days</strong>{' '}
              ({betaData.nifty_expiry.expiry_date}). If you have an open hedge position,
              close it and roll over to the next month's contract before expiry to
              maintain continuous protection.
            </Alert>
          )}

          {/* ── Benchmark info ───────────────────────────────────────────── */}
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CheckCircle fontSize="small" color="success" />
            <Typography variant="caption" color="text.secondary">
              Benchmark: <strong>{betaData.benchmark_symbol}</strong>
              {betaData.benchmark_price != null && (
                <> · Last price: <strong>₹{betaData.benchmark_price.toFixed(2)}</strong></>
              )}
              {' '}· Lot size: <strong>{betaData.nifty_lot_size} units</strong>
              {betaData.nifty_lot_value != null && (
                <> · Lot value: <strong>{formatINR(betaData.nifty_lot_value)}</strong></>
              )}
              {' '}· Lookback: <strong>{lookbackDays} calendar days</strong>
              {' '}· Data points: <strong>{betaData.market_data_points}</strong>
            </Typography>
          </Box>

          {/* ── Holdings table ───────────────────────────────────────────── */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Holdings Beta & Correlation vs NIFTYBEES
              </Typography>

              <DataGrid
                rows={betaData.holdings}
                columns={columns}
                getRowId={(row: HoldingBetaResult) => row.symbol}
                autoHeight
                disableRowSelectionOnClick
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25, page: 0 } },
                  sorting: { sortModel: [{ field: 'current_value', sort: 'desc' }] },
                }}
                sx={{
                  '& .MuiDataGrid-cell:focus': { outline: 'none' },
                }}
              />
            </Box>
          </Paper>

          {/* ── Correlation pairs table ──────────────────────────────────── */}
          <Paper>
            <Box sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={0.5}>
                Holding Correlation Pairs
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Showing significant pairs only — positive (&gt; 0.4) indicates concentration risk,
                negative (&lt; −0.3) indicates good diversification.
              </Typography>

              {loadingCorr ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={28} />
                </Box>
              ) : corrData?.success && corrData.symbols.length >= 2 ? (() => {
                  // Build flat list of unique pairs (upper triangle only, skip diagonal)
                  // filtered to |correlation| > 0.4 or < -0.3, sorted by correlation descending
                  const pairs: { stock1: string; stock2: string; correlation: number }[] = [];
                  corrData.symbols.forEach((sym1, i) => {
                    corrData.symbols.forEach((sym2, j) => {
                      if (j <= i) return;   // upper triangle only, skip diagonal
                      const val = corrData.matrix[i][j];
                      if (val > 0.4 || val < -0.3) {  // show only significant correlations
                        pairs.push({ stock1: sym1, stock2: sym2, correlation: val });
                      }
                    });
                  });
                  pairs.sort((a, b) => b.correlation - a.correlation);

                  if (pairs.length === 0) {
                    return (
                      <Alert severity="success">
                        No significant correlations found. Your portfolio appears well diversified.
                      </Alert>
                    );
                  }

                  return (
                    <DataGrid
                      rows={pairs}
                      getRowId={(row) => `${row.stock1}-${row.stock2}`}
                      autoHeight
                      disableRowSelectionOnClick
                      pageSizeOptions={[10, 25, 50]}
                      initialState={{
                        pagination: { paginationModel: { pageSize: 25, page: 0 } },
                      }}
                      sx={{ '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
                      columns={[
                        {
                          field: 'stock1',
                          headerName: 'Stock 1',
                          flex: 1,
                          minWidth: 120,
                          renderCell: (params: GridRenderCellParams) => (
                            <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
                          ),
                        },
                        {
                          field: 'stock2',
                          headerName: 'Stock 2',
                          flex: 1,
                          minWidth: 120,
                          renderCell: (params: GridRenderCellParams) => (
                            <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
                          ),
                        },
                        {
                          field: 'correlation',
                          headerName: 'Correlation',
                          flex: 0.8,
                          minWidth: 130,
                          align: 'center',
                          headerAlign: 'center',
                          renderCell: (params: GridRenderCellParams) => {
                            const val = params.value as number;
                            const bg  = correlationToColor(val);
                            const fg  = correlationTextColor(val);
                            return (
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 0.4,
                                  borderRadius: 1,
                                  backgroundColor: bg,
                                  color: fg,
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  minWidth: 60,
                                  textAlign: 'center',
                                }}
                              >
                                {val.toFixed(4)}
                              </Box>
                            );
                          },
                        },
                      ]}
                    />
                  );
                })()
              : (
                <Alert severity="info">
                  {corrData?.error ?? 'Need at least 2 INR holdings with sufficient price history.'}
                </Alert>
              )}
            </Box>
          </Paper>
        </>
      ) : !error ? (
        <Alert severity="info">No data available. Ensure NIFTYBEES price history has been populated by the scheduler.</Alert>
      ) : null}

      <Divider sx={{ my: 3 }} />

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <Typography variant="caption" color="text.disabled" display="block" textAlign="center">
        Beta and correlation are computed using NIFTYBEES as a Nifty 50 proxy. Hedge lot suggestions are
        indicative only and do not constitute financial advice. Nifty futures lot size is 75 units.
        Margin requirements are approximate (10% of contract value) and vary by broker.
      </Typography>
    </Container>
  );
};

export default HoldingAnalysis;