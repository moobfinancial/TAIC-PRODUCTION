export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Demo TAIC price
  base_price?: number | string; // Original cash price
  imageUrl: string;
  category: string;
  sku?: string; // Added SKU for base product
  dataAiHint?: string;
  additionalImages?: string[];
  variants?: ProductVariant[];
  cashbackPercentage?: number;
}

export interface ProductVariant {
  id: string;
  name: string; // This might be a combined name like "Red / Large"
  sku?: string;
  price?: number; // Variant-specific price
  imageUrl?: string; // Variant-specific image URL
  attributes?: Record<string, string | number>; // Renamed from options, allows number values
  stock_quantity?: number;
  is_active?: boolean;
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
  cashbackPercentage?: number;
}

export interface Order {
  id: number;
  items: OrderItem[];
  totalAmount: number;
  date: string; // ISO String
  currency?: string;
  status?: string;
  cashbackAwarded?: number;

  cjOrderId?: string | null;
  cjShippingStatus?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;

  shippingRecipientName?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingStateOrProvince?: string | null;
  shippingPostalCode?: string | null;
  shippingCountryCode?: string | null;
  shippingPhoneNumber?: string | null;
}

export interface AIConversation {
  id: string;
  type: 'shopping_assistant' | 'product_idea_generator';
  query: string;
  response: string;
  timestamp: string;
  imageUrlContext?: string;
}

export interface StakedWishlistGoal {
  id: string;
  name: string;
  targetValue: number;
  principalStakedForGoal: number;
  startDate: string;
  estimatedMaturityDate: string;
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
  id: number;
  walletAddress: string;
  username?: string | null;
  email?: string | null;
  role: string;
  taicBalance: number;
  cashbackBalance: number;
  profileImageUrl?: string | null; // Added back as ProfileSection uses it
}

export interface AuthContextType {
  user: User | null;
  token: string | null; // Added
  isAuthenticated: boolean; // Added
  isLoading: boolean;
  logout: () => void;
  loginWithWallet: (walletAddress: string) => Promise<void>; // Added for explicitness
  refreshUser: () => Promise<void>; // Uncommented and made active
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
  createdAt: string;
}

export interface AiSuggestedProduct {
  id: number; // From FastAPI ProductModel.id (e.g., platform_product_id from cj_products)
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  category_name?: string | null;
  source_product_id?: string | null; // e.g., cj_product_id from cj_products
}

// This ProductForAI seems to be from a previous Genkit product tool.
// It's different from AiSuggestedProduct from the FastAPI service.
export interface ProductForAI {
  id: string; // This is likely the original product ID from the main 'products' table
  name: string;
  description: string;
  price: string; // Note: string price
  imageUrl: string;
  dataAiHint?: string;
  category?: string;
}

export interface ChatMessage {
  id?: string; // For React keys
  role: 'user' | 'assistant' | 'system' | 'tool'; // Added 'tool' role
  content: string;
  products?: ProductForAI[]; // Existing field, potentially from Genkit product tool
  suggestedProducts?: AiSuggestedProduct[]; // New field for FastAPI suggestions
  name?: string; // For tool role, from Genkit
  toolRequest?: any; // from Genkit
  toolResponse?: any; // from Genkit
}

export interface CjOrderItemInput {
  productId: string;
  quantity: number;
}
export interface CjShippingAddressInput {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  phoneNumber?: string;
}
export interface CjOrderPayload {
  platformOrderId: string;
  shippingAddress: CjShippingAddressInput;
  items: CjOrderItemInput[];
}
export interface CjOrderResponse {
  success: boolean;
  cjOrderId?: string;
  status?: string;
  message?: string;
  errors?: any[];
}

// New types for CJ Order Status API response
export interface CjOrderStatusData {
  cjOrderId: string;
  cjShippingStatus?: string; // e.g., "Processing", "Shipped", "Delivered", "Cancelled"
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  dateShipped?: string | null; // ISO Date
}

export interface CjGetOrderStatusApiResponse {
  success: boolean;
  data?: CjOrderStatusData;
  message?: string;
  errors?: any[];
}
