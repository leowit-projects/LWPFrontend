import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  Divider,
  Button,
  CircularProgress,
  } from '@mui/material';
import {
  TrendingUp,
  PieChart as Lightbulb,
  Timeline,
  Warning,
  Star,
  AutoAwesome,
  Refresh,
  CheckCircle,
  Cancel,
  FiberManualRecord,
} from '@mui/icons-material';
import { holdingAccountsAPI } from '../api/client';
import {
  HoldingAccountsResponse,
  AIInsightsResponse,
} from '../types';
import { InsightFlag, SectorInsight, ActionItem } from './HoldingsShared';

// ─── AI Insights Tab ─────────────────────────────────────────────────────────

export default function ListHoldingAIInsights({
  holdings,
  accountId,
}: {
  holdings: HoldingAccountsResponse;
  accountId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [error, setError] = useState<string>('');

  const generateInsights = async () => {
    setLoading(true);
    setError('');
    try {
      // Build a compact portfolio summary to send to the backend
      const portfolioPayload = {
        account_id: accountId,
        currency: holdings.currency,
        summary: holdings.summary,
        stocks: holdings.holdings.stocks.map((s: any) => ({
          symbol: s.symbol,
          sector: s.sector,
          quantity: s.quantity,
          average_price: s.average_price,
          last_close_price: s.last_close_price,
          invested_value: s.invested_value,
          current_value: s.current_value,
          profit_loss: s.profit_loss,
          profit_loss_percentage: s.profit_loss_percentage,
          price_52w_low: s.price_52w_low,
          price_52w_high: s.price_52w_high,
          moving_average_20: s.moving_average_20,
          pe_ratio: s.pe_ratio,
          rsi_index: s.rsi_index,
        })),
        etfs: holdings.holdings.etfs.map((e: any) => ({
          symbol: e.symbol,
          invested_value: e.invested_value,
          current_value: e.current_value,
          profit_loss: e.profit_loss,
          profit_loss_percentage: e.profit_loss_percentage,
        })),
        mutual_funds: holdings.holdings.mutual_funds.map((m: any) => ({
          name: m.name,
          invested_value: m.invested_value,
          current_value: m.current_value,
        })),
        bonds: holdings.holdings.bonds.map((b: any) => ({
          name: b.name,
          face_value: b.face_value,
          coupon_rate: b.coupon_rate,
          invested_value: b.invested_value,
        })),
      };
      
      const forceRefresh = !!insights; // Regenerate button = force refresh
      const response = await holdingAccountsAPI.getAiInsights(accountId, portfolioPayload, forceRefresh);
      setInsights({ ...response.data, hedging_ideas: response.data.hedging_ideas || [] }); // Ensure hedging ideas is always defined
      console.log('AI Insights response:', response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate AI insights');
    } finally {
      setLoading(false);
    }
  };

  const flagColor = (type: InsightFlag['flag_type']) => {
    if (type === 'RED') return { bg: '#ffebee', border: '#ef9a9a', text: '#c62828', icon: <Cancel sx={{ fontSize: 18, color: '#c62828' }} /> };
    if (type === 'YELLOW') return { bg: '#fff8e1', border: '#ffe082', text: '#f57f17', icon: <Warning sx={{ fontSize: 18, color: '#f57f17' }} /> };
    return { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', icon: <CheckCircle sx={{ fontSize: 18, color: '#2e7d32' }} /> };
  };

  const actionColor = (action: ActionItem['action']) => {
    const map: Record<string, { bg: string; fg: string }> = {
      BUY: { bg: '#e8f5e9', fg: '#2e7d32' },
      HOLD: { bg: '#fff8e1', fg: '#f57f17' },
      EXIT: { bg: '#ffebee', fg: '#c62828' },
      TRIM: { bg: '#fff3e0', fg: '#e65100' },
      REVIEW: { bg: '#e3f2fd', fg: '#1565c0' },
    };
    return map[action] || { bg: '#f5f5f5', fg: '#555' };
  };

  const priorityDot = (priority: ActionItem['priority']) => {
    const colors: Record<string, string> = { HIGH: '#f44336', MEDIUM: '#ff9800', LOW: '#66bb6a' };
    return <FiberManualRecord sx={{ fontSize: 10, color: colors[priority] || '#bbb', mr: 0.5 }} />;
  };

  const sectorStatusColor = (status: SectorInsight['status']) => {
    if (status === 'STRONG') return 'success';
    if (status === 'WEAK') return 'error';
    return 'default';
  };

  const healthScoreColor = (score: number) => {
    if (score >= 75) return '#2e7d32';
    if (score >= 55) return '#f57f17';
    return '#c62828';
  };

  return (
    <Box>
      {/* Header bar */}
      <Paper
        sx={{
          p: 2,
          mb: 2.5,
          background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
          border: '1px solid #e3eaff',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AutoAwesome sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Portfolio Insights — Powered by Claude AI
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Analysed against your Value Investing Philosophies &nbsp;·&nbsp; Indian Equity focus
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : insights ? <Refresh /> : <AutoAwesome />}
          onClick={generateInsights}
          disabled={loading}
          sx={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontWeight: 700,
            px: 3,
            '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a3f92)' },
          }}
        >
          {loading ? 'Analysing…' : insights ? 'Regenerate' : 'Generate Insights'}
        </Button>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading state */}
      {loading && (
        <Paper sx={{ p: 5, textAlign: 'center', border: '1px solid #e3eaff', borderRadius: 2 }}>
          <CircularProgress size={48} sx={{ color: '#667eea', mb: 2 }} />
          <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
            Claude is reviewing your portfolio…
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Checking against all 10 investment philosophies
          </Typography>
        </Paper>
      )}

      {/* Empty state */}
      {!loading && !insights && !error && (
        <Paper
          sx={{
            p: 6, textAlign: 'center',
            border: '2px dashed #e0e7ff', borderRadius: 2, bgcolor: '#fafbff',
          }}
        >
          <AutoAwesome sx={{ fontSize: 56, color: '#c5cae9', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
            No insights generated yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
            Click "Generate Insights" to get a personalised analysis of your portfolio aligned to your
            value investing philosophies by Mr. Anand Srinivasan — intrinsic value, fundamentals, strong management, long-term compounding, and more.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={generateInsights}
            sx={{ borderColor: '#667eea', color: '#667eea', fontWeight: 700 }}
          >
            Generate Insights
          </Button>
        </Paper>
      )}

      {/* ── Insights content ── */}
      {!loading && insights && (
        <Box>
          {/* Overall health score banner */}
          <Paper
            sx={{
              p: 2.5, mb: 2.5,
              border: `2px solid ${healthScoreColor(insights.overall_health_score)}22`,
              borderLeft: `5px solid ${healthScoreColor(insights.overall_health_score)}`,
              borderRadius: 2, bgcolor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{ color: healthScoreColor(insights.overall_health_score), lineHeight: 1 }}
                >
                  {insights.overall_health_score}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                  Health Score
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={insights.overall_health_score}
                  sx={{
                    mt: 0.5, height: 6, borderRadius: 3,
                    bgcolor: '#eee',
                    '& .MuiLinearProgress-bar': { bgcolor: healthScoreColor(insights.overall_health_score) },
                  }}
                />
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Overall Assessment
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {insights.overall_summary}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                  Generated at {new Date(insights.generated_at).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Row 1: Philosophy scores + Key flags */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {/* Philosophy scores */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2.5, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Star sx={{ fontSize: 18, color: '#f5a623' }} /> Philosophy Alignment
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  {insights.philosophy_scores.map((p) => (
                    <Box key={p.name}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                          {p.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ fontSize: '0.82rem', color: healthScoreColor(p.score) }}
                        >
                          {p.score}/100
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={p.score}
                        sx={{
                          height: 7, borderRadius: 3, bgcolor: '#eee',
                          '& .MuiLinearProgress-bar': { bgcolor: healthScoreColor(p.score), borderRadius: 3 },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                        {p.note}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>

            {/* Key flags */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 2.5, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Warning sx={{ fontSize: 18, color: '#ff9800' }} /> Key Flags
                  <Chip
                    label={`${insights.key_flags.filter(f => f.flag_type === 'RED').length} critical`}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }}
                  />
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {insights.key_flags.map((flag, i) => {
                    const c = flagColor(flag.flag_type);
                    return (
                      <Box
                        key={i}
                        sx={{
                          p: 1.25, borderRadius: 1.5,
                          bgcolor: c.bg, border: `1px solid ${c.border}`,
                          display: 'flex', gap: 1, alignItems: 'flex-start',
                        }}
                      >
                        <Box sx={{ mt: 0.1 }}>{c.icon}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.2 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: c.text, fontSize: '0.8rem' }}>
                              {flag.ticker}
                            </Typography>
                            <Chip
                              label={flag.action}
                              size="small"
                              sx={{
                                height: 16, fontSize: '0.62rem', fontWeight: 700,
                                bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
                            {flag.message}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Row 2: Action items */}
          <Paper sx={{ p: 2.5, mb: 2.5, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Lightbulb sx={{ fontSize: 18, color: '#667eea' }} /> Recommended Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {insights.action_items.map((item, i) => {
                const c = actionColor(item.action);
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 2,
                      p: 1.5, borderRadius: 1.5,
                      bgcolor: c.bg, border: `1px solid ${c.fg}22`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 72 }}>
                      {priorityDot(item.priority)}
                      <Chip
                        label={item.action}
                        size="small"
                        sx={{ fontWeight: 700, bgcolor: c.bg, color: c.fg, border: `1px solid ${c.fg}55`, fontSize: '0.72rem' }}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        {item.tickers.map((t) => (
                          <Chip
                            key={t}
                            label={t}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#fff', border: '1px solid #ddd' }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {item.reason}
                      </Typography>
                    </Box>
                    <Chip
                      label={item.priority}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.62rem', fontWeight: 600,
                        bgcolor: item.priority === 'HIGH' ? '#ffebee' : item.priority === 'MEDIUM' ? '#fff8e1' : '#f1f8e9',
                        color: item.priority === 'HIGH' ? '#c62828' : item.priority === 'MEDIUM' ? '#f57f17' : '#33691e',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* Row 3: Sector insights */}
          <Paper sx={{ p: 2.5, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <TrendingUp sx={{ fontSize: 18, color: '#43e97b' }} /> Sector Commentary
            </Typography>
            <Grid container spacing={1.5}>
              {insights.sector_insights.map((si) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={si.sector}>
                  <Box
                    sx={{
                      p: 1.5, borderRadius: 1.5, height: '100%',
                      border: '1px solid #eee', bgcolor: '#fafafa',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                        {si.sector}
                      </Typography>
                      <Chip
                        label={si.status}
                        size="small"
                        color={sectorStatusColor(si.status) as any}
                        sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', lineHeight: 1.5 }}>
                      {si.commentary}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Row 4: Hedging ideas */}
          <Paper sx={{ p: 2.5, mt: 2.5, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Timeline sx={{ fontSize: 18, color: '#5c53a5' }} /> Hedging Ideas
            </Typography>
            <Grid container spacing={1.5}>
              {(insights.hedging_ideas ?? []).map((hi) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={hi.sector}>
                  <Box
                    sx={{
                      p: 1.5, borderRadius: 1.5, height: '100%',
                      border: '1px solid #eee', bgcolor: '#fafafa',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                        {hi.sector}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', lineHeight: 1.5 }}>
                      {hi.idea}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Disclaimer */}
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', mt: 2, textAlign: 'center', fontStyle: 'italic' }}
          >
            AI-generated insights are for informational purposes only and do not constitute financial advice.
            Always conduct your own due diligence before making investment decisions.
          </Typography>
        </Box>
      )}
    </Box>
  );
}