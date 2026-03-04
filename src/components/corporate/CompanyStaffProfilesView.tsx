import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, FileText, CreditCard, Truck, CheckCircle, XCircle } from "lucide-react";

interface StaffMember {
  id: string;
  full_name: string;
  phone: string;
  type: "driver" | "supervisor";
  is_active: boolean;
  assigned_lines: string[];
  profile: {
    bank_name: string | null;
    bank_account_name: string | null;
    id_document_url: string | null;
    license_document_url: string | null;
    contract_document_url: string | null;
  } | null;
}

interface CompanyStaffProfilesViewProps {
  staff: StaffMember[];
}

export function CompanyStaffProfilesView({ staff }: CompanyStaffProfilesViewProps) {
  if (staff.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p>No staff profiles available</p>
        </CardContent>
      </Card>
    );
  }

  const DocStatus = ({ label, url }: { label: string; url: string | null | undefined }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {url ? (
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
      <span className={url ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {staff.map((member) => (
        <Card key={member.id} className="border-0 shadow-md overflow-hidden">
          <div className={`h-1 ${member.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-muted'}`} />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {member.full_name[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{member.full_name}</h3>
                  <p className="text-xs text-muted-foreground" dir="ltr">{member.phone}</p>
                </div>
              </div>
              <Badge variant={member.type === "driver" ? "default" : "secondary"} className="text-[10px]">
                {member.type === "driver" ? "Driver" : "Supervisor"}
              </Badge>
            </div>

            {member.assigned_lines.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                {member.assigned_lines.join(", ")}
              </div>
            )}

            {/* Documents Status */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Documents
              </p>
              <div className="grid grid-cols-2 gap-1">
                <DocStatus label="National ID" url={member.profile?.id_document_url} />
                <DocStatus label="License" url={member.profile?.license_document_url} />
                <DocStatus label="Contract" url={member.profile?.contract_document_url} />
              </div>
            </div>

            {/* Bank Info */}
            {member.profile?.bank_name && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  Bank Details
                </p>
                <p className="text-xs text-foreground">{member.profile.bank_name} — {member.profile.bank_account_name || "N/A"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
