// src/config/jwt.config.ts

export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-should-be-in-env-file-2024';
export const JWT_EXPIRY = '7d';

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn(' WARNING: Using default JWT_SECRET. Please set JWT_SECRET in your .env file for production!');
    console.log(' Current JWT_SECRET:', JWT_SECRET);
}

