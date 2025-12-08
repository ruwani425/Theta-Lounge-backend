import { Router } from 'express';
import {
    getAllUsers,
    getUserById,
    getMyActivatedPackages,
    getMyProfile,
    updateUserRole,
    getClientDashboardDetails,
} from '../controllers/user.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router: Router = Router();

// ===== Client Routes =====
// Get current user's profile
router.get('/me', authenticateToken, getMyProfile);

// Get current user's activated packages
router.get('/me/packages', authenticateToken, getMyActivatedPackages);

// ===== Admin Routes =====
// Get all users
router.get('/', authenticateToken, requireAdmin, getAllUsers);

// Get single user by ID
router.get('/:userId', authenticateToken, requireAdmin, getUserById);

// Update user role
router.patch('/:userId/role', authenticateToken, requireAdmin, updateUserRole);

router.get('/dashboard/:email', authenticateToken, requireAdmin, getClientDashboardDetails);

export default router;

