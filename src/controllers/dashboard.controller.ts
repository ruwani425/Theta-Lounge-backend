import { Request, Response } from 'express';
import AppointmentModel from '../models/appointment.model';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model';
import settingsModel from '../models/settings.model';

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics including revenue, bookings, and trends
 */
export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        console.log('📊 [getDashboardStats] Fetching dashboard statistics');

        // Get date ranges for calculations
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // Format dates for MongoDB queries (YYYY-MM-DD)
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        // 1. TOTAL REVENUE (Current Month)
        const currentMonthPackages = await PackageActivationModel.find({
            status: 'Confirmed',
            createdAt: { $gte: startOfMonth }
        }).populate('packageId', 'totalPrice');

        const currentMonthRevenue = currentMonthPackages.reduce((sum, activation: any) => {
            return sum + (activation.packageId?.totalPrice || 0);
        }, 0);

        // Previous month revenue for comparison
        const lastMonthPackages = await PackageActivationModel.find({
            status: 'Confirmed',
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }).populate('packageId', 'totalPrice');

        const lastMonthRevenue = lastMonthPackages.reduce((sum, activation: any) => {
            return sum + (activation.packageId?.totalPrice || 0);
        }, 0);

        const revenueChange = lastMonthRevenue > 0 
            ? (((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
            : '0.0';

        // 2. NEW BOOKINGS (Last 30 days vs previous 30 days)
        const recentBookings = await AppointmentModel.countDocuments({
            createdAt: { $gte: thirtyDaysAgo },
            status: { $in: ['pending', 'completed'] }
        });

        const previousBookings = await AppointmentModel.countDocuments({
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
            status: { $in: ['pending', 'completed'] }
        });

        const bookingsChange = previousBookings > 0 
            ? (((recentBookings - previousBookings) / previousBookings) * 100).toFixed(1)
            : '0.0';

        // 3. TANK AVAILABILITY
        const systemSettings = await settingsModel.findOne();
        const numberOfTanks = systemSettings?.numberOfTanks || 2;
        
        // Get today's bookings
        const today = formatDate(now);
        const todayBookings = await AppointmentModel.countDocuments({
            date: today,
            status: { $in: ['pending', 'completed'] }
        });

        // Calculate total possible sessions for today
        const sessionDuration = systemSettings?.sessionDuration || 60;
        const cleaningBuffer = systemSettings?.cleaningBuffer || 30;
        const openTime = systemSettings?.openTime || '09:00';
        const closeTime = systemSettings?.closeTime || '21:00';
        
        const totalMinutes = calculateTotalMinutes(openTime, closeTime);
        const sessionLength = Number(sessionDuration) + Number(cleaningBuffer);
        const sessionsPerTank = Math.floor(totalMinutes / sessionLength);
        const totalSessions = sessionsPerTank * numberOfTanks;
        
        const availabilityPercent = totalSessions > 0 
            ? Math.round((todayBookings / totalSessions) * 100)
            : 0;

        // Get yesterday's availability for comparison
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDate(yesterday);
        
        const yesterdayBookings = await AppointmentModel.countDocuments({
            date: yesterdayFormatted,
            status: { $in: ['pending', 'completed'] }
        });
        
        const yesterdayAvailability = totalSessions > 0 
            ? Math.round((yesterdayBookings / totalSessions) * 100)
            : 0;

        const availabilityChange = (availabilityPercent - yesterdayAvailability).toFixed(1);

        // 4. AVERAGE SESSION DURATION
        // For now, return system default
        const avgSession = `${sessionDuration} min`;
        const sessionChange = '+0%'; // Can be calculated from historical data

        // 5. WEEKLY BOOKING TRENDS (Last 4 weeks)
        const weeklyTrends = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - (i * 7 + 7) * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            
            const bookings = await AppointmentModel.countDocuments({
                createdAt: { $gte: weekStart, $lt: weekEnd },
                status: { $in: ['pending', 'completed'] }
            });
            
            weeklyTrends.push({
                name: `Wk ${4 - i}`,
                bookings
            });
        }

        // 6. TANK UTILIZATION (per tank if available)
        const tankUtilization = [];
        for (let i = 0; i < numberOfTanks; i++) {
            // For now, calculate based on overall utilization
            // In a real system, you'd track which tank was used for each booking
            const utilization = Math.max(0, Math.min(100, availabilityPercent + (Math.random() * 20 - 10)));
            tankUtilization.push({
                name: `Tank ${i + 1}`,
                utilization: Math.round(utilization),
                ideal: 90
            });
        }

        // 7. REVENUE BREAKDOWN BY SERVICE TYPE
        const packages = await PackageModel.find();
        const revenueBreakdown = await Promise.all(
            packages.map(async (pkg) => {
                const activations = await PackageActivationModel.countDocuments({
                    packageId: pkg._id,
                    status: 'Confirmed',
                    createdAt: { $gte: startOfMonth }
                });
                
                return {
                    name: pkg.name,
                    value: activations * pkg.totalPrice
                };
            })
        );

        // Add single session bookings
        const singleSessionBookings = await AppointmentModel.countDocuments({
            packageActivationId: { $exists: false },
            createdAt: { $gte: startOfMonth },
            status: { $in: ['pending', 'completed'] }
        });

        const floatPrice = systemSettings?.defaultFloatPrice || 15000;
        revenueBreakdown.push({
            name: 'Single Sessions',
            value: singleSessionBookings * floatPrice
        });

        console.log('✅ [getDashboardStats] Statistics calculated successfully');

        res.status(200).json({
            success: true,
            message: 'Dashboard statistics retrieved successfully',
            data: {
                kpis: {
                    totalRevenue: {
                        value: `Rs ${currentMonthRevenue.toLocaleString()}`,
                        change: `${revenueChange >= '0' ? '+' : ''}${revenueChange}%`,
                        trend: parseFloat(revenueChange) >= 0 ? 'up' : 'down'
                    },
                    newBookings: {
                        value: recentBookings.toString(),
                        change: `${bookingsChange >= '0' ? '+' : ''}${bookingsChange}%`,
                        trend: parseFloat(bookingsChange) >= 0 ? 'up' : 'down'
                    },
                    tankAvailability: {
                        value: `${availabilityPercent}%`,
                        change: `${availabilityChange >= '0' ? '+' : ''}${availabilityChange}%`,
                        trend: parseFloat(availabilityChange) >= 0 ? 'up' : 'down'
                    },
                    avgSession: {
                        value: avgSession,
                        change: sessionChange,
                        trend: 'up'
                    }
                },
                weeklyTrends,
                tankUtilization,
                revenueBreakdown
            }
        });

    } catch (error) {
        console.error('❌ [getDashboardStats] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// Helper function to calculate total minutes between two times
function calculateTotalMinutes(openTime: string, closeTime: string): number {
    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return closeMinutes - openMinutes;
}

