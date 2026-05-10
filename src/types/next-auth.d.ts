import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: "SUPER_ADMIN" | "VETERAN" | "COORDINATOR" | "CLINICAL_LEAD" | "PROGRAM_MANAGER";
      organizationId?: string | null;
      isOrgAdmin?: boolean;
      mfaEnabled?: boolean;
      /**
       * AccountState mirror exposed via the session callback. Non-ACTIVE
       * values mean every authenticated layout's `requireActiveSession`
       * helper bounces the user to /auth/account-suspended.
       */
      accountState?: "INVITED" | "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    };
  }
}
