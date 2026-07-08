import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Grid,
  } from '@mui/material';
import {
  ShowChart,
  PieChart as Delete,
  } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  HoldingAccountsResponse,
  } from '../types';
import { formatCurrency, 
    formatPercentage, 
    getProfitLossColor, 
    formatDaysAgo, 
    getDaysAgoColor } from './HoldingsShared';

export default function ListHoldingETFs({ etfs, currency, onDelete }: { etfs: HoldingAccountsResponse['holdings']['etfs']; currency: string; onDelete: (id: number, name: string) => void; }) {
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