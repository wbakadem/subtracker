/**
 * Authentication utilities
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Hash password
export async function hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
}

// Compare password with hash
export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Generate access token
export function generateAccessToken(userId) {
    return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Generate refresh token
export function generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

// Verify token
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Extract token from headers
export function extractTokenFromHeaders(headers) {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
}

// Middleware to check authentication
export function requireAuth(handler) {
    return async (event, context) => {
        const token = extractTokenFromHeaders(event.headers);
        
        if (!token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Authentication required' })
            };
        }
        
        const decoded = verifyToken(token);
        if (!decoded || decoded.type !== 'access') {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid or expired token' })
            };
        }
        
        // Add user info to event
        event.userId = decoded.userId;
        
        return handler(event, context);
    };
}

// CORS headers
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Success response helper
export function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(data)
    };
}

// Error response helper
export function errorResponse(message, statusCode = 400) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({ error: message })
    };
}
