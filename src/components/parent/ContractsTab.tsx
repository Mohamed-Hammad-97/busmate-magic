import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSignature, FileText, Printer, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ContractDocument, ContractData } from "./ContractDocument";
import { ContractDialog } from "./ContractDialog";
import { buildContractData, useParentContracts } from "@/hooks/useParentContracts";
import { useToast } from "@/hooks/use-toast";

interface Props {
  registrations: any[];
  parentId?: string;
  parentName?: string;
}

export function ContractsTab({ registrations, parentId, parentName }: Props) {
  const { requiredRegs, signedByReg, signMutation } = useParentContracts(registrations, parentId);
  const [viewing, setViewing] = useState<{ data: ContractData; signature: string; acceptedAt: string } | null>(null);
  const [signingReg, setSigningReg] = useState<any>(null);
  const { toast } = useToast();

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">العقود والقواعد</h2>
        <p className="text-sm text-muted-foreground mt-1">عقد منفصل لكل طالب مشترك في الخدمة</p>
      </div>

      {requiredRegs.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p>لا توجد عقود متاحة حتى الآن. تظهر العقود بعد اكتمال الاشتراك.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {requiredRegs.map((reg: any) => {
            const acceptance: any = signedByReg.get(reg.id);
            return (
              <Card key={reg.id} className="border-0 shadow-md overflow-hidden">
                <div className={`h-1 ${acceptance ? "bg-green-500" : "bg-amber-500"}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate">{reg.student_name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{reg.schools?.name}</p>
                    </div>
                    <Badge variant={acceptance ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {acceptance ? "موقّع" : "بانتظار التوقيع"}
                    </Badge>
                  </div>

                  {acceptance ? (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {acceptance.signature_name} • {format(new Date(acceptance.accepted_at), "yyyy/MM/dd")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      يجب قراءة العقد والتوقيع عليه
                    </div>
                  )}

                  <div className="flex gap-2">
                    {acceptance ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          setViewing({
                            data: (acceptance.snapshot && Object.keys(acceptance.snapshot).length
                              ? acceptance.snapshot
                              : buildContractData(reg)) as ContractData,
                            signature: acceptance.signature_name,
                            acceptedAt: acceptance.accepted_at,
                          })
                        }
                      >
                        <FileText className="h-3.5 w-3.5 ml-1" />
                        عرض العقد
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1" onClick={() => setSigningReg(reg)}>
                        <FileSignature className="h-3.5 w-3.5 ml-1" />
                        قراءة وتوقيع
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ContractDialog
        open={!!signingReg}
        onOpenChange={(v) => !v && setSigningReg(null)}
        contract={signingReg ? buildContractData(signingReg) : null}
        parentName={parentName}
        isSaving={signMutation.isPending}
        onSign={(signatureName) =>
          signMutation.mutate(
            { reg: signingReg, signatureName },
            {
              onSuccess: () => {
                toast({ title: "تم التوقيع", description: "تم حفظ موافقتك على العقد بنجاح" });
                setSigningReg(null);
              },
              onError: () => toast({ title: "تعذر حفظ التوقيع", variant: "destructive" }),
            }
          )
        }
      />

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 pb-3 border-b text-right" dir="rtl">
            <DialogTitle>العقد الموقّع</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 print:overflow-visible">
            {viewing && (
              <ContractDocument
                data={viewing.data}
                signature={viewing.signature}
                acceptedAt={viewing.acceptedAt}
              />
            )}
          </div>
          <div className="border-t p-4 flex justify-end print:hidden">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
