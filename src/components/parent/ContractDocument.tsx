import { format } from "date-fns";
import {
  CONTRACT_TITLE, COMPANY_INTRO, COMPANY_OBLIGATIONS, PARENT_INTRO,
  PARENT_OBLIGATIONS, FUEL_NOTE, COMPANY_FOOTER,
} from "@/lib/contractText";

export interface ContractData {
  registrationId: string;
  studentName: string;
  schoolName: string;
  grade: string;
  educationDepartment: string;
  carType: string;
  insuranceAmount: number;
  annualValue: number;
  installmentsCount: number;
  installments: { number: number; amount: number; dueDate: string }[];
}

const eduLabel = (v: string) =>
  v === "national" ? "National" : v === "ig" ? "IG (International)" : v === "american" ? "American" : v || "-";

const carLabel = (v: string) => (v === "ac" ? "مكيفة" : v === "non_ac" ? "غير مكيفة" : v || "-");

export function ContractDocument({
  data,
  parentName,
  signature,
  acceptedAt,
}: {
  data: ContractData;
  parentName?: string;
  signature?: string | null;
  acceptedAt?: string | null;
}) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex gap-2 py-1.5 border-b border-border/50 text-sm">
      <span className="text-muted-foreground min-w-[130px]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div dir="rtl" className="space-y-6 text-right leading-relaxed">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold">{CONTRACT_TITLE}</h2>
      </div>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-primary">{COMPANY_INTRO}</p>
        <ol className="list-decimal pr-5 space-y-2 text-sm">
          {COMPANY_OBLIGATIONS.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-primary">{PARENT_INTRO}</p>
        <ol className="list-decimal pr-5 space-y-2 text-sm">
          {PARENT_OBLIGATIONS.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-bold">عدد ومواعيد دفع دفعات الاشتراك السنوي</h3>
        <div className="rounded-xl border p-4 bg-muted/30">
          <Row label="اسم الطالب/ة" value={data.studentName} />
          <Row label="المدرسة" value={data.schoolName || "-"} />
          <Row label="الصف" value={data.grade || "-"} />
          <Row label="القسم التعليمي" value={eduLabel(data.educationDepartment)} />
          <Row label="نوع السيارة" value={carLabel(data.carType)} />
          <Row label="قيمة التأمين" value={`${data.insuranceAmount.toLocaleString()} ج.م`} />
          <Row label="قيمة الاشتراك السنوي" value={`${data.annualValue.toLocaleString()} ج.م`} />
          <Row label="عدد الدفعات" value={data.installmentsCount} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right font-semibold">رقم الدفعة</th>
                <th className="p-2 text-right font-semibold">قيمة الدفعة</th>
                <th className="p-2 text-right font-semibold">موعد الاستحقاق</th>
              </tr>
            </thead>
            <tbody>
              {data.installments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-muted-foreground">
                    لا توجد دفعات مسجلة
                  </td>
                </tr>
              ) : (
                data.installments.map((ins, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{ins.number === 0 ? "التأمين" : `الدفعة ${ins.number}`}</td>
                    <td className="p-2">{Number(ins.amount).toLocaleString()} ج.م</td>
                    <td className="p-2">{ins.dueDate ? format(new Date(ins.dueDate), "yyyy/MM/dd") : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">{FUEL_NOTE}</p>
      </section>

      <section className="pt-2 border-t space-y-1">
        <p className="text-sm">
          <span className="text-muted-foreground">توقيع ولي الأمر: </span>
          <span className="font-semibold">{signature || parentName || "—"}</span>
        </p>
        {acceptedAt && (
          <p className="text-xs text-muted-foreground">
            تم التوقيع والموافقة بتاريخ {format(new Date(acceptedAt), "yyyy/MM/dd HH:mm")}
          </p>
        )}
      </section>

      <footer className="pt-3 border-t text-[11px] text-muted-foreground space-y-0.5" dir="ltr">
        {COMPANY_FOOTER.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </footer>
    </div>
  );
}
