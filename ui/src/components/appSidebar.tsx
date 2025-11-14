import { 
  Home, 
  Settings, 
  FileText,
  Layers,
  MessageSquare,
  Flame,
  Brain,
  BookOpen,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  flashcardDueCount?: number;
  flashcardTotalCount?: number;
  onOpenFlashcards?: (mode: 'due' | 'all') => void;
}

export function AppSidebar({ flashcardDueCount = 0, flashcardTotalCount = 0, onOpenFlashcards }: AppSidebarProps = {}) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="sticky top-14 h-[calc(100vh-3.5rem)] z-40 border-r border-border/50">
      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Home" 
                  isActive={isActive('/')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Comprehensible Input" 
                  isActive={isActive('/comprehensible-input')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/comprehensible-input">
                    <MessageSquare className="w-4 h-4" />
                    <span>Learn Italian (i+1)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Grammar" 
                  isActive={isActive('/grammar')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/grammar">
                    <Brain className="w-4 h-4" />
                    <span>Grammar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Reading Comprehension" 
                  isActive={isActive('/reading')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/reading">
                    <BookOpen className="w-4 h-4" />
                    <span>Reading</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {flashcardTotalCount > 0 && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip="Review Due Cards" 
                      onClick={() => onOpenFlashcards?.('due')}
                      className="hover:bg-due/10 transition-all rounded-lg"
                    >
                      <Layers className="w-4 h-4 text-due" />
                      <span className="flex items-center justify-between flex-1">
                        <span>Review Due</span>
                        {flashcardDueCount > 0 && (
                          <Badge className="bg-due/10 text-due border-due/30 ml-2 pulse-subtle">
                            {flashcardDueCount}
                          </Badge>
                        )}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip="Review Hard Cards"
                      onClick={() => onOpenFlashcards?.('hard')}
                      className="hover:bg-learning/10 transition-all rounded-lg"
                    >
                      <Flame className="w-4 h-4 text-due" />
                      <span className="flex items-center justify-between flex-1">
                        <span>Hard Cards</span>
                        <Badge className="bg-learning/10 text-learning border-learning/30 ml-2">
                          Extra
                        </Badge>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      tooltip="Practice All Cards"
                      onClick={() => onOpenFlashcards?.('all')}
                      className="hover:bg-primary/10 transition-all rounded-lg"
                    >
                      <Layers className="w-4 h-4 text-primary" />
                      <span>Practice All ({flashcardTotalCount})</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Page 1" 
                  isActive={isActive('/page1')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/page1">
                    <FileText className="w-4 h-4" />
                    <span>Page 1</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  tooltip="Page 2" 
                  isActive={isActive('/page2')} 
                  asChild
                  className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
                >
                  <Link to="/page2">
                    <Layers className="w-4 h-4" />
                    <span>Page 2</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              tooltip="Settings" 
              isActive={isActive('/settings')} 
              asChild
              className="hover:bg-primary/10 transition-all rounded-lg data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-primary/10 data-[active=true]:border-primary/30"
            >
              <Link to="/settings">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
} 