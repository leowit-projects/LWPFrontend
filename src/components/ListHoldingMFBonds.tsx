import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  } from '@mui/material';
import {
  AccountBalance,
  PieChart as PieChartIcon,
  MonetizationOn,
  Delete,
  } from '@mui/icons-material';
import {
  BondHoldingDetail,
  MutualFundHoldingDetail,
  } from '../types';
import { formatCurrency, formatDaysAgo, getDaysAgoColor } from './HoldingsShared';

export default function ListHoldingMFBonds({ mutualFunds, bonds, currency, onDelete }: { mutualFunds: MutualFundHoldingDetail[]; bonds: BondHoldingDetail[]; currency: string; onDelete: (id: number, name: string) => void; }) {
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