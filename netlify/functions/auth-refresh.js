/**
 * Token Refresh Handler
 * POST /api/auth/refresh
 */

import { verifyToken, generateAccessToken, generateRefreshToken, corsHeaders, successResponse, errorResponse } from './utils/auth.js';
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
        const validation = validate(body, schemas.refreshToken);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => e.message).join(', '));
        }
        
        const { refreshToken } = validation.value;
        
        // Verify refresh token
        const decoded = verifyToken(refreshToken);
        
        if (!decoded || decoded.type !== 'refresh') {
            return errorResponse('Invalid or expired refresh token', 401);
        }
        
        const sql = getDb();
        
        // Check if user still exists and is active
        const [user] = await sql`
            SELECT id, email, is_premium 
            FROM users 
            WHERE id = ${decoded.userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        // Generate new tokens
        const newAccessToken = generateAccessToken(user.id);
        const newRefreshToken = generateRefreshToken(user.id);
        
        return successResponse({
            message: 'Token refreshed successfully',
            tokens: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        return errorResponse('Internal server error', 500);
    }
};
