import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Checkbox,
  Button,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Chip,
} from '@mui/material';
import { Visibility, Add, MoreVert, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { watchlistAPI } from '../../api/client';
import { AssetType, WatchlistGroupFull, WatchlistFull, WatchlistItem } from '../../types';
import { SymbolOption, useSymbolOptions, getErrorMessage } from './watchlistShared';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ height: '100%' }}>
      {value === index && children}
    </Box>
  );
}

// Remaining viewport height below the fixed header (Layout's AppBar/Toolbar + main padding).
const pageHeight = { xs: 'calc(100vh - 53px)', sm: 'calc(100vh - 59px)' };

type SortCriteria = '52w_position' | 'pb_ratio' | 'pe_ratio' | 'rsi_index' | 'dividend_yield';

const sortOptions: { value: SortCriteria; label: string }[] = [
  { value: '52w_position', label: '52W Position' },
  { value: 'pb_ratio', label: 'P/B Ratio' },
  { value: 'pe_ratio', label: 'P/E Ratio' },
  { value: 'rsi_index', label: 'RSI Index' },
  { value: 'dividend_yield', label: 'Dividend Yield' },
];

// Position of the last close within the 52-week range, 0 (at low) to 1 (at high).
function get52wPosition(item: WatchlistItem): number | null {
  const { price_last_close, price_52w_low, price_52w_high } = item;
  if (price_last_close == null || price_52w_low == null || price_52w_high == null) return null;
  if (price_52w_high === price_52w_low) return null;
  return (price_last_close - price_52w_low) / (price_52w_high - price_52w_low);
}

function getSortValue(item: WatchlistItem, criteria: SortCriteria): number | null {
  return criteria === '52w_position' ? get52wPosition(item) : item[criteria];
}

function formatSortValue(value: number | null, criteria: SortCriteria): string {
  if (value == null) return '—';
  if (criteria === '52w_position') return `${(value * 100).toFixed(0)}%`;
  if (criteria === 'dividend_yield') return `${value.toFixed(2)}%`;
  return value.toFixed(2);
}

// 5-tier scale from strongest buy signal to strongest caution, based on the selected metric.
type Signal = 'strong_buy' | 'buy' | 'caution' | 'strong_caution' | null;

// accent = solid, bold cell background. text = the contrasting color on top of it.
const SIGNAL_STYLE: Record<NonNullable<Signal>, { accent: string; text: string }> = {
  strong_buy: { accent: '#008407', text: '#ffffff' }, // green
  buy: { accent: '#7ede11', text: '#1b3e0a' }, // light green (dark text — too light for white)
  caution: { accent: '#e77117', text: '#ffffff' }, // orange
  strong_caution: { accent: '#ab0606', text: '#ffffff' }, // red
};

function getSignal(value: number | null, criteria: SortCriteria): Signal {
  if (value == null) return null;
  if (criteria === '52w_position') {
    const pct = value * 100;
    if (pct <= 15) return 'strong_buy';
    if (pct <= 33) return 'buy';
    if (pct < 76) return null;
    if (pct <= 88) return 'caution';
    return 'strong_caution';
  }
  if (criteria === 'rsi_index') {
    if (value <= 30) return 'strong_buy';
    if (value >= 70) return 'strong_caution';
    return null;
  }
  return null;
}

function sortItems(items: WatchlistItem[], criteria: SortCriteria): WatchlistItem[] {
  return [...items].sort((a, b) => {
    const av = getSortValue(a, criteria);
    const bv = getSortValue(b, criteria);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv;
  });
}

const Watchlists: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<WatchlistGroupFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sortBy, setSortBy] = useState<SortCriteria>('52w_position');
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

  const symbolOptions = useSymbolOptions();

  // Rename dialog — shared between groups and watchlists.
  const [renameTarget, setRenameTarget] = useState<{ type: 'group' | 'watchlist'; id: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // "More actions" menu — shared between the active group and each watchlist card.
  const [groupMenuAnchor, setGroupMenuAnchor] = useState<HTMLElement | null>(null);
  const [watchlistMenu, setWatchlistMenu] = useState<{ anchor: HTMLElement; watchlist: WatchlistFull } | null>(null);

  // "New Watchlist" dialog — adding a watchlist to an existing group.
  const [newWatchlistGroup, setNewWatchlistGroup] = useState<WatchlistGroupFull | null>(null);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);
  const [newWatchlistError, setNewWatchlistError] = useState<string | null>(null);

  // Inline "add symbols" row, open for at most one watchlist at a time.
  const [addItemsWatchlistId, setAddItemsWatchlistId] = useState<number | null>(null);
  const [pendingSymbols, setPendingSymbols] = useState<SymbolOption[]>([]);
  const [addingItems, setAddingItems] = useState(false);

  // Drag-and-drop of an item between watchlists.
  const [dragItem, setDragItem] = useState<{ itemId: number; watchlistId: number; assetType: AssetType; symbol: string } | null>(null);
  const [dragOverWatchlistId, setDragOverWatchlistId] = useState<number | null>(null);

  useEffect(() => {
    loadWatchlistGroups();
  }, []);

  const loadWatchlistGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await watchlistAPI.getGroupsFull();
      setGroups(response.data);
      setTabValue(0);
      setSelectedSymbols(new Set());
    } catch (err) {
      console.error('Error loading watchlist groups:', err);
      setError('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

  // Last close per symbol, across every group/watchlist — used to price the clipboard copy.
  const priceBySymbol = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const group of groups) {
      for (const watchlist of group.watchlists) {
        for (const item of watchlist.items) {
          if (!map.has(item.symbol)) map.set(item.symbol, item.price_last_close);
        }
      }
    }
    return map;
  }, [groups]);

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleCopySymbols = () => {
    const lines = Array.from(selectedSymbols)
      .sort((a, b) => a.localeCompare(b))
      .map((symbol) => {
        const price = priceBySymbol.get(symbol);
        return `${symbol} - ${price != null ? Math.round(price) : 0}`;
      });
    const formattedOutput = lines.join('\n');

    navigator.clipboard.writeText(formattedOutput).then(() => {
      alert(`Selected Symbols (${lines.length}):\n\n${formattedOutput}\n\nCopied to clipboard!`);
    }).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
      alert(`Selected Symbols (${lines.length}):\n\n${formattedOutput}`);
    });
  };

  // ── Rename (group or watchlist) ─────────────────────────────────────────
  const openRenameGroup = (group: WatchlistGroupFull) => {
    setGroupMenuAnchor(null);
    setRenameError(null);
    setRenameValue(group.name);
    setRenameTarget({ type: 'group', id: group.id, name: group.name });
  };

  const openRenameWatchlist = (watchlist: WatchlistFull) => {
    setWatchlistMenu(null);
    setRenameError(null);
    setRenameValue(watchlist.name);
    setRenameTarget({ type: 'watchlist', id: watchlist.id, name: watchlist.name });
  };

  // ── Add a watchlist to an existing group ────────────────────────────────
  const openAddWatchlist = (group: WatchlistGroupFull) => {
    setGroupMenuAnchor(null);
    setNewWatchlistError(null);
    setNewWatchlistName('');
    setNewWatchlistGroup(group);
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistGroup || !newWatchlistName.trim()) return;
    try {
      setCreatingWatchlist(true);
      setNewWatchlistError(null);
      const response = await watchlistAPI.createWatchlist(newWatchlistGroup.id, { name: newWatchlistName.trim() });
      const newWatchlist: WatchlistFull = { ...response.data, items: [] };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === newWatchlistGroup.id
            ? { ...g, watchlists: [...g.watchlists, newWatchlist], watchlist_count: g.watchlist_count + 1 }
            : g
        )
      );
      setNewWatchlistGroup(null);
    } catch (err) {
      setNewWatchlistError(getErrorMessage(err, 'Failed to create watchlist'));
    } finally {
      setCreatingWatchlist(false);
    }
  };

  const handleRenameSave = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      setRenameSaving(true);
      setRenameError(null);
      if (renameTarget.type === 'group') {
        const response = await watchlistAPI.updateGroup(renameTarget.id, { name: renameValue.trim() });
        setGroups((prev) => prev.map((g) => (g.id === renameTarget.id ? { ...g, name: response.data.name } : g)));
      } else {
        const response = await watchlistAPI.updateWatchlist(renameTarget.id, { name: renameValue.trim() });
        setGroups((prev) =>
          prev.map((g) => ({
            ...g,
            watchlists: g.watchlists.map((w) => (w.id === renameTarget.id ? { ...w, name: response.data.name } : w)),
          }))
        );
      }
      setRenameTarget(null);
    } catch (err) {
      setRenameError(getErrorMessage(err, 'Failed to rename'));
    } finally {
      setRenameSaving(false);
    }
  };

  // ── Delete (group or watchlist) ─────────────────────────────────────────
  const handleDeleteGroup = async (group: WatchlistGroupFull) => {
    setGroupMenuAnchor(null);
    if (!window.confirm(`Delete watchlist group "${group.name}" and all its watchlists? This cannot be undone.`)) return;
    try {
      await watchlistAPI.deleteGroup(group.id);
      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== group.id);
        setTabValue((t) => Math.min(t, Math.max(next.length - 1, 0)));
        return next;
      });
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete group'));
    }
  };

  const handleDeleteWatchlist = async (watchlist: WatchlistFull) => {
    setWatchlistMenu(null);
    if (!window.confirm(`Delete watchlist "${watchlist.name}" and all its items?`)) return;
    try {
      await watchlistAPI.deleteWatchlist(watchlist.id);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          watchlists: g.watchlists.filter((w) => w.id !== watchlist.id),
          watchlist_count: g.watchlists.some((w) => w.id === watchlist.id) ? g.watchlist_count - 1 : g.watchlist_count,
        }))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete watchlist'));
    }
  };

  // ── Add / remove items ──────────────────────────────────────────────────
  const openAddItems = (watchlist: WatchlistFull) => {
    setWatchlistMenu(null);
    setPendingSymbols([]);
    setAddItemsWatchlistId(watchlist.id);
  };

  const handleAddItems = async (watchlist: WatchlistFull) => {
    if (pendingSymbols.length === 0) return;
    try {
      setAddingItems(true);
      const added: WatchlistItem[] = [];
      for (const option of pendingSymbols) {
        const response = await watchlistAPI.addItem(watchlist.id, {
          asset_type: option.asset_type,
          stock_symbol_id: option.asset_type === AssetType.STOCK ? option.symbol : null,
          etf_symbol_id: option.asset_type === AssetType.ETF ? option.symbol : null,
        });
        added.push(response.data);
      }
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          watchlists: g.watchlists.map((w) =>
            w.id === watchlist.id ? { ...w, items: [...w.items, ...added], item_count: w.item_count + added.length } : w
          ),
        }))
      );
      setPendingSymbols([]);
      setAddItemsWatchlistId(null);
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to add symbol(s)'));
    } finally {
      setAddingItems(false);
    }
  };

  const handleRemoveItem = async (watchlist: WatchlistFull, item: WatchlistItem) => {
    try {
      await watchlistAPI.removeItem(watchlist.id, item.id);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          watchlists: g.watchlists.map((w) =>
            w.id === watchlist.id
              ? { ...w, items: w.items.filter((i) => i.id !== item.id), item_count: w.item_count - 1 }
              : w
          ),
        }))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to remove item'));
    }
  };

  // ── Drag-and-drop an item across watchlists ─────────────────────────────
  const handleMoveItem = async (
    dragged: { itemId: number; watchlistId: number; assetType: AssetType; symbol: string },
    toWatchlistId: number
  ) => {
    if (dragged.watchlistId === toWatchlistId) return;
    try {
      const response = await watchlistAPI.addItem(toWatchlistId, {
        asset_type: dragged.assetType,
        stock_symbol_id: dragged.assetType === AssetType.STOCK ? dragged.symbol : null,
        etf_symbol_id: dragged.assetType === AssetType.ETF ? dragged.symbol : null,
      });
      await watchlistAPI.removeItem(dragged.watchlistId, dragged.itemId);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          watchlists: g.watchlists.map((w) => {
            if (w.id === dragged.watchlistId) {
              return { ...w, items: w.items.filter((i) => i.id !== dragged.itemId), item_count: w.item_count - 1 };
            }
            if (w.id === toWatchlistId) {
              return { ...w, items: [...w.items, response.data], item_count: w.item_count + 1 };
            }
            return w;
          }),
        }))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to move item — it may already exist in the target watchlist'));
    }
  };

  return (
    <Box sx={{ width: '100%', height: pageHeight, pt: 2, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && groups.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary',
          }}
        >
          <Visibility sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            No watchlists yet
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/watchlists/new')}>
            New Watchlist Group
          </Button>
        </Box>
      )}

      {!loading && !error && groups.length > 0 && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Visibility sx={{ fontSize: 20, color: 'secondary.main' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Watchlists
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={() => navigate('/watchlists/new')}>
                New Group
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedSymbols.size > 0 && (
                <>
                  <Button variant="contained" color="primary" size="small" onClick={handleCopySymbols} sx={{ fontWeight: 600 }}>
                    Get Symbols ({selectedSymbols.size})
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => setSelectedSymbols(new Set())}>
                    Deselect All
                  </Button>
                </>
              )}

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="watchlist-sort-label">Sort by</InputLabel>
                <Select
                  labelId="watchlist-sort-label"
                  label="Sort by"
                  value={sortBy}
                  onChange={(e: SelectChangeEvent) => setSortBy(e.target.value as SortCriteria)}
                >
                  {sortOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 'auto', flex: 1, minWidth: 0 }}
            >
              {groups.map((group, i) => (
                <Tab
                  key={group.id}
                  sx={{ minHeight: 'auto', padding: '10px 20px', textTransform: 'none' }}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <span>{group.name}</span>
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          lineHeight: 1.6,
                          minWidth: 16,
                          textAlign: 'center',
                          borderRadius: 3,
                          px: 0.5,
                          bgcolor: tabValue === i ? 'secondary.main' : 'action.selected',
                          color: tabValue === i ? '#fff' : 'text.secondary',
                        }}
                      >
                        {group.watchlists.reduce((sum, w) => sum + w.items.length, 0)}
                      </Box>
                    </Box>
                  }
                />
              ))}
            </Tabs>

            {groups[tabValue] && (
              <IconButton
                size="small"
                sx={{ flexShrink: 0, mr: 0.5 }}
                onClick={(e) => setGroupMenuAnchor(e.currentTarget)}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            )}
          </Box>

          <Menu anchorEl={groupMenuAnchor} open={Boolean(groupMenuAnchor)} onClose={() => setGroupMenuAnchor(null)}>
            <MenuItem onClick={() => groups[tabValue] && openAddWatchlist(groups[tabValue])}>Add Watchlist</MenuItem>
            <MenuItem onClick={() => groups[tabValue] && openRenameGroup(groups[tabValue])}>Rename Group</MenuItem>
            <MenuItem onClick={() => groups[tabValue] && handleDeleteGroup(groups[tabValue])}>Delete Group</MenuItem>
          </Menu>

          <Box sx={{ flex: 1, minHeight: 0, pt: 1 }}>
            {groups.map((group, index) => (
              <TabPanel key={group.id} value={tabValue} index={index}>
                {group.watchlists.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                    No watchlists in this group
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', height: '100%', overflowX: 'auto' }}>
                    {[...group.watchlists]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((watchlist) => (
                        <Paper
                          key={watchlist.id}
                          elevation={1}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverWatchlistId(watchlist.id);
                          }}
                          onDragLeave={() =>
                            setDragOverWatchlistId((id) => (id === watchlist.id ? null : id))
                          }
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverWatchlistId(null);
                            if (dragItem) handleMoveItem(dragItem, watchlist.id);
                            setDragItem(null);
                          }}
                          sx={{
                            width: 280,
                            flex: '0 0 280px',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            outline: dragOverWatchlistId === watchlist.id ? '2px dashed' : 'none',
                            outlineColor: 'primary.main',
                            outlineOffset: -2,
                          }}
                        >
                          <Box
                            sx={{
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 0.5,
                              bgcolor: 'secondary.main',
                              color: '#fff',
                              px: 1,
                              py: 0.5,
                            }}
                          >
                            <Typography variant="subtitle2" fontWeight={700} noWrap title={watchlist.name} sx={{ minWidth: 0 }}>
                              {watchlist.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              <Typography variant="caption" sx={{ opacity: 0.85, mr: 0.25 }}>
                                {watchlist.item_count}
                              </Typography>
                              <IconButton
                                size="small"
                                sx={{ color: '#fff', p: 0.25 }}
                                onClick={(e) => setWatchlistMenu({ anchor: e.currentTarget, watchlist })}
                              >
                                <MoreVert sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            </Box>
                          </Box>

                          {addItemsWatchlistId === watchlist.id && (
                            <Box sx={{ p: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                              <Autocomplete
                                multiple
                                size="small"
                                options={symbolOptions}
                                getOptionLabel={(option) => option.symbol}
                                isOptionEqualToValue={(option, value) =>
                                  option.symbol === value.symbol && option.asset_type === value.asset_type
                                }
                                value={pendingSymbols}
                                onChange={(_, newValue) => setPendingSymbols(newValue)}
                                renderTags={(value, getTagProps) =>
                                  value.map((option, index) => (
                                    <Chip label={option.symbol} size="small" {...getTagProps({ index })} key={option.symbol} />
                                  ))
                                }
                                renderInput={(params) => <TextField {...params} placeholder="Search symbol" />}
                              />
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  fullWidth
                                  onClick={() => handleAddItems(watchlist)}
                                  disabled={pendingSymbols.length === 0 || addingItems}
                                >
                                  {addingItems ? <CircularProgress size={16} /> : 'Add'}
                                </Button>
                                <Button size="small" fullWidth onClick={() => setAddItemsWatchlistId(null)}>
                                  Cancel
                                </Button>
                              </Box>
                            </Box>
                          )}

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, overflowY: 'auto', p: 0.5 }}>
                            {watchlist.items.length === 0 ? (
                              <Typography variant="caption" color="text.disabled" sx={{ p: 0.5, fontStyle: 'italic' }}>
                                No items
                              </Typography>
                            ) : (
                              sortItems(watchlist.items, sortBy).map((item) => {
                                const value = getSortValue(item, sortBy);
                                const signal = getSignal(value, sortBy);
                                const style = signal ? SIGNAL_STYLE[signal] : null;
                                const isSelected = selectedSymbols.has(item.symbol);
                                return (
                                  <Paper
                                    key={item.id}
                                    variant="outlined"
                                    onClick={() => toggleSymbol(item.symbol)}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      setDragItem({
                                        itemId: item.id,
                                        watchlistId: watchlist.id,
                                        assetType: item.asset_type,
                                        symbol: item.symbol,
                                      });
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragEnd={() => {
                                      setDragItem(null);
                                      setDragOverWatchlistId(null);
                                    }}
                                    sx={{
                                      position: 'relative',
                                      px: 0.75,
                                      py: 0.4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 0.5,
                                      borderRadius: 0.75,
                                      cursor: 'grab',
                                      bgcolor: 'background.paper',
                                      borderColor: 'divider',
                                      outline: isSelected ? '2px solid' : 'none',
                                      outlineColor: 'primary.main',
                                      outlineOffset: -2,
                                      '&:hover': { bgcolor: 'action.hover' },
                                      '&:hover .remove-item-btn': { opacity: 1 },
                                    }}
                                  >
                                    <IconButton
                                      className="remove-item-btn"
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveItem(watchlist, item);
                                      }}
                                      sx={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -6,
                                        p: 0.15,
                                        opacity: 0,
                                        bgcolor: 'background.paper',
                                        border: 1,
                                        borderColor: 'divider',
                                        '&:hover': { bgcolor: 'error.main', color: '#fff' },
                                        '& .MuiSvgIcon-root': { fontSize: '0.7rem' },
                                      }}
                                    >
                                      <Close />
                                    </IconButton>
                                    {/* Column 1: checkbox + symbol + P/B·P/E + qty */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: '1 1 0', minWidth: 0 }}>
                                      <Checkbox
                                        checked={isSelected}
                                        onChange={() => {}}
                                        size="small"
                                        sx={{
                                          p: 0.25,
                                          '& .MuiSvgIcon-root': { fontSize: '0.85rem' },
                                        }}
                                      />
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
                                          {item.symbol}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          noWrap
                                          sx={{ fontSize: '0.62rem', display: 'block', lineHeight: 1.2, color: 'text.disabled' }}
                                        >
                                          P/B {item.pb_ratio != null ? item.pb_ratio.toFixed(2) : '—'} · P/E{' '}
                                          {item.pe_ratio != null ? item.pe_ratio.toFixed(2) : '—'}
                                        </Typography>
                                        {item.holding_quantities != null && (
                                          <Typography
                                            variant="caption"
                                            sx={{ fontSize: '0.62rem', display: 'block', lineHeight: 1.2, color: 'primary.main', fontWeight: 600 }}
                                          >
                                            HQ: <b>{item.holding_quantities}</b>
                                          </Typography>
                                        )}
                                        {item.average_price != null && item.average_price !== 0 && item.price_last_close != null && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontSize: '0.62rem',
                                              display: 'block',
                                              lineHeight: 1.2,
                                              fontWeight: 600,
                                              color: item.price_last_close >= item.average_price ? 'success.main' : 'error.main',
                                            }}
                                          >
                                            HP: {item.average_price.toFixed(2)} ({item.price_last_close >= item.average_price ? '▲' : '▼'}
                                            {Math.abs(((item.price_last_close - item.average_price) / item.average_price) * 100).toFixed(2)}%)
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>

                                    {/* Column 2: last close + daily change (change / % on separate lines) */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.1, flex: '0 0 54px' }}>
                                      <Typography
                                            variant="caption"
                                            sx={{
                                              fontSize: '0.62rem',
                                              display: 'block',
                                              lineHeight: 1.2,
                                              fontWeight: 700,
                                              fontVariantNumeric: 'tabular-nums',
                                              color: 'text.primary',
                                            }}
                                          >
                                            {item.price_last_close != null ? item.price_last_close.toFixed(2) : '—'}
                                      </Typography>
                                      {item.price_change_pct != null && (
                                        <>
                                          <Typography
                                            variant="caption"
                                            noWrap
                                            sx={{
                                              fontSize: '0.6rem',
                                              display: 'block',
                                              lineHeight: 1.2,
                                              fontWeight: 700,
                                              fontVariantNumeric: 'tabular-nums',
                                              color: item.price_change_pct >= 0 ? 'success.main' : 'error.main',
                                            }}
                                          >
                                            {item.price_change_pct >= 0 ? '▲' : '▼'}
                                            {item.price_change != null ? Math.abs(item.price_change).toFixed(2) : ''}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            noWrap
                                            sx={{
                                              fontSize: '0.6rem',
                                              display: 'block',
                                              lineHeight: 1.2,
                                              fontWeight: 700,
                                              fontVariantNumeric: 'tabular-nums',
                                              color: item.price_change_pct >= 0 ? 'success.main' : 'error.main',
                                            }}
                                          >
                                            ({Math.abs(item.price_change_pct).toFixed(2)}%)
                                          </Typography>
                                        </>
                                      )}
                                    </Box>

                                    {/* Column 3: current sort value */}
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', flex: '0 0 46px' }}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 700,
                                          fontVariantNumeric: 'tabular-nums',
                                          flexShrink: 0,
                                          px: 0.5,
                                          py: 0.1,
                                          borderRadius: 0.5,
                                          bgcolor: style ? style.accent : 'transparent',
                                          color: style ? style.text : 'text.secondary',
                                        }}
                                      >
                                        {formatSortValue(value, sortBy)}
                                      </Typography>
                                    </Box>
                                  </Paper>
                                );
                              })
                            )}
                          </Box>
                        </Paper>
                      ))}
                  </Box>
                )}
              </TabPanel>
            ))}
          </Box>
        </Box>
      )}

      <Menu
        anchorEl={watchlistMenu?.anchor ?? null}
        open={Boolean(watchlistMenu)}
        onClose={() => setWatchlistMenu(null)}
      >
        <MenuItem onClick={() => watchlistMenu && openRenameWatchlist(watchlistMenu.watchlist)}>Rename Watchlist</MenuItem>
        <MenuItem onClick={() => watchlistMenu && openAddItems(watchlistMenu.watchlist)}>Add Symbols</MenuItem>
        <MenuItem onClick={() => watchlistMenu && handleDeleteWatchlist(watchlistMenu.watchlist)}>Delete Watchlist</MenuItem>
      </Menu>

      <Dialog open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename {renameTarget?.type === 'group' ? 'Watchlist Group' : 'Watchlist'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
          />
          {renameError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {renameError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameSave} disabled={!renameValue.trim() || renameSaving}>
            {renameSaving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(newWatchlistGroup)} onClose={() => setNewWatchlistGroup(null)} maxWidth="xs" fullWidth>
        <DialogTitle>New Watchlist{newWatchlistGroup ? ` in ${newWatchlistGroup.name}` : ''}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            placeholder="e.g. Technology, ETF"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateWatchlist()}
          />
          {newWatchlistError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {newWatchlistError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewWatchlistGroup(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateWatchlist} disabled={!newWatchlistName.trim() || creatingWatchlist}>
            {creatingWatchlist ? <CircularProgress size={18} /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Watchlists;
