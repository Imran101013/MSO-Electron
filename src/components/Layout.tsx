import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import {
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  PiggyBank,
  FileText,
  Settings,
  LogOut,
  Lock,
  Sun,
  Moon,
  DollarSign,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import MemberSearch from "@/components/MemberSearch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
}

const adminNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Budget", href: "/budget", icon: Wallet },
  { name: "Loans", href: "/loans", icon: HandCoins },
  { name: "Reserve Fund", href: "/reserve", icon: PiggyBank },
  { name: "Meetings", href: "/meetings", icon: FileText },
  { name: "PDFs", href: "/pdfs", icon: FileText },
  {
    name: "Profit Distribution",
    href: "/profit-distribution",
    icon: DollarSign,
  },
  { name: "Settings", href: "/settings", icon: Settings },
];

const memberNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Meetings", href: "/meetings", icon: FileText },
  { name: "PDFs", href: "/pdfs", icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { settings, updateSettings } = useSettings();

  const navigation = isAdmin ? adminNavigation : memberNavigation;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-14 h-14">
              <img
                src="public/MSO-Logo.png"
                alt="MSO Logo"
                className="w-14 h-14 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">
                MOGH STUDENTS ORGANISATION
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.href}>
                          <item.icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* Sidebar footer with avatar and account actions */}
          <SidebarFooter className="mt-auto">
            <div className="flex items-start gap-3 px-2 py-2">
              <div className="flex  flex-col items-start gap-2">
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/change-password")}>
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 border-b shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.fullName || user?.email || "User"}
            </span>
            <div className="ml-2">
              <Avatar>
                <AvatarFallback>
                  {(user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === "dark" ? "light" : "dark",
                })
              }
              title={`Switch to ${
                settings.theme === "dark" ? "light" : "dark"
              } mode`}>
              {settings.theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </header>
        {/* Main Content */}
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
