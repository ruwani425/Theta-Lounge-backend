import { Request, Response } from 'express';
import AppointmentModel from '../models/appointment.model';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model';
import settingsModel from '../models/settings.model';

/**
 * GET /api/reports/analytics
 * Returns comprehensive analytics and reports data
 */
export const getReportsAnalytics = async (req: Request, res: Response) => {
    try {
        const { dateRange = '30' } = req.query; // 7, 30, 90 days
        const daysBack = parseInt(dateRange as string);

        console.log(`📊 [getReportsAnalytics] Fetching reports for last ${daysBack} days`);

        const now = new Date();
        const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
        const previousPeriodStart = new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
        
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        // 1. TOTAL REVENUE (Current Period)
        const currentPackages = await PackageActivationModel.find({
            status: 'Confirmed',
            createdAt: { $gte: startDate }
        }).populate('packageId', 'totalPrice');

        const currentRevenue = currentPackages.reduce((sum, activation: any) => {
            return sum + (activation.packageId?.totalPrice || 0);
        }, 0);

        // Previous period revenue for comparison
        const previousPackages = await PackageActivationModel.find({
            status: 'Confirmed',
            createdAt: { $gte: previousPeriodStart, $lt: startDate }
        }).populate('packageId', 'totalPrice');

        const previousRevenue = previousPackages.reduce((sum, activation: any) => {
            return sum + (activation.packageId?.totalPrice || 0);
        }, 0);

        const revenueGrowth = previousRevenue > 0 
            ? parseFloat((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1))
            : 0;

        // 2. BOOKINGS STATISTICS
        const currentBookings = await AppointmentModel.countDocuments({
            createdAt: { $gte: startDate },
            status: { $in: ['pending', 'completed'] }
        });

        const previousBookings = await AppointmentModel.countDocuments({
            createdAt: { $gte: previousPeriodStart, $lt: startDate },
            status: { $in: ['pending', 'completed'] }
        });

        const bookingsGrowth = previousBookings > 0 
            ? parseFloat((((currentBookings - previousBookings) / previousBookings) * 100).toFixed(1))
            : 0;

        // 3. AVERAGE SESSION VALUE
        const avgSessionValue = currentBookings > 0 
            ? Math.round(currentRevenue / currentBookings)
            : 0;

        // 4. CANCELLATION RATE
        const totalAppointments = await AppointmentModel.countDocuments({
            createdAt: { $gte: startDate }
        });

        const cancelledAppointments = await AppointmentModel.countDocuments({
            createdAt: { $gte: startDate },
            status: 'cancelled'
        });

        const cancellationRate = totalAppointments > 0 
            ? parseFloat(((cancelledAppointments / totalAppointments) * 100).toFixed(1))
            : 0;

        // 5. TOP PERFORMING PACKAGE
        const packageStats = await PackageActivationModel.aggregate([
            {
                $match: {
                    status: 'Confirmed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$packageId',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        let topPackageName = 'N/A';
        if (packageStats.length > 0) {
            const topPackage = await PackageModel.findById(packageStats[0]._id);
            topPackageName = topPackage?.name || 'N/A';
        }

        // 6. UTILIZATION RATE
        const systemSettings = await settingsModel.findOne();
        const todayFormatted = formatDate(now);
        const todayBookings = await AppointmentModel.countDocuments({
            date: todayFormatted,
            status: { $in: ['pending', 'completed'] }
        });

        const numberOfTanks = systemSettings?.numberOfTanks || 2;
        const sessionDuration = Number(systemSettings?.sessionDuration) || 60;
        const cleaningBuffer = Number(systemSettings?.cleaningBuffer) || 30;
        
        const totalMinutes = calculateTotalMinutes(
            systemSettings?.openTime || '09:00',
            systemSettings?.closeTime || '21:00'
        );
        const sessionLength = sessionDuration + cleaningBuffer;
        const sessionsPerTank = Math.floor(totalMinutes / sessionLength);
        const totalSessions = sessionsPerTank * numberOfTanks;
        
        const utilizationRate = totalSessions > 0 
            ? Math.round((todayBookings / totalSessions) * 100)
            : 0;

        // 7. WEEKLY BOOKING TRENDS (Last 4 weeks)
        const weeklyTrends = [];
        const weeksToShow = Math.min(4, Math.ceil(daysBack / 7));
        
        for (let i = weeksToShow - 1; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - (i * 7 + 7) * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            
            const bookings = await AppointmentModel.countDocuments({
                createdAt: { $gte: weekStart, $lt: weekEnd },
                status: { $in: ['pending', 'completed'] }
            });

            const weekPackages = await PackageActivationModel.find({
                status: 'Confirmed',
                createdAt: { $gte: weekStart, $lt: weekEnd }
            }).populate('packageId', 'totalPrice');

            const revenue = weekPackages.reduce((sum, activation: any) => {
                return sum + (activation.packageId?.totalPrice || 0);
            }, 0);
            
            weeklyTrends.push({
                date: `Week ${weeksToShow - i}`,
                bookings,
                revenue
            });
        }

        // 8. STATUS BREAKDOWN
        const statusCounts = await AppointmentModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusMap: Record<string, number> = {};
        let totalForPercentage = 0;
        
        statusCounts.forEach(item => {
            const status = item._id.charAt(0).toUpperCase() + item._id.slice(1);
            statusMap[status] = item.count;
            totalForPercentage += item.count;
        });

        const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({
            status,
            count,
            percentage: totalForPercentage > 0 
                ? parseFloat(((count / totalForPercentage) * 100).toFixed(1))
                : 0
        }));

        // 9. DAILY TRENDS (for the period)
        const daysToShow = Math.min(daysBack, 30); // Show max 30 days
        const dailyTrends = [];
        
        for (let i = daysToShow - 1; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayFormatted = formatDate(day);
            
            const bookings = await AppointmentModel.countDocuments({
                date: dayFormatted,
                status: { $in: ['pending', 'completed'] }
            });
            
            dailyTrends.push({
                date: dayFormatted,
                bookings
            });
        }

        // 10. TOP PACKAGES BY REVENUE
        const topPackages = await PackageActivationModel.aggregate([
            {
                $match: {
                    status: 'Confirmed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $lookup: {
                    from: 'packages',
                    localField: 'packageId',
                    foreignField: '_id',
                    as: 'package'
                }
            },
            { $unwind: '$package' },
            {
                $group: {
                    _id: '$packageId',
                    name: { $first: '$package.name' },
                    totalRevenue: { $sum: '$package.totalPrice' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 }
        ]);

        console.log('✅ [getReportsAnalytics] Reports data calculated successfully');

        res.status(200).json({
            success: true,
            message: 'Reports data retrieved successfully',
            data: {
                metrics: {
                    totalRevenue: currentRevenue,
                    revenueGrowth,
                    totalBookings: currentBookings,
                    bookingsGrowth,
                    avgSessionValue,
                    cancellationRate,
                    topPackage: topPackageName,
                    utilizationRate
                },
                bookingTrends: weeklyTrends,
                statusBreakdown,
                dailyTrends,
                topPackages,
                dateRange: {
                    start: formatDate(startDate),
                    end: formatDate(now),
                    days: daysBack
                }
            }
        });

    } catch (error) {
        console.error('❌ [getReportsAnalytics] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reports analytics',
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

