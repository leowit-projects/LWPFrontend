import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { StockValueBand, StockValueBreakdown, StockValueComponent } from '../types';

// Sector-aware valuation score: 1.0 = fair, < 1 undervalued, > 1 overvalued.
// Bands come from the backend (StockValueService).
const BAND_META: Record<StockValueBand, { label: string; color: 'info' | 'success' | 'warning' | 'error' }> = {
  UNDERVALUED: { label: 'Undervalued', color: 'info' },
  FAIR: { label: 'Fair', color: 'success' },
  SLIGHTLY_HIGH: { label: 'Slightly High', color: 'warning' },
  OVERVALUED: { label: 'Overvalued', color: 'error' },
};

const ANCHOR_LABELS: Record<string, string> = {
  industry_peer_median: 'Industry peer median',
  industry_benchmark: 'Industry benchmark',
  sector_peer_median: 'Sector peer median',
  sector_benchmark: 'Sector benchmark',
  own_5y_median: 'Own 5Y median',
  justified_pb: 'ROE-justified',
};

const ComponentLines = ({ name, weight, c }: { name: string; weight: number; c: StockValueComponent | null }) => {
  if (!c) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" display="block" fontWeight={600}>
        {name} {c.current.toFixed(2)} vs fair {c.fair.toFixed(2)} → {c.ratio.toFixed(2)}× (weight {Math.round(weight * 100)}%)
      </Typography>
      {Object.entries(c.anchors).map(([key, value]) => (
        <Typography key={key} variant="caption" display="block" fontSize="0.65rem" sx={{ pl: 1 }}>
          {ANCHOR_LABELS[key] ?? key}: {value?.toFixed(2)}
        </Typography>
      ))}
    </Box>
  );
};

export default function StockValueBadge({
  value,
  band,
  breakdown,
  showLabel = false,
}: {
  value?: number | null;
  band?: StockValueBand | null;
  breakdown?: StockValueBreakdown | null;
  showLabel?: boolean;
}) {
  if (value == null || !band) {
    return <Typography variant="body2" color="text.secondary">-</Typography>;
  }
  const meta = BAND_META[band];

  const tooltip = (
    <Box>
      <Typography variant="caption" display="block" fontWeight={700}>
        Stock Value {value.toFixed(2)} — {meta.label}
      </Typography>
      <Typography variant="caption" display="block" fontSize="0.65rem">
        {'<0.8 Undervalued · 0.8–1.2 Fair · 1.2–1.5 Slightly High · >1.5 Overvalued'}
      </Typography>
      {breakdown && (
        <>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Sector: {breakdown.sector ?? 'Unclassified'}
            {breakdown.industry ? ` · ${breakdown.industry}` : ''}
          </Typography>
          <ComponentLines name="P/E" weight={breakdown.weights.pe} c={breakdown.pe} />
          <ComponentLines name="P/B" weight={breakdown.weights.pb} c={breakdown.pb} />
          {breakdown.notes.map((note) => (
            <Typography key={note} variant="caption" display="block" fontSize="0.65rem" sx={{ mt: 1, fontStyle: 'italic' }}>
              {note}
            </Typography>
          ))}
        </>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        size="small"
        color={meta.color}
        variant={band === 'FAIR' ? 'outlined' : 'filled'}
        label={showLabel ? `${value.toFixed(2)} · ${meta.label}` : value.toFixed(2)}
        sx={{ fontWeight: 700 }}
      />
    </Tooltip>
  );
}
