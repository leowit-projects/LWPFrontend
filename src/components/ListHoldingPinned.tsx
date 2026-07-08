import {
  Box,
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  } from '@mui/material';
import {
  PieChart as PushPin,
  } from '@mui/icons-material';
import { formatCurrency } from './HoldingsShared';

type SellAlertKey = 'PROFIT_10PCT' | 'RSI_OVERBOUGHT' | 'NEAR_52W_HIGH';

const SELL_ALERT_META: Record<SellAlertKey, { label: string; color: 'error' | 'warning' | 'info'; tooltip: string }> = {
  PROFIT_10PCT:   { label: '≥10% Profit',    color: 'error',   tooltip: 'Profit is 10% or more above avg buy price' },
  RSI_OVERBOUGHT: { label: 'RSI > 70',        color: 'warning', tooltip: 'RSI above 70 — stock may be overbought' },
  NEAR_52W_HIGH:  { label: 'Near 52W High',   color: 'info',    tooltip: 'Price is within 5% of the 52-week high' },
};
 
export default function ListHoldingPinned({
  stocks,
  currency,
}: {
  stocks: Array<{
    id: number; symbol: string; name?: string | null;
    quantity: number; average_price: number; last_close_price?: number | null;
    profit_loss_percentage: number; rsi_index?: number | null;
    price_52w_high?: number | null; pin_to_sell?: boolean; sell_alerts?: string[];
  }>;
  currency: string;
}) {
  const pinned = stocks.filter((s) => s.pin_to_sell);
  if (pinned.length === 0) return null;
 
  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, borderColor: 'warning.main', borderWidth: 1.5, borderRadius: 2, overflow: 'hidden' }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fff8e1' }}>
        <PushPin sx={{ color: 'warning.dark', fontSize: 18 }} />
        <Typography variant="subtitle1" fontWeight={700} color="warning.dark">
          Pinned for Sell
        </Typography>
        <Chip label={pinned.length} size="small" color="warning" sx={{ ml: 'auto', fontWeight: 700 }} />
      </Box>
 
      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Symbol</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Price</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>LTP</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>P&L %</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>RSI</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>52W High</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Alerts</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pinned.map((s) => {
              const alerts = (s.sell_alerts ?? []) as SellAlertKey[];
              const hasAlerts = alerts.length > 0;
              return (
                <TableRow
                  key={s.id}
                  sx={{ bgcolor: hasAlerts ? 'rgba(255,152,0,0.05)' : undefined, '&:last-child td': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{s.symbol}</Typography>
                    {s.name && <Typography variant="caption" color="text.secondary">{s.name}</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{s.quantity.toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatCurrency(s.average_price, currency)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {s.last_close_price != null ? formatCurrency(s.last_close_price, currency) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={s.profit_loss_percentage >= 0 ? 'success.main' : 'error.main'}
                    >
                      {s.profit_loss_percentage >= 0 ? '+' : ''}{s.profit_loss_percentage.toFixed(2)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={s.rsi_index != null && s.rsi_index > 70 ? 'warning.main' : 'text.primary'}
                      fontWeight={s.rsi_index != null && s.rsi_index > 70 ? 700 : 400}
                    >
                      {s.rsi_index != null ? s.rsi_index.toFixed(1) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {s.price_52w_high != null ? formatCurrency(s.price_52w_high, currency) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {alerts.length === 0 ? (
                        <Typography variant="caption" color="text.disabled">Monitoring…</Typography>
                      ) : (
                        alerts.map((alert) => {
                          const meta = SELL_ALERT_META[alert];
                          return (
                            <Tooltip key={alert} title={meta.tooltip} arrow>
                              <Chip label={meta.label} size="small" color={meta.color} variant="outlined" />
                            </Tooltip>
                          );
                        })
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}