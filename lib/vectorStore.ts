import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface EmbeddingItem {
    id: string;
    content: string;
    metadata: {
        url: string;
        title: string;
        author: string;
        date: string;
        forum: string;
    };
    similarity: number;
}

export async function searchVectors(
    queryEmbedding: number[],
    limit: number = 5,
    queryText: string = ''
): Promise<EmbeddingItem[]> {

    // We call the RPC function we created in the SQL setup
    const { data: documents, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Adjust as needed
        match_count: limit,
        query_text: queryText
    });

    if (error) {
        console.error('Supabase Search Error:', error.message);
        return [];
    }

    return documents || [];
}

