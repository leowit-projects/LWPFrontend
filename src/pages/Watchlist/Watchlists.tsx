import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Visibility } from '@mui/icons-material';
import { darken } from '@mui/material/styles';
import { watchlistAPI } from '../../api/client';
import { WatchlistGroupFull, WatchlistItem } from '../../types';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ height: '100%' }}>
      {value === index && children}
    </Box>
  );
}

// Remaining viewport height below the fixed header (Layout's AppBar/Toolbar + main padding).
const pageHeight = { xs: 'calc(100vh - 53px)', sm: 'calc(100vh - 59px)' };

type SortCriteria = '52w_position' | 'pb_ratio' | 'pe_ratio' | 'rsi_index';

const sortOptions: { value: SortCriteria; label: string }[] = [
  { value: '52w_position', label: '52W Position' },
  { value: 'pb_ratio', label: 'P/B Ratio' },
  { value: 'pe_ratio', label: 'P/E Ratio' },
  { value: 'rsi_index', label: 'RSI Index' },
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
  return criteria === '52w_position' ? `${(value * 100).toFixed(0)}%` : value.toFixed(2);
}

// 5-tier scale from strongest buy signal to strongest caution, based on the selected metric.
type Signal = 'strong_buy' | 'buy' | 'caution' | 'strong_caution' | null;

// accent = solid, bold cell background. text = the contrasting color on top of it.
const SIGNAL_STYLE: Record<NonNullable<Signal>, { accent: string; text: string }> = {
  strong_buy: { accent: '#03b00b', text: '#ffffff' }, // green
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
  const [groups, setGroups] = useState<WatchlistGroupFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sortBy, setSortBy] = useState<SortCriteria>('52w_position');

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
    } catch (err) {
      console.error('Error loading watchlist groups:', err);
      setError('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', height: pageHeight, display: 'flex', flexDirection: 'column' }}>
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
          <Typography variant="body2">No watchlists yet</Typography>
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
            </Box>

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

          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 'auto', flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
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
                      {group.watchlist_count}
                    </Box>
                  </Box>
                }
              />
            ))}
          </Tabs>

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
                          sx={{
                            width: 170,
                            flex: '0 0 170px',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 1.5,
                            overflow: 'hidden',
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
                            <Typography variant="subtitle2" fontWeight={700} noWrap title={watchlist.name}>
                              {watchlist.name}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.85, flexShrink: 0 }}>
                              {watchlist.item_count}
                            </Typography>
                          </Box>

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
                                return (
                                  <Paper
                                    key={item.id}
                                    variant="outlined"
                                    sx={{
                                      px: 0.75,
                                      py: 0.4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 0.5,
                                      borderRadius: 0.75,
                                      bgcolor: style ? style.accent : 'background.paper',
                                      borderColor: style ? style.accent : 'divider',
                                      '&:hover': {
                                        bgcolor: style ? darken(style.accent, 0.15) : 'action.hover',
                                      },
                                    }}
                                  >
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography
                                        variant="caption"
                                        fontWeight={700}
                                        noWrap
                                        sx={{ display: 'block', color: style?.text }}
                                      >
                                        {item.symbol}
                                      </Typography>
                                      {item.holding_quantities != null && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontSize: '0.62rem',
                                            display: 'block',
                                            lineHeight: 1.2,
                                            color: style?.text ?? 'text.disabled',
                                            opacity: style ? 0.85 : 1,
                                          }}
                                        >
                                          qty {item.holding_quantities}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontWeight: 700,
                                        fontVariantNumeric: 'tabular-nums',
                                        color: style ? style.text : 'text.secondary',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {formatSortValue(value, sortBy)}
                                    </Typography>
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
    </Box>
  );
};

export default Watchlists;
