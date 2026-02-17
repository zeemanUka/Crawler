import { ChatInterface } from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center p-0 md:p-4 lg:p-8 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-gray-800 dark:text-gray-200 antialiased overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl h-full flex flex-col items-center justify-center">
        <ChatInterface />
      </div>
    </main>
  );
}

