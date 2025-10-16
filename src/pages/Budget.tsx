import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";

const monthlyData = [
  { month: "March 2025", collected: "PKR 42,000", members: 42, status: "Completed" },
  { month: "February 2025", collected: "PKR 40,000", members: 40, status: "Completed" },
  { month: "January 2025", collected: "PKR 38,000", members: 38, status: "Completed" },
];

export default function Budget() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Monthly Budget</h2>
          <p className="text-muted-foreground mt-1">Track monthly contributions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Record Collection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR 42,000</p>
            <p className="text-sm text-secondary mt-2">42 members contributed</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Average/Month</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR 1,000</p>
            <p className="text-sm text-muted-foreground mt-2">Per member</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR 850,000</p>
            <p className="text-sm text-muted-foreground mt-2">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Collection History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyData.map((data, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div>
                  <h3 className="font-semibold text-foreground">{data.month}</h3>
                  <p className="text-sm text-muted-foreground">{data.members} members</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{data.collected}</p>
                  <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-full">
                    {data.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
