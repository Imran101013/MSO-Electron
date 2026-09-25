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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const { error } = await login(email.trim(), password);
    setIsLoading(false);
    if (error) setError(error);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — the counter, after hours */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(hsl(38_60%_70%)_1px,transparent_1px),linear-gradient(90deg,hsl(38_60%_70%)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]" />
        <MsoMark className="relative w-36 h-36 mb-8 drop-shadow-lg" />
        <h1 className="relative text-4xl font-bold text-white text-center leading-tight">
          Mogh Students<br />Organisation
        </h1>
        <p className="relative tracked-label text-primary/80 mt-3 text-center text-xs uppercase">Savings &amp; Loan Register</p>
        <p className="relative text-white/60 mt-4 text-center text-base max-w-xs">
          Manage members, finances, and meetings — all in one place.
        </p>
        <div className="relative mt-12 grid grid-cols-2 gap-3 w-full max-w-xs">
          {["Members", "Budget", "Loans", "Meetings"].map((item) => (
            <div key={item} className="border border-white/15 bg-white/[0.04] rounded-sm px-4 py-3 text-white/80 text-sm font-medium text-center">
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — the statement */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-md space-y-8 bg-card border-t-2 border-primary/70 rounded-sm shadow-lg p-8">
          <div className="text-center lg:hidden mb-2">
            <MsoMark className="w-20 h-20 mx-auto mb-3" />
          </div>

          <div>
            <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Admin Access</p>
            <h2 className="text-3xl font-bold text-foreground mt-1">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your MSO account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mso.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
