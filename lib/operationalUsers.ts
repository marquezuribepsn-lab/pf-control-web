const TEST_ACCOUNT_EMAIL_PATTERNS = [
  /\+(alumno|colab|colabmail|acct|acctchg|smoke|reset)\d*@/i,
  /\+(staff|test|qa|demo|sandbox)\d*@/i,
  /^smoke\..+@example\.com$/i,
];

const PRIMARY_ADMIN_EMAIL = String(
  process.env.PRIMARY_ADMIN_EMAIL || 'marquezuribepsn@gmail.com'
)
  .trim()
  .toLowerCase();

export function isTestAccountEmail(email: string | null | undefined): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return TEST_ACCOUNT_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized === PRIMARY_ADMIN_EMAIL;
}

export function filterOperationalUsers<T extends { email?: string | null }>(users: T[]): T[] {
  return users.filter((user) => !isTestAccountEmail(user.email));
}
