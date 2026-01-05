import { Router } from 'express';
import { getReportsAnalytics } from '../controllers/reports.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();


router.get('/analytics', authenticateToken, requireAdmin, getReportsAnalytics);

export default router;

