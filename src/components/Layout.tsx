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
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MemberSearch from "@/components/MemberSearch";
import MsoMark from "@/components/MsoMark";

interface LayoutProps { children: ReactNode; }

type NavItem = { name: string; href: string; icon: LucideIcon };

// The sidebar in three blocks, split by thread lines: home; the pages where records are entered,
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
      {/* The binding: maroon cloth in both themes, with a cream thread line down its inner edge
          (index.css, [data-sidebar="sidebar"]). */}
      <Sidebar className="border-r border-sidebar-border">
        {/* The cover label: the seal and the name, pasted on the binding */}
        <SidebarHeader className="px-3 pb-3 pt-4">
          <div className="flex items-center gap-3 rounded-sm border border-sidebar-primary/45 bg-sidebar-accent/45 px-2.5 py-2.5 shadow-[inset_0_0_0_3px_hsl(var(--sidebar-background)/0.35)]">
            <MsoMark className="h-14 w-14 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-[30px] font-bold leading-none tracking-tight text-sidebar-accent-foreground">
                MSO
              </p>
              <p className="mt-1 text-[11px] font-medium leading-tight text-sidebar-foreground/75">
                Mogh Students Organization
              </p>
            </div>
          </div>
        </SidebarHeader>

        {/* Nav, in three blocks split by a thread line. The entry pages have bright names and
            brass icons, the rest dimmer names; the page you are on wears the brass label. */}
        <SidebarContent className="px-3 py-3">
          {navSections.map((section, index) => (
            <Fragment key={section.label}>
              {index > 0 && <div aria-hidden className="mx-2 my-2 border-t border-sidebar-thread/25" />}
              <SidebarGroup className="p-0" role="group" aria-label={section.label}>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "group/nav relative h-10 gap-3 rounded-sm px-3 py-0 text-[14px] font-medium",
                              "text-sidebar-foreground/70 transition-colors duration-150",
                              section.entry && "font-semibold text-sidebar-accent-foreground",
                              "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                              "data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground",
                              "data-[active=true]:shadow-[0_1px_0_hsl(var(--sidebar-primary-foreground)/0.35),inset_0_0_0_1px_hsl(var(--sidebar-primary-foreground)/0.12)] data-[active=true]:hover:bg-sidebar-primary",
                            )}
                          >
                            <Link to={item.href}>
                              <item.icon
                                className={cn(
                                  "size-4 shrink-0 transition-colors duration-150",
                                  isActive
                                    ? "text-sidebar-primary-foreground"
                                    : section.entry
                                      ? "text-sidebar-primary"
                                      : "text-sidebar-foreground/55 group-hover/nav:text-sidebar-accent-foreground",
                                )}
                              />
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
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-5 shadow-sm backdrop-blur-md">
          <SidebarTrigger className="-ml-1 rounded-sm text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-5 opacity-60" />
          {/* The Members page has its own search over its list, so this one is left out there. */}
          <div className="flex-1">
            {location.pathname !== "/members" && <MemberSearch />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-sm"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === "dark" ? "light" : "dark",
                })
              }
              title={`Switch to ${settings.theme === "dark" ? "light" : "dark"} mode`}
            >
              {settings.theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <MsoMark className="h-8 w-8 flex-shrink-0" />
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight text-foreground">
                  {displayName}
                </p>
                {user?.fullName && (
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 border-l border-border pl-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-sm"
                onClick={() => navigate("/change-password")}
                title="Login details"
                aria-label="Login details"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-sm text-destructive hover:text-destructive"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content. Keyed by the page, so each page settles in when it opens (turning the page). */}
        <main className="flex flex-1 flex-col bg-background p-6">
          <div key={location.pathname} className="page-turn flex flex-1 flex-col gap-4">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
