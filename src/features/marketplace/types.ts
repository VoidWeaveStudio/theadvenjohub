//src\features\marketplace\types.ts
export interface LotWithGame {
  id: string;
  name: string;
  price: number;
  type: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  game: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FiltersState {
  search: string;
  game: string;
  rarity: string[];
  type: string[];
  minPrice: string;
  maxPrice: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}