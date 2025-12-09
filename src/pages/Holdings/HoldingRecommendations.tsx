import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Timeline,
  Assessment,
} from '@mui/icons-material';
import { holdingAccountsAPI } from '../../api/client';
import {
  HoldingAccount,
  HoldingRecommendationsResponse,
} from '../../types';

const HoldingRecommendations: React.FC = () => {

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [accounts, setAccounts] = useState<HoldingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [recommendations, setRecommendations] = useState<HoldingRecommendationsResponse | null>(null);
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string[]>(['BUY', 'SELL', 'HOLD']);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadRecommendations();
    }
  }, [selectedAccountId, includeInactive]);

  const loadAccounts = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getAll(false);
      const activeAccounts = response.data;
      setAccounts(activeAccounts);
      
      // Auto-select first account if available
      if (activeAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(activeAccounts[0].account_id);
      }
    } catch (error: any) {
      console.error('Failed to load accounts:', error);
      setError(error.response?.data?.detail || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async (): Promise<void> => {
    if (!selectedAccountId) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getHoldingRecommendations(
        selectedAccountId,
        includeInactive
      );
      setRecommendations(response.data);
    } catch (error: any) {
      console.error('Failed to load recommendations:', error);
      setError(error.response?.data?.detail || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (event: any) => {
    setSelectedAccountId(event.target.value);
  };

  const handleFilterChange = (
    _event: React.MouseEvent<HTMLElement>,
    newFilters: string[]
  ) => {
    if (newFilters.length > 0) {
      setFilterType(newFilters);
    }
  };

  const formatCurrency = (value: number, currency: string): string => {
    if (currency === 'INR') {
      const isNegative = value < 0;
      const absValue = Math.abs(value);
      
      const formatted = absValue.toFixed(2);
      const [integerPart, decimalPart] = formatted.split('.');
      
      let lastThree = integerPart.substring(integerPart.length - 3);
      const otherNumbers = integerPart.substring(0, integerPart.length - 3);
      
      if (otherNumbers !== '') {
        lastThree = ',' + lastThree;
      }
      
      const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
      
      return `${isNegative ? '-' : ''}₹${formattedInteger}.${decimalPart}`;
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRecommendationColor = (type: string): 'success' | 'error' | 'warning' => {
    switch (type) {
      case 'BUY':
        return 'success';
      case 'SELL':
        return 'error';
      case 'HOLD':
        return 'warning';
      default:
        return 'warning';
    }
  };

  const getSelectedAccount = (): HoldingAccount | undefined => {
    return accounts.find((acc) => acc.account_id === selectedAccountId);
  };

  const filteredRecommendations = recommendations?.recommendations.filter(
    (rec) => filterType.includes(rec.recommendation_type)
  ) || [];

  // DataGrid Columns
  const columns: GridColDef[] = [
    {
      field: 'stock_symbol',
      headerName: 'Symbol',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600}>
          {params.row.stock_symbol}
        </Typography>
      ),
    },
    {
      field: 'recommendation_type',
      headerName: 'Action',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.row.recommendation_type}
          color={getRecommendationColor(params.row.recommendation_type)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'current_average_price',
      headerName: 'Current Avg Price',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const account = getSelectedAccount();
        return formatCurrency(params.row.current_average_price, account?.currency || 'INR');
      },
    },
    {
      field: 'current_quantity',
      headerName: 'Current Qty',
      width: 120,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'target_price',
      headerName: 'Target Price',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const account = getSelectedAccount();
        return (
          <Typography variant="body2" color="success.main" fontWeight={600}>
            {formatCurrency(params.row.target_price, account?.currency || 'INR')}
          </Typography>
        );
      },
    },
    {
      field: 'recommended_quantity',
      headerName: 'Recommended Qty',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={600}>
          {params.row.recommended_quantity}
        </Typography>
      ),
    },
    {
      field: 'price_52w_low',
      headerName: '52W Low',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const account = getSelectedAccount();
        return formatCurrency(params.row.price_52w_low, account?.currency || 'INR');
      },
    },
    {
      field: 'pe_ratio',
      headerName: 'P/E Ratio',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        params.row.pe_ratio ? params.row.pe_ratio.toFixed(2) : '-',
    },
    {
      field: 'pegy_index',
      headerName: 'PEGY',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        params.row.pegy_index ? params.row.pegy_index.toFixed(2) : '-',
    },
    {
      field: 'rsi_index',
      headerName: 'RSI',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        params.row.rsi_index ? params.row.rsi_index.toFixed(2) : '-',
    },
    {
      field: 'recommendation_date',
      headerName: 'Date',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(params.row.recommendation_date)}
        </Typography>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.row.is_active ? 'Active' : 'Inactive'}
          color={params.row.is_active ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
  ];

  if (loading && accounts.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading accounts...
        </Typography>
      </Container>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const buyRecommendations = filteredRecommendations.filter(r => r.recommendation_type === 'BUY').length;
  const sellRecommendations = filteredRecommendations.filter(r => r.recommendation_type === 'SELL').length;
  const holdRecommendations = filteredRecommendations.filter(r => r.recommendation_type === 'HOLD').length;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Holding Recommendations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          AI-powered buy/sell/hold recommendations based on technical analysis
        </Typography>
      </Box>

      {/* Account Selector - Prominent at Top */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Select Account
        </Typography>
        <FormControl fullWidth sx={{ maxWidth: 500 }}>
          <InputLabel id="account-select-label">Holding Account</InputLabel>
          <Select
            labelId="account-select-label"
            id="account-select"
            value={selectedAccountId}
            label="Holding Account"
            onChange={handleAccountChange}
            size="medium"
          >
            {accounts.length === 0 ? (
              <MenuItem disabled>No accounts available</MenuItem>
            ) : (
              accounts.map((account) => (
                <MenuItem key={account.account_id} value={account.account_id}>
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      {account.account_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {account.account_platform} • {account.currency}
                    </Typography>
                  </Box>
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
      </Paper>

      {selectedAccountId && recommendations && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{xs:12, sm:6, md:3}}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Total Recommendations
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight={700}>
                    {recommendations.recommendations_count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {recommendations.active_count} active
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{xs:12, sm:6, md:3}}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Buy Signals
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {buyRecommendations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{xs:12, sm:6, md:3}}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingDown sx={{ mr: 1, color: 'error.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Sell Signals
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {sellRecommendations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{xs:12, sm:6, md:3}}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Timeline sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Hold Signals
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="warning.main">
                    {holdRecommendations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={filterType}
              onChange={handleFilterChange}
              aria-label="recommendation type filter"
              size="small"
            >
              <ToggleButton value="BUY" aria-label="buy">
                <TrendingUp sx={{ mr: 1 }} fontSize="small" />
                Buy
              </ToggleButton>
              <ToggleButton value="SELL" aria-label="sell">
                <TrendingDown sx={{ mr: 1 }} fontSize="small" />
                Sell
              </ToggleButton>
              <ToggleButton value="HOLD" aria-label="hold">
                <ShowChart sx={{ mr: 1 }} fontSize="small" />
                Hold
              </ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              value={includeInactive ? ['inactive'] : []}
              onChange={() => setIncludeInactive(!includeInactive)}
              aria-label="include inactive"
              size="small"
            >
              <ToggleButton value="inactive" aria-label="include inactive">
                Include Inactive
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Recommendations DataGrid */}
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: 'primary.main', color: 'white' }}>
              <Typography variant="h6" fontWeight={600}>
                Recommendations ({filteredRecommendations.length})
              </Typography>
            </Box>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredRecommendations}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 25 },
                  },
                  sorting: {
                    sortModel: [{ field: 'recommendation_date', sort: 'desc' }],
                  },
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                disableRowSelectionOnClick
                loading={loading}
              />
            </Box>
          </Paper>
        </>
      )}

      {/* Empty State */}
      {selectedAccountId && recommendations && recommendations.recommendations_count === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Recommendations Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            There are currently no recommendations for this account.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default HoldingRecommendations;