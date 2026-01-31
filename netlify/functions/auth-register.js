/**
 * User Registration Handler
 * POST /api/auth/register
 */

import { hashPassword, generateAccessToken, generateRefreshToken, corsHeaders, successResponse, errorResponse } from './utils/auth.js';
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
        const validation = validate(sanitized, schemas.register);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => e.message).join(', '));
        }
        
        const { email, password } = validation.value;
        const sql = getDb();
        
        // Check if user already exists
        const existingUser = await sql`
            SELECT id FROM users 
            WHERE email = ${email} AND deleted_at IS NULL
        `;
        
        if (existingUser.length > 0) {
            return errorResponse('User with this email already exists', 409);
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user
        const [user] = await sql`
            INSERT INTO users (email, password_hash)
            VALUES (${email}, ${passwordHash})
            RETURNING id, email, is_premium, created_at
        `;
        
        // Generate tokens
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        
        // Get preset categories for the user
        const categories = await sql`
            SELECT id, name, color, icon FROM categories WHERE is_preset = TRUE
        `;
        
        return successResponse({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                isPremium: user.is_premium,
                createdAt: user.created_at
            },
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                color: c.color,
                icon: c.icon
            })),
            tokens: {
                accessToken,
                refreshToken
            }
        }, 201);
        
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse('Internal server error', 500);
    }
};
