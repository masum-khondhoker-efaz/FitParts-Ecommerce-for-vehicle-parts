export interface CreateProductInput {
  categoryId: string;
  brandId: string;
  productName: string;
  productImages: string[];
  description?: string;
  price: number;
  discount?: number;
  stock: number;
  isVisible?: boolean;

  sections?: {
    sectionName: string;
    parentId?: string;
    fields?: {
      fieldName: string;
      valueString?: string;
      valueInt?: number;
      valueFloat?: number;
      valueDate?: Date;
    }[];
  }[];

  references?: {
    type: 'OE' | 'SUPPLIER' | 'INTERNAL';
    number: string;
  }[];

  shipping?: {
    countryName: string;
    countryCode: string;
    carrier: string;
    cost: number;
    deliveryMin: number;
    deliveryMax: number;
    isDefault?: boolean;
  }[];

  fitVehicles?: []; // Array of Engine IDs
}

export interface UpdateProductInput {
  productName?: string;
  productImages?: string[];
  description?: string;
  price?: number;
  stock?: number;
  isVisible?: boolean;
  sections?: {
    name: string;
    parentId?: string;
    fields?: {
      name: string;
      valueString?: string;
      valueInt?: number;
      valueFloat?: number;
      valueDate?: Date;
    }[];
  }[];
  references?: {
    type: 'OE' | 'SUPPLIER' | 'INTERNAL';
    number: string;
  }[];
  shipping?: {
    countryName: string;
    countryCode: string;
    carrier: string;
    cost: number;
    deliveryMin: number;
    deliveryMax: number;
    isDefault?: boolean;
  }[];
}
export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
export interface ProductFilter {
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}
export interface ProductSort {
  sortBy?: 'price' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
