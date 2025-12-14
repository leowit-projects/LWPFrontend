import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { ShowChart, Timeline } from '@mui/icons-material';
import { historicalChartsAPI } from '../api/client';
import { 
  PriceHistoryData, 
  TimeRange, 
  AssetTypeParam, 
  ChartSummary 
} from '../types';

const StockHistory: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.ONE_YEAR);
  const [chartType, setChartType] = useState<'simple' | 'ma'>('simple');
  const [simpleHistory, setSimpleHistory] = useState<PriceHistoryData | null>(null);
  const [maHistory, setMAHistory] = useState<PriceHistoryData | null>(null);
  const [summary, setSummary] = useState<ChartSummary | null>(null);

  useEffect(() => {
    if (symbol) {
      loadAllData();
    }
  }, [symbol, timeRange]);

  const loadAllData = async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      // Load data in parallel
      const [simpleResponse, maResponse, summaryResponse] = await Promise.all([
        historicalChartsAPI.getSimpleHistory(symbol, AssetTypeParam.STOCK, timeRange),
        historicalChartsAPI.getHistoryWithMA(symbol, AssetTypeParam.STOCK, timeRange),
        historicalChartsAPI.getChartSummary(symbol, AssetTypeParam.STOCK),
      ]);

      setSimpleHistory(simpleResponse.data);
      setMAHistory(maResponse.data);
      setSummary(summaryResponse.data);
    } catch (err: any) {
      console.error('Error loading stock history:', err);
      setError(err.response?.data?.detail || 'Failed to load stock history');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTimeRange: TimeRange | null
  ) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };

  const handleChartTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newChartType: 'simple' | 'ma' | null
  ) => {
    if (newChartType !== null) {
      setChartType(newChartType);
    }
  };

  const getCurrencySymbol = (currency: string): string => {
    switch (currency) {
      case 'USD':
        return '$';
      case 'INR':
        return '₹';
      default:
        return currency;
    }
  };

  const formatPrice = (price: number | null | undefined): string => {
    if (price == null) return 'N/A';
    return price.toFixed(2);
  };

  // Prepare chart data
  const currentHistory = chartType === 'simple' ? simpleHistory : maHistory;
  
  const chartData = currentHistory?.history || [];
  const dates = chartData.map((item) => new Date(item.date));
  const closePrices = chartData.map((item) => item.close_price || 0);
  const ma20Data = chartData.map((item) => item.ma_20 || null);
  const ma200Data = chartData.map((item) => item.ma_200 || null);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!currentHistory || chartData.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="warning">No price history data available for {symbol}</Alert>
      </Container>
    );
  }

  const currencySymbol = getCurrencySymbol(summary?.currency || 'USD');

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {symbol}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {summary?.asset_type || 'Stock'} Price History
          </Typography>
        </Box>
        <Chip 
          label={`${currentHistory.data_points} data points`} 
          color="primary" 
          variant="outlined" 
        />
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Price
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {currencySymbol}{formatPrice(summary.current_price)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  52W Low
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight={600}>
                  {currencySymbol}{formatPrice(summary.price_52w_low)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  52W High
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight={600}>
                  {currencySymbol}{formatPrice(summary.price_52w_high)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Updated
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {summary.last_updated || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          {/* Time Range Toggle */}
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Time Range
            </Typography>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              size="small"
            >
              <ToggleButton value={TimeRange.YTD}>YTD</ToggleButton>
              <ToggleButton value={TimeRange.ONE_YEAR}>1Y</ToggleButton>
              <ToggleButton value={TimeRange.THREE_YEARS}>3Y</ToggleButton>
              <ToggleButton value={TimeRange.FIVE_YEARS}>5Y</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Chart Type Toggle */}
          <Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Chart Type
            </Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={handleChartTypeChange}
              size="small"
            >
              <ToggleButton value="simple">
                <ShowChart sx={{ mr: 1 }} />
                Price Only
              </ToggleButton>
              <ToggleButton value="ma">
                <Timeline sx={{ mr: 1 }} />
                With Moving Averages
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Paper>

      {/* Chart */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" mb={2}>
          {chartType === 'simple' ? 'Close Price' : 'Close Price with Moving Averages'}
        </Typography>
        
        <Box sx={{ width: '100%', height: 500 }}>
          {chartType === 'simple' ? (
            <LineChart
              xAxis={[
                {
                  data: dates,
                  scaleType: 'time',
                  valueFormatter: (date) => date.toLocaleDateString(),
                },
              ]}
              series={[
                {
                  data: closePrices,
                  label: 'Close Price',
                  color: '#1976d2',
                  showMark: false,
                  curve: 'linear',
                },
              ]}
              height={500}
              margin={{ left: 80, right: 20, top: 20, bottom: 60 }}
              sx={{
                '& .MuiLineElement-root': {
                  strokeWidth: 2,
                },
              }}
            />
          ) : (
            <LineChart
              xAxis={[
                {
                  data: dates,
                  scaleType: 'time',
                  valueFormatter: (date) => date.toLocaleDateString(),
                },
              ]}
              series={[
                {
                  data: closePrices,
                  label: 'Close Price',
                  color: '#1976d2',
                  showMark: false,
                  curve: 'linear',
                },
                {
                  data: ma20Data,
                  label: 'MA 20',
                  color: '#ff9800',
                  showMark: false,
                  curve: 'linear',
                },
                {
                  data: ma200Data,
                  label: 'MA 200',
                  color: '#f44336',
                  showMark: false,
                  curve: 'linear',
                },
              ]}
              height={500}
              margin={{ left: 80, right: 20, top: 20, bottom: 60 }}
              sx={{
                '& .MuiLineElement-root': {
                  strokeWidth: 2,
                },
              }}
            />
          )}
        </Box>

        {/* Chart Info */}
        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Period: {currentHistory.start_date} to {currentHistory.end_date}
          </Typography>
          {chartType === 'ma' && (
            <Box display="flex" gap={2}>
              <Chip 
                label="MA 20" 
                size="small" 
                sx={{ backgroundColor: '#ff9800', color: 'white' }} 
              />
              <Chip 
                label="MA 200" 
                size="small" 
                sx={{ backgroundColor: '#f44336', color: 'white' }} 
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Additional Summary Info */}
      {summary && chartType === 'ma' && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" mb={2}>
            Moving Average Analysis
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                MA 20
              </Typography>
              <Typography variant="h6">
                {currencySymbol}{formatPrice(summary.ma_20)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                MA 200
              </Typography>
              <Typography variant="h6">
                {currencySymbol}{formatPrice(summary.ma_200)}
              </Typography>
            </Grid>
            {summary.pe_ratio != null && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  P/E Ratio
                </Typography>
                <Typography variant="h6">
                  {formatPrice(summary.pe_ratio)}
                </Typography>
              </Grid>
            )}
            {summary.dividend_yield != null && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Dividend Yield
                </Typography>
                <Typography variant="h6">
                  {formatPrice(summary.dividend_yield)}%
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}
    </Container>
  );
};

export default StockHistory;
