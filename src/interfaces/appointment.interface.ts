import type { Document } from "mongoose"

export interface IAppointment extends Document {
  reservationId: string
  name: string
  date: string
  time: string
  email: string
  contactNumber: string
  specialNote?: string
  status: "pending" | "cancelled" | "completed"
  packageActivationId?: string
  createdAt: Date
  updatedAt: Date
}

export interface AppointmentCount {
  _id: {
    date: string
    status: "pending" | "cancelled" | "completed"
  }
  count: number
}

export interface PaginationMeta {
  currentPage: number
  totalPages: number
  totalRecords: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}
