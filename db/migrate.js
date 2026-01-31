#!/usr/bin/env node
/**
 * Database Migration Script for SubTracker
 * Run: node db/migrate.js
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
}

async function migrate() {
    try {
        const sql = neon(DATABASE_URL);
        
        console.log('🚀 Running database migrations...\n');
        
        // Read and execute schema
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        
        // Split by semicolon and execute each statement
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
            try {
                await sql(statement + ';');
                console.log('✅ Executed:', statement.substring(0, 60) + '...');
            } catch (err) {
                // Ignore "already exists" errors
                if (err.message.includes('already exists')) {
                    console.log('⏭️  Skipped (already exists):', statement.substring(0, 40) + '...');
                } else {
                    throw err;
                }
            }
        }
        
        console.log('\n✨ Migrations completed successfully!');
        
        // Verify tables exist
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `;
        
        console.log('\n📊 Existing tables:');
        tables.forEach(t => console.log(`   - ${t.table_name}`));
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
