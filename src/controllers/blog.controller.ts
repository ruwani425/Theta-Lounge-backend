import { Request, Response } from 'express';
import BlogModel from '../models/blog.model';


export const createBlog = async (req: Request, res: Response) => {
    try {
        const { title, slug, description, content, imageUrl, author, category, tags, isActive } = req.body;

        if (!title || !slug || !description || !content || !imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        const existingBlog = await BlogModel.findOne({ slug });
        if (existingBlog) {
            return res.status(400).json({
                success: false,
                message: 'A blog with this slug already exists',
            });
        }

        const blog = await BlogModel.create({
            title,
            slug,
            description,
            content,
            imageUrl,
            author: author || 'Admin',
            category: category || 'General',
            tags: tags || [],
            isActive: isActive || false,
        });

        console.log('Blog created:', blog.title);

        res.status(201).json({
            success: true,
            message: 'Blog created successfully',
            data: blog,
        });
    } catch (error) {
        console.error('Error creating blog:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create blog',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};


export const getAllBlogsAdmin = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;

        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.max(1, parseInt(limit as string));
        const skip = (pageNum - 1) * limitNum;

        const filter: any = {};

        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const blogs = await BlogModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalCount = await BlogModel.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limitNum);

        res.status(200).json({
            success: true,
            message: 'Blogs retrieved successfully',
            data: blogs,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords: totalCount,
                limit: limitNum,
            },
        });
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch blogs',
        });
    }
};

export const getAllActiveBlogs = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, category, search } = req.query;

        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.max(1, parseInt(limit as string));
        const skip = (pageNum - 1) * limitNum;

        const filter: any = { isActive: true };

        if (category) {
            filter.category = category;
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const blogs = await BlogModel.find(filter)
            .select('-content')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const totalCount = await BlogModel.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limitNum);

        res.status(200).json({
            success: true,
            message: 'Active blogs retrieved successfully',
            data: blogs,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords: totalCount,
                limit: limitNum,
            },
        });
    } catch (error) {
        console.error('Error fetching active blogs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch blogs',
        });
    }
};

export const getBlogBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        const blog = await BlogModel.findOne({ slug, isActive: true });

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        blog.viewCount += 1;
        await blog.save();

        res.status(200).json({
            success: true,
            message: 'Blog retrieved successfully',
            data: blog,
        });
    } catch (error) {
        console.error('Error fetching blog:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch blog',
        });
    }
};

export const getBlogById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const blog = await BlogModel.findById(id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Blog retrieved successfully',
            data: blog,
        });
    } catch (error) {
        console.error('Error fetching blog:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch blog',
        });
    }
};

export const updateBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const blog = await BlogModel.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        console.log('Blog updated:', blog.title);

        res.status(200).json({
            success: true,
            message: 'Blog updated successfully',
            data: blog,
        });
    } catch (error) {
        console.error('Error updating blog:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update blog',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const deleteBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const blog = await BlogModel.findByIdAndDelete(id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        console.log('Blog deleted:', blog.title);

        res.status(200).json({
            success: true,
            message: 'Blog deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete blog',
        });
    }
};

export const toggleBlogStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const blog = await BlogModel.findById(id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: 'Blog not found',
            });
        }

        blog.isActive = !blog.isActive;
        await blog.save();

        console.log(`Blog status toggled: ${blog.title} - ${blog.isActive ? 'Active' : 'Inactive'}`);

        res.status(200).json({
            success: true,
            message: `Blog ${blog.isActive ? 'activated' : 'deactivated'} successfully`,
            data: blog,
        });
    } catch (error) {
        console.error('Error toggling blog status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle blog status',
        });
    }
};

