import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import models
import Key from '../models/key.model.js';
import User from '../models/user.model.js';
import Logbook from '../models/logbook.model.js';
import { ApiKey } from '../models/apiKey.model.js';

async function verifyDepartments() {
    try {
        // Connect to MongoDB
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Define expected departments
        const expectedDepartments = [
            'Automobile',
            'Chemistry',
            'Civil',
            'CSE',
            'CSE-AIML&IOT',
            'CSE-(CyS,DS)_and_AI&DS',
            'EEE',
            'ECE',
            'EIE',
            'English',
            'MECH',
            'IT',
            'Other'
        ];

        console.log('📋 EXPECTED DEPARTMENTS:\n');
        expectedDepartments.forEach((dept, index) => {
            console.log(`${index + 1}. ${dept}`);
        });
        console.log('\n' + '='.repeat(60) + '\n');

        // Check actual departments in each collection
        const collections = [
            { name: 'Keys', model: Key },
            { name: 'Users', model: User },
            { name: 'Logbooks', model: Logbook },
            { name: 'API Keys', model: ApiKey }
        ];

        for (const collection of collections) {
            console.log(`📊 ${collection.name} Collection:`);
            try {
                const departments = await collection.model.distinct('department');
                departments.sort();
                
                const validDepts = departments.filter(d => expectedDepartments.includes(d));
                const invalidDepts = departments.filter(d => !expectedDepartments.includes(d));

                console.log(`   Total unique: ${departments.length}`);
                console.log(`   Valid: ${validDepts.length}`);
                if (validDepts.length > 0) {
                    validDepts.forEach(d => console.log(`     ✅ ${d}`));
                }
                
                if (invalidDepts.length > 0) {
                    console.log(`   Invalid (not in schema): ${invalidDepts.length}`);
                    invalidDepts.forEach(d => console.log(`     ❌ ${d}`));
                }
                console.log();
            } catch (error) {
                console.log(`   ⚠️  Error or collection empty: ${error.message}\n`);
            }
        }

        console.log('='.repeat(60));
        console.log('✅ Verification complete!');

        // Close connection
        await mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run verification
verifyDepartments();
