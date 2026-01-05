import mongoose, { Schema, Document } from 'mongoose';

export interface IBlog extends Document {
    title: string;
    slug: string;
    description: string;
    content: string;
    imageUrl: string;
    author: string;
    category: string;
    tags: string[];
    isActive: boolean;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const BlogSchema: Schema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
        },
        imageUrl: {
            type: String,
            required: true,
        },
        author: {
            type: String,
            required: true,
            default: 'Admin',
        },
        category: {
            type: String,
            required: true,
            default: 'General',
        },
        tags: {
            type: [String],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

BlogSchema.index({ slug: 1 });

BlogSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model<IBlog>('Blog', BlogSchema);

