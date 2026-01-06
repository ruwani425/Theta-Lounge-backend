import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRY } from "../config/jwt.config";

interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'client';
}

export const generateToken = (userId: string, email: string, role: 'admin' | 'client') => {
  const payload: JWTPayload = {
    userId,
    email,
    role,
  };
  
  console.log('Generating token for user:', { userId, email, role });
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
};
