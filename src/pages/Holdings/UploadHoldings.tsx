import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Chip,
} from '@mui/material';
import {
  CloudUpload,
  ArrowBack,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Delete,
} from '@mui/icons-material';
import { holdingAccountsAPI } from '../../api/client';
import { HoldingAccount } from '../../types';

interface UploadResult {
  success: boolean;
  message: string;
  recordsProcessed?: number;
  errors?: string[];
}

const UploadHoldings: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  
  const [account, setAccount] = useState<HoldingAccount | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  useEffect(() => {
    if (accountId) {
      loadAccountDetails();
    }
  }, [accountId]);

  const loadAccountDetails = async (): Promise<void> => {
    if (!accountId) {
      setError('Account ID is required');
      return;
    }

    try {
      const response = await holdingAccountsAPI.getById(accountId);
      setAccount(response.data);
    } catch (error: any) {
      console.error('Failed to load account details:', error);
      setError(error.response?.data?.detail || 'Failed to load account details');
    }
  };

  const handleDrag = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File): void => {
    const name = file.name.toLowerCase();
    const okCsv = name.endsWith('.csv');
    const okXlsx = name.endsWith('.xlsx');

    if (isAionion ? !okXlsx : !okCsv) {
      setError(`Please select a valid ${acceptLabel} file`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');
    setUploadResult(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleRemoveFile = (): void => {
    setSelectedFile(null);
    setUploadResult(null);
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile || !accountId) {
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    try {
      const response = await holdingAccountsAPI.uploadHoldings(accountId, selectedFile);
      
      const result: UploadResult = {
        success: true,
        message: response.data.message,
        recordsProcessed: response.data.result.successful,
        errors: response.data.result.errors,
      };

      setUploadResult(result);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Failed to upload holdings:', error);
      const errorResult: UploadResult = {
        success: false,
        message: error.response?.data?.detail || 'Failed to upload holdings',
        errors: error.response?.data?.errors || [],
      };
      setUploadResult(errorResult);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isAionion = account?.account_platform === 'AIONION';
  const acceptExt = isAionion ? '.xlsx' : '.csv';
  const acceptLabel = isAionion ? 'XLSX' : 'CSV';

  if (!account && !error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 1, mb: 4 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/holding-accounts')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          Upload Holdings
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {account && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Account Details
            </Typography>
            <Box display="flex" gap={2} alignItems="center" mt={1}>
              <Typography variant="h6">{account.account_id}</Typography>
              <Chip label={account.account_platform} color="primary" size="small" />
              <Chip label={account.currency} variant="outlined" size="small" />
            </Box>
          </CardContent>
        </Card>
      )}

      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Upload {acceptLabel} File
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload a {acceptLabel} file containing your holdings data. The file should include columns for symbol, quantity, average price, and other relevant information.
        </Typography>

        <Box
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            backgroundColor: dragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s',
            cursor: 'pointer',
            mb: 3,
          }}
        >
          <input
            type="file"
            accept={acceptExt}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            id="file-upload"
            disabled={uploading}
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
            <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {dragActive ? 'Drop file here' : `Drag and drop ${acceptLabel} file here`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Maximum file size: 10MB
            </Typography>
          </label>
        </Box>

        {selectedFile && (
          <Card sx={{ mb: 3, backgroundColor: 'grey.50' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected File
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
                <IconButton onClick={handleRemoveFile} disabled={uploading}>
                  <Delete />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        )}

        {uploading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {uploadResult && (
          <Alert
            severity={uploadResult.success ? 'success' : 'error'}
            icon={uploadResult.success ? <CheckCircle /> : <ErrorIcon />}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2" fontWeight={600}>
              {uploadResult.message}
            </Typography>
            {uploadResult.recordsProcessed && (
              <Typography variant="body2" mt={1}>
                Records processed: {uploadResult.recordsProcessed}
              </Typography>
            )}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Box mt={2}>
                <Typography variant="body2" fontWeight={600}>
                  Errors:
                </Typography>
                <List dense>
                  {uploadResult.errors.map((error, index) => (
                    <ListItem key={index} sx={{ py: 0 }}>
                      <ListItemText
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Alert>
        )}

        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            fullWidth
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/holding-accounts')}
            disabled={uploading}
          >
            Cancel
          </Button>
        </Box>

    {!isAionion && (
      <>
        <Divider sx={{ my: 3 }} />
        <Alert severity="info" icon={<Info />}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            {acceptLabel} Format Requirements:
          </Typography>
          <Typography variant="body2" component="div">
            Your {acceptLabel} file should include the following columns:
            <List dense sx={{ mt: 1 }}>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• Symbol or Ticker"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• Quantity"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• Average Price"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• Current Price (optional)"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Typography>
        </Alert>
      </> 
      )}
      </Paper>
    </Container>
  );
};

export default UploadHoldings;