import { Router } from 'express';
import {
    getAllUsers,
    getMyActivatedPackages,
    getMyProfile,
    getClientDashboardDetails,
    getAllAdmins,
    addAdminUser,
    revokeAdminAccess,
} from '../controllers/user.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router: Router = Router();


router.get('/me', authenticateToken, getMyProfile);

router.get('/me/packages', authenticateToken, getMyActivatedPackages);

router.get('/', authenticateToken, requireAdmin, getAllUsers);

router.get('/dashboard/:email', authenticateToken, requireAdmin, getClientDashboardDetails);

const adminManagementRouter = Router();
adminManagementRouter.use(authenticateToken, requireAdmin); 

adminManagementRouter.get('/list', getAllAdmins);
adminManagementRouter.post('/add', addAdminUser);
adminManagementRouter.delete('/:userId', revokeAdminAccess);
router.use('/admin', adminManagementRouter);

export default router;