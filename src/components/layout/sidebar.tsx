'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Plus, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ChatList } from '@/components/chat/chat-list';
import { useAuth } from '@/hooks/use-auth';
import { useCreateChat } from '@/hooks/use-chats';

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const createChat = useCreateChat();

  const handleNewChat = async () => {
    try {
      const chat = await createChat.mutateAsync(undefined);
      router.push(`/${chat.id}`);
      setMobileOpen(false);
    } catch {
      toast.error('Failed to create chat');
    }
  };

  const handleLogout = () => {
    logout.mutate();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">Chats</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              disabled={createChat.isPending}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      {/* Chat List */}
      <ChatList
        onNewChat={handleNewChat}
        onChatSelect={() => setMobileOpen(false)}
      />

      {/* User Profile / Logout */}
      <Separator />
      <div className="p-4">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Log out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            <User className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile trigger button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-40 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'w-80 border-r bg-sidebar text-sidebar-foreground',
          'h-screen shrink-0'
        )}
      >
        {sidebarContent}
      </aside>
    </TooltipProvider>
  );
}
