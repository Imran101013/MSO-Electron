import { useState } from "react";
import { Search, Mail, Phone, Upload, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export default function MemberSearch() {
  const { members, setMembers } = useOrganization();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { user, isMember } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const selectedMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) || null
    : null;

  // Filter suggestions based on user role - members can only search their own details
  const suggestions =
    searchQuery.length > 0
      ? members
          .filter((member) => {
            const matchesSearch = member.name
              .toLowerCase()
              .includes(searchQuery.toLowerCase());
            // If member role, only show their own details
            if (isMember && user) {
              return matchesSearch && member.email === user.email;
            }
            return matchesSearch;
          })
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
    // Prevent members from viewing other members' details
    if (isMember && user && member.email !== user.email) {
      toast({
        title: "Access Denied",
        description: "You can only view your own details.",
        variant: "destructive",
      });
      return;
    }
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDetailsDialogOpen(open);
    if (!open) {
      setSelectedMemberId(null);
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
            className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}>
            {suggestions.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member)}
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-b-0">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={member.profilePicture} />
                  <AvatarFallback className="bg-gradient-primary">
                    <span className="text-primary-foreground text-sm font-semibold">
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedMember.profilePicture} />
                  <AvatarFallback className="bg-gradient-primary">
                    <span className="text-primary-foreground font-semibold text-xl">
                      {selectedMember.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">
                    {selectedMember.name}
                  </h3>
                  <p className="text-muted-foreground">
                    Father: {selectedMember.fatherName}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file && selectedMember) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          const updatedMembers = members.map((m) =>
                            m.id === selectedMember.id
                              ? { ...m, profilePicture: base64String }
                              : m
                          );
                          setMembers(updatedMembers);
                          toast({
                            title: "Profile Picture Updated",
                            description:
                              "The member's profile picture has been updated.",
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="gap-2">
                  <Upload className="w-4 h-4" />
                  Update Photo
                </Button>
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
                    {new Date(selectedMember.dob).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{selectedMember.joinDate}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedMember.address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="font-medium text-lg text-primary">
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
                                      {new Date(
                                        contribution.month
                                      ).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                      PKR {contribution.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs ${
                                          attendanceRecord?.present
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-700"
                                        }`}>
                                        {attendanceRecord?.present
                                          ? "Present"
                                          : "Absent"}
                                      </span>
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
                                    {new Date(loan.date).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    PKR {amountWithInterest.toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    PKR {loan.remainingAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs ${
                                        loan.status === "Paid"
                                          ? "bg-green-100 text-green-700"
                                          : "bg-orange-100 text-orange-700"
                                      }`}>
                                      {loan.status}
                                    </span>
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
