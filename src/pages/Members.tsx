import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Eye, Upload, Loader2, UserCheck, Clock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { ORGANIZATION_CONFIG } from "@/config/organization";

const DEFAULT_MEMBER_ADDRESS = "Village Mogh Tehsil & District Chitral";
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
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH, `Name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`),
  fatherName: z.string().min(ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH, `Father name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`),
  dob: z.date({ required_error: "Date of birth is required" }),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH, `Phone number must be at least ${ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH} characters`),
  address: z.string().min(1, "Address is required"),
  joinDate: z.date({ required_error: "Join date is required" }),
  profilePicture: z.string().optional(),
});

type MemberFormValues = z.infer<typeof formSchema>;

export default function Members() {
  const { members, isLoading, addMember, updateMember, deleteMember, approveMember } = useMembers();
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
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberContributions, setMemberContributions] = useState<DbContribution[]>([]);
  const [memberLoans, setMemberLoans] = useState<DbLoan[]>([]);
  const [isLoadingMemberData, setIsLoadingMemberData] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();
  const membersPerPage = settings.membersPerPage || ORGANIZATION_CONFIG.MEMBERS_PER_PAGE;

  const selectedMember = selectedMemberId ? members.find((m) => m.id === selectedMemberId) || null : null;
  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
  const currentMembers = filteredMembers.slice((currentPage - 1) * membersPerPage, currentPage * membersPerPage);
  const suggestions = searchQuery.length > 0 ? members.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5) : [];
  const approvedCount = members.filter((m) => m.is_approved).length;
  const pendingCount = members.filter((m) => !m.is_approved).length;

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", fatherName: "", dob: undefined, email: "", phone: "", address: DEFAULT_MEMBER_ADDRESS, joinDate: undefined, profilePicture: "" },
  });

  const sendMemberDetailsViaWhatsApp = async (member: DbMember) => {
    if (!member.phone) {
      toast({ title: "No phone number", description: "Cannot WhatsApp member details without a phone number.", variant: "destructive" });
      return;
    }
    const phone = member.phone.replace(/\D/g, "");
    if (!phone) {
      toast({ title: "Invalid phone", description: "Please enter a valid phone number.", variant: "destructive" });
      return;
    }
    const message = `Hello ${member.name}, your membership details have been recorded.\n\nName: ${member.name}\nFather: ${member.father_name}\nEmail: ${member.email || "N/A"}\nPhone: ${member.phone}\nAddress: ${member.address || "N/A"}\nJoin Date: ${member.join_date}`;
    const encoded = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    const api = (window as any).electronAPI;
    if (api?.openExternal) {
      await api.openExternal(url);
      toast({ title: "WhatsApp opened", description: `Member details opened in WhatsApp for ${member.name}.` });
    }
  };

  const onSubmit = async (data: MemberFormValues) => {
    setIsSubmitting(true);
    const formData = {
      name: data.name, father_name: data.fatherName, email: data.email, phone: data.phone,
      address: data.address, dob: data.dob ? format(data.dob, "yyyy-MM-dd") : null,
      join_date: format(data.joinDate, "yyyy-MM-dd"), profile_picture: data.profilePicture,
    };
    if (editingMember) {
      await updateMember(editingMember.id, formData);
    } else {
      const createdMember = await addMember(formData);
      if (createdMember) {
        await sendMemberDetailsViaWhatsApp(createdMember);
      }
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
      name: member.name, fatherName: member.father_name, dob: member.dob ? new Date(member.dob) : undefined,
      email: member.email || "", phone: member.phone || "", address: member.address || DEFAULT_MEMBER_ADDRESS,
      joinDate: new Date(member.join_date), profilePicture: member.profile_picture || "",
    });
    setProfilePicturePreview(member.profile_picture || "");
    setOpen(true);
  };

  const handleDeleteClick = (member: DbMember) => { setMemberToDelete(member); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = async () => {
    if (memberToDelete) { await deleteMember(memberToDelete.id, memberToDelete.name); setMemberToDelete(null); }
    setDeleteDialogOpen(false);
  };

  const handleViewDetails = async (member: DbMember) => {
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
    setIsLoadingMemberData(true);
    try {
      const [contributions, loans] = await Promise.all([getMemberContributions(member.id), getLoansByMember(member.id)]);
      setMemberContributions(contributions);
      setMemberLoans(loans);
    } catch { toast({ title: "Error", description: "Failed to load member details", variant: "destructive" }); }
    finally { setIsLoadingMemberData(false); }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) { setEditingMember(null); setProfilePicturePreview(""); form.reset(); }
  };

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const validateProfileImage = (file: File): boolean => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Invalid File", description: "Please upload a JPG, PNG or GIF image.", variant: "destructive" });
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "File Too Large", description: "Profile pictures must be 5MB or smaller.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateProfileImage(file)) return;
    const filePath = `members/${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profile-pictures").upload(filePath, file);
    if (error) { toast({ title: "Upload Error", description: "Failed to upload profile picture", variant: "destructive" }); return; }
    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
    setProfilePicturePreview(data.publicUrl);
    form.setValue("profilePicture", data.publicUrl);
  };

  const handleUpdatePhoto = async (memberId: string) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!validateProfileImage(file)) return;
      const filePath = `members/${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("profile-pictures").upload(filePath, file);
      if (error) { toast({ title: "Upload Error", description: "Failed to upload", variant: "destructive" }); return; }
      const { data } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
      await updateMember(memberId, { profile_picture: data.publicUrl });
      toast({ title: "Photo Updated" });
    };
    input.click();
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Members</h2>
            <p className="text-sm text-muted-foreground">Manage organisation members</p>
          </div>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm"><Plus className="w-4 h-4" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
              {/* Dialog Header */}
              <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                  {editingMember ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{editingMember ? "Edit Member" : "Add New Member"}</h2>
                  <p className="text-xs text-muted-foreground">{editingMember ? "Update member information" : "Create a new member profile"}</p>
                </div>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                  <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {/* Personal Info */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Information</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Full Name</FormLabel><FormControl><Input placeholder="Enter member name" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="fatherName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Father Name</FormLabel><FormControl><Input placeholder="Enter father name" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="dob" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Date of Birth</FormLabel><FormControl><DatePicker date={field.value} onDateChange={field.onChange} placeholder="Select DOB" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="joinDate" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Joining Date</FormLabel><FormControl><DatePicker date={field.value} onDateChange={field.onChange} placeholder="Select join date" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                      </div>
                    </div>
                    {/* Contact Info */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Email</FormLabel><FormControl><Input placeholder="email@example.com" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Phone</FormLabel><FormControl><Input placeholder="0300 1234567" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                      </div>
                    </div>
                    {/* Profile Picture */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile Picture</p>
                      <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border border-border/60">
                        <Avatar className="h-14 w-14 flex-shrink-0">
                          <AvatarImage src={profilePicturePreview || editingMember?.profile_picture || undefined} />
                          <AvatarFallback className="bg-gradient-primary"><Upload className="w-5 h-5 text-primary-foreground" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Input type="file" accept="image/*" onChange={handleProfilePictureChange} className="cursor-pointer h-9 text-xs" />
                          <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF up to 5MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDialogClose(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{editingMember ? "Updating…" : "Adding…"}</> : editingMember ? "Update Member" : "Add Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Members", value: members.length, color: "bg-gradient-primary" },
          { label: "Approved", value: approvedCount, color: "bg-emerald-500" },
          { label: "Pending Approval", value: pendingCount, color: "bg-amber-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="card-hover border-0 shadow-md">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
              </div>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", color)}>
                <Users className="w-5 h-5 text-white" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + List */}
      <Card className="shadow-md border-0">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search members…" className="pl-10 h-10" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(e.target.value.length > 0); setCurrentPage(1); }}
              onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden" onMouseDown={(e) => e.preventDefault()}>
                {suggestions.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setSearchQuery(m.name); setShowSuggestions(false); setTimeout(() => handleViewDetails(m), 100); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center gap-3 border-b border-border/50 last:border-0">
                    <Avatar className="h-7 w-7"><AvatarImage src={m.profile_picture || undefined} /><AvatarFallback className="bg-gradient-primary text-xs text-white">{m.name[0]}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {currentMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery ? "No members found matching your search." : "No members yet. Add the first member to get started."}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {currentMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profile_picture || undefined} />
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">Joined {format(new Date(member.join_date), settings.dateFormat)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!member.is_approved && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(member)}><Eye className="w-4 h-4" /></Button>
                    {isAdmin && (
                      <>
                        {!member.is_approved && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" onClick={() => approveMember(member.id, member.name)} title="Approve">
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(member)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(member)}><Trash2 className="w-4 h-4" /></Button>
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
            <PaginationItem><PaginationPrevious onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}><PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">{page}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Member</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {memberToDelete?.name}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={detailsDialogOpen} onOpenChange={(o) => { setDetailsDialogOpen(o); if (!o) { setSelectedMemberId(null); setMemberContributions([]); setMemberLoans([]); } }}>
        <DialogContent className="sm:max-w-[680px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Member Details</h2>
              <p className="text-xs text-muted-foreground">{selectedMember?.name}</p>
            </div>
          </div>
          {selectedMember && (
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedMember.profile_picture || undefined} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xl font-bold">{selectedMember.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">{selectedMember.name}</h3>
                  <p className="text-sm text-muted-foreground">Father: {selectedMember.father_name}</p>
                </div>
                {isAdmin && <Button variant="outline" size="sm" onClick={() => handleUpdatePhoto(selectedMember.id)} className="gap-2"><Upload className="w-4 h-4" />Update Photo</Button>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Email", value: selectedMember.email || "N/A" },
                  { label: "Phone", value: selectedMember.phone || "N/A" },
                  { label: "Date of Birth", value: selectedMember.dob ? format(new Date(selectedMember.dob), settings.dateFormat) : "N/A" },
                  { label: "Join Date", value: format(new Date(selectedMember.join_date), settings.dateFormat) },
                  { label: "Address", value: selectedMember.address || "N/A" },
                  { label: "Total Budget", value: `PKR ${(selectedMember.total_budget || 0).toLocaleString()}` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl bg-muted/40">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <Tabs defaultValue="contributions">
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="contributions">Contributions</TabsTrigger><TabsTrigger value="loans">Loans</TabsTrigger></TabsList>
                <TabsContent value="contributions" className="mt-3">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {isLoadingMemberData ? <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                        : memberContributions.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">No contributions recorded yet</TableCell></TableRow>
                        : memberContributions.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{format(new Date(c.contribution_date), settings.dateFormat)}</TableCell>
                            <TableCell>PKR {c.amount.toLocaleString()}</TableCell>
                            <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Completed</span></TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="loans" className="mt-3">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Remaining</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {isLoadingMemberData ? <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                        : memberLoans.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">No loans recorded yet</TableCell></TableRow>
                        : memberLoans.map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell>{format(new Date(loan.loan_date), settings.dateFormat)}</TableCell>
                            <TableCell>PKR {loan.amount.toLocaleString()}</TableCell>
                            <TableCell>PKR {loan.remaining_amount.toLocaleString()}</TableCell>
                            <TableCell><span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", loan.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>{loan.status === "paid" ? "Paid" : "Active"}</span></TableCell>
                          </TableRow>
                        ))}
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
