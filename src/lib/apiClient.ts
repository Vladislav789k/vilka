/**
 * Centralized API client with retry logic, error handling, and development logging
 * 
 * Usage:
 *   const data = await apiClient.get('/api/endpoint');
 *   const result = await apiClient.post('/api/endpoint', { body: {...} });
 */

type RetryConfig = {
  maxRetries?: number;
  retryDelays?: number[];
  retryCondition?: (error: Error) => boolean;
};

type FetchOptions = RequestInit & {
  retry?: RetryConfig;
  timeout?: number;
};

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 2,
  retryDelays: [200, 400],
  retryCondition: (error) => {
    return error instanceof TypeError && error.message === "Failed to fetch";
  },
};

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Check if we're in development mode
 */
export const isDev = () => {
  return process.env.NODE_ENV === "development";
};

/**
 * Development logger - only logs in development mode
 */
export const devLog = (message: string, ...args: any[]) => {
  if (isDev()) {
    console.log(`[API] ${message}`, ...args);
  }
};

export const devError = (message: string, ...args: any[]) => {
  if (isDev()) {
    console.error(`[API] ${message}`, ...args);
  }
};

export const devWarn = (message: string, ...args: any[]) => {
  if (isDev()) {
    console.warn(`[API] ${message}`, ...args);
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

/**
 * Execute fetch with retry logic
 */
const fetchWithRetry = async (
  url: string,
  options: FetchOptions,
  requestSeq?: number
): Promise<Response> => {
  const retryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options.retry,
  };
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  let lastError: Error | null = null;

  for (let retryCount = 0; retryCount <= retryConfig.maxRetries; retryCount++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry =
        retryCount < retryConfig.maxRetries &&
        retryConfig.retryCondition(lastError);

      if (shouldRetry) {
        const delay = retryConfig.retryDelays[retryCount] ?? 400;
        const seqInfo = requestSeq !== undefined ? ` (seq: ${requestSeq})` : "";
        devLog(
          `Network error${seqInfo}, retrying (${retryCount + 1}/${retryConfig.maxRetries}) after ${delay}ms`
        );
        await sleep(delay);
        continue;
      }

      // No more retries or non-retryable error
      break;
    }
  }

  // All retries exhausted
  throw lastError || new Error("Unknown error");
};

/**
 * Build full API URL
 */
const buildApiUrl = (path: string): string => {
  if (typeof window === "undefined") {
    return path;
  }
  // For Next.js API routes, use relative URLs
  if (path.startsWith("/api/")) {
    return path;
  }
  // For external URLs, use full URL
  return path.startsWith("http") ? path : `${window.location.origin}${path}`;
};

/**
 * Centralized API client
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = buildApiUrl(path);
    devLog(`GET ${url}`);

    const response = await fetchWithRetry(url, {
      ...options,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    return response.json() as Promise<T>;
  },

  /**
   * POST request
   */
  async post<T = any>(
    path: string,
    options: FetchOptions & { body?: any } = {}
  ): Promise<T> {
    const url = buildApiUrl(path);
    const { body, ...fetchOptions } = options;
    devLog(`POST ${url}`, body);

    const response = await fetchWithRetry(url, {
      ...fetchOptions,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json() as Promise<T>;
  },

  /**
   * PUT request
   */
  async put<T = any>(
    path: string,
    options: FetchOptions & { body?: any } = {}
  ): Promise<T> {
    const url = buildApiUrl(path);
    const { body, ...fetchOptions } = options;
    devLog(`PUT ${url}`, body);

    const response = await fetchWithRetry(url, {
      ...fetchOptions,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json() as Promise<T>;
  },

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = buildApiUrl(path);
    devLog(`DELETE ${url}`);

    const response = await fetchWithRetry(url, {
      ...options,
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    return response.json() as Promise<T>;
  },

  /**
   * Raw fetch with retry (for cases where you need the Response object)
   */
  async fetch(path: string, options: FetchOptions = {}): Promise<Response> {
    const url = buildApiUrl(path);
    return fetchWithRetry(url, options);
  },
};

/**
 * Create a request sequence tracker for debouncing/cancellation
 */
export class RequestSequence {
  private seq = 0;

  next(): number {
    this.seq += 1;
    return this.seq;
  }

  isLatest(checkSeq: number): boolean {
    return checkSeq === this.seq;
  }
}

