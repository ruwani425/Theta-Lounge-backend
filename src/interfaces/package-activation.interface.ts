// src/interfaces/package-activation.interface.ts

import { Package } from './package.interface';

export interface PackageActivation {
  _id?: string
  
  // User/Client Information
  fullName: string
  email: string
  phone: string
  address: string
  message?: string // Optional note

  // Package Information
  packageId: string
  packageName: string // Storing this for historical/readability purposes

  // Status/Activation Details
  preferredDate: Date // The date/time of the request submission
  status: 'Pending' | 'Contacted' | 'Confirmed' | 'Rejected'
  
  createdAt?: Date
  updatedAt?: Date
}

export interface PaginatedPackageActivationsResponse {
  data: PackageActivation[]
  // Assuming PaginationResponse is imported or defined elsewhere
  pagination: any 
}