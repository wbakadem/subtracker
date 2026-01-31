/**
 * Input validation utilities using Joi
 */

import Joi from 'joi';

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Color hex validation
const colorRegex = /^#[0-9A-Fa-f]{6}$/;

// Schemas
export const schemas = {
    // Auth schemas
    register: Joi.object({
        email: Joi.string().pattern(emailRegex).required().messages({
            'string.pattern.base': 'Invalid email format',
            'any.required': 'Email is required'
        }),
        password: Joi.string().min(8).max(100).required().messages({
            'string.min': 'Password must be at least 8 characters',
            'any.required': 'Password is required'
        })
    }),
    
    login: Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    }),
    
    refreshToken: Joi.object({
        refreshToken: Joi.string().required()
    }),
    
    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).max(100).required()
    }),
    
    // Subscription schemas
    subscription: Joi.object({
        name: Joi.string().min(1).max(255).required(),
        cost: Joi.number().positive().precision(2).required(),
        currency: Joi.string().length(3).default('RUB'),
        billing_cycle: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly').required(),
        next_payment_date: Joi.date().iso().required(),
        category_id: Joi.string().uuid().allow(null),
        color: Joi.string().pattern(colorRegex).default('#6366f1'),
        icon: Joi.string().max(50).default('credit-card'),
        notes: Joi.string().max(1000).allow('').default(''),
        is_active: Joi.boolean().default(true)
    }),
    
    subscriptionUpdate: Joi.object({
        name: Joi.string().min(1).max(255),
        cost: Joi.number().positive().precision(2),
        currency: Joi.string().length(3),
        billing_cycle: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly'),
        next_payment_date: Joi.date().iso(),
        category_id: Joi.string().uuid().allow(null),
        color: Joi.string().pattern(colorRegex),
        icon: Joi.string().max(50),
        notes: Joi.string().max(1000).allow(''),
        is_active: Joi.boolean(),
        order_index: Joi.number().integer()
    }),
    
    // Category schemas
    category: Joi.object({
        name: Joi.string().min(1).max(100).required(),
        color: Joi.string().pattern(colorRegex).default('#6366f1'),
        icon: Joi.string().max(50).default('tag')
    }),
    
    // Premium payment verification
    premiumVerify: Joi.object({
        paymentUid: Joi.string().required()
    }),
    
    // UUID param
    uuid: Joi.string().uuid().required()
};

// Validation function
export function validate(data, schema) {
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
        const errors = error.details.map(d => ({
            field: d.path[0],
            message: d.message
        }));
        return { isValid: false, errors, value: null };
    }
    
    return { isValid: true, errors: null, value };
}

// Sanitize string input
export function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
}

// Sanitize object
export function sanitizeObject(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
