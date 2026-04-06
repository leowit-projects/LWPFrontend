import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Chip,
  Alert,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  AccountBalance,
  Refresh,
  Upload,
  QueryStats,         // ← beta analysis icon
} from '@mui/icons-material';
import { holdingAccountsAPI } from '../../api/client';
import { 
  HoldingAccount, 
  HoldingAccountCreate, 
  AccountPlatform, 
  CurrencyCode 
} from '../../types';

const HoldingAccounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<HoldingAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [formData, setFormData] = useState<HoldingAccountCreate>({
    account_id: '',
    account_platform: AccountPlatform.ZERODHA,
    currency: CurrencyCode.INR,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await holdingAccountsAPI.getAll(true);
      setAccounts(response.data);
    } catch (error: any) {
      console.error('Failed to load holding accounts:', error);
      setError(error.response?.data?.detail || 'Failed to load holding accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account?: HoldingAccount): void => {
    if (account) {
      setEditMode(true);
      setSelectedAccountId(account.account_id);
      setFormData({
        account_id: account.account_id,
        account_platform: account.account_platform,
        currency: account.currency,
      });
    } else {
      setEditMode(false);
      setSelectedAccountId(null);
      setFormData({
        account_id: '',
        account_platform: AccountPlatform.ZERODHA,
        currency: CurrencyCode.INR,
      });
    }
    setError('');
    setSuccess('');
    setOpenDialog(true);
  };

  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!formData.account_id.trim()) {
      setError('Account ID is required');
      return;
    }

    const inrPlatforms = [AccountPlatform.ZERODHA, AccountPlatform.AIONION, AccountPlatform.CHOLA_SECURITIES];
    const usdPlatforms = [AccountPlatform.FIDELITY];

    if (inrPlatforms.includes(formData.account_platform) && formData.currency !== CurrencyCode.INR) {
      setError(`${formData.account_platform} only supports INR currency`);
      return;
    }

    if (usdPlatforms.includes(formData.account_platform) && formData.currency !== CurrencyCode.USD) {
      setError(`${formData.account_platform} only supports USD currency`);
      return;
    }

    try {
      if (editMode && selectedAccountId) {
        await holdingAccountsAPI.update(selectedAccountId, {
          account_platform: formData.account_platform,
          currency: formData.currency,
        });
        setSuccess('Holding account updated successfully');
      } else {
        await holdingAccountsAPI.create(formData);
        setSuccess('Holding account created successfully');
      }
      handleCloseDialog();
      await loadData();
    } catch (error: any) {
      console.error('Failed to save holding account:', error);
      setError(error.response?.data?.detail || 'Failed to save holding account');
    }
  };

  const handleDeactivate = async (accountId: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to deactivate account ${accountId}?`)) {
      return;
    }
    try {
      await holdingAccountsAPI.delete(accountId);
      setSuccess(`Account ${accountId} deactivated successfully`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to deactivate holding account:', error);
      setError(error.response?.data?.detail || 'Failed to deactivate holding account');
    }
  };

  const handleReactivate = async (accountId: string): Promise<void> => {
    if (!window.confirm(`Are you sure you want to reactivate account ${accountId}?`)) {
      return;
    }
    try {
      await holdingAccountsAPI.reactivate(accountId);
      setSuccess(`Account ${accountId} reactivated successfully`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to reactivate holding account:', error);
      setError(error.response?.data?.detail || 'Failed to reactivate holding account');
    }
  };

  const handleUploadHoldings = (accountId: string): void => {
    navigate(`/upload-holdings/${accountId}`);
  };

  // ── Holding Analysis ──────────────────────────────────────────────────────────
  // Opens the holding analysis page in a new browser tab.
  // Only shown for active INR accounts (holding analysis is India-only).
  const handleHoldingAnalysis = (accountId: string): void => {
    window.open(`/holding-analysis/${accountId}`, '_blank', 'noopener,noreferrer');
  };

  const getPlatformColor = (platform: AccountPlatform): 'primary' | 'secondary' | 'success' | 'info' => {
    switch (platform) {
      case AccountPlatform.ZERODHA:       return 'primary';
      case AccountPlatform.FIDELITY:      return 'success';
      case AccountPlatform.AIONION:       return 'secondary';
      case AccountPlatform.CHOLA_SECURITIES: return 'info';
      default:                            return 'primary';
    }
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'account_id',
      headerName: 'Account ID',
      flex: 1.2,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box
          onClick={() => navigate(`/list-holdings/${params.value}`)}
          sx={{
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline', color: 'primary.main' },
          }}
        >
          <Typography variant="body2" fontWeight={600} color="primary">
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'account_platform',
      headerName: 'Platform',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          color={getPlatformColor(params.value as AccountPlatform)}
          size="small"
        />
      ),
    },
    {
      field: 'currency',
      headerName: 'Currency',
      flex: 0.6,
      minWidth: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} variant="outlined" size="small" />
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      flex: 0.8,
      minWidth: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created',
      flex: 1,
      minWidth: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 180,
      getActions: (params) => {
        const account = params.row as HoldingAccount;
        const isINR   = account.currency === CurrencyCode.INR;

        const actions = [
          // ── Holding Analysis icon — INR active accounts only ──────────────────
          ...(isINR && account.is_active ? [
            <GridActionsCellItem
              key="holding"
              icon={
                <Tooltip title="Holding Analysis (India)">
                  <QueryStats fontSize="small" color="secondary" />
                </Tooltip>
              }
              label="Holding Analysis"
              onClick={() => handleHoldingAnalysis(account.account_id)}
              showInMenu={false}
            />,
          ] : []),

          // ── Upload Holdings ────────────────────────────────────────────────
          <GridActionsCellItem
            key="upload"
            icon={
              <Tooltip title="Upload Holdings">
                <Upload fontSize="small" />
              </Tooltip>
            }
            label="Upload Holdings"
            onClick={() => handleUploadHoldings(account.account_id)}
            showInMenu={false}
            disabled={!account.is_active}
          />,

          // ── Edit ──────────────────────────────────────────────────────────
          <GridActionsCellItem
            key="edit"
            icon={
              <Tooltip title="Edit">
                <Edit fontSize="small" />
              </Tooltip>
            }
            label="Edit"
            onClick={() => handleOpenDialog(account)}
            showInMenu={false}
          />,
        ];

        // ── Deactivate / Reactivate ──────────────────────────────────────────
        if (account.is_active) {
          actions.push(
            <GridActionsCellItem
              key="deactivate"
              icon={
                <Tooltip title="Deactivate">
                  <Delete fontSize="small" />
                </Tooltip>
              }
              label="Deactivate"
              onClick={() => handleDeactivate(account.account_id)}
              showInMenu={false}
            />
          );
        } else {
          actions.push(
            <GridActionsCellItem
              key="reactivate"
              icon={
                <Tooltip title="Reactivate">
                  <Refresh fontSize="small" />
                </Tooltip>
              }
              label="Reactivate"
              onClick={() => handleReactivate(account.account_id)}
              showInMenu={false}
            />
          );
        }

        return actions;
      },
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Holding Accounts
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <AccountBalance color="primary" />
              <Typography variant="body2" color="text.secondary">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            <Box display="flex" gap={1}>
              <Tooltip title="Refresh">
                <IconButton onClick={loadData} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
              >
                Add Account
              </Button>
            </Box>
          </Box>

          <DataGrid
            rows={accounts}
            columns={columns}
            getRowId={(row) => row.account_id}
            loading={loading}
            autoHeight
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25, page: 0 },
              },
            }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
            }}
          />
        </Box>
      </Paper>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Holding Account' : 'Add New Holding Account'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <TextField
              label="Account ID"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              fullWidth
              required
              disabled={editMode}
              sx={{ mb: 2 }}
              helperText={editMode ? 'Account ID cannot be changed' : 'Enter unique account identifier'}
            />

            <TextField
              select
              label="Platform"
              value={formData.account_platform}
              onChange={(e) => setFormData({ ...formData, account_platform: e.target.value as AccountPlatform })}
              fullWidth
              required
              sx={{ mb: 2 }}
            >
              <MenuItem value={AccountPlatform.ZERODHA}>ZERODHA (INR)</MenuItem>
              <MenuItem value={AccountPlatform.AIONION}>AIONION (INR)</MenuItem>
              <MenuItem value={AccountPlatform.CHOLA_SECURITIES}>CHOLA SECURITIES (INR)</MenuItem>
              <MenuItem value={AccountPlatform.FIDELITY}>FIDELITY (USD)</MenuItem>
            </TextField>

            <TextField
              select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
              fullWidth
              required
              sx={{ mb: 2 }}
            >
              <MenuItem value={CurrencyCode.INR}>INR</MenuItem>
              <MenuItem value={CurrencyCode.USD}>USD</MenuItem>
            </TextField>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Platform Currency Requirements:</strong>
                <br />• ZERODHA, AIONION, CHOLA SECURITIES: INR only
                <br />• FIDELITY: USD only
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HoldingAccounts;