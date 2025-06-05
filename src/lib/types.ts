
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
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  date: string;
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

export interface User {
  id: string;
  username: string;
  email?: string;
  taicBalance: number;
  stakedTaicBalance: number;
  orders: Order[];
  aiConversations: AIConversation[];
  stakedWishlistGoals: StakedWishlistGoal[];
  paymentMethods?: PaymentMethod[];
  profileImageUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  userId: string | null; // Add userId to the interface
  login: (username: string) => void;
  logout: () => void;
  register: (username: string) => void;
  updateUser: (updatedUser: User) => void;
  loading?: boolean;
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
