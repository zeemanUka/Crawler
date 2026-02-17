'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, Link as LinkIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[]; // For citations
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your CareersNG guide. Ask me anything about career development, postgraduate studies, or job hunting in Nigeria.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Prepare conversation history for the backend
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history }),
      });

      if (!res.ok) throw new Error('Failed to fetch');

      // 2. Handle Streaming Response
      const reader = res.body?.getReader();
      const decoder = new TextEncoder();
      const textDecoder = new TextDecoder();
      
      let botContent = '';
      let sources: any[] = [];
      
      // Placeholder message for streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = textDecoder.decode(value, { stream: true });
        
        // Check for sources metadata
        let processedChunk = chunk;
        if (chunk.includes('__SOURCES__')) {
            const match = chunk.match(/__SOURCES__(.*?)__END_SOURCES__\n/);
            if (match) {
                try {
                    const data = JSON.parse(match[1]);
                    sources = data.sources;
                    // Remove the source marker from the text
                    processedChunk = chunk.replace(/__SOURCES__.*?__END_SOURCES__\n/, '');
                } catch (e) {
                    console.error("Failed to parse sources", e);
                }
            }
        }

        botContent += processedChunk;

        // Update the last message (the assistant's) with the current streaming content
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastIndex = newMsgs.length - 1;
          newMsgs[lastIndex] = { 
            ...newMsgs[lastIndex], 
            content: botContent,
            sources: sources.length > 0 ? sources : newMsgs[lastIndex].sources 
          };
          return newMsgs;
        });
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please check your connection." }]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto md:h-[85vh] lg:h-[90vh] bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl md:rounded-3xl shadow-2xl border-x md:border border-white/20 dark:border-white/5 overflow-hidden transition-all duration-500">
      
      {/* Header */}
      <div className="px-4 py-3 md:px-8 md:py-6 border-b border-gray-100 dark:border-white/5 bg-white/40 dark:bg-black/40 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between transition-colors duration-500">
        <div>
          <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent leading-tight">
            CareersNG Intelligence
          </h1>
          <p className="hidden md:block text-[11px] md:text-sm text-gray-500 dark:text-gray-400 font-medium transition-colors duration-500">Powered by 4,000+ forum discussions</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scroll-smooth custom-scrollbar transition-colors duration-500">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%] md:max-w-[80%]`}>
                <div className="flex items-center gap-2 opacity-60 text-[10px] uppercase font-bold tracking-widest px-1 transition-opacity duration-500">
                  {msg.role === 'user' ? (
                    <span className="flex items-center gap-1.5 leading-none">You <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-full transition-colors duration-500"><User size={10} className="text-blue-600 dark:text-blue-400" /></div></span>
                  ) : (
                    <span className="flex items-center gap-1.5 leading-none"><div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full transition-colors duration-500"><Bot size={10} className="text-indigo-600 dark:text-indigo-400" /></div> Career AI</span>
                  )}
                </div>
                
                <div
                  className={`relative p-4 md:p-5 rounded-2xl shadow-sm leading-relaxed transition-all duration-500 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 text-gray-800 dark:text-gray-200 rounded-tl-none'
                  }`}
                >
                  <div className={`text-sm md:text-base ${
                    msg.role === 'assistant' ? 'prose dark:prose-invert prose-sm md:prose-base max-w-none prose-p:leading-relaxed prose-li:my-0 prose-ul:my-2' : 'whitespace-pre-wrap'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 transition-colors duration-500"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-tighter mb-2 opacity-50 flex items-center gap-1 transition-opacity duration-500">
                        <LinkIcon size={10} /> Referenced Sources:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                          {msg.sources.map((src: any, i: number) => (
                              <a 
                                  key={i} 
                                  href={src.metadata.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="group flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-white/5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-500 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/30"
                              >
                                  <span className="p-1 bg-white dark:bg-zinc-800 rounded shadow-xs group-hover:scale-110 transition-all duration-500"><LinkIcon size={8} className="text-blue-500" /></span>
                                  <span className="text-[10px] font-medium truncate opacity-70 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-500">{src.metadata.title}</span>
                              </a>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex justify-start"
            >
                <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur border border-gray-100 dark:border-white/5 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3 transition-all duration-500">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium animate-pulse italic">Brewing your career advice...</span>
                </div>
            </motion.div>
        )}
        <div ref={scrollRef} className="h-4" />
      </div>

      {/* Input Area - Fixed Bottom */}
      <div className="p-4 md:p-6 bg-white/60 dark:bg-black/60 backdrop-blur-md border-t border-gray-100 dark:border-white/5 transition-colors duration-500">
        <form onSubmit={handleSubmit} className="relative flex items-center max-w-4xl mx-auto gap-2">
          <div className="relative flex-1 group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="How do I get an tech job in Nigeria?"
              className="w-full pl-6 pr-14 py-3 md:py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-500 font-medium placeholder-gray-400 text-sm md:text-base group-hover:border-blue-400/50 text-gray-800 dark:text-gray-100"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all duration-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:bg-gray-400 flex items-center justify-center overflow-hidden"
            >
              {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
              ) : (
                  <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
              )}
            </button>
          </div>
        </form>
        <div className="flex items-center justify-center gap-4 mt-3 opacity-40 transition-opacity duration-500">
            <p className="text-[10px] md:text-xs">Based on 4k+ forum threads</p>
            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
            <p className="text-[10px] md:text-xs">Verify critical info</p>
        </div>
      </div>
    </div>

  );
}
