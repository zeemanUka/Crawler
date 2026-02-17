
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://careersng.com/forum';
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'thread_urls.json');
const DELAY_MS = 1000; // 1 second delay to be polite

// Helper to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface
interface ThreadLink {
    url: string;
    title: string;
    forumId: string;
    forumName: string;
}

async function getForumList() {
    console.log('Fetching forum index...');
    try {
        const { data } = await axios.get(`${BASE_URL}/index.php`);
        console.log(`Received ${data.length} bytes from index.php`);
        const $ = cheerio.load(data);

        let forums: { id: string; name: string }[] = [];

        // Strategy 1: The jumpbox select contains all forum IDs
        $('select[name="f"] option').each((_, el) => {
            const id = $(el).attr('value');
            const name = $(el).text().replace(/-/g, '').trim();

            if (id && id !== '-1') {
                forums.push({ id, name });
            }
        });

        // Strategy 2: Fallback to anchor tags if jumpbox is missing
        if (forums.length === 0) {
            console.log('Jumpbox not found, trying anchor links...');
            $('a[href*="viewforum.php"]').each((_, el) => {
                const href = $(el).attr('href');
                const name = $(el).text().trim();
                const match = href?.match(/[?&]f=(\d+)/);

                if (match && name) {
                    const id = match[1];
                    // Avoid duplicates
                    if (!forums.find(f => f.id === id)) {
                        forums.push({ id, name });
                    }
                }
            });
        }

        console.log(`Found ${forums.length} forums.`);
        return forums;
    } catch (error) {
        console.error('Error fetching forum index:', error);
        return [];
    }
}

async function getThreadsFromForum(forumId: string, forumName: string): Promise<ThreadLink[]> {
    let threads: ThreadLink[] = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching forum: ${forumName} (ID: ${forumId}) - start=${start}`);
        const url = `${BASE_URL}/viewforum.php?f=${forumId}&start=${start}`;

        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);

            // Find topics
            // In subsilver2, titles are usually class="topictitle"
            const topicLinks = $('a.topictitle');

            if (topicLinks.length === 0) {
                console.log('No more topics found.');
                hasMore = false;
                break;
            }

            topicLinks.each((_, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();

                if (href) {
                    // href is usually "./viewtopic.php?f=62&t=7201..."
                    // We need to resolve it to full URL
                    const cleanHref = href.replace(/^\./, '');
                    const fullUrl = `${BASE_URL}${cleanHref}`;

                    // Filter out "Moved" topics or other non-standard links if valid
                    if (fullUrl.includes('viewtopic.php')) {
                        threads.push({
                            url: fullUrl,
                            title,
                            forumId,
                            forumName
                        });
                    }
                }
            });

            // Check for "Next" page
            // Usually text "Next" inside pagination
            const nextLink = $('a:contains("Next")');
            if (nextLink.length > 0) {
                start += 50; // phpBB default is usually 25 or 50. We can just increment logic or follow link.
                // Or better: extract the 'start' param from the Next link
                const nextHref = nextLink.attr('href');
                const match = nextHref?.match(/start=(\d+)/);
                if (match) {
                    start = parseInt(match[1]);
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }

            await delay(DELAY_MS);

        } catch (error) {
            console.error(`Error fetching forum ${forumId} page ${start}:`, error);
            hasMore = false;
        }
    }
    return threads;
}

async function main() {
    const forums = await getForumList();
    let allThreads: ThreadLink[] = [];

    // Limit crawling for testing? No, user asked for "Quick fun project", but implied "all content".
    // I'll crawl first 5 forums for speed in this demo, or all if it's fast.
    // Let's do all, but handle errors gracefully.

    // For safety, let's just do the first 5 active forums to demonstrate.
    // The user might want ALL. I will try to be robust.

    for (const forum of forums) {
        const forumThreads = await getThreadsFromForum(forum.id, forum.name);
        allThreads = allThreads.concat(forumThreads);
        console.log(`Collected ${forumThreads.length} threads from ${forum.name}. Total: ${allThreads.length}`);
    }

    // Deduplicate
    const uniqueThreads = Array.from(new Map(allThreads.map(t => [t.url, t])).values());

    console.log(`Saving ${uniqueThreads.length} unique threads to ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueThreads, null, 2));
}

main();
