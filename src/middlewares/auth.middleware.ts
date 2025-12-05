import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend the Request interface to optionally store the decoded user ID
interface AuthenticatedRequest extends Request {
    userId?: string;
}

// NOTE: Replace 'YOUR_JWT_SECRET' with the actual secret key used for signing tokens.
const JWT_SECRET = 'your-super-secret-key-that-should-be-in-env'; 

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1. Check for the token in the Authorization header
    const authHeader = req.headers.authorization;
    
    // Authorization: Bearer <TOKEN>
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // 401 Unauthorized: No token provided
        return res.status(401).json({ 
            message: 'Access token required. Please log in.',
            redirectTo: '/login' // Hint for the frontend router
        });
    }

    try {
        // 2. Verify the token
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        
        // 3. Attach the user information to the request
        req.userId = decoded.userId;
        
        // 4. Proceed to the next handler/controller
        next();

    } catch (error) {
        // 403 Forbidden: Token is invalid, expired, or malformed
        return res.status(403).json({ 
            message: 'Invalid or expired token. Please log in again.',
            redirectTo: '/login'
        });
    }
};