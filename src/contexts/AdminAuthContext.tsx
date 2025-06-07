'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  adminApiKey: string | null; 
  login: (apiKey: string) => Promise<boolean>;
  get: (adminApiKey: string | null, endpoint: string, options?: RequestInit) => Promise<Response>;
  logout: () => void;
  loading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState<string | null>(null); // Add state for adminApiKey
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const apiKey = sessionStorage.getItem('adminApiKey');
        if (apiKey) {
          console.log('[AdminAuth] Checking existing session...');
          const response = await fetch('/api/admin/verify', {
            headers: { 'X-Admin-API-Key': apiKey },
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            console.log('[AdminAuth] Session is valid');
            // Also ensure the cookie is set for middleware
            document.cookie = `admin-api-key=${apiKey}; path=/; max-age=86400; SameSite=Strict`;
            setAdminApiKey(apiKey); // Set adminApiKey state
            setIsAuthenticated(true);
          } else {
            console.log('[AdminAuth] Session is invalid, clearing...');
            sessionStorage.removeItem('adminApiKey');
            setAdminApiKey(null); // Clear adminApiKey state
          }
        } else {
          console.log('[AdminAuth] No existing session found');
          setAdminApiKey(null); // Clear adminApiKey state if no session
        }
      } catch (error) {
        console.error('[AdminAuth] Auth check failed:', error);
        sessionStorage.removeItem('adminApiKey');
        setAdminApiKey(null); // Clear adminApiKey state on error
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (apiKey: string): Promise<boolean> => {
    try {
      console.log('[AdminAuth] Attempting login...');
      const response = await fetch('/api/admin/verify', {
        headers: { 'X-Admin-API-Key': apiKey },
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('[AdminAuth] Login successful');
        // Store in sessionStorage for React context
        sessionStorage.setItem('adminApiKey', apiKey);
        
        // Also store in a cookie for middleware authentication
        document.cookie = `admin-api-key=${apiKey}; path=/; max-age=86400; SameSite=Strict`;
        
        setAdminApiKey(apiKey); // Set adminApiKey state on login
        setIsAuthenticated(true);
        return true;
      } else {
        console.error('[AdminAuth] Login failed:', data.message || 'Unknown error');
        throw new Error(data.message || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('[AdminAuth] Login error:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Failed to authenticate',
        variant: 'destructive',
      });
      return false;
    }
  };

  const logout = () => {
    // Clear from sessionStorage
    sessionStorage.removeItem('adminApiKey');
    
    // Clear the cookie by setting an expired date
    document.cookie = 'admin-api-key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
    
    setAdminApiKey(null); 
    setIsAuthenticated(false);
    router.push('/admin/login');
  };

  // Create a get method that uses the adminApiClient
  const get = async (adminApiKey: string | null, endpoint: string, options: RequestInit = {}) => {
    const client = getAdminApiClient(adminApiKey);
    // For GET requests, we need to include query parameters in the URL
    let url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // If there's a body in options, we need to convert it to query parameters for GET requests
    if (options.body) {
      const params = new URLSearchParams();
      const bodyObj = JSON.parse(options.body as string);
      Object.entries(bodyObj).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      url = `${url}?${params.toString()}`;
    }
    
    return client.get(url);
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, adminApiKey, login, logout, loading, get }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

// Create an API client that includes the admin API key
// Note: Callers of getAdminApiClient must now pass the adminApiKey.
// Example: const apiClient = getAdminApiClient(adminApiKeyFromHook);
export function getAdminApiClient(adminApiKey: string | null) {
  
  return {
    get: async (url: string) => {
      const response = await fetch(url, {
        headers: {
          'X-Admin-API-Key': adminApiKey || '',
        },
      });
      return response;
    },
    
    post: async (url: string, options: RequestInit) => { // Renamed 'data' to 'options'
      const response = await fetch(url, {
        ...options, // Spread the options received from adminClient.ts
        method: 'POST', // Ensure method is POST
        headers: {
          ...(options.headers || {}), // Spread headers from options
          'X-Admin-API-Key': adminApiKey || '', // Add/override API key header
        },
      });
      return response;
    },
    
    put: async (url: string, options: RequestInit) => { // Renamed 'data' to 'options'
      const response = await fetch(url, {
        ...options, // Spread the options received from adminClient.ts
        method: 'PUT', // Ensure method is PUT
        headers: {
          ...(options.headers || {}), // Spread headers from options
          'X-Admin-API-Key': adminApiKey || '', // Add/override API key header
        },
      });
      return response;
    },
    
    delete: async (url: string) => {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Admin-API-Key': adminApiKey || '',
        },
      });
      return response;
    },
  };
}
