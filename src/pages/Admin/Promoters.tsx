import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Close,
  Check,
  Link as LinkIcon,
} from '@mui/icons-material';
import { promotersAPI, stockAPI } from '../../api/client';
import { Promoter, PromoterHolding, StockSymbol } from '../../types';

const Promoters: React.FC = () => {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [stocks, setStocks] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Add/Edit promoter dialog
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedPromoter, setSelectedPromoter] = useState<Promoter | null>(null);
  const [formData, setFormData] = useState<{ name: string; integrity_score: string }>({
    name: '',
    integrity_score: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Connect-stocks / holdings dialog
  const [holdingsDialogOpen, setHoldingsDialogOpen] = useState<boolean>(false);
  const [holdingsPromoter, setHoldingsPromoter] = useState<Promoter | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<StockSymbol | null>(null);
  const [pendingPercent, setPendingPercent] = useState<string>('');
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [editingPercent, setEditingPercent] = useState<string>('');
  const [holdingsSaving, setHoldingsSaving] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    try {
      const [promotersRes, stocksRes] = await Promise.all([promotersAPI.getAll(), stockAPI.getAll('list')]);
      setPromoters(promotersRes.data);
      setStocks(stocksRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Add/Edit promoter dialog handlers ─────────────────────────────────────

  const handleOpenDialog = (): void => {
    setEditMode(false);
    setSelectedPromoter(null);
    setFormData({ name: '', integrity_score: '' });
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (promoter: Promoter): void => {
    setEditMode(true);
    setSelectedPromoter(promoter);
    setFormData({
      name: promoter.name,
      integrity_score: promoter.integrity_score != null ? String(promoter.integrity_score) : '',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setEditMode(false);
    setSelectedPromoter(null);
  };

  const handleSubmit = async (): Promise<void> => {
    const name = formData.name.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        integrity_score: formData.integrity_score.trim() ? Number(formData.integrity_score) : undefined,
      };
      if (editMode && selectedPromoter) {
        await promotersAPI.update(selectedPromoter.id, payload);
      } else {
        await promotersAPI.create(payload);
      }
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Failed to save promoter:', error);
      alert(error.response?.data?.detail || 'Failed to save promoter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Delete this promoter? All their stock holdings will be removed too.')) return;
    try {
      await promotersAPI.delete(id);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete promoter:', error);
      alert(error.response?.data?.detail || 'Failed to delete promoter');
    }
  };

  // ── Connect-stocks / holdings dialog handlers ─────────────────────────────

  const handleOpenHoldingsDialog = (promoter: Promoter): void => {
    setHoldingsPromoter(promoter);
    setPendingSymbol(null);
    setPendingPercent('');
    setEditingHoldingId(null);
    setHoldingsDialogOpen(true);
  };

  const handleCloseHoldingsDialog = (): void => {
    setHoldingsDialogOpen(false);
    setHoldingsPromoter(null);
  };

  const alreadyAttachedSymbols = useMemo(
    () => new Set((holdingsPromoter?.holdings ?? []).map((h) => h.stock_symbol)),
    [holdingsPromoter]
  );

  const availableStocks = useMemo(
    () => stocks.filter((s) => !alreadyAttachedSymbols.has(s.symbol)),
    [stocks, alreadyAttachedSymbols]
  );

  const refreshHoldingsPromoter = async (promoterId: number): Promise<void> => {
    const res = await promotersAPI.getById(promoterId);
    setHoldingsPromoter(res.data);
    setPromoters((prev) => prev.map((p) => (p.id === promoterId ? res.data : p)));
  };

  const handleAddHolding = async (): Promise<void> => {
    if (!holdingsPromoter || !pendingSymbol || !pendingPercent.trim()) return;
    setHoldingsSaving(true);
    try {
      await promotersAPI.addHolding(holdingsPromoter.id, {
        stock_symbol: pendingSymbol.symbol,
        holding_percent: Number(pendingPercent),
      });
      setPendingSymbol(null);
      setPendingPercent('');
      await refreshHoldingsPromoter(holdingsPromoter.id);
    } catch (error: any) {
      console.error('Failed to add holding:', error);
      alert(error.response?.data?.detail || 'Failed to add holding');
    } finally {
      setHoldingsSaving(false);
    }
  };

  const handleStartEditHolding = (holding: PromoterHolding): void => {
    setEditingHoldingId(holding.id);
    setEditingPercent(String(holding.holding_percent));
  };

  const handleSaveEditHolding = async (): Promise<void> => {
    if (!holdingsPromoter || editingHoldingId == null || !editingPercent.trim()) return;
    setHoldingsSaving(true);
    try {
      await promotersAPI.updateHolding(holdingsPromoter.id, editingHoldingId, {
        holding_percent: Number(editingPercent),
      });
      setEditingHoldingId(null);
      await refreshHoldingsPromoter(holdingsPromoter.id);
    } catch (error: any) {
      console.error('Failed to update holding:', error);
      alert(error.response?.data?.detail || 'Failed to update holding');
    } finally {
      setHoldingsSaving(false);
    }
  };

  const handleDeleteHolding = async (holdingId: number): Promise<void> => {
    if (!holdingsPromoter) return;
    if (!window.confirm('Remove this stock holding?')) return;
    setHoldingsSaving(true);
    try {
      await promotersAPI.deleteHolding(holdingsPromoter.id, holdingId);
      await refreshHoldingsPromoter(holdingsPromoter.id);
    } catch (error: any) {
      console.error('Failed to delete holding:', error);
      alert(error.response?.data?.detail || 'Failed to delete holding');
    } finally {
      setHoldingsSaving(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Promoters
      </Typography>

      <Paper>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
              Add New Promoter
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Name</TableCell>
                  <TableCell>Integrity Score</TableCell>
                  <TableCell>Stocks</TableCell>
                  <TableCell>Added On</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Loading…
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && promoters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No promoters yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {promoters.map((promoter) => {
                  const isExpanded = expandedIds.has(promoter.id);
                  return (
                    <React.Fragment key={promoter.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => toggleExpand(promoter.id)}
                            disabled={promoter.holdings.length === 0}
                          >
                            {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {promoter.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {promoter.integrity_score != null ? (
                            promoter.integrity_score.toFixed(1)
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${promoter.holdings.length} stock${promoter.holdings.length === 1 ? '' : 's'}`}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{new Date(promoter.created_at).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Connect stocks">
                            <IconButton size="small" color="primary" onClick={() => handleOpenHoldingsDialog(promoter)}>
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(promoter)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(promoter.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ my: 1.5, ml: 6 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 600, border: 0 }}>Symbol</TableCell>
                                    <TableCell sx={{ fontWeight: 600, border: 0 }}>Company</TableCell>
                                    <TableCell sx={{ fontWeight: 600, border: 0 }} align="right">Holding %</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {promoter.holdings.map((holding) => {
                                    const stock = stocks.find((s) => s.symbol === holding.stock_symbol);
                                    return (
                                      <TableRow key={holding.id}>
                                        <TableCell sx={{ border: 0 }}>{holding.stock_symbol}</TableCell>
                                        <TableCell sx={{ border: 0 }}>{stock?.name ?? '—'}</TableCell>
                                        <TableCell sx={{ border: 0 }} align="right">
                                          {holding.holding_percent.toFixed(2)}%
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      {/* Add/Edit Promoter Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit Promoter' : 'Add New Promoter'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="e.g. Tata Sons"
            />
            <TextField
              label="Integrity Score"
              type="number"
              value={formData.integrity_score}
              onChange={(e) => setFormData({ ...formData, integrity_score: e.target.value })}
              fullWidth
              placeholder="1 - 10"
              inputProps={{ min: 1, max: 10, step: 0.1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting || !formData.name.trim()}>
            {submitting ? 'Saving...' : editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect Stocks / Holdings Dialog */}
      <Dialog open={holdingsDialogOpen} onClose={handleCloseHoldingsDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Connected Stocks{holdingsPromoter ? ` — ${holdingsPromoter.name}` : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Autocomplete
              size="small"
              options={availableStocks}
              getOptionLabel={(option) => `${option.symbol}${option.name ? ' - ' + option.name : ''}`}
              isOptionEqualToValue={(option, value) => option.symbol === value.symbol}
              value={pendingSymbol}
              onChange={(_, newValue) => setPendingSymbol(newValue)}
              sx={{ flex: 1 }}
              renderInput={(params) => <TextField {...params} label="Stock symbol" placeholder="Search symbol" />}
            />
            <TextField
              label="Holding %"
              type="number"
              size="small"
              value={pendingPercent}
              onChange={(e) => setPendingPercent(e.target.value)}
              sx={{ width: 130 }}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />
            <Button
              variant="outlined"
              onClick={handleAddHolding}
              disabled={!pendingSymbol || !pendingPercent.trim() || holdingsSaving}
              sx={{ height: 40 }}
            >
              Add
            </Button>
          </Box>

          <Box sx={{ mt: 3 }}>
            {(holdingsPromoter?.holdings ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No stocks connected yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell align="right">Holding %</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(holdingsPromoter?.holdings ?? []).map((holding) => (
                    <TableRow key={holding.id}>
                      <TableCell>{holding.stock_symbol}</TableCell>
                      <TableCell align="right">
                        {editingHoldingId === holding.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editingPercent}
                            onChange={(e) => setEditingPercent(e.target.value)}
                            sx={{ width: 100 }}
                            inputProps={{ min: 0, max: 100, step: 0.01 }}
                          />
                        ) : (
                          `${holding.holding_percent.toFixed(2)}%`
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingHoldingId === holding.id ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton size="small" color="primary" onClick={handleSaveEditHolding} disabled={holdingsSaving}>
                                <Check fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => setEditingHoldingId(null)}>
                                <Close fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Adjust %">
                              <IconButton size="small" color="primary" onClick={() => handleStartEditHolding(holding)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteHolding(holding.id)}
                                disabled={holdingsSaving}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHoldingsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Promoters;
