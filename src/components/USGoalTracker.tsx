import React, { useMemo } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { AccountAssetSummary, CurrencyCode } from '../types';

// ── Goal target (USD, invested value) ────────────────────────────────────────
const GOAL_TOTAL = 50_000; // $50,000 overall — no per-asset-type sub-targets

const COLOR_MAIN = '#00695c'; // teal, distinct from the India tracker's blue
const COLOR_TRACK = 'rgba(0,0,0,0.08)';

// Value-label colors: Invested (blue) + Pending (gray) / Total (green)
const LABEL_INVESTED = '#1565c0';
const LABEL_PENDING = '#757575';
const LABEL_TOTAL = '#2e7d32';

interface USGoalTrackerProps {
  // Flat (account × asset_type) rows from getAssetSummary().
  rows: AccountAssetSummary[];
}

const USGoalTracker: React.FC<USGoalTrackerProps> = ({ rows }) => {
  const totalInvested = useMemo(() => {
    let total = 0;
    for (const r of rows) {
      if (r.currency !== CurrencyCode.USD) continue; // US goal = USD accounts only
      total += r.total_invested || 0;
    }
    return total;
  }, [rows]);

  const fmt = (v: number): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v || 0);

  const compact = (v: number): string => {
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  const totalPct = GOAL_TOTAL > 0 ? Math.min((totalInvested / GOAL_TOTAL) * 100, 100) : 0;
  const remaining = Math.max(GOAL_TOTAL - totalInvested, 0);
  const goalReached = totalInvested >= GOAL_TOTAL;

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

  return (
    <Paper sx={{ p: 3, mb: 3, height: '100%', borderTop: `4px solid ${goalReached ? '#2e7d32' : COLOR_MAIN}` }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <EmojiEvents sx={{ color: goalReached ? '#2e7d32' : COLOR_MAIN }} />
        <Typography variant="subtitle1" fontWeight={700}>
          US Investment Goal
        </Typography>
        <Chip
          label={goalReached ? 'Goal reached 🎉' : `${totalPct.toFixed(1)}% of $50K`}
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

      {/* Single overall bar vs $50K */}
      <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" fontWeight={600}>Overall Progress</Typography>
        <ValueLabel invested={totalInvested} target={GOAL_TOTAL} />
      </Box>
      <Box
        sx={{
          position: 'relative',
          height: 22,
          borderRadius: 4,
          backgroundColor: COLOR_TRACK,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${totalPct}%`,
            height: '100%',
            backgroundColor: goalReached ? '#2e7d32' : COLOR_MAIN,
            transition: 'width 0.4s ease',
          }}
        />
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', pointerEvents: 'none',
        }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {totalPct.toFixed(1)}%
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default USGoalTracker;