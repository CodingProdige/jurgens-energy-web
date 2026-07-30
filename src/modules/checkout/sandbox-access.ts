type SandboxCheckoutUser = {
  adminCapabilities: readonly string[];
  roles: readonly string[];
};

export function hasCourierGuySandboxCheckoutAccess(
  user: SandboxCheckoutUser | null | undefined,
) {
  if (!user) {
    return false;
  }

  const hasAdminRole =
    user.roles.includes("admin") || user.roles.includes("superadmin");

  return (
    hasAdminRole &&
    user.adminCapabilities.includes("admin.settings.manage")
  );
}
