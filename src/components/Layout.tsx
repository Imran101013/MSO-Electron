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

interface LayoutProps { children: ReactNode; }

const adminNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Budget", href: "/budget", icon: Wallet },
  { name: "Loans", href: "/loans", icon: HandCoins },
  { name: "Reserve Fund", href: "/reserve", icon: PiggyBank },
  { name: "Meetings", href: "/meetings", icon: CalendarDays },
  { name: "PDFs", href: "/pdfs", icon: FileText },
  { name: "Profit Distribution", href: "/profit-distribution", icon: DollarSign },
  { name: "Audit Log", href: "/audit-log", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

const memberNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Meetings", href: "/meetings", icon: CalendarDays },
  { name: "PDFs", href: "/pdfs", icon: FileText },
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
        {/* Logo */}
        <SidebarHeader className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg flex-shrink-0 ring-2 ring-white/10">
              <img src="./MSO-Logo.png" alt="MSO" className="w-7 h-7 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white/90 leading-tight tracking-wider uppercase">Mogh Students</p>
              <p className="text-[11px] font-bold leading-tight text-sidebar-primary">Organisation</p>
            </div>
          </div>
        </SidebarHeader>

        <div className="mx-4 h-px bg-white/8" />

        {/* Nav */}
        <SidebarContent className="px-3 py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                            isActive
                              ? "sidebar-nav-active"
                              : "sidebar-nav-item"
                          )}
                        >
                          <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-sidebar-foreground/60")} />
                          <span className={isActive ? "text-white font-semibold" : ""}>{item.name}</span>
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
          <div className="h-px bg-white/8 mb-3" />
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/6 border border-white/8 mb-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-primary text-white text-xs font-bold shadow-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/90 truncate">{displayName}</p>
              <p className="text-[10px] text-white/40 capitalize tracking-wide">{user?.role}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex-1 justify-start text-xs h-8 rounded-xl text-white/50 hover:text-white hover:bg-white/8">
              <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/change-password")} className="flex-1 justify-start text-xs h-8 rounded-xl text-white/50 hover:text-white hover:bg-white/8">
              <Lock className="w-3.5 h-3.5 mr-2" /> Password
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top header */}
        <header className="flex h-16 border-b border-border/60 shrink-0 items-center gap-3 px-5 bg-background/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground rounded-xl" />
          <Separator orientation="vertical" className="h-5 opacity-40" />
          <div className="flex-1">
            <MemberSearch />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
            >
              {settings.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border/60">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-gradient-primary text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-foreground leading-tight">{displayName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-6 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
