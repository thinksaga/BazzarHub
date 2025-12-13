export interface Product {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  inventory: number;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  vendorId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  inventory: number;
  images: string[];
  attributes?: Record<string, any>;
}

export interface UpdateProductDTO {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  inventory?: number;
  images?: string[];
  attributes?: Record<string, any>;
  isActive?: boolean;
}
