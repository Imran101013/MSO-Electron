import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, CircleDot, DatabaseBackup, Loader2, RotateCcw, Save, Settings, Undo2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { DEFAULT_SETTINGS, useSettings, type Settings as AppSettings } from "@/contexts/SettingsContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { loanDueDate } from "@/utils/loanPenalty";
import { backupAge, backupDatabase, isBackupDue, restoreDatabase, useLastBackupAt } from "@/lib/backup";
import { cn, timePattern } from "@/lib/utils";
import { ClearRecordsStrip, PaperRegistersCard } from "@/components/PaperRegisters";

const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;
const DATE_FORMAT_NAMES: Record<(typeof DATE_FORMATS)[number], string> = {
  "dd/MM/yyyy": "Day / Month / Year",
  "MM/dd/yyyy": "Month / Day / Year",
  "yyyy-MM-dd": "Year - Month - Day",
};
// Read with the visible "Remind me" label: when the last backup is this old. Not a backup schedule.
const REMINDER_OPTIONS = [
  { days: 3, label: "After 3 days" },
  { days: 7, label: "After a week" },
  { days: 14, label: "After 2 weeks" },
  { days: 30, label: "After a month" },
  { days: 0, label: "Never" },
];

const percent = z
  .number({ invalid_type_error: "Enter a percentage" })
  .min(0, "Can't be below 0%")
  .max(100, "Can't be above 100%");
const rowsPerPage = z
  .number({ invalid_type_error: "Enter a number" })
  .int("Whole numbers only")
  .min(1, "At least 1")
  .max(100, "At most 100");

const settingsSchema = z.object({
  applyLoanInterest: z.boolean(),
  loanInterestRate: percent,
  latePenaltyPerMonth: z.number({ invalid_type_error: "Enter an amount" }).min(0, "Can't be negative"),
  absencePenaltyPerMeeting: z.number({ invalid_type_error: "Enter an amount" }).min(0, "Can't be negative"),
  reservePercent: percent,
  bankChargeThreshold: z.number({ invalid_type_error: "Enter an amount" }).min(0, "Can't be negative"),
  theme: z.enum(["system", "light", "dark"]),
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(["12", "24"]),
  currency: z.string().trim().min(1, "Enter a currency, e.g. PKR").max(6, "Keep it short, e.g. PKR"),
  enableAnimations: z.boolean(),
  membersPerPage: rowsPerPage,
  itemsPerPage: rowsPerPage,
  backupReminderDays: z.number().int().min(0),
});

type FormValues = z.infer<typeof settingsSchema>;

const SECTIONS: Record<string, Array<keyof FormValues>> = {
  "Money rules": ["applyLoanInterest", "loanInterestRate", "latePenaltyPerMonth", "absencePenaltyPerMeeting", "reservePercent", "bankChargeThreshold"],
  "Display & lists": ["theme", "dateFormat", "timeFormat", "currency", "enableAnimations", "membersPerPage", "itemsPerPage"],
  "Data safety": ["backupReminderDays"],
};

const toForm = (s: AppSettings): FormValues => ({
  applyLoanInterest: s.applyLoanInterest,
  loanInterestRate: s.loanInterestRate,
  latePenaltyPerMonth: s.latePenaltyPerMonth,
  absencePenaltyPerMeeting: s.absencePenaltyPerMeeting,
  reservePercent: s.reservePercent,
  bankChargeThreshold: s.bankChargeThreshold,
  theme: s.theme,
  dateFormat: (DATE_FORMATS as readonly string[]).includes(s.dateFormat) ? (s.dateFormat as FormValues["dateFormat"]) : "dd/MM/yyyy",
  timeFormat: s.timeFormat === "24" ? "24" : "12",
  currency: s.currency,
  enableAnimations: s.enableAnimations,
  membersPerPage: s.membersPerPage,
  itemsPerPage: s.itemsPerPage,
  backupReminderDays: s.backupReminderDays,
});

// Empty or non-numeric input becomes NaN so the schema reports it instead of silently saving 0.
const asNumber = (v: unknown) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => finite(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const lastBackupAt = useLastBackupAt();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(settingsSchema), defaultValues: toForm(settings) });
  const { register, control, handleSubmit, reset, watch, formState } = form;
  const { errors, dirtyFields, isDirty, isSubmitting } = formState;
  const v = watch();

  // The header's theme switch (and any other writer) changes settings while this page is open:
  // take the new saved values without discarding edits in progress.
  useEffect(() => {
    reset(toForm(settings), { keepDirtyValues: true });
  }, [settings, reset]);

  const dirtySections = Object.entries(SECTIONS)
    .filter(([, keys]) => keys.some((k) => dirtyFields[k]))
    .map(([name]) => name);
  const moneyChanged = dirtySections.includes("Money rules");

  const onSave = (values: FormValues) => {
    updateSettings(values);
    reset(values);
    toast.success("Settings saved", {
      description: moneyChanged ? "New money rules apply to loans issued and profit distributed from now on." : undefined,
    });
  };

  const onInvalid = () => toast.error("Some settings need attention", { description: "Fix the highlighted fields, then save again." });

  // Fills the form with the defaults; nothing changes until Save, so it can be reviewed or discarded.
  const fillDefaults = () => {
    reset(toForm(DEFAULT_SETTINGS), { keepDefaultValues: true });
    toast("Defaults filled in", { description: "Review them, then save, or discard to keep your current settings." });
  };

  const runBackup = async () => {
    setBackingUp(true);
    try {
      const res = await backupDatabase();
      if (res.canceled) return;
      if (res.error) toast.error("Backup failed", { description: res.error });
      else toast.success("Backup saved", { description: res.path });
    } catch {
      toast.error("Backup failed", { description: "The database could not be written to a file." });
    } finally {
      setBackingUp(false);
    }
  };

  const runRestore = async () => {
    setRestoring(true);
    try {
      const res = await restoreDatabase();
      if (res.canceled) return;
      if (res.error) toast.error("Restore failed", { description: res.error });
      else {
        toast.success("Database restored", { description: "Reloading with the restored records…" });
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      toast.error("Restore failed", { description: "The backup file could not be read." });
    } finally {
      setRestoring(false);
    }
  };

  // Worked example: the figures under the values being edited, and under the ones in force, so a
  // changed line can show the old figure struck through beside the new one. A blank or invalid
  // field gives "—" rather than a result Save would refuse.
  const cur = v.currency?.trim() || settings.currency;
  const period = ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS;
  const sampleLoan = 10000;
  const sampleAbsences = 3;
  const sampleProfit = 100000;
  const sampleDue = loanDueDate(format(new Date(), "yyyy-MM-dd"));
  const example = (apply: boolean, rateIn: number, penaltyIn: number, fineIn: number, shareIn: number) => {
    const rate = apply ? (Number.isFinite(rateIn) ? rateIn : null) : 0;
    const payable = rate === null ? null : round2(sampleLoan * (1 + rate / 100));
    const fine = Number.isFinite(fineIn) ? fineIn : null;
    const share = Number.isFinite(shareIn) ? shareIn : null;
    const reserve = share === null ? null : round2((sampleProfit * share) / 100);
    const penalty = Number.isFinite(penaltyIn) ? penaltyIn : null;
    return {
      rateLabel: rate ? `Interest at ${money(rate)}% flat` : "Interest",
      interest: rate === null || payable === null ? "—" : rate === 0 ? "none" : money(round2(payable - sampleLoan)),
      payable: payable === null ? "—" : `${cur} ${money(payable)}`,
      instalment: payable === null ? "—" : money(round2(payable / period)),
      penalty: penalty === null ? "—" : penalty > 0 ? `+${money(penalty)} / month` : "no penalty",
      penaltyCharged: (penalty ?? 0) > 0,
      fine: fine === null ? "—" : money(fine),
      absenceTaken: fine === null ? "—" : fine > 0 ? `−${money(round2(fine * sampleAbsences))}` : "nothing",
      absenceCharged: (fine ?? 0) > 0,
      shareLabel: share === null ? "—" : `${money(share)}%`,
      membersShareLabel: share === null ? "—" : `${money(100 - share)}%`,
      reserve: reserve === null ? "—" : money(reserve),
      members: reserve === null ? "—" : money(round2(sampleProfit - reserve)),
    };
  };
  const next = example(v.applyLoanInterest, v.loanInterestRate, v.latePenaltyPerMonth, v.absencePenaltyPerMeeting, v.reservePercent);
  const inForce = example(settings.applyLoanInterest, settings.loanInterestRate, settings.latePenaltyPerMonth, settings.absencePenaltyPerMeeting, settings.reservePercent);
  const shareNow = finite(v.reservePercent);
  const dateFmt = v.dateFormat || settings.dateFormat;
  const fmtDay = (key: string) => format(new Date(`${key}T00:00:00`), dateFmt);
  const now = new Date();
  const backupDue = isBackupDue(lastBackupAt, settings.backupReminderDays);
  const reminderOptions = [settings.backupReminderDays, v.backupReminderDays].reduce(
    (opts, days) => (opts.some((o) => o.days === days) ? opts : [...opts, { days, label: `After ${days} days` }]),
    REMINDER_OPTIONS,
  );
  const reminderLabel = (days: number) => reminderOptions.find((o) => o.days === days)?.label.toLowerCase() ?? `after ${days} days`;

  // "In force now" hint under a money field that has been edited.
  const was = (key: keyof FormValues, text: string, figure = true) =>
    dirtyFields[key] ? <span className="text-xs text-muted-foreground">In force now: <span className={cn(figure && "figure")}>{text}</span></span> : null;

  return (
    <form onSubmit={handleSubmit(onSave, onInvalid)} className="flex flex-col gap-6" noValidate>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-primary/40 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Configuration</p>
            <h2 className="text-2xl font-bold text-foreground mt-1">Settings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Lending rules, display preferences and backups</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={fillDefaults} className="gap-2 rounded-sm">
          <RotateCcw className="w-4 h-4" /> Reset to defaults
        </Button>
      </div>

      {/* Money rules */}
      <Card className="rounded-sm border-t-2 border-t-primary/70 shadow-sm">
        <SectionHead
          title="Money rules"
          description="Apply to loans issued and profit distributed after you save. Existing loans and past distributions keep the terms they were made with."
        />
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="divide-y divide-border px-5">
            <SettingRow
              compact
              label="Interest on new loans"
              help="A flat rate added once when a loan is issued, repaid across its instalments."
              htmlFor="loanInterestRate"
              error={errors.loanInterestRate?.message}
              hint={was("loanInterestRate", `${settings.loanInterestRate}%`) ?? was("applyLoanInterest", settings.applyLoanInterest ? "charged" : "not charged", false)}
            >
              <div className="flex items-center gap-3">
                <Controller
                  control={control}
                  name="applyLoanInterest"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Charge interest on new loans" />
                  )}
                />
                <UnitInput
                  id="loanInterestRate"
                  suffix="%"
                  inputMode="decimal"
                  disabled={!v.applyLoanInterest}
                  invalid={!!errors.loanInterestRate}
                  {...register("loanInterestRate", { setValueAs: asNumber })}
                />
              </div>
            </SettingRow>
            <SettingRow
              compact
              label="Late penalty"
              help={`Added for each full month after a loan's ${period}-month term until it is paid in full, penalties included, or the committee marks it defaulted.`}
              htmlFor="latePenaltyPerMonth"
              error={errors.latePenaltyPerMonth?.message}
              hint={was("latePenaltyPerMonth", `${settings.currency} ${money(settings.latePenaltyPerMonth)} a month`)}
            >
              <UnitInput
                id="latePenaltyPerMonth"
                prefix={cur}
                suffix="/ month"
                inputMode="decimal"
                invalid={!!errors.latePenaltyPerMonth}
                {...register("latePenaltyPerMonth", { setValueAs: asNumber })}
              />
            </SettingRow>
            <SettingRow
              compact
              label="Absence penalty"
              help="Taken from a member's dividend for each meeting of the year they were marked absent at, never more than the dividend. The charges are part of the year's profit."
              htmlFor="absencePenaltyPerMeeting"
              error={errors.absencePenaltyPerMeeting?.message}
              hint={was("absencePenaltyPerMeeting", `${settings.currency} ${money(settings.absencePenaltyPerMeeting)} a meeting`)}
            >
              <UnitInput
                id="absencePenaltyPerMeeting"
                prefix={cur}
                suffix="/ meeting"
                inputMode="decimal"
                invalid={!!errors.absencePenaltyPerMeeting}
                {...register("absencePenaltyPerMeeting", { setValueAs: asNumber })}
              />
            </SettingRow>
            <SettingRow
              compact
              label="Reserve fund share of profit"
              help={`Of each year's profit (bank profit, loan interest and penalties collected, and absence charges), shared at the July AGM. Members share the other ${money(100 - shareNow)}% by their savings on 31 December.`}
              htmlFor="reservePercent"
              error={errors.reservePercent?.message}
              hint={was("reservePercent", `${settings.reservePercent}%`)}
            >
              <UnitInput
                id="reservePercent"
                suffix="%"
                inputMode="decimal"
                invalid={!!errors.reservePercent}
                {...register("reservePercent", { setValueAs: asNumber })}
              />
            </SettingRow>
            <SettingRow
              compact
              label="Bank charge on withdrawals above"
              help="The bank takes a charge when a cheque withdrawal is above this amount. Loans and reserve expenses above it ask for the charge, typed in from the bank statement: on a loan the member repays it with the loan (no interest on it); on a reserve expense the reserve fund pays it."
              htmlFor="bankChargeThreshold"
              error={errors.bankChargeThreshold?.message}
              hint={was("bankChargeThreshold", `${settings.currency} ${money(settings.bankChargeThreshold)}`)}
            >
              <UnitInput
                id="bankChargeThreshold"
                prefix={cur}
                inputMode="decimal"
                invalid={!!errors.bankChargeThreshold}
                {...register("bankChargeThreshold", { setValueAs: asNumber })}
              />
            </SettingRow>
          </div>

          {/* Worked example: printed like a teller's slip, as the card's own right-hand column */}
          <aside className="border-t border-border px-5 py-5 lg:border-t-0 lg:border-l" aria-label="Worked example">
            <p className="text-sm font-semibold text-foreground">Worked example</p>
            <p className="text-xs text-muted-foreground">
              {moneyChanged ? "Struck-through figures are the ones in force now." : "Follows your edits before you save."}
            </p>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              A loan of <span className="figure">{cur} {money(sampleLoan)}</span> issued today
            </p>
            <dl className="mt-1.5 space-y-1">
              <Leader label={next.rateLabel} value={next.interest} was={inForce.interest} />
              <Leader label="Total payable" value={next.payable} was={inForce.payable} strong rule="above" />
              <Leader label={`${period} monthly instalments of`} value={next.instalment} was={inForce.instalment} />
              <Leader label="Due by" value={fmtDay(sampleDue)} />
              <Leader label="If unpaid a month after that" value={next.penalty} was={inForce.penalty} tone={next.penaltyCharged ? "bad" : undefined} />
            </dl>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              A member who missed <span className="figure">{sampleAbsences}</span> meetings in the year
            </p>
            <dl className="mt-1.5 space-y-1">
              <Leader label="Penalty per meeting" value={next.fine} was={inForce.fine} />
              <Leader label="Taken from their dividend" value={next.absenceTaken} was={inForce.absenceTaken} tone={next.absenceCharged ? "bad" : undefined} />
            </dl>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              A year's profit of <span className="figure">{cur} {money(sampleProfit)}</span> shared at the AGM
            </p>
            <dl className="mt-1.5 space-y-1">
              <Leader label={`Reserve fund (${next.shareLabel})`} value={next.reserve} was={inForce.reserve} />
              <Leader label={`Members (${next.membersShareLabel})`} value={next.members} was={inForce.members} tone="good" strong rule="double" />
            </dl>
          </aside>
        </div>
      </Card>

      {/* Display & lists */}
      <Card className="rounded-sm shadow-sm">
        <SectionHead title="Display & lists" description="How dates, times, amounts and lists appear in the app and in reports. No records change." />
        <div className="grid xl:grid-cols-2">
          <div className="divide-y divide-border px-5 xl:border-r xl:border-border">
            <SettingRow label="Theme" help="Follow Windows, or always use light or dark.">
              <Controller
                control={control}
                name="theme"
                render={({ field }) => (
                  <Segmented
                    label="Theme"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "system", label: "System" },
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                )}
              />
            </SettingRow>
            <SettingRow label="Animations" help="Transitions when dialogs and menus open and close.">
              <Controller
                control={control}
                name="enableAnimations"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Animations" />}
              />
            </SettingRow>
            <SettingRow label="Date format" help={<>Today reads <span className="figure">{format(now, dateFmt)}</span></>}>
              <Controller
                control={control}
                name="dateFormat"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-10 rounded-sm w-full sm:w-64" aria-label="Date format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {DATE_FORMAT_NAMES[f]} <span className="figure text-muted-foreground ml-1">{format(now, f)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </SettingRow>
            <SettingRow label="Time format" help={<>Meeting times read <span className="figure">{format(new Date(2026, 0, 1, 20, 0), timePattern(v.timeFormat))}</span></>}>
              <Controller
                control={control}
                name="timeFormat"
                render={({ field }) => (
                  <Segmented
                    label="Time format"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "12", label: "12-hour" },
                      { value: "24", label: "24-hour" },
                    ]}
                  />
                )}
              />
            </SettingRow>
          </div>
          <div className="divide-y divide-border px-5 border-t border-border xl:border-t-0">
            <SettingRow label="Currency" help="Shown before every amount." htmlFor="currency" error={errors.currency?.message}>
              <input
                id="currency"
                className={cn(fieldClass, "w-full sm:w-28 figure uppercase", errors.currency && "border-destructive")}
                aria-invalid={!!errors.currency}
                {...register("currency")}
              />
            </SettingRow>
            <SettingRow label="Members per page" help="Rows on the Members list." htmlFor="membersPerPage" error={errors.membersPerPage?.message}>
              <UnitInput
                id="membersPerPage"
                suffix="rows"
                inputMode="numeric"
                invalid={!!errors.membersPerPage}
                className="sm:w-32"
                {...register("membersPerPage", { setValueAs: asNumber })}
              />
            </SettingRow>
            <SettingRow label="Rows per page elsewhere" help="Every other table longer than this is split into pages: loans, meetings, the reserve fund, profit distribution, contributions, a member's savings history and the Audit Log." htmlFor="itemsPerPage" error={errors.itemsPerPage?.message}>
              <UnitInput
                id="itemsPerPage"
                suffix="rows"
                inputMode="numeric"
                invalid={!!errors.itemsPerPage}
                className="sm:w-32"
                {...register("itemsPerPage", { setValueAs: asNumber })}
              />
            </SettingRow>
          </div>
        </div>
      </Card>

      {/* Moving from paper registers: cut-over date and opening balances */}
      <PaperRegistersCard />

      {/* Data safety */}
      <Card className="rounded-sm shadow-sm">
        <SectionHead title="Data safety" description="Every record lives in the database on this computer. A backup copies it all into one file you can keep on a USB drive or another disk." />
        <div className="grid gap-5 px-5 pb-5 pt-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex items-start gap-3">
            {lastBackupAt && !backupDue ? (
              <Badge variant="secondary" className="mt-0.5 shrink-0">Backed up</Badge>
            ) : (
              <Badge variant="outline" className="mt-0.5 shrink-0 border-accent/60 bg-accent/15 text-primary">{lastBackupAt ? "Backup due" : "No backup"}</Badge>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {lastBackupAt ? (
                  <>
                    Last backup <span className="figure">{format(lastBackupAt, `${settings.dateFormat} ${timePattern(settings.timeFormat)}`)}</span>, {backupAge(lastBackupAt)}
                  </>
                ) : (
                  "No backup has been made on this computer yet"
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings.backupReminderDays > 0
                  ? `The Dashboard reminds you when the last backup is ${settings.backupReminderDays} day${settings.backupReminderDays === 1 ? "" : "s"} old.`
                  : "Reminders are off."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 xl:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="backupReminderDays" className="text-sm text-muted-foreground">Remind me</Label>
              <Controller
                control={control}
                name="backupReminderDays"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(val) => field.onChange(Number(val))}>
                    <SelectTrigger id="backupReminderDays" className="h-10 w-40 rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reminderOptions.map((o) => (
                        <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="button" variant={backupDue ? "default" : "outline"} onClick={runBackup} disabled={backingUp} className="gap-2 rounded-sm">
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
                {backingUp ? "Backing up…" : "Back up now"}
              </Button>
            </div>
            <HintSlot>{was("backupReminderDays", reminderLabel(settings.backupReminderDays), false)}</HintSlot>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-destructive/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Restore from a backup</p>
            <p className="text-xs text-muted-foreground mt-0.5">Replaces every record in the app with the contents of a backup file. Back up first.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={restoring} className="gap-2 rounded-sm shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {restoring ? "Restoring…" : "Restore from backup"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Replace all records with a backup?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every member, loan, contribution, meeting and other record will be overwritten by the backup file you choose. This cannot be undone, so back up today's data first if you may need it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runRestore} className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Choose file and restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <ClearRecordsStrip />
      </Card>

      {/* Save bar */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t-2 bg-card px-6 py-3 transition-colors duration-200",
          isDirty ? "border-primary/70" : "border-border",
        )}
      >
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          {isDirty ? (
            <>
              <CircleDot className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">Unsaved changes</span>
              <span className="text-muted-foreground">in {dirtySections.join(" and ")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-secondary" />
              <span className="text-muted-foreground">All settings saved</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => reset()} disabled={!isDirty} className="gap-2 rounded-sm">
            <Undo2 className="w-4 h-4" /> Discard
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting} className="gap-2 rounded-sm shadow-sm">
            <Save className="w-4 h-4" /> Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ── Building blocks ── */

const fieldClass =
  "flex h-10 rounded-sm border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

function SectionHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 pt-5 pb-1">
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[68ch]">{description}</p>
    </div>
  );
}

function SettingRow({
  label,
  help,
  htmlFor,
  error,
  hint,
  compact,
  children,
}: {
  label: string;
  help?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  /** In the Money rules column: stacks while the column is narrow (beside the worked example on
   *  small windows) and reserves the hint line so editing never shifts the rows below. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6",
        compact && "lg:grid-cols-1 lg:gap-2 lg:py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-6 xl:py-4",
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</Label>
        {help && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{help}</p>}
      </div>
      <div
        className={cn(
          "flex flex-col gap-1 sm:items-end",
          // Stacked beside the worked example: the hint sits on the control's line, not below it.
          compact && "lg:flex-row lg:items-center lg:gap-3 xl:flex-col xl:items-end xl:gap-1",
        )}
      >
        {children}
        {compact ? (
          <HintSlot>{error ? <span className="text-destructive">{error}</span> : hint}</HintSlot>
        ) : error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : (
          hint
        )}
      </div>
    </div>
  );
}

/** A fixed one-line box for "In force now" hints and errors, so showing one never moves the rows below. */
function HintSlot({ children }: { children?: ReactNode }) {
  return <span className="block h-4 whitespace-nowrap text-xs leading-4">{children}</span>;
}

interface UnitInputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
}

const UnitInput = forwardRef<HTMLInputElement, UnitInputProps>(({ prefix, suffix, invalid, className, disabled, ...props }, ref) => (
  <div
    className={cn(
      "flex h-10 w-full items-center rounded-sm border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 sm:w-40",
      invalid && "border-destructive",
      disabled && "opacity-50",
      className,
    )}
  >
    {prefix && <span className="pl-3 text-xs font-medium text-muted-foreground figure">{prefix}</span>}
    <input
      ref={ref}
      type="text"
      autoComplete="off"
      disabled={disabled}
      aria-invalid={invalid}
      className="h-full w-full min-w-0 bg-transparent px-3 text-right text-sm figure outline-none disabled:cursor-not-allowed"
      {...props}
    />
    {suffix && <span className="pr-3 text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
  </div>
));
UnitInput.displayName = "UnitInput";

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next)}
      aria-label={label}
      className="w-fit gap-0 rounded-sm border border-input bg-muted/50 p-0.5"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-8 rounded-[3px] px-3 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** One line of the worked example: label, dotted leader, figure. When the figure differs from the
 *  one in force (`was`), the old figure is struck through beside it, as a ledger records a change.
 *  `rule` draws an ink rule above a total, or the double rule that closes a slip. */
function Leader({
  label,
  value,
  was,
  strong,
  tone,
  rule,
}: {
  label: string;
  value: string;
  was?: string;
  strong?: boolean;
  tone?: "good" | "bad";
  rule?: "above" | "double";
}) {
  const changed = was !== undefined && was !== value;
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 text-xs",
        rule === "above" && "mt-1.5 border-t border-foreground/60 pt-1.5",
        rule === "double" && "border-b-[3px] border-double border-foreground/60 pb-1",
      )}
    >
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-border translate-y-[-3px]" />
      {/* In a narrow column the struck-through figure wraps above the new one instead of overflowing. */}
      <dd className="figure min-w-0 flex flex-wrap items-baseline justify-end gap-x-1.5">
        {changed && (
          <s className="whitespace-nowrap text-muted-foreground decoration-destructive/70">
            <span className="sr-only">was </span>
            {was}
          </s>
        )}
        <span className={cn("whitespace-nowrap", strong ? "font-bold text-foreground" : "text-foreground", tone === "good" && "text-secondary", tone === "bad" && "text-destructive")}>
          {changed && <span className="sr-only">now </span>}
          {value}
        </span>
      </dd>
    </div>
  );
}
