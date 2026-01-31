/**
 * User Login Handler
 * POST /api/auth/login
 */

import { comparePassword, generateAccessToken, generateRefreshToken, corsHeaders, successResponse, errorResponse } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { validate, schemas, sanitizeObject } from './utils/validation.js';

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
        const sanitized = sanitizeObject(body);
        const validation = validate(sanitized, schemas.login);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => e.message).join(', '));
        }
        
        const { email, password } = validation.value;
        const sql = getDb();
        
        // Find user
        const [user] = await sql`
            SELECT id, email, password_hash, is_premium, premium_purchased_at, created_at
            FROM users 
            WHERE email = ${email} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('Invalid email or password', 401);
        }
        
        // Verify password
        const isValidPassword = await comparePassword(password, user.password_hash);
        
        if (!isValidPassword) {
            return errorResponse('Invalid email or password', 401);
        }
        
        // Generate tokens
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        
        // Get preset categories
        const categories = await sql`
            SELECT id, name, color, icon FROM categories WHERE is_preset = TRUE
        `;
        
        // Get user's custom categories
        const customCategories = await sql`
            SELECT id, name, color, icon 
            FROM categories 
            WHERE user_id = ${user.id}
        `;
        
        return successResponse({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                isPremium: user.is_premium,
                premiumPurchasedAt: user.premium_purchased_at,
                createdAt: user.created_at
            },
            categories: [...categories, ...customCategories].map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                icon: c.icon
            })),
            tokens: {
                accessToken,
                refreshToken
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Internal server error', 500);
    }
};
