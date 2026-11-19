import { Fragment, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import {
  LayoutDashboard, Users, Wallet, HandCoins, PiggyBank, type LucideIcon,
  FileText, Settings, LogOut, KeyRound, Sun, Moon, DollarSign, CalendarDays, History,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarSeparator, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MemberSearch from "@/components/MemberSearch";
import MsoMark from "@/components/MsoMark";

interface LayoutProps { children: ReactNode; }

type NavItem = { name: string; href: string; icon: LucideIcon };

// The sidebar in three blocks, split by hairlines: home; the pages where records are entered,
// most used first, which stand out (`entry`); then the pages for viewing and occasional work.
// The labels are for screen readers only.
const navSections: { label: string; entry?: boolean; items: NavItem[] }[] = [
  {
    label: "Home",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Record entries",
    entry: true,
    items: [
      { name: "Meetings", href: "/meetings", icon: CalendarDays },
      { name: "Loans", href: "/loans", icon: HandCoins },
      { name: "Members", href: "/members", icon: Users },
      { name: "Reserve Fund", href: "/reserve", icon: PiggyBank },
    ],
  },
  {
    label: "Reports and settings",
    items: [
      {
        name: "Profit Distribution",
        href: "/profit-distribution",
        icon: DollarSign,
      },

      { name: "Budget", href: "/budget", icon: Wallet },
      { name: "Reports", href: "/reports", icon: FileText },
      { name: "Audit Log", href: "/audit-log", icon: History },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings, updateSettings } = useSettings();

  const handleLogout = () => { logout(); navigate("/login"); };

  const displayName = user?.fullName || user?.email || "User";

  return (
    <SidebarProvider>
      {/* The counter: the seal's deep navy in both themes, with its sun rising from the foot
          (index.css, [data-sidebar="sidebar"]). */}
      <Sidebar className="border-r border-sidebar-border">
        {/* Letterhead: the seal, ringed in the sun, over the name */}
        <SidebarHeader className="px-2 py-4">
          <div className="flex items-center gap-3">
            <MsoMark className="w-16 h-16 flex-shrink-0" />
            <div className="min-w-0">
              <p className="tracked-label text-[10px] font-semibold text-sidebar-foreground/60 leading-tight uppercase">
                Mogh Students Organization
              </p>
              <p className="text-[30px] font-bold leading-tight text-sidebar-foreground tracking-tight">
                MSO
              </p>
            </div>
          </div>
        </SidebarHeader>

        {/* The horizon: a hairline with the sun on it, closing the letterhead */}
        <div
          aria-hidden
          className="relative mx-4 h-px shrink-0 bg-sidebar-border"
        >
          <span className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sidebar-primary" />
        </div>

        {/* Nav: each icon in a square stamp. The entry pages have sun-outlined stamps and bright
            names, the rest dimmer names; the page you are on is a lifted navy slip with its stamp
            filled in the sun and a sun tab at the sidebar's edge. */}
        <SidebarContent className="px-3 py-4">
          {navSections.map((section, index) => (
            <Fragment key={section.label}>
              {index > 0 && <SidebarSeparator className="mx-1 my-1" />}
              <SidebarGroup className="p-0" role="group" aria-label={section.label}>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "group/nav relative h-10 gap-3 overflow-visible rounded-sm py-0 pl-1.5 pr-3 font-medium",
                              "text-sidebar-foreground/60 transition-colors duration-150",
                              section.entry && "font-semibold text-sidebar-accent-foreground",
                              "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                              // A sun wash over navy turns grey, so the slip is lifted navy edged in the sun.
                              "data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground",
                              "data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.28)] data-[active=true]:hover:bg-sidebar-accent",
                              // The sun tab, flush with the sidebar's left edge.
                              "before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary before:opacity-0 data-[active=true]:before:opacity-100",
                            )}
                          >
                            <Link to={item.href}>
                              <span
                                className={cn(
                                  "grid size-7 shrink-0 place-items-center rounded-sm border transition-colors duration-150",
                                  isActive
                                    ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                                    : section.entry
                                      ? "border-sidebar-primary/60 bg-sidebar-accent/40 text-sidebar-primary group-hover/nav:border-sidebar-primary"
                                      : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/60 group-hover/nav:border-sidebar-foreground/25 group-hover/nav:text-sidebar-accent-foreground",
                                )}
                              >
                                <item.icon className="size-[15px]" />
                              </span>
                              <span>{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </Fragment>
          ))}
        </SidebarContent>
      </Sidebar>

      {/* min-w-0: wide content (a table with many columns) scrolls inside its own box instead of
          stretching the whole page wider than the window. */}
      <SidebarInset className="min-w-0">
        {/* Top header — statement letterhead */}
        <header className="flex h-16 border-b-2 border-accent/70 shrink-0 items-center gap-3 px-5 bg-card/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground rounded-sm" />
          <Separator orientation="vertical" className="h-5 opacity-40" />
          {/* The Members page has its own search over its list, so this one is left out there. */}
          <div className="flex-1">
            {location.pathname !== "/members" && <MemberSearch />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-sm"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === "dark" ? "light" : "dark",
                })
              }
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
            >
              {settings.theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <MsoMark className="w-9 h-9 flex-shrink-0" />
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-foreground leading-tight">
                  {displayName}
                </p>
                {user?.fullName && (
                  <p className="tracked-label text-[9px] text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 pl-2 border-l border-border">
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-sm"
                onClick={() => navigate("/change-password")}
                title="Login details"
                aria-label="Login details"
              >
                <KeyRound className="w-4 h-4" />
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
        <main className="flex flex-1 flex-col gap-4 p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
