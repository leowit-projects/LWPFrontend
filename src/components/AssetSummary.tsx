import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Assessment } from '@mui/icons-material';
import { holdingAccountsAPI } from '../api/client';
import { AccountAssetSummary, AssetType, CurrencyCode, AccountPlatform } from '../types';
import IndiaGoalTracker from './IndiaGoalTracker';
import USGoalTracker from './USGoalTracker';

// One pivoted row per account: the four asset_type rows collapsed into columns.
interface AccountRow {
  holding_account_id: string;
  account_platform: AccountPlatform;
  currency: CurrencyCode;
  stockInvested: number;
  stockCurrent: number;   // 0 when no priced stock holdings
  etfInvested: number;
  etfCurrent: number;
  bondInvested: number;
  mfInvested: number;
  totalInvested: number;
  // Total current: stock + etf current, plus bond & mf invested (no market price for those).
  totalCurrent: number;
}

const CURRENCY_ORDER: CurrencyCode[] = [CurrencyCode.INR, CurrencyCode.USD];

// Distinct tint per asset type — a stronger shade for the group header,
// a subtle wash behind the data cells so each class reads as its own band.
const ASSET_COLORS: Record<AssetType, { header: string; cell: string; label: string }> = {
  [AssetType.STOCK]:       { header: '#1565c0', cell: 'rgba(21, 101, 192, 0.06)',  label: '#1565c0' },
  [AssetType.ETF]:         { header: '#00897b', cell: 'rgba(0, 137, 123, 0.06)',   label: '#00897b' },
  [AssetType.BOND]:        { header: '#6a1b9a', cell: 'rgba(106, 27, 154, 0.06)',  label: '#6a1b9a' },
  [AssetType.MUTUAL_FUND]: { header: '#ef6c00', cell: 'rgba(239, 108, 0, 0.06)',   label: '#ef6c00' },
};

const assetCellSx = (assetType: AssetType) => ({
  backgroundColor: ASSET_COLORS[assetType].cell,
});

const assetHeaderSx = (assetType: AssetType) => ({
  backgroundColor: ASSET_COLORS[assetType].header,
  color: '#fff',
});

const AssetSummary: React.FC = () => {
  const [rows, setRows] = useState<AccountAssetSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const loadSummary = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getAssetSummary();
      setRows(response.data);
    } catch (err: any) {
      console.error('Failed to load asset summary:', err);
      setError(err.response?.data?.detail || 'Failed to load asset summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Pivot flat (account × asset_type) rows into one row per account, grouped by currency.
  const rowsByCurrency = useMemo(() => {
    const byAccount = new Map<string, AccountRow>();

    for (const r of rows) {
      let acc = byAccount.get(r.holding_account_id);
      if (!acc) {
        acc = {
          holding_account_id: r.holding_account_id,
          account_platform: r.account_platform,
          currency: r.currency,
          stockInvested: 0,
          stockCurrent: 0,
          etfInvested: 0,
          etfCurrent: 0,
          bondInvested: 0,
          mfInvested: 0,
          totalInvested: 0,
          totalCurrent: 0,
        };
        byAccount.set(r.holding_account_id, acc);
      }

      const invested = r.total_invested || 0;
      const current = r.total_current; // null for BOND / MUTUAL_FUND

      switch (r.asset_type) {
        case AssetType.STOCK:
          acc.stockInvested += invested;
          acc.stockCurrent += current ?? 0;
          break;
        case AssetType.ETF:
          acc.etfInvested += invested;
          acc.etfCurrent += current ?? 0;
          break;
        case AssetType.BOND:
          acc.bondInvested += invested;
          break;
        case AssetType.MUTUAL_FUND:
          acc.mfInvested += invested;
          break;
      }
    }

    // Derive totals after all asset rows are folded in.
    for (const acc of byAccount.values()) {
      acc.totalInvested =
        acc.stockInvested + acc.etfInvested + acc.bondInvested + acc.mfInvested;
      // Bonds & MF contribute their invested value (no market price available).
      acc.totalCurrent =
        acc.stockCurrent + acc.etfCurrent + acc.bondInvested + acc.mfInvested;
    }

    const grouped = new Map<CurrencyCode, AccountRow[]>();
    for (const acc of byAccount.values()) {
      const list = grouped.get(acc.currency) || [];
      list.push(acc);
      grouped.set(acc.currency, list);
    }
    // Stable ordering by account id within each currency.
    for (const list of grouped.values()) {
      list.sort((a, b) => a.holding_account_id.localeCompare(b.holding_account_id));
    }
    return grouped;
  }, [rows]);

  const formatMoney = (value: number, currency: CurrencyCode): string => {
    const locale = currency === CurrencyCode.INR ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  const gainColor = (invested: number, current: number): string => {
    if (current > invested) return 'success.main';
    if (current < invested) return 'error.main';
    return 'text.primary';
  };

  const renderCurrencyTable = (currency: CurrencyCode, accountRows: AccountRow[]) => {
    // Subtotals across all accounts in this currency.
    const subtotal = accountRows.reduce(
      (acc, r) => {
        acc.stockInvested += r.stockInvested;
        acc.stockCurrent += r.stockCurrent;
        acc.etfInvested += r.etfInvested;
        acc.etfCurrent += r.etfCurrent;
        acc.bondInvested += r.bondInvested;
        acc.mfInvested += r.mfInvested;
        acc.totalInvested += r.totalInvested;
        acc.totalCurrent += r.totalCurrent;
        return acc;
      },
      {
        stockInvested: 0, stockCurrent: 0, etfInvested: 0, etfCurrent: 0,
        bondInvested: 0, mfInvested: 0, totalInvested: 0, totalCurrent: 0,
      },
    );

    const headerCellSx = { fontWeight: 700, whiteSpace: 'nowrap' as const };
    const numCellSx = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const };

    return (
      <Paper key={currency} sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Assessment color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            {currency} Accounts
          </Typography>
          <Chip label={currency} size="small" variant="outlined" />
          <Typography variant="body2" color="text.secondary">
            {accountRows.length} account{accountRows.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              {/* Grouping header row */}
              <TableRow>
                <TableCell sx={headerCellSx} rowSpan={2}>Account</TableCell>
                <TableCell sx={headerCellSx} rowSpan={2}>Platform</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }} colSpan={2} align="center">
                  Total
                </TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx, ...assetHeaderSx(AssetType.STOCK) }} colSpan={2} align="center">
                  Stocks
                </TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx, ...assetHeaderSx(AssetType.ETF) }} colSpan={2} align="center">
                  ETF
                </TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx, ...assetHeaderSx(AssetType.BOND) }} align="center">
                  Bonds
                </TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx, ...assetHeaderSx(AssetType.MUTUAL_FUND) }} align="center">
                  MF
                </TableCell>
              </TableRow>
              {/* Sub-header row: Invested / Current */}
              <TableRow>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Invested</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Current</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Invested</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Current</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Invested</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Current</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Invested</TableCell>
                <TableCell sx={{ ...headerCellSx, ...numCellSx }}>Invested</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {accountRows.map((r) => (
                <TableRow key={r.holding_account_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.holding_account_id}</TableCell>
                  <TableCell>
                    <Chip label={r.account_platform} size="small" />
                  </TableCell>
                  <TableCell sx={{ ...numCellSx, fontWeight: 600 }}>
                    {formatMoney(r.totalInvested, currency)}
                  </TableCell>
                  <TableCell sx={{ ...numCellSx, fontWeight: 600, color: gainColor(r.totalInvested, r.totalCurrent) }}>
                    {formatMoney(r.totalCurrent, currency)}
                  </TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.STOCK) }}>{formatMoney(r.stockInvested, currency)}</TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.STOCK), color: gainColor(r.stockInvested, r.stockCurrent) }}>
                    {formatMoney(r.stockCurrent, currency)}
                  </TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.ETF) }}>{formatMoney(r.etfInvested, currency)}</TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.ETF), color: gainColor(r.etfInvested, r.etfCurrent) }}>
                    {formatMoney(r.etfCurrent, currency)}
                  </TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.BOND) }}>{formatMoney(r.bondInvested, currency)}</TableCell>
                  <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.MUTUAL_FUND) }}>{formatMoney(r.mfInvested, currency)}</TableCell>
                </TableRow>
              ))}

              {/* Subtotal row */}
              <TableRow sx={{ '& td': { borderTop: '2px solid', borderColor: 'divider', fontWeight: 700 } }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Subtotal ({currency})</TableCell>
                <TableCell sx={numCellSx}>{formatMoney(subtotal.totalInvested, currency)}</TableCell>
                <TableCell sx={{ ...numCellSx, color: gainColor(subtotal.totalInvested, subtotal.totalCurrent) }}>
                  {formatMoney(subtotal.totalCurrent, currency)}
                </TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.STOCK) }}>{formatMoney(subtotal.stockInvested, currency)}</TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.STOCK), color: gainColor(subtotal.stockInvested, subtotal.stockCurrent) }}>
                  {formatMoney(subtotal.stockCurrent, currency)}
                </TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.ETF) }}>{formatMoney(subtotal.etfInvested, currency)}</TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.ETF), color: gainColor(subtotal.etfInvested, subtotal.etfCurrent) }}>
                  {formatMoney(subtotal.etfCurrent, currency)}
                </TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.BOND) }}>{formatMoney(subtotal.bondInvested, currency)}</TableCell>
                <TableCell sx={{ ...numCellSx, ...assetCellSx(AssetType.MUTUAL_FUND) }}>{formatMoney(subtotal.mfInvested, currency)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
        {error}
      </Alert>
    );
  }

  const hasAnyData = CURRENCY_ORDER.some((c) => (rowsByCurrency.get(c)?.length ?? 0) > 0);

  if (!hasAnyData) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No holdings found across your active accounts.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* Goal trackers — side by side (stack on narrow screens), share fetched rows */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <IndiaGoalTracker rows={rows} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <USGoalTracker rows={rows} />
        </Box>
      </Box>

      <Typography variant="h6" fontWeight={700} mb={2}>
        Asset Summary
      </Typography>
      {CURRENCY_ORDER.map((currency) => {
        const accountRows = rowsByCurrency.get(currency);
        if (!accountRows || accountRows.length === 0) return null;
        return renderCurrencyTable(currency, accountRows);
      })}
    </Box>
  );
};

export default AssetSummary;