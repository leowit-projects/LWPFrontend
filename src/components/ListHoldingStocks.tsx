import { useState, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  Button,
  CircularProgress,
  } from '@mui/material';
import {
  ShowChart,
  PieChart as PushPin,
  PushPinOutlined,
  Delete,
  } from '@mui/icons-material';
import { holdingAccountsAPI } from '../api/client';
import { calculate52WeekPosition, 
    getProgressColor, 
    getAvgPriceBuySignal, 
    formatCurrency, 
    POSITION_SIZE_BRACKETS, 
    formatPercentage, 
    getProfitLossColor, 
    formatDaysAgo, 
    getDaysAgoColor } from './HoldingsShared';

// ─── FII 3-quarter trend ──────────────────────────────────────────────────────
// Points arrive newest-first from the API. Change = latest − oldest (pp).
// Direction: RISING/FALLING when every q-o-q move agrees; MIXED on reversal.
interface FiiTrend {
  change: number;
  direction: 'RISING' | 'FALLING' | 'MIXED';
  latest: number;
  points: Array<{ quarter: string; percent: number }>;
}

const getFiiTrend = (points?: Array<{ quarter: string; percent: number }>): FiiTrend | null => {
  if (!points || points.length < 2) return null;
  const chrono = [...points.slice(0, 3)].reverse(); // oldest → newest
  const change = chrono[chrono.length - 1].percent - chrono[0].percent;
  const deltas = chrono.slice(1).map((pt, i) => pt.percent - chrono[i].percent);
  const direction = deltas.every((d) => d > 0) ? 'RISING' : deltas.every((d) => d < 0) ? 'FALLING' : 'MIXED';
  return { change, direction, latest: chrono[chrono.length - 1].percent, points: points.slice(0, 3) };
};

const FII_TREND_STYLE: Record<FiiTrend['direction'], { arrow: string; color: string }> = {
  RISING: { arrow: '▲', color: '#2e7d32' },
  FALLING: { arrow: '▼', color: '#d32f2f' },
  MIXED: { arrow: '◆', color: '#f57f17' },
};

// Special values for the Tags filter menu
const TAG_UNTAGGED = '(No tags)';
const TAG_CLEAR = '__clear__';

export default function ListHoldingStocks({ stocks, currency, onDelete, accountId, onRefresh }: {
  stocks: Array<{
    id: number; symbol: string; name?: string | null; sector?: string | null;
    quantity: number; average_price: number; last_close_price?: number | null;
    price_52w_low?: number | null; price_52w_high?: number | null;
    moving_average_20?: number | null; moving_average_200?: number | null;
    invested_value: number; current_value: number; profit_loss: number;
    profit_loss_percentage: number; currency: string; updated_at: string;
    pe_ratio?: number | null; rsi_index?: number | null;
    pin_to_sell?: boolean;   // ← new
    sell_alerts?: string[];  // ← new
    tags?: string[];
    fii_shareholdings?: Array<{ quarter: string; percent: number }>;
  }>;
  currency: string;
  onDelete: (id: number, name: string) => void;
  accountId: string;      // ← new
  onRefresh: () => void;  // ← new
}) {
  type SortKey = 'symbol' | 'invested_value' | 'current_value' | 'profit_loss' | 'profit_loss_percentage' | 'quantity' | 'average_price' | '52w_position' | 'pe_ratio' | 'fii_change';
  const [sortBy, setSortBy] = useState<SortKey>('52w_position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [positionSizeFilter, setPositionSizeFilter] = useState<string>('All');
  const [sectorButtonFilter, setSectorButtonFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]); 
  const [pinLoading, setPinLoading] = useState<number | null>(null);

  const handlePinToggle = async (holdingId: number, currentPin: boolean): Promise<void> => {
    setPinLoading(holdingId);
    try {
      await holdingAccountsAPI.updatePinToSell(accountId, holdingId, !currentPin);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle pin-to-sell:', err);
    } finally {
      setPinLoading(null);
    }
  };

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'symbol' ? 'asc' : 'desc'); }
  };

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => set.add(s.sector || 'Unknown'));
    return ['All', ...Array.from(set).sort()];
  }, [stocks]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => (s.tags ?? []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [stocks]);

  const showFii = currency === 'INR'; // screener.in shareholding data exists for Indian stocks only

  const positionSizeBrackets = currency === 'USD' ? POSITION_SIZE_BRACKETS.USD : POSITION_SIZE_BRACKETS.INR;

  const filteredByButton = sectorButtonFilter === 'All' ? stocks : sectorButtonFilter === 'Others' ? stocks.filter((s) => !['Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Technology', 'Energy', 'Infrastructure'].includes(s.sector || '')) : stocks.filter((s) => s.sector === sectorButtonFilter);
  const filteredBySector = sectorFilter === 'All' ? filteredByButton : filteredByButton.filter((s) => (s.sector || 'Unknown') === sectorFilter);
  const activeBracket = positionSizeFilter === 'All' ? null : positionSizeBrackets.find((b) => b.label === positionSizeFilter) ?? null;
  const filteredBySize = activeBracket === null ? filteredBySector : filteredBySector.filter((s) => s.invested_value >= activeBracket.min && s.invested_value < activeBracket.max);
  const filteredStocks = tagFilter.length === 0 ? filteredBySize : filteredBySize.filter((s) => {
    const stockTags = s.tags ?? [];
    if (tagFilter.includes(TAG_UNTAGGED) && stockTags.length === 0) return true;
    return stockTags.some((tag) => tagFilter.includes(tag));
  });
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === 'symbol') { const cmp = (a.symbol ?? '').localeCompare(b.symbol ?? ''); return sortDir === 'asc' ? cmp : -cmp; }
    if (sortBy === '52w_position') {
      const posA = calculate52WeekPosition(a.last_close_price ?? null, a.price_52w_low ?? null, a.price_52w_high ?? null);
      const posB = calculate52WeekPosition(b.last_close_price ?? null, b.price_52w_low ?? null, b.price_52w_high ?? null);
      return sortDir === 'asc' ? posA - posB : posB - posA;
    }
    if (sortBy === 'fii_change') {
      const fa = getFiiTrend(a.fii_shareholdings)?.change ?? Number.NEGATIVE_INFINITY;
      const fb = getFiiTrend(b.fii_shareholdings)?.change ?? Number.NEGATIVE_INFINITY;
      return sortDir === 'asc' ? fa - fb : fb - fa;
    }
    if (sortBy === 'pe_ratio') {
      const peA = a.pe_ratio ?? 0;
      const peB = b.pe_ratio ?? 0;
      return sortDir === 'asc' ? peA - peB : peB - peA;
    }
    return sortDir === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
  });

  const handleGetSymbols = () => {
    const selectedStockData = stocks.filter(stock => selectedStocks.includes(stock.symbol)).map(stock => ({ symbol: stock.symbol, price: stock.last_close_price ? Math.round(stock.last_close_price) : 0 })).sort((a, b) => a.symbol.localeCompare(b.symbol));
    const formattedOutput = selectedStockData.map(s => `${s.symbol} @ ₹${s.price}`).join('\n');
    navigator.clipboard.writeText(formattedOutput).then(() => { alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}\n\nCopied to clipboard!`); }).catch(err => { console.error('Failed to copy to clipboard:', err); alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}`); });
  };

  const sortHeader = (col: SortKey, label: string) => (
    <TableSortLabel active={sortBy === col} direction={sortBy === col ? sortDir : 'desc'} onClick={() => handleSort(col)}>
      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">{label}</Typography>
    </TableSortLabel>
  );

  const stickyCellStyle = {
    position: 'sticky',
    left: 0,
    background: 'white', // Prevents underlying text from showing through
    zIndex: 1,           // Ensures cell stays on top of scrolling content
  };

  const stickyHeaderStyle = {
    ...stickyCellStyle,
    zIndex: 2,           // Needs higher z-index than the body cells
  };

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box sx={{ p: 1.5, background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShowChart sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">Stock Holdings</Typography>
        <Chip label={(sectorFilter !== 'All' || sectorButtonFilter !== 'All' || positionSizeFilter !== 'All' || tagFilter.length > 0) ? `${sortedStocks.length} / ${stocks.length}` : stocks.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {selectedStocks.length > 0 && (<Button variant="contained" size="small" onClick={handleGetSymbols} sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 600, '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' } }}>Get Symbols ({selectedStocks.length})</Button>)}
          {tagOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', '&.Mui-focused': { color: 'white' } }}>Tags</InputLabel>
              <Select
                multiple
                value={tagFilter}
                label="Tags"
                onChange={(e) => {
                  const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                  setTagFilter(value.includes(TAG_CLEAR) ? [] : value);
                }}
                renderValue={(selected) => selected.length === 1 ? selected[0] : `${selected.length} tags`}
                sx={{ color: 'white', fontSize: '0.82rem', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}
              >
                <MenuItem value={TAG_CLEAR} disabled={tagFilter.length === 0} sx={{ fontSize: '0.82rem', py: 0.5, fontWeight: 600, color: 'primary.main' }}>
                  Clear filter
                </MenuItem>
                <MenuItem value={TAG_UNTAGGED} sx={{ fontSize: '0.82rem', py: 0.25 }}>
                  <Checkbox checked={tagFilter.includes(TAG_UNTAGGED)} size="small" sx={{ py: 0.25 }} />
                  <em>{TAG_UNTAGGED}</em>
                </MenuItem>
                {tagOptions.map((tag) => (
                  <MenuItem key={tag} value={tag} sx={{ fontSize: '0.82rem', py: 0.25 }}>
                    <Checkbox checked={tagFilter.includes(tag)} size="small" sx={{ py: 0.25 }} />
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', '&.Mui-focused': { color: 'white' } }}>Position Size</InputLabel>
            <Select value={positionSizeFilter} label="Position Size" onChange={(e) => setPositionSizeFilter(e.target.value)} sx={{ color: 'white', fontSize: '0.82rem', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' }, '.MuiSvgIcon-root': { color: 'white' } }}>
              <MenuItem value="All" sx={{ fontSize: '0.82rem' }}>All</MenuItem>
              {positionSizeBrackets.map((b) => <MenuItem key={b.label} value={b.label} sx={{ fontSize: '0.82rem' }}>{b.label}</MenuItem>)}
            </Select>
          </FormControl>
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
          {['All', 'Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Technology', 'Energy', 'Infrastructure', 'Others'].map((sec) => (
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
              {/* ── Pin header ── */}
              <TableCell padding="checkbox">
                <Tooltip title="Pin for sell tracking" arrow>
                  <PushPinOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </TableCell>
              <TableCell sx={stickyHeaderStyle}>{sortHeader('symbol', 'Symbol')}</TableCell>
              <TableCell><Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Sector</Typography></TableCell>
              <TableCell align="center">{sortHeader('52w_position', 'Last Close / 52W Range')}</TableCell>
              <TableCell align="center">{sortHeader('pe_ratio', 'P/E')}</TableCell>
              <TableCell align="right">{sortHeader('quantity', 'Qty')}</TableCell>
              <TableCell align="right">{sortHeader('average_price', 'Avg. Price')}</TableCell>
              <TableCell align="right">{sortHeader('invested_value', 'Invested')}</TableCell>
              <TableCell align="right">{sortHeader('current_value', 'Current')}</TableCell>
              <TableCell align="right">{sortHeader('profit_loss', 'P&L')}</TableCell>
              <TableCell align="right">{sortHeader('profit_loss_percentage', 'P&L %')}</TableCell>
              {showFii && <TableCell align="center">{sortHeader('fii_change', 'FII 3Q')}</TableCell>}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedStocks.map((s) => (
              <TableRow key={s.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedStocks.includes(s.symbol)} onChange={(e) => { if (e.target.checked) { setSelectedStocks([...selectedStocks, s.symbol]); } else { setSelectedStocks(selectedStocks.filter(sym => sym !== s.symbol)); } }} size="small" />
                </TableCell>
                
                {/* ── Pin cell ── */}
                <TableCell padding="checkbox">
                  {pinLoading === s.id ? (
                    <CircularProgress size={16} sx={{ display: 'block', m: 'auto' }} />
                  ) : (
                  <Tooltip
                      title={s.pin_to_sell ? 'Unpin from sell tracking' : 'Pin for sell tracking'}
                      arrow
                    >
                      <IconButton
                        size="small"
                        onClick={() => handlePinToggle(s.id, !!s.pin_to_sell)}
                        sx={{
                          color: s.pin_to_sell
                          ? (s.sell_alerts?.length ? 'error.main' : 'warning.main')                 : 'action.disabled',
                        }}
                      >
                      {s.pin_to_sell ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell sx={stickyCellStyle}>
                  <Link
                    component={RouterLink}
                    to={`/list-stocks/${s.symbol}/history`}
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
                        {s.symbol}
                    </span>
                  </Link> <br />
                  <Typography variant="caption" color={getDaysAgoColor(s.updated_at)}>{formatDaysAgo(s.updated_at)}</Typography>
                </TableCell>
                <TableCell>
                  {s.sector ? <Chip label={s.sector} size="small" sx={{ height: 19, fontSize: '0.68rem' }} /> : <Typography variant="body2" color="text.disabled">—</Typography>}
                  {(s.tags ?? []).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mt: 0.4 }}>
                      {(s.tags ?? []).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', color: 'text.secondary', '& .MuiChip-label': { px: 0.7 } }} />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  {s.price_52w_low != null && s.price_52w_high != null && s.last_close_price != null ? (
                    <Tooltip title={<Box><Typography variant="caption" display="block">Current: {formatCurrency(s.last_close_price, s.currency)}</Typography><Typography variant="caption" display="block">52w Low: {formatCurrency(s.price_52w_low, s.currency)}</Typography><Typography variant="caption" display="block">52w High: {formatCurrency(s.price_52w_high, s.currency)}</Typography><Typography variant="caption" display="block" fontWeight={600}>Position: {calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high).toFixed(1)}%</Typography></Box>} arrow>
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
                        <Typography variant="caption" fontSize="0.6rem" color="text.primary" textAlign="center">
                          <span style={{ fontWeight: 700 }}>
                            {s.last_close_price ? formatCurrency(s.last_close_price, s.currency) : '—'}
                          </span>
                          {s.last_close_price && (
                            <span style={{ fontWeight: 100 }}>
                              {' (' + calculate52WeekPosition(s.last_close_price, s.price_52w_low, s.price_52w_high).toFixed(1) + '%)'}
                            </span>
                          )}
                        </Typography>
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
                <TableCell align="right"><Typography variant="body2">{s.pe_ratio}</Typography></TableCell>
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
                {showFii && (
                  <TableCell align="center">
                    {(() => {
                      const trend = getFiiTrend(s.fii_shareholdings);
                      if (!trend) return <Typography variant="caption" color="text.disabled">—</Typography>;
                      const style = FII_TREND_STYLE[trend.direction];
                      return (
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" display="block" fontWeight={600}>FII holding</Typography>
                              {trend.points.map((pt) => (
                                <Typography key={pt.quarter} variant="caption" display="block">{pt.quarter}: {pt.percent.toFixed(2)}%</Typography>
                              ))}
                              {trend.points.length < 3 && (
                                <Typography variant="caption" display="block" fontStyle="italic">Only {trend.points.length} quarters available</Typography>
                              )}
                              {trend.direction === 'MIXED' && (
                                <Typography variant="caption" display="block" fontStyle="italic">Trend reversed within window</Typography>
                              )}
                            </Box>
                          }
                          arrow
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color: style.color }}>
                              {style.arrow} {trend.change >= 0 ? '+' : ''}{trend.change.toFixed(1)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{trend.latest.toFixed(1)}%</Typography>
                          </Box>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                )}
                <TableCell align="center"><IconButton size="small" color="error" onClick={() => onDelete(s.id, s.symbol)}><Delete fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}