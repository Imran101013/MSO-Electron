import { useState } from "react";
import { Search, Mail, Phone, Upload, Eye, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganization, Member } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/hooks/useMembers";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function MemberSearch() {
  const { members } = useOrganization();
  const { updateMember } = useMembers();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const selectedMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) || null
    : null;

  // Filter suggestions based on search query
  const suggestions =
    searchQuery.length > 0
      ? members
          .filter((member) =>
            member.name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSelectMember = (member: Member) => {
    setSearchQuery(member.name);
    setShowSuggestions(false);
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
  };

  const handleViewDetails = (member: Member) => {
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) {
      setSelectedMemberId(null);
    }
  };

  const sendMemberDetailsViaWhatsApp = (member: Member) => {
    if (!member.phone) {
      toast({
        title: "No phone number",
        description: "Cannot WhatsApp member details without a phone number.",
        variant: "destructive",
      });
      return;
    }
    const phone = member.phone.replace(/\D/g, "");
    if (!phone) {
      toast({
        title: "Invalid phone",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }
    const message = `Hello ${member.name}, your membership details have been recorded.\n\nName: ${member.name}\nFather: ${member.fatherName}\nEmail: ${member.email || "N/A"}\nPhone: ${member.phone}\nAddress: ${member.address || "N/A"}\nJoin Date: ${format(new Date(member.joinDate), settings.dateFormat)}`;
    const encoded = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    const api = (window as any).electronAPI;
    if (api?.openExternal) {
      api.openExternal(url);
      toast({
        title: "WhatsApp opened",
        description: `Member details opened in WhatsApp for ${member.name}.`,
      });
    }
  };

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          className="pl-10 w-64"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-card border-t-2 border-primary/60 border-x border-b border-border rounded-sm shadow-lg z-50 max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}>
            {suggestions.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member)}
                className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-center gap-3 border-b border-border last:border-b-0">
                <Avatar className="h-8 w-8 flex-shrink-0 rounded-sm">
                  <AvatarImage src={member.profilePicture} />
                  <AvatarFallback className="rounded-sm bg-primary/10 border border-primary/30">
                    <span className="text-primary text-sm font-semibold">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={detailsDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-sm shadow-2xl border-t-2 border-primary/70 border-x border-b border-border p-6 bg-card">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-20 w-20 rounded-sm">
                  <AvatarImage src={selectedMember.profilePicture} />
                  <AvatarFallback className="rounded-sm bg-primary/10 border-2 border-primary/40">
                    <span className="text-primary font-semibold text-xl">
                      {selectedMember.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">
                    Name: {selectedMember.name}
                  </h3>
                  <p className="text-muted-foreground">
                    Father's Name: {selectedMember.fatherName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!selectedMember) return;
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const filePath = `members/${Date.now()}.${file.name.split(".").pop()}`;
                        const { error } = await supabase.storage.from("profile-pictures").upload(filePath, file);
                        if (error) {
                          toast({ title: "Upload Error", description: "Failed to upload profile picture", variant: "destructive" });
                          return;
                        }
                        const { data } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
                        await updateMember(selectedMember.dbId, { profile_picture: data.publicUrl });
                        toast({
                          title: "Profile Picture Updated",
                          description:
                            "The member's profile picture has been updated.",
                        });
                      };
                      input.click();
                    }}
                    className="gap-2">
                    <Upload className="w-4 h-4" />
                    Update Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendMemberDetailsViaWhatsApp(selectedMember)}
                    className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Share via WhatsApp
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedMember.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedMember.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {format(new Date(selectedMember.dob), settings.dateFormat)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {format(
                      new Date(selectedMember.joinDate),
                      settings.dateFormat
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedMember.address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="figure font-medium text-lg text-primary">
                    PKR {selectedMember.totalBudget.toLocaleString()}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="contributions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="contributions">Contributions</TabsTrigger>
                  <TabsTrigger value="loans">Loans</TabsTrigger>
                </TabsList>

                <TabsContent value="contributions" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardDescription>
                        Monthly contribution and attendance history
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedMember.monthlyContributions.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Attendance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.monthlyContributions.map(
                              (contribution, index) => {
                                const attendanceRecord =
                                  selectedMember.attendance.find(
                                    (a) => a.date === contribution.month
                                  );
                                return (
                                  <TableRow key={index}>
                                    <TableCell>
                                      {format(
                                        new Date(contribution.month),
                                        settings.dateFormat
                                      )}
                                    </TableCell>
                                    <TableCell className="figure">
                                      PKR {contribution.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={attendanceRecord?.present ? "secondary" : "destructive"}>
                                        {attendanceRecord?.present
                                          ? "Present"
                                          : "Absent"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                            )}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No contributions recorded
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="loans" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardDescription>Loan history and status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedMember.loans.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount Payable</TableHead>
                              <TableHead>Remaining</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.loans.map((loan) => {
                              const effectiveInterest =
                                settings.applyLoanInterest
                                  ? settings.loanInterestRate
                                  : 0;
                              const amountWithInterest =
                                loan.amount * (1 + effectiveInterest / 100);
                              return (
                                <TableRow key={loan.id}>
                                  <TableCell>
                                    {format(
                                      new Date(loan.date),
                                      settings.dateFormat
                                    )}
                                  </TableCell>
                                  <TableCell className="figure">
                                    PKR {amountWithInterest.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="figure">
                                    PKR {loan.remainingAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={loan.status === "Paid" ? "secondary" : "default"}>
                                      {loan.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No loans recorded
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
