export interface Package {
  _id?: string
  name: string
  duration: "1-Month" | "6-Month" | "12-Month"
  sessions: number
  pricePerSlot: number
  totalPrice: number
  discount: number
  isGenesisEligible: boolean
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface PaginationResponse {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedPackagesResponse {
  data: Package[]
  pagination: PaginationResponse
}
