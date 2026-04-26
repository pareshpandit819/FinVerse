const CATEGORY_MAP: Array<[pattern: RegExp, budgetCategory: string]> = [
  [/food|restaurant|grocery|supermarket|coffee|café|cafe/i, "Food & Dining"],
  [/transport|uber|lyft|taxi|gas station|fuel|parking|toll|transit|airline|flight|hotel|lodging/i, "Travel & Transport"],
  [/shopping|clothing|apparel|amazon|retail|department store/i, "Shopping"],
  [/entertainment|movie|theater|cinema|concert|streaming|netflix|spotify|music|game/i, "Entertainment"],
  [/utilities|electric|water|internet|phone|cable|insurance/i, "Bills & Utilities"],
  [/health|medical|doctor|pharmacy|dental|gym|fitness/i, "Health & Wellness"],
  [/education|tuition|school|university|course|book/i, "Education"],
  [/subscription|software|saas/i, "Subscriptions"],
  [/transfer|payment|payroll|deposit|withdrawal/i, "Transfers"],
];

/** Returns a normalized budget category label for a transaction name. Falls back to "Other". */
export function mapCategory(name: string): string {
  for (const [pattern, label] of CATEGORY_MAP) {
    if (pattern.test(name)) return label;
  }
  return "Other";
}
