import { getAdminApiClient } from '@/contexts/AdminAuthContext';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: any;
}

export async function adminApiRequest<T = any>(
  adminApiKey: string | null, // New first argument
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const client = getAdminApiClient(adminApiKey); // Pass it here
    const { method = 'GET', headers = {}, body } = options;

    let response;
    const url = `/api/admin${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
      },
    };

    if (body) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
    }

    switch (method) {
      case 'GET':
        // For GET requests, move query parameters from body to URL
        let getUrl = url;
        if (body && typeof body === 'object') {
          const params = new URLSearchParams();
          Object.entries(body).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
          const queryString = params.toString();
          if (queryString) {
            getUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
          }
        }
        response = await client.get(getUrl);
        break;
      case 'POST':
        fetchOptions.body = JSON.stringify(body);
        response = await client.post(url, fetchOptions);
        break;
      case 'PUT':
        fetchOptions.body = JSON.stringify(body);
        response = await client.put(url, fetchOptions);
        break;
      case 'DELETE':
        response = await client.delete(url);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error: any) {
    console.error('API request failed:', error);
    return {
      data: null,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

// Helper methods for common operations
export const adminApi = {
  get: (adminApiKey: string | null, endpoint: string, options: RequestInit = {}) => 
    adminApiRequest(adminApiKey, endpoint, { 
      ...options, 
      method: 'GET' 
    }),
  post: (adminApiKey: string | null, endpoint: string, data: any) => 
    adminApiRequest(adminApiKey, endpoint, { method: 'POST', body: data }),
  put: (adminApiKey: string | null, endpoint: string, data: any) => 
    adminApiRequest(adminApiKey, endpoint, { method: 'PUT', body: data }),
  delete: (adminApiKey: string | null, endpoint: string) => 
    adminApiRequest(adminApiKey, endpoint, { method: 'DELETE' }),
};
