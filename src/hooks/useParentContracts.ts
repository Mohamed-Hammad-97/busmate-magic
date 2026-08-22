import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_VERSION } from "@/lib/contractText";
import { ContractData } from "@/components/parent/ContractDocument";

export function buildContractData(reg: any): ContractData {
  const subscription = reg.subscriptions?.[0];
  const payments = [...(subscription?.payments || [])].sort(
    (a: any, b: any) => (a.installment_number ?? 0) - (b.installment_number ?? 0)
  );
  const insurance = payments.find((p: any) => p.installment_number === 0);
  const installments = payments.map((p: any) => ({
    number: p.installment_number ?? 0,
    amount: Number(p.amount) || 0,
    dueDate: p.due_date,
  }));
  return {
    registrationId: reg.id,
    studentName: reg.student_name,
    schoolName: reg.schools?.name || "",
    grade: reg.grade,
    educationDepartment: reg.education_department,
    carType: reg.car_type,
    insuranceAmount: insurance ? Number(insurance.amount) : 0,
    annualValue: Number(subscription?.value) || 0,
    installmentsCount: subscription?.number_of_installments ?? installments.filter((i) => i.number > 0).length,
    installments,
  };
}

export function useParentContracts(registrations: any[], parentId?: string) {
  const queryClient = useQueryClient();

  const { data: acceptances = [] } = useQuery({
    queryKey: ["parent-contracts", parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from("contract_acceptances")
        .select("*")
        .eq("parent_id", parentId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!parentId,
  });

  // Contracts are required for registrations that are complete and have a subscription
  const requiredRegs = registrations.filter(
    (r: any) => r.status === "complete" && r.subscriptions?.length > 0
  );

  const signedByReg = new Map(acceptances.map((a: any) => [a.registration_id, a]));

  const pending = requiredRegs.filter((r: any) => !signedByReg.has(r.id));

  const signMutation = useMutation({
    mutationFn: async ({ reg, signatureName }: { reg: any; signatureName: string }) => {
      const data = buildContractData(reg);
      const { error } = await supabase.from("contract_acceptances").insert({
        registration_id: reg.id,
        subscription_id: reg.subscriptions?.[0]?.id ?? null,
        parent_id: parentId!,
        contract_version: CONTRACT_VERSION,
        signature_name: signatureName,
        snapshot: data as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-contracts", parentId] });
    },
  });

  return { acceptances, requiredRegs, signedByReg, pending, signMutation };
}
