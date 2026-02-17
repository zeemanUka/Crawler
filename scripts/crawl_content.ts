
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const THREADS_FILE = path.join(process.cwd(), 'data', 'thread_urls.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'threads_content.json');
const DELAY_MS = 500; // 500ms delay

// Helper to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ThreadLink {
    url: string;
    title: string;
    forumId: string;
    forumName: string;
}

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

async function start() {
    if (!fs.existsSync(THREADS_FILE)) {
        console.error('Thread list not found!');
        return;
    }

    const threads: ThreadLink[] = JSON.parse(fs.readFileSync(THREADS_FILE, 'utf-8'));
    const total = threads.length;
    console.log(`Found ${total} threads to crawl.`);

    let results: ThreadContent[] = [];

    // Resume capability?
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Resuming from ${results.length} already crawled threads.`);
        } catch (e) {
            console.warn('Output file exists but is invalid, starting fresh.');
        }
    }

    // Filter out already crawled
    const alreadyCrawled = new Set(results.map(r => r.url));
    const threadsToCrawl = threads.filter(t => !alreadyCrawled.has(t.url));

    const limit = 50;
    const threadsToProcess = threadsToCrawl.slice(0, limit);
    console.log(`Processing first ${limit} threads for demo.`);

    for (let i = 0; i < threadsToProcess.length; i++) {
        const thread = threadsToProcess[i];
        console.log(`[${i + 1}/${limit}] Crawling: ${thread.title}`);


        try {
            const { data } = await axios.get(thread.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Crawler/1.0;)'
                }
            });
            const $ = cheerio.load(data);

            const posts: { author: string; date: string; content: string }[] = [];

            // Each post is in a table structure in subsilver2... messy.
            // But we know .postauthor and .postbody are key classes.
            // We can iterate over .tablebg (the table containing the post)
            // But checking the HTML, each post seems to be in a row or table.

            // Let's iterate over elements that *contain* .postbody to find the container
            // In subsilver2, it's roughly: 
            // tr.row1 or tr.row2 -> td -> properties

            // Simpler strategy:
            // Find all .postbody. The corresponding author is usually in the same row/table structure.
            // Let's look at the dump structure again.
            /*
            <tr class="row1">
                <td align="center" valign="middle"> ... <b class="postauthor">tofbab</b> ... </td>
                <td width="100%" height="25"> ... Posted: ... </td>
            </tr>
            <tr class="row1">
                <td ... class="profile"> ... </td>
                <td valign="top"> ... <div class="postbody"> ... </div> ... </td>
            </tr>
            */
            // It's a split row structure! Author name is in one TR, content in the NEXT TR? 
            // Or maybe headers in one TR, content in another.
            // Actually, `.postauthor` is in the first TD of the Author/Message row? 
            // Ah, looking at lines 275-289 (Author/Date header row) and 291-332 (Content row).

            // This is hard to iterate linearly with simple selectors.
            // However, phpBB pages usually alternate row1/row2 classes for posts.
            // But the structure is: Header Row -> Content Row.

            // Let's select all `.postbody` and work backwards to find date/author?
            // No, strictly structured parsing is safer.

            // We can grab all .postbody, all .postauthor, and assume they match 1:1 in order?
            // Usually yes, but sometimes guests posts might differ.
            // Let's try collecting them into arrays and zipping them.

            const bodies = $('.postbody');
            const authors = $('.postauthor');
            // Dates are harder: they are in the header row.
            // The header row is the one containing "Post subject:" 
            // Selector: `td.gensmall div[style="float: right;"]` contains "Posted: ..."

            // Let's try finding all "Posted:" strings
            const dates: string[] = [];
            $('td.gensmall div[style*="float: right"]').each((_, el) => {
                const text = $(el).text();
                // Filter for "Posted:"
                if (text.includes('Posted:')) {
                    dates.push(text.replace('Posted:', '').trim());
                }
            });

            bodies.each((idx, el) => {
                const content = $(el).text().trim();
                const author = $(authors[idx]).text().trim() || 'Anonymous';
                const date = dates[idx] || '';

                if (content) {
                    posts.push({
                        author,
                        date,
                        content
                    });
                }
            });

            if (posts.length > 0) {
                results.push({
                    url: thread.url,
                    title: thread.title,
                    forumName: thread.forumName,
                    posts
                });
            }

            // Save every 10 threads
            if (results.length % 10 === 0) {
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
            }

        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to crawl ${thread.url}:`, error.message);
            } else {
                console.error(`Failed to crawl ${thread.url}:`, error);
            }
        }
    }

    // Final save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Done! Scraped ${results.length} threads.`);
}

start();
