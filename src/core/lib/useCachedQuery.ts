//src\core\lib\useCachedQuery.ts
import useSWR, { SWRConfiguration } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }
  return res.json();
};

export function useCachedQuery<T = any>(
  key: string | null,
  config?: SWRConfiguration & {
    staleTime?: number;
    cacheTime?: number;
  }
) {
  const { staleTime = 30000, cacheTime = 300000, ...swrConfig } = config || {};

  return useSWR<T>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: staleTime,
      keepPreviousData: true,
      ...swrConfig,
      ...(cacheTime > 0 && {
        revalidateIfStale: false,
        revalidateOnMount: !key ? false : undefined,
      }),
    }
  );
}

export function useStaticConfig<T = any>(endpoint: string, defaultData?: T) {
  return useCachedQuery<T>(
    endpoint,
    {
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
      fallbackData: defaultData,
    }
  );
}