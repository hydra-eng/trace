export function useRole(): string {
  const token = localStorage.getItem('token');
  if (!token) return 'viewer';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || 'viewer';
  } catch {
    return 'viewer';
  }
}

export function useUserIdentity() {
  const token = localStorage.getItem('token');
  if (!token) return { name: "Guest", badge: "", role: "viewer" };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      name: payload.name || "Guest",
      badge: payload.badge || "",
      role: payload.role || "viewer"
    };
  } catch {
    return { name: "Guest", badge: "", role: "viewer" };
  }
}
