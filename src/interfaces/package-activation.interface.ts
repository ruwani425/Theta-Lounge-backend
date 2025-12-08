// src/interfaces/package-activation.interface.ts

import { Package } from './package.interface';

export interface PackageActivation {
  _id?: string
  
  userId?: string
  
  fullName: string
  email: string
  phone: string
  address: string
  message?: string 

  packageId: string
  packageName: string 
  totalSessions?: number 

  preferredDate: Date 
  status: 'Pending' | 'Contacted' | 'Confirmed' | 'Rejected' | 'Expired'
  
  usedCount?: number
  remainingSessions?: number 
  
  startDate?: Date
  expiryDate?: Date 
  
  createdAt?: Date
  updatedAt?: Date
}

export interface PaginatedPackageActivationsResponse {
  data: PackageActivation[]
  pagination: any 
}