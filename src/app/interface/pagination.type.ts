export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginationResult {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface IPaginationResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ISearchAndFilterOptions extends IPaginationOptions {
  searchTerm?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
  

  courseLevel?: string;
  categoryName?: string;
  priceMin?: number;
  priceMax?: number;
  discountPriceMin?: number;
  discountPriceMax?: number;
  rating?: number;
  
  // User-related filters
  userStatus?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  startDate?: string;
  endDate?: string;
  
  // Seller-related filters
  companyName?: string;
  companyEmail?: string;
  contactInfo?: string;
  
  // Car Brand-related filters
  brandName?: string;
  iconName?: string;
  modelName?: string;
  
  // Category-related filters
  name?: string;
  
  // Product-related filters
  productName?: string;
  description?: string;
  sellerId?: string;
  sellerCompanyName?: string;
  priceRange?: 'low' | 'medium' | 'high';
  stockMin?: number;
  stockMax?: number;
  isVisible?: boolean;
  
  // Cart-related filters
  quantity?: number;
  quantityMin?: number;
  quantityMax?: number;
  productId?: string;
}