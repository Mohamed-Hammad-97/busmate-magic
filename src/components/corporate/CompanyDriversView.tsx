import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, FileText, Truck, Shield } from "lucide-react";

interface StaffMember {
  id: string;
  full_name: string;
  phone: string;
  license_number?: string;
  documents_url?: string;
  is_active: boolean;
  city: string;
  type: "driver" | "supervisor";
  assigned_lines: string[];
}

export function CompanyDriversView({ staff }: { staff: StaffMember[] }) {
  if (staff.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium mb-1">لا يوجد طاقم مسجل</p>
          <p className="text-sm">سيظهر هنا السائقين والمشرفين المعينين لخطوط شركتك</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {staff.map((member) => (
        <Card key={member.id} className="border-0 shadow-md overflow-hidden">
          <div className={`h-1 ${member.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-muted'}`} />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  member.type === "driver" 
                    ? "bg-blue-100 dark:bg-blue-900/30" 
                    : "bg-purple-100 dark:bg-purple-900/30"
                }`}>
                  {member.type === "driver" ? (
                    <Truck className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Shield className="h-5 w-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{member.full_name}</h3>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                    {member.type === "driver" ? "سائق" : "مشرف"}
                  </Badge>
                </div>
              </div>
              {member.is_active ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">نشط</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">غير نشط</Badge>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <a href={`tel:${member.phone}`} className="hover:text-primary transition-colors" dir="ltr">
                  {member.phone}
                </a>
              </div>
              {member.license_number && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>رخصة: {member.license_number}</span>
                </div>
              )}
              {member.assigned_lines.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  <span>{member.assigned_lines.join("، ")}</span>
                </div>
              )}
            </div>

            {member.documents_url && (
              <a
                href={member.documents_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                عرض المستندات
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
