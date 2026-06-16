/** UUID v4. Available in extension service workers and browsers. */
export function uuid(): string {
  return crypto.randomUUID();
}
