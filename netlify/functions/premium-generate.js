/**
 * Premium QR Code Generation Handler
 * POST /api/premium/generate
 * Generates a unique payment ID for SBP QR code
 */

import { corsHeaders, successResponse, errorResponse, verifyToken } from './utils/auth.js';
import { getDb } from './utils/db.js';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }
    
    try {
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
        
        const userId = decoded.userId;
        const sql = getDb();
        
        // Check if user already has premium
        const [user] = await sql`
            SELECT is_premium FROM users 
            WHERE id = ${userId} AND deleted_at IS NULL
        `;
        
        if (!user) {
            return errorResponse('User not found', 404);
        }
        
        if (user.is_premium) {
            return errorResponse('User already has premium access', 400);
        }
        
        // Generate unique payment ID
        const paymentUid = `ST-${uuidv4().substring(0, 8).toUpperCase()}`;
        
        // Create pending premium payment record
        await sql`
            INSERT INTO premium_payments (user_id, payment_uid, amount, currency, status)
            VALUES (${userId}, ${paymentUid}, 10.00, 'RUB', 'pending')
        `;
        
        // SBP QR code data format
        // This is a simplified format - in production, you'd use proper SBP QR generation
        const sbpQrData = {
            version: '0001',
            encoding: 'UTF-8',
            merchant: 'SubTracker Premium',
            amount: '10.00',
            currency: 'RUB',
            paymentId: paymentUid,
            comment: `SubTracker Premium - ${paymentUid}`,
            // In real implementation, this would be a proper SBP URL
            qrUrl: `https://qr.nspk.ru/...?amount=1000&comment=${encodeURIComponent(paymentUid)}`
        };
        
        return successResponse({
            message: 'Payment ID generated successfully',
            payment: {
                uid: paymentUid,
                amount: 10.00,
                currency: 'RUB',
                comment: `SubTracker Premium - ${paymentUid}`,
                qrData: sbpQrData,
                // Static QR code URL for manual payment
                staticQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                    `ST00012|Name=SubTracker|PersonalAcc=40817810100001234567|BankName=Т-Банк|BIC=044525974|CorrespAcc=30101810145250000974|Purpose=SubTracker Premium ${paymentUid}|Sum=1000`
                )}`,
                instructions: [
                    '1. Откройте приложение вашего банка',
                    '2. Перейдите в раздел "Платежи по QR" или "СБП"',
                    '3. Отсканируйте QR-код или введите реквизиты вручную',
                    '4. Укажите сумму 10 ₽',
                    `5. В комментарии обязательно укажите: ${paymentUid}`,
                    '6. После оплаты нажмите "Подтвердить оплату" и введите ID платежа'
                ]
            }
        });
        
    } catch (error) {
        console.error('Premium generate error:', error);
        return errorResponse('Internal server error', 500);
    }
};
