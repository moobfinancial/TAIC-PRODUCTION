import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

// Mock the auth functions
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockSignUp = vi.fn();

vi.mock('@/lib/auth', () => ({
  signIn: (email: string, password: string) => mockSignIn(email, password),
  signOut: () => mockSignOut(),
  signUp: (email: string, password: string) => mockSignUp(email, password),
}));

describe('useAuth', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should call signIn with correct parameters', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    const testEmail = 'test@example.com';
    const testPassword = 'password123';
    
    await act(async () => {
      await result.current.signIn(testEmail, testPassword);
    });
    
    expect(mockSignIn).toHaveBeenCalledWith(testEmail, testPassword);
  });

  it('should call signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.signOut();
    });
    
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle signIn error', async () => {
    const errorMessage = 'Invalid credentials';
    mockSignIn.mockRejectedValueOnce(new Error(errorMessage));
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await expect(result.current.signIn('wrong@example.com', 'wrong')).rejects.toThrow(errorMessage);
    });
  });
});
