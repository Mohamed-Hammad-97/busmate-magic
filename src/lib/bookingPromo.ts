// A typed code must be validated before advancing to payment.
export const needsPromoValidation = (typedCode: string, appliedCode?: string): boolean =>
  typedCode.trim().length > 0 && typedCode.trim().toUpperCase() !== appliedCode?.trim().toUpperCase();