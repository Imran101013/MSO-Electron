import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  fatherName: z.string().min(2, "Father name must be at least 2 characters"),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
});

type MemberFormValues = z.infer<typeof formSchema>;

interface Member {
  id: number;
  name: string;
  fatherName: string;
  dob: string;
  email: string;
  phone: string;
  address: string;
  joinDate: string;
}

const initialMembers: Member[] = [
  { id: 1, name: "Muhammad Ahmed", fatherName: "Ahmed Ali", dob: "1990-05-15", email: "ahmed@email.com", phone: "+92 300 1234567", address: "Street 12, Block A, Lahore", joinDate: "Jan 2024" },
  { id: 2, name: "Ali Hassan", fatherName: "Hassan Mahmood", dob: "1988-08-22", email: "ali@email.com", phone: "+92 301 2345678", address: "House 45, Garden Town, Lahore", joinDate: "Feb 2024" },
  { id: 3, name: "Usman Khan", fatherName: "Khan Sahib", dob: "1992-03-10", email: "usman@email.com", phone: "+92 302 3456789", address: "Flat 3, Model Town, Karachi", joinDate: "Mar 2024" },
  { id: 4, name: "Imran Malik", fatherName: "Malik Abbas", dob: "1985-12-01", email: "imran@email.com", phone: "+92 303 4567890", address: "Plot 78, DHA Phase 5, Islamabad", joinDate: "Jan 2024" },
];

export default function Members() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      fatherName: "",
      dob: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const onSubmit = (data: MemberFormValues) => {
    const newMember: Member = {
      id: members.length + 1,
      name: data.name,
      fatherName: data.fatherName,
      dob: data.dob,
      email: data.email,
      phone: data.phone,
      address: data.address,
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    };

    setMembers([...members, newMember]);
    toast({
      title: "Member Added",
      description: `${data.name} has been successfully added.`,
    });
    form.reset();
    setOpen(false);
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Members</h2>
          <p className="text-muted-foreground mt-1">Manage organization members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle>Add New Member</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
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
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Member</Button>
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
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div 
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
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
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">DOB: {new Date(member.dob).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">Joined {member.joinDate}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
