/**
 * NextAuth route handler. Magic-link email provider is wired here at runtime
 * so we can inject org-aware "from" addresses based on the requesting subdomain.
 */
import { handlers } from "@/lib/auth/config";

export const { GET, POST } = handlers;
