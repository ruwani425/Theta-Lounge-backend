// src/interfaces/package-activation.interface.ts

import { Package } from './package.interface';

export interface PackageActivation {
  _id?: string
  
  // User Reference
  userId?: string
  
  // User/Client Information
  fullName: string
  email: string
  phone: string
  address: string
  message?: string // Optional note

  // Package Information
  packageId: string
  packageName: string // Storing this for historical/readability purposes
  totalSessions?: number // Total sessions in the package

  // Status/Activation Details
  preferredDate: Date // The date/time of the request submission
  status: 'Pending' | 'Contacted' | 'Confirmed' | 'Rejected'
  
  // Session Tracking
  usedCount?: number // Number of sessions used
  remainingSessions?: number // Calculated: totalSessions - usedCount
  
  // Date Tracking
  startDate?: Date // When package was confirmed/activated
  expiryDate?: Date // When package expires
  
  createdAt?: Date
  updatedAt?: Date
}

export interface PaginatedPackageActivationsResponse {
  data: PackageActivation[]
  // Assuming PaginationResponse is imported or defined elsewhere
  pagination: any 
}