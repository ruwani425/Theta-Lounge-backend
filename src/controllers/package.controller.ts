import { Request, Response } from 'express';
import PackageModel from '../models/package.model';
import { Package } from '../interfaces/package.interface';

import SystemSettingsModel from '../models/settings.model'; 
import { SystemSettings } from '../interfaces/setting.interface'; 

const FALLBACK_DEFAULT_FLOAT_PRICE = 15000; 

const getBaseFloatPrice = async (): Promise<number> => {
    try {
        const settings = await SystemSettingsModel.findOne().exec();
        return settings?.defaultFloatPrice ?? FALLBACK_DEFAULT_FLOAT_PRICE;
    } catch (error) {
        console.error("Error fetching base float price, using fallback:", error);
        return FALLBACK_DEFAULT_FLOAT_PRICE;
    }
};

const calculateFinalPrice = (sessions: number, pricePerSlot: number, discount: number): number => {
    if (sessions <= 0 || pricePerSlot <= 0) return 0;
    
    const originalTotal = sessions * pricePerSlot;
    const discountFactor = (100 - (discount ?? 0)) / 100;
    
    return Math.round(originalTotal * discountFactor);
};

const checkGenesisEligibility = (sessions: number): boolean => {
    const MIN_SESSIONS_FOR_ELIGIBILITY = 48;
    return sessions >= MIN_SESSIONS_FOR_ELIGIBILITY;
};

export const createPackage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, duration, sessions, discount } = req.body as Partial<Package>;

        if (!name || !duration || sessions === undefined) {
            res.status(400).json({ message: 'Missing required fields: name, duration, sessions.' });
            return;
        }

        const pricePerSlot = await getBaseFloatPrice();

        const finalDiscount = discount ?? 0;
        
        const calculatedTotalPrice = calculateFinalPrice(sessions, pricePerSlot, finalDiscount);
        const isEligible = checkGenesisEligibility(sessions);

        const newPackage: Partial<Package> = {
            name,
            duration,
            sessions,
            discount: finalDiscount,
            totalPrice: calculatedTotalPrice,
            isGenesisEligible: isEligible,
            isActive: true,
        };

        const packageDoc = new PackageModel(newPackage);
        await packageDoc.save();

        res.status(201).json({ 
            message: 'Package created successfully.', 
            data: packageDoc 
        });

    } catch (error) {
        console.error('Error creating package:', error);
        if (error instanceof Error && (error as any).code === 11000) {
            res.status(409).json({ message: 'Package name already exists.' });
            return;
        }
        res.status(500).json({ message: 'Failed to create package.', error });
    }
};

export const updatePackage = async (req: Request, res: Response): Promise<void> => {
    try {
        const packageId = req.params.id;
        const updates = req.body as Partial<Package>;

        if (updates.sessions !== undefined || updates.discount !== undefined) {
            
            const existingPackage = await PackageModel.findById(packageId);
            if (!existingPackage) {
                res.status(404).json({ message: 'Package not found.' });
                return;
            }

            const basePrice = await getBaseFloatPrice();

            const sessions = updates.sessions ?? existingPackage.sessions;
            const discount = updates.discount ?? existingPackage.discount;
            
            updates.totalPrice = calculateFinalPrice(sessions, basePrice, discount);
            updates.isGenesisEligible = checkGenesisEligibility(sessions);
        }

        delete (updates as any).pricePerSlot;


        const updatedPackage = await PackageModel.findByIdAndUpdate(
            packageId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedPackage) {
            res.status(404).json({ message: 'Package not found.' });
            return;
        }

        res.status(200).json({ 
            message: 'Package updated successfully.', 
            data: updatedPackage 
        });

    } catch (error) {
        console.error('Error updating package:', error);
        if (error instanceof Error && (error as any).code === 11000) {
            res.status(409).json({ message: 'Package name already exists.' });
            return;
        }
        res.status(500).json({ message: 'Failed to update package.', error });
    }
};

export const getPackageById = async (req: Request, res: Response): Promise<void> => {
    try {
        const packageId = req.params.id;

        const packageDoc = await PackageModel.findById(packageId);

        if (!packageDoc) {
            res.status(404).json({ message: 'Package not found.' });
            return;
        }

        res.status(200).json({ data: packageDoc });

    } catch (error) {
        console.error('Error retrieving package by ID:', error);
        res.status(500).json({ message: 'Failed to retrieve package.' });
    }
};

export const getActivePackages = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Number.parseInt(req.query.page as string) || 1
        const limit = Number.parseInt(req.query.limit as string) || 4
        const duration = req.query.duration as string

        const skip = (page - 1) * limit

        const filter: any = { isActive: true }
        if (duration) {
            filter.duration = duration
        }

        const packages = await PackageModel.find(filter).sort({ sessions: 1 }).skip(skip).limit(limit)

        const total = await PackageModel.countDocuments(filter)

        res.status(200).json({
            data: packages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        })
    } catch (error) {
        console.error("Error retrieving active packages:", error)
        res.status(500).json({ message: "Failed to retrieve active packages." })
    }
}

export const getAllPackages = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Number.parseInt(req.query.page as string) || 1
        const limit = Number.parseInt(req.query.limit as string) || 10
        const duration = req.query.duration as string

        console.log(' [getAllPackages] Request params:', { page, limit, duration });

        const skip = (page - 1) * limit

        const filter: any = {}
        if (duration) {
            filter.duration = duration
        }

        const packages = await PackageModel.find(filter).sort({ sessions: 1 }).skip(skip).limit(limit)

        const total = await PackageModel.countDocuments(filter)

        console.log('[getAllPackages] Retrieved packages:', { 
            count: packages.length, 
            total, 
            page, 
            limit,
            packageNames: packages.map(p => p.name)
        });

        res.status(200).json({
            data: packages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        })
    } catch (error) {
        console.error("Error retrieving all packages:", error)
        res.status(500).json({ message: "Failed to retrieve packages." })
    }
}