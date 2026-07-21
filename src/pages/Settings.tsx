import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { Settings, RotateCcw, Save, DatabaseBackup, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const settingsSchema = z.object({
  loanInterestRate: z.number({ invalid_type_error: "Required" }).min(0).max(100),
  applyLoanInterest: z.boolean(),
  membersPerPage: z.number().min(1),
  minimumNameLength: z.number().min(1),
  minimumPhoneLength: z.number().min(1),
  minimumAddressLength: z.number().min(1),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  theme: z.enum(["system", "light", "dark"]),
  timeFormat: z.enum(["12", "24"]),
  itemsPerPage: z.number().min(1),
  enableAnimations: z.boolean(),
  language: z.enum(["en", "ur"]),
  currency: z.string().min(1),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const res = await (window as any).electronAPI?.backupDatabase();
      if (res?.canceled) { /* user dismissed the save dialog */ }
      else if (res?.error) toast.error(res.error);
      else toast.success(`Backup saved to ${res.path}`);
    } catch {
      toast.error("Failed to back up database");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await (window as any).electronAPI?.restoreDatabase();
      if (res?.canceled) { /* user dismissed the file picker */ }
      else if (res?.error) toast.error(res.error);
      else {
        toast.success("Database restored. Reloading…");
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      toast.error("Failed to restore database");
    } finally {
      setRestoring(false);
    }
  };

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      loanInterestRate: settings.loanInterestRate,
      applyLoanInterest: settings.applyLoanInterest,
      membersPerPage: settings.membersPerPage,
      minimumNameLength: settings.minimumNameLength,
      minimumPhoneLength: settings.minimumPhoneLength,
      minimumAddressLength: settings.minimumAddressLength,
      dateFormat: (settings.dateFormat as SettingsForm["dateFormat"]) || "dd/MM/yyyy",
      theme: settings.theme ?? "system",
      timeFormat: settings.timeFormat ?? "12",
      itemsPerPage: settings.itemsPerPage ?? 10,
      enableAnimations: settings.enableAnimations ?? true,
      language: (settings.language === "en" || settings.language === "ur") ? settings.language : "en",
      currency: settings.currency,
    },
  });

  const { register, handleSubmit, formState: { errors, isDirty }, reset, watch, setValue } = form;
  const watchedDateFormat = watch("dateFormat");

  const syncNumber = (name: Parameters<typeof setValue>[0], value: string) => {
    const n = Number(value);
    setValue(name, isNaN(n) ? 0 : n, { shouldDirty: true });
  };

  const onSubmit = (values: SettingsForm) => {
    setSaving(true);
    try { updateSettings(values); toast.success("Settings saved"); }
    catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  };

  const onResetDefaults = () => {
    const defaults = {
      loanInterestRate: ORGANIZATION_CONFIG.LOAN_INTEREST_RATE,
      applyLoanInterest: true,
      membersPerPage: ORGANIZATION_CONFIG.MEMBERS_PER_PAGE,
      minimumNameLength: ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      minimumPhoneLength: ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH,
      minimumAddressLength: ORGANIZATION_CONFIG.MINIMUM_ADDRESS_LENGTH,
      dateFormat: ORGANIZATION_CONFIG.DATE_FORMAT as SettingsForm["dateFormat"],
      theme: (ORGANIZATION_CONFIG.THEME || "system") as SettingsForm["theme"],
      timeFormat: (ORGANIZATION_CONFIG.TIME_FORMAT || "12") as SettingsForm["timeFormat"],
      itemsPerPage: ORGANIZATION_CONFIG.ITEMS_PER_PAGE || 10,
      enableAnimations: ORGANIZATION_CONFIG.ENABLE_ANIMATIONS ?? true,
      language: (ORGANIZATION_CONFIG.LANGUAGE || "en") as SettingsForm["language"],
      currency: ORGANIZATION_CONFIG.CURRENCY,
    };
    reset(defaults, { keepDirty: false });
    updateSettings(defaults);
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground">Configure application preferences</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onResetDefaults} disabled={saving} className="gap-2 rounded-xl">
            <RotateCcw className="w-4 h-4" /> Reset Defaults
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving || !isDirty} className="gap-2 shadow-sm rounded-xl">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Loan Settings */}
        <Card className="shadow-md border-0 rounded-2xl card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              Loan Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingRow label="Loan Interest Rate (%)" error={errors.loanInterestRate?.message}>
              <Input type="text" {...register("loanInterestRate", { valueAsNumber: true })} onChange={(e) => syncNumber("loanInterestRate", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
            <SettingRow label="Apply Loan Interest" inline>
              <Switch checked={watch("applyLoanInterest")} onCheckedChange={(v) => setValue("applyLoanInterest", v, { shouldDirty: true })} />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card className="shadow-md border-0 rounded-2xl card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="w-9 h-9 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-secondary" />
              </div>
              Display Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingRow label="Date Format" error={errors.dateFormat?.message}>
              <select className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register("dateFormat")}>
                <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">Preview: {format(new Date(), watchedDateFormat ?? "dd/MM/yyyy")}</p>
            </SettingRow>
            <SettingRow label="Currency" error={errors.currency?.message}>
              <Input {...register("currency")} className="h-10 rounded-xl" />
            </SettingRow>
            <SettingRow label="Enable Animations" inline>
              <Switch checked={watch("enableAnimations")} onCheckedChange={(v) => setValue("enableAnimations", v, { shouldDirty: true })} />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Pagination Settings */}
        <Card className="shadow-md border-0 rounded-2xl card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-amber-600" />
              </div>
              Pagination
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingRow label="Members Per Page" error={errors.membersPerPage?.message}>
              <Input type="text" {...register("membersPerPage", { valueAsNumber: true })} onChange={(e) => syncNumber("membersPerPage", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
            <SettingRow label="Items Per Page" error={errors.itemsPerPage?.message}>
              <Input type="text" {...register("itemsPerPage", { valueAsNumber: true })} onChange={(e) => syncNumber("itemsPerPage", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Validation Settings */}
        <Card className="shadow-md border-0 rounded-2xl card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="w-9 h-9 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-rose-600" />
              </div>
              Validation Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SettingRow label="Min. Name Length" error={errors.minimumNameLength?.message}>
              <Input type="text" {...register("minimumNameLength", { valueAsNumber: true })} onChange={(e) => syncNumber("minimumNameLength", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
            <SettingRow label="Min. Phone Length" error={errors.minimumPhoneLength?.message}>
              <Input type="text" {...register("minimumPhoneLength", { valueAsNumber: true })} onChange={(e) => syncNumber("minimumPhoneLength", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
            <SettingRow label="Min. Address Length" error={errors.minimumAddressLength?.message}>
              <Input type="text" {...register("minimumAddressLength", { valueAsNumber: true })} onChange={(e) => syncNumber("minimumAddressLength", e.target.value)} className="h-10 rounded-xl" />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="shadow-md border-0 rounded-2xl card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <DatabaseBackup className="w-4 h-4 text-emerald-600" />
              </div>
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Since this app runs fully offline against your local database, back up regularly — there is no cloud copy of your data.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleBackup} disabled={backingUp} className="gap-2 rounded-xl">
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
                {backingUp ? "Backing up…" : "Backup Data Now"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={restoring} className="gap-2 rounded-xl text-destructive hover:text-destructive">
                    {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {restoring ? "Restoring…" : "Restore from Backup"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restore database from backup?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently overwrite all current members, loans, contributions, meetings, and every other record with the contents of the backup file you select. This cannot be undone. Make sure you have a current backup of today's data before proceeding.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestore} className="bg-destructive hover:bg-destructive/90">
                      Overwrite and Restore
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingRow({ label, children, error, inline }: { label: string; children: React.ReactNode; error?: string; inline?: boolean }) {
  return (
    <div className={cn("space-y-1.5", inline && "flex items-center justify-between space-y-0")}>
      <Label className={cn("text-sm font-medium", inline && "flex-1")}>{label}</Label>
      {!inline ? (
        <div>{children}{error && <p className="text-destructive text-xs mt-1">{error}</p>}</div>
      ) : children}
    </div>
  );
}
