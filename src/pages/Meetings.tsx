import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function Meetings() {
  const { totalMembers } = useOrganization();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Meeting Records</h2>
          <p className="text-muted-foreground mt-1">Schedule and document meetings</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No meetings scheduled</h3>
            <p className="text-muted-foreground mb-6">
              Start by scheduling your first organization meeting
            </p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
