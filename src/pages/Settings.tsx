import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ORGANIZATION_CONFIG } from "@/config/organization";

type FormState = {
  loanInterestRate: string;
  applyLoanInterest: boolean;
  membersPerPage: string;
  minimumNameLength: string;
  minimumPhoneLength: string;
  minimumAddressLength: string;
  dateFormat: string;
  shortDateFormat: string;
  currency: string;
};

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<FormState>({
    loanInterestRate: settings.loanInterestRate.toString(),
    applyLoanInterest: settings.applyLoanInterest,
    membersPerPage: settings.membersPerPage.toString(),
    minimumNameLength: settings.minimumNameLength.toString(),
    minimumPhoneLength: settings.minimumPhoneLength.toString(),
    minimumAddressLength: settings.minimumAddressLength.toString(),
    dateFormat: settings.dateFormat,
    shortDateFormat: settings.shortDateFormat,
    currency: settings.currency,
  });

  const onChange = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = () => {
    updateSettings({
      loanInterestRate: Number(form.loanInterestRate) || 0,
      applyLoanInterest: !!form.applyLoanInterest,
      membersPerPage: Number(form.membersPerPage) || 5,
      minimumNameLength: Number(form.minimumNameLength) || 2,
      minimumPhoneLength: Number(form.minimumPhoneLength) || 10,
      minimumAddressLength: Number(form.minimumAddressLength) || 5,
      dateFormat: form.dateFormat || settings.dateFormat,
      shortDateFormat: form.shortDateFormat || settings.shortDateFormat,
      currency: form.currency || settings.currency,
    });
    toast.success("Settings saved");
  };

  const onResetDefaults = () => {
    const defaults: FormState = {
      loanInterestRate: String(ORGANIZATION_CONFIG.LOAN_INTEREST_RATE),
      applyLoanInterest: true,
      membersPerPage: String(ORGANIZATION_CONFIG.MEMBERS_PER_PAGE),
      minimumNameLength: String(ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH),
      minimumPhoneLength: String(ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH),
      minimumAddressLength: String(ORGANIZATION_CONFIG.MINIMUM_ADDRESS_LENGTH),
      dateFormat: ORGANIZATION_CONFIG.DATE_FORMAT,
      shortDateFormat: ORGANIZATION_CONFIG.SHORT_DATE_FORMAT,
      currency: ORGANIZATION_CONFIG.CURRENCY,
    };
    setForm(defaults);
    updateSettings({
      loanInterestRate: ORGANIZATION_CONFIG.LOAN_INTEREST_RATE,
      applyLoanInterest: true,
      membersPerPage: ORGANIZATION_CONFIG.MEMBERS_PER_PAGE,
      minimumNameLength: ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      minimumPhoneLength: ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH,
      minimumAddressLength: ORGANIZATION_CONFIG.MINIMUM_ADDRESS_LENGTH,
      dateFormat: ORGANIZATION_CONFIG.DATE_FORMAT,
      shortDateFormat: ORGANIZATION_CONFIG.SHORT_DATE_FORMAT,
      currency: ORGANIZATION_CONFIG.CURRENCY,
    });
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Settings</h2>
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
              type="number"
              value={form.loanInterestRate}
              onChange={(e) => onChange("loanInterestRate", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex-1">Apply Loan Interest</Label>
            <Switch
              checked={!!form.applyLoanInterest}
              onCheckedChange={(v) =>
                setForm((s) => ({ ...s, applyLoanInterest: v }))
              }
            />
          </div>
          <div>
            <Label>Members Per Page</Label>
            <Input
              type="number"
              value={form.membersPerPage}
              onChange={(e) => onChange("membersPerPage", e.target.value)}
            />
          </div>
          <div>
            <Label>Minimum Name Length</Label>
            <Input
              type="number"
              value={form.minimumNameLength}
              onChange={(e) => onChange("minimumNameLength", e.target.value)}
            />
          </div>
          <div>
            <Label>Minimum Phone Length</Label>
            <Input
              type="number"
              value={form.minimumPhoneLength}
              onChange={(e) => onChange("minimumPhoneLength", e.target.value)}
            />
          </div>
          <div>
            <Label>Minimum Address Length</Label>
            <Input
              type="number"
              value={form.minimumAddressLength}
              onChange={(e) => onChange("minimumAddressLength", e.target.value)}
            />
          </div>
          <div>
            <Label>Date Format</Label>
            <Input
              value={form.dateFormat}
              onChange={(e) => onChange("dateFormat", e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Preview:{" "}
              {format(new Date(), form.dateFormat || settings.dateFormat)}
            </p>
          </div>
          <div>
            <Label>Short Date Format</Label>
            <Input
              value={form.shortDateFormat}
              onChange={(e) => onChange("shortDateFormat", e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Preview:{" "}
              {format(
                new Date(),
                form.shortDateFormat || settings.shortDateFormat
              )}
            </p>
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={form.currency}
              onChange={(e) => onChange("currency", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onResetDefaults}>
              Reset Defaults
            </Button>
            <Button onClick={onSave}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
