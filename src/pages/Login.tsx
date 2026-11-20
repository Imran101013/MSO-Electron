import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import MsoMark from "@/components/MsoMark";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const { error } = await login(username.trim(), password);
    setIsLoading(false);
    if (error) setError(error);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel: the ledger's cloth cover, a thread line round its edge, with the seal on its label */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-binding p-12 lg:flex lg:w-1/2">
        <div aria-hidden className="pointer-events-none absolute inset-4 rounded-sm border border-sidebar-thread/35" />
        <div className="relative flex flex-col items-center rounded-sm border border-sidebar-primary/50 bg-sidebar-accent/40 px-10 py-9 shadow-[inset_0_0_0_4px_hsl(var(--binding)/0.4)]">
          <MsoMark className="mb-6 h-32 w-32 drop-shadow-lg" />
          <h1 className="text-center text-4xl font-bold leading-tight text-binding-foreground">
            Mogh Students<br />Organisation
          </h1>
          <p className="tracked-label mt-3 text-center text-xs uppercase text-sidebar-primary">Savings &amp; Loan Register</p>
        </div>
        <p className="relative mt-6 max-w-xs text-center text-base text-binding-foreground/70">
          Manage members, finances, and meetings — all in one place.
        </p>
        <div className="relative mt-10 flex w-full max-w-xs gap-3">
          {["Members", "Budget", "Loans", "Meetings"].map((item) => (
            <div key={item} className="rounded-sm border border-binding-foreground/20 bg-binding-foreground/[0.05] px-4 py-3 text-center text-sm font-medium text-binding-foreground/85">
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — the statement */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-md space-y-8 bg-card ledger-sheet rounded-sm shadow-lg p-8">
          <div className="text-center lg:hidden mb-2">
            <MsoMark className="w-20 h-20 mx-auto mb-3" />
          </div>

          <div>
            <h2 className="text-3xl font-bold text-foreground mt-1">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your MSO account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Your username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 rounded-sm"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-2 rounded-sm">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md rounded-sm" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign In"}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
