import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { searchVectors } from '@/lib/vectorStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { message, history = [] } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API key missing' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // 1. Embed query
        const embedModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
        const embeddingRes = await embedModel.embedContent(message);
        const embedding = embeddingRes.embedding.values;

        // 2. Search context (Hybrid)
        // Clean query text for search: remove all special characters that break tsquery
        const cleanQuery = message.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const contextItems = await searchVectors(embedding, 5, cleanQuery);

        // 3. Construct Context Text
        const contextText = contextItems.map(item => `---
Source: ${item.metadata.title} (${item.metadata.url})
Author: ${item.metadata.author} | Date: ${item.metadata.date}
Content: ${item.content}
---`).join('\n\n');

        // 4. Set up the Model & History (Using gemini-flash-latest which is confirmed available)
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: `You are a helpful assistant for CareersNG.com, a Nigerian career development forum.
Answer questions based ONLY on the provided forum context. If the answer is not in the context, say "I don't have information about that in the forum archives."
Identify original authors and dates for credit.
Context:
${contextText}`,
        });


        // Convert history to Gemini format & strictly ensure it starts with 'user'
        let geminiHistory: Content[] = history
            .filter((msg: any) => msg.role && msg.content) // Skip empty/corrupt messages
            .map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content.trim() }],
            }));

        // Gemini MUST start with a 'user' message. If it starts with 'model', slice it.
        if (geminiHistory.length > 0 && geminiHistory[0].role !== 'user') {
            const firstUserIndex = geminiHistory.findIndex(m => m.role === 'user');
            if (firstUserIndex !== -1) {
                geminiHistory = geminiHistory.slice(firstUserIndex);
            } else {
                geminiHistory = [];
            }
        }

        // Final safeguard: history must be in alternating user/model/user... order
        // Though gemini usually handles that if starting with user, let's keep it simple.

        const chat = model.startChat({
            history: geminiHistory,
        });

        // 5. Generate Streaming Content
        const result = await chat.sendMessageStream(message);

        // Create a ReadableStream to pipe back to the client
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                // First, send the sources so the UI can display them immediately
                const sourcesPayload = JSON.stringify({ sources: contextItems.map(item => ({ metadata: item.metadata })) });
                controller.enqueue(encoder.encode(`__SOURCES__${sourcesPayload}__END_SOURCES__\n`));

                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    controller.enqueue(encoder.encode(text));
                }
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

