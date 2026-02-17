# CareersNG Intelligence

An AI-powered chatbot for the CareersNG forum, built with Next.js, Google Gemini, and a custom vector search engine.

## Features

- **Responsive Chat Interface**: Modern, glassmorphic UI built with Tailwind CSS and Framer Motion.
- **RAG (Retrieval-Augmented Generation)**: Answers questions using real forum data as context.
- **Vector Search**: Custom in-memory vector store for fast, efficient retrieval.
- **Google Gemini Integration**: Uses `gemini-embedding-001` for vector embeddings and `gemini-flash-latest` for chat completion.

## Setup

1.  **Clone the repository** (if you haven't already).
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    Create a `.env.local` file in the root directory and add your Google Gemini API key:
    ```bash
    GOOGLE_API_KEY=your_api_key_here
    # or OPENAI_API_KEY=your_api_key_here (supported for compatibility)
    ```

## Usage

### 1. Crawl Data (Optional)
The project comes with a small sample of crawled data. To crawl more:
```bash
# Crawl thread URLs
npx tsx scripts/crawl_urls.ts

# Crawl thread content (updates data/threads_content.json)
npx tsx scripts/crawl_content.ts
```

### 2. Generate Embeddings
Before the chat can work, you must generate the vector embeddings from the crawled content:
```bash
npx tsx scripts/embed.ts
```
This will create `data/embeddings.json`.

### 3. Run the App
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to chat!

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS v4
- **AI/LLM**: Google Gemini (`gemini-flash-latest`, `gemini-embedding-001`)
- **Vector Store**: Local JSON-based vector store (Cosine Similarity)
- **Scraping**: Cheerio + Axios
