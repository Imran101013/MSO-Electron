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

const settingsSchema = z.object({
  loanInterestRate: z
    .number({ invalid_type_error: "Interest rate is required" })
    .min(0, "Interest rate must be >= 0")
    .max(100, "Interest rate must be <= 100"),
  applyLoanInterest: z.boolean(),
  membersPerPage: z.number().min(1, "Members per page must be at least 1"),
  minimumNameLength: z
    .number()
    .min(1, "Minimum name length must be at least 1"),
  minimumPhoneLength: z
    .number()
    .min(1, "Minimum phone length must be at least 1"),
  minimumAddressLength: z
    .number()
    .min(1, "Minimum address length must be at least 1"),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  theme: z.enum(["system", "light", "dark"]),
  timeFormat: z.enum(["12", "24"]),
  itemsPerPage: z.number().min(1, "Items per page must be at least 1"),
  enableAnimations: z.boolean(),
  language: z.enum(["en", "ur"]),
  currency: z.string().min(1, "Currency is required"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      loanInterestRate: settings.loanInterestRate,
      applyLoanInterest: settings.applyLoanInterest,
      membersPerPage: settings.membersPerPage,
      minimumNameLength: settings.minimumNameLength,
      minimumPhoneLength: settings.minimumPhoneLength,
      minimumAddressLength: settings.minimumAddressLength,
      dateFormat:
        (settings.dateFormat as SettingsForm["dateFormat"]) || "dd/MM/yyyy",
      theme: settings.theme ?? ORGANIZATION_CONFIG.THEME ?? "system",
      timeFormat:
        settings.timeFormat ?? ORGANIZATION_CONFIG.TIME_FORMAT ?? "12",
      itemsPerPage:
        settings.itemsPerPage ?? ORGANIZATION_CONFIG.ITEMS_PER_PAGE ?? 10,
      enableAnimations:
        settings.enableAnimations ??
        ORGANIZATION_CONFIG.ENABLE_ANIMATIONS ??
        true,
      language:
        settings.language === "en" || settings.language === "ur"
          ? (settings.language as SettingsForm["language"])
          : ORGANIZATION_CONFIG.LANGUAGE === "en" ||
            ORGANIZATION_CONFIG.LANGUAGE === "ur"
          ? (ORGANIZATION_CONFIG.LANGUAGE as SettingsForm["language"])
          : "en",
      currency: settings.currency,
    },
  });

  const { register, handleSubmit, formState, reset, watch, setValue } = form;
  const { errors, isDirty } = formState;

  const watchedDateFormat = watch("dateFormat");

  const onSubmit = (values: SettingsForm) => {
    setSaving(true);
    try {
      updateSettings({
        loanInterestRate: values.loanInterestRate,
        applyLoanInterest: values.applyLoanInterest,
        membersPerPage: values.membersPerPage,
        minimumNameLength: values.minimumNameLength,
        minimumPhoneLength: values.minimumPhoneLength,
        minimumAddressLength: values.minimumAddressLength,
        dateFormat: values.dateFormat,
        theme: values.theme,
        timeFormat: values.timeFormat,
        itemsPerPage: values.itemsPerPage,
        enableAnimations: values.enableAnimations,
        language: values.language,
        currency: values.currency,
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
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
      theme: ORGANIZATION_CONFIG.THEME || "system",
      timeFormat: ORGANIZATION_CONFIG.TIME_FORMAT || "12",
      itemsPerPage: ORGANIZATION_CONFIG.ITEMS_PER_PAGE || 10,
      enableAnimations: ORGANIZATION_CONFIG.ENABLE_ANIMATIONS ?? true,
      language: ORGANIZATION_CONFIG.LANGUAGE || "en",
      currency: ORGANIZATION_CONFIG.CURRENCY,
    };

    reset(defaults, { keepDirty: false });
    updateSettings({
      loanInterestRate: defaults.loanInterestRate,
      applyLoanInterest: defaults.applyLoanInterest,
      membersPerPage: defaults.membersPerPage,
      minimumNameLength: defaults.minimumNameLength,
      minimumPhoneLength: defaults.minimumPhoneLength,
      minimumAddressLength: defaults.minimumAddressLength,
      dateFormat: defaults.dateFormat,
      theme: defaults.theme,
      timeFormat: defaults.timeFormat,
      itemsPerPage: defaults.itemsPerPage,
      enableAnimations: defaults.enableAnimations,
      language: defaults.language,
      currency: defaults.currency,
    });
    toast.success("Settings reset to defaults");
  };

  // Helper to keep UI-friendly number inputs in sync
  const syncNumberInput = (
    name: Parameters<typeof setValue>[0],
    value: string
  ) => {
    const parsed = Number(value);
    setValue(name, isNaN(parsed) ? 0 : parsed, { shouldDirty: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">Settings</h2>
          <p className="text-muted-foreground mt-1">
            Global application settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Loan Interest Rate (%)</Label>
            <Input
              type="text"
              {...register("loanInterestRate", { valueAsNumber: true })}
              onChange={(e) =>
                syncNumberInput("loanInterestRate", e.target.value)
              }
            />
            {errors.loanInterestRate && (
              <p className="text-destructive text-sm mt-1">
                {errors.loanInterestRate.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Label className="flex-1">Apply Loan Interest</Label>
            <Switch
              checked={watch("applyLoanInterest")}
              onCheckedChange={(v) =>
                setValue("applyLoanInterest", Boolean(v), { shouldDirty: true })
              }
            />
          </div>

          <div>
            <Label>Members Per Page</Label>
            <Input
              type="text"
              {...register("membersPerPage", { valueAsNumber: true })}
              onChange={(e) =>
                syncNumberInput("membersPerPage", e.target.value)
              }
            />
            {errors.membersPerPage && (
              <p className="text-destructive text-sm mt-1">
                {errors.membersPerPage.message}
              </p>
            )}
          </div>

          <div>
            <Label>Minimum Name Length</Label>
            <Input
              type="text"
              {...register("minimumNameLength", { valueAsNumber: true })}
              onChange={(e) =>
                syncNumberInput("minimumNameLength", e.target.value)
              }
            />
            {errors.minimumNameLength && (
              <p className="text-destructive text-sm mt-1">
                {errors.minimumNameLength.message}
              </p>
            )}
          </div>

          <div>
            <Label>Minimum Phone Length</Label>
            <Input
              type="text"
              {...register("minimumPhoneLength", { valueAsNumber: true })}
              onChange={(e) =>
                syncNumberInput("minimumPhoneLength", e.target.value)
              }
            />
            {errors.minimumPhoneLength && (
              <p className="text-destructive text-sm mt-1">
                {errors.minimumPhoneLength.message}
              </p>
            )}
          </div>

          <div>
            <Label>Minimum Address Length</Label>
            <Input
              type="text"
              {...register("minimumAddressLength", { valueAsNumber: true })}
              onChange={(e) =>
                syncNumberInput("minimumAddressLength", e.target.value)
              }
            />
            {errors.minimumAddressLength && (
              <p className="text-destructive text-sm mt-1">
                {errors.minimumAddressLength.message}
              </p>
            )}
          </div>

          <div>
            <Label>Date Format</Label>
            <select
              className="w-full rounded-md border border-border bg-card text-card-foreground p-2 focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("dateFormat")}>
              <option value="dd/MM/yyyy">dd/MM/yyyy (24/12/2025)</option>
              <option value="MM/dd/yyyy">MM/dd/yyyy (12/24/2025)</option>
              <option value="yyyy-MM-dd">yyyy-MM-dd (2025-12-24)</option>
            </select>
            <p className="text-sm text-muted-foreground mt-1">
              Preview: {format(new Date(), watchedDateFormat ?? "dd/MM/yyyy")}
            </p>
            {errors.dateFormat && (
              <p className="text-destructive text-sm mt-1">
                {errors.dateFormat.message}
              </p>
            )}
          </div>

          <div>
            <Label>Currency</Label>
            <Input {...register("currency")} />
            {errors.currency && (
              <p className="text-destructive text-sm mt-1">
                {errors.currency.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onResetDefaults}
              disabled={saving}>
              Reset Defaults
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={saving || !isDirty}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
