import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack,
  TrendingUp,
  TrendingDown,
  ShowChart,
  AccountBalance,
  PieChart,
  AttachMoney,
  TrendingFlat,
  MonetizationOn,
  Assessment,
  Delete,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { holdingAccountsAPI } from '../../api/client';
import {
  HoldingAccountsResponse,
  BondHoldingDetail,
  MutualFundHoldingDetail,
} from '../../types';

const ListHoldings: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [holdings, setHoldings] = useState<HoldingAccountsResponse | null>(null);
  
  // Filter state for asset types
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>([
    'stocks',
    'etfs',
    'mutual_funds',
    'bonds',
  ]);

  useEffect(() => {
    if (accountId) {
      loadHoldings();
    }
  }, [accountId]);

  const loadHoldings = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getHoldings(accountId!);
      setHoldings(response.data);
    } catch (error: any) {
      console.error('Failed to load holdings:', error);
      setError(error.response?.data?.detail || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHolding = async (holdingId: number, assetName: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete ${assetName}?`)) {
      return;
    }

    try {
      await holdingAccountsAPI.deleteHolding(accountId!, holdingId);
      setSuccess(`${assetName} deleted successfully`);
      // Reload holdings to reflect changes
      await loadHoldings();
    } catch (error: any) {
      console.error('Failed to delete holding:', error);
      setError(error.response?.data?.detail || 'Failed to delete holding');
    }
  };

  const handleAssetTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTypes: string[]
  ) => {
    // Ensure at least one type is selected
    if (newTypes.length > 0) {
      setSelectedAssetTypes(newTypes);
    }
  };

  const calculateFilteredSummary = () => {
    if (!holdings) return null;

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalCount = 0;

    if (selectedAssetTypes.includes('stocks')) {
      holdings.holdings.stocks.forEach((stock) => {
        totalInvested += stock.invested_value;
        totalCurrentValue += stock.current_value;
      });
      totalCount += holdings.holdings.stocks.length;
    }

    if (selectedAssetTypes.includes('etfs')) {
      holdings.holdings.etfs.forEach((etf) => {
        totalInvested += etf.invested_value;
        totalCurrentValue += etf.current_value;
      });
      totalCount += holdings.holdings.etfs.length;
    }

    if (selectedAssetTypes.includes('mutual_funds')) {
      holdings.holdings.mutual_funds.forEach((mf) => {
        totalInvested += mf.invested_value;
        totalCurrentValue += mf.current_value;
      });
      totalCount += holdings.holdings.mutual_funds.length;
    }

    if (selectedAssetTypes.includes('bonds')) {
      holdings.holdings.bonds.forEach((bond) => {
        totalInvested += bond.invested_value;
        totalCurrentValue += bond.current_value;
      });
      totalCount += holdings.holdings.bonds.length;
    }

    const totalProfitLoss = totalCurrentValue - totalInvested;
    const totalProfitLossPercentage =
      totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalProfitLoss,
      totalProfitLossPercentage,
      totalCount,
    };
  };

  const formatCurrency = (value: number, currency: string): string => {
    if (currency === 'INR') {
      // Indian numbering system (lakhs and crores)
      const isNegative = value < 0;
      const absValue = Math.abs(value);
      
      // Format with 2 decimal places
      const formatted = absValue.toFixed(2);
      const [integerPart, decimalPart] = formatted.split('.');
      
      // Apply Indian comma format (last 3 digits, then groups of 2)
      let lastThree = integerPart.substring(integerPart.length - 3);
      const otherNumbers = integerPart.substring(0, integerPart.length - 3);
      
      if (otherNumbers !== '') {
        lastThree = ',' + lastThree;
      }
      
      const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
      
      return `${isNegative ? '-' : ''}₹${formattedInteger}.${decimalPart}`;
    } else {
      // Standard formatting for other currencies (USD, etc.)
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getProfitLossColor = (value: number): 'success' | 'error' | 'default' => {
    if (value > 0) return 'success';
    if (value < 0) return 'error';
    return 'default';
  };

  const formatDaysAgo = (dateString: string): string => {
    const updatedDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return '1 day ago';
    } else {
      return `${diffDays} days ago`;
    }
  };

  const getDaysAgoColor = (dateString: string): string => {
    const updatedDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 2 ? 'error.main' : 'text.secondary';
  };

  // Stocks DataGrid Columns
  const stockColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {params.row.symbol} 
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: getDaysAgoColor(params.row.updated_at) }}
          >
            {formatDaysAgo(params.row.updated_at)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2">{params.row.quantity}</Typography>

        </Box>
      ),
    },
    {
      field: 'average_price',
      headerName: 'Avg Price',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.average_price, params.row.currency),
    },
    {
      field: 'last_close_price',
      headerName: 'Last Close',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        params.row.last_close_price
          ? formatCurrency(params.row.last_close_price, params.row.currency)
          : '-',
    },
    {
      field: 'invested_value',
      headerName: 'Invested',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.invested_value, params.row.currency),
    },
    {
      field: 'current_value',
      headerName: 'Current Value',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.current_value, params.row.currency),
    },
    {
      field: 'profit_loss',
      headerName: 'P&L',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          color={params.row.profit_loss >= 0 ? 'success.main' : 'error.main'}
          fontWeight={600}
        >
          {formatCurrency(params.row.profit_loss, params.row.currency)}
        </Typography>
      ),
    },
    {
      field: 'profit_loss_percentage',
      headerName: 'P&L %',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={formatPercentage(params.row.profit_loss_percentage)}
          color={getProfitLossColor(params.row.profit_loss)}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeleteHolding(params.row.id, params.row.symbol)}
          title="Delete holding"
        >
          <Delete fontSize="small" />
        </IconButton>
      ),
    },
  ];

  // ETFs DataGrid Columns (similar to stocks)
  const etfColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {params.row.symbol}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: getDaysAgoColor(params.row.updated_at) }}
          >
            {formatDaysAgo(params.row.updated_at)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2">{params.row.quantity}</Typography>
          
        </Box>
      ),
    },
    {
      field: 'average_price',
      headerName: 'Avg Price',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.average_price, params.row.currency),
    },
    {
      field: 'last_close_price',
      headerName: 'Last Close',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        params.row.last_close_price
          ? formatCurrency(params.row.last_close_price, params.row.currency)
          : '-',
    },
    {
      field: 'invested_value',
      headerName: 'Invested',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.invested_value, params.row.currency),
    },
    {
      field: 'current_value',
      headerName: 'Current Value',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) =>
        formatCurrency(params.row.current_value, params.row.currency),
    },
    {
      field: 'profit_loss',
      headerName: 'P&L',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          color={params.row.profit_loss >= 0 ? 'success.main' : 'error.main'}
          fontWeight={600}
        >
          {formatCurrency(params.row.profit_loss, params.row.currency)}
        </Typography>
      ),
    },
    {
      field: 'profit_loss_percentage',
      headerName: 'P&L %',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={formatPercentage(params.row.profit_loss_percentage)}
          color={getProfitLossColor(params.row.profit_loss)}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeleteHolding(params.row.id, params.row.symbol)}
          title="Delete holding"
        >
          <Delete fontSize="small" />
        </IconButton>
      ),
    },
  ];

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading holdings...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error" onClose={() => navigate('/holding-accounts')}>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!holdings) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="info">No holdings data available</Alert>
      </Container>
    );
  }

  const filteredSummary = calculateFilteredSummary();

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/holding-accounts')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700}>
            Holdings - {holdings.account_id}
          </Typography>
          <Box display="flex" gap={1} alignItems="center" mt={0.5}>
            <Chip label={holdings.account_platform} color="primary" size="small" />
            <Chip label={holdings.currency} variant="outlined" size="small" />
          </Box>
        </Box>
      </Box>

      {/* Success Alert */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Asset Type Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Typography variant="subtitle2" fontWeight={600}>
            Include in Total:
          </Typography>
          <ToggleButtonGroup
            color="primary"
            value={selectedAssetTypes}
            onChange={handleAssetTypeChange}
            aria-label="asset type filter"
            size="small"
          >
            <ToggleButton value="stocks" aria-label="stocks">
              <TrendingFlat sx={{ mr: 0.5 }} fontSize="small" />
              Stocks ({holdings.holdings.stocks.length})
            </ToggleButton>
            <ToggleButton value="etfs" aria-label="etfs">
              <ShowChart sx={{ mr: 0.5 }} fontSize="small" />
              ETFs ({holdings.holdings.etfs.length})
            </ToggleButton>
            <ToggleButton value="mutual_funds" aria-label="mutual funds">
              <PieChart sx={{ mr: 0.5 }} fontSize="small" />
              Mutual Funds ({holdings.holdings.mutual_funds.length})
            </ToggleButton>
            <ToggleButton value="bonds" aria-label="bonds">
              <MonetizationOn sx={{ mr: 0.5 }} fontSize="small" />
              Bonds ({holdings.holdings.bonds.length})
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AttachMoney color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Invested
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600}>
                {formatCurrency(filteredSummary?.totalInvested || 0, holdings.currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <ShowChart color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Current Value
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600}>
                {formatCurrency(filteredSummary?.totalCurrentValue || 0, holdings.currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                {(filteredSummary?.totalProfitLoss || 0) >= 0 ? (
                  <TrendingUp color="success" sx={{ mr: 1 }} />
                ) : (
                  <TrendingDown color="error" sx={{ mr: 1 }} />
                )}
                <Typography variant="body2" color="text.secondary">
                  Total P&L
                </Typography>
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                color={(filteredSummary?.totalProfitLoss || 0) >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(filteredSummary?.totalProfitLoss || 0, holdings.currency)}
              </Typography>
              <Typography
                variant="body2"
                color={(filteredSummary?.totalProfitLoss || 0) >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPercentage(filteredSummary?.totalProfitLossPercentage || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Assessment color="info" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Selected Holdings
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600}>
                {filteredSummary?.totalCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                of {holdings.summary.total_holdings} total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stocks DataGrid */}
      {selectedAssetTypes.includes('stocks') && holdings.holdings.stocks.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, backgroundColor: 'primary.main', color: 'white' }}>
            <Typography variant="h6" fontWeight={600}>
              Stocks ({holdings.holdings.stocks.length})
            </Typography>
          </Box>
          <Box sx={{ height: 800, width: '100%' }}>
            <DataGrid
              rows={holdings.holdings.stocks}
              columns={stockColumns}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick
              rowHeight={70}
            />
          </Box>
        </Paper>
      )}

      {/* ETFs DataGrid */}
      {selectedAssetTypes.includes('etfs') && holdings.holdings.etfs.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, backgroundColor: 'success.main', color: 'white' }}>
            <Typography variant="h6" fontWeight={600}>
              ETFs ({holdings.holdings.etfs.length})
            </Typography>
          </Box>
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={holdings.holdings.etfs}
              columns={etfColumns}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick
              rowHeight={70}
            />
          </Box>
        </Paper>
      )}

      {/* Mutual Funds Section */}
      {selectedAssetTypes.includes('mutual_funds') && holdings.holdings.mutual_funds.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, backgroundColor: 'info.main', color: 'white' }}>
            <Typography variant="h6" fontWeight={600}>
              Mutual Funds ({holdings.holdings.mutual_funds.length})
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Fund House</TableCell>
                  <TableCell>ISIN</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Avg Price</TableCell>
                  <TableCell align="right">Invested</TableCell>
                  <TableCell align="right">Current Value</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.holdings.mutual_funds.map((mf: MutualFundHoldingDetail) => (
                  <TableRow key={mf.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {mf.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{mf.fund_house || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {mf.isin}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{mf.quantity}</Typography>
                      <Typography 
                        variant="caption" 
                        color={getDaysAgoColor(mf.updated_at)}
                        display="block"
                      >
                        {formatDaysAgo(mf.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(mf.average_price, mf.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(mf.invested_value, mf.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(mf.current_value, mf.currency)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(mf.updated_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteHolding(mf.id, mf.name)}
                        title="Delete holding"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Bonds Section */}
      {selectedAssetTypes.includes('bonds') && holdings.holdings.bonds.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, backgroundColor: 'warning.main', color: 'white' }}>
            <Typography variant="h6" fontWeight={600}>
              Bonds ({holdings.holdings.bonds.length})
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>ISIN</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Avg Price</TableCell>
                  <TableCell align="right">Face Value</TableCell>
                  <TableCell align="right">Coupon Rate</TableCell>
                  <TableCell align="right">Maturity</TableCell>
                  <TableCell align="right">Invested</TableCell>
                  <TableCell align="right">Current Value</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.holdings.bonds.map((bond: BondHoldingDetail) => (
                  <TableRow key={bond.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {bond.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {bond.isin}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{bond.quantity}</Typography>
                      <Typography 
                        variant="caption" 
                        color={getDaysAgoColor(bond.updated_at)}
                        display="block"
                      >
                        {formatDaysAgo(bond.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(bond.average_price, bond.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {bond.face_value ? formatCurrency(bond.face_value, bond.currency) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {bond.coupon_rate ? `${bond.coupon_rate}%` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {bond.maturity_date
                        ? new Date(bond.maturity_date).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(bond.invested_value, bond.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(bond.current_value, bond.currency)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(bond.updated_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteHolding(bond.id, bond.name)}
                        title="Delete holding"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Empty State */}
      {holdings.summary.total_holdings === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AccountBalance sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Holdings Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a CSV file to add holdings to this account.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default ListHoldings;