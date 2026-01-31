/**
 * Logout Handler (client-side token removal)
 * POST /api/auth/logout
 */

import { corsHeaders, successResponse, requireAuth } from './utils/auth.js';

const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }
    
    // Tokens are stateless (JWT), so we just return success
    // Client should remove tokens from storage
    return successResponse({
        message: 'Logged out successfully'
    });
};

export { handler };
