import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Eye,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useOrganization,
  Member,
  MonthlyContribution,
} from "@/contexts/OrganizationContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { useSettings } from "@/contexts/SettingsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const formSchema = z.object({
  name: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      `Name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`
    ),
  fatherName: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      `Father name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`
    ),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH,
      `Phone number must be at least ${ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH} characters`
    ),
  address: z.string().min(1, "Address is required"),
  joinDate: z.string().min(1, "Join date is required"),
  profilePicture: z.string().optional(),
});

type MemberFormValues = z.infer<typeof formSchema>;

export default function Members() {
  const { members, setMembers } = useOrganization();
  const { user, isMember } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [addContributionDialogOpen, setAddContributionDialogOpen] =
    useState(false);
  const [contributionForm, setContributionForm] = useState({
    date: "",
    amount: "",
    present: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] =
    useState<string>("");
  const { toast } = useToast();

  const MEMBERS_PER_PAGE = 5;

  const { settings } = useSettings();

  // Derive selectedMember from current members array to keep it in sync
  const selectedMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) || null
    : null;

  // Filter members based on search query and role
  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    // If member role, only show their own details
    if (isMember && user) {
      return matchesSearch && member.phone === user.phone;
    }
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE);
  const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
  const endIndex = startIndex + MEMBERS_PER_PAGE;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  // Get suggestions for autocomplete
  const suggestions =
    searchQuery.length > 0
      ? members
          .filter((member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      fatherName: "",
      dob: "",
      email: "",
      phone: "",
      address: "",
      joinDate: "",
      profilePicture: "",
    },
  });

  const onSubmit = (data: MemberFormValues) => {
    if (editingMember) {
      // Update existing member
      const updatedMembers = members.map((m) =>
        m.id === editingMember.id ? { ...m, ...data } : m
      );
      setMembers(updatedMembers);
      toast({
        title: "Member Updated",
        description: `${data.name} has been successfully updated.`,
      });
      setEditingMember(null);
    } else {
      // Add new member
      const newMember: Member = {
        id: members.length + 1,
        name: data.name,
        fatherName: data.fatherName,
        dob: data.dob,
        email: data.email,
        phone: data.phone,
        address: data.address,
        joinDate: data.joinDate,
        profilePicture: data.profilePicture,
        monthlyContributions: [],
        attendance: [],
        loans: [],
        totalBudget: 0,
      };
      setMembers([...members, newMember]);
      toast({
        title: "Member Added",
        description: `${data.name} has been successfully added.`,
      });
    }
    form.reset();
    setOpen(false);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    form.reset({
      name: member.name,
      fatherName: member.fatherName,
      dob: member.dob,
      email: member.email,
      phone: member.phone,
      address: member.address,
      joinDate: member.joinDate,
      profilePicture: member.profilePicture || "",
    });
    setOpen(true);
  };

  const handleDeleteClick = (member: Member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      setMembers(members.filter((m) => m.id !== memberToDelete.id));
      toast({
        title: "Member Deleted",
        description: `${memberToDelete.name} has been removed.`,
      });
      setMemberToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleViewDetails = (member: Member) => {
    // Prevent members from viewing other members' details
    const userPhone = user?.phone;
    if (isMember && user && userPhone && member.phone !== userPhone) {
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleSelectMember = (member: Member) => {
    setSearchQuery(member.name);
    setShowSuggestions(false);
    // Small delay to ensure state updates before opening dialog
    setTimeout(() => {
      handleViewDetails(member);
    }, 100);
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingMember(null);
      setProfilePicturePreview("");
      form.reset();
    }
  };

  const handleProfilePictureChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setProfilePicturePreview(reader.result);
          form.setValue("profilePicture", reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddContribution = () => {
    if (!selectedMember) return;

    const amount = parseFloat(contributionForm.amount) || 0;
    if (!contributionForm.date || amount <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please provide a valid date and amount.",
        variant: "destructive",
      });
      return;
    }

    const updatedMembers = members.map((m) => {
      if (m.id === selectedMember.id) {
        const newContribution: MonthlyContribution = {
          month: contributionForm.date,
          amount: amount,
          paid: amount > 0,
        };
        const newAttendance = {
          date: contributionForm.date,
          present: contributionForm.present,
        };
        return {
          ...m,
          monthlyContributions: [...m.monthlyContributions, newContribution],
          attendance: [...m.attendance, newAttendance],
          totalBudget: m.totalBudget + amount,
        };
      }
      return m;
    });

    setMembers(updatedMembers);
    setContributionForm({ date: "", amount: "", present: true });
    setAddContributionDialogOpen(false);
    toast({
      title: "Contribution Added",
      description: `Past contribution of PKR ${amount.toLocaleString()} has been added to ${
        selectedMember.name
      }.`,
    });
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Members</h2>
          <p className="text-muted-foreground mt-1">
            Manage organization members
          </p>
        </div>
        {!isMember && (
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto shadow-2xl border-0 bg-gradient-to-br from-background via-background to-muted/20">
              <DialogHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <Plus className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {editingMember ? "Edit Member" : "Add New Member"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      {editingMember
                        ? "Update member information"
                        : "Create a new member profile"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter member name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fatherName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Father Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter father name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="0300 1234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your address" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Mogh">Mogh</SelectItem>
                            <SelectItem value="Mixigram">Mixigram</SelectItem>
                            <SelectItem value="Uchu">Uchu</SelectItem>
                            <SelectItem value="Uchugol">Uchugol</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="joinDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Joining Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Profile Picture Upload */}
                  <div className="space-y-2">
                    <Label>Profile Picture</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage
                          src={
                            profilePicturePreview ||
                            editingMember?.profilePicture
                          }
                        />
                        <AvatarFallback className="bg-gradient-primary">
                          <Upload className="w-8 h-8 text-primary-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureChange}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload a profile picture
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                      className="px-6 py-2.5 rounded-lg hover:bg-muted/50 transition-all duration-200">
                      Cancel Add Member
                    </Button>
                    <Button
                      type="submit"
                      className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200">
                      {editingMember ? "Update Member" : "Add Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() =>
                  searchQuery.length > 0 && setShowSuggestions(true)
                }
                onBlur={() => {
                  // Delay to allow click on suggestion to register
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                  onMouseDown={(e) => e.preventDefault()} // Prevent input blur on click
                >
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profilePicture} />
                    <AvatarFallback className="bg-gradient-primary">
                      <span className="text-primary-foreground font-semibold">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {member.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Joined Al-Hilal on:{" "}
                      {format(new Date(member.joinDate), settings.dateFormat)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewDetails(member)}
                    className="h-8 w-8">
                    <Eye className="w-6 h-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(member)}
                    className="h-8 w-8">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(member)}
                    className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() =>
                  currentPage > 1 && handlePageChange(currentPage - 1)
                }
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => handlePageChange(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer">
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  currentPage < totalPages && handlePageChange(currentPage + 1)
                }
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {memberToDelete?.name}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open);
          if (!open) {
            setSelectedMemberId(null);
          }
        }}>
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
                  className="pb-1 gap-2">
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
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardDescription>
                          Monthly contribution and attendance history
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddContributionDialogOpen(true)}
                        className="pb-1 gap-2">
                        <Plus className="w-4 h-4" />
                        Add Past Contribution
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedMember.monthlyContributions.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Meeting Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Attendance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.monthlyContributions
                              .sort(
                                (a, b) =>
                                  new Date(a.month).getTime() -
                                  new Date(b.month).getTime()
                              )
                              .map((contribution, index) => {
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
                              })}
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
                        <div className="space-y-6">
                          {selectedMember.loans.map((loan) => {
                            const effectiveInterest = settings.applyLoanInterest
                              ? settings.loanInterestRate
                              : 0;
                            const amountWithInterest =
                              loan.amount * (1 + effectiveInterest / 100);
                            return (
                              <div
                                key={loan.id}
                                className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h4 className="font-semibold">
                                      Loan #{loan.id}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      Issued:{" "}
                                      {format(
                                        new Date(loan.date),
                                        settings.dateFormat
                                      )}
                                    </p>
                                  </div>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
                                      loan.status === "Paid"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-orange-100 text-orange-700"
                                    }`}>
                                    {loan.status}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Principal Amount
                                    </p>
                                    <p className="font-medium">
                                      PKR {loan.amount.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Amount with Interest
                                    </p>
                                    <p className="font-medium">
                                      PKR {amountWithInterest.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Remaining Amount
                                    </p>
                                    <p className="font-medium text-destructive">
                                      PKR{" "}
                                      {loan.remainingAmount.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Interest Rate
                                    </p>
                                    <p className="font-medium">
                                      {effectiveInterest}%
                                    </p>
                                  </div>
                                </div>

                                {loan.installments.length > 0 && (
                                  <div>
                                    <h5 className="font-medium mb-2">
                                      Installment History
                                    </h5>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Amount Paid</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {loan.installments.map(
                                          (installment, index) => (
                                            <TableRow key={index}>
                                              <TableCell>
                                                {format(
                                                  new Date(installment.date),
                                                  settings.dateFormat
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                PKR{" "}
                                                {installment.amount.toLocaleString()}
                                              </TableCell>
                                            </TableRow>
                                          )
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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

      <Dialog
        open={addContributionDialogOpen}
        onOpenChange={setAddContributionDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Past Contribution</DialogTitle>
            <DialogDescription>
              Add a past meeting contribution for {selectedMember?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contribution-date">Meeting Date</Label>
              <Input
                id="contribution-date"
                type="date"
                value={contributionForm.date}
                onChange={(e) =>
                  setContributionForm({
                    ...contributionForm,
                    date: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="contribution-amount">Amount (PKR)</Label>
              <Input
                id="contribution-amount"
                type="number"
                placeholder="0"
                value={contributionForm.amount}
                onChange={(e) =>
                  setContributionForm({
                    ...contributionForm,
                    amount: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contribution-present"
                checked={contributionForm.present}
                onChange={(e) =>
                  setContributionForm({
                    ...contributionForm,
                    present: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-border"
              />
              <Label htmlFor="contribution-present" className="cursor-pointer">
                Present
              </Label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setAddContributionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContribution}>Add Contribution</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
