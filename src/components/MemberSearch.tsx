import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganization, Member } from "@/contexts/OrganizationContext";
import MemberDetailsDialog from "@/components/MemberDetailsDialog";

export default function MemberSearch() {
  const { members, refreshData } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Filter suggestions based on search query
  const suggestions =
    searchQuery.length > 0
      ? members
          .filter((member) =>
            member.name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSelectMember = (member: Member) => {
    setSearchQuery(member.name);
    setShowSuggestions(false);
    setSelectedMemberId(member.dbId);
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
            className="absolute top-full left-0 right-0 mt-2 bg-card border-t-2 border-primary/60 border-x border-b border-border rounded-sm shadow-lg z-50 max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}>
            {suggestions.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelectMember(member)}
                className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-center gap-3 border-b border-border last:border-b-0">
                <Avatar className="h-8 w-8 flex-shrink-0 rounded-sm">
                  <AvatarImage src={member.profilePicture} />
                  <AvatarFallback className="rounded-sm bg-primary/10 border border-primary/30">
                    <span className="text-primary text-sm font-semibold">
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

      <MemberDetailsDialog
        memberId={selectedMemberId}
        open={detailsDialogOpen}
        onOpenChange={handleDialogClose}
        onChanged={refreshData}
      />
    </>
  );
}
