/**
 * Export Subscriptions to CSV Handler
 * GET /api/export/csv
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
        
        // Check premium status
        const [user] = await sql`
            SELECT is_premium FROM users 
            WHERE id = ${userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        if (!user.is_premium) {
            return errorResponse('Premium subscription required for export feature', 403);
        }
        
        // Get all subscriptions with category info
        const subscriptions = await sql`
            SELECT 
                s.name,
                s.cost,
                s.currency,
                s.billing_cycle,
                s.next_payment_date,
                s.notes,
                s.is_active,
                s.created_at,
                c.name as category_name
            FROM subscriptions s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.user_id = ${userId}
            ORDER BY s.created_at DESC
        `;
        
        // Generate CSV content
        const headers = ['Name', 'Cost', 'Currency', 'Billing Cycle', 'Next Payment', 'Category', 'Notes', 'Active', 'Created At'];
        
        const rows = subscriptions.map(s => [
            s.name,
            s.cost,
            s.currency,
            s.billing_cycle,
            s.next_payment_date,
            s.category_name || 'Uncategorized',
            s.notes || '',
            s.is_active ? 'Yes' : 'No',
            s.created_at
        ]);
        
        // Escape CSV values
        const escapeCsv = (value) => {
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(escapeCsv).join(','))
        ].join('\n');
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="subtracker-export-${new Date().toISOString().split('T')[0]}.csv"`
            },
            body: csvContent
        };
        
    } catch (error) {
        console.error('Export CSV error:', error);
        return errorResponse('Internal server error', 500);
    }
};
