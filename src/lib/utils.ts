import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGradeStage(grade?: string | null): string | null {
  if (!grade) return null;
  const match = String(grade).match(/(\d+)/);
  if (!match || /kg/i.test(grade)) return null;
  const n = parseInt(match[1], 10);
  if (n >= 1 && n <= 6) return "ابتدائى";
  if (n >= 7 && n <= 9) return "اعدادى";
  if (n >= 10 && n <= 12) return "ثانوى";
  return null;
}

export function formatGrade(grade?: string | null): string {
  if (!grade) return "";
  const stage = getGradeStage(grade);
  return stage ? `${grade} · ${stage}` : grade;
}
