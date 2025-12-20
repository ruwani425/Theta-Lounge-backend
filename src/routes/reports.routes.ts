import { Router } from 'express';
import { getReportsAnalytics } from '../controllers/reports.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

/**
 * GET /api/reports/analytics
 * Get comprehensive reports and analytics (Admin only)
 * Query params: dateRange (7, 30, 90)
 */
router.get('/analytics', authenticateToken, requireAdmin, getReportsAnalytics);

export default router;

