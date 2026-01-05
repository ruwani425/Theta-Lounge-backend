import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model';
import { JWT_SECRET, JWT_EXPIRY } from '../config/jwt.config';

export interface AuthenticatedRequest extends Request {
    userId?: string;
    userRole?: 'admin' | 'client';
    userEmail?: string;
}

interface JWTPayload {
    userId: string;
    email: string;
    role: 'admin' | 'client';
}

export const authenticateToken = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
) => {
    try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

        console.log('[Auth Middleware] Request:', {
            path: req.path,
            method: req.method,
            hasAuthHeader: !!authHeader,
            hasToken: !!token,
        });

    if (!token) {
            console.warn('[Auth Middleware] No token provided');
        return res.status(401).json({ 
                success: false,
            message: 'Access token required. Please log in.',
                redirectTo: '/login'
        });
    }

        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        
        console.log('[Auth Middleware] Token verified:', {
            userId: decoded.userId,
            role: decoded.role,
            email: decoded.email,
        });
        
        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            console.warn('[Auth Middleware] User not found:', decoded.userId);
            return res.status(401).json({ 
                success: false,
                message: 'User no longer exists. Please log in again.',
                redirectTo: '/login'
            });
        }
        
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.userEmail = decoded.email;
        
        console.log('[Auth Middleware] User authenticated successfully');
        
        next();

    } catch (error: any) {
        console.error('[Auth Middleware] Token verification failed:', {
            error: error.message,
            name: error.name,
        });
        
        return res.status(403).json({ 
            success: false,
            message: 'Invalid or expired token. Please log in again.',
            redirectTo: '/login',
            error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        });
    }
};


export const requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    console.log('[Require Admin] Checking admin access:', {
        userRole: req.userRole,
        userId: req.userId,
        path: req.path,
    });
    
    if (req.userRole !== 'admin') {
        console.warn('[Require Admin] Access denied - not an admin');
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.',
        });
    }
    
    console.log('[Require Admin] Admin access granted');
    next();
};

export const requireClient = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    if (req.userRole !== 'client') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Client privileges required.',
        });
    }
    next();
};

export const generateToken = (userId: string, email: string, role: 'admin' | 'client'): string => {
    const payload: JWTPayload = {
        userId,
        email,
        role,
    };
    
    console.log('[generateToken] Creating token for:', { userId, email, role });
    
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
    });
};