import { Router } from 'express';
import {
    getAllUsers,
    getMyActivatedPackages,
    getMyProfile,
    getClientDashboardDetails,
    // New Admin Management imports
    getAllAdmins,
    addAdminUser,
    revokeAdminAccess,
} from '../controllers/user.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router: Router = Router();

// ===== Client Routes =====
// Get current user's profile
router.get('/me', authenticateToken, getMyProfile);

// Get current user's activated packages
router.get('/me/packages', authenticateToken, getMyActivatedPackages);

// ===== Admin Routes (Client Management) =====
// Get all users
router.get('/', authenticateToken, requireAdmin, getAllUsers);

router.get('/dashboard/:email', authenticateToken, requireAdmin, getClientDashboardDetails);

// ===================================================
// NEW: Admin Management (Access Control) Routes
// These routes are nested under /users/admin
// ===================================================
const adminManagementRouter = Router();
adminManagementRouter.use(authenticateToken, requireAdmin); 

// GET /api/users/admin/list - Get all admins (excluding self)
adminManagementRouter.get('/list', getAllAdmins);

// POST /api/users/admin/add - Create/update admin user and set permissions
adminManagementRouter.post('/add', addAdminUser);

// DELETE /api/users/admin/:userId - Revoke admin access
adminManagementRouter.delete('/:userId', revokeAdminAccess);

// Attach the new admin management sub-router
router.use('/admin', adminManagementRouter);

export default router;