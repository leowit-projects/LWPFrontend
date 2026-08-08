import React, { useState, useEffect, useMemo } from 'react';
import { Box, Container, Typography, Paper, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Alert } from '@mui/material';
import { DataGrid, GridColDef, GridColumnGroupingModel, GridRenderCellParams } from '@mui/x-data-grid';
import { ShowChart, InfoOutlined } from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import { stockAPI } from '../api/client';
import type { StockSymbol } from '../types';

const RATIO_EXPLANATIONS: Record<string, string> = {
  pe_ratio:
    "P/E (Price to Earnings) = Share price ÷ EPS. It tells you how many rupees you pay for ₹1 of annual profit. LIC at P/E ~8.5 means you pay ₹8.5 per ₹1 of earnings. HDFC Bank trades around 18-20, many FMCG stocks at 50+. Low P/E can mean undervalued — or that the market expects trouble ahead. That's the contrarian's core question: cheap, or cheap for a reason?",
  pb_ratio:
    "P/B (Price to Book) = Share price ÷ book value per share. Book value is assets minus liabilities — roughly what shareholders would get if the company liquidated. P/B under 1 means the market values the company below its net assets. Most useful for banks, insurers, and asset-heavy businesses; nearly useless for IT companies whose value is people, not assets.",
  roe:
    "ROE (Return on Equity) = Net profit ÷ shareholders' equity. This is the quality filter. A company earning 20% ROE compounds shareholder wealth twice as fast as one at 10%. The classic value trap is a low P/B stock with a low ROE — cheap assets that earn nothing.",
  debt_to_equity:
    "Debt-to-Equity = Total debt ÷ equity. Under 0.5 is comfortable for most sectors; above 2 is risky. Debt magnifies both profits and losses. (Skip this for banks — borrowing is their business.)",
  operating_margin:
    "Operating margin = Operating profit ÷ revenue. Shows pricing power and efficiency. Compare within a sector: Asian Paints at ~18-20% vs a smaller paint company at 8% tells you who has the moat.",
};

function renderRatioHeader(label: string, field: keyof typeof RATIO_EXPLANATIONS) {
  return () => (
    <Tooltip
      arrow
      title={
        <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-wrap' }}>
          {RATIO_EXPLANATIONS[field]}
        </Typography>
      }
    >
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="body2" fontWeight={700}>{label}</Typography>
        <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
      </Box>
    </Tooltip>
  );
}

function renderNumber(decimals = 2, suffix = '') {
  return (params: GridRenderCellParams) =>
    params.value == null ? (
      <Typography variant="body2" color="text.disabled">—</Typography>
    ) : (
      <Typography variant="body2">{Number(params.value).toFixed(decimals)}{suffix}</Typography>
    );
}

function renderPriceChange(params: GridRenderCellParams<StockSymbol>) {
  const pct = params.row.price_change_pct;
  const abs = params.row.price_change;
  if (pct == null) return <Typography variant="body2" color="text.disabled">—</Typography>;
  const color = pct >= 0 ? 'success.main' : 'error.main';
  return (
    <Typography variant="body2" fontWeight={600} sx={{ color }}>
      {pct >= 0 ? '▲' : '▼'} {abs != null ? Math.abs(abs).toFixed(2) : ''} ({Math.abs(pct).toFixed(2)}%)
    </Typography>
  );
}

const columns: GridColDef[] = [
  {
    field: 'symbol',
    headerName: 'Symbol',
    minWidth: 110,
    renderCell: (params: GridRenderCellParams) => (
      <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
    ),
  },
  { field: 'name', headerName: 'Company', minWidth: 180, flex: 1 },

  // Market Snapshot group
  { field: 'price_last_close', headerName: 'Last Close', minWidth: 110, align: 'right', headerAlign: 'right', renderCell: renderNumber(2) },
  { field: 'price_change_pct', headerName: 'Daily Change', minWidth: 150, align: 'right', headerAlign: 'right', renderCell: renderPriceChange },
  { field: 'price_ma_20d', headerName: '20d MA', minWidth: 100, align: 'right', headerAlign: 'right', renderCell: renderNumber(2) },
  { field: 'price_ma_200d', headerName: '200d MA', minWidth: 100, align: 'right', headerAlign: 'right', renderCell: renderNumber(2) },
  { field: 'dividend_yield', headerName: 'Dividend Yield', minWidth: 120, align: 'right', headerAlign: 'right', renderCell: renderNumber(2, '%') },
  { field: 'book_value', headerName: 'Book Value', minWidth: 110, align: 'right', headerAlign: 'right', renderCell: renderNumber(2) },
  { field: 'eps', headerName: 'EPS', minWidth: 90, align: 'right', headerAlign: 'right', renderCell: renderNumber(2) },

  // Key Ratios group — each with an explainer tooltip on the header
  { field: 'pb_ratio', headerName: 'P/B', minWidth: 90, align: 'right', headerAlign: 'right', renderHeader: renderRatioHeader('P/B', 'pb_ratio'), renderCell: renderNumber(2) },
  { field: 'pe_ratio', headerName: 'P/E', minWidth: 90, align: 'right', headerAlign: 'right', renderHeader: renderRatioHeader('P/E', 'pe_ratio'), renderCell: renderNumber(2) },
  { field: 'roe', headerName: 'ROE', minWidth: 100, align: 'right', headerAlign: 'right', renderHeader: renderRatioHeader('ROE', 'roe'), renderCell: renderNumber(2, '%') },
  { field: 'debt_to_equity', headerName: 'Debt/Equity', minWidth: 130, align: 'right', headerAlign: 'right', renderHeader: renderRatioHeader('Debt/Equity', 'debt_to_equity'), renderCell: renderNumber(2) },
  { field: 'operating_margin', headerName: 'Op. Margin', minWidth: 120, align: 'right', headerAlign: 'right', renderHeader: renderRatioHeader('Op. Margin', 'operating_margin'), renderCell: renderNumber(2, '%') },
];

const columnGroupingModel: GridColumnGroupingModel = [
  {
    groupId: 'market_snapshot',
    headerName: 'Market Snapshot',
    children: [
      { field: 'price_last_close' },
      { field: 'price_change_pct' },
      { field: 'price_ma_20d' },
      { field: 'price_ma_200d' },
      { field: 'dividend_yield' },
      { field: 'book_value' },
      { field: 'eps' },
    ],
  },
  {
    groupId: 'key_ratios',
    headerName: 'Key Ratios',
    children: [
      { field: 'pb_ratio' },
      { field: 'pe_ratio' },
      { field: 'roe' },
      { field: 'debt_to_equity' },
      { field: 'operating_margin' },
    ],
  },
];

const SectorAnalysis: React.FC = () => {
  const [stocks, setStocks] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    stockAPI
      .getAll('list')
      .then((r) => setStocks(r.data))
      .catch(() => setError('Failed to load stocks.'))
      .finally(() => setLoading(false));
  }, []);

  const sectors = useMemo(
    () =>
      Array.from(
        new Set(
          stocks
            .map((s) => s.sector_industry?.split(' - ')[0])
            .filter((s): s is string => !!s)
        )
      ).sort(),
    [stocks]
  );

  useEffect(() => {
    if (!selectedSector && sectors.length > 0) setSelectedSector(sectors[0]);
  }, [sectors, selectedSector]);

  const filteredStocks = useMemo(
    () => stocks.filter((s) => s.sector_industry?.split(' - ')[0] === selectedSector),
    [stocks, selectedSector]
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 3 }}>
      <Box
        sx={{
          mb: 2,
          px: 2.5,
          py: 2,
          borderRadius: 2,
          background: 'linear-gradient(120deg, #1a237e, #1565c0)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <ShowChart sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h6" fontWeight={800}>Sector Analysis</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Market snapshot and key ratios by sector
          </Typography>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <FormControl sx={{ minWidth: 300 }} size="small">
          <InputLabel>Sector</InputLabel>
          <Select
            value={selectedSector}
            label="Sector"
            onChange={(e: SelectChangeEvent<string>) => setSelectedSector(e.target.value)}
          >
            {sectors.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={filteredStocks}
          getRowId={(row) => row.symbol}
          columns={columns}
          columnGroupingModel={columnGroupingModel}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          sx={{ '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
        />
      </Paper>
    </Container>
  );
};

export default SectorAnalysis;
