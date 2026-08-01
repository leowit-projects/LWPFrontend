import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Add, Delete, ArrowBack } from '@mui/icons-material';
import { watchlistAPI } from '../../api/client';
import { AssetType, WatchlistGroup, WatchlistFull, WatchlistItem } from '../../types';
import { SymbolOption, useSymbolOptions, getErrorMessage } from './watchlistShared';

const CreateWatchlistGroup: React.FC = () => {
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState('');
  const [group, setGroup] = useState<WatchlistGroup | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const [watchlists, setWatchlists] = useState<WatchlistFull[]>([]);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const symbolOptions = useSymbolOptions();
  const [selectedSymbolsByWatchlist, setSelectedSymbolsByWatchlist] = useState<Record<number, SymbolOption[]>>({});
  const [addingItemsFor, setAddingItemsFor] = useState<number | null>(null);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      setCreatingGroup(true);
      setGroupError(null);
      const response = await watchlistAPI.createGroup({ name: groupName.trim() });
      setGroup(response.data);
    } catch (err) {
      setGroupError(getErrorMessage(err, 'Failed to create watchlist group'));
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddWatchlist = async () => {
    if (!group || !newWatchlistName.trim()) return;
    try {
      setCreatingWatchlist(true);
      setWatchlistError(null);
      const response = await watchlistAPI.createWatchlist(group.id, { name: newWatchlistName.trim() });
      setWatchlists((prev) => [...prev, { ...response.data, items: [] }]);
      setNewWatchlistName('');
    } catch (err) {
      setWatchlistError(getErrorMessage(err, 'Failed to create watchlist'));
    } finally {
      setCreatingWatchlist(false);
    }
  };

  const handleDeleteWatchlist = async (watchlistId: number) => {
    try {
      await watchlistAPI.deleteWatchlist(watchlistId);
      setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId));
    } catch (err) {
      console.error('Failed to delete watchlist:', err);
    }
  };

  const handleAddItems = async (watchlistId: number) => {
    const selected = selectedSymbolsByWatchlist[watchlistId] || [];
    if (selected.length === 0) return;
    try {
      setAddingItemsFor(watchlistId);
      const addedItems: WatchlistItem[] = [];
      for (const option of selected) {
        const response = await watchlistAPI.addItem(watchlistId, {
          asset_type: option.asset_type,
          stock_symbol_id: option.asset_type === AssetType.STOCK ? option.symbol : null,
          etf_symbol_id: option.asset_type === AssetType.ETF ? option.symbol : null,
        });
        addedItems.push(response.data);
      }
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === watchlistId
            ? { ...w, items: [...w.items, ...addedItems], item_count: w.item_count + addedItems.length }
            : w
        )
      );
      setSelectedSymbolsByWatchlist((prev) => ({ ...prev, [watchlistId]: [] }));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to add symbol(s)'));
    } finally {
      setAddingItemsFor(null);
    }
  };

  const handleRemoveItem = async (watchlistId: number, itemId: number) => {
    try {
      await watchlistAPI.removeItem(watchlistId, itemId);
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === watchlistId
            ? { ...w, items: w.items.filter((i) => i.id !== itemId), item_count: w.item_count - 1 }
            : w
        )
      );
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/watchlists')} size="small">
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          New Watchlist Group
        </Typography>
      </Box>

      {!group ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Group Name
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Zerodha::12345 or My Watchlist"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <Button variant="contained" onClick={handleCreateGroup} disabled={!groupName.trim() || creatingGroup}>
              {creatingGroup ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </Box>
          {groupError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {groupError}
            </Alert>
          )}
        </Paper>
      ) : (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Group "{group.name}" created. Now add watchlists and symbols below.
          </Alert>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Add a Watchlist
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="e.g. Technology, ETF"
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatchlist()}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddWatchlist}
                disabled={!newWatchlistName.trim() || creatingWatchlist}
              >
                Add
              </Button>
            </Box>
            {watchlistError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {watchlistError}
              </Alert>
            )}
          </Paper>

          {watchlists.map((watchlist) => (
            <Paper key={watchlist.id} sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {watchlist.name} ({watchlist.items.length})
                </Typography>
                <IconButton size="small" onClick={() => handleDeleteWatchlist(watchlist.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Autocomplete
                  multiple
                  size="small"
                  fullWidth
                  options={symbolOptions}
                  getOptionLabel={(option) => `${option.symbol}${option.name ? ' - ' + option.name : ''}`}
                  isOptionEqualToValue={(option, value) =>
                    option.symbol === value.symbol && option.asset_type === value.asset_type
                  }
                  value={selectedSymbolsByWatchlist[watchlist.id] || []}
                  onChange={(_, newValue) =>
                    setSelectedSymbolsByWatchlist((prev) => ({ ...prev, [watchlist.id]: newValue }))
                  }
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip label={option.symbol} size="small" {...getTagProps({ index })} key={option.symbol} />
                    ))
                  }
                  renderInput={(params) => <TextField {...params} placeholder="Search stock or ETF symbol" />}
                />
                <Button
                  variant="outlined"
                  onClick={() => handleAddItems(watchlist.id)}
                  disabled={!(selectedSymbolsByWatchlist[watchlist.id]?.length) || addingItemsFor === watchlist.id}
                >
                  {addingItemsFor === watchlist.id ? <CircularProgress size={20} /> : 'Add'}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {watchlist.items.map((item) => (
                  <Chip key={item.id} label={item.symbol} size="small" onDelete={() => handleRemoveItem(watchlist.id, item.id)} />
                ))}
              </Box>
            </Paper>
          ))}

          <Button variant="contained" color="secondary" onClick={() => navigate('/watchlists')}>
            Done
          </Button>
        </>
      )}
    </Container>
  );
};

export default CreateWatchlistGroup;
