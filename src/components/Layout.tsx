import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import {
  LayoutDashboard, Users, Wallet, HandCoins, PiggyBank,
  FileText, Settings, LogOut, Lock, Sun, Moon, DollarSign, CalendarDays,
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
        <SidebarHeader className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
              <img src="public/MSO-Logo.png" alt="MSO" className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-sidebar-foreground leading-tight truncate">MOGH STUDENTS</p>
              <p className="text-xs font-bold text-primary leading-tight truncate">ORGANISATION</p>
            </div>
          </div>
        </SidebarHeader>

        <Separator className="mx-4 w-auto opacity-50" />

        {/* Nav */}
        <SidebarContent className="px-2 py-3">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.name}</span>
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
        <SidebarFooter className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent mb-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex-1 justify-start text-xs h-8">
              <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/change-password")} className="flex-1 justify-start text-xs h-8">
              <Lock className="w-3.5 h-3.5 mr-2" /> Password
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top header */}
        <header className="flex h-14 border-b shrink-0 items-center gap-3 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1">
            <MemberSearch />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {displayName}
            </span>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
            >
              {settings.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
