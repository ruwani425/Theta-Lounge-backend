import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();


router.get('/stats', authenticateToken, requireAdmin, getDashboardStats);

export default router;

