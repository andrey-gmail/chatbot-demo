'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Sparkles, Shield, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useCreateChat } from '@/hooks/use-chats';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const createChat = useCreateChat();

  // Redirect authenticated users to a new chat
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      createChat.mutateAsync(undefined).then((chat) => {
        router.replace(`/${chat.id}`);
      }).catch(() => {
        // Fallback — stay on page
      });
    }
    // Only run on auth state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  // Show nothing while checking auth or redirecting
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleTryAnonymous = () => {
    createChat.mutateAsync(undefined).then((chat) => {
      router.push(`/${chat.id}`);
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Chatbot</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Powered by OpenAI
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Your AI conversation partner
          </h1>

          <p className="mb-8 text-lg text-muted-foreground">
            Chat with an intelligent assistant that understands context, analyzes
            documents, and supports image attachments. Try it free — no account
            required.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={handleTryAnonymous}
              disabled={createChat.isPending}
            >
              Try without signing up
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-20 grid max-w-3xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-medium">Streaming responses</h3>
            <p className="text-sm text-muted-foreground">
              See answers appear in real time as the AI thinks through your
              questions.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-medium">Document context</h3>
            <p className="text-sm text-muted-foreground">
              Upload PDFs, text files, or markdown and ask questions about their
              content.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-1 font-medium">Image support</h3>
            <p className="text-sm text-muted-foreground">
              Paste or attach images and get AI-powered visual analysis with
              OpenAI Vision.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Built with Next.js, Supabase, and OpenAI
      </footer>
    </div>
  );
}
