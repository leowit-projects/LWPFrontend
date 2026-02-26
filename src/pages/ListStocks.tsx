import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  LinearProgress,
  Checkbox,
  ListItemText,
  Link,
  Button,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { stockAPI } from '../api/client';
import { StockSymbol } from '../types';
// import { getSectorEmoji } from '../utils/sectorEmojis';

// Helper function to calculate days difference
const getDaysAgo = (date: string | null): string => {
  if (!date) return '';
  
  const priceDate = new Date(date);
  const now = new Date();
  
  // Reset time to midnight for accurate day comparison
  priceDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() - priceDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return '1 day ago';
  } else if (diffDays < 0) {
    return 'Future date';
  } else {
    return `${diffDays} days ago`;
  }
};

// Calculate 52-week range percentage
const calculate52WeekPosition = (current: number | null, low: number | null, high: number | null): number => {
  if (current == null || low == null || high == null || high === low) {
    return 0;
  }
  const position = ((current - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, position));
};

// Get color based on position
const getProgressColor = (percentage: number): 'error' | 'warning' | 'success' => {
  if (percentage < 28) return 'success';
  if (percentage < 55) return 'warning';
  return 'error';
};

// Get moving average signal
const getMASignal = (
  closePrice: number | null | undefined,
  ma20: number | null | undefined,
  ma200: number | null | undefined
): { signal: string; color: string; chipColor: 'success' | 'error' | 'warning' | 'default' } => {
  if (!closePrice || !ma20 || !ma200) {
    return { signal: 'No Data', color: 'text.disabled', chipColor: 'default' };
  }

  const aboveMA20 = closePrice > ma20;
  const aboveMA200 = closePrice > ma200;
  const ma20AboveMA200 = ma20 > ma200;

  // Golden Cross: MA20 > MA200 and price above both
  if (aboveMA20 && aboveMA200 && ma20AboveMA200) {
    return { signal: 'Strong Bullish', color: 'success.main', chipColor: 'success' };
  }
  
  // Bullish: Price above both MAs but no golden cross yet
  if (aboveMA20 && aboveMA200) {
    return { signal: 'Bullish', color: 'success.light', chipColor: 'success' };
  }

  // Death Cross: MA20 < MA200 and price below both
  if (!aboveMA20 && !aboveMA200 && !ma20AboveMA200) {
    return { signal: 'Strong Bearish', color: 'error.main', chipColor: 'error' };
  }

  // Bearish: Price below both MAs
  if (!aboveMA20 && !aboveMA200) {
    return { signal: 'Bearish', color: 'error.light', chipColor: 'error' };
  }

  // Mixed signals
  return { signal: 'Neutral', color: 'warning.main', chipColor: 'warning' };
};

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string): string => {
  switch (currency) {
    case 'USD':
      return '$';
    case 'INR':
      return '₹';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return currency;
  }
};

const ListStocks: React.FC = () => {
  const [stocks, setStocks] = useState<StockSymbol[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockSymbol[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]); // New state for selected stock symbols
  const [sectorButtonFilter, setSectorButtonFilter] = useState<string>('All');

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    // Extract unique industries from stocks
    const uniqueIndustries = Array.from(
      new Set(
        stocks
          .map((stock) => stock.sector_industry)
          .filter((industry): industry is string => !!industry)
      )
    ).sort();
    setIndustries(uniqueIndustries);
  }, [stocks]);

  useEffect(() => {
    let result = stocks;

    // First apply sector button filter
    if (sectorButtonFilter !== 'All') {
      if (sectorButtonFilter === 'Others') {
        result = result.filter(stock => 
          !['Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Software Services', 'Energy'].includes(
            stock.sector_industry?.split(' - ')[0] || ''
          )
        );
      } else {
        result = result.filter(stock => 
          stock.sector_industry?.split(' - ')[0] === sectorButtonFilter
        );
      }
    }

    // Then apply industry dropdown filter
    if (selectedIndustries.length > 0) {
      result = result.filter((stock) => 
        stock.sector_industry && selectedIndustries.includes(stock.sector_industry)
      );
    }

    setFilteredStocks(result);
  }, [selectedIndustries, stocks, sectorButtonFilter]);

  const loadStocks = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await stockAPI.getAll('list');
      setStocks(response.data);
      setFilteredStocks(response.data);
      console.log('Filtered Stocks set:', response.data);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to load stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIndustryChange = (event: any) => {
    const value = event.target.value;
    // Handle "all" selection
    if (value.includes('all')) {
      setSelectedIndustries([]);
    } else {
      setSelectedIndustries(value);
    }
  };

  const handleGetSymbols = () => {
    // Get the selected stocks with their last close prices
    const selectedStockData = stocks
      .filter(stock => selectedStocks.includes(stock.symbol))
      .map(stock => ({
        symbol: stock.symbol,
        price: stock.price_last_close ? Math.round(stock.price_last_close) : 0
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    // Format the output
    const formattedOutput = selectedStockData
      .map(stock => `${stock.symbol} - ${stock.price}`)
      .join('\n');

    // Copy to clipboard and show alert
    navigator.clipboard.writeText(formattedOutput).then(() => {
      alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}\n\nCopied to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      alert(`Selected Symbols (${selectedStockData.length}):\n\n${formattedOutput}`);
    });
  };

  // Define DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'checkbox',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <Checkbox
          checked={selectedStocks.length === filteredStocks.length && filteredStocks.length > 0}
          indeterminate={selectedStocks.length > 0 && selectedStocks.length < filteredStocks.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedStocks(filteredStocks.map(stock => stock.symbol));
            } else {
              setSelectedStocks([]);
            }
          }}
        />
      ),
      renderCell: (params: GridRenderCellParams) => (
        <Checkbox
          checked={selectedStocks.includes(params.row.symbol)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedStocks([...selectedStocks, params.row.symbol]);
            } else {
              setSelectedStocks(selectedStocks.filter(s => s !== params.row.symbol));
            }
          }}
        />
      ),
    },
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 150,
      align: 'left',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const recommendation = params.row.recommendation;
        const showChip = recommendation === 'BUY' || recommendation === 'SELL';
        const isNotEligible = params.row.is_purchase_eligible === false;
        // const sectorEmoji = getSectorEmoji(params.row.sector_industry);

        return (
          <Box display="flex" alignItems="center" gap={0.75}>
            {/* <Tooltip title={params.row.sector_industry || 'No sector available'} arrow>
              <span style={{ fontSize: '1.2rem', lineHeight: 1, marginTop: -8 }}>{sectorEmoji}</span>
            </Tooltip> */}
            <Tooltip title={params.row.name || 'No name available'} arrow>
              <Link
                component={RouterLink}
                to={`/list-stocks/${params.value}/history`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  fontWeight: 600,
                  color: 'secondary.main',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.dark',
                  },
                  mt: -1,
                }}
              >
                <span style={{ textDecoration: isNotEligible ? 'line-through' : 'none', color: isNotEligible ? 'text.disabled' : 'inherit' }}>
                    {params.value}
                </span>
              </Link>
            </Tooltip>
            {showChip && (
              <Chip
                label={recommendation === 'BUY' ? 'B' : 'S'}
                size="small"
                sx={{
                  height: 20,
                  minWidth: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: recommendation === 'BUY' ? 'success.main' : 'error.main',
                  mt: -1,
                  color: 'white',
                  '& .MuiChip-label': {
                    padding: '0 4px',
                  },
                }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'price_last_close',
      headerName: 'Last Close Price',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const currencySymbol = getCurrencySymbol(params.row.currency);
        const { price_last_close, price_52w_low, price_52w_high } = params.row;
        const daysAgo = getDaysAgo(params.row.price_last_updated);

        // Calculate position and color
        let priceColor = 'text.primary';
        if (price_last_close != null && price_52w_low != null && price_52w_high != null) {
          const position = calculate52WeekPosition(price_last_close, price_52w_low, price_52w_high);
          const colorType = getProgressColor(position);
          priceColor = colorType === 'success' ? 'success.main' : 
                       colorType === 'warning' ? 'warning.main' : 'error.main';
        }
        
        return (
          <Box>
            <Box display="flex" alignItems="center" justifyContent="flex-end">
              {params.value != null ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 0.3 }}>
                    {currencySymbol}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color={priceColor}>
                    {params.value.toFixed(2)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2">-</Typography>
              )}
            </Box>
            <Typography 
              variant="body2" 
              sx={{ fontSize: '0.75rem' }}
              color={'lightgrey'}
            >
              {daysAgo || 'No data'} 
            </Typography>
          </Box>


        );
      },
    },
    {
      field: '52w_range',
      headerName: '52w Range',
      headerAlign: 'center',
      width: 200,
      sortable: true,
      filterable: false,
      valueGetter: (_value: any, row: any) => {
        const { price_last_close, price_52w_low, price_52w_high } = row;
        if (price_last_close == null || price_52w_low == null || price_52w_high == null) {
          return null;
        }
        return calculate52WeekPosition(price_last_close, price_52w_low, price_52w_high);
      },
      renderCell: (params: GridRenderCellParams) => {
        const { price_last_close, price_52w_low, price_52w_high } = params.row;
        
        if (price_last_close == null || price_52w_low == null || price_52w_high == null) {
          return <Typography variant="caption" color="text.secondary">No data</Typography>;
        }

        const position = calculate52WeekPosition(price_last_close, price_52w_low, price_52w_high);
        const color = getProgressColor(position);

        return (
          <Tooltip
            title={
              <Box>
                <Typography variant="caption" display="block">
                  Current: {price_last_close.toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  52w Low: {price_52w_low.toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  52w High: {price_52w_high.toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block" fontWeight={600}>
                  Position: {position.toFixed(1)}%
                </Typography>
              </Box>
            }
            arrow
          >
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <LinearProgress
                variant="determinate"
                value={position}
                color={color}
                sx={{
                  height: 6,
                  borderRadius: 1,
                  backgroundColor: 'grey.300',
                }}
              />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="caption" fontSize="0.7rem" color="text.secondary" fontWeight={600}>
                  {price_52w_low.toFixed(2)}
                </Typography>
                <Typography variant="caption" fontSize="0.7rem" color="text.secondary" fontWeight={600}>
                  {price_52w_high.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'moving_averages',
      headerName: 'Market Sentiment - MA(20/200)',
      width: 220,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const { price_last_close, price_ma_20d, price_ma_200d } = params.row;
        
        if (!price_last_close || !price_ma_20d || !price_ma_200d) {
          return <Typography variant="caption" color="text.secondary">No data</Typography>;
        }

        // Create array with values and their labels
        const dataPoints = [
          { value: price_last_close, label: 'Price', color: null },
          { value: price_ma_20d, label: '20d', color: '#2196f3' },
          { value: price_ma_200d, label: '200d', color: '#ff9800' }
        ];
        
        // Sort by value to find min, middle, max
        const sorted = [...dataPoints].sort((a, b) => a.value - b.value);
        const minItem = sorted[0];
        const middleItem = sorted[1];
        const maxItem = sorted[2];
        
        const minValue = minItem.value;
        const maxValue = maxItem.value;
        const range = maxValue - minValue;
        
        // Calculate positions
        const pricePosition = range > 0 ? ((price_last_close - minValue) / range) * 100 : 50;
        const ma20Position = range > 0 ? ((price_ma_20d - minValue) / range) * 100 : 50;
        const ma200Position = range > 0 ? ((price_ma_200d - minValue) / range) * 100 : 50;
        
        // Determine signal based on price position
        const signal = getMASignal(price_last_close, price_ma_20d, price_ma_200d);
        let signalLabel = '';
        let signalColor = '';
        
        switch (signal.signal) {
          case 'Strong Bullish':
            signalLabel = 'Strong Buy';
            signalColor = '#4caf50';
            break;
          case 'Bullish':
            signalLabel = 'Buy';
            signalColor = '#8bc34a';
            break;
          case 'Neutral':
            signalLabel = 'Neutral';
            signalColor = '#ff9800';
            break;
          case 'Bearish':
            signalLabel = 'Sell';
            signalColor = '#ff5722';
            break;
          case 'Strong Bearish':
            signalLabel = 'Strong Sell';
            signalColor = '#f44336';
            break;
          default:
            signalLabel = 'Neutral';
            signalColor = '#9e9e9e';
        }
        
        // Middle marker color is always black
        const middleColor = '#000000';
        
        return (
          <Tooltip
            title={
              <Box>
                <Typography variant="caption" display="block" fontWeight={600}>
                  Price: {price_last_close.toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  MA(20): {price_ma_20d.toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  MA(200): {price_ma_200d.toFixed(2)}
                </Typography>
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  <Typography variant="caption" display="block">
                    Range: {minValue.toFixed(2)} - {maxValue.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" display="block" fontWeight={600}>
                    {price_ma_20d > price_ma_200d ? '🟢 Golden Cross Territory' : '🔴 Death Cross Territory'}
                  </Typography>
                </Box>
              </Box>
            }
            arrow
          >
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* Main progress bar */}
              <Box sx={{ position: 'relative', width: '100%', height: 8 }}>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{
                    height: 6,
                    borderRadius: 1,
                    backgroundColor: 'grey.300',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'transparent',
                    },
                  }}
                />
                {/* Middle value marker */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${middleItem.label === 'Price' ? pricePosition : 
                           middleItem.label === '20d' ? ma20Position : ma200Position}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 3,
                    height: 12,
                    backgroundColor: middleColor,
                    borderRadius: 0.5,
                    zIndex: 3,
                    border: '1px solid white',
                  }}
                />
              </Box>
              {/* Labels */}
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontSize="0.65rem" color="text.secondary" fontWeight={600}>
                  {minItem.label}
                </Typography>
                <Box 
                  sx={{  
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Typography variant="caption" fontSize="0.7rem" color={signalColor} fontWeight={700}>
                    {signalLabel}
                  </Typography>
                </Box>
                <Typography variant="caption" fontSize="0.65rem" color="text.secondary" fontWeight={600}>
                  {maxItem.label}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'dividend_yield',
      headerName: 'Dividend Yield',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? `${params.value.toFixed(2)}%` : '-'}
        </Typography>
      ),
    },
    {
      field: 'pe_ratio',
      headerName: 'P/E',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? params.value.toFixed(2) : '-'}
        </Typography>
      ),
    },
    {
      field: 'peg_index',
      headerName: 'PEG',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? params.value.toFixed(2) : '-'}
        </Typography>
      ),
    },
    {
      field: 'pegy_index',
      headerName: 'PEGY',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? params.value.toFixed(2) : '-'}
        </Typography>
      ),
    },
    {
      field: 'rsi_index',
      headerName: 'RSI',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const rsi = params.value;
        let color = 'text.primary';
        
        if (rsi != null) {
          if (rsi < 30) {
            color = 'success.main'; // Oversold - potential buy
          } else if (rsi > 70) {
            color = 'error.main'; // Overbought - potential sell
          }
        }
        
        return (
          <Typography variant="body2" color={color} fontWeight={rsi != null && (rsi < 30 || rsi > 70) ? 600 : 400}>
            {rsi != null ? rsi.toFixed(1) : '-'}
          </Typography>
        );
      },
    },
    // {
    //   field: 'price_last_updated',
    //   headerName: 'History Updated',
    //   width: 160,
    //   align: 'center',
    //   headerAlign: 'center',
    //   renderCell: (params: GridRenderCellParams) => {
    //     const daysAgo = getDaysAgo(params.value);
    //     const isStale = params.value && new Date(params.value) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
    //     return (
    //       <Typography 
    //         variant="body2" 
    //         color={isStale ? 'error' : 'text.primary'}
    //         fontWeight={isStale ? 600 : 400}
    //       >
    //         {daysAgo || 'No data'}
    //       </Typography>
    //     );
    //   },
    // },
    {
      field: 'sector_industry',
      headerName: 'Industry',
      width: 200,
      align: 'left',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || '-'}
        </Typography>
      ),  
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={700}>
          Stocks
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {selectedStocks.length > 0 && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleGetSymbols}
              sx={{ fontWeight: 600 }}
            >
              Get Symbols ({selectedStocks.length})
            </Button>
          )}
          {lastRefreshed && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography>
          )}
          <Chip 
            label={`${filteredStocks.length} of ${stocks.length} stocks`}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Sector Button Group Filter */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['All', 'Finance', 'Auto Ancillary', 'FMCG', 'Healthcare', 'Software Services', 'Energy', 'Others'].map((sec) => (
            <Button
              key={sec}
              variant={sectorButtonFilter === sec ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setSectorButtonFilter(sec)}
              sx={{
                fontSize: '0.72rem',
                py: 0.4,
                px: 1.5,
                textTransform: 'none',
                fontWeight: sectorButtonFilter === sec ? 700 : 500,
                ...(sectorButtonFilter === sec ? {
                  bgcolor: '#1976d2',
                  color: 'white',
                  '&:hover': { bgcolor: '#1565c0' }
                } : {
                  borderColor: '#ddd',
                  color: 'text.secondary',
                  '&:hover': { borderColor: '#bbb', bgcolor: '#f5f5f5' }
                })
              }}
            >
              {sec}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Filter Section */}
      <Paper sx={{ width: '100%', p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Filter by Industry</InputLabel>
            <Select
              multiple
              value={selectedIndustries}
              label="Filter by Industry"
              onChange={handleIndustryChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.length === 0 ? (
                    <em>All Industries</em>
                  ) : (
                    `${selected.length} selected`
                  )}
                </Box>
              )}
            >
              <MenuItem value="all">
                <Checkbox checked={selectedIndustries.length === 0} />
                <ListItemText primary={<em>All Industries</em>} />
              </MenuItem>
              {industries.map((industry) => (
                <MenuItem key={industry} value={industry}>
                  <Checkbox checked={selectedIndustries.includes(industry)} />
                  <ListItemText primary={industry} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Display individual chips for each selected industry */}
          {selectedIndustries.map((industry) => (
            <Chip
              key={industry}
              label={industry}
              onDelete={() => {
                setSelectedIndustries(selectedIndustries.filter(i => i !== industry));
              }}
              color="primary"
              variant="outlined"
            />
          ))}
          
          {/* Clear all button when multiple industries selected */}
          {selectedIndustries.length > 1 && (
            <Chip
              label="Clear all"
              onDelete={() => setSelectedIndustries([])}
              onClick={() => setSelectedIndustries([])}
              color="secondary"
            />
          )}
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ width: '100%', p: 2 }}>
        <Box sx={{ height: '90vh', width: '100%' }}>
          <DataGrid
            rows={filteredStocks}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.symbol}
            disableRowSelectionOnClick
            pageSizeOptions={[50, 100, 150]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 50, page: 0 },
              },
              sorting: {
                sortModel: [{ field: '52w_range', sort: 'asc' }],
              },
            }}
            rowHeight={60}
            sx={{
              '& .MuiDataGrid-cell': {
                padding: '8px',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'grey.50',
              },
              '& .MuiDataGrid-columnHeader': {
                color: 'primary.main',
              },
              '.MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold !important',
              },
            }}
          />
        </Box>
      </Paper>
    </Container>
  );
};

export default ListStocks;