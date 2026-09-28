import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import {
  LayoutDashboard, Users, Wallet, HandCoins, PiggyBank,
  FileText, Settings, LogOut, Lock, Sun, Moon, DollarSign, CalendarDays, History,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import MemberSearch from "@/components/MemberSearch";
import MsoMark from "@/components/MsoMark";

interface LayoutProps { children: ReactNode; }

const adminNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Budget", href: "/budget", icon: Wallet },
  { name: "Loans", href: "/loans", icon: HandCoins },
  { name: "Reserve Fund", href: "/reserve", icon: PiggyBank },
  { name: "Meetings", href: "/meetings", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Profit Distribution", href: "/profit-distribution", icon: DollarSign },
  { name: "Audit Log", href: "/audit-log", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

const memberNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Meetings", href: "/meetings", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { settings, updateSettings } = useSettings();
  const navigation = isAdmin ? adminNavigation : memberNavigation;

  const handleLogout = () => { logout(); navigate("/login"); };

  const initials = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const displayName = user?.fullName || user?.email || "User";

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border">
        {/* Letterhead mark */}
        <SidebarHeader className="px-2 py-3">
          <div className="flex items-center gap-3">
            <MsoMark className="w-12 h-12 flex-shrink-0" />
            <div className="min-w-0">
              <p className="tracked-label text-[10px] font-semibold text-sidebar-foreground/60 leading-tight uppercase">Mogh Students Org.</p>
              <p className="text-[30px] font-bold leading-tight text-sidebar-foreground tracking-tight">MSO</p>
            </div>
          </div>
        </SidebarHeader>

        <div className="mx-5 h-px bg-sidebar-border" />

        {/* Nav — counter windows, numbered like a teller grille */}
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {navigation.map((item, index) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium",
                            isActive ? "sidebar-nav-active" : "sidebar-nav-item"
                          )}
                        >
                          {/* <span className={cn("figure text-[10px] w-4 flex-shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/35")}>
                            {String(index + 1).padStart(2, "0")}
                          </span> */}
                          <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/55")} />
                          <span className={isActive ? "text-sidebar-foreground font-semibold" : ""}>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="px-3 py-3">
          <div className="h-px bg-sidebar-border mb-3" />
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm bg-sidebar-accent/50 border border-sidebar-border">
            <Avatar className="w-8 h-8 rounded-sm">
              <AvatarFallback className="rounded-sm bg-sidebar-primary/15 border border-sidebar-primary/40 text-sidebar-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground/90 truncate">{displayName}</p>
              <p className="tracked-label text-[9px] text-sidebar-foreground/45 capitalize">{user?.role}</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top header — statement letterhead */}
        <header className="flex h-16 border-b-2 border-primary/50 shrink-0 items-center gap-3 px-5 bg-card/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground rounded-sm" />
          <Separator orientation="vertical" className="h-5 opacity-40" />
          <div className="flex-1">
            <MemberSearch />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-sm"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
            >
              {settings.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <Avatar className="w-9 h-9 rounded-sm">
                <AvatarFallback className="rounded-sm bg-primary/10 border border-primary/40 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-foreground leading-tight">{displayName}</p>
                <p className="tracked-label text-[9px] text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 pl-2 border-l border-border">
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-sm"
                onClick={() => navigate("/change-password")}
                title="Change Password"
              >
                <Lock className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-sm text-destructive hover:text-destructive"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-6 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
