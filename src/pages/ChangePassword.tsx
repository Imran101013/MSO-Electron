import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The one shared login (there are no roles): the name shown in the app, the username and the
 * password. Any change needs the current password; the session carries on with the new details.
 */
export default function ChangePassword() {
  const { user, updateAccount } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const name = username.trim();
  const usernameChanged = name !== (user?.email ?? "");
  const changed = usernameChanged || fullName.trim() !== (user?.fullName ?? "") || newPassword !== "";

  const problem = (): string | null => {
    if (name.length < 3 || name.length > 64 || /\s/.test(name)) return "The username must be 3 to 64 characters, with no spaces.";
    if (fullName.trim().length > 60) return "Keep the name to 60 characters or fewer.";
    if (newPassword && newPassword.length < 6) return "The new password must be at least 6 characters.";
    if (newPassword !== confirmPassword) return "The new password and its confirmation don't match.";
    if (!currentPassword) return "Enter the current password to save the changes.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = problem();
    setError(p ?? "");
    if (p) return;
    setSaving(true);
    const res = await updateAccount({ currentPassword, username: name, fullName: fullName.trim(), newPassword });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast.success("Login details saved", {
      description: usernameChanged || newPassword ? `Next time, sign in as ${name}${newPassword ? " with the new password" : ""}.` : undefined,
    });
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-accent/70 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Account</p>
            <h2 className="text-2xl font-bold text-foreground mt-1">Login details</h2>
            <p className="text-sm text-muted-foreground mt-0.5">The username and password that open MSO on this computer</p>
          </div>
        </div>
      </div>

      <Card className="rounded-sm shadow-sm border-t-2 border-t-accent max-w-3xl">
        <div className="px-5 pt-5 pb-1">
          <h3 className="text-base font-bold text-foreground">One shared login</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-[68ch]">
            MSO has no administrator: anyone who knows these details can sign in and change every record. Keep the password to the people who keep the books.
          </p>
        </div>
        <div className="px-5 pb-2">
          <Row label="Name shown in the app" help="At the top of every page. Leave blank to show the username." htmlFor="fullName">
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. MSO Treasurer" maxLength={60} disabled={saving} className="h-10 rounded-sm" />
          </Row>
          <Row label="Username" help="What you type to sign in. An email address works too; capital letters don't matter." htmlFor="username">
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              disabled={saving}
              className="h-10 rounded-sm"
            />
          </Row>
          <Row label="New password" help="At least 6 characters. Leave blank to keep the current password." htmlFor="newPassword">
            <PasswordInput id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" disabled={saving} className="h-10 rounded-sm" />
          </Row>
          <Row label="Confirm new password" htmlFor="confirmPassword">
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={saving || !newPassword}
              className="h-10 rounded-sm"
            />
          </Row>
        </div>
        <div className="flex flex-col gap-4 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 sm:w-72">
            <Label htmlFor="currentPassword" className="text-sm font-medium">Current password</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Needed to save any change"
              disabled={saving}
              className="h-10 rounded-sm bg-card"
            />
          </div>
          <Button type="submit" disabled={saving || !changed} className="gap-2 rounded-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save login details"}
          </Button>
        </div>
        {error && (
          <div className="px-5 pb-4 bg-muted/40">
            <Alert variant="destructive" className="py-2 rounded-sm">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          </div>
        )}
      </Card>
    </form>
  );
}

function Row({ label, help, htmlFor, children }: { label: string; help?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_18rem] sm:gap-6">
      <div>
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</Label>
        {help && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{help}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
