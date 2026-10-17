import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getCancelState, cancelErrorMessage } from "@/lib/bookingCancel";

export function CancelBookingButton({ booking, isRtl }: { booking: any; isRtl: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const state = getCancelState(booking);
  if (state === "none") return null;
  if (state === "paid") return <p className="text-xs text-muted-foreground">{isRtl ? "الحجوزات المدفوعة: تواصل مع الدعم للإلغاء" : "Paid bookings: contact support to cancel"}</p>;
  if (state === "closed") return <p className="text-xs text-muted-foreground">{isRtl ? "انتهت مهلة الإلغاء" : "Cancellation window closed"}</p>;

  const doCancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_daily_line_booking", { _booking_id: booking.id });
    setBusy(false);
    if (error) { toast({ title: cancelErrorMessage(error.message, isRtl), variant: "destructive" }); return; }
    toast({ title: isRtl ? "تم إلغاء الحجز" : "Booking cancelled" });
    qc.invalidateQueries({ queryKey: ["dl-bookings"] });
    qc.invalidateQueries({ queryKey: ["dl-tracking-booking"] });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 min-w-[140px] text-destructive border-destructive/40" disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
          {isRtl ? "إلغاء الحجز" : "Cancel booking"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{isRtl ? "إلغاء الحجز؟" : "Cancel this booking?"}</AlertDialogTitle>
          <AlertDialogDescription>{isRtl ? "سيتم إلغاء حجزك وإتاحة المقعد لغيرك." : "Your seat will be released for others."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{isRtl ? "رجوع" : "Back"}</AlertDialogCancel>
          <AlertDialogAction onClick={doCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isRtl ? "تأكيد الإلغاء" : "Confirm cancel"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
