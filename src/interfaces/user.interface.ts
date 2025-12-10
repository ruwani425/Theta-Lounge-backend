export interface IUser {
  name: string;
  email: string;
  profileImage: string;
  firebaseUid: string;
  role: "admin" | "client";
  permissions: string[];
  createdAt?: string; 
  updatedAt?: string;
}
