import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Menu, Layers, ChevronDown, Flame } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { ModeToggle } from "@/components/mode-toggle";
import { LearningTimer } from "@/components/learning-timer";

interface NavbarProps {
  onSignInClick?: () => void;
  flashcardDueCount?: number;
  flashcardTotalCount?: number;
  onOpenFlashcards?: (mode: 'due' | 'all') => void;
}

export function Navbar({ onSignInClick, flashcardDueCount = 0, flashcardTotalCount = 0, onOpenFlashcards }: NavbarProps = {}) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();  // Set isLoggedOut flag first
    signOut(auth);  // Then sign out from Firebase
  };

  const isAnonymous = user?.isAnonymous ?? false;

  return (
    <header className="sticky top-0 z-50 flex items-center h-14 px-4 border-b shrink-0 glass backdrop-blur-xl bg-background/80 shadow-sm">
      <div className="flex items-center">
        <SidebarTrigger className="size-8 hover:bg-primary/10 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </SidebarTrigger>
        <span className="font-bold ml-3 text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Italian Learning
        </span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {user && !isAnonymous && (
          <span className="text-sm text-muted-foreground hidden md:block">
            👋 {user.displayName || user.email?.split('@')[0]}
          </span>
        )}
        {user && !isAnonymous && flashcardTotalCount > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="relative btn-press bg-card/50 hover:bg-card border-primary/20 hover:border-primary/40 transition-all"
              >
                <Layers className="w-4 h-4 mr-2 text-primary" />
                <span className="hidden sm:inline">Review Cards</span>
                {flashcardDueCount > 0 && (
                  <Badge 
                    className="ml-2 px-2 py-0.5 text-xs bg-gradient-to-r from-due to-due/80 text-due-foreground pulse-subtle animate-pulse"
                  >
                    {flashcardDueCount}
                  </Badge>
                )}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card min-w-[220px]">
              <DropdownMenuItem onClick={() => onOpenFlashcards?.('due')} className="cursor-pointer py-3">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Review Due Cards</span>
                  {flashcardDueCount > 0 && (
                    <Badge className="bg-due/10 text-due border-due/30">
                      {flashcardDueCount}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenFlashcards?.('hard')} className="cursor-pointer py-3">
                <div className="flex items-center gap-2 w-full">
                  <Flame className="h-4 w-4 text-due" />
                  <span className="font-medium flex-1">Review Hard Cards</span>
                  <Badge className="bg-learning/10 text-learning border-learning/30">
                    Extra
                  </Badge>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenFlashcards?.('all')} className="cursor-pointer py-3">
                <span className="font-medium">Practice All ({flashcardTotalCount})</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {user && !isAnonymous && (
          <LearningTimer variant="minimal" />
        )}
        <ModeToggle />
        {user && (
          isAnonymous ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSignInClick}
              className="btn-press"
            >
              Sign In
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="btn-press hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              Sign Out
            </Button>
          )
        )}
      </div>
    </header>
  );
} 