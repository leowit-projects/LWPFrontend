import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  Link,
  Tooltip,
  Tabs,
  Tab,
  Button,
  Snackbar,
} from '@mui/material';
import {
  PieChart as Lightbulb,
  Star,
  } from '@mui/icons-material';
import { DataGrid, 
    GridColDef, 
    GridRenderCellParams, 
    GridRowSelectionModel, 
    GridFooterContainer, 
    GridPagination } from '@mui/x-data-grid';
import {
  HoldingRecommendation,
  } from '../types';
import { NAMED_SECTORS, formatCurrency, formatPrice } from './HoldingsShared';

type RecTabType = 'BUY' | 'SELL' | 'HOLD';

export default function ListHoldingRecommendations({ recommendations, underSectors, stockSectorMap, currency }: {
  recommendations: HoldingRecommendation[]; underSectors: string[]; stockSectorMap: Record<string, string>; currency: string;
}) {
  const [recTab, setRecTab] = useState<RecTabType>('BUY');
  // 'exclude' with empty ids = "all rows selected" — gives select-all-by-default
  // and keeps working as tab switches change the row set.
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({ type: 'exclude', ids: new Set() });
  const [copySnackbar, setCopySnackbar] = useState(false);

  const activeRecs = recommendations.filter((r) => r.is_active);
  const tabCounts: Record<RecTabType, number> = {
    BUY: activeRecs.filter((r) => r.recommendation_type === 'BUY').length,
    SELL: activeRecs.filter((r) => r.recommendation_type === 'SELL').length,
    HOLD: activeRecs.filter((r) => r.recommendation_type === 'HOLD').length,
  };
  const tabRows = activeRecs.filter((r) => r.recommendation_type === recTab);

  // Header select-all flips the model to { type: 'exclude' }, where ids are the
  // DESELECTED rows — derive the real selection instead of reading ids.size.
  const selectedRows = selectionModel.type === 'include'
    ? tabRows.filter((r) => selectionModel.ids.has(r.id))
    : tabRows.filter((r) => !selectionModel.ids.has(r.id));

  const purchaseSubtotal = selectedRows.reduce(
    (sum, r) => sum + (r.purchase_quantity ?? 0) * (r.price_last_close ?? 0), 0
  );

  const isUnderInvested = (symbol: string): boolean => {
    const sec = stockSectorMap[symbol] || '';
    const isNamed = NAMED_SECTORS.includes(sec);
    return isNamed ? underSectors.includes(sec) : underSectors.includes('Others');
  };

  const handleGetSymbols = (): void => {
    const lines = selectedRows.map((r) => {
      const limitPrice = Math.ceil(1.01 * r.price_last_close);
      return `${r.recommendation_type} - ${r.stock_symbol} - ${limitPrice} - ${r.purchase_quantity}`;
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => setCopySnackbar(true));
  };

  const splitIntoSentences = (text: string) =>
    text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(Boolean);

  const allColumns: GridColDef[] = [
    {
      field: 'rank',
      headerName: 'Rank',
      width: 100,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const rank = p.value as number | null;
        if (rank == null) return null;
        const medalColor = rank === 1 ? '#f5a623' : rank === 2 ? '#9e9e9e' : rank === 3 ? '#cd7f32' : '#667eea';
        const medalBg   = rank === 1 ? '#fff8e1' : rank === 2 ? '#f5f5f5' : rank === 3 ? '#fbe9e7' : '#f0f4ff';
        return (
          <Tooltip title={`Rank #${rank} — most crashed stocks first`}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: medalBg, border: `2px solid ${medalColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" fontWeight={800} sx={{ color: medalColor, fontSize: '0.7rem', lineHeight: 1 }}>{rank}</Typography>
              </Box>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'stock_symbol',
      headerName: 'Symbol',
      width: 150,
      renderCell: (p: GridRenderCellParams) => {
        const priority = isUnderInvested(p.row.stock_symbol);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            <Link
                component={RouterLink}
                to={`/list-stocks/${p.value}/history`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  fontWeight: 600,
                  color: 'secondary.main',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.dark',
                  },
                }}
              >
                <span>
                    {p.value}
                </span>
              </Link>
            {priority && (<Chip label="▲" size="small" sx={{ height: 17, fontSize: '0.62rem', bgcolor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }} />)}
          </Box>
        );
      },
    },
    // {
    //   field: 'recommendation_type',
    //   headerName: 'Action',
    //   width: 100,
    //   renderCell: (p: GridRenderCellParams) => {
    //     const map: Record<string, { bg: string; fg: string }> = { BUY: { bg: '#e8f5e9', fg: '#2e7d32' }, SELL: { bg: '#ffebee', fg: '#c62828' }, HOLD: { bg: '#fff8e1', fg: '#f57f17' } };
    //     const c = map[p.value as string] || { bg: '#f5f5f5', fg: '#555' };
    //     return <Chip label={p.value as string} size="small" sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, minWidth: 52 }} />;
    //   },
    // },
    {
      field: 'current_average_price',
      headerName: 'Avg / LTP',
      width: 165,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const avgPrice = p.value as number;
        const lastClose = p.row.price_last_close as number;
        const pctLoss = avgPrice > 0 ? (avgPrice - lastClose) / avgPrice * 100 : null;

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" fontWeight={700} color="primary" noWrap>
              {formatPrice(avgPrice, currency)} / {formatPrice(lastClose, currency)}
            </Typography>
            {pctLoss !== null && (
              <Typography variant="caption" color={pctLoss > 0 ? 'error' : 'success.main'}>
                {pctLoss > 0 ? '▼' : '▲'} {Math.abs(pctLoss).toFixed(1)}%
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'invested_value',
      headerName: 'Invested',
      width: 125,
      type: 'number',
      valueGetter: (_, row: HoldingRecommendation) => (row.current_quantity ?? 0) * (row.current_average_price ?? 0),
      renderCell: (p: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <Typography variant="body2" fontWeight={700}>{formatCurrency(p.value as number, currency)}</Typography>
        </Box>
      ),
    },
    {
      field: 'purchase_quantity',
      headerName: 'Qty',
      width: 80,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
          <Typography variant="body2" fontWeight={700} color="primary">{p.value as number}</Typography>
        </Box>
      ),
    },
    {
      field: 'purchase_value',
      headerName: 'Purchase Value',
      width: 135,
      type: 'number',
      valueGetter: (_, row: HoldingRecommendation) => (row.purchase_quantity ?? 0) * (row.price_last_close ?? 0),
      renderCell: (p: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <Typography variant="body2" fontWeight={700} color="primary">{formatCurrency(p.value as number, currency)}</Typography>
        </Box>
      ),
    },
    {
      field: 'pe_ratio',
      headerName: 'P/E',
      width: 100,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const pe = p.value as number | null;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" color={pe !== null && pe > 0 ? 'text.primary' : 'text.secondary'} fontWeight={pe !== null && pe > 0 ? 700 : 400}>
              {pe !== null && pe > 0 ? pe.toFixed(1) : 'N/A'}
            </Typography>
          </Box>
          
        );
      },  
    },
    {
      field: 'rsi_index',
      headerName: 'RSI',
      width: 100,
      type: 'number',
      renderCell: (p: GridRenderCellParams) => {
        const rsi = p.value as number | null;
        const color = rsi !== null ? (rsi < 30 ? 'success.main' : rsi > 70 ? 'error.main' : 'text.primary') : 'text.secondary';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" color={color} fontWeight={rsi !== null ? 700 : 400}>
              {rsi !== null ? rsi.toFixed(0) : 'N/A'}
            </Typography>
          </Box>
        );
      },  
    },
    {
      field: 'notes',
      headerName: 'Notes',
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (p: GridRenderCellParams) => {
        const text = p.value as string | null;
        if (!text) return <Typography variant="body2" color="text.disabled">—</Typography>;
        const sentences = splitIntoSentences(text);
        return (
          <Tooltip title={text} placement="top-start" arrow>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', maxWidth: '100%' }}>
              {sentences.map((s, i) => (
                <span key={i}>
                  {s}
                  {i < sentences.length - 1 && <br />}
                </span>
              ))}
            </Typography>
          </Tooltip>
        );
      },
    },
  ];

  // Qty & Purchase Value are only meaningful for BUY recommendations
  const BUY_ONLY_FIELDS = ['purchase_quantity', 'purchase_value'];
  const columns: GridColDef[] = recTab === 'BUY'
    ? allColumns
    : allColumns.filter((c) => !BUY_ONLY_FIELDS.includes(c.field));

  // Custom footer: dynamic Purchase Value subtotal over SELECTED rows (BUY tab)
  const RecFooter = (): React.ReactElement => (
    <GridFooterContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 2 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
          {selectedRows.length} selected
        </Typography>
        {recTab === 'BUY' && (
          <Typography variant="body2" fontWeight={800} sx={{ color: '#667eea' }}>
            Purchase Value: {formatCurrency(purchaseSubtotal, currency)}
          </Typography>
        )}
      </Box>
      <GridPagination />
    </GridFooterContainer>
  );

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      {/* ── Header bar ── */}
      <Box sx={{ p: 1.5, background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Lightbulb sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">Stock Recommendations</Typography>
        <Chip label={`${tabRows.length} shown`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'white', fontWeight: 700, height: 20 }} />
        {selectedRows.length > 0 && (
          <Chip label={`${selectedRows.length} selected`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, height: 20 }} />
        )}
        {underSectors.length > 0 && (<Chip icon={<Star sx={{ color: '#f5a623 !important', fontSize: '14px !important' }} />} label="★ = priority sector" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontSize: '0.7rem', height: 20 }} />)}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={selectedRows.length === 0 ? 'Select rows to copy symbols' : `Copy ${selectedRows.length} symbol(s)`}>
            <span>
              <Button
                size="small"
                variant="outlined"
                disabled={selectedRows.length === 0}
                onClick={handleGetSymbols}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.72rem', py: 0.25, px: 1.25, '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.2)' } }}
              >
                Get Symbols
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* ── BUY / SELL / HOLD tabs ── */}
      <Tabs
        value={recTab}
        onChange={(_, v: RecTabType) => setRecTab(v)}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fafafa', minHeight: 40, '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.82rem', minHeight: 40, py: 0.5 } }}
        TabIndicatorProps={{ style: { height: 3, borderRadius: 2 } }}
      >
        <Tab value="BUY" label={`BUY (${tabCounts.BUY})`} sx={{ '&.Mui-selected': { color: '#2e7d32' } }} />
        <Tab value="SELL" label={`SELL (${tabCounts.SELL})`} sx={{ '&.Mui-selected': { color: '#c62828' } }} />
        <Tab value="HOLD" label={`HOLD (${tabCounts.HOLD})`} sx={{ '&.Mui-selected': { color: '#f57f17' } }} />
      </Tabs>

      {/* ── Table ── */}
      <Box sx={{ height: 800, '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' } }}>
        <DataGrid
          rows={tabRows}
          columns={columns}
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(model) => setSelectionModel(model)}
          slots={{ footer: RecFooter }}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: { sortModel: [{ field: 'rank', sort: 'asc' }] },
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          getRowClassName={(params) => isUnderInvested(params.row.stock_symbol) ? 'priority-row' : ''}
          getRowHeight={() => 'auto'}
          sx={{ 
            border: 'none', 
            '& .priority-row': { 
              bgcolor: '#fff8e1', 
              '&:hover': { 
                bgcolor: '#ffecb3' 
              } 
            }, 
            '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8f9ff' },
            // prevents clipping of tall cells
            '& .MuiDataGrid-cell': {
              alignItems: 'flex-start',
              py: 1,
            },
          }}
        />
      </Box>

      {/* ── Copy feedback ── */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={3000}
        onClose={() => setCopySnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setCopySnackbar(false)} sx={{ width: '100%' }}>
          {selectedRows.length} symbol(s) copied to clipboard
        </Alert>
      </Snackbar>
    </Paper>
  );
}