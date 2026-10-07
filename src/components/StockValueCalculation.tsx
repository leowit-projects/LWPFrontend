import {
  Alert,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import StockValueBadge from './StockValueBadge';
import { StockValueBand, StockValueBreakdown, StockValueComponent } from '../types';

// Mirrors StockValueService constants (backend)
const RATIO_MIN = 0.2;
const RATIO_MAX = 5.0;
const COST_OF_EQUITY_PCT = 13;
const LONG_TERM_GROWTH_PCT = 7;

const fmt = (value?: number | null): string => (value == null ? '—' : value.toFixed(2));

// The industry-level anchor that fed the fair value; sector_* keys come from older breakdowns
const industryAnchor = (c: StockValueComponent): { label: string; value?: number } => {
  const a = c.anchors as Record<string, number | undefined>;
  if (a.industry_peer_median != null) return { label: 'peer median', value: a.industry_peer_median };
  if (a.industry_benchmark != null) return { label: 'benchmark', value: a.industry_benchmark };
  if (a.sector_peer_median != null) return { label: 'sector peer median', value: a.sector_peer_median };
  return { label: 'benchmark', value: a.sector_benchmark };
};

const IndustryMultiple = ({
  name,
  peer,
  benchmark,
  used,
}: {
  name: string;
  peer?: number | null;
  benchmark?: number;
  used?: string;
}) => (
  <Box sx={{ px: 2.5, py: 0.5 }}>
    <Typography variant="caption" color="text.secondary">Industry {name}</Typography>
    <Typography variant="h6" fontWeight={700}>
      {fmt(peer ?? benchmark)}
    </Typography>
    <Typography variant="caption" color="text.secondary" display="block">
      Peer median {fmt(peer)} · Benchmark {fmt(benchmark)}
    </Typography>
    {used && (
      <Typography variant="caption" color="text.secondary" display="block" fontStyle="italic">
        Using {used}
      </Typography>
    )}
  </Box>
);

export default function StockValueCalculation({
  value,
  band,
  breakdown,
}: {
  value?: number | null;
  band?: StockValueBand | null;
  breakdown?: StockValueBreakdown | null;
}) {
  if (value == null || !breakdown) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" mb={1}>Stock Value Calculation</Typography>
        <Typography variant="body2" color="text.secondary">
          No Stock Value for this stock yet. It is computed for Indian stocks with a positive P/E or P/B during the
          daily market snapshot run.
        </Typography>
      </Paper>
    );
  }

  const rows: { name: string; c: StockValueComponent | null; weight: number }[] = [
    { name: 'P/E', c: breakdown.pe, weight: breakdown.weights.pe },
    { name: 'P/B', c: breakdown.pb, weight: breakdown.weights.pb },
  ];
  const used = rows.filter((r) => r.c && r.weight > 0) as { name: string; c: StockValueComponent; weight: number }[];
  const peUsed = breakdown.pe ? industryAnchor(breakdown.pe).label : undefined;
  const pbUsed = breakdown.pb ? industryAnchor(breakdown.pb).label : undefined;
  const capped = (c: StockValueComponent) => {
    const raw = c.current / c.fair;
    return raw < RATIO_MIN || raw > RATIO_MAX;
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
        <Typography variant="h6">Stock Value Calculation</Typography>
        <StockValueBadge value={value} band={band} breakdown={breakdown} showLabel />
      </Box>

      {/* Industry context */}
      <Box display="flex" alignItems="stretch" flexWrap="wrap" mb={2} sx={{ bgcolor: 'action.hover', borderRadius: 1, py: 1 }}>
        <Box sx={{ px: 2.5, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Sector / Industry</Typography>
          <Typography variant="body1" fontWeight={700}>{breakdown.sector ?? 'Unclassified'}</Typography>
          <Typography variant="body2" color="text.secondary">{breakdown.industry ?? '—'}</Typography>
        </Box>
        {breakdown.industry_benchmark && (
          <>
            <IndustryMultiple
              name="P/E"
              peer={breakdown.industry_peer_median?.pe}
              benchmark={breakdown.industry_benchmark.pe}
              used={peUsed}
            />
            <IndustryMultiple
              name="P/B"
              peer={breakdown.industry_peer_median?.pb}
              benchmark={breakdown.industry_benchmark.pb}
              used={pbUsed}
            />
          </>
        )}
        <Box sx={{ px: 2.5, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Weights</Typography>
          <Typography variant="h6" fontWeight={700}>
            P/E {Math.round(breakdown.weights.pe * 100)}% · P/B {Math.round(breakdown.weights.pb * 100)}%
          </Typography>
        </Box>
      </Box>

      {/* Per-multiple workings */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Multiple</TableCell>
              <TableCell align="right">Current</TableCell>
              <TableCell align="right">Industry anchor</TableCell>
              <TableCell align="right">Own 5Y median</TableCell>
              <TableCell align="right">ROE-justified</TableCell>
              <TableCell align="right">Fair (average)</TableCell>
              <TableCell align="right">Current ÷ Fair</TableCell>
              <TableCell align="right">Weight</TableCell>
              <TableCell align="right">Contribution</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ name, c, weight }) => {
              if (!c) {
                return (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">Not usable (negative or missing) — excluded</Typography>
                    </TableCell>
                  </TableRow>
                );
              }
              const anchor = industryAnchor(c);
              const a = c.anchors as Record<string, number | undefined>;
              return (
                <TableRow key={name}>
                  <TableCell sx={{ fontWeight: 700 }}>{name}</TableCell>
                  <TableCell align="right">{fmt(c.current)}</TableCell>
                  <TableCell align="right">
                    {fmt(anchor.value)}
                    <Typography variant="caption" color="text.secondary" display="block">{anchor.label}</Typography>
                  </TableCell>
                  <TableCell align="right">{fmt(a.own_5y_median)}</TableCell>
                  <TableCell align="right">{name === 'P/B' ? fmt(a.justified_pb) : 'n/a'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(c.fair)}</TableCell>
                  <TableCell align="right">
                    {fmt(c.ratio)}×
                    {capped(c) && <Chip size="small" label="capped" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />}
                  </TableCell>
                  <TableCell align="right">{Math.round(weight * 100)}%</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{(weight * c.ratio).toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Formula with this stock's numbers */}
      <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
        <Box>Stock Value = w<sub>PE</sub> × (P/E ÷ fair P/E) + w<sub>PB</sub> × (P/B ÷ fair P/B)</Box>
        <Box mt={0.5}>
          {'            = '}
          {used.map((r) => `${r.weight.toFixed(2)} × ${r.c.ratio.toFixed(2)}`).join(' + ')}
          {' = '}
          <strong>{value.toFixed(2)}</strong>
        </Box>
      </Box>

      {/* How it works */}
      <Box component="ul" sx={{ mt: 2, mb: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
        <Typography component="li" variant="body2" color="text.secondary">
          <strong>Fair P/E and fair P/B</strong> are the average of the anchors available: the industry anchor (median
          of same-industry stocks when there are at least 5, otherwise the industry benchmark from Valuation
          Guidelines), the stock's own median at its last 5 fiscal year ends, and — for lenders — the ROE-justified P/B.
        </Typography>
        <Typography component="li" variant="body2" color="text.secondary">
          <strong>ROE-justified P/B</strong> = (ROE − {LONG_TERM_GROWTH_PCT}%) ÷ ({COST_OF_EQUITY_PCT}% − {LONG_TERM_GROWTH_PCT}%),
          used only when ROE exceeds {LONG_TERM_GROWTH_PCT}%.
        </Typography>
        <Typography component="li" variant="body2" color="text.secondary">
          Each Current ÷ Fair ratio is capped between {RATIO_MIN} and {RATIO_MAX} so one extreme multiple can't swamp the
          score. If a multiple is unusable, its weight moves to the other.
        </Typography>
        <Typography component="li" variant="body2" color="text.secondary">
          <strong>Bands:</strong> &lt; 0.8 Undervalued · 0.8–1.2 Fair · 1.2–1.5 Slightly High · &gt; 1.5 Overvalued.
          Recomputed daily with the market snapshot.
        </Typography>
      </Box>

      {breakdown.notes.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {breakdown.notes.join(' · ')}
        </Alert>
      )}
    </Paper>
  );
}
