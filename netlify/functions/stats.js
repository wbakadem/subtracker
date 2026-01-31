/**
 * Statistics Handler
 * GET /api/stats
 * Returns dashboard statistics
 */

import { corsHeaders, successResponse, errorResponse, verifyToken } from './utils/auth.js';
import { getDb } from './utils/db.js';

export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    
    if (event.httpMethod !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }
    
    try {
        // Extract auth token
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse('Authentication required', 401);
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (!decoded || decoded.type !== 'access') {
            return errorResponse('Invalid or expired token', 401);
        }
        
        const userId = decoded.userId;
        const sql = getDb();
        
        // Get all active subscriptions
        const subscriptions = await sql`
            SELECT 
                s.id,
                s.name,
                s.cost,
                s.currency,
                s.billing_cycle,
                s.next_payment_date,
                s.color,
                s.icon,
                c.name as category_name,
                c.color as category_color
            FROM subscriptions s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.user_id = ${userId} AND s.is_active = TRUE
        `;
        
        // Calculate monthly cost (normalize all to monthly)
        const cycleMultipliers = {
            weekly: 4.33,
            monthly: 1,
            quarterly: 1 / 3,
            yearly: 1 / 12
        };
        
        let monthlyTotal = 0;
        let yearlyTotal = 0;
        const categoryBreakdown = {};
        const upcomingPayments = [];
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        for (const sub of subscriptions) {
            const cost = parseFloat(sub.cost);
            const monthlyCost = cost * cycleMultipliers[sub.billing_cycle];
            const yearlyCost = monthlyCost * 12;
            
            monthlyTotal += monthlyCost;
            yearlyTotal += yearlyCost;
            
            // Category breakdown
            const categoryName = sub.category_name || 'Uncategorized';
            const categoryColor = sub.category_color || '#6b7280';
            
            if (!categoryBreakdown[categoryName]) {
                categoryBreakdown[categoryName] = {
                    name: categoryName,
                    color: categoryColor,
                    monthlyCost: 0,
                    subscriptionCount: 0
                };
            }
            
            categoryBreakdown[categoryName].monthlyCost += monthlyCost;
            categoryBreakdown[categoryName].subscriptionCount += 1;
            
            // Upcoming payments (next 30 days)
            const nextPayment = new Date(sub.next_payment_date);
            if (nextPayment <= thirtyDaysFromNow) {
                upcomingPayments.push({
                    id: sub.id,
                    name: sub.name,
                    cost: cost,
                    currency: sub.currency,
                    date: sub.next_payment_date,
                    daysUntil: Math.ceil((nextPayment - today) / (1000 * 60 * 60 * 24)),
                    color: sub.color,
                    icon: sub.icon
                });
            }
        }
        
        // Sort upcoming payments by date
        upcomingPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Get payment history for trends
        const paymentHistory = await sql`
            SELECT 
                DATE_TRUNC('month', payment_date) as month,
                SUM(amount) as total
            FROM payments
            WHERE user_id = ${userId}
            AND payment_date >= ${new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString()}
            GROUP BY DATE_TRUNC('month', payment_date)
            ORDER BY month ASC
        `;
        
        const monthlyTrend = paymentHistory.map(p => ({
            month: new Date(p.month).toLocaleString('ru-RU', { month: 'short', year: 'numeric' }),
            amount: parseFloat(p.total)
        }));
        
        // Calculate subscription count
        const activeCount = subscriptions.length;
        
        // Get most expensive subscription
        let mostExpensive = null;
        if (subscriptions.length > 0) {
            const sorted = [...subscriptions].sort((a, b) => {
                const aMonthly = parseFloat(a.cost) * cycleMultipliers[a.billing_cycle];
                const bMonthly = parseFloat(b.cost) * cycleMultipliers[b.billing_cycle];
                return bMonthly - aMonthly;
            });
            mostExpensive = {
                id: sorted[0].id,
                name: sorted[0].name,
                monthlyCost: parseFloat(sorted[0].cost) * cycleMultipliers[sorted[0].billing_cycle]
            };
        }
        
        return successResponse({
            summary: {
                activeSubscriptions: activeCount,
                monthlyCost: Math.round(monthlyTotal * 100) / 100,
                yearlyCost: Math.round(yearlyTotal * 100) / 100,
                averagePerSubscription: activeCount > 0 ? Math.round((monthlyTotal / activeCount) * 100) / 100 : 0,
                mostExpensive: mostExpensive
            },
            categoryBreakdown: Object.values(categoryBreakdown).map(c => ({
                ...c,
                monthlyCost: Math.round(c.monthlyCost * 100) / 100,
                percentage: monthlyTotal > 0 ? Math.round((c.monthlyCost / monthlyTotal) * 1000) / 10 : 0
            })),
            upcomingPayments: upcomingPayments.slice(0, 10),
            monthlyTrend
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        return errorResponse('Internal server error', 500);
    }
};
