export interface IUser {
  name: string;
  email: string;
  profileImage: string;
  firebaseUid: string;
  role: "admin" | "client";
}
