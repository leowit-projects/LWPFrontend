import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Schedule,
  TrendingUp,
  Assessment,
  Lightbulb,
  PieChart
} from '@mui/icons-material';
import { adminAPI } from '../../api/client';

interface TriggerState {
  loading: boolean;
  message: string | null;
  error: string | null;
}

const Scheduler: React.FC = () => {
  const [dailyPrices, setDailyPrices] = useState<TriggerState>({
    loading: false,
    message: null,
    error: null,
  });

  const [marketSnapshots, setMarketSnapshots] = useState<TriggerState>({
    loading: false,
    message: null,
    error: null,
  });

  const [recommendations, setRecommendations] = useState<TriggerState>({
    loading: false,
    message: null,
    error: null,
  });

  const [shareholdingIndia, setShareholdingIndia] = useState<TriggerState>({
    loading: false,
    message: null,
    error: null,
  });

  const handleTriggerDailyPrices = async (): Promise<void> => {
    setDailyPrices({ loading: true, message: null, error: null });
    try {
      const response = await adminAPI.triggerDailyPrices();
      setDailyPrices({
        loading: false,
        message: `${response.data.message}. ${response.data.info}`,
        error: null,
      });
    } catch (error: any) {
      setDailyPrices({
        loading: false,
        message: null,
        error: error.response?.data?.detail || 'Failed to trigger daily prices update',
      });
    }
  };

  const handleTriggerMarketSnapshots = async (): Promise<void> => {
    setMarketSnapshots({ loading: true, message: null, error: null });
    try {
      const response = await adminAPI.triggerMarketSnapshots();
      setMarketSnapshots({
        loading: false,
        message: `${response.data.message}. ${response.data.info}`,
        error: null,
      });
    } catch (error: any) {
      setMarketSnapshots({
        loading: false,
        message: null,
        error: error.response?.data?.detail || 'Failed to trigger market snapshots update',
      });
    }
  };

  const handleTriggerRecommendations = async (): Promise<void> => {
    setRecommendations({ loading: true, message: null, error: null });
    try {
      const response = await adminAPI.triggerRecommendations();
      setRecommendations({
        loading: false,
        message: `${response.data.message}. ${response.data.info}`,
        error: null,
      });
    } catch (error: any) {
      setRecommendations({
        loading: false,
        message: null,
        error: error.response?.data?.detail || 'Failed to trigger recommendations calculation',
      });
    }
  };

  const handleTriggerShareholdingIndia = async (): Promise<void> => {
    setShareholdingIndia({ loading: true, message: null, error: null });
    try {
      const response = await adminAPI.triggerShareholdingIndia();
      setShareholdingIndia({
        loading: false,
        message: response.data.message,
        error: null,
      });
    } catch (error: any) {
      setShareholdingIndia({
        loading: false,
        message: null,
        error: error.response?.data?.detail || 'Failed to trigger shareholding update',
      });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Schedule sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={700}>
          Scheduler Management
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        These actions will trigger background jobs. The jobs will run asynchronously and you can check the Audit Logs for completion status and results.
      </Alert>

      <Grid container spacing={3}>
        {/* Daily Price Update */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" component="div">
                  Daily Price Update
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Updates price history for all active stocks and ETFs. Fetches incremental data from yfinance and updates moving averages.
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Chip label="Stocks" size="small" color="primary" variant="outlined" />
                <Chip label="ETFs" size="small" color="primary" variant="outlined" />
                <Chip label="Price History" size="small" variant="outlined" />
                <Chip label="Moving Averages" size="small" variant="outlined" />
              </Box>
              {dailyPrices.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {dailyPrices.message}
                </Alert>
              )}
              {dailyPrices.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {dailyPrices.error}
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                fullWidth
                variant="contained"
                onClick={handleTriggerDailyPrices}
                disabled={dailyPrices.loading}
                startIcon={dailyPrices.loading ? <CircularProgress size={20} /> : <Schedule />}
              >
                {dailyPrices.loading ? 'Scheduling...' : 'Trigger Daily Prices'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Market Snapshot Update */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Assessment sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6" component="div">
                  Market Snapshots
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Calculates and updates market snapshots for all active stocks and ETFs. Includes metrics like 52w high/low, PE ratio, PEG, RSI, etc.
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Chip label="52w Range" size="small" color="secondary" variant="outlined" />
                <Chip label="PE Ratio" size="small" color="secondary" variant="outlined" />
                <Chip label="PEG/PEGY" size="small" variant="outlined" />
                <Chip label="RSI" size="small" variant="outlined" />
              </Box>
              {marketSnapshots.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {marketSnapshots.message}
                </Alert>
              )}
              {marketSnapshots.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {marketSnapshots.error}
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                onClick={handleTriggerMarketSnapshots}
                disabled={marketSnapshots.loading}
                startIcon={marketSnapshots.loading ? <CircularProgress size={20} /> : <Schedule />}
              >
                {marketSnapshots.loading ? 'Scheduling...' : 'Trigger Market Snapshots'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Recommendations Calculation */}
        <Grid size={{ xs: 12, md: 4 }} >
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Lightbulb sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6" component="div">
                  Recommendations
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Calculates BUY/SELL recommendations for all active stocks and ETFs based on configured strategies.
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Chip label="Buy Signals" size="small" color="success" variant="outlined" />
                <Chip label="Sell Signals" size="small" color="error" variant="outlined" />
                <Chip label="Strategy Analysis" size="small" variant="outlined" />
              </Box>
              {recommendations.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {recommendations.message}
                </Alert>
              )}
              {recommendations.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {recommendations.error}
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                fullWidth
                variant="contained"
                color="warning"
                onClick={handleTriggerRecommendations}
                disabled={recommendations.loading}
                startIcon={recommendations.loading ? <CircularProgress size={20} /> : <Schedule />}
              >
                {recommendations.loading ? 'Scheduling...' : 'Trigger Recommendations'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Indian Shareholding Pattern Update */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              border: '1px solid',
              borderColor: 'success.light',
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(46, 125, 50, 0.08)'
                  : 'rgba(237, 247, 237, 0.6)',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center">
                  <PieChart sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6" component="div">
                    Shareholding Pattern
                  </Typography>
                </Box>
                <Tooltip title="India — NSE / BSE stocks only">
                  <Typography fontSize={24} lineHeight={1} sx={{ cursor: 'default' }}>
                    🇮🇳
                  </Typography>
                </Tooltip>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={2}>
                Scrapes quarterly shareholding data for all active Indian stocks from screener.in and
                updates Promoters, FIIs, DIIs, Government and Public holding percentages.
              </Typography>

              <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
                <Chip label="Promoters" size="small" color="success" variant="outlined" />
                <Chip label="FIIs" size="small" color="info" variant="outlined" />
                <Chip label="DIIs" size="small" color="primary" variant="outlined" />
                <Chip label="Govt" size="small" variant="outlined" />
                <Chip label="Public" size="small" variant="outlined" />
              </Box>

              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Chip
                  label="Monthly job"
                  size="small"
                  color="warning"
                  variant="filled"
                  sx={{ fontWeight: 600 }}
                />
                <Chip label="screener.in" size="small" variant="outlined" />
              </Box>

              {shareholdingIndia.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {shareholdingIndia.message}
                </Alert>
              )}
              {shareholdingIndia.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {shareholdingIndia.error}
                </Alert>
              )}
            </CardContent>

            <CardActions>
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={handleTriggerShareholdingIndia}
                disabled={shareholdingIndia.loading}
                startIcon={
                  shareholdingIndia.loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Schedule />
                  )
                }
              >
                {shareholdingIndia.loading ? 'Scheduling...' : 'Trigger Shareholding Update'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Info Section */}
      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          How It Works
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          When you click any of the trigger buttons above, the system will schedule the job to run in the background. 
          You will receive an immediate confirmation, and the job will execute asynchronously.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>To check the status and results:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul>
            <li>Navigate to <strong>Admin → Audit Logs</strong></li>
            <li>Look for entries with actions like "Daily Price Scheduled Started/Completed"</li>
            <li>Check the "Success" column and "Details" for results</li>
            <li>Failed actions will show error messages in the "Error Message" column</li>
          </ul>
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Note:</strong> These operations can take several minutes depending on the number of stocks and ETFs. 
          Avoid triggering the same job multiple times in quick succession.
        </Alert>
      </Paper>
    </Container>
  );
};

export default Scheduler;