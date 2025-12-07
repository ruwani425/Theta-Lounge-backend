import { Request, Response } from 'express';
import PackageModel from '../models/package.model';
import { Package } from '../interfaces/package.interface';

// MOCK IMPORT: Replace this with your actual SystemSettingsModel import
// Assuming SystemSettingsModel has a findOne() method to retrieve the settings
// and that SystemSettings is the interface defining the return type.
// You must ensure this path and interface are correct in your project.
import SystemSettingsModel from '../models/settings.model'; // Assuming this path
import { SystemSettings } from '../interfaces/setting.interface'; // Assuming this interface

// Fallback constant in case settings cannot be loaded
const FALLBACK_DEFAULT_FLOAT_PRICE = 15000; 

// --- Core Calculation Logic ---

/**
 * Retrieves the current default float price from system settings or uses a fallback.
 */
const getBaseFloatPrice = async (): Promise<number> => {
    try {
        const settings = await SystemSettingsModel.findOne().exec();
        // Use the fetched price, otherwise fall back to the constant value
        return settings?.defaultFloatPrice ?? FALLBACK_DEFAULT_FLOAT_PRICE;
    } catch (error) {
        console.error("Error fetching base float price, using fallback:", error);
        return FALLBACK_DEFAULT_FLOAT_PRICE;
    }
};

/**
 * Calculates the final total price based on sessions, the dynamic price per slot (base rate), and discount.
 * NOTE: pricePerSlot parameter is now implicitly the Base Float Price fetched from settings.
 */
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

// ----------------------------------------------------
// CREATE PACKAGE
// ----------------------------------------------------

export const createPackage = async (req: Request, res: Response): Promise<void> => {
    try {
        // REMOVED pricePerSlot from req.body
        const { name, duration, sessions, discount } = req.body as Partial<Package>;

        if (!name || !duration || sessions === undefined) {
            res.status(400).json({ message: 'Missing required fields: name, duration, sessions.' });
            return;
        }

        // 1. Fetch the dynamic base price
        const pricePerSlot = await getBaseFloatPrice();

        const finalDiscount = discount ?? 0;
        
        // 2. Calculate values using the fetched base price
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

// ----------------------------------------------------
// UPDATE PACKAGE
// ----------------------------------------------------

export const updatePackage = async (req: Request, res: Response): Promise<void> => {
    try {
        const packageId = req.params.id;
        const updates = req.body as Partial<Package>;

        // Check if any fields affecting price/eligibility are being updated
        if (updates.sessions !== undefined || updates.discount !== undefined) {
            
            const existingPackage = await PackageModel.findById(packageId);
            if (!existingPackage) {
                res.status(404).json({ message: 'Package not found.' });
                return;
            }

            // 1. Get the latest base price
            const basePrice = await getBaseFloatPrice();

            // Use the new sessions/discount if provided, otherwise use the existing package values
            const sessions = updates.sessions ?? existingPackage.sessions;
            const discount = updates.discount ?? existingPackage.discount;
            
            // 2. Recalculate totalPrice and eligibility using the base price
            updates.totalPrice = calculateFinalPrice(sessions, basePrice, discount);
            updates.isGenesisEligible = checkGenesisEligibility(sessions);
        }

        // REMOVED: updates.pricePerSlot is not allowed to be passed or stored.
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

// ----------------------------------------------------
// OTHER CONTROLLERS (Unchanged, but now rely on existing database structure without pricePerSlot)
// ----------------------------------------------------

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

        // Build query filter
        const filter: any = { isActive: true }
        if (duration) {
            filter.duration = duration
        }

        // Get paginated packages
        const packages = await PackageModel.find(filter).sort({ sessions: 1 }).skip(skip).limit(limit)

        // Get total count for pagination info
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

        console.log('📦 [getAllPackages] Request params:', { page, limit, duration });

        const skip = (page - 1) * limit

        // Build query filter
        const filter: any = {}
        if (duration) {
            filter.duration = duration
        }

        // Get paginated packages
        const packages = await PackageModel.find(filter).sort({ sessions: 1 }).skip(skip).limit(limit)

        // Get total count for pagination info
        const total = await PackageModel.countDocuments(filter)

        console.log('✅ [getAllPackages] Retrieved packages:', { 
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
        console.error("❌ Error retrieving all packages:", error)
        res.status(500).json({ message: "Failed to retrieve packages." })
    }
}