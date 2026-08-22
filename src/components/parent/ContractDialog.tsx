import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSignature } from "lucide-react";
import { ContractDocument, ContractData } from "./ContractDocument";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractData | null;
  parentName?: string;
  index?: number;
  total?: number;
  isSaving?: boolean;
  onSign: (signatureName: string) => void;
  allowLater?: boolean;
}

export function ContractDialog({
  open, onOpenChange, contract, parentName, index, total, isSaving, onSign, allowLater = true,
}: Props) {
  const { t, i18n } = useTranslation();
  const dir = i18n.language === "ar" ? "rtl" : "ltr";
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState(parentName || "");
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolledToEnd(true);
  };

  if (!contract) return null;

  const canSign = agreed && signature.trim().length >= 3 && scrolledToEnd && !isSaving;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !allowLater) return; onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b" dir={dir}>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            {t("parentPortal.contractDialogTitle")} — {contract.studentName}
          </DialogTitle>
          <DialogDescription>
            {total && total > 1 ? `${t("parentPortal.contractOf", { index: (index ?? 0) + 1, total })} — ` : ""}
            {t("parentPortal.contractReadPrompt")}
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-5">
          <ContractDocument data={contract} parentName={parentName} />
        </div>

        <div className="border-t p-4 space-y-3 bg-muted/20" dir={dir}>
          {!scrolledToEnd && (
            <p className="text-xs text-amber-600 font-medium">
              {t("parentPortal.scrollToRead")}
            </p>
          )}
          <div className="flex items-start gap-2">
            <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
            <Label htmlFor="agree" className="text-sm leading-snug cursor-pointer">
              {t("parentPortal.agreeCheckbox")}
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signature" className="text-sm">{t("parentPortal.signatureLabel")}</Label>
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={t("parentPortal.fullNamePlaceholder")}
            />
          </div>
          <div className="flex gap-2 justify-end">
            {allowLater && (
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t("parentPortal.later")}
              </Button>
            )}
            <Button disabled={!canSign} onClick={() => onSign(signature.trim())}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {t("parentPortal.agreeAndSign")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
