import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSupabase() {
    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase config missing');
        return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking Supabase connection...");

    // 1. Check document count
    const { count, error: countError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error fetching count:', countError.message);
    } else {
        console.log(`Total documents in 'documents' table: ${count}`);
    }

    // 2. Check if RPC exists
    const { data: rpcData, error: rpcError } = await supabase.rpc('match_documents', {
        query_embedding: new Array(768).fill(0),
        match_threshold: 0,
        match_count: 1,
        query_text: 'test'
    });

    if (rpcError) {
        console.error('RPC Error:', rpcError.message);
        if (rpcError.message.includes('function rpc.match_documents does not exist')) {
            console.log('CRITICAL: The match_documents function is missing!');
        }
    } else {
        console.log('RPC check successful (function exists).');
    }
}

checkSupabase();
