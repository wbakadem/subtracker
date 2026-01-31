/**
 * User Profile Handler
 * /api/user/profile
 * /api/user/change-password
 * /api/user/delete-account
 */

import { corsHeaders, successResponse, errorResponse, verifyToken, hashPassword, comparePassword } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { validate, schemas, sanitizeObject } from './utils/validation.js';

// GET /api/user/profile - Get user profile
async function getProfile(event) {
    try {
        const userId = event.userId;
        const sql = getDb();
        
        const [user] = await sql`
            SELECT 
                id, 
                email, 
                is_premium, 
                premium_purchased_at, 
                premium_payment_id,
                created_at
            FROM users 
            WHERE id = ${userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        // Get subscription count
        const [subCount] = await sql`
            SELECT COUNT(*) as count 
            FROM subscriptions 
            WHERE user_id = ${userId} AND is_active = TRUE
        `;
        
        // Get total spent this month
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        const [monthlySpent] = await sql`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments 
            WHERE user_id = ${userId} 
            AND payment_date >= ${currentMonth}
        `;
        
        return successResponse({
            user: {
                id: user.id,
                email: user.email,
                isPremium: user.is_premium,
                premiumPurchasedAt: user.premium_purchased_at,
                premiumPaymentId: user.premium_payment_id,
                createdAt: user.created_at
            },
            stats: {
                subscriptionCount: parseInt(subCount.count),
                monthlySpent: parseFloat(monthlySpent.total)
            }
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// PUT /api/user/change-password - Change password
async function changePassword(event) {
    try {
        const userId = event.userId;
        let body;
        
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        // Validate input
        const sanitized = sanitizeObject(body);
        const validation = validate(sanitized, schemas.changePassword);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => `${e.field}: ${e.message}`).join(', '));
        }
        
        const { currentPassword, newPassword } = validation.value;
        const sql = getDb();
        
        // Get current password hash
        const [user] = await sql`
            SELECT password_hash FROM users 
            WHERE id = ${userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password_hash);
        
        if (!isValid) {
            return errorResponse('Current password is incorrect', 401);
        }
        
        // Hash new password
        const newHash = await hashPassword(newPassword);
        
        // Update password
        await sql`
            UPDATE users 
            SET password_hash = ${newHash}
            WHERE id = ${userId}
        `;
        
        return successResponse({
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// DELETE /api/user/delete-account - Soft delete account
async function deleteAccount(event) {
    try {
        const userId = event.userId;
        let body;
        
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        const { password } = body;
        const sql = getDb();
        
        // Get user
        const [user] = await sql`
            SELECT password_hash FROM users 
            WHERE id = ${userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        // Verify password if provided
        if (password) {
            const isValid = await comparePassword(password, user.password_hash);
            if (!isValid) {
                return errorResponse('Password is incorrect', 401);
            }
        }
        
        // Soft delete - set deleted_at and archived_until (30 days from now)
        const archivedUntil = new Date();
        archivedUntil.setDate(archivedUntil.getDate() + 30);
        
        await sql`
            UPDATE users 
            SET 
                deleted_at = CURRENT_TIMESTAMP,
                archived_until = ${archivedUntil.toISOString()}
            WHERE id = ${userId}
        `;
        
        // Deactivate all subscriptions
        await sql`
            UPDATE subscriptions 
            SET is_active = FALSE
            WHERE user_id = ${userId}
        `;
        
        return successResponse({
            message: 'Account deleted successfully. Your data will be permanently removed after 30 days.',
            archivedUntil: archivedUntil.toISOString()
        });
        
    } catch (error) {
        console.error('Delete account error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// Main handler
export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    
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
    
    event.userId = decoded.userId;
    
    const path = event.path;
    const method = event.httpMethod;
    
    // Route handling
    if (path === '/api/user/profile' || path === '/api/user/profile/') {
        if (method === 'GET') return getProfile(event);
    }
    
    if (path === '/api/user/change-password' || path === '/api/user/change-password/') {
        if (method === 'PUT' || method === 'POST') return changePassword(event);
    }
    
    if (path === '/api/user/delete-account' || path === '/api/user/delete-account/') {
        if (method === 'DELETE') return deleteAccount(event);
    }
    
    return errorResponse('Not found', 404);
};
