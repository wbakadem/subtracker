/**
 * Categories Handler
 * /api/categories/*
 */

import { corsHeaders, successResponse, errorResponse, verifyToken } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { validate, schemas, sanitizeObject } from './utils/validation.js';

// GET /api/categories - List all categories (preset + user custom)
async function getCategories(event) {
    try {
        const userId = event.userId;
        const sql = getDb();
        
        // Get preset categories
        const presetCategories = await sql`
            SELECT id, name, color, icon, is_preset
            FROM categories 
            WHERE is_preset = TRUE
        `;
        
        // Get user's custom categories
        const customCategories = await sql`
            SELECT id, name, color, icon, is_preset
            FROM categories 
            WHERE user_id = ${userId}
        `;
        
        const allCategories = [...presetCategories, ...customCategories].map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            isPreset: c.is_preset
        }));
        
        return successResponse({ categories: allCategories });
        
    } catch (error) {
        console.error('Get categories error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// POST /api/categories - Create custom category
async function createCategory(event) {
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
        const validation = validate(sanitized, schemas.category);
        
        if (!validation.isValid) {
            return errorResponse(validation.errors.map(e => `${e.field}: ${e.message}`).join(', '));
        }
        
        const data = validation.value;
        const sql = getDb();
        
        // Check if category with same name exists for this user
        const [existing] = await sql`
            SELECT id FROM categories 
            WHERE name = ${data.name} AND (user_id = ${userId} OR is_preset = TRUE)
        `;
        
        if (existing) {
            return errorResponse('Category with this name already exists', 409);
        }
        
        const [category] = await sql`
            INSERT INTO categories (user_id, name, color, icon, is_preset)
            VALUES (${userId}, ${data.name}, ${data.color}, ${data.icon}, FALSE)
            RETURNING id, name, color, icon, is_preset
        `;
        
        return successResponse({
            message: 'Category created successfully',
            category: {
                id: category.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
                isPreset: category.is_preset
            }
        }, 201);
        
    } catch (error) {
        console.error('Create category error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// PUT /api/categories/:id - Update custom category
async function updateCategory(event) {
    try {
        const userId = event.userId;
        const categoryId = event.path.split('/').pop();
        
        // Validate UUID
        const uuidValidation = validate(categoryId, schemas.uuid);
        if (!uuidValidation.isValid) {
            return errorResponse('Invalid category ID');
        }
        
        let body;
        try {
            body = JSON.parse(event.body);
        } catch {
            return errorResponse('Invalid JSON in request body');
        }
        
        const sql = getDb();
        
        // Check ownership and not preset
        const [existing] = await sql`
            SELECT id, is_preset FROM categories 
            WHERE id = ${categoryId} AND user_id = ${userId}
        `;
        
        if (!existing) {
            return errorResponse('Category not found or cannot be modified', 404);
        }
        
        if (existing.is_preset) {
            return errorResponse('Preset categories cannot be modified', 403);
        }
        
        // Build update
        const updates = [];
        const { name, color, icon } = body;
        
        if (name !== undefined) updates.push(`name = ${sql(name)}`);
        if (color !== undefined) updates.push(`color = ${sql(color)}`);
        if (icon !== undefined) updates.push(`icon = ${sql(icon)}`);
        
        if (updates.length === 0) {
            return errorResponse('No fields to update');
        }
        
        const [category] = await sql`
            UPDATE categories 
            SET ${sql.unsafe(updates.join(', '))}
            WHERE id = ${categoryId} AND user_id = ${userId}
            RETURNING id, name, color, icon, is_preset
        `;
        
        return successResponse({
            message: 'Category updated successfully',
            category: {
                id: category.id,
                name: category.name,
                color: category.color,
                icon: category.icon,
                isPreset: category.is_preset
            }
        });
        
    } catch (error) {
        console.error('Update category error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// DELETE /api/categories/:id - Delete custom category
async function deleteCategory(event) {
    try {
        const userId = event.userId;
        const categoryId = event.path.split('/').pop();
        
        // Validate UUID
        const uuidValidation = validate(categoryId, schemas.uuid);
        if (!uuidValidation.isValid) {
            return errorResponse('Invalid category ID');
        }
        
        const sql = getDb();
        
        // Check ownership and not preset
        const [existing] = await sql`
            SELECT id, is_preset FROM categories 
            WHERE id = ${categoryId} AND user_id = ${userId}
        `;
        
        if (!existing) {
            return errorResponse('Category not found', 404);
        }
        
        if (existing.is_preset) {
            return errorResponse('Preset categories cannot be deleted', 403);
        }
        
        // Update subscriptions to remove category reference
        await sql`
            UPDATE subscriptions 
            SET category_id = NULL
            WHERE category_id = ${categoryId} AND user_id = ${userId}
        `;
        
        // Delete category
        await sql`
            DELETE FROM categories 
            WHERE id = ${categoryId} AND user_id = ${userId}
        `;
        
        return successResponse({
            message: 'Category deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete category error:', error);
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
    if (path === '/api/categories' || path === '/api/categories/') {
        if (method === 'GET') return getCategories(event);
        if (method === 'POST') return createCategory(event);
    }
    
    if (path.match(/\/api\/categories\/[^/]+/)) {
        if (method === 'PUT') return updateCategory(event);
        if (method === 'DELETE') return deleteCategory(event);
    }
    
    return errorResponse('Not found', 404);
};
