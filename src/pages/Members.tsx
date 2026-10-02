import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Eye, Upload, Loader2, Users, Wallet, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import StatCard from "@/components/StatCard";

const DEFAULT_MEMBER_ADDRESS = "Village Mogh Tehsil & District Chitral";
import { useSettings } from "@/contexts/SettingsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useMembers, DbMember } from "@/hooks/useMembers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MemberDetailsDialog from "@/components/MemberDetailsDialog";
import ViewReportButton from "@/components/ViewReportButton";

// Up to two initials (first and last name) so long names still fit the 40px avatar.
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 2)).toUpperCase();
};

const formSchema = z.object({
  name: z.string().min(ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH, `Name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`),
  fatherName: z.string().min(ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH, `Father name must be at least ${ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH} characters`),
  dob: z.date({ required_error: "Date of birth is required" }),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .refine((v) => ORGANIZATION_CONFIG.PHONE_PATTERNS.ALL.test(v.replace(/[\s-]/g, "")), "Enter a Pakistani number, e.g. 03001234567 or +923001234567"),
  address: z.string().min(1, "Address is required"),
  joinDate: z.date({ required_error: "Join date is required" }),
  profilePicture: z.string().optional(),
});

type MemberFormValues = z.infer<typeof formSchema>;

export default function Members() {
  const { members, isLoading, fetchMembers, addMember, updateMember, deleteMember } = useMembers();
  const { isAdmin } = useAuth();
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
  const { toast } = useToast();
  const { settings } = useSettings();
  const membersPerPage = settings.membersPerPage || ORGANIZATION_CONFIG.MEMBERS_PER_PAGE;

  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
  const currentMembers = filteredMembers.slice((currentPage - 1) * membersPerPage, currentPage * membersPerPage);
  const suggestions = searchQuery.length > 0 ? members.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5) : [];
  const newThisMonth = members.filter((m) => {
    const join = new Date(m.join_date);
    const now = new Date();
    return join.getFullYear() === now.getFullYear() && join.getMonth() === now.getMonth();
  }).length;
  const totalContributions = members.reduce((s, m) => s + m.total_budget, 0);

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

  const handleViewDetails = (member: DbMember) => {
    setSelectedMemberId(member.id);
    setDetailsDialogOpen(true);
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

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-4">
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Membership Register</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage organisation members</p>
        </div>
        <div className="flex gap-2">
          <ViewReportButton request={{ kind: "member-register" }} label="Register of Members" size="default" />
          {isAdmin && (
            <Dialog open={open} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm"><Plus className="w-4 h-4" /> Add Member</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[620px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                {/* Dialog Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {editingMember ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
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
                            <FormItem><FormLabel className="text-xs font-medium">Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input placeholder="email@example.com" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                          )} />
                          <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs font-medium">Phone</FormLabel><FormControl><Input placeholder="0300 1234567" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                          )} />
                        </div>
                      </div>
                      {/* Profile Picture */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile Picture</p>
                        <div className="flex items-center gap-4 p-3 rounded-sm bg-muted/40 border border-border/60">
                          <Avatar className="h-14 w-14 flex-shrink-0 rounded-sm">
                            <AvatarImage src={profilePicturePreview || editingMember?.profile_picture || undefined} />
                            <AvatarFallback className="rounded-sm bg-primary/10 border border-primary/40"><Upload className="w-5 h-5 text-primary" /></AvatarFallback>
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
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Members" value={members.length} icon={Users} iconColor="border-primary/40 bg-primary/10 text-primary" />
        <StatCard title="New This Month" value={newThisMonth} icon={UserPlus} iconColor="border-secondary/40 bg-secondary/10 text-secondary" />
        <StatCard title="Members' Savings" value={`${settings.currency} ${totalContributions.toLocaleString()}`} icon={Wallet} iconColor="border-accent/50 bg-accent/15 text-accent-foreground" />
      </div>

      {/* Search + List */}
      <Card className="shadow-sm rounded-sm border-t-2 border-t-primary/70">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search members…" className="pl-10 h-10" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(e.target.value.length > 0); setCurrentPage(1); }}
              onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border-t-2 border-primary/60 border-x border-b border-border rounded-sm shadow-lg z-50 overflow-hidden" onMouseDown={(e) => e.preventDefault()}>
                {suggestions.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setSearchQuery(m.name); setShowSuggestions(false); setTimeout(() => handleViewDetails(m), 100); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center gap-3 border-b border-border/50 last:border-0">
                    <Avatar className="h-7 w-7 rounded-sm"><AvatarImage src={m.profile_picture || undefined} /><AvatarFallback className="rounded-sm bg-primary/10 border border-primary/40 text-xs text-primary">{m.name[0]}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-sm">
          {currentMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border-t border-border/60">
              {searchQuery ? "No members found matching your search." : "No members yet. Add the first member to get started."}
            </div>
          ) : (
            // A ruled register sheet: each cell draws its own right and bottom rule, and the sheet
            // runs 1px past the card's right and bottom edges so the outermost rules are clipped.
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 -mr-px -mb-px border-t border-border/60">
              {currentMembers.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2 border-r border-b border-border/60 transition-colors hover:bg-muted/50">
                  <Avatar className="h-10 w-10 rounded-sm flex-shrink-0">
                    <AvatarImage src={member.profile_picture || undefined} />
                    <AvatarFallback className="rounded-sm bg-primary/10 border border-primary/40 text-primary text-sm font-semibold">
                      {initials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate" title={member.name}>{member.name}</p>
                    <p className="text-xs text-muted-foreground">Joined <span className="figure">{format(new Date(member.join_date), settings.dateFormat)}</span></p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="View details" aria-label={`View ${member.name}`} onClick={() => handleViewDetails(member)}><Eye className="w-4 h-4" /></Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Edit member" aria-label={`Edit ${member.name}`} onClick={() => handleEdit(member)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:text-destructive" title="Delete member" aria-label={`Delete ${member.name}`} onClick={() => handleDeleteClick(member)}><Trash2 className="w-4 h-4" /></Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
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

      <MemberDetailsDialog
        memberId={selectedMemberId}
        open={detailsDialogOpen}
        onOpenChange={(o) => { setDetailsDialogOpen(o); if (!o) setSelectedMemberId(null); }}
        onChanged={fetchMembers}
      />

    </div>
  );
}
