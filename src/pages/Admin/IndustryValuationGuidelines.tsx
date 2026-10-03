import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Edit } from '@mui/icons-material';
import { industryValuationGuidelinesAPI } from '../../api/client';
import { IndustryValuationGuideline, IndustryValuationGuidelineUpdate } from '../../types';

// Numbers are kept as strings while editing so fields can be cleared
interface FormState {
  pe_weight: string;
  benchmark_pe: string;
  benchmark_pb: string;
  use_justified_pb: boolean;
  notes: string;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const IndustryValuationGuidelines: React.FC = () => {
  const [guidelines, setGuidelines] = useState<IndustryValuationGuideline[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selected, setSelected] = useState<IndustryValuationGuideline | null>(null);
  const [formData, setFormData] = useState<FormState | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>('All');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await industryValuationGuidelinesAPI.getAll();
      setGuidelines(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sector → industry count, for the filter buttons
  const sectorCounts = useMemo(() => {
    const counts = new Map<string, number>();
    guidelines.forEach((g) => counts.set(g.sector, (counts.get(g.sector) ?? 0) + 1));
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [guidelines]);

  const filteredGuidelines = useMemo(
    () => (sectorFilter === 'All' ? guidelines : guidelines.filter((g) => g.sector === sectorFilter)),
    [guidelines, sectorFilter]
  );

  const handleOpenEditDialog = (guideline: IndustryValuationGuideline): void => {
    setSelected(guideline);
    setFormData({
      pe_weight: String(guideline.pe_weight),
      benchmark_pe: String(guideline.benchmark_pe),
      benchmark_pb: String(guideline.benchmark_pb),
      use_justified_pb: guideline.use_justified_pb,
      notes: guideline.notes ?? '',
    });
  };

  const handleCloseDialog = (): void => {
    setSelected(null);
    setFormData(null);
  };

  const peWeight = parseFloat(formData?.pe_weight ?? '');
  const peWeightValid = !isNaN(peWeight) && peWeight >= 0 && peWeight <= 1;

  const handleSubmit = async (): Promise<void> => {
    if (!selected || !formData) return;

    const payload: IndustryValuationGuidelineUpdate = {
      pe_weight: peWeight,
      benchmark_pe: parseFloat(formData.benchmark_pe),
      benchmark_pb: parseFloat(formData.benchmark_pb),
      use_justified_pb: formData.use_justified_pb,
      notes: formData.notes.trim() || null,
    };

    if (!peWeightValid) {
      alert('P/E weight must be between 0 and 1');
      return;
    }
    if (!(payload.benchmark_pe! > 0) || !(payload.benchmark_pb! > 0)) {
      alert('Benchmark P/E and P/B must be positive numbers');
      return;
    }

    try {
      await industryValuationGuidelinesAPI.update(selected.id, payload);
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Failed to save:', error);
      alert(error.response?.data?.detail || 'Failed to save');
    }
  };

  const columns: GridColDef[] = [
    { field: 'sector', headerName: 'Sector', width: 200 },
    { field: 'industry_name', headerName: 'Industry', flex: 1, minWidth: 220 },
    {
      field: 'pe_weight',
      headerName: 'P/E Weight',
      width: 100,
      valueFormatter: (value: number) => percent(value),
    },
    {
      field: 'pb_weight',
      headerName: 'P/B Weight',
      width: 100,
      valueGetter: (_value: unknown, row: IndustryValuationGuideline) => 1 - row.pe_weight,
      valueFormatter: (value: number) => percent(value),
    },
    { field: 'benchmark_pe', headerName: 'Benchmark P/E', width: 120 },
    { field: 'benchmark_pb', headerName: 'Benchmark P/B', width: 120 },
    {
      field: 'use_justified_pb',
      headerName: 'ROE-justified P/B',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (params.value ? 'Yes' : 'No'),
    },
    { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 220 },
    {
      field: 'updated_at',
      headerName: 'Updated',
      width: 110,
      renderCell: (params: GridRenderCellParams) =>
        !params.value ? '' : new Date(params.value as string).toLocaleDateString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="Edit">
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenEditDialog(params.row as IndustryValuationGuideline)}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        Valuation Guidelines
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Stock Value = P/E weight × (P/E ÷ fair P/E) + P/B weight × (P/B ÷ fair P/B). Benchmarks are used as the
        sector anchor only when a sector has fewer than 5 peers; otherwise the peer median is used. Every non-ETF
        industry has a guideline — new industries start with broad-market defaults. Changes take effect on the next
        daily market snapshot run.
      </Alert>

      {/* Sector Button Filter */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {[['All', guidelines.length] as [string, number], ...sectorCounts].map(([sec, count]) => (
          <Button
            key={sec}
            variant={sectorFilter === sec ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setSectorFilter(sec)}
            sx={{
              fontSize: '0.72rem',
              py: 0.4,
              px: 1.5,
              textTransform: 'none',
              fontWeight: sectorFilter === sec ? 700 : 500,
              ...(sectorFilter === sec
                ? { bgcolor: '#1976d2', color: 'white', '&:hover': { bgcolor: '#1565c0' } }
                : { borderColor: '#ddd', color: 'text.secondary', '&:hover': { borderColor: '#bbb', bgcolor: '#f5f5f5' } }),
            }}
          >
            {sec} ({count})
          </Button>
        ))}
      </Box>

      <Paper>
        <Box sx={{ p: 3 }}>
          <DataGrid
            rows={filteredGuidelines}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 50 },
              },
            }}
            pageSizeOptions={[25, 50, 100]}
          />
        </Box>
      </Paper>

      <Dialog open={!!selected} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Guideline — {selected?.sector} / {selected?.industry_name}
        </DialogTitle>
        {formData && (
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                label="P/E Weight (0–1)"
                type="number"
                value={formData.pe_weight}
                onChange={(e) => setFormData({ ...formData, pe_weight: e.target.value })}
                inputProps={{ min: 0, max: 1, step: 0.05 }}
                error={!peWeightValid}
                helperText={peWeightValid ? `P/B weight: ${percent(1 - peWeight)}` : 'Between 0 and 1'}
                fullWidth
                required
                sx={{ mb: 2 }}
              />
              <Box display="flex" gap={2} mb={2}>
                <TextField
                  label="Benchmark P/E"
                  type="number"
                  value={formData.benchmark_pe}
                  onChange={(e) => setFormData({ ...formData, benchmark_pe: e.target.value })}
                  inputProps={{ min: 0, step: 0.5 }}
                  fullWidth
                  required
                />
                <TextField
                  label="Benchmark P/B"
                  type="number"
                  value={formData.benchmark_pb}
                  onChange={(e) => setFormData({ ...formData, benchmark_pb: e.target.value })}
                  inputProps={{ min: 0, step: 0.1 }}
                  fullWidth
                  required
                />
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.use_justified_pb}
                    onChange={(e) => setFormData({ ...formData, use_justified_pb: e.target.checked })}
                  />
                }
                label="Use ROE-justified P/B anchor (lenders)"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                fullWidth
                multiline
                rows={2}
                inputProps={{ maxLength: 500 }}
              />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default IndustryValuationGuidelines;
