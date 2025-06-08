
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Demo TAIC price
  base_price?: number | string; // Original cash price
  imageUrl: string;
  category: string;
  dataAiHint?: string;
  additionalImages?: string[];
  variants?: ProductVariant[];
  cashbackPercentage?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price?: number;
  options?: Record<string, string>;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number; // This is price_at_purchase
  quantity: number;
  imageUrl?: string;
  cashbackPercentage?: number; // To be sent to backend during order creation
}

export interface Order {
  id: number; // Changed to number to align with API response
  items: OrderItem[];
  totalAmount: number;
  date: string; // ISO String
  currency?: string; // Added from API response
  status?: string;   // Added from API response
  cashbackAwarded?: number; // Added for cashback feature
}

export interface AIConversation {
  id: string;
  type: 'shopping_assistant' | 'product_idea_generator';
  query: string;
  response: string;
  timestamp: string;
  imageUrlContext?: string; // Optional URL of the image used as context
}

export interface StakedWishlistGoal {
  id: string;
  name: string; // User-defined name for this goal
  targetValue: number; // Wishlist total at the time of staking for it
  principalStakedForGoal: number; // Amount of TAIC user committed from their balance
  startDate: string; // ISO date string when goal was created
  estimatedMaturityDate: string; // Calculated ISO date string
  // isMature can be derived dynamically: new Date() >= new Date(estimatedMaturityDate)
}

export interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// Updated User interface for wallet-based authentication
export interface User {
  id: number; // Database ID (SERIAL)
  walletAddress: string;
  username?: string | null; // Optional, as per schema and new auth
  email?: string | null;    // Optional, as per schema and new auth
  role: string;             // e.g., 'user', 'merchant', 'admin'
  taicBalance: number;      // Numeric type from DB
  cashbackBalance: number;  // Added cashback balance

  // The following fields were part of the old User type.
  // If they are still needed, they might be fetched separately or part of a different type (e.g., UserProfile).
  // For now, they are removed to align with the auth/me and auth/verify API responses.
  // stakedTaicBalance?: number;
  // orders?: Order[];
  // aiConversations?: AIConversation[];
  // stakedWishlistGoals?: StakedWishlistGoal[];
  // paymentMethods?: PaymentMethod[];
  // profileImageUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  // userId: string | null; // This can be derived from user.id if user is not null
  // The login/register methods will be replaced by wallet-specific ones
  // login: (username: string) => void;
  logout: () => void;
  // register: (username: string) => void;
  // updateUser: (updatedUser: User) => void; // This might be handled differently or removed

  // New wallet-based auth methods will be added here by the AuthContext task
  // For example:
  // loginWithWallet: (walletAddress: string) => Promise<void>;
  // isAuthenticated: boolean;
  // token: string | null;
  isLoading: boolean; // Renamed from 'loading' for consistency
}

export interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product)  => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export type WishlistItem = Product;

export interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  getWishlistTotalValue: () => number;
  getWishlistItemCount: () => number;
  clearWishlist: () => void;
}

export interface UserGalleryImage {
  id: number;
  imageUrl: string;
  imageType?: string | null;
  description?: string | null;
  createdAt: string; // ISO string date
}
