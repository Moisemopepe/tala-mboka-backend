import Notification from "../models/Notification.js";

export function notifyRoles({ roles = ["admin", "moderator"], reportId, type, title, message }) {
  return Notification.create({ roles, reportId, type, title, message });
}

export function notifyUser({ userId, reportId, type, title, message }) {
  if (!userId) return null;
  return Notification.create({ userId, reportId, type, title, message });
}
