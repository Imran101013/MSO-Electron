import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Pencil,
  Trash2,
  Eye,
  Upload,
  Loader2,
  UserCheck,
  Clock,
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
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { useSettings } from "@/contexts/SettingsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useMembers, DbMember } from "@/hooks/useMembers";
import { useContributions, DbContribution } from "@/hooks/useContributions";
import { useLoans, DbLoan } from "@/hooks/useLoans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      `Name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`,
    ),
  fatherName: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      `Father name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`,
    ),
  dob: z.date({ required_error: "Date of birth is required" }),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(
      ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH,
      `Phone number must be at least ${ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH} characters`,
    ),
  address: z.string().min(1, "Address is required"),
  joinDate: z.date({ required_error: "Join date is required" }),
  profilePicture: z.string().optional(),
});

type MemberFormValues = z.infer<typeof formSchema>;

export default function Members() {
  const {
    members,
    isLoading,
    addMember,
    updateMember,
    deleteMember,
    fetchMembers,
    approveMember,
  } = useMembers();
  const { getMemberContributions } = useContributions();
  const { getLoansByMember } = useLoans();
  const { isMember, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DbMember | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<DbMember | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] =
    useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberContributions, setMemberContributions] = useState<
    DbContribution[]
  >([]);
  const [memberLoans, setMemberLoans] = useState<DbLoan[]>([]);
  const [isLoadingMemberData, setIsLoadingMemberData] = useState(false);
  const { toast } = useToast();

  const MEMBERS_PER_PAGE = 5;
  const { settings } = useSettings();

  const selectedMember = selectedMemberId
    ? members.find((m) => m.id === selectedMemberId) || null
    : null;

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE);
  const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
  const endIndex = startIndex + MEMBERS_PER_PAGE;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  const suggestions =
    searchQuery.length > 0
      ? members
          .filter((member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
          .slice(0, 5)
      : [];

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      fatherName: "",
      dob: undefined,
      email: "",
      phone: "",
      address: "",
      joinDate: undefined,
      profilePicture: "",
    },
  });

  const onSubmit = async (data: MemberFormValues) => {
    setIsSubmitting(true);

    const formData = {
      name: data.name,
      father_name: data.fatherName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      dob: data.dob ? format(data.dob, "yyyy-MM-dd") : null,
      join_date: format(data.joinDate, "yyyy-MM-dd"),
      profile_picture: data.profilePicture,
    };

    if (editingMember) {
      await updateMember(editingMember.id, formData);
    } else {
      await addMember(formData);
    }

    setIsSubmitting(false);
    form.reset();
    setOpen(false);
    setEditingMember(null);
    setProfilePicturePreview("");
  };

  const handleEdit = (member: DbMember) => {
    setEditingMember(member);
    form.reset({
      name: member.name,
      fatherName: member.father_name,
      dob: member.dob ? new Date(member.dob) : undefined,
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
      joinDate: new Date(member.join_date),
      profilePicture: member.profile_picture || "",
    });
    setProfilePicturePreview(member.profile_picture || "");
    setOpen(true);
  };

  const handleDeleteClick = (member: DbMember) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (memberToDelete) {
      await deleteMember(memberToDelete.id, memberToDelete.name);
      setMemberToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleViewDetails = async (member: DbMember) => {
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
    setIsLoadingMemberData(true);

    try {
      // Fetch member contributions and loans in parallel
      const [contributions, loans] = await Promise.all([
        getMemberContributions(member.id),
        getLoansByMember(member.id),
      ]);

      setMemberContributions(contributions);
      setMemberLoans(loans);
    } catch (error) {
      console.error("Error fetching member data:", error);
      toast({
        title: "Error",
        description: "Failed to load member contribution and loan details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMemberData(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
    setCurrentPage(1);
  };

  const handleSelectMember = (member: DbMember) => {
    setSearchQuery(member.name);
    setShowSuggestions(false);
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

  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `members/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Upload Error",
          description: "Failed to upload profile picture",
          variant: "destructive",
        });
        return;
      }

      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      setProfilePicturePreview(data.publicUrl);
      form.setValue("profilePicture", data.publicUrl);
    }
  };

  const handleUpdatePhoto = async (memberId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `members/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-pictures")
          .upload(filePath, file);

        if (uploadError) {
          toast({
            title: "Upload Error",
            description: "Failed to upload profile picture",
            variant: "destructive",
          });
          return;
        }

        const { data } = supabase.storage
          .from("profile-pictures")
          .getPublicUrl(filePath);

        await updateMember(memberId, { profile_picture: data.publicUrl });
        toast({
          title: "Profile Picture Updated",
          description: "The member's profile picture has been updated.",
        });
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">Members</h2>
          <p className="text-muted-foreground mt-1">
            Manage organization members
          </p>
        </div>
        {isAdmin && (
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
                          <DatePicker
                            date={field.value}
                            onDateChange={field.onChange}
                            placeholder="Select date of birth"
                          />
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
                          <DatePicker
                            date={field.value}
                            onDateChange={field.onChange}
                            placeholder="Select joining date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>Profile Picture</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage
                          src={
                            profilePicturePreview ||
                            editingMember?.profile_picture ||
                            undefined
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
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingMember ? "Updating..." : "Adding..."}
                        </>
                      ) : editingMember ? (
                        "Update Member"
                      ) : (
                        "Add Member"
                      )}
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
                        <AvatarImage
                          src={member.profile_picture || undefined}
                        />
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
          {currentMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No members found matching your search."
                : "No members yet. Add the first member to get started."}
            </div>
          ) : (
            <div className="space-y-4">
              {currentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-1 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.profile_picture || undefined} />
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
                        Joined MSO on:{" "}
                        {format(
                          new Date(member.join_date),
                          settings.dateFormat,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!member.is_approved && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(member)}
                      className="h-8 w-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        {!member.is_approved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              approveMember(member.id, member.name)
                            }
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                            title="Approve member">
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
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
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
            setMemberContributions([]);
            setMemberLoans([]);
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
                  <AvatarImage
                    src={selectedMember.profile_picture || undefined}
                  />
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
                    Father: {selectedMember.father_name}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdatePhoto(selectedMember.id)}
                    className="pb-1 gap-2">
                    <Upload className="w-4 h-4" />
                    Update Photo
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedMember.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedMember.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {selectedMember.dob
                      ? format(
                          new Date(selectedMember.dob),
                          settings.dateFormat,
                        )
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Join Date</p>
                  <p className="font-medium">
                    {format(
                      new Date(selectedMember.join_date),
                      settings.dateFormat,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">
                    {selectedMember.address || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="font-medium">
                    PKR {(selectedMember.total_budget || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="contributions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="contributions">Contributions</TabsTrigger>
                  <TabsTrigger value="loans">Loans</TabsTrigger>
                </TabsList>
                <TabsContent value="contributions" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingMemberData ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                            Loading contributions...
                          </TableCell>
                        </TableRow>
                      ) : memberContributions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground">
                            No contributions recorded yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        memberContributions.map((contribution) => (
                          <TableRow key={contribution.id}>
                            <TableCell>
                              {format(
                                new Date(contribution.contribution_date),
                                settings.dateFormat,
                              )}
                            </TableCell>
                            <TableCell>
                              PKR {contribution.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                Completed
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="loans" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingMemberData ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                            Loading loans...
                          </TableCell>
                        </TableRow>
                      ) : memberLoans.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground">
                            No loans recorded yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        memberLoans.map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell>
                              {format(
                                new Date(loan.loan_date),
                                settings.dateFormat,
                              )}
                            </TableCell>
                            <TableCell>
                              PKR {loan.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              PKR {loan.remaining_amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  loan.status === "paid"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                                }`}>
                                {loan.status === "paid" ? "Paid" : "Active"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
