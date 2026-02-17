import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Load .env.local explicitly
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const INPUT_FILE = path.join(process.cwd(), 'data', 'threads_content.json');

// Keys
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!geminiKey || !supabaseUrl || !supabaseKey) {
    console.error('Missing configuration. Check GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
const supabase = createClient(supabaseUrl, supabaseKey);

interface ThreadContent {
    url: string;
    title: string;
    forumName: string;
    posts: {
        author: string;
        date: string;
        content: string;
    }[];
}

const chunkText = (text: string, maxLength: number = 1000): string[] => {
    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
        if (para.length > maxLength) {
            const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > maxLength) {
                    if (currentChunk.trim()) chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += ' ' + sentence;
                }
            }
        } else {
            if (currentChunk.length + para.length > maxLength) {
                if (currentChunk.trim()) chunks.push(currentChunk.trim());
                currentChunk = para;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + para;
            }
        }
    }

    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
};

async function embedWithRetry(text: string, model: any, maxRetries = 3): Promise<number[]> {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.embedContent(text);
            return result.embedding.values;
        } catch (error: any) {
            if (error.status === 503 || error.status === 429) {
                console.warn(`Gemini API Busy (Attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
}

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error('Input file threads_content.json not found.');
        process.exit(1);
    }

    const threads: ThreadContent[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    console.log(`Loading ${threads.length} threads for embedding into Supabase.`);

    let totalEmbedded = 0;

    for (const thread of threads) {
        console.log(`Processing: ${thread.title}`);
        const rowsToInsert: any[] = [];

        for (const post of thread.posts) {
            const chunks = chunkText(post.content);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (chunk.length < 50) continue;

                const metadata = {
                    url: thread.url,
                    title: thread.title,
                    author: post.author,
                    date: post.date,
                    forum: thread.forumName,
                    chunk_index: i
                };

                const embeddingText = `Title: ${thread.title}\nAuthor: ${post.author}\nDate: ${post.date}\nForum: ${thread.forumName}\nContent: ${chunk}`;

                try {
                    const embedding = await embedWithRetry(embeddingText, model);

                    rowsToInsert.push({
                        content: chunk,
                        embedding,
                        metadata,
                        embedding_text: embeddingText
                    });

                    // Small structural delay
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.error(`Error embedding chunk for ${thread.title}:`, error);
                }
            }
        }

        if (rowsToInsert.length > 0) {
            const { error } = await supabase.from('documents').insert(rowsToInsert);

            if (error) {
                console.error('Supabase Insert Error:', error.message);
                if (error.message.includes('dimensions')) {
                    console.error('CRITICAL: Dimension mismatch. Run the ALTER TABLE command in Supabase SQL editor.');
                }
            } else {
                totalEmbedded += rowsToInsert.length;
                console.log(`Inserted ${rowsToInsert.length} chunks.`);
            }
        }
    }

    console.log(`Finished. Total chunks embedded: ${totalEmbedded}`);
}

main();
