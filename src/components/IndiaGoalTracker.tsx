import React, { useMemo } from 'react';
import { Box, Paper, Typography, Chip, Tooltip, LinearProgress } from '@mui/material';
import { EmojiEvents, TrendingUp } from '@mui/icons-material';
import { AccountAssetSummary, AssetType, CurrencyCode } from '../types';

// ── Goal targets (INR, invested value) ───────────────────────────────────────
const GOAL_TOTAL = 1_00_00_000;   // ₹1 Cr overall
const GOAL_BONDS = 25_00_000;     // ₹25 L in bonds
const GOAL_OTHERS = GOAL_TOTAL - GOAL_BONDS; // ₹75 L in stocks + ETF + MF

// Colors kept consistent with AssetSummary's palette.
const COLOR_BONDS = '#6a1b9a';    // purple  (bonds)
const COLOR_OTHERS = '#1565c0';   // blue    (stocks + etf + mf)
const COLOR_TRACK = 'rgba(0,0,0,0.08)';

// Value-label colors: Invested (blue) + Pending (gray) / Total (green)
const LABEL_INVESTED = '#1565c0';
const LABEL_PENDING = '#757575';
const LABEL_TOTAL = '#2e7d32';

interface IndiaGoalTrackerProps {
  // Flat (account × asset_type) rows from getAssetSummary().
  rows: AccountAssetSummary[];
}

const IndiaGoalTracker: React.FC<IndiaGoalTrackerProps> = ({ rows }) => {
  const { bondsInvested, othersInvested, totalInvested } = useMemo(() => {
    let bonds = 0;
    let others = 0;
    for (const r of rows) {
      if (r.currency !== CurrencyCode.INR) continue; // India goal = INR accounts only
      const invested = r.total_invested || 0;
      if (r.asset_type === AssetType.BOND) {
        bonds += invested;
      } else {
        others += invested; // STOCK, ETF, MUTUAL_FUND
      }
    }
    return { bondsInvested: bonds, othersInvested: others, totalInvested: bonds + others };
  }, [rows]);

  const fmt = (v: number): string =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v || 0);

  // Compact Indian-style label for big numbers (₹1.0 Cr, ₹25.0 L).
  const compact = (v: number): string => {
    if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
    if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)} L`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
  };

  const pct = (value: number, target: number): number =>
    target > 0 ? Math.min((value / target) * 100, 100) : 0;

  // Renders: [Invested + Pending] / Total  with per-part colors.
  const ValueLabel: React.FC<{ invested: number; target: number }> = ({ invested, target }) => {
    const pending = Math.max(target - invested, 0);
    return (
      <Typography variant="body2" component="span">
        <Box component="span" sx={{ color: 'text.disabled' }}>[</Box>
        <Box component="span" sx={{ color: LABEL_INVESTED, fontWeight: 700 }}>{fmt(invested)}</Box>
        <Box component="span" sx={{ color: 'text.disabled' }}> + </Box>
        <Box component="span" sx={{ color: LABEL_PENDING, fontWeight: 700 }}>{fmt(pending)}</Box>
        <Box component="span" sx={{ color: 'text.disabled' }}>] / </Box>
        <Box component="span" sx={{ color: LABEL_TOTAL, fontWeight: 700 }}>{fmt(target)}</Box>
      </Typography>
    );
  };

  const totalPct = pct(totalInvested, GOAL_TOTAL);
  const bondsPct = pct(bondsInvested, GOAL_BONDS);
  const othersPct = pct(othersInvested, GOAL_OTHERS);

  // Segment widths on the overall ₹1 Cr track (capped so overshoot doesn't overflow).
  const bondsWidth = Math.min((bondsInvested / GOAL_TOTAL) * 100, 100);
  const othersWidth = Math.min((othersInvested / GOAL_TOTAL) * 100, 100 - bondsWidth);

  const remaining = Math.max(GOAL_TOTAL - totalInvested, 0);
  const goalReached = totalInvested >= GOAL_TOTAL;

  // Allocation drift: is the bond bucket over/under its ₹25 L target?
  const bondOver = bondsInvested > GOAL_BONDS;
  const bondDrift = Math.abs(bondsInvested - GOAL_BONDS);

  const SubGoalBar: React.FC<{
    label: string;
    value: number;
    target: number;
    percent: number;
    color: string;
  }> = ({ label, value, target, percent, color }) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: color }} />
          <Typography variant="body2" fontWeight={600}>{label}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" component="div">
          <ValueLabel invested={value} target={target} />
          <Box component="span" sx={{ ml: 1, fontWeight: 700, color }}>{percent.toFixed(1)}%</Box>
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: COLOR_TRACK,
          '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 4 },
        }}
      />
    </Box>
  );

  return (
    <Paper sx={{ p: 3, mb: 3, height: '100%', borderTop: `4px solid ${goalReached ? '#2e7d32' : COLOR_OTHERS}` }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <EmojiEvents sx={{ color: goalReached ? '#2e7d32' : COLOR_OTHERS }} />
        <Typography variant="subtitle1" fontWeight={700}>
          India Investment Goal
        </Typography>
        <Chip
          label={goalReached ? 'Goal reached 🎉' : `${totalPct.toFixed(1)}% of ₹1 Cr`}
          size="small"
          color={goalReached ? 'success' : 'primary'}
          variant={goalReached ? 'filled' : 'outlined'}
        />
      </Box>

      {/* Headline numbers */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 2.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Total Invested</Typography>
          <Typography variant="h5" fontWeight={700}>{compact(totalInvested)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Target</Typography>
          <Typography variant="h5" fontWeight={700} color="text.secondary">{compact(GOAL_TOTAL)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Remaining</Typography>
          <Typography variant="h5" fontWeight={700} sx={{ color: goalReached ? '#2e7d32' : 'text.primary' }}>
            {goalReached ? '—' : compact(remaining)}
          </Typography>
        </Box>
      </Box>

      {/* Segmented overall bar: bonds + others against ₹1 Cr */}
      <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" fontWeight={600}>Overall Progress</Typography>
        <ValueLabel invested={totalInvested} target={GOAL_TOTAL} />
      </Box>
      <Tooltip
        title={`Bonds ${compact(bondsInvested)} • Others ${compact(othersInvested)}`}
        arrow
        placement="top"
      >
        <Box
          sx={{
            position: 'relative',
            height: 22,
            borderRadius: 4,
            backgroundColor: COLOR_TRACK,
            overflow: 'hidden',
            display: 'flex',
            mb: 3,
          }}
        >
          <Box sx={{ width: `${bondsWidth}%`, backgroundColor: COLOR_BONDS, transition: 'width 0.4s ease' }} />
          <Box sx={{ width: `${othersWidth}%`, backgroundColor: COLOR_OTHERS, transition: 'width 0.4s ease' }} />
          {/* Center label */}
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', pointerEvents: 'none',
          }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
              {totalPct.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </Tooltip>

      {/* Sub-goal bars */}
      <SubGoalBar
        label="Bonds"
        value={bondsInvested}
        target={GOAL_BONDS}
        percent={bondsPct}
        color={COLOR_BONDS}
      />
      <SubGoalBar
        label="Others (Stocks · ETF · MF)"
        value={othersInvested}
        target={GOAL_OTHERS}
        percent={othersPct}
        color={COLOR_OTHERS}
      />

      {/* Allocation drift note on the bond bucket */}
      {totalInvested > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <TrendingUp fontSize="small" sx={{ color: bondOver ? '#ef6c00' : 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {bondDrift < 1000
              ? 'Bond allocation is on target.'
              : bondOver
                ? `Bonds are ${compact(bondDrift)} over the ₹25 L target.`
                : `Bonds are ${compact(bondDrift)} short of the ₹25 L target.`}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default IndiaGoalTracker;