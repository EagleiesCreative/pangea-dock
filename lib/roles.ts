// Access model: one Clerk Organization = one Production.
//   org:admin   → edit + invite/manage crew (Clerk default)
//   org:member  → edit                       (Clerk default)
//   org:viewer  → view only                  (custom role — create in Clerk Dashboard → Roles & Permissions, key "viewer")
// Any role not listed in EDIT_ROLES is treated as view-only.
export const EDIT_ROLES = ["org:admin", "org:member", "org:editor"];

export const canEditRole = (role?: string | null) => !!role && EDIT_ROLES.includes(role);

export const roleLabel = (role?: string | null) => {
  if (!role) return "No access";
  if (role === "org:admin") return "Admin";
  if (canEditRole(role)) return "Editor";
  return "Viewer";
};
