import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone, Pencil, Trash2, Eye, Upload, X, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization, Member, MonthlyContribution } from "@/contexts/OrganizationContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  fatherName: z.string().min(2, "Father name must be at least 2 characters"),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  joinDate: z.string().min(1, "Join date is required"),
  profilePicture: z.string().optional(),
  pastMeetings: z.array(z.object({
    date: z.string().min(1, "Date is required"),
    present: z.boolean(),
  })).default([]),
});

const contributionSchema = z.object({
  month: z.string().min(1, "Month is required"),
  amount: z.number().min(1, "Amount must be greater than 0"),
  paid: z.boolean(),
});

type MemberFormValues = z.infer<typeof formSchema>;
type ContributionFormValues = z.infer<typeof contributionSchema>;

export default function Members() {
  const { members, setMembers } = useOrganization();
  const [open, setOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>("");
  const { toast } = useToast();

  const MEMBERS_PER_PAGE = 5;
  
  // Filter members based on search query
  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE);
  const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
  const endIndex = startIndex + MEMBERS_PER_PAGE;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);
  
  // Get suggestions for autocomplete
  const suggestions = searchQuery.length > 0 
    ? members.filter(member => 
        member.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
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
      pastMeetings: [],
    },
  });

  const { fields: pastMeetingFields, append: appendMeeting, remove: removeMeeting } = useFieldArray({
    control: form.control,
    name: "pastMeetings",
  });

  const contributionForm = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      month: "",
      amount: 0,
      paid: false,
    },
  });

  const onSubmit = (data: MemberFormValues) => {
    if (editingMember) {
      // Update existing member
      const updatedMembers = members.map(m => 
        m.id === editingMember.id 
          ? { ...m, ...data }
          : m
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
        attendance: (data.pastMeetings || []).map(m => ({ date: m.date || "", present: m.present })),
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
      pastMeetings: member.attendance,
    });
    setOpen(true);
  };

  const handleDeleteClick = (member: Member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      setMembers(members.filter(m => m.id !== memberToDelete.id));
      toast({
        title: "Member Deleted",
        description: `${memberToDelete.name} has been removed.`,
      });
      setMemberToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleAddContribution = (data: ContributionFormValues) => {
    if (!selectedMember) return;

    const updatedMembers = members.map(m => {
      if (m.id === selectedMember.id) {
        const newContribution: MonthlyContribution = {
          month: data.month,
          amount: data.amount,
          paid: data.paid,
        };
        
        const updatedContributions = [...m.monthlyContributions, newContribution];
        const updatedBudget = data.paid ? m.totalBudget + data.amount : m.totalBudget;
        
        return {
          ...m,
          monthlyContributions: updatedContributions,
          totalBudget: updatedBudget,
        };
      }
      return m;
    });

    setMembers(updatedMembers);
    
    // Update selected member to reflect changes in the details dialog
    const updatedSelectedMember = updatedMembers.find(m => m.id === selectedMember.id);
    if (updatedSelectedMember) {
      setSelectedMember(updatedSelectedMember);
    }

    toast({
      title: "Contribution Added",
      description: `Monthly contribution for ${data.month} has been added${data.paid ? ' and budget updated' : ''}.`,
    });

    contributionForm.reset();
    setContributionDialogOpen(false);
  };

  const handleViewDetails = (member: Member) => {
    setSelectedMember(member);
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

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfilePicturePreview(base64String);
        form.setValue("profilePicture", base64String);
      };
      reader.readAsDataURL(file);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Members</h2>
          <p className="text-muted-foreground mt-1">Manage organization members</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <Input type="email" placeholder="member@email.com" {...field} />
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
                        <Input placeholder="+92 300 1234567" {...field} />
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
                      <FormControl>
                        <Input placeholder="Enter full address" {...field} />
                      </FormControl>
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
                      <AvatarImage src={profilePicturePreview || editingMember?.profilePicture} />
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
                      <p className="text-xs text-muted-foreground mt-1">Upload a profile picture (optional)</p>
                    </div>
                  </div>
                </div>

                {/* Past Meeting Records */}
                {!editingMember && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label>Past Meeting Records (Optional)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendMeeting({ date: "", present: true })}
                        className="gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        Add Meeting
                      </Button>
                    </div>
                    {pastMeetingFields.length > 0 && (
                      <div className="space-y-3 max-h-60 overflow-y-auto border border-border rounded-md p-3">
                        {pastMeetingFields.map((field, index) => (
                          <div key={field.id} className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={`pastMeetings.${index}.date`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Meeting Date</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`pastMeetings.${index}.present`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0 pt-8">
                                    <FormControl>
                                      <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={field.onChange}
                                        className="w-4 h-4 rounded border-border"
                                      />
                                    </FormControl>
                                    <FormLabel className="text-xs font-normal cursor-pointer">
                                      Present
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMeeting(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {pastMeetingFields.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
                        No past meetings added. Click "Add Meeting" to record attendance history.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingMember ? "Update Member" : "Add Member"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
                onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
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
                      className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-b-0"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={member.profilePicture} />
                        <AvatarFallback className="bg-gradient-primary">
                          <span className="text-primary-foreground text-sm font-semibold">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profilePicture} />
                    <AvatarFallback className="bg-gradient-primary">
                      <span className="text-primary-foreground font-semibold">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {member.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">DOB: {new Date(member.dob).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">Joined {member.joinDate}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(member)}
                      className="h-8 w-8"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(member)}
                      className="h-8 w-8"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(member)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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
                onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => handlePageChange(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext 
                onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
              Are you sure you want to delete {memberToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
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
                      {selectedMember.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">{selectedMember.name}</h3>
                  <p className="text-muted-foreground">Father: {selectedMember.fatherName}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file && selectedMember) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          const updatedMembers = members.map(m =>
                            m.id === selectedMember.id
                              ? { ...m, profilePicture: base64String }
                              : m
                          );
                          setMembers(updatedMembers);
                          setSelectedMember({ ...selectedMember, profilePicture: base64String });
                          toast({
                            title: "Profile Picture Updated",
                            description: "The member's profile picture has been updated.",
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="gap-2"
                >
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
                  <p className="font-medium">{new Date(selectedMember.dob).toLocaleDateString()}</p>
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
                  <p className="font-medium text-lg text-primary">PKR {selectedMember.totalBudget.toLocaleString()}</p>
                </div>
              </div>

              <Tabs defaultValue="contributions" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="contributions">Contributions</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="loans">Loans</TabsTrigger>
                </TabsList>
                
                <TabsContent value="contributions" className="space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardDescription>Monthly contribution history</CardDescription>
                      <Button 
                        size="sm" 
                        onClick={() => setContributionDialogOpen(true)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Contribution
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedMember.monthlyContributions.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.monthlyContributions.map((contribution, index) => (
                              <TableRow key={index}>
                                <TableCell>{contribution.month}</TableCell>
                                <TableCell>PKR {contribution.amount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    contribution.paid 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {contribution.paid ? 'Paid' : 'Pending'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No contributions recorded</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="attendance" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardDescription>Meeting attendance record</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedMember.attendance.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.attendance.map((record, index) => (
                              <TableRow key={index}>
                                <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    record.present 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {record.present ? 'Present' : 'Absent'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No attendance records</p>
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
                              <TableHead>Amount</TableHead>
                              <TableHead>Remaining</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedMember.loans.map((loan) => (
                              <TableRow key={loan.id}>
                                <TableCell>{new Date(loan.date).toLocaleDateString()}</TableCell>
                                <TableCell>PKR {loan.amount.toLocaleString()}</TableCell>
                                <TableCell>PKR {loan.remainingAmount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    loan.status === 'Paid' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {loan.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No loans recorded</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Monthly Contribution</DialogTitle>
          </DialogHeader>
          <Form {...contributionForm}>
            <form onSubmit={contributionForm.handleSubmit(handleAddContribution)} className="space-y-4">
              <FormField
                control={contributionForm.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contributionForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (PKR)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="5000" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contributionForm.control}
                name="paid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Mark as Paid
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        This will automatically add the amount to total budget
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setContributionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Contribution</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
