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
  IconButton,
  Tooltip,
  Chip,
  Stack,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Add, Delete } from '@mui/icons-material';
import { tagsAPI } from '../../api/client';
import { Tag } from '../../types';

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [formData, setFormData] = useState<{ name: string }>({ name: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await tagsAPI.getAll();
      setTags(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (): void => {
    setFormData({ name: '' });
    setOpenDialog(true);
  };

  const handleCloseDialog = (): void => {
    setOpenDialog(false);
  };

  const handleSubmit = async (): Promise<void> => {
    const name = formData.name?.trim() || '';
    if (!name) {
      alert('Tag name is required');
      return;
    }

    try {
      await tagsAPI.create({ name });
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this tag?')) {
      return;
    }

    try {
      await tagsAPI.delete(id);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Tag', width: 220 },
    {
      field: 'stock_symbols',
      headerName: 'Stock Symbols',
      flex: 1,
      minWidth: 300,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const symbols = (params.value as string[]) || [];
        if (symbols.length === 0) {
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        }
        return (
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            flexWrap="wrap"
            sx={{ py: 0.5 }}
          >
            {symbols.map((sym) => (
              <Chip key={sym} label={sym} size="small" />
            ))}
          </Stack>
        );
      },
    },
    {
      field: 'created_at',
      headerName: 'Added On',
      width: 180,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(params.row.id)}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Tags
      </Typography>

      <Paper>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
              Add New Tag
            </Button>
          </Box>

          <DataGrid
            rows={tags}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            sx={{
              '& .MuiDataGrid-cell': {
                alignItems: 'flex-start',
                py: 1,
              },
            }}
          />
        </Box>
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tag</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Tag Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="e.g., Dividend, High Growth, Watchlist"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Tags;