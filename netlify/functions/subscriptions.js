/**
 * Subscriptions CRUD Handler
 * /api/subscriptions/*
 */

import { requireAuth, corsHeaders, successResponse, errorResponse } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { validate, schemas, sanitizeObject } from './utils/validation.js';

// Helper to check subscription limit for free users
async function checkSubscriptionLimit(userId, sql) {
    const [user] = await sql`
        SELECT is_premium FROM users WHERE id = ${userId}
    `;
    
    if (user.is_premium) {
        return { allowed: true, current: null, limit: null };
    }
    
    const [count] = await sql`
        SELECT COUNT(*) as count 
        FROM subscriptions 
        WHERE user_id = ${userId} AND is_active = TRUE
    `;
    
    const current = parseInt(count.count);
    const limit = 5;
    
    return {
        allowed: current < limit,
        current,
        limit
    };
}

// GET /api/subscriptions - List all subscriptions
async function getSubscriptions(event) {
    try {
        const userId = event.userId;
        const sql = getDb();
        
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
                s.notes,
                s.is_active,
                s.order_index,
                s.created_at,
                c.id as category_id,
                c.name as category_name,
                c.color as category_color,
                c.icon as category_icon
            FROM subscriptions s
            LEFT JOIN categories c ON s.category_id = c.id
            WHERE s.user_id = ${userId}
            ORDER BY s.order_index ASC, s.created_at DESC
        `;
        
        const formatted = subscriptions.map(s => ({
            id: s.id,
            name: s.name,
            cost: parseFloat(s.cost),
            currency: s.currency,
            billingCycle: s.billing_cycle,
            nextPaymentDate: s.next_payment_date,
            color: s.color,
            icon: s.icon,
            notes: s.notes,
            isActive: s.is_active,
            orderIndex: s.order_index,
            createdAt: s.created_at,
            category: s.category_id ? {
                id: s.category_id,
                name: s.category_name,
                color: s.category_color,
                icon: s.category_icon
            } : null
        }));
        
        return successResponse({ subscriptions: formatted });
        
    } catch (error) {
        console.error('Get subscriptions error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// POST /api/subscriptions - Create subscription
async function createSubscription(event) {
    try {
        const userId = event.userId;
        let body;
        
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        // Check limit for free users
        const sql = getDb();
        const limitCheck = await checkSubscriptionLimit(userId, sql);
        
        if (!limitCheck.allowed) {
            return errorResponse(
                `Free tier limit reached. You can have max ${limitCheck.limit} subscriptions. Upgrade to Premium for unlimited subscriptions.`,
                403
            );
        }
        
        // Validate input
        const sanitized = sanitizeObject(body);
        const validation = validate(sanitized, schemas.subscription);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => `${e.field}: ${e.message}`).join(', '));
        }
        
        const data = validation.value;
        
        // Get max order_index
        const [maxOrder] = await sql`
            SELECT COALESCE(MAX(order_index), 0) as max_order 
            FROM subscriptions 
            WHERE user_id = ${userId}
        `;
        
        const [subscription] = await sql`
            INSERT INTO subscriptions (
                user_id, name, cost, currency, billing_cycle, 
                next_payment_date, category_id, color, icon, notes, 
                is_active, order_index
            ) VALUES (
                ${userId}, ${data.name}, ${data.cost}, ${data.currency}, 
                ${data.billing_cycle}, ${data.next_payment_date}, 
                ${data.category_id}, ${data.color}, ${data.icon}, 
                ${data.notes}, ${data.is_active}, ${maxOrder.max_order + 1}
            )
            RETURNING *
        `;
        
        return successResponse({
            message: 'Subscription created successfully',
            subscription: {
                id: subscription.id,
                name: subscription.name,
                cost: parseFloat(subscription.cost),
                currency: subscription.currency,
                billingCycle: subscription.billing_cycle,
                nextPaymentDate: subscription.next_payment_date,
                color: subscription.color,
                icon: subscription.icon,
                notes: subscription.notes,
                isActive: subscription.is_active,
                orderIndex: subscription.order_index,
                createdAt: subscription.created_at
            }
        }, 201);
        
    } catch (error) {
        console.error('Create subscription error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// PUT /api/subscriptions/:id - Update subscription
async function updateSubscription(event) {
    try {
        const userId = event.userId;
        const subscriptionId = event.path.split('/').pop();
        
        // Validate UUID
        const uuidValidation = validate(subscriptionId, schemas.uuid);
        if (!uuidValidation.isValid) {
            return errorResponse('Invalid subscription ID');
        }
        
        let body;
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        // Validate input
        const sanitized = sanitizeObject(body);
        const validation = validate(sanitized, schemas.subscriptionUpdate);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => `${e.field}: ${e.message}`).join(', '));
        }
        
        const data = validation.value;
        const sql = getDb();
        
        // Check ownership
        const [existing] = await sql`
            SELECT id FROM subscriptions 
            WHERE id = ${subscriptionId} AND user_id = ${userId}
        `;
        
        if (!existing) {
            return errorResponse('Subscription not found', 404);
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                updates.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }
        
        if (updates.length === 0) {
            return errorResponse('No fields to update');
        }
        
        values.push(subscriptionId);
        values.push(userId);
        
        const [subscription] = await sql`
            UPDATE subscriptions 
            SET ${sql.unsafe(updates.join(', '))}
            WHERE id = ${subscriptionId} AND user_id = ${userId}
            RETURNING *
        `;
        
        return successResponse({
            message: 'Subscription updated successfully',
            subscription: {
                id: subscription.id,
                name: subscription.name,
                cost: parseFloat(subscription.cost),
                currency: subscription.currency,
                billingCycle: subscription.billing_cycle,
                nextPaymentDate: subscription.next_payment_date,
                color: subscription.color,
                icon: subscription.icon,
                notes: subscription.notes,
                isActive: subscription.is_active,
                orderIndex: subscription.order_index,
                updatedAt: subscription.updated_at
            }
        });
        
    } catch (error) {
        console.error('Update subscription error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// DELETE /api/subscriptions/:id - Delete subscription
async function deleteSubscription(event) {
    try {
        const userId = event.userId;
        const subscriptionId = event.path.split('/').pop();
        
        // Validate UUID
        const uuidValidation = validate(subscriptionId, schemas.uuid);
        if (!uuidValidation.isValid) {
            return errorResponse('Invalid subscription ID');
        }
        
        const sql = getDb();
        
        // Check ownership and delete
        const [deleted] = await sql`
            DELETE FROM subscriptions 
            WHERE id = ${subscriptionId} AND user_id = ${userId}
            RETURNING id
        `;
        
        if (!deleted) {
            return errorResponse('Subscription not found', 404);
        }
        
        return successResponse({
            message: 'Subscription deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete subscription error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// PUT /api/subscriptions/:id/reorder - Reorder subscription
async function reorderSubscription(event) {
    try {
        const userId = event.userId;
        const subscriptionId = event.path.split('/')[event.path.split('/').length - 2];
        
        let body;
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        const { newIndex } = body;
        
        if (typeof newIndex !== 'number' || newIndex < 0) {
            return errorResponse('Invalid newIndex');
        }
        
        const sql = getDb();
        
        // Check ownership
        const [subscription] = await sql`
            SELECT id, order_index FROM subscriptions 
            WHERE id = ${subscriptionId} AND user_id = ${userId}
        `;
        
        if (!subscription) {
            return errorResponse('Subscription not found', 404);
        }
        
        const oldIndex = subscription.order_index;
        
        // Reorder other subscriptions
        if (oldIndex < newIndex) {
            await sql`
                UPDATE subscriptions 
                SET order_index = order_index - 1
                WHERE user_id = ${userId} 
                AND order_index > ${oldIndex} 
                AND order_index <= ${newIndex}
            `;
        } else if (oldIndex > newIndex) {
            await sql`
                UPDATE subscriptions 
                SET order_index = order_index + 1
                WHERE user_id = ${userId} 
                AND order_index >= ${newIndex} 
                AND order_index < ${oldIndex}
            `;
        }
        
        // Update the subscription's order
        await sql`
            UPDATE subscriptions 
            SET order_index = ${newIndex}
            WHERE id = ${subscriptionId}
        `;
        
        return successResponse({
            message: 'Subscription reordered successfully'
        });
        
    } catch (error) {
        console.error('Reorder subscription error:', error);
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
    const { requireAuth: checkAuth } = await import('./utils/auth.js');
    
    // Verify token manually
    const { verifyToken } = await import('./utils/auth.js');
    const decoded = verifyToken(token);
    
    if (!decoded || decoded.type !== 'access') {
        return errorResponse('Invalid or expired token', 401);
    }
    
    event.userId = decoded.userId;
    
    const path = event.path;
    const method = event.httpMethod;
    
    // Route handling
    if (path === '/api/subscriptions' || path === '/api/subscriptions/') {
        if (method === 'GET') return getSubscriptions(event);
        if (method === 'POST') return createSubscription(event);
    }
    
    if (path.match(/\/api\/subscriptions\/[^/]+\/reorder/)) {
        if (method === 'PUT') return reorderSubscription(event);
    }
    
    if (path.match(/\/api\/subscriptions\/[^/]+/)) {
        if (method === 'PUT') return updateSubscription(event);
        if (method === 'DELETE') return deleteSubscription(event);
    }
    
    return errorResponse('Not found', 404);
};
