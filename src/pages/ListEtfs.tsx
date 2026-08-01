import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { PieChart } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { etfAPI } from '../api/client';
import { ETFSymbol } from '../types';

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

const CARD_SX = {
  borderRadius: 2,
  boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
  border: '1px solid',
  borderColor: 'grey.200',
};

const ListEtfs: React.FC = () => {
  const [etfs, setEtfs] = useState<ETFSymbol[]>([]);
  const [filteredEtfs, setFilteredEtfs] = useState<ETFSymbol[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    loadEtfs();
  }, []);

  useEffect(() => {
    // Extract unique industries from ETFs
    const uniqueIndustries = Array.from(
      new Set(
        etfs
          .map((etf) => etf.sector_industry)
          .filter((industry): industry is string => !!industry)
      )
    ).sort();
    setIndustries(uniqueIndustries);
  }, [etfs]);

  useEffect(() => {
    // Filter ETFs based on selected industries
    if (selectedIndustries.length === 0) {
      setFilteredEtfs(etfs);
    } else {
      setFilteredEtfs(
        etfs.filter((etf) => 
          etf.sector_industry && selectedIndustries.includes(etf.sector_industry)
        )
      );
    }
  }, [selectedIndustries, etfs]);

  const loadEtfs = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await etfAPI.getAll('list');
      setEtfs(response.data);
      console.log('ETFs loaded:', response.data);
      setFilteredEtfs(response.data);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to load ETFs:', error);
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

  // Define DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 120,
      align: 'left',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.row.name || 'No name available'} arrow>
          <Typography variant="body2" fontWeight={600} sx={{ cursor: 'pointer' }}>
            {params.value}
          </Typography>
        </Tooltip>
      ),
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
        
        // Calculate position and color
        let priceColor = 'text.primary';
        if (price_last_close != null && price_52w_low != null && price_52w_high != null) {
          const position = calculate52WeekPosition(price_last_close, price_52w_low, price_52w_high);
          const colorType = getProgressColor(position);
          priceColor = colorType === 'success' ? 'success.main' : 
                       colorType === 'warning' ? 'warning.main' : 'error.main';
        }
        
        return (
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
        );
      },
    },
    {
      field: 'price_change_pct',
      headerName: 'Change',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const pct = params.row.price_change_pct;
        const change = params.row.price_change;
        if (pct == null) {
          return <Typography variant="body2" color="text.disabled">—</Typography>;
        }
        const positive = pct >= 0;
        const color = positive ? 'success.main' : 'error.main';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="body2" fontWeight={700} color={color}>
              {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </Typography>
            {change != null && (
              <Typography variant="caption" color={color}>
                {positive ? '+' : ''}{change.toFixed(2)}
              </Typography>
            )}
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

        const percentage = calculate52WeekPosition(price_last_close, price_52w_low, price_52w_high);
        const color = getProgressColor(percentage);

        return (
          <Tooltip 
            title={
              <Box>
                <Typography variant="caption">52w Low: {price_52w_low.toFixed(2)}</Typography><br />
                <Typography variant="caption">Current: {price_last_close.toFixed(2)}</Typography><br />
                <Typography variant="caption">52w High: {price_52w_high.toFixed(2)}</Typography>
              </Box>
            }
            arrow
          >
            <Box sx={{ width: '100%', px: 1 }}>
              <LinearProgress
                variant="determinate"
                value={percentage}
                color={color}
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {percentage.toFixed(0)}%
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'ma_analysis',
      headerName: 'MA Analysis',
      headerAlign: 'center',
      width: 250,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const { price_last_close, price_ma_20d, price_ma_200d } = params.row;
        
        // Get MA signal
        const { signal: signalLabel, color: signalColor } = getMASignal(
          price_last_close,
          price_ma_20d,
          price_ma_200d
        );

        if (!price_last_close || !price_ma_20d || !price_ma_200d) {
          return (
            <Box sx={{ width: '100%', px: 1 }}>
              <Typography variant="caption" color="text.secondary">No MA data</Typography>
            </Box>
          );
        }

        // Create array of values to sort
        const values = [
          { value: price_last_close, label: 'Current', color: 'primary.main' },
          { value: price_ma_20d, label: '20d', color: 'success.main' },
          { value: price_ma_200d, label: '200d', color: 'error.main' }
        ].sort((a, b) => a.value - b.value);

        const minValue = values[0].value;
        const maxValue = values[2].value;
        const range = maxValue - minValue;

        // Calculate positions
        const getPosition = (value: number) => {
          if (range === 0) return 50;
          return ((value - minValue) / range) * 100;
        };

        const minItem = values[0];
        const middleItem = values[1];
        const maxItem = values[2];

        const ma20Position = getPosition(price_ma_20d);
        const ma200Position = getPosition(price_ma_200d);
        const currentPosition = getPosition(price_last_close);

        const middleColor = middleItem.label === 'Current' ? 'primary.main' :
                           middleItem.label === '20d' ? 'success.main' : 'error.main';

        return (
          <Tooltip
            title={
              <Box>
                <Typography variant="caption">Current: {price_last_close.toFixed(2)}</Typography><br />
                <Typography variant="caption">MA 20d: {price_ma_20d.toFixed(2)}</Typography><br />
                <Typography variant="caption">MA 200d: {price_ma_200d.toFixed(2)}</Typography>
              </Box>
            }
            arrow
          >
            <Box sx={{ width: '100%', px: 1 }}>
              {/* Visual bar */}
              <Box sx={{ position: 'relative', height: 16, mb: 0.5 }}>
                {/* Background bar */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: 6,
                    backgroundColor: 'grey.200',
                    borderRadius: 1,
                  }}
                />
                {/* Min marker */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '0%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 3,
                    height: 12,
                    backgroundColor: minItem.label === 'Current' ? 'primary.main' :
                                   minItem.label === '20d' ? 'success.main' : 'error.main',
                    borderRadius: 0.5,
                    zIndex: 1,
                    border: '1px solid white',
                  }}
                />
                {/* Max marker */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '100%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 3,
                    height: 12,
                    backgroundColor: maxItem.label === 'Current' ? 'primary.main' :
                                   maxItem.label === '20d' ? 'success.main' : 'error.main',
                    borderRadius: 0.5,
                    zIndex: 2,
                    border: '1px solid white',
                  }}
                />
                {/* Middle marker */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${middleItem.label === 'Current' ? currentPosition :
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
      field: 'expense_ratio',
      headerName: 'Expense Ratio',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? `${params.value.toFixed(2)}%` : '-'}
        </Typography>
      ),
    },
    {
      field: 'liquidity',
      headerName: 'Avg Volume',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value;
        if (value == null) return <Typography variant="body2">-</Typography>;
        
        // Format large numbers
        const formatted = value >= 1000000 
          ? `${(value / 1000000).toFixed(2)}M`
          : value >= 1000
          ? `${(value / 1000).toFixed(2)}K`
          : value.toFixed(0);
        
        return (
          <Typography variant="body2">
            {formatted}
          </Typography>
        );
      },
    },
    {
      field: 'tracking_error',
      headerName: 'Tracking Error',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value != null ? `${params.value.toFixed(2)}%` : '-'}
        </Typography>
      ),
    },
    {
      field: 'price_last_updated',
      headerName: 'History Updated',
      width: 160,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const daysAgo = getDaysAgo(params.value);
        const isStale = params.value && new Date(params.value) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        return (
          <Typography 
            variant="body2" 
            color={isStale ? 'error' : 'text.primary'}
            fontWeight={isStale ? 600 : 400}
          >
            {daysAgo || 'No data'}
          </Typography>
        );
      },
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <PieChart sx={{ color: '#667eea' }} />
          <Typography variant="h6" fontWeight={700}>
            ETFs
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          {lastRefreshed && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography>
          )}
          <Chip 
            label={`${filteredEtfs.length} of ${etfs.length} ETFs`}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Filter Section */}
      <Paper sx={{ width: '100%', p: 2, mb: 2, ...CARD_SX }}>
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
      <Paper sx={{ width: '100%', p: 2, ...CARD_SX }}>
        <Box sx={{ height: '80vh', width: '100%' }}>
          <DataGrid
            rows={filteredEtfs}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.symbol}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25, page: 0 },
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

export default ListEtfs;