import jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import regularAsset from '@/assets/fonts/Amiri-Regular.ttf.asset.json';
import boldAsset from '@/assets/fonts/Amiri-Bold.ttf.asset.json';

export const AR_FONT = 'Amiri';

let fontsPromise: Promise<{ regular: string; bold: string }> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function isTrueTypeFont(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const tag = new DataView(buffer).getUint32(0);
  // 0x00010000 (TTF), 'true', 'ttcf', 'OTTO'
  return tag === 0x00010000 || tag === 0x74727565 || tag === 0x74746366 || tag === 0x4f54544f;
}

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font request failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!isTrueTypeFont(buf)) throw new Error('Font response is not a TrueType file');
  return buf;
}

async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [reg, bold] = await Promise.all([
        fetchFont(regularAsset.url),
        fetchFont(boldAsset.url),
      ]);
      return { regular: toBase64(reg), bold: toBase64(bold) };
    })().catch((e) => {
      fontsPromise = null;
      throw e;
    });
  }
  return fontsPromise;
}

type PdfOptions = {
  orientation?: 'p' | 'portrait' | 'l' | 'landscape';
  unit?: string;
  format?: string | number[];
  compress?: boolean;
  [key: string]: any;
};

/**
 * Creates a jsPDF document with an Arabic-capable font (Amiri) registered
 * and selected. Arabic text is shaped and bidi-ordered by jsPDF automatically.
 */
export async function createArabicPdf(options?: PdfOptions): Promise<jsPDF> {
  const doc = new jsPDF(options as any);
  try {
    const { regular, bold } = await loadFonts();
    doc.addFileToVFS('Amiri-Regular.ttf', regular);
    doc.addFont('Amiri-Regular.ttf', AR_FONT, 'normal');
    doc.addFileToVFS('Amiri-Bold.ttf', bold);
    doc.addFont('Amiri-Bold.ttf', AR_FONT, 'bold');
    doc.setFont(AR_FONT, 'normal');
  } catch (e) {
    // Fall back to the default font so exports never fail completely.
    console.error('Arabic font failed to load, falling back to Helvetica', e);
  }
  return doc;
}

/** True when the document actually has the Arabic font available. */
export function hasArabicFont(doc: jsPDF): boolean {
  const list = doc.getFontList?.() || {};
  return Boolean(list[AR_FONT]);
}

/** Reverses cells for right-to-left column order. */
export function rtlRow<T>(cells: T[], isRtl: boolean): T[] {
  return isRtl ? [...cells].reverse() : cells;
}

/** Base autoTable options honoring the Arabic font and RTL alignment. */
export function arabicTableOptions(doc: jsPDF, isRtl: boolean): Partial<UserOptions> {
  const font = hasArabicFont(doc) ? AR_FONT : undefined;
  const halign: 'right' | 'left' = isRtl ? 'right' : 'left';
  return {
    styles: { font, halign } as any,
    headStyles: { font, fontStyle: 'bold', halign } as any,
    bodyStyles: { font, halign } as any,
    footStyles: { font, fontStyle: 'bold', halign } as any,
  };
}

/** Merges base Arabic styles with per-table overrides. */
export function withArabicTable(
  doc: jsPDF,
  isRtl: boolean,
  options: UserOptions
): UserOptions {
  const base = arabicTableOptions(doc, isRtl);
  return {
    ...options,
    styles: { ...(base.styles as any), ...(options.styles as any) },
    headStyles: { ...(base.headStyles as any), ...(options.headStyles as any) },
    bodyStyles: { ...(base.bodyStyles as any), ...(options.bodyStyles as any) },
    footStyles: { ...(base.footStyles as any), ...(options.footStyles as any) },
  };
}

/** Draws a heading aligned to the correct side of the page. */
export function drawHeading(
  doc: jsPDF,
  text: string,
  y: number,
  isRtl: boolean,
  margin = 14
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (isRtl) {
    doc.text(text, pageWidth - margin, y, { align: 'right' });
  } else {
    doc.text(text, margin, y);
  }
}
