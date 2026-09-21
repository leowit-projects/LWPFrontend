import { useState, useMemo, Fragment } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Collapse,
  } from '@mui/material';
import { AccountBalance, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { formatCurrency } from './HoldingsShared';
import { Promoter } from '../types';

const UNKNOWN_PROMOTER = 'Unknown';

interface PromoterStockRow {
  symbol: string;
  name?: string | null;
  invested: number;
}

interface PromoterGroup {
  key: string;
  name: string;
  integrityScore: number | null;
  totalInvested: number;
  stocks: PromoterStockRow[];
}

const integrityChipColor = (score: number | null): 'success' | 'warning' | 'error' | 'default' => {
  if (score == null) return 'default';
  if (score >= 7) return 'success';
  if (score >= 4) return 'warning';
  return 'error';
};

export default function ListHoldingPromoters({ stocks, promoters, currency }: {
  stocks: Array<{
    symbol: string;
    name?: string | null;
    invested_value: number;
    promoters?: Array<{ name: string; holding_percent: number }>;
  }>;
  promoters: Promoter[];
  currency: string;
}) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const integrityByName = useMemo(() => {
    const map = new Map<string, number | null>();
    promoters.forEach((p) => map.set(p.name, p.integrity_score ?? null));
    return map;
  }, [promoters]);

  const groups = useMemo(() => {
    const map = new Map<string, PromoterGroup>();
    const getGroup = (name: string): PromoterGroup => {
      let g = map.get(name);
      if (!g) {
        g = { key: name, name, integrityScore: name === UNKNOWN_PROMOTER ? null : (integrityByName.get(name) ?? null), totalInvested: 0, stocks: [] };
        map.set(name, g);
      }
      return g;
    };
    stocks.forEach((s) => {
      const names = (s.promoters ?? []).map((p) => p.name).filter(Boolean);
      const targets = names.length > 0 ? names : [UNKNOWN_PROMOTER];
      targets.forEach((name) => {
        const g = getGroup(name);
        g.totalInvested += s.invested_value ?? 0;
        g.stocks.push({ symbol: s.symbol, name: s.name, invested: s.invested_value ?? 0 });
      });
    });
    return Array.from(map.values());
  }, [stocks, integrityByName]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => sortDir === 'asc' ? a.totalInvested - b.totalInvested : b.totalInvested - a.totalInvested),
    [groups, sortDir],
  );

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (stocks.length === 0) return null;

  return (
    <Paper sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <Box sx={{ p: 1.5, background: 'linear-gradient(90deg, #667eea, #764ba2)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountBalance sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} color="white">Holdings by Promoter</Typography>
        <Chip label={sortedGroups.length} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700, height: 20 }} />
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9ff' }}>
              <TableCell padding="checkbox" />
              <TableCell><Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">Promoter Name</Typography></TableCell>
              <TableCell align="center"><Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">Integrity</Typography></TableCell>
              <TableCell align="right">
                <TableSortLabel active direction={sortDir} onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">Total Invested</Typography>
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedGroups.map((g) => {
              const isExpanded = expanded.has(g.key);
              const sortedStocks = [...g.stocks].sort((a, b) => b.invested - a.invested);
              return (
                <Fragment key={g.key}>
                  <TableRow hover sx={{ '& > td': { borderBottom: isExpanded ? 'none' : undefined } }}>
                    <TableCell padding="checkbox">
                      <IconButton size="small" onClick={() => toggleExpand(g.key)}>
                        {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color={g.name === UNKNOWN_PROMOTER ? 'text.secondary' : 'text.primary'} fontStyle={g.name === UNKNOWN_PROMOTER ? 'italic' : 'normal'}>{g.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{g.stocks.length} stock{g.stocks.length === 1 ? '' : 's'}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {g.integrityScore != null ? (
                        <Chip label={g.integrityScore.toFixed(1)} size="small" color={integrityChipColor(g.integrityScore)} sx={{ height: 20, fontWeight: 700 }} />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={600}>{formatCurrency(g.totalInvested, currency)}</Typography></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ my: 1.5, ml: 5 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, border: 0 }}>Symbol</TableCell>
                                <TableCell sx={{ fontWeight: 600, border: 0 }}>Company</TableCell>
                                <TableCell sx={{ fontWeight: 600, border: 0 }} align="right">Invested</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sortedStocks.map((s) => (
                                <TableRow key={s.symbol}>
                                  <TableCell sx={{ border: 0 }}>{s.symbol}</TableCell>
                                  <TableCell sx={{ border: 0 }}>{s.name ?? '—'}</TableCell>
                                  <TableCell sx={{ border: 0 }} align="right">{formatCurrency(s.invested, currency)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
