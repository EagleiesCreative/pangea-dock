// Access model: one Clerk Organization = one Production.
//   org:admin   → edit + invite/manage crew (Clerk default)
//   org:member  → edit                       (Clerk default)
//   org:viewer  → view only                  (custom role — create in Clerk Dashboard → Roles & Permissions, key "viewer")
// Any role not listed in EDIT_ROLES is treated as view-only.
export const EDIT_ROLES = ["org:admin", "org:member", "org:editor"];

/** Clerk role keys are normally "org:<key>", but accept bare keys too. */
export const normRole = (role?: string | null) => (!role ? null : role.startsWith("org:") ? role : `org:${role}`);

export const canEditRole = (role?: string | null) => {
  const r = normRole(role);
  return !!r && EDIT_ROLES.includes(r);
};
export const isAdminRole = (role?: string | null) => normRole(role) === "org:admin";

export const roleLabel = (role?: string | null) => {
  const r = normRole(role);
  if (!r) return "No access";
  if (r === "org:admin") return "Admin";
  if (canEditRole(r)) return "Editor";
  return "Viewer";
};
