
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('API Key missing');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro", "embedding-001", "text-embedding-004"];

    for (const m of models) {
        try {
            console.log(`Testing model: ${m}`);
            const model = genAI.getGenerativeModel({ model: m });
            // Try generation or embedding based on name
            if (m.includes('embedding')) {
                await model.embedContent("test");
            } else {
                await model.generateContent("test");
            }
            console.log(`SUCCESS: ${m} is available!`);
        } catch (e: any) {
            console.log(`FAILED: ${m} - ${e.message?.split('\n')[0]}`);
        }
    }
}

listModels();
