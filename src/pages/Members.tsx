import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  contribution: z.string().min(1, "Monthly contribution is required"),
});

type MemberFormValues = z.infer<typeof formSchema>;

interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  contribution: string;
}

const initialMembers: Member[] = [
  { id: 1, name: "Muhammad Ahmed", email: "ahmed@email.com", phone: "+92 300 1234567", joinDate: "Jan 2024", contribution: "PKR 20,000" },
  { id: 2, name: "Ali Hassan", email: "ali@email.com", phone: "+92 301 2345678", joinDate: "Feb 2024", contribution: "PKR 20,000" },
  { id: 3, name: "Usman Khan", email: "usman@email.com", phone: "+92 302 3456789", joinDate: "Mar 2024", contribution: "PKR 20,000" },
  { id: 4, name: "Imran Malik", email: "imran@email.com", phone: "+92 303 4567890", joinDate: "Jan 2024", contribution: "PKR 20,000" },
];

export default function Members() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      contribution: "",
    },
  });

  const onSubmit = (data: MemberFormValues) => {
    const newMember: Member = {
      id: members.length + 1,
      name: data.name,
      email: data.email,
      phone: data.phone,
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      contribution: data.contribution,
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
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
                  name="contribution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Contribution</FormLabel>
                      <FormControl>
                        <Input placeholder="PKR 20,000" {...field} />
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
                  <p className="text-sm font-medium text-foreground">{member.contribution}</p>
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
