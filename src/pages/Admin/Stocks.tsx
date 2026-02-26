import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Add, Edit, Delete, FilterAlt } from '@mui/icons-material';
import { stockAPI, industriesAPI } from '../../api/client';
import { StockSymbol, CurrencyCode, Industry } from '../../types';

const Stocks: React.FC = () => {
  const [stocks, setStocks] = useState<StockSymbol[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockSymbol[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [industryNames, setIndustryNames] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedStock, setSelectedStock] = useState<StockSymbol | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [formData, setFormData] = useState<any>({
    symbol: '',
    name: '',
    currency: CurrencyCode.INR,
    exchange: '',
    industry_id: undefined,
  });

  useEffect(() => {
    loadData();
    loadIndustries();
  }, []);

  useEffect(() => {
    filterStocks();
  }, [stocks, selectedIndustry]);

  useEffect(() => {
    // Extract unique industries from stocks
    const uniqueIndustries = Array.from(
      new Set(
        stocks
          .map((stock) => stock.sector_industry)
          .filter((industry): industry is string => !!industry)
      )
    ).sort();
    setIndustryNames(uniqueIndustries);
  }, [stocks]);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    try {
      // Use 'admin' purpose to get basic stock data for admin operations
      const response = await stockAPI.getAll('admin');
      setStocks(response.data);
      console.log('Stocks data:', response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIndustries = async (): Promise<void> => {
    try {
      const response = await industriesAPI.getAll();
      setIndustries(response.data);
    } catch (error) {
      console.error('Failed to load industries:', error);
    }
  };

  const filterStocks = (): void => {
    if (selectedIndustry === 'all') {
      setFilteredStocks(stocks);
    } else {
      const filtered = stocks.filter(stock => {
        const industryMatch = stock.sector_industry?.toLowerCase().includes(selectedIndustry.toLowerCase());
        return industryMatch;
      });
      setFilteredStocks(filtered);
    }
  };

  const handleIndustryFilterChange = (event: SelectChangeEvent<string>): void => {
    setSelectedIndustry(event.target.value);
  };

  const handleOpenDialog = (): void => {
    setEditMode(false);
    setSelectedStock(null);
    setFormData({
      symbol: '',
      name: '',
      currency: CurrencyCode.INR,
      exchange: '',
      industry_id: undefined,
    });
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (stock: StockSymbol): void => {
    setEditMode(true);
    setSelectedStock(stock);
    
    // Find industry_id from sector_industry string
    let industryId: number | undefined = undefined;
    if (stock.sector_industry) {
      const matchingIndustry = industries.find(
        ind => `${ind.sector} - ${ind.industry}` === stock.sector_industry
      );
      industryId = matchingIndustry?.id;
    }
    
    setFormData({
      symbol: stock.symbol,
      name: stock.name || '',
      currency: stock.currency,
      exchange: stock.exchange || '',
      industry_id: industryId,
      is_purchase_eligible: stock.is_purchase_eligible ?? true,
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setEditMode(false);
    setSelectedStock(null);
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      // Trim all string values to remove leading/trailing spaces
      const trimmedData = {
        ...formData,
        symbol: formData.symbol?.trim().toUpperCase() || '',
        name: formData.name?.trim() || '',
        exchange: formData.exchange?.trim() || '',
      };

      if (editMode && selectedStock) {
        await stockAPI.update(selectedStock.symbol, trimmedData);
        // Sync purchase eligibility separately since it uses its own endpoint
        if (formData.is_purchase_eligible !== selectedStock.is_purchase_eligible) {
          await stockAPI.updatePurchaseEligibility(selectedStock.symbol, formData.is_purchase_eligible);
        }
      } else {
        await stockAPI.create(trimmedData);
        // Sync purchase eligibility separately since it uses its own endpoint
        if (formData.is_purchase_eligible !== undefined) {
          await stockAPI.updatePurchaseEligibility(trimmedData.symbol, formData.is_purchase_eligible);
        }
      }
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (symbol: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to deactivate stock ${symbol}?`)) {
      return;
    }

    try {
      await stockAPI.delete(symbol);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleTogglePurchaseEligibility = async (symbol: string, currentValue: boolean): Promise<void> => {
    try {
      await stockAPI.updatePurchaseEligibility(symbol, !currentValue);
      loadData();
    } catch (error: any) {
      console.error('Failed to update purchase eligibility:', error);
      alert(error.response?.data?.detail || 'Failed to update purchase eligibility');
    }
  };

  
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


  // Updated columns definition
  const columns: GridColDef[] = [
    { 
      field: 'symbol', 
      headerName: 'Symbol', 
      width: 120, 
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ textDecoration: params.row.is_purchase_eligible ? 'none' : 'line-through', color: params.row.is_purchase_eligible ? 'inherit' : 'text.disabled' }}>
            {params.value}
          </span>
        </Box>
      ), 
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      width: 200
    },
    {
      field: 'is_purchase_eligible',
      headerName: 'Purchasable',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.value ? 'Click to mark not purchasable' : 'Click to mark purchasable'}>
          <Chip
            label={params.value ? 'Yes' : 'No'}
            color={params.value ? 'success' : 'error'}
            size="small"
            onClick={() => handleTogglePurchaseEligibility(params.row.symbol, params.value)}
            sx={{ cursor: 'pointer' }}
          />
        </Tooltip>
      ),
    },
    { field: 'sector_industry', headerName: 'Industry', width: 300 },
    { field: 'currency', headerName: 'Currency', width: 100 },
    { field: 'exchange', headerName: 'Exchange', width: 120 },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'price_last_updated',
      headerName: 'Last Price Update',
      width: 180,
      renderCell: (params) => getDaysAgo(params.value)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenEditDialog(params.row as StockSymbol)}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Deactivate">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(params.row.symbol)}
              disabled={!params.row.is_active}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const getRowId = (row: StockSymbol) => row.symbol;

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Stocks Management
      </Typography>

      <Paper>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" gap={2} alignItems="center">
              <FormControl sx={{ minWidth: 300 }}>
                <InputLabel>Filter by Industry</InputLabel>
                <Select
                  value={selectedIndustry}
                  label="Filter by Industry"
                  onChange={handleIndustryFilterChange}
                  startAdornment={<FilterAlt sx={{ mr: 1, color: 'action.active' }} />}
                >
                  <MenuItem value="all">All Industries</MenuItem>
                  {industryNames.map((industry) => (
                    <MenuItem key={industry} value={industry}>
                      {industry}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Chip 
                label={`${filteredStocks.length} of ${stocks.length} stocks`}
                color="primary"
                variant="outlined"
              />
            </Box>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
              Add New Stock
            </Button>
          </Box>

          <DataGrid
            rows={filteredStocks}
            columns={columns}
            getRowId={getRowId}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </Box>
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit Stock' : 'Add New Stock'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Symbol"
              value={formData.symbol || ''}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              fullWidth
              required
              disabled={editMode}
              sx={{ mb: 2 }}
              helperText={editMode ? "Symbol cannot be changed" : "Enter stock ticker symbol"}
            />
            <TextField
              label="Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              select
              label="Currency"
              value={formData.currency || CurrencyCode.INR}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              fullWidth
              required
              sx={{ mb: 2 }}
            >
              <MenuItem value={CurrencyCode.INR}>INR</MenuItem>
              <MenuItem value={CurrencyCode.USD}>USD</MenuItem>
            </TextField>
            <TextField
              label="Exchange"
              value={formData.exchange || ''}
              onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
              fullWidth
              required
              sx={{ mb: 2 }}
              helperText="e.g., NSE, BSE, NASDAQ, NYSE"
            />
            <TextField
              select
              label="Industry"
              value={formData.industry_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  industry_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              fullWidth
              required
              sx={{ mb: 2 }}
            >
              <MenuItem value="">None</MenuItem>
              {industries.map((industry) => (
                <MenuItem key={industry.id} value={industry.id}>
                  {industry.sector} - {industry.industry}
                </MenuItem>
              ))}
            </TextField>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Purchase Eligible</InputLabel>
              <Select
                value={formData.is_purchase_eligible === false ? 'false' : 'true'}
                label="Purchase Eligible"
                onChange={(e) => setFormData({ ...formData, is_purchase_eligible: e.target.value === 'true' })}
              >
                <MenuItem value="true">Yes — Hold in portfolio</MenuItem>
                <MenuItem value="false">No — Exclude from portfolio</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Stocks;