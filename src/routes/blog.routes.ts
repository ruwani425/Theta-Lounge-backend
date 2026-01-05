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

router.get('/', getAllActiveBlogs); 
router.get('/:slug', getBlogBySlug); 

router.post('/', authenticateToken, requireAdmin, createBlog); 
router.get('/admin/all', authenticateToken, requireAdmin, getAllBlogsAdmin); 
router.get('/admin/:id', authenticateToken, requireAdmin, getBlogById); 
router.put('/:id', authenticateToken, requireAdmin, updateBlog); 
router.delete('/:id', authenticateToken, requireAdmin, deleteBlog); 
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, toggleBlogStatus); 

export default router;

