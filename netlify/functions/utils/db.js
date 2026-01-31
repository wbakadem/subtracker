/**
 * Database utility for Neon PostgreSQL
 */

import { neon } from '@neondatabase/serverless';

let sqlInstance = null;

export function getDb() {
    if (!sqlInstance) {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        sqlInstance = neon(databaseUrl);
    }
    return sqlInstance;
}

export async function query(strings, ...values) {
    const sql = getDb();
    try {
        return await sql(strings, ...values);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Helper for transactions
export async function transaction(queries) {
    const sql = getDb();
    const results = [];
    
    try {
        await sql('BEGIN');
        
        for (const q of queries) {
            const result = await sql(q.text, q.values);
            results.push(result);
        }
        
        await sql('COMMIT');
        return results;
    } catch (error) {
        await sql('ROLLBACK');
        throw error;
    }
}
