import { useEffect, useState } from 'react';
import { stockAPI, etfAPI } from '../../api/client';
import { AssetType } from '../../types';

export interface SymbolOption {
  symbol: string;
  name?: string;
  asset_type: AssetType.STOCK | AssetType.ETF;
}

// Every active stock/ETF symbol, preloaded once for use in an Autocomplete picker.
export function useSymbolOptions(): SymbolOption[] {
  const [options, setOptions] = useState<SymbolOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [stocksRes, etfsRes] = await Promise.all([stockAPI.getAll('list'), etfAPI.getAll('list')]);
        const stockOptions: SymbolOption[] = stocksRes.data.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          asset_type: AssetType.STOCK,
        }));
        const etfOptions: SymbolOption[] = etfsRes.data.map((e) => ({
          symbol: e.symbol,
          name: e.name,
          asset_type: AssetType.ETF,
        }));
        setOptions([...stockOptions, ...etfOptions].sort((a, b) => a.symbol.localeCompare(b.symbol)));
      } catch (err) {
        console.error('Failed to load symbols:', err);
      }
    })();
  }, []);

  return options;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}
