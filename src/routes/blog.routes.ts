import { Router } from 'express';
import {
    createBlog,
    getAllBlogsAdmin,
    getAllActiveBlogs,
    getBlogBySlug,
    getBlogById,
    updateBlog,
    deleteBlog,
    toggleBlogStatus,
} from '../controllers/blog.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get('/', getAllActiveBlogs); // Get all active blogs for clients
router.get('/:slug', getBlogBySlug); // Get single blog by slug

// Admin routes
router.post('/', authenticateToken, requireAdmin, createBlog); // Create blog
router.get('/admin/all', authenticateToken, requireAdmin, getAllBlogsAdmin); // Get all blogs (admin)
router.get('/admin/:id', authenticateToken, requireAdmin, getBlogById); // Get blog by ID
router.put('/:id', authenticateToken, requireAdmin, updateBlog); // Update blog
router.delete('/:id', authenticateToken, requireAdmin, deleteBlog); // Delete blog
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, toggleBlogStatus); // Toggle status

export default router;

