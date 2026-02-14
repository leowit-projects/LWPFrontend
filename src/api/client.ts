import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
    User,
    AllowedEmail,
    AllowedEmailCreate,
    StockSymbol,
    StockSymbolCreate,
    ETFSymbol,
    ETFSymbolCreate,
    Bond,
    BondCreate,
    MutualFund,
    MutualFundCreate,
    Holding,
    HoldingCreate,
    HoldingUpdate,
    HoldingWithDetails,
    CurrentPrice,
    ExchangeRate,
    DashboardSummary,
    Token,
    GoogleAuthRequest,
    AssetType,
    CurrencyCode,
    Recommendation,
    Industry,
    IndustryCreate,
    IndustryUpdate,
    Strategy,
    StrategyCreate,
    StrategyUpdate,
    HoldingAccount,
    HoldingAccountCreate,
    HoldingAccountUpdate,
    HoldingUploadResponse,
    HoldingAccountsResponse,
    TimeRange,
    AssetTypeParam,
    PriceHistoryData,
    ChartSummary,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    googleLogin: (token: string): Promise<AxiosResponse<Token>> =>
        api.post<Token>('/api/auth/google', { token } as GoogleAuthRequest),

    getCurrentUser: (): Promise<AxiosResponse<User>> =>
        api.get<User>('/api/auth/me'),
};

// Admin API
export const adminAPI = {
    getAllowedEmails: (): Promise<AxiosResponse<AllowedEmail[]>> =>
        api.get<AllowedEmail[]>('/api/admin/allowed-emails'),

    addAllowedEmail: (data: AllowedEmailCreate): Promise<AxiosResponse<AllowedEmail>> =>
        api.post<AllowedEmail>('/api/admin/allowed-emails', data),

    deleteAllowedEmail: (email: string): Promise<AxiosResponse<{ message: string }>> =>
        api.delete(`/api/admin/allowed-emails/${email}`),

    triggerDailyPrices: (): Promise<AxiosResponse<{
        success: boolean;
        message: string;
        info: string;
    }>> =>
        api.post('/api/admin/trigger-daily-prices'),

    triggerMarketSnapshots: (): Promise<AxiosResponse<{
        success: boolean;
        message: string;
        info: string;
    }>> =>
        api.post('/api/admin/trigger-market-snapshots'),

    triggerRecommendations: (): Promise<AxiosResponse<{
        success: boolean;
        message: string;
        info: string;
    }>> =>
        api.post('/api/admin/trigger-recommendations'),
};

// Stock API
export const stockAPI = {
    getAll: (purpose?: 'list' | 'admin'): Promise<AxiosResponse<StockSymbol[]>> =>
        api.get<StockSymbol[]>('/api/stocks', { params: { purpose } }),

    getById: (symbol: string): Promise<AxiosResponse<StockSymbol>> =>
        api.get<StockSymbol>(`/api/stocks/${symbol}`),

    create: (data: StockSymbolCreate): Promise<AxiosResponse<StockSymbol>> =>
        api.post<StockSymbol>('/api/stocks', data),

    update: (symbol: string, data: StockSymbolCreate): Promise<AxiosResponse<StockSymbol>> =>
        api.put<StockSymbol>(`/api/stocks/${symbol}`, data),

    delete: (symbol: string): Promise<AxiosResponse<{ message: string }>> =>
        api.delete(`/api/stocks/${symbol}`),
};

// ETF API  
export const etfAPI = {
    getAll: (purpose?: 'list' | 'admin'): Promise<AxiosResponse<ETFSymbol[]>> =>
        api.get<ETFSymbol[]>('/api/etfs', { params: { purpose } }),

    create: (data: ETFSymbolCreate): Promise<AxiosResponse<ETFSymbol>> =>
        api.post<ETFSymbol>('/api/etfs', data),

    update: (symbol: string, data: ETFSymbolCreate): Promise<AxiosResponse<ETFSymbol>> =>
        api.put<ETFSymbol>(`/api/etfs/${symbol}`, data),

    delete: (symbol: string): Promise<AxiosResponse<{ message: string }>> =>
        api.delete(`/api/etfs/${symbol}`),
};

// Bond API
export const bondAPI = {
    getAll: (): Promise<AxiosResponse<Bond[]>> =>
        api.get<Bond[]>('/api/bonds'),

    create: (data: BondCreate): Promise<AxiosResponse<Bond>> =>
        api.post<Bond>('/api/bonds', data),
};

// Mutual Fund API
export const mutualFundAPI = {
    getAll: (): Promise<AxiosResponse<MutualFund[]>> =>
        api.get<MutualFund[]>('/api/mutual-funds'),

    create: (data: MutualFundCreate): Promise<AxiosResponse<MutualFund>> =>
        api.post<MutualFund>('/api/mutual-funds', data),
};

// Holdings API
export const holdingsAPI = {
    getAll: (assetType?: AssetType): Promise<AxiosResponse<HoldingWithDetails[]>> => {
        const params = assetType ? { asset_type: assetType } : {};
        return api.get<HoldingWithDetails[]>('/api/holdings', { params });
    },

    create: (data: HoldingCreate): Promise<AxiosResponse<Holding>> =>
        api.post<Holding>('/api/holdings', data),

    update: (id: number, data: HoldingUpdate): Promise<AxiosResponse<Holding>> =>
        api.put<Holding>(`/api/holdings/${id}`, data),

    delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
        api.delete(`/api/holdings/${id}`),
};

// Market Data API
export const marketAPI = {
    getPrice: (symbol: string): Promise<AxiosResponse<CurrentPrice>> =>
        api.get<CurrentPrice>(`/api/market/price/${symbol}`),

    updateHistory: (symbol: string, isEtf: boolean, days: number): Promise<AxiosResponse<{ message: string }>> =>
        api.post(`/api/market/update-history/${symbol}`, null, {
            params: { is_etf: isEtf, days }
        }),

    getExchangeRate: (fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<AxiosResponse<ExchangeRate>> =>
        api.get<ExchangeRate>('/api/market/exchange-rate', {
            params: { from_currency: fromCurrency, to_currency: toCurrency }
        }),
};

// Dashboard API
export const dashboardAPI = {
    getSummary: (currency: CurrencyCode): Promise<AxiosResponse<DashboardSummary>> =>
        api.get<DashboardSummary>('/api/dashboard/summary', { params: { currency } }),
};

// Recommendations API
export const recommendationsAPI = {
    getAll: (filters?: {
        asset_type?: AssetType;
        recommendation_type?: string;
        strategy?: string;
        min_confidence?: number;
        currency?: CurrencyCode;
    }): Promise<AxiosResponse<Recommendation[]>> =>
        api.get<Recommendation[]>('/api/recommendations', { params: filters }),

    getById: (id: number): Promise<AxiosResponse<Recommendation>> =>
        api.get<Recommendation>(`/api/recommendations/${id}`),
};

// Industries API
export const industriesAPI = {
    getAll: (): Promise<AxiosResponse<Industry[]>> =>
        api.get<Industry[]>('/api/industries'),

    getById: (id: number): Promise<AxiosResponse<Industry>> =>
        api.get<Industry>(`/api/industries/${id}`),

    create: (data: IndustryCreate): Promise<AxiosResponse<Industry>> =>
        api.post<Industry>('/api/industries', data),

    update: (id: number, data: IndustryUpdate): Promise<AxiosResponse<Industry>> =>
        api.put<Industry>(`/api/industries/${id}`, data),

    delete: (id: number): Promise<AxiosResponse<void>> =>
        api.delete(`/api/industries/${id}`),
};

// Audit Logs API
export const auditLogsAPI = {
    getAll: (params?: {
        user_id?: number;
        action?: string;
        entity_type?: string;
        source?: string;
        success?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<AxiosResponse<{
        logs: any[];
        total: number;
        limit: number;
        offset: number;
    }>> =>
        api.get('/api/audit-logs/', { params }),

    getStats: (): Promise<AxiosResponse<{
        total_logs: number;
        failed_actions: number;
        unique_users: number;
        actions_by_type: { [key: string]: number };
        actions_by_source: { [key: string]: number };
        recent_activity_24h: number;
    }>> =>
        api.get('/api/audit-logs/stats'),

    getUserActivity: (userId: number, limit?: number): Promise<AxiosResponse<{
        user_id: number;
        logs: any[];
    }>> =>
        api.get(`/api/audit-logs/user/${userId}`, { params: { limit } }),

    getFailedActions: (hours?: number, limit?: number): Promise<AxiosResponse<{
        hours: number;
        failed_actions: any[];
    }>> =>
        api.get('/api/audit-logs/failed', { params: { hours, limit } }),

    getMyActivity: (limit?: number): Promise<AxiosResponse<{
        logs: any[];
    }>> =>
        api.get('/api/audit-logs/my-activity', { params: { limit } }),
};

// Strategies API
export const strategiesAPI = {
    getAll: (): Promise<AxiosResponse<Strategy[]>> =>
        api.get<Strategy[]>('/api/strategies'),

    getById: (id: number): Promise<AxiosResponse<Strategy>> =>
        api.get<Strategy>(`/api/strategies/${id}`),

    create: (data: StrategyCreate): Promise<AxiosResponse<Strategy>> =>
        api.post<Strategy>('/api/strategies', data),

    update: (id: number, data: StrategyUpdate): Promise<AxiosResponse<Strategy>> =>
        api.put<Strategy>(`/api/strategies/${id}`, data),

    delete: (id: number): Promise<AxiosResponse<void>> =>
        api.delete(`/api/strategies/${id}`),
};

// Holding Accounts API
export const holdingAccountsAPI = {
    getAll: (includeInactive?: boolean): Promise<AxiosResponse<HoldingAccount[]>> =>
        api.get<HoldingAccount[]>('/api/holding-accounts', {
            params: { include_inactive: includeInactive }
        }),

    getById: (accountId: string): Promise<AxiosResponse<HoldingAccount>> =>
        api.get<HoldingAccount>(`/api/holding-accounts/${accountId}`),

    getHoldings: (accountId: string): Promise<AxiosResponse<HoldingAccountsResponse>> =>
        api.get<HoldingAccountsResponse>(`/api/holding-accounts/${accountId}/holdings`),

    create: (data: HoldingAccountCreate): Promise<AxiosResponse<HoldingAccount>> =>
        api.post<HoldingAccount>('/api/holding-accounts', data),

    update: (accountId: string, data: HoldingAccountUpdate): Promise<AxiosResponse<HoldingAccount>> =>
        api.put<HoldingAccount>(`/api/holding-accounts/${accountId}`, data),

    delete: (accountId: string): Promise<AxiosResponse<{ message: string; account_id: string }>> =>
        api.delete(`/api/holding-accounts/${accountId}`),

    reactivate: (accountId: string): Promise<AxiosResponse<HoldingAccount>> =>
        api.post<HoldingAccount>(`/api/holding-accounts/${accountId}/reactivate`),

    deleteHolding: (accountId: string, holdingId: number): Promise<AxiosResponse<{ message: string; holding_id: number; account_id: string }>> =>
        api.delete(`/api/holding-accounts/${accountId}/holdings/${holdingId}`),

    uploadHoldings: (accountId: string, file: File): Promise<AxiosResponse<HoldingUploadResponse>> => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post<HoldingUploadResponse>(
            `/api/holding-accounts/${accountId}/upload-holdings`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
};

// Historical Charts API
export const historicalChartsAPI = {
    getSimpleHistory: (
        symbol: string,
        assetType: AssetTypeParam,
        timeRange: TimeRange = TimeRange.ONE_YEAR
    ): Promise<AxiosResponse<PriceHistoryData>> =>
        api.get<PriceHistoryData>(`/api/historical-charts/${symbol}/simple-history`, {
            params: { asset_type: assetType, time_range: timeRange }
        }),

    getHistoryWithMA: (
        symbol: string,
        assetType: AssetTypeParam,
        timeRange: TimeRange = TimeRange.ONE_YEAR
    ): Promise<AxiosResponse<PriceHistoryData>> =>
        api.get<PriceHistoryData>(`/api/historical-charts/${symbol}/history-with-ma`, {
            params: { asset_type: assetType, time_range: timeRange }
        }),

    getChartSummary: (
        symbol: string,
        assetType: AssetTypeParam
    ): Promise<AxiosResponse<ChartSummary>> =>
        api.get<ChartSummary>(`/api/historical-charts/${symbol}/summary`, {
            params: { asset_type: assetType }
        }),
};

export default api;