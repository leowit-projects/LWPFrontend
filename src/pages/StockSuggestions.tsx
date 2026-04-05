import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  CircularProgress,
  Alert,
  SelectChangeEvent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { StockSuggestion, StockSuggestionCreate } from '../types';
import { stockSuggestionsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIA_EXCHANGES   = ['NSE', 'BSE'];
const US_EXCHANGES      = ['NYSE', 'NASDAQ', 'AMEX', 'OTC'];
const INDIA_EXCHANGE_SET = new Set(INDIA_EXCHANGES);
const US_EXCHANGE_SET    = new Set(US_EXCHANGES);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const TIME_RANGE_OPTIONS = [
  { label: '3 M',  months: 3  },
  { label: '6 M',  months: 6  },
  { label: '1 Y',  months: 12 },
  { label: 'All',  months: 0  },   // 0 = no limit
];

const FLOOR_MONTH = '2026-01';  // earliest month to show in "All" mode

function buildYears(): number[] {
  const cur = new Date().getFullYear();
  const years: number[] = [];
  for (let y = cur + 1; y >= 2020; y--) years.push(y);
  return years;
}

/** "2024-03" → "Mar-24" */
function colHeader(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

/** "2024-03" → "Mar 2024" */
function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/** Return the last N months as "YYYY-MM" strings, newest last. */
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (ym >= FLOOR_MONTH) months.push(ym);   // ← drop anything before Jan 2026
  }
  return months;
}

// ── Pivot helpers ─────────────────────────────────────────────────────────────

interface CellData {
  price: number | null;
  recommenders: string[];
  ids: number[];          // for delete — pick first
}

type PivotMap = Map<string, Map<string, CellData>>;   // symbol → month → cell

function buildPivot(rows: StockSuggestion[]): PivotMap {
  const pivot: PivotMap = new Map();
  for (const s of rows) {
    if (!pivot.has(s.stock_symbol)) pivot.set(s.stock_symbol, new Map());
    const mmap = pivot.get(s.stock_symbol)!;
    if (!mmap.has(s.recommendation_month)) {
      mmap.set(s.recommendation_month, { price: null, recommenders: [], ids: [] });
    }
    const cell = mmap.get(s.recommendation_month)!;
    if (s.recommended_price != null) cell.price = s.recommended_price;
    cell.recommenders.push(s.recommended_by);
    cell.ids.push(s.id);
  }
  return pivot;
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM: StockSuggestionCreate = {
  stock_symbol: '',
  exchange: '',
  recommendation_month: '',
  recommended_price: null,
  recommended_by: '',
};

// ── PivotTable sub-component ──────────────────────────────────────────────────

interface PivotTableProps {
  title: string;
  currency: string;
  rows: StockSuggestion[];
  months: string[];           // columns to display
  loading: boolean;
  isAdmin: boolean;
  onDeleteClick: (id: number, symbol: string, month: string) => void;
}

const PivotTable: React.FC<PivotTableProps> = ({
  title, currency, rows, months, loading, isAdmin, onDeleteClick,
}) => {
  const pivot = useMemo(() => buildPivot(rows), [rows]);

  // Only symbols that appear in the filtered months
  const symbols = useMemo(() => {
    const monthSet = new Set(months);
    const seen: string[] = [];
    pivot.forEach((mmap, sym) => {
      if ([...mmap.keys()].some((m) => monthSet.has(m))) seen.push(sym);
    });
    return seen.sort();
  }, [pivot, months]);

  const colCount = months.length + 1 + (isAdmin ? 1 : 0);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        <Chip label={`${symbols.length} stocks`} size="small" variant="outlined" />
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight: 480, overflowX: 'auto' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {/* Sticky symbol column */}
              <TableCell
                sx={{
                  fontWeight: 700,
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  backgroundColor: 'background.paper',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  minWidth: 110,
                }}
              >
                Symbol
              </TableCell>

              {months.map((m) => (
                <TableCell
                  key={m}
                  align="right"
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 90 }}
                >
                  {colHeader(m)}
                </TableCell>
              ))}

              {isAdmin && (
                <TableCell
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    right: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    width: 56,
                  }}
                />
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : symbols.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No suggestions found
                </TableCell>
              </TableRow>
            ) : (
              symbols.map((sym) => {
                const mmap = pivot.get(sym);
                return (
                  <TableRow key={sym} hover sx={{ '&:last-child td': { border: 0 } }}>
                    {/* Symbol */}
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'background.paper',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        zIndex: 1,
                      }}
                    >
                      {sym}
                    </TableCell>

                    {/* One cell per month */}
                    {months.map((m) => {
                      const cell = mmap?.get(m);
                      if (!cell) {
                        return (
                          <TableCell key={m} align="right" sx={{ color: 'text.disabled' }}>
                            —
                          </TableCell>
                        );
                      }

                      const priceLabel =
                        cell.price != null
                          ? cell.price.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '✓';

                      const multipleRecommenders = cell.recommenders.length > 1;
                      const tooltipText = cell.recommenders
                        .map((r) =>
                          cell.ids.length > 1
                            ? `${r}${cell.price != null ? ` (${currency}${cell.price})` : ''}`
                            : r,
                        )
                        .join(', ');

                      return (
                        <TableCell key={m} align="right">
                          <Tooltip
                            title={`Recommended by: ${tooltipText}`}
                            placement="top"
                            arrow
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                cursor: 'default',
                              }}
                            >
                              <Typography
                                variant="body2"
                                component="span"
                                color={cell.price != null ? 'text.primary' : 'success.main'}
                                fontWeight={cell.price != null ? 500 : 400}
                              >
                                {priceLabel}
                              </Typography>
                              {multipleRecommenders && (
                                <Chip
                                  label={cell.recommenders.length}
                                  size="small"
                                  sx={{ height: 16, fontSize: '0.65rem', ml: 0.25 }}
                                />
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      );
                    })}

                    {/* Delete — picks the first id for this symbol */}
                    {isAdmin && (
                      <TableCell
                        padding="none"
                        align="center"
                        sx={{
                          position: 'sticky',
                          right: 0,
                          backgroundColor: 'background.paper',
                          borderLeft: '1px solid',
                          borderColor: 'divider',
                          zIndex: 1,
                        }}
                      >
                        <Tooltip title="Delete latest entry for this stock">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              // Find the most-recent month with data and delete its first entry
                              const monthArray = [...(mmap?.keys() ?? [])]
                                .filter((mk) => months.includes(mk))
                                .sort();
                              const latestMonth = monthArray[monthArray.length - 1];
                              if (!latestMonth) return;
                              const cell = mmap?.get(latestMonth);
                              if (!cell) return;
                              onDeleteClick(cell.ids[0], sym, latestMonth);
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const StockSuggestions: React.FC = () => {
  const { isAdmin } = useAuth();

  const [allSuggestions, setAllSuggestions] = useState<StockSuggestion[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [successMsg, setSuccessMsg]         = useState<string | null>(null);
  const [timeRange, setTimeRange]           = useState<number>(12);  // default 1 Y

  // Add dialog
  const now = new Date();
  const [addOpen, setAddOpen]       = useState(false);
  const [form, setForm]             = useState<StockSuggestionCreate>(EMPTY_FORM);
  const [formMonth, setFormMonth]   = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [formYear,  setFormYear]    = useState(String(now.getFullYear()));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof StockSuggestionCreate, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; symbol: string; month: string } | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const years = useMemo(buildYears, []);

  // ── Fetch all once ────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockSuggestionsAPI.getAll();
      setAllSuggestions(res.data);
    } catch {
      setError('Failed to load stock suggestions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Compute visible columns from time range ───────────────────────────────

  const visibleMonths = useMemo(() => {
    if (timeRange === 0) {
      const monthSet = new Set(allSuggestions.map((s) => s.recommendation_month));
      return [...monthSet].filter((m) => m >= FLOOR_MONTH).sort();  // ← clamp here too
    }
    return lastNMonths(timeRange);
  }, [timeRange, allSuggestions]);

  // ── Filter suggestions to visible months ──────────────────────────────────

  const monthSet = useMemo(() => new Set(visibleMonths), [visibleMonths]);

  const filtered = useMemo(
    () => allSuggestions.filter((s) => monthSet.has(s.recommendation_month)),
    [allSuggestions, monthSet],
  );

  const indiaSuggestions = useMemo(
    () => filtered.filter((s) => INDIA_EXCHANGE_SET.has(s.exchange.toUpperCase())),
    [filtered],
  );
  const usSuggestions = useMemo(
    () => filtered.filter((s) => US_EXCHANGE_SET.has(s.exchange.toUpperCase())),
    [filtered],
  );

  // ── Add ───────────────────────────────────────────────────────────────────

  const openAddDialog = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    const n = new Date();
    setFormMonth(String(n.getMonth() + 1).padStart(2, '0'));
    setFormYear(String(n.getFullYear()));
    setAddOpen(true);
  };

  const validateForm = (): boolean => {
    const errs: Partial<Record<keyof StockSuggestionCreate, string>> = {};
    if (!form.stock_symbol.trim())    errs.stock_symbol    = 'Symbol is required';
    if (!form.exchange.trim())         errs.exchange         = 'Exchange is required';
    if (!form.recommended_by.trim())   errs.recommended_by  = 'Recommender is required';
    if (form.recommended_price != null && form.recommended_price <= 0)
      errs.recommended_price = 'Price must be greater than 0';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload: StockSuggestionCreate = {
        ...form,
        stock_symbol:         form.stock_symbol.trim().toUpperCase(),
        exchange:             form.exchange.trim().toUpperCase(),
        recommended_by:       form.recommended_by.trim(),
        recommendation_month: `${formYear}-${formMonth}`,
        recommended_price:    form.recommended_price || null,
      };
      const res = await stockSuggestionsAPI.create(payload);
      setAllSuggestions((prev) => [...prev, res.data]);
      setAddOpen(false);
      setSuccessMsg(`Suggestion for ${payload.stock_symbol} added.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create suggestion.';
      setFormErrors((prev) => ({ ...prev, stock_symbol: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await stockSuggestionsAPI.delete(deleteTarget.id);
      setAllSuggestions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSuccessMsg(`Suggestion for ${deleteTarget.symbol} (${formatMonth(deleteTarget.month)}) deleted.`);
    } catch {
      setError('Failed to delete suggestion.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 2 }}>

      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Typography variant="h6" fontWeight={700}>Stock Suggestions</Typography>
          <Chip
            label={`${filtered.length} entries`}
            color="primary"
            variant="outlined"
            size="small"
          />
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          {/* Time range toggle */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={timeRange}
            onChange={(_e, val) => { if (val !== null) setTimeRange(val); }}
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <ToggleButton key={opt.label} value={opt.months} sx={{ px: 1.5, py: 0.4 }}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<Add />} onClick={openAddDialog}>
              Add Suggestion
            </Button>
          )}
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      )}

      {/* Pivot tables */}
      <Box display="flex" flexDirection="column" gap={3}>
        <PivotTable
          title="🇮🇳 India (NSE / BSE)"
          currency="₹"
          rows={indiaSuggestions}
          months={visibleMonths}
          loading={loading}
          isAdmin={isAdmin}
          onDeleteClick={(id, symbol, month) => setDeleteTarget({ id, symbol, month })}
        />
        <PivotTable
          title="🇺🇸 United States (NYSE / NASDAQ)"
          currency="$"
          rows={usSuggestions}
          months={visibleMonths}
          loading={loading}
          isAdmin={isAdmin}
          onDeleteClick={(id, symbol, month) => setDeleteTarget({ id, symbol, month })}
        />
      </Box>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Stock Suggestion</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

          <TextField
            label="Stock Symbol *" size="small" fullWidth
            value={form.stock_symbol}
            onChange={(e) => setForm((p) => ({ ...p, stock_symbol: e.target.value.toUpperCase() }))}
            error={!!formErrors.stock_symbol}
            helperText={formErrors.stock_symbol || 'e.g. RELIANCE, AAPL'}
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />

          <FormControl size="small" fullWidth error={!!formErrors.exchange}>
            <InputLabel>Exchange *</InputLabel>
            <Select
              label="Exchange *"
              value={form.exchange}
              onChange={(e: SelectChangeEvent) => setForm((p) => ({ ...p, exchange: e.target.value }))}
            >
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary">— India —</Typography>
              </MenuItem>
              {INDIA_EXCHANGES.map((ex) => <MenuItem key={ex} value={ex}>{ex}</MenuItem>)}
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary">— United States —</Typography>
              </MenuItem>
              {US_EXCHANGES.map((ex) => <MenuItem key={ex} value={ex}>{ex}</MenuItem>)}
            </Select>
            {formErrors.exchange && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {formErrors.exchange}
              </Typography>
            )}
          </FormControl>

          <Box>
            <Typography variant="body2" color="text.secondary" mb={0.75}>
              Recommendation Month *
            </Typography>
            <Box display="flex" gap={1.5}>
              <FormControl size="small" sx={{ flex: 2 }}>
                <InputLabel>Month</InputLabel>
                <Select label="Month" value={formMonth}
                  onChange={(e: SelectChangeEvent) => setFormMonth(e.target.value)}>
                  {MONTH_NAMES.map((name, idx) => (
                    <MenuItem key={idx} value={String(idx + 1).padStart(2, '0')}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Year</InputLabel>
                <Select label="Year" value={formYear}
                  onChange={(e: SelectChangeEvent) => setFormYear(e.target.value)}>
                  {years.map((y) => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <TextField
            label="Recommended Price (optional)" size="small" fullWidth type="number"
            value={form.recommended_price ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setForm((p) => ({ ...p, recommended_price: val === '' ? null : Number(val) }));
            }}
            error={!!formErrors.recommended_price}
            helperText={formErrors.recommended_price || 'Leave blank if no target price'}
            inputProps={{ min: 0, step: '0.01' }}
          />

          <TextField
            label="Recommended By *" size="small" fullWidth
            value={form.recommended_by}
            onChange={(e) => setForm((p) => ({ ...p, recommended_by: e.target.value }))}
            error={!!formErrors.recommended_by}
            helperText={formErrors.recommended_by || 'Analyst or source name'}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSubmit} disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <Add />}>
            {submitting ? 'Adding…' : 'Add Suggestion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Suggestion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete the suggestion for <strong>{deleteTarget?.symbol}</strong> in{' '}
            {deleteTarget ? formatMonth(deleteTarget.month) : ''}? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default StockSuggestions;