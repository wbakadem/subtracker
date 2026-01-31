/**
 * Premium Payment Verification Handler
 * POST /api/premium/verify
 * Verifies payment and activates premium
 */

import { corsHeaders, successResponse, errorResponse, verifyToken, generateAccessToken, generateRefreshToken } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { validate, schemas } from './utils/validation.js';

export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }
    
    try {
        let body;
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        // Validate input
        const validation = validate(body, schemas.premiumVerify);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => e.message).join(', '));
        }
        
        const { paymentUid } = validation.value;
        
        // Extract auth token (optional - allows verification without auth)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        let userId = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);
            if (decoded && decoded.type === 'access') {
                userId = decoded.userId;
            }
        }
        
        const sql = getDb();
        
        // Find the payment record
        const [payment] = await sql`
            SELECT id, user_id, status, payment_uid
            FROM premium_payments
            WHERE payment_uid = ${paymentUid}
        `;
        
        if (!payment) {
            return errorResponse('Payment not found. Please check the payment ID and try again.', 404);
        }
        
        if (payment.status === 'completed') {
            // Check if this user already has premium
            const [existingUser] = await sql`
                SELECT is_premium FROM users WHERE id = ${payment.user_id}
            `;
            
            if (existingUser && existingUser.is_premium) {
                return errorResponse('This payment has already been processed. Premium is already active.', 400);
            }
        }
        
        if (payment.status === 'cancelled') {
            return errorResponse('This payment has been cancelled.', 400);
        }
        
        // In a real implementation, you would verify the payment with your payment provider
        // For this demo, we'll simulate verification
        
        // Update payment status
        await sql`
            UPDATE premium_payments
            SET status = 'completed', paid_at = CURRENT_TIMESTAMP
            WHERE id = ${payment.id}
        `;
        
        // Activate premium for the user
        await sql`
            UPDATE users
            SET 
                is_premium = TRUE,
                premium_purchased_at = CURRENT_TIMESTAMP,
                premium_payment_id = ${paymentUid}
            WHERE id = ${payment.user_id}
        `;
        
        // Get updated user info
        const [user] = await sql`
            SELECT id, email, is_premium, premium_purchased_at
            FROM users
            WHERE id = ${payment.user_id}
        `;
        
        // Generate new tokens with premium status
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        
        return successResponse({
            message: 'Premium activated successfully!',
            user: {
                id: user.id,
                email: user.email,
                isPremium: user.is_premium,
                premiumPurchasedAt: user.premium_purchased_at
            },
            tokens: {
                accessToken,
                refreshToken
            },
            premiumFeatures: [
                'Unlimited subscriptions',
                'Export data to CSV/PDF',
                'Detailed analytics',
                'Priority support'
            ]
        });
        
    } catch (error) {
        console.error('Premium verify error:', error);
        return errorResponse('Internal server error', 500);
    }
};
